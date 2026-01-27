//! MCP HTTP/SSE Server
//!
//! Implements the Model Context Protocol over HTTP with Server-Sent Events (SSE).
//! This server runs inside the Tauri application and can access real application state.

use axum::{
    extract::{Path, Query, State},
    http::Method,
    response::{sse::{Event, Sse}, IntoResponse},
    routing::{get, post},
    Json, Router,
};
use futures::stream::Stream;
use log::{error, info, warn};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::{
    collections::HashMap,
    convert::Infallible,
    sync::Arc,
    time::Duration,
};
use tauri::{Manager, Emitter};
use tokio::sync::{broadcast, RwLock};
use tower_http::cors::{Any, CorsLayer};

use crate::debug;
use crate::terminal_task_manager::TerminalTaskManager;
use crate::terminal_task_types::{CreateTaskRequest, TaskEvent};

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
    /// Resource subscriptions: maps session_id -> set of subscribed URIs
    resource_subscriptions: Arc<RwLock<HashMap<String, Vec<String>>>>,
    /// Cached task list (updated by frontend)
    task_list: Arc<RwLock<Vec<Value>>>,
    /// Server port
    port: u16,
    /// Terminal task manager
    task_manager: Option<Arc<TerminalTaskManager>>,
}

impl MCPServerState {
    pub fn new(app_handle: tauri::AppHandle, port: u16) -> Self {
        Self {
            app_handle,
            connections: Arc::new(RwLock::new(HashMap::new())),
            frontend_logs: Arc::new(RwLock::new(Vec::new())),
            dom_tree: Arc::new(RwLock::new(json!({}))),
            resource_subscriptions: Arc::new(RwLock::new(HashMap::new())),
            task_list: Arc::new(RwLock::new(Vec::new())),
            port,
            task_manager: None,
        }
    }

    /// Set the terminal task manager
    pub fn set_task_manager(&mut self, task_manager: Arc<TerminalTaskManager>) {
        self.task_manager = Some(task_manager);
    }

    /// Get the server port
    pub fn get_port(&self) -> u16 {
        self.port
    }

    /// Update frontend logs cache and notify subscribers
    pub async fn update_frontend_logs(&self, logs: Vec<Value>) {
        {
            let mut cached = self.frontend_logs.write().await;
            *cached = logs;
        }
        // Notify subscribers about the resource update
        self.notify_resource_updated("log://rebebuca/frontend").await;
    }

    /// Update DOM tree cache and notify subscribers
    pub async fn update_dom_tree(&self, dom: Value) {
        {
            let mut cached = self.dom_tree.write().await;
            *cached = dom;
        }
        // Notify subscribers about the resource update
        self.notify_resource_updated("debug://rebebuca/dom").await;
    }

    /// Notify all subscribers of a resource update
    async fn notify_resource_updated(&self, uri: &str) {
        let subscriptions = self.resource_subscriptions.read().await;
        let connections = self.connections.read().await;
        
        for (session_id, uris) in subscriptions.iter() {
            if uris.contains(&uri.to_string()) {
                if let Some(tx) = connections.get(session_id) {
                    let notification = json!({
                        "jsonrpc": "2.0",
                        "method": "notifications/resources/updated",
                        "params": {
                            "uri": uri
                        }
                    });
                    let _ = tx.send(notification);
                }
            }
        }
    }

    /// Subscribe a session to a resource
    async fn subscribe_resource(&self, session_id: &str, uri: &str) {
        let mut subscriptions = self.resource_subscriptions.write().await;
        let entry = subscriptions.entry(session_id.to_string()).or_insert_with(Vec::new);
        if !entry.contains(&uri.to_string()) {
            entry.push(uri.to_string());
        }
    }

    /// Unsubscribe a session from a resource
    async fn unsubscribe_resource(&self, session_id: &str, uri: &str) {
        let mut subscriptions = self.resource_subscriptions.write().await;
        if let Some(uris) = subscriptions.get_mut(session_id) {
            uris.retain(|u| u != uri);
        }
    }

    /// Update task list cache
    pub async fn update_task_list(&self, tasks: Vec<Value>) {
        let mut cached = self.task_list.write().await;
        *cached = tasks;
    }
}

/// MCP Protocol version
const MCP_PROTOCOL_VERSION: &str = "2024-11-05";

/// MCP Server info
const MCP_SERVER_NAME: &str = "rebebuca-debug";
const MCP_SERVER_VERSION: &str = "1.0.0";

/// Debug tool definitions
fn get_debug_tools() -> Vec<Value> {
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
            "name": "list_tasks",
            "description": "Get the list of all available tasks in the application. Returns task information including id, name, command, cwd, and source.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "source": {
                        "type": "string",
                        "description": "Filter tasks by source (e.g., 'vscode', 'npm', 'user', 'script'). If not provided, returns all tasks."
                    }
                },
                "required": []
            }
        }),
        json!({
            "name": "execute_task",
            "description": "Execute a task by its ID. The task will be started in a new terminal tab.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "taskId": {
                        "type": "string",
                        "description": "The unique identifier of the task to execute"
                    },
                    "cwd": {
                        "type": "string",
                        "description": "Override working directory for the task execution"
                    }
                },
                "required": ["taskId"]
            }
        }),
    ]
}

/// AI tool definitions
fn get_ai_tools() -> Vec<Value> {
    vec![
        json!({
            "name": "execute_command_with_stream",
            "description": "Execute a command and stream the output via SSE. Returns task information including outputUri for SSE subscription.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "command": {
                        "type": "string",
                        "description": "Command to execute"
                    },
                    "cwd": {
                        "type": "string",
                        "description": "Working directory for command execution (optional, defaults to project root)"
                    },
                    "shell": {
                        "type": "string",
                        "description": "Shell type to use (optional, defaults to system shell)"
                    },
                    "env": {
                        "type": "object",
                        "description": "Environment variables as key-value pairs (optional)"
                    },
                    "timeout": {
                        "type": "number",
                        "description": "Timeout in seconds (optional, 0 means no limit)"
                    }
                },
                "required": ["command"]
            }
        }),
        json!({
            "name": "list_agent_tasks",
            "description": "List all agent tasks managed by the task manager. Returns task information including status, command, and timestamps.",
            "inputSchema": {
                "type": "object",
                "properties": {},
                "required": []
            }
        }),
        json!({
            "name": "stop_agent_task",
            "description": "Stop a running agent task. Returns updated task information.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "taskId": {
                        "type": "string",
                        "description": "Task ID to stop"
                    },
                    "signal": {
                        "type": "string",
                        "description": "Signal type: SIGTERM or SIGKILL (optional, defaults to SIGTERM)"
                    }
                },
                "required": ["taskId"]
            }
        }),
        json!({
            "name": "get_agent_task_status",
            "description": "Get the status of a specific agent task including output buffer size.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "taskId": {
                        "type": "string",
                        "description": "Task ID to query"
                    }
                },
                "required": ["taskId"]
            }
        }),
    ]
}

/// Debug resource definitions
fn get_debug_resources() -> Vec<Value> {
    vec![
        json!({
            "uri": "log://rebebuca/frontend",
            "name": "Frontend Console Logs",
            "description": "Real-time frontend console logs including info, warn, error, and debug messages since app startup",
            "mimeType": "application/json"
        }),
        json!({
            "uri": "log://rebebuca/tauri",
            "name": "Tauri Backend Logs",
            "description": "Tauri/Rust backend logs from the current session log file",
            "mimeType": "application/json"
        }),
        json!({
            "uri": "debug://rebebuca/dom",
            "name": "DOM Tree",
            "description": "Current DOM tree structure of the application UI",
            "mimeType": "application/json"
        }),
    ]
}

/// AI resource definitions
fn get_ai_resources() -> Vec<Value> {
    vec![]
}

/// Read a resource by URI
async fn read_resource(state: &MCPServerState, uri: &str) -> Result<Value, String> {
    match uri {
        "log://rebebuca/frontend" => {
            let logs = state.frontend_logs.read().await;
            Ok(json!({
                "contents": [{
                    "uri": uri,
                    "mimeType": "application/json",
                    "text": serde_json::to_string_pretty(&*logs).unwrap_or_else(|_| "[]".to_string())
                }]
            }))
        }
        "log://rebebuca/tauri" => {
            match debug::get_tauri_logs(state.app_handle.clone()).await {
                Ok(response) => Ok(json!({
                    "contents": [{
                        "uri": uri,
                        "mimeType": "application/json",
                        "text": serde_json::to_string_pretty(&response.data).unwrap_or_else(|_| "{}".to_string())
                    }]
                })),
                Err(e) => Err(e),
            }
        }
        "debug://rebebuca/dom" => {
            let dom = state.dom_tree.read().await;
            Ok(json!({
                "contents": [{
                    "uri": uri,
                    "mimeType": "application/json",
                    "text": serde_json::to_string_pretty(&*dom).unwrap_or_else(|_| "{}".to_string())
                }]
            }))
        }
        _ => Err(format!("Resource not found: {}", uri)),
    }
}

/// JSON-RPC request
#[derive(Debug, Deserialize)]
struct JsonRpcRequest {
    #[allow(dead_code)]
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

/// Execute a debug tool call
async fn execute_debug_tool(state: &MCPServerState, name: &str, args: &Value) -> Result<Value, String> {
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

        "list_tasks" => {
            let tasks = state.task_list.read().await.clone();
            let source_filter = args.get("source").and_then(|v| v.as_str());

            let filtered_tasks: Vec<Value> = if let Some(source) = source_filter {
                tasks.into_iter()
                    .filter(|t| t.get("source").and_then(|s| s.as_str()) == Some(source))
                    .collect()
            } else {
                tasks
            };

            Ok(json!({
                "tasks": filtered_tasks,
                "count": filtered_tasks.len()
            }))
        }

        "execute_task" => {
            let task_id = args.get("taskId").and_then(|v| v.as_str());
            let cwd_override = args.get("cwd").and_then(|v| v.as_str()).map(|s| s.to_string());

            match task_id {
                Some(id) => {
                    // Emit an event to the frontend to execute the task
                    let payload = json!({
                        "taskId": id,
                        "cwd": cwd_override
                    });

                    if let Err(e) = state.app_handle.emit("mcp-execute-task", payload.clone()) {
                        error!("[MCP] Failed to emit execute-task event: {}", e);
                        Err(format!("Failed to trigger task execution: {}", e))
                    } else {
                        info!("[MCP] Task execution triggered: {}", id);
                        Ok(json!({
                            "success": true,
                            "message": format!("Task execution triggered: {}", id),
                            "taskId": id
                        }))
                    }
                }
                None => Err("Missing taskId parameter".to_string()),
            }
        }

        _ => Err(format!("Unknown debug tool: {}", name)),
    }
}

/// Execute an AI tool call
async fn execute_ai_tool(state: &MCPServerState, name: &str, args: &Value) -> Result<Value, String> {
    match name {
        "execute_command_with_stream" => {
            if let Some(task_manager) = &state.task_manager {
                let command = args.get("command").and_then(|v| v.as_str());
                let cwd = args.get("cwd").and_then(|v| v.as_str()).map(|s| s.to_string());
                let shell = args.get("shell").and_then(|v| v.as_str()).map(|s| s.to_string());
                let timeout = args.get("timeout").and_then(|v| v.as_u64());
                let env_map = args.get("env").and_then(|v| v.as_object());

                match command {
                    Some(cmd) => {
                        let request = CreateTaskRequest {
                            command: cmd.to_string(),
                            cwd,
                            shell,
                            env: env_map.and_then(|obj| {
                                let mut map = std::collections::HashMap::new();
                                for (k, v) in obj {
                                    if let Some(s) = v.as_str() {
                                        map.insert(k.clone(), s.to_string());
                                    }
                                }
                                if map.is_empty() { None } else { Some(map) }
                            }),
                            timeout,
                        };

                        match task_manager.create_task(request).await {
                            Ok(task_info) => {
                                info!("[MCP] Command executed: {}", task_info.task_id);
                                Ok(json!({
                                    "taskId": task_info.task_id,
                                    "command": task_info.command,
                                    "status": task_info.status,
                                    "outputUri": task_info.output_uri,
                                    "startedAt": task_info.started_at,
                                    "cwd": task_info.cwd
                                }))
                            }
                            Err(e) => Err(e.to_string()),
                        }
                    }
                    None => Err("Missing command parameter".to_string()),
                }
            } else {
                Err("Terminal task manager not initialized".to_string())
            }
        }

        "list_agent_tasks" => {
            if let Some(task_manager) = &state.task_manager {
                let tasks = task_manager.list_tasks().await;
                Ok(json!({
                    "tasks": tasks,
                    "count": tasks.len()
                }))
            } else {
                Err("Terminal task manager not initialized".to_string())
            }
        }

        "stop_agent_task" => {
            if let Some(task_manager) = &state.task_manager {
                let task_id = args.get("taskId").and_then(|v| v.as_str());
                let signal = args.get("signal").and_then(|v| v.as_str());

                match task_id {
                    Some(id) => {
                        match task_manager.stop_task(id, signal).await {
                            Ok(task_info) => {
                                info!("[MCP] Task stopped: {}", id);
                                Ok(json!({
                                    "taskId": task_info.task_id,
                                    "status": task_info.status,
                                    "stoppedAt": task_info.stopped_at
                                }))
                            }
                            Err(e) => Err(e.to_string()),
                        }
                    }
                    None => Err("Missing taskId parameter".to_string()),
                }
            } else {
                Err("Terminal task manager not initialized".to_string())
            }
        }

        "get_agent_task_status" => {
            if let Some(task_manager) = &state.task_manager {
                let task_id = args.get("taskId").and_then(|v| v.as_str());

                match task_id {
                    Some(id) => {
                        if let Some(task_info) = task_manager.get_task(id).await {
                            let output_size = task_manager.get_output_size(id).await.unwrap_or(0);
                            Ok(json!({
                                "taskId": task_info.task_id,
                                "status": task_info.status,
                                "command": task_info.command,
                                "cwd": task_info.cwd,
                                "startedAt": task_info.started_at,
                                "stoppedAt": task_info.stopped_at,
                                "exitCode": task_info.exit_code,
                                "outputSize": output_size,
                                "pid": task_info.pid
                            }))
                        } else {
                            Err(format!("Task not found: {}", id))
                        }
                    }
                    None => Err("Missing taskId parameter".to_string()),
                }
            } else {
                Err("Terminal task manager not initialized".to_string())
            }
        }

        _ => Err(format!("Unknown AI tool: {}", name)),
    }
}

/// Handle debug MCP JSON-RPC message
async fn handle_debug_mcp_message(state: &MCPServerState, request: JsonRpcRequest, session_id: Option<&str>) -> JsonRpcResponse {
    match request.method.as_str() {
        "initialize" => {
            JsonRpcResponse::success(
                request.id,
                json!({
                    "protocolVersion": MCP_PROTOCOL_VERSION,
                    "capabilities": {
                        "tools": {},
                        "resources": {
                            "subscribe": true,
                            "listChanged": true
                        }
                    },
                    "serverInfo": {
                        "name": format!("{}-debug", MCP_SERVER_NAME),
                        "version": MCP_SERVER_VERSION
                    }
                }),
            )
        }

        "initialized" | "notifications/initialized" => {
            if request.id.is_some() {
                JsonRpcResponse::success(request.id, json!({}))
            } else {
                JsonRpcResponse {
                    jsonrpc: "2.0".to_string(),
                    id: None,
                    result: None,
                    error: None,
                }
            }
        }

        "tools/list" => {
            JsonRpcResponse::success(
                request.id,
                json!({
                    "tools": get_debug_tools()
                }),
            )
        }

        "tools/call" => {
            let tool_name = request.params.get("name").and_then(|v| v.as_str());
            let tool_args = request.params.get("arguments").cloned().unwrap_or(json!({}));

            match tool_name {
                Some(name) => {
                    match execute_debug_tool(state, name, &tool_args).await {
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

        "resources/list" => {
            JsonRpcResponse::success(
                request.id,
                json!({
                    "resources": get_debug_resources()
                }),
            )
        }

        "resources/read" => {
            let uri = request.params.get("uri").and_then(|v| v.as_str());

            match uri {
                Some(uri) => {
                    // Only allow debug resources
                    if uri.starts_with("log://") || uri == "debug://rebebuca/dom" {
                        match read_resource(state, uri).await {
                            Ok(result) => JsonRpcResponse::success(request.id, result),
                            Err(e) => JsonRpcResponse::error(request.id, -32002, e),
                        }
                    } else {
                        JsonRpcResponse::error(request.id, -32002, format!("Debug endpoint does not serve resource: {}", uri))
                    }
                }
                None => JsonRpcResponse::error(
                    request.id,
                    -32602,
                    "Missing resource URI".to_string(),
                ),
            }
        }

        "resources/subscribe" => {
            let uri = request.params.get("uri").and_then(|v| v.as_str());

            match (uri, session_id) {
                (Some(uri), Some(session_id)) => {
                    // Only allow debug resources
                    if uri.starts_with("log://") || uri == "debug://rebebuca/dom" {
                        let resources = get_debug_resources();
                        let exists = resources.iter().any(|r| {
                            r.get("uri").and_then(|u| u.as_str()) == Some(uri)
                        });

                        if exists {
                            state.subscribe_resource(session_id, uri).await;
                            info!("[MCP Debug] Session {} subscribed to resource {}", session_id, uri);
                            JsonRpcResponse::success(request.id, json!({}))
                        } else {
                            JsonRpcResponse::error(
                                request.id,
                                -32002,
                                format!("Resource not found: {}", uri),
                            )
                        }
                    } else {
                        JsonRpcResponse::error(request.id, -32002, format!("Debug endpoint does not serve resource: {}", uri))
                    }
                }
                (None, _) => JsonRpcResponse::error(
                    request.id,
                    -32602,
                    "Missing resource URI".to_string(),
                ),
                (_, None) => JsonRpcResponse::error(
                    request.id,
                    -32602,
                    "Missing session ID for subscription".to_string(),
                ),
            }
        }

        "resources/unsubscribe" => {
            let uri = request.params.get("uri").and_then(|v| v.as_str());

            match (uri, session_id) {
                (Some(uri), Some(session_id)) => {
                    state.unsubscribe_resource(session_id, uri).await;
                    info!("[MCP Debug] Session {} unsubscribed from resource {}", session_id, uri);
                    JsonRpcResponse::success(request.id, json!({}))
                }
                (None, _) => JsonRpcResponse::error(
                    request.id,
                    -32602,
                    "Missing resource URI".to_string(),
                ),
                (_, None) => JsonRpcResponse::error(
                    request.id,
                    -32602,
                    "Missing session ID for unsubscription".to_string(),
                ),
            }
        }

        "ping" => JsonRpcResponse::success(request.id, json!({})),

        // Cursor MCP client extensions
        "GetInstructions" => {
            JsonRpcResponse::success(
                request.id,
                json!({
                    "instructions": format!(
                        "Rebebuca Debug MCP Server\n\
                        Version: {}\n\
                        \n\
                        This server provides debug tools for the Rebebuca application:\n\
                        - get_frontend_logs: Get frontend console logs\n\
                        - get_tauri_logs: Get Tauri backend logs\n\
                        - get_dom_tree: Get current DOM tree structure\n\
                        - list_tasks: List all available tasks\n\
                        - execute_task: Execute a task by ID\n\
                        \n\
                        Available resources:\n\
                        - log://rebebuca/frontend: Frontend logs\n\
                        - log://rebebuca/tauri: Tauri logs\n\
                        - debug://rebebuca/dom: DOM tree\n\
                        \n\
                        Endpoints:\n\
                        - SSE: /mcp/debug/sse\n\
                        - Streamable HTTP: /mcp/debug\n\
                        - Message: /mcp/debug/message",
                        MCP_SERVER_VERSION
                    )
                }),
            )
        }

        "ListOfferings" => {
            JsonRpcResponse::success(
                request.id,
                json!({
                    "offerings": [
                        {
                            "name": "rebebuca-debug",
                            "description": "Rebebuca Debug MCP Server",
                            "endpoints": {
                                "sse": format!("http://127.0.0.1:{}/mcp/debug/sse", state.get_port()),
                                "streamableHttp": format!("http://127.0.0.1:{}/mcp/debug", state.get_port()),
                                "message": format!("http://127.0.0.1:{}/mcp/debug/message", state.get_port())
                            },
                            "tools": get_debug_tools().len(),
                            "resources": get_debug_resources().len()
                        }
                    ]
                }),
            )
        }

        _ => JsonRpcResponse::error(
            request.id,
            -32601,
            format!("Method not found: {}", request.method),
        ),
    }
}

/// Handle AI MCP JSON-RPC message
async fn handle_ai_mcp_message(state: &MCPServerState, request: JsonRpcRequest, session_id: Option<&str>) -> JsonRpcResponse {
    match request.method.as_str() {
        "initialize" => {
            JsonRpcResponse::success(
                request.id,
                json!({
                    "protocolVersion": MCP_PROTOCOL_VERSION,
                    "capabilities": {
                        "tools": {},
                        "resources": {
                            "subscribe": true,
                            "listChanged": true
                        }
                    },
                    "serverInfo": {
                        "name": format!("{}-ai", MCP_SERVER_NAME),
                        "version": MCP_SERVER_VERSION
                    }
                }),
            )
        }

        "initialized" | "notifications/initialized" => {
            if request.id.is_some() {
                JsonRpcResponse::success(request.id, json!({}))
            } else {
                JsonRpcResponse {
                    jsonrpc: "2.0".to_string(),
                    id: None,
                    result: None,
                    error: None,
                }
            }
        }

        "tools/list" => {
            JsonRpcResponse::success(
                request.id,
                json!({
                    "tools": get_ai_tools()
                }),
            )
        }

        "tools/call" => {
            let tool_name = request.params.get("name").and_then(|v| v.as_str());
            let tool_args = request.params.get("arguments").cloned().unwrap_or(json!({}));

            match tool_name {
                Some(name) => {
                    match execute_ai_tool(state, name, &tool_args).await {
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

        "resources/list" => {
            JsonRpcResponse::success(
                request.id,
                json!({
                    "resources": get_ai_resources()
                }),
            )
        }

        "resources/read" => {
            let uri = request.params.get("uri").and_then(|v| v.as_str());

            match uri {
                Some(uri) => {
                    // Only allow AI resources
                    if uri.starts_with("agent://") {
                        match read_resource(state, uri).await {
                            Ok(result) => JsonRpcResponse::success(request.id, result),
                            Err(e) => JsonRpcResponse::error(request.id, -32002, e),
                        }
                    } else {
                        JsonRpcResponse::error(request.id, -32002, format!("AI endpoint does not serve resource: {}", uri))
                    }
                }
                None => JsonRpcResponse::error(
                    request.id,
                    -32602,
                    "Missing resource URI".to_string(),
                ),
            }
        }

        "resources/subscribe" => {
            let uri = request.params.get("uri").and_then(|v| v.as_str());

            match (uri, session_id) {
                (Some(uri), Some(session_id)) => {
                    // Only allow AI resources
                    if uri.starts_with("agent://") {
                        let resources = get_ai_resources();
                        let exists = resources.iter().any(|r| {
                            r.get("uri").and_then(|u| u.as_str()) == Some(uri)
                        });

                        if exists {
                            state.subscribe_resource(session_id, uri).await;
                            info!("[MCP AI] Session {} subscribed to resource {}", session_id, uri);
                            JsonRpcResponse::success(request.id, json!({}))
                        } else {
                            JsonRpcResponse::error(
                                request.id,
                                -32002,
                                format!("Resource not found: {}", uri),
                            )
                        }
                    } else {
                        JsonRpcResponse::error(request.id, -32002, format!("AI endpoint does not serve resource: {}", uri))
                    }
                }
                (None, _) => JsonRpcResponse::error(
                    request.id,
                    -32602,
                    "Missing resource URI".to_string(),
                ),
                (_, None) => JsonRpcResponse::error(
                    request.id,
                    -32602,
                    "Missing session ID for subscription".to_string(),
                ),
            }
        }

        "resources/unsubscribe" => {
            let uri = request.params.get("uri").and_then(|v| v.as_str());

            match (uri, session_id) {
                (Some(uri), Some(session_id)) => {
                    state.unsubscribe_resource(session_id, uri).await;
                    info!("[MCP AI] Session {} unsubscribed from resource {}", session_id, uri);
                    JsonRpcResponse::success(request.id, json!({}))
                }
                (None, _) => JsonRpcResponse::error(
                    request.id,
                    -32602,
                    "Missing resource URI".to_string(),
                ),
                (_, None) => JsonRpcResponse::error(
                    request.id,
                    -32602,
                    "Missing session ID for unsubscription".to_string(),
                ),
            }
        }

        "ping" => JsonRpcResponse::success(request.id, json!({})),

        // Cursor MCP client extensions
        "GetInstructions" => {
            JsonRpcResponse::success(
                request.id,
                json!({
                    "instructions": format!(
                        "Rebebuca AI MCP Server\n\
                        Version: {}\n\
                        \n\
                        This server provides AI tools for the Rebebuca application:\n\
                        - execute_command_with_stream: Execute shell commands with streaming output\n\
                        - get_task_status: Get status of a running task\n\
                        - get_task_output: Get output from a task\n\
                        - cancel_task: Cancel a running task\n\
                        \n\
                        Endpoints:\n\
                        - SSE: /mcp/ai/sse\n\
                        - Streamable HTTP: /mcp/ai\n\
                        - Message: /mcp/ai/message",
                        MCP_SERVER_VERSION
                    )
                }),
            )
        }

        "ListOfferings" => {
            JsonRpcResponse::success(
                request.id,
                json!({
                    "offerings": [
                        {
                            "name": "rebebuca-ai",
                            "description": "Rebebuca AI MCP Server",
                            "endpoints": {
                                "sse": format!("http://127.0.0.1:{}/mcp/ai/sse", state.get_port()),
                                "streamableHttp": format!("http://127.0.0.1:{}/mcp/ai", state.get_port()),
                                "message": format!("http://127.0.0.1:{}/mcp/ai/message", state.get_port())
                            },
                            "tools": get_ai_tools().len(),
                            "resources": get_ai_resources().len()
                        }
                    ]
                }),
            )
        }

        _ => JsonRpcResponse::error(
            request.id,
            -32601,
            format!("Method not found: {}", request.method),
        ),
    }
}

/// SSE endpoint for debug - establishes connection and sends endpoint event
async fn debug_sse_handler(
    State(state): State<MCPServerState>,
) -> Sse<impl Stream<Item = Result<Event, Infallible>>> {
    let connection_id = format!(
        "conn_{}_{}",
        chrono::Utc::now().timestamp_millis(),
        uuid::Uuid::new_v4().to_string().split('-').next().unwrap_or("x")
    );
    
    info!("[MCP Debug] New SSE connection: {}", connection_id);
    
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
        let endpoint_data = format!("/mcp/debug/message?sessionId={}", conn_id);
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
        info!("[MCP Debug] SSE connection closed: {}", conn_id);
    };

    Sse::new(stream).keep_alive(
        axum::response::sse::KeepAlive::new()
            .interval(Duration::from_secs(30))
            .text("ping"),
    )
}

/// SSE endpoint for AI - establishes connection and sends endpoint event
async fn ai_sse_handler(
    State(state): State<MCPServerState>,
) -> Sse<impl Stream<Item = Result<Event, Infallible>>> {
    let connection_id = format!(
        "conn_{}_{}",
        chrono::Utc::now().timestamp_millis(),
        uuid::Uuid::new_v4().to_string().split('-').next().unwrap_or("x")
    );
    
    info!("[MCP AI] New SSE connection: {}", connection_id);
    
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
        let endpoint_data = format!("/mcp/ai/message?sessionId={}", conn_id);
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
        info!("[MCP AI] SSE connection closed: {}", conn_id);
    };

    Sse::new(stream).keep_alive(
        axum::response::sse::KeepAlive::new()
            .interval(Duration::from_secs(30))
            .text("ping"),
    )
}

/// Debug message endpoint - receives JSON-RPC messages for debug tools
async fn debug_message_handler(
    State(state): State<MCPServerState>,
    Query(query): Query<MessageQuery>,
    Json(request): Json<JsonRpcRequest>,
) -> impl IntoResponse {
    let session_id = query.session_id.unwrap_or_else(|| "default".to_string());
    let has_id = request.id.is_some();

    // Handle the debug message with session_id for subscription support
    let response = handle_debug_mcp_message(&state, request, Some(&session_id)).await;

    // Only send response via SSE if this was a request (has id), not a notification
    if has_id {
        let connections = state.connections.read().await;
        if let Some(tx) = connections.get(&session_id) {
            let _ = tx.send(serde_json::to_value(&response).unwrap_or(json!({})));
        }
    }

    // Return 202 Accepted as per MCP SSE transport spec
    axum::http::StatusCode::ACCEPTED
}

/// AI message endpoint - receives JSON-RPC messages for AI tools
async fn ai_message_handler(
    State(state): State<MCPServerState>,
    Query(query): Query<MessageQuery>,
    Json(request): Json<JsonRpcRequest>,
) -> impl IntoResponse {
    let session_id = query.session_id.unwrap_or_else(|| "default".to_string());
    let has_id = request.id.is_some();

    // Handle the AI message with session_id for subscription support
    let response = handle_ai_mcp_message(&state, request, Some(&session_id)).await;

    // Only send response via SSE if this was a request (has id), not a notification
    if has_id {
        let connections = state.connections.read().await;
        if let Some(tx) = connections.get(&session_id) {
            let _ = tx.send(serde_json::to_value(&response).unwrap_or(json!({})));
        }
    }

    // Return 202 Accepted as per MCP SSE transport spec
    axum::http::StatusCode::ACCEPTED
}

/// Debug streamable HTTP endpoint - handles JSON-RPC for debug tools
async fn debug_streamable_http_handler(
    State(state): State<MCPServerState>,
    Json(request): Json<JsonRpcRequest>,
) -> Json<JsonRpcResponse> {
    // For streamable HTTP, we don't have a persistent session for subscriptions
    let response = handle_debug_mcp_message(&state, request, None).await;
    Json(response)
}

/// AI streamable HTTP endpoint - handles JSON-RPC for AI tools
async fn ai_streamable_http_handler(
    State(state): State<MCPServerState>,
    Json(request): Json<JsonRpcRequest>,
) -> Json<JsonRpcResponse> {
    // For streamable HTTP, we don't have a persistent session for subscriptions
    let response = handle_ai_mcp_message(&state, request, None).await;
    Json(response)
}

/// Health check endpoint
async fn health_handler() -> Json<Value> {
    Json(json!({
        "status": "ok",
        "server": MCP_SERVER_NAME,
        "version": MCP_SERVER_VERSION,
        "debug_tools": get_debug_tools().len(),
        "ai_tools": get_ai_tools().len(),
        "debug_resources": get_debug_resources().len(),
        "ai_resources": get_ai_resources().len()
    }))
}

/// SSE endpoint for terminal task output
async fn terminal_output_sse_handler(
    State(state): State<MCPServerState>,
    Path(task_id): Path<String>,
) -> Sse<impl Stream<Item = Result<Event, Infallible>>> {
    info!("[MCP] Terminal output SSE connection for task: {}", task_id);

    // Get output channel from task manager
    let mut rx_opt = if let Some(task_manager) = &state.task_manager {
        task_manager.subscribe_output(&task_id).await
    } else {
        None
    };

    let task_id_clone = task_id.clone();
    let state_clone = state.clone();

    // Create SSE stream
    let stream = async_stream::stream! {
        // Send buffered output first
        if let Some(task_manager) = &state_clone.task_manager {
            if let Some(buffered) = task_manager.get_buffered_output(&task_id_clone).await {
                for line in buffered {
                    let event_data = json!({
                        "event": "output",
                        "data": {
                            "type": line.output_type,
                            "content": line.content,
                            "timestamp": line.timestamp
                        }
                    });

                    if let Ok(json_str) = serde_json::to_string(&event_data) {
                        yield Ok(Event::default().event("output").data(json_str));
                    }
                }
            }
        }

        // Listen for new output events if we have a channel
        if let Some(mut rx) = rx_opt {
            loop {
                match rx.recv().await {
                    Ok(event) => {
                        match event {
                            TaskEvent::Output(line) => {
                                let event_data = json!({
                                    "event": "output",
                                    "data": {
                                        "type": line.output_type,
                                        "content": line.content,
                                        "timestamp": line.timestamp
                                    }
                                });

                                if let Ok(json_str) = serde_json::to_string(&event_data) {
                                    yield Ok(Event::default().event("output").data(json_str));
                                }
                            }
                            TaskEvent::Exit { exit_code, timestamp } => {
                                let event_data = json!({
                                    "event": "exit",
                                    "data": {
                                        "exitCode": exit_code,
                                        "timestamp": timestamp
                                    }
                                });

                                if let Ok(json_str) = serde_json::to_string(&event_data) {
                                    yield Ok(Event::default().event("exit").data(json_str));
                                }
                                // Exit event closes the connection
                                break;
                            }
                            TaskEvent::Error { message, code } => {
                                let event_data = json!({
                                    "event": "error",
                                    "data": {
                                        "message": message,
                                        "code": code
                                    }
                                });

                                if let Ok(json_str) = serde_json::to_string(&event_data) {
                                    yield Ok(Event::default().event("error").data(json_str));
                                }
                                break;
                            }
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
        } else {
            // No output channel available - task may not exist or not started yet
            warn!("[MCP] No output channel found for task: {}", task_id_clone);
        }

        info!("[MCP] Terminal output SSE closed for task: {}", task_id_clone);
    };

    Sse::new(stream).keep_alive(
        axum::response::sse::KeepAlive::new()
            .interval(Duration::from_secs(30))
            .text("ping"),
    )
}

/// SSE endpoint for terminal tasks list
async fn terminal_tasks_sse_handler(
    State(state): State<MCPServerState>,
) -> Sse<impl Stream<Item = Result<Event, Infallible>>> {
    info!("[MCP] Terminal tasks list SSE connection");

    // Subscribe to task list events if available
    let rx_opt = state.task_manager.as_ref().map(|tm| tm.subscribe_task_list());

    // Create SSE stream
    let stream = async_stream::stream! {
        // Send current task list first
        if let Some(task_manager) = &state.task_manager {
            let tasks = task_manager.list_tasks().await;
            let event_data = json!({
                "tasks": tasks,
                "count": tasks.len()
            });

            if let Ok(json_str) = serde_json::to_string(&event_data) {
                yield Ok(Event::default().event("tasks").data(json_str));
            }
        }

        // Listen for task list events if available
        if let Some(mut rx) = rx_opt {
            loop {
                match rx.recv().await {
                    Ok(event) => {
                        let event_name = match &event {
                            crate::terminal_task_types::TaskListEvent::TaskCreated(_) => "task_created",
                            crate::terminal_task_types::TaskListEvent::TaskUpdated(_) => "task_updated",
                            crate::terminal_task_types::TaskListEvent::TaskDeleted { .. } => "task_deleted",
                        };

                        if let Ok(json_str) = serde_json::to_string(&event) {
                            yield Ok(Event::default().event(event_name).data(json_str));
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
        }

        info!("[MCP] Terminal tasks list SSE closed");
    };

    Sse::new(stream).keep_alive(
        axum::response::sse::KeepAlive::new()
            .interval(Duration::from_secs(30))
            .text("ping"),
    )
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
pub async fn start_server(
    app_handle: tauri::AppHandle,
    port: u16,
    task_manager: Option<Arc<TerminalTaskManager>>,
) -> Result<(), String> {
    let mut state = MCPServerState::new(app_handle.clone(), port);

    // Set task manager if provided
    if let Some(tm) = task_manager {
        state.set_task_manager(tm);
    }

    // Store state in app for later access
    app_handle.manage(state.clone());
    
    // Configure CORS
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods([Method::GET, Method::POST, Method::OPTIONS])
        .allow_headers(Any);
    
    // Build router
    let app = Router::new()
        // Debug MCP endpoints
        .route("/mcp/debug/sse", get(debug_sse_handler))
        .route("/mcp/debug/message", post(debug_message_handler))
        .route("/mcp/debug", post(debug_streamable_http_handler))
        // AI MCP endpoints
        .route("/mcp/ai/sse", get(ai_sse_handler))
        .route("/mcp/ai/message", post(ai_message_handler))
        .route("/mcp/ai", post(ai_streamable_http_handler))
        // Health and terminal endpoints
        .route("/health", get(health_handler))
        .route("/terminal/output/:task_id/sse", get(terminal_output_sse_handler))
        .route("/terminal/tasks/sse", get(terminal_tasks_sse_handler))
        .layer(cors)
        .with_state(state);

    let addr = format!("127.0.0.1:{}", port);
    let listener = tokio::net::TcpListener::bind(&addr)
        .await
        .map_err(|e| format!("Failed to bind to {}: {}", addr, e))?;

    info!("[MCP] HTTP server started on http://{}", addr);
    info!("[MCP] Debug SSE endpoint: http://{}/mcp/debug/sse", addr);
    info!("[MCP] Debug Streamable HTTP endpoint: http://{}/mcp/debug", addr);
    info!("[MCP] Debug Message endpoint: http://{}/mcp/debug/message", addr);
    info!("[MCP] AI SSE endpoint: http://{}/mcp/ai/sse", addr);
    info!("[MCP] AI Streamable HTTP endpoint: http://{}/mcp/ai", addr);
    info!("[MCP] AI Message endpoint: http://{}/mcp/ai/message", addr);
    info!("[MCP] Health check: http://{}/health", addr);
    info!("[MCP] Terminal output SSE: http://{}/terminal/output/:task_id/sse", addr);
    info!("[MCP] Terminal tasks SSE: http://{}/terminal/tasks/sse", addr);
    
    // Run server in background
    tokio::spawn(async move {
        if let Err(e) = axum::serve(listener, app).await {
            error!("[MCP] HTTP server error: {}", e);
        }
    });
    
    Ok(())
}
