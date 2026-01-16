//! HTTP handlers for static files and authentication

use axum::{
    body::Body,
    extract::{Query, State},
    http::{header, HeaderMap, HeaderValue, Method, StatusCode},
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

/// Proxy query parameters
#[derive(Debug, Deserialize)]
pub struct ProxyQuery {
    pub url: String,
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
        .route("/api/proxy", axum::routing::any(proxy_handler))
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

/// Proxy handler - forwards requests to external URLs to avoid CORS issues
pub async fn proxy_handler(
    method: Method,
    headers: HeaderMap,
    Query(query): Query<ProxyQuery>,
    body: Body,
) -> Response {
    let client = match reqwest::Client::builder()
        .danger_accept_invalid_certs(false)
        .build()
    {
        Ok(c) => c,
        Err(e) => {
            tracing::error!("Failed to create HTTP client: {}", e);
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "Failed to create HTTP client" })),
            )
                .into_response();
        }
    };

    tracing::info!("Proxying {} request to: {}", method, query.url);
    
    // Log incoming headers for debugging
    for (key, value) in headers.iter() {
        if let Ok(v) = value.to_str() {
            // Don't log authorization header value for security
            if key.as_str().to_lowercase() == "authorization" {
                tracing::debug!("Header: {} = [REDACTED]", key);
            } else if key.as_str().to_lowercase() == "x-proxy-headers" {
                tracing::debug!("Header: {} = {}", key, &v[..v.len().min(200)]);
            } else {
                tracing::debug!("Header: {} = {}", key, v);
            }
        }
    }

    // Build the request
    let mut request_builder = match method {
        Method::GET => client.get(&query.url),
        Method::POST => client.post(&query.url),
        Method::PUT => client.put(&query.url),
        Method::DELETE => client.delete(&query.url),
        Method::PATCH => client.patch(&query.url),
        Method::HEAD => client.head(&query.url),
        Method::OPTIONS => client.request(reqwest::Method::OPTIONS, &query.url),
        _ => {
            return (
                StatusCode::METHOD_NOT_ALLOWED,
                Json(serde_json::json!({ "error": "Method not allowed" })),
            )
                .into_response();
        }
    };

    // Try to parse original headers from X-Proxy-Headers
    if let Some(proxy_headers) = headers.get("x-proxy-headers") {
        if let Ok(headers_str) = proxy_headers.to_str() {
            if let Ok(parsed_headers) = serde_json::from_str::<serde_json::Value>(headers_str) {
                if let Some(obj) = parsed_headers.as_object() {
                    for (key, value) in obj {
                        if let Some(v) = value.as_str() {
                            // Skip some headers that shouldn't be forwarded
                            let key_lower = key.to_lowercase();
                            if key_lower != "host" && key_lower != "x-proxy-headers" {
                                if let Ok(header_name) = reqwest::header::HeaderName::from_bytes(key.as_bytes()) {
                                    request_builder = request_builder.header(header_name, v);
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    // Forward content-type header if present
    if let Some(content_type) = headers.get(header::CONTENT_TYPE) {
        if let Ok(ct) = content_type.to_str() {
            request_builder = request_builder.header(reqwest::header::CONTENT_TYPE, ct);
        }
    }

    // Convert body to bytes
    let body_bytes = match axum::body::to_bytes(body, usize::MAX).await {
        Ok(b) => b,
        Err(e) => {
            tracing::error!("Failed to read request body: {}", e);
            return (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({ "error": "Failed to read request body" })),
            )
                .into_response();
        }
    };
    
    tracing::info!("Request body size: {} bytes", body_bytes.len());
    // Log first 500 chars of body for debugging (avoid logging sensitive data)
    if !body_bytes.is_empty() {
        if let Ok(body_str) = std::str::from_utf8(&body_bytes) {
            let preview = &body_str[..body_str.len().min(500)];
            tracing::debug!("Request body preview: {}", preview);
        }
    }

    // Set body if not empty
    if !body_bytes.is_empty() {
        request_builder = request_builder.body(body_bytes.to_vec());
    }

    // Execute request
    let response = match request_builder.send().await {
        Ok(r) => r,
        Err(e) => {
            tracing::error!("Proxy request failed: {}", e);
            return (
                StatusCode::BAD_GATEWAY,
                Json(serde_json::json!({ "error": format!("Proxy request failed: {}", e) })),
            )
                .into_response();
        }
    };

    // Build response
    let status = StatusCode::from_u16(response.status().as_u16())
        .unwrap_or(StatusCode::INTERNAL_SERVER_ERROR);
    
    tracing::info!("Proxy response status: {}", status);

    let mut response_headers = HeaderMap::new();
    
    // Forward relevant headers from upstream
    for (key, value) in response.headers() {
        let key_str = key.as_str().to_lowercase();
        // Skip hop-by-hop headers
        if key_str != "transfer-encoding" 
            && key_str != "connection"
            && key_str != "keep-alive"
            && key_str != "proxy-authenticate"
            && key_str != "proxy-authorization"
            && key_str != "te"
            && key_str != "trailer"
            && key_str != "upgrade"
        {
            if let Ok(header_name) = axum::http::header::HeaderName::from_bytes(key.as_str().as_bytes()) {
                if let Ok(header_value) = HeaderValue::from_bytes(value.as_bytes()) {
                    response_headers.insert(header_name, header_value);
                }
            }
        }
    }

    // Get response body
    let body_bytes = match response.bytes().await {
        Ok(b) => b,
        Err(e) => {
            tracing::error!("Failed to read response body: {}", e);
            return (
                StatusCode::BAD_GATEWAY,
                Json(serde_json::json!({ "error": "Failed to read response body" })),
            )
                .into_response();
        }
    };
    
    // Log error responses for debugging
    if !status.is_success() {
        if let Ok(body_str) = std::str::from_utf8(&body_bytes) {
            let preview = &body_str[..body_str.len().min(1000)];
            tracing::warn!("Proxy error response body: {}", preview);
        }
    }

    (status, response_headers, body_bytes.to_vec()).into_response()
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
