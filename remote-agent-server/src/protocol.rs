//! WebSocket protocol message definitions
//!
//! Defines the message format for communication between web frontend and server.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

// Re-export common types
pub use rebebuca_common::{DirEntry, FileInfo};

/// Request message from client to server
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Request {
    /// Unique request ID for matching responses
    pub id: String,
    /// Method name (e.g., "terminal.create", "fs.readFile")
    pub method: String,
    /// Method parameters
    #[serde(default)]
    pub params: serde_json::Value,
}

/// Response message from server to client
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Response {
    /// Corresponding request ID
    pub id: String,
    /// Whether the request was successful
    pub success: bool,
    /// Result data (when success is true)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub result: Option<serde_json::Value>,
    /// Error message (when success is false)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

impl Response {
    pub fn success(id: String, result: impl Serialize) -> Self {
        Self {
            id,
            success: true,
            result: Some(serde_json::to_value(result).unwrap_or(serde_json::Value::Null)),
            error: None,
        }
    }

    pub fn error(id: String, error: impl Into<String>) -> Self {
        Self {
            id,
            success: false,
            result: None,
            error: Some(error.into()),
        }
    }
}

/// Event message from server to client (push notification)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Event {
    /// Event name (e.g., "terminal.data", "terminal.exit")
    pub event: String,
    /// Event data
    pub data: serde_json::Value,
}

impl Event {
    pub fn new(event: impl Into<String>, data: impl Serialize) -> Self {
        Self {
            event: event.into(),
            data: serde_json::to_value(data).unwrap_or(serde_json::Value::Null),
        }
    }
}

/// Outgoing message (can be either Response or Event)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum OutgoingMessage {
    Response(Response),
    Event(Event),
}

// ============================================================================
// Terminal-related types (matching frontend adapter types)
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateTerminalParams {
    /// Optional client-specified PTY ID. If not provided, server generates one.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub pty_id: Option<String>,
    pub command: String,
    #[serde(default)]
    pub args: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cwd: Option<String>,
    #[serde(default)]
    pub env: HashMap<String, String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub log_path: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub shell_path: Option<String>,
    #[serde(default)]
    pub rows: Option<u16>,
    #[serde(default)]
    pub cols: Option<u16>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TerminalInfo {
    pub pty_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub pid: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TerminalDataEvent {
    pub pty_id: String,
    pub data: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TerminalExitEvent {
    pub pty_id: String,
    pub exit_code: Option<i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TerminalWriteParams {
    pub pty_id: String,
    pub data: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TerminalResizeParams {
    pub pty_id: String,
    pub cols: u16,
    pub rows: u16,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TerminalKillParams {
    pub pty_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PtyProcessStats {
    pub pty_id: String,
    pub pid: u32,
    pub cpu_usage: f32,
    pub memory_usage: u64,
    pub memory_usage_mb: String,
}

// ============================================================================
// File system types
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReadFileParams {
    pub path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WriteFileParams {
    pub path: String,
    pub content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReadDirParams {
    pub path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExistsParams {
    pub path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StatParams {
    pub path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MkdirParams {
    pub path: String,
    #[serde(default)]
    pub recursive: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RemoveParams {
    pub path: String,
    #[serde(default)]
    pub recursive: bool,
}

// ============================================================================
// System types
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LogPathInfo {
    pub log_filename: String,
    pub log_path: String,
}

// ============================================================================
// Storage types
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StorageGetParams {
    pub key: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StorageSetParams {
    pub key: String,
    pub value: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StorageDeleteParams {
    pub key: String,
}
