//! HTTP handlers for static files and authentication

use axum::{
    extract::State,
    http::{header, StatusCode},
    response::{Html, IntoResponse, Response},
    routing::{get, post},
    Json, Router,
};
use axum_extra::extract::cookie::{Cookie, SameSite};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::fs;
use tower_http::services::{ServeDir, ServeFile};

use crate::adapters::{FileSystemAdapter, StorageAdapter, SystemAdapter, TerminalAdapter};
use crate::auth::create_session_token;
use crate::config::Config;
use crate::connection::table::SharedConnectionTable;
use crate::protocol::{TerminalDataEvent, TerminalExitEvent};
use tokio::sync::mpsc;

/// Application state shared across handlers
#[derive(Clone)]
pub struct AppState {
    pub config: Arc<Config>,
    pub connection_table: SharedConnectionTable,
    pub terminal_adapter: Arc<TerminalAdapter>,
    pub filesystem_adapter: Arc<FileSystemAdapter>,
    pub system_adapter: Arc<SystemAdapter>,
    pub storage_adapter: Arc<StorageAdapter>,
    pub terminal_data_tx: mpsc::UnboundedSender<TerminalDataEvent>,
    pub terminal_exit_tx: mpsc::UnboundedSender<TerminalExitEvent>,
}

/// Login request body
#[derive(Debug, Deserialize)]
pub struct LoginRequest {
    pub password: String,
}

/// Login response body
#[derive(Debug, Serialize)]
pub struct LoginResponse {
    pub success: bool,
    pub message: String,
}

/// Create the router
pub fn create_router(state: AppState) -> Router {
    let static_dir = state.config.server.static_dir.clone();
    
    // Log the static dir being used
    tracing::info!("Serving static files from: {:?}", static_dir);

    Router::new()
        // API routes
        .route("/api/auth/login", post(login_handler))
        .route("/api/auth/logout", post(logout_handler))
        .route("/api/health", get(health_handler))
        // WebSocket route
        .route("/ws", get(super::websocket::ws_handler))
        // Static files (SPA fallback to index.html)
        .fallback_service(
            ServeDir::new(&static_dir)
                .not_found_service(ServeFile::new(static_dir.join("index.html")))
        )
        .with_state(state)
}

/// Login handler
pub async fn login_handler(
    State(state): State<AppState>,
    Json(request): Json<LoginRequest>,
) -> Response {
    // Check password
    let valid = match &state.config.auth.password {
        Some(expected) => request.password == *expected,
        None => true, // No password configured, allow all
    };

    if valid {
        // Create session token
        let token = create_session_token(state.config.auth.session_expiry_hours);

        // Set cookie
        let cookie = Cookie::build(("session_token", token.token))
            .http_only(true)
            .secure(false) // Set to true in production with HTTPS
            .same_site(SameSite::Strict)
            .path("/")
            .max_age(time::Duration::hours(state.config.auth.session_expiry_hours as i64))
            .build();

        let response = LoginResponse {
            success: true,
            message: "Login successful".to_string(),
        };

        (
            StatusCode::OK,
            [(header::SET_COOKIE, cookie.to_string())],
            Json(response),
        )
            .into_response()
    } else {
        let response = LoginResponse {
            success: false,
            message: "Invalid password".to_string(),
        };

        (StatusCode::UNAUTHORIZED, Json(response)).into_response()
    }
}

/// Logout handler
pub async fn logout_handler() -> Response {
    // Clear session cookie
    let cookie = Cookie::build(("session_token", ""))
        .http_only(true)
        .secure(false)
        .same_site(SameSite::Strict)
        .path("/")
        .max_age(time::Duration::seconds(0))
        .build();

    let response = LoginResponse {
        success: true,
        message: "Logged out".to_string(),
    };

    (
        StatusCode::OK,
        [(header::SET_COOKIE, cookie.to_string())],
        Json(response),
    )
        .into_response()
}

/// Health check handler
pub async fn health_handler() -> Json<serde_json::Value> {
    Json(serde_json::json!({
        "status": "ok",
        "version": env!("CARGO_PKG_VERSION"),
    }))
}

/// Serve static files
#[allow(dead_code)]
pub async fn serve_static(State(state): State<AppState>, path: String) -> Response {
    let file_path = state.config.server.static_dir.join(&path);

    if file_path.exists() && file_path.is_file() {
        match fs::read(&file_path).await {
            Ok(content) => {
                let mime = mime_guess::from_path(&file_path)
                    .first_or_octet_stream()
                    .to_string();

                (
                    StatusCode::OK,
                    [(header::CONTENT_TYPE, mime)],
                    content,
                )
                    .into_response()
            }
            Err(_) => StatusCode::INTERNAL_SERVER_ERROR.into_response(),
        }
    } else {
        // SPA fallback: serve index.html
        let index_path = state.config.server.static_dir.join("index.html");
        match fs::read_to_string(&index_path).await {
            Ok(content) => Html(content).into_response(),
            Err(_) => StatusCode::NOT_FOUND.into_response(),
        }
    }
}
