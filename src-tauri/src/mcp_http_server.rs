//! MCP HTTP/SSE Server
//!
//! Implements the Model Context Protocol over HTTP with Server-Sent Events (SSE).
//! This server runs inside the Tauri application and can access real application state.

use axum::{
    extract::{Query, State},
    http::Method,
    response::{sse::{Event, Sse}, IntoResponse},
    routing::{get, post},
    Json, Router,
};
use futures::stream::Stream;
use log::{error, info};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::{
    collections::HashMap,
    convert::Infallible,
    sync::Arc,
    time::Duration,
};
use tauri::Manager;
use tokio::sync::{broadcast, RwLock};
use tower_http::cors::{Any, CorsLayer};

use crate::debug;

/// MCP Server state
#[derive(Clone)]
pub struct MCPServerState {
    /// Tauri app handle for accessing app resources
    app_handle: tauri::AppHandle,
    /// Active SSE connections with their message channels
    connections: Arc<RwLock<HashMap<String, broadcast::Sender<Value>>>>,
    /// Cached frontend logs (updated by frontend)
    frontend_logs: Arc<RwLock<Vec<Value>>>,
    /// Cached DOM tree (updated by frontend)
    dom_tree: Arc<RwLock<Value>>,
}

impl MCPServerState {
    pub fn new(app_handle: tauri::AppHandle) -> Self {
        Self {
            app_handle,
            connections: Arc::new(RwLock::new(HashMap::new())),
            frontend_logs: Arc::new(RwLock::new(Vec::new())),
            dom_tree: Arc::new(RwLock::new(json!({}))),
        }
    }

    /// Update frontend logs cache
    pub async fn update_frontend_logs(&self, logs: Vec<Value>) {
        let mut cached = self.frontend_logs.write().await;
        *cached = logs;
    }

    /// Update DOM tree cache
    pub async fn update_dom_tree(&self, dom: Value) {
        let mut cached = self.dom_tree.write().await;
        *cached = dom;
    }
}

/// MCP Protocol version
const MCP_PROTOCOL_VERSION: &str = "2024-11-05";

/// MCP Server info
const MCP_SERVER_NAME: &str = "rebebuca-debug";
const MCP_SERVER_VERSION: &str = "1.0.0";

/// Tool definitions
fn get_tools() -> Vec<Value> {
    vec![
        json!({
            "name": "get_frontend_logs",
            "description": "Get frontend console logs since app startup. Returns all log entries with timestamps, levels, and messages.",
            "inputSchema": {
                "type": "object",
                "properties": {},
                "required": []
            }
        }),
        json!({
            "name": "get_tauri_logs",
            "description": "Get Tauri backend logs from the current session. Returns log lines from the most recent log file since app startup.",
            "inputSchema": {
                "type": "object",
                "properties": {},
                "required": []
            }
        }),
        json!({
            "name": "get_dom_tree",
            "description": "Get the current DOM tree structure of the application. Returns a hierarchical representation of the DOM.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "maxDepth": {
                        "type": "number",
                        "description": "Maximum depth to traverse the DOM tree (default: 10)"
                    },
                    "maxChildren": {
                        "type": "number",
                        "description": "Maximum children per node to include (default: 50)"
                    }
                },
                "required": []
            }
        }),
        json!({
            "name": "get_all_debug_info",
            "description": "Get all debug information including frontend logs, Tauri logs, and DOM tree in a single call.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "maxDepth": {
                        "type": "number",
                        "description": "Maximum depth for DOM tree traversal (default: 10)"
                    },
                    "maxChildren": {
                        "type": "number",
                        "description": "Maximum children per node in DOM tree (default: 50)"
                    }
                },
                "required": []
            }
        }),
    ]
}

/// JSON-RPC request
#[derive(Debug, Deserialize)]
struct JsonRpcRequest {
    jsonrpc: String,
    id: Option<Value>,
    method: String,
    #[serde(default)]
    params: Value,
}

/// JSON-RPC response
#[derive(Debug, Serialize)]
struct JsonRpcResponse {
    jsonrpc: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    id: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    result: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<JsonRpcError>,
}

#[derive(Debug, Serialize)]
struct JsonRpcError {
    code: i32,
    message: String,
}

impl JsonRpcResponse {
    fn success(id: Option<Value>, result: Value) -> Self {
        Self {
            jsonrpc: "2.0".to_string(),
            id,
            result: Some(result),
            error: None,
        }
    }

    fn error(id: Option<Value>, code: i32, message: String) -> Self {
        Self {
            jsonrpc: "2.0".to_string(),
            id,
            result: None,
            error: Some(JsonRpcError { code, message }),
        }
    }
}

/// Query params for message endpoint
#[derive(Debug, Deserialize)]
struct MessageQuery {
    #[serde(rename = "sessionId")]
    session_id: Option<String>,
}

/// Execute a tool call
async fn execute_tool(state: &MCPServerState, name: &str, args: &Value) -> Result<Value, String> {
    match name {
        "get_frontend_logs" => {
            let logs = state.frontend_logs.read().await;
            Ok(json!({
                "logs": *logs,
                "count": logs.len()
            }))
        }

        "get_tauri_logs" => {
            match debug::get_tauri_logs(state.app_handle.clone()).await {
                Ok(response) => Ok(response.data),
                Err(e) => Err(e),
            }
        }

        "get_dom_tree" => {
            let dom = state.dom_tree.read().await;
            let max_depth = args.get("maxDepth").and_then(|v| v.as_u64()).unwrap_or(10);
            let max_children = args.get("maxChildren").and_then(|v| v.as_u64()).unwrap_or(50);
            Ok(json!({
                "domTree": *dom,
                "maxDepth": max_depth,
                "maxChildren": max_children
            }))
        }

        "get_all_debug_info" => {
            let frontend_logs = state.frontend_logs.read().await.clone();
            let dom_tree = state.dom_tree.read().await.clone();
            
            let tauri_logs = match debug::get_tauri_logs(state.app_handle.clone()).await {
                Ok(response) => response.data,
                Err(e) => json!({ "error": e, "lines": [] }),
            };

            Ok(json!({
                "frontend_logs": frontend_logs,
                "tauri_logs": tauri_logs,
                "dom_tree": dom_tree,
                "timestamp": chrono::Local::now().to_rfc3339()
            }))
        }

        _ => Err(format!("Unknown tool: {}", name)),
    }
}

/// Handle MCP JSON-RPC message
async fn handle_mcp_message(state: &MCPServerState, request: JsonRpcRequest) -> JsonRpcResponse {
    match request.method.as_str() {
        "initialize" => {
            JsonRpcResponse::success(
                request.id,
                json!({
                    "protocolVersion": MCP_PROTOCOL_VERSION,
                    "capabilities": {
                        "tools": {}
                    },
                    "serverInfo": {
                        "name": MCP_SERVER_NAME,
                        "version": MCP_SERVER_VERSION
                    }
                }),
            )
        }

        "initialized" => {
            // Notification, no response needed but we return empty result
            JsonRpcResponse::success(request.id, json!({}))
        }

        "tools/list" => {
            JsonRpcResponse::success(
                request.id,
                json!({
                    "tools": get_tools()
                }),
            )
        }

        "tools/call" => {
            let tool_name = request.params.get("name").and_then(|v| v.as_str());
            let tool_args = request.params.get("arguments").cloned().unwrap_or(json!({}));

            match tool_name {
                Some(name) => {
                    match execute_tool(state, name, &tool_args).await {
                        Ok(result) => JsonRpcResponse::success(
                            request.id,
                            json!({
                                "content": [{
                                    "type": "text",
                                    "text": serde_json::to_string_pretty(&result).unwrap_or_default()
                                }]
                            }),
                        ),
                        Err(e) => JsonRpcResponse::error(request.id, -32603, e),
                    }
                }
                None => JsonRpcResponse::error(
                    request.id,
                    -32602,
                    "Missing tool name".to_string(),
                ),
            }
        }

        "ping" => JsonRpcResponse::success(request.id, json!({})),

        _ => JsonRpcResponse::error(
            request.id,
            -32601,
            format!("Method not found: {}", request.method),
        ),
    }
}

/// SSE endpoint - establishes connection and sends endpoint event
async fn sse_handler(
    State(state): State<MCPServerState>,
) -> Sse<impl Stream<Item = Result<Event, Infallible>>> {
    let connection_id = format!(
        "conn_{}_{}",
        chrono::Utc::now().timestamp_millis(),
        uuid::Uuid::new_v4().to_string().split('-').next().unwrap_or("x")
    );
    
    info!("[MCP] New SSE connection: {}", connection_id);
    
    // Create a broadcast channel for this connection
    let (tx, mut rx) = broadcast::channel::<Value>(100);
    
    // Store the connection
    {
        let mut connections = state.connections.write().await;
        connections.insert(connection_id.clone(), tx);
    }
    
    let conn_id = connection_id.clone();
    let state_clone = state.clone();
    
    // Create the SSE stream
    let stream = async_stream::stream! {
        // First, send the endpoint event as required by MCP SSE transport
        let endpoint_data = format!("/mcp/message?sessionId={}", conn_id);
        yield Ok(Event::default().event("endpoint").data(endpoint_data));
        
        // Then listen for messages to send
        loop {
            match rx.recv().await {
                Ok(msg) => {
                    if let Ok(json_str) = serde_json::to_string(&msg) {
                        // MCP SSE transport: responses are sent as data-only events (no event type)
                        yield Ok(Event::default().data(json_str));
                    }
                }
                Err(broadcast::error::RecvError::Closed) => {
                    break;
                }
                Err(broadcast::error::RecvError::Lagged(_)) => {
                    // Skip lagged messages
                    continue;
                }
            }
        }
        
        // Cleanup on disconnect
        let mut connections = state_clone.connections.write().await;
        connections.remove(&conn_id);
        info!("[MCP] SSE connection closed: {}", conn_id);
    };

    Sse::new(stream).keep_alive(
        axum::response::sse::KeepAlive::new()
            .interval(Duration::from_secs(30))
            .text("ping"),
    )
}

/// Message endpoint - receives JSON-RPC messages and sends responses via SSE
async fn message_handler(
    State(state): State<MCPServerState>,
    Query(query): Query<MessageQuery>,
    Json(request): Json<JsonRpcRequest>,
) -> impl IntoResponse {
    let session_id = query.session_id.unwrap_or_else(|| "default".to_string());
    
    // Handle the message
    let response = handle_mcp_message(&state, request).await;
    
    // Send response via SSE if connection exists
    {
        let connections = state.connections.read().await;
        if let Some(tx) = connections.get(&session_id) {
            let _ = tx.send(serde_json::to_value(&response).unwrap_or(json!({})));
        }
    }
    
    // Return 202 Accepted as per MCP SSE transport spec
    axum::http::StatusCode::ACCEPTED
}

/// Streamable HTTP endpoint - handles JSON-RPC directly without SSE
async fn streamable_http_handler(
    State(state): State<MCPServerState>,
    Json(request): Json<JsonRpcRequest>,
) -> Json<JsonRpcResponse> {
    let response = handle_mcp_message(&state, request).await;
    Json(response)
}

/// Health check endpoint
async fn health_handler() -> Json<Value> {
    Json(json!({
        "status": "ok",
        "server": MCP_SERVER_NAME,
        "version": MCP_SERVER_VERSION,
        "tools": get_tools().len()
    }))
}

/// Update frontend logs (called from Tauri command)
pub async fn update_frontend_logs(state: &MCPServerState, logs: Vec<Value>) {
    state.update_frontend_logs(logs).await;
}

/// Update DOM tree (called from Tauri command)
pub async fn update_dom_tree(state: &MCPServerState, dom: Value) {
    state.update_dom_tree(dom).await;
}

/// Start the MCP HTTP server
pub async fn start_server(app_handle: tauri::AppHandle, port: u16) -> Result<(), String> {
    let state = MCPServerState::new(app_handle.clone());
    
    // Store state in app for later access
    app_handle.manage(state.clone());
    
    // Configure CORS
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods([Method::GET, Method::POST, Method::OPTIONS])
        .allow_headers(Any);
    
    // Build router
    let app = Router::new()
        .route("/mcp/sse", get(sse_handler))
        .route("/mcp/message", post(message_handler))
        .route("/mcp", post(streamable_http_handler))
        .route("/health", get(health_handler))
        .layer(cors)
        .with_state(state);
    
    let addr = format!("127.0.0.1:{}", port);
    let listener = tokio::net::TcpListener::bind(&addr)
        .await
        .map_err(|e| format!("Failed to bind to {}: {}", addr, e))?;
    
    info!("[MCP] HTTP server started on http://{}", addr);
    info!("[MCP] SSE endpoint: http://{}/mcp/sse", addr);
    info!("[MCP] Streamable HTTP endpoint: http://{}/mcp", addr);
    info!("[MCP] Message endpoint: http://{}/mcp/message", addr);
    info!("[MCP] Health check: http://{}/health", addr);
    
    // Run server in background
    tokio::spawn(async move {
        if let Err(e) = axum::serve(listener, app).await {
            error!("[MCP] HTTP server error: {}", e);
        }
    });
    
    Ok(())
}
