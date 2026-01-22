//! Tool execution abstraction
//!
//! This module provides the `ToolExecutor` trait which abstracts tool execution
//! to support both local (Tauri) and remote (WebSocket) environments.

mod executor;
mod types;

pub use executor::{NullToolExecutor, ToolExecutor};
pub use types::{PermissionRequest, PermissionResponse, ToolDefinition, ToolResult};
