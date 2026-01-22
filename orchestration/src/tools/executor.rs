//! ToolExecutor trait - the core abstraction for tool execution
//!
//! This trait abstracts tool execution to support both:
//! - Local execution (Tauri desktop mode)
//! - Remote execution (WebSocket server mode)

use async_trait::async_trait;
use serde_json::Value;

use super::types::{PermissionRequest, PermissionResponse, ToolDefinition, ToolResult};
use crate::errors::Result;

/// Tool executor trait - abstracts tool execution for different environments
///
/// Implementations:
/// - `LocalToolExecutor` in `src-tauri/` - executes tools locally
/// - `RemoteToolExecutor` in `remote-agent-server/` - executes via existing adapters
#[async_trait]
pub trait ToolExecutor: Send + Sync {
    /// Execute a tool with the given arguments
    ///
    /// # Arguments
    /// * `tool` - Tool name (e.g., "read", "write", "bash")
    /// * `args` - Tool arguments as JSON
    ///
    /// # Returns
    /// * `Ok(ToolResult)` - Execution result
    /// * `Err` - If execution fails
    async fn execute(&self, tool: &str, args: Value) -> Result<ToolResult>;

    /// Get list of available tools
    fn available_tools(&self) -> Vec<ToolDefinition>;

    /// Check if a tool is available
    fn has_tool(&self, name: &str) -> bool {
        self.available_tools().iter().any(|t| t.name == name)
    }

    /// Request permission for a tool operation
    ///
    /// Default implementation auto-approves all requests.
    /// Override to implement custom permission logic.
    async fn request_permission(&self, _request: PermissionRequest) -> Result<PermissionResponse> {
        Ok(PermissionResponse::Allow)
    }

    /// Get the project/working directory path
    fn project_path(&self) -> &str;

    /// Get the session ID
    fn session_id(&self) -> &str;
}

/// Null tool executor for testing
pub struct NullToolExecutor {
    project_path: String,
    session_id: String,
}

impl NullToolExecutor {
    pub fn new(project_path: impl Into<String>, session_id: impl Into<String>) -> Self {
        Self {
            project_path: project_path.into(),
            session_id: session_id.into(),
        }
    }
}

#[async_trait]
impl ToolExecutor for NullToolExecutor {
    async fn execute(&self, tool: &str, _args: Value) -> Result<ToolResult> {
        Ok(ToolResult::failure(format!(
            "NullToolExecutor: tool '{}' not implemented",
            tool
        )))
    }

    fn available_tools(&self) -> Vec<ToolDefinition> {
        vec![]
    }

    fn project_path(&self) -> &str {
        &self.project_path
    }

    fn session_id(&self) -> &str {
        &self.session_id
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_null_executor() {
        let executor = NullToolExecutor::new("/tmp/project", "session-123");

        assert_eq!(executor.project_path(), "/tmp/project");
        assert_eq!(executor.session_id(), "session-123");
        assert!(executor.available_tools().is_empty());
        assert!(!executor.has_tool("read"));

        let result = executor
            .execute("read", serde_json::json!({"path": "test.txt"}))
            .await
            .unwrap();
        assert!(!result.success);
    }
}
