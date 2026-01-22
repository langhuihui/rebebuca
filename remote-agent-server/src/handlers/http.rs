//! HTTP handlers for static files and authentication

use axum::{
    body::Body,
    extract::{Path, Query, State},
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
        .route("/api/ai-collab/conversation", get(get_conversation_handler))
        .route("/api/ai-collab/conversation/{sessionId}", get(get_conversation_by_id_handler))
        // Task management API
        .route("/api/tasks", get(get_tasks_handler).post(save_tasks_handler))
        .route("/api/tasks/{taskId}", get(get_task_handler))
        .route("/api/tasks/{taskId}/run", post(run_task_handler))
        .route("/api/tasks/{taskId}/history", get(get_task_history_handler))
        // Storage API (for debugging)
        .route("/api/storage/get", get(storage_get_handler))
        .route("/api/storage/set", post(storage_set_handler))
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

/// Query parameters for conversation
#[derive(Debug, Deserialize)]
pub struct ConversationQuery {
    pub session_id: Option<String>,
}

/// Get AI collab conversation(s)
pub async fn get_conversation_handler(
    State(state): State<AppState>,
    Query(query): Query<ConversationQuery>,
) -> Json<serde_json::Value> {
    // If session_id provided, return specific conversation
    if let Some(session_id) = query.session_id {
        let key = format!("dualAgentConversation:{}", session_id);
        match state.storage_adapter.get("default", &key).await {
            Some(value) => {
                Json(serde_json::json!({
                    "sessionId": session_id,
                    "conversation": value,
                }))
            }
            None => {
                Json(serde_json::json!({
                    "sessionId": session_id,
                    "conversation": [],
                    "error": "Conversation not found",
                }))
            }
        }
    } else {
        // Return empty list - conversations are stored individually per session
        Json(serde_json::json!({
            "conversations": [],
            "note": "Provide session_id query parameter to get specific conversation",
        }))
    }
}

/// Get AI collab conversation by session ID (path parameter)
pub async fn get_conversation_by_id_handler(
    State(state): State<AppState>,
    Path(session_id): Path<String>,
) -> Json<serde_json::Value> {
    let key = format!("dualAgentConversation:{}", session_id);
    match state.storage_adapter.get("default", &key).await {
        Some(value) => {
            Json(serde_json::json!({
                "sessionId": session_id,
                "conversation": value,
            }))
        }
        None => {
            Json(serde_json::json!({
                "sessionId": session_id,
                "conversation": [],
                "error": "Conversation not found",
            }))
        }
    }
}

/// Get all tasks
pub async fn get_tasks_handler(
    State(state): State<AppState>,
) -> Json<serde_json::Value> {
    match state.storage_adapter.get("default", "serverTasks").await {
        Some(tasks) => {
            Json(serde_json::json!({
                "tasks": tasks,
            }))
        }
        None => {
            Json(serde_json::json!({
                "tasks": [],
            }))
        }
    }
}

/// Save all tasks
pub async fn save_tasks_handler(
    State(state): State<AppState>,
    Json(tasks): Json<serde_json::Value>,
) -> Json<serde_json::Value> {
    match state.storage_adapter.set("default", "serverTasks", tasks).await {
        Ok(_) => {
            Json(serde_json::json!({
                "success": true,
                "message": "Tasks saved successfully",
            }))
        }
        Err(e) => {
            Json(serde_json::json!({
                "success": false,
                "error": format!("Failed to save tasks: {}", e),
            }))
        }
    }
}

/// Get a specific task by ID
pub async fn get_task_handler(
    State(state): State<AppState>,
    Path(task_id): Path<String>,
) -> Json<serde_json::Value> {
    match state.storage_adapter.get("default", "serverTasks").await {
        Some(tasks) => {
            if let Some(tasks_array) = tasks.as_array() {
                if let Some(task) = tasks_array.iter().find(|t| {
                    t.get("id").and_then(|id| id.as_str()) == Some(&task_id)
                }) {
                    return Json(serde_json::json!({
                        "task": task,
                    }));
                }
            }
            Json(serde_json::json!({
                "error": "Task not found",
                "taskId": task_id,
            }))
        }
        None => {
            Json(serde_json::json!({
                "error": "No tasks found",
                "taskId": task_id,
            }))
        }
    }
}

/// Run a task by ID - creates a new session for AI collab tasks
pub async fn run_task_handler(
    State(state): State<AppState>,
    Path(task_id): Path<String>,
) -> Json<serde_json::Value> {
    // Get task from storage
    let task_opt = match state.storage_adapter.get("default", "serverTasks").await {
        Some(tasks) => {
            if let Some(tasks_array) = tasks.as_array() {
                tasks_array.iter().find(|t| {
                    t.get("id").and_then(|id| id.as_str()) == Some(&task_id)
                }).cloned()
            } else {
                None
            }
        }
        None => None,
    };
    
    let task = match task_opt {
        Some(t) => t,
        None => {
            return Json(serde_json::json!({
                "success": false,
                "error": "Task not found",
                "taskId": task_id,
            }));
        }
    };
    
    // Create a new session ID for this run
    let run_id = format!("run-{}", chrono::Utc::now().timestamp_millis());
    
    // Store the run info
    let run_info = serde_json::json!({
        "runId": run_id,
        "taskId": task_id,
        "task": task,
        "startedAt": chrono::Utc::now().to_rfc3339(),
        "status": "running",
    });
    
    // Save run info
    let runs_key = format!("taskRuns:{}", task_id);
    let runs: Vec<serde_json::Value> = match state.storage_adapter.get("default", &runs_key).await {
        Some(r) => r.as_array().cloned().unwrap_or_default(),
        None => Vec::new(),
    };
    
    let mut new_runs = runs;
    new_runs.push(run_info.clone());
    
    // Keep only last 10 runs
    if new_runs.len() > 10 {
        new_runs = new_runs[new_runs.len()-10..].to_vec();
    }
    
    if let Err(e) = state.storage_adapter.set("default", &runs_key, serde_json::Value::Array(new_runs)).await {
        return Json(serde_json::json!({
            "success": false,
            "error": format!("Failed to save run info: {}", e),
        }));
    }
    
    Json(serde_json::json!({
        "success": true,
        "runId": run_id,
        "task": task,
        "message": "Task run initiated",
    }))
}

/// Get run history for a task
pub async fn get_task_history_handler(
    State(state): State<AppState>,
    Path(task_id): Path<String>,
) -> Json<serde_json::Value> {
    let runs_key = format!("taskRuns:{}", task_id);
    match state.storage_adapter.get("default", &runs_key).await {
        Some(runs) => {
            Json(serde_json::json!({
                "taskId": task_id,
                "runs": runs,
            }))
        }
        None => {
            Json(serde_json::json!({
                "taskId": task_id,
                "runs": [],
            }))
        }
    }
}

/// Proxy handler - forwards requests to external URLs to avoid CORS issues
pub async fn proxy_handler(
    method: Method,
    headers: HeaderMap,
    Query(query): Query<ProxyQuery>,
    body: Body,
) -> Response {
    tracing::debug!("Proxy handler called - method: {}, url: {}", method, query.url);

    // Handle OPTIONS preflight requests
    if method == Method::OPTIONS {
        tracing::debug!("Handling OPTIONS preflight request for: {}", query.url);
        return (
            StatusCode::NO_CONTENT,
            [
                ("Access-Control-Allow-Origin", "*"),
                ("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, PATCH, OPTIONS"),
                ("Access-Control-Allow-Headers", "*"),
                ("Access-Control-Max-Age", "86400"),
            ],
        )
            .into_response();
    }

    let client = match reqwest::Client::builder()
        .danger_accept_invalid_certs(false)
        .build()
    {
        Ok(c) => c,
        Err(e) => {
            tracing::error!("Failed to create HTTP client: {}", e);
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                [(header::CONTENT_TYPE, "application/json")],
                Json(serde_json::json!({ "error": "Failed to create HTTP client" })),
            )
                .into_response();
        }
    };

    tracing::info!("Proxying {} request to: {}", method, query.url);

    // Build the request first
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
                [(header::CONTENT_TYPE, "application/json")],
                Json(serde_json::json!({ "error": "Method not allowed" })),
            )
                .into_response();
        }
    };

    // Forward all headers from the original request except hop-by-hop headers
    for (key, value) in headers.iter() {
        if let Ok(v) = value.to_str() {
            let key_lower = key.as_str().to_lowercase();

            // Skip hop-by-hop headers and proxy-specific headers
            if key_lower == "host"
                || key_lower == "x-proxy-headers"
                || key_lower == "connection"
                || key_lower == "keep-alive"
                || key_lower == "proxy-authenticate"
                || key_lower == "proxy-authorization"
                || key_lower == "te"
                || key_lower == "trailer"
                || key_lower == "transfer-encoding"
                || key_lower == "upgrade"
            {
                continue;
            }

            // Don't log authorization header value for security
            if key_lower == "authorization" {
                tracing::debug!("Forwarding header: {} = [REDACTED]", key);
            } else {
                tracing::debug!("Forwarding header: {} = {}", key, v);
            }

            // Forward the header directly (it's already a valid HeaderName)
            if let Ok(header_value) = HeaderValue::from_str(v) {
                request_builder = request_builder.header(key.clone(), header_value);
            }
        }
    }

    // Convert body to bytes
    let body_bytes = match axum::body::to_bytes(body, usize::MAX).await {
        Ok(b) => b,
        Err(e) => {
            tracing::error!("Failed to read request body: {}", e);
            return (
                StatusCode::BAD_REQUEST,
                [(header::CONTENT_TYPE, "application/json")],
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

    // Execute request with streaming
    let response = match request_builder.send().await {
        Ok(r) => r,
        Err(e) => {
            tracing::error!("Proxy request failed: {}", e);
            return (
                StatusCode::BAD_GATEWAY,
                [(header::CONTENT_TYPE, "application/json")],
                Json(serde_json::json!({ "error": format!("Proxy request failed: {}", e) })),
            )
                .into_response();
        }
    };

    let status = StatusCode::from_u16(response.status().as_u16())
        .unwrap_or(StatusCode::INTERNAL_SERVER_ERROR);

    tracing::info!("Proxy response status: {}", status);

    let mut response_builder = axum::http::Response::builder().status(status);

    // Add CORS headers for proxy responses
    response_builder = response_builder
        .header("Access-Control-Allow-Origin", "*")
        .header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, PATCH, OPTIONS")
        .header("Access-Control-Allow-Headers", "*")
        .header("Access-Control-Max-Age", "86400");

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
                    response_builder = response_builder.header(header_name, header_value);
                }
            }
        }
    }

    // Create a streaming body from the response
    let stream = response.bytes_stream();
    let body = axum::body::Body::from_stream(stream);

    tracing::debug!("Proxy response ready, streaming body");

    response_builder.body(body).unwrap().into_response()
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

/// Storage query params
#[derive(Debug, Deserialize)]
pub struct StorageGetQuery {
    pub key: String,
}

/// Storage set params
#[derive(Debug, Deserialize, Serialize)]
pub struct StorageSetParams {
    pub key: String,
    pub value: serde_json::Value,
}

/// Get storage value (for debugging)
pub async fn storage_get_handler(
    State(state): State<AppState>,
    Query(query): Query<StorageGetQuery>,
) -> Json<serde_json::Value> {
    match state.storage_adapter.get("default", &query.key).await {
        Some(value) => {
            Json(serde_json::json!({
                "key": query.key,
                "value": value,
            }))
        }
        None => {
            Json(serde_json::json!({
                "key": query.key,
                "value": null,
                "error": "Key not found",
            }))
        }
    }
}

/// Set storage value (for debugging)
pub async fn storage_set_handler(
    State(state): State<AppState>,
    Json(params): Json<StorageSetParams>,
) -> Json<serde_json::Value> {
    match state.storage_adapter.set("default", &params.key, params.value).await {
        Ok(_) => {
            Json(serde_json::json!({
                "key": params.key,
                "success": true,
            }))
        }
        Err(e) => {
            Json(serde_json::json!({
                "key": params.key,
                "success": false,
                "error": e,
            }))
        }
    }
}
