//! Tool-related types

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Definition of a tool that can be used by agents
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolDefinition {
    /// Tool name (unique identifier)
    pub name: String,

    /// Human-readable description
    pub description: String,

    /// JSON Schema for tool parameters
    pub parameters: serde_json::Value,

    /// Whether this tool requires permission before execution
    #[serde(default)]
    pub requires_permission: bool,
}

impl ToolDefinition {
    /// Create a new tool definition
    pub fn new(
        name: impl Into<String>,
        description: impl Into<String>,
        parameters: serde_json::Value,
    ) -> Self {
        Self {
            name: name.into(),
            description: description.into(),
            parameters,
            requires_permission: false,
        }
    }

    /// Set whether this tool requires permission
    pub fn with_permission_required(mut self, required: bool) -> Self {
        self.requires_permission = required;
        self
    }
}

/// Result of a tool execution
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolResult {
    /// Whether the execution was successful
    pub success: bool,

    /// Output content (human-readable)
    pub output: String,

    /// Additional structured data
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<serde_json::Value>,

    /// Error message if failed
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,

    /// Execution duration in milliseconds
    #[serde(skip_serializing_if = "Option::is_none")]
    pub duration_ms: Option<u64>,

    /// Additional metadata
    #[serde(default, skip_serializing_if = "HashMap::is_empty")]
    pub metadata: HashMap<String, String>,
}

impl ToolResult {
    /// Create a successful result
    pub fn success(output: impl Into<String>) -> Self {
        Self {
            success: true,
            output: output.into(),
            data: None,
            error: None,
            duration_ms: None,
            metadata: HashMap::new(),
        }
    }

    /// Create a failed result
    pub fn failure(error: impl Into<String>) -> Self {
        Self {
            success: false,
            output: String::new(),
            data: None,
            error: Some(error.into()),
            duration_ms: None,
            metadata: HashMap::new(),
        }
    }

    /// Add structured data
    pub fn with_data(mut self, data: serde_json::Value) -> Self {
        self.data = Some(data);
        self
    }

    /// Set execution duration
    pub fn with_duration(mut self, duration_ms: u64) -> Self {
        self.duration_ms = Some(duration_ms);
        self
    }

    /// Add metadata
    pub fn with_metadata(mut self, key: impl Into<String>, value: impl Into<String>) -> Self {
        self.metadata.insert(key.into(), value.into());
        self
    }
}

/// Request for permission to execute a tool
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PermissionRequest {
    /// Unique request ID
    pub id: String,

    /// Tool name
    pub tool: String,

    /// Type of permission (e.g., "file_write", "command_execute")
    #[serde(rename = "type")]
    pub permission_type: String,

    /// Resource path (e.g., file path, command)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub path: Option<String>,

    /// Command to execute (for bash tools)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub command: Option<String>,

    /// Human-readable description of what will happen
    pub description: String,
}

impl PermissionRequest {
    /// Create a new permission request
    pub fn new(
        id: impl Into<String>,
        tool: impl Into<String>,
        permission_type: impl Into<String>,
        description: impl Into<String>,
    ) -> Self {
        Self {
            id: id.into(),
            tool: tool.into(),
            permission_type: permission_type.into(),
            path: None,
            command: None,
            description: description.into(),
        }
    }

    /// Set the path
    pub fn with_path(mut self, path: impl Into<String>) -> Self {
        self.path = Some(path.into());
        self
    }

    /// Set the command
    pub fn with_command(mut self, command: impl Into<String>) -> Self {
        self.command = Some(command.into());
        self
    }
}

/// Permission response
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum PermissionResponse {
    /// Allow this one request
    Allow,
    /// Always allow this type of request
    Always,
    /// Deny this request
    Deny,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_tool_definition() {
        let tool = ToolDefinition::new(
            "read",
            "Read file contents",
            serde_json::json!({
                "type": "object",
                "properties": {
                    "path": {"type": "string"}
                },
                "required": ["path"]
            }),
        )
        .with_permission_required(false);

        assert_eq!(tool.name, "read");
        assert!(!tool.requires_permission);
    }

    #[test]
    fn test_tool_result_success() {
        let result = ToolResult::success("File contents here")
            .with_data(serde_json::json!({"lines": 100}))
            .with_duration(50);

        assert!(result.success);
        assert_eq!(result.output, "File contents here");
        assert!(result.error.is_none());
        assert_eq!(result.duration_ms, Some(50));
    }

    #[test]
    fn test_tool_result_failure() {
        let result = ToolResult::failure("File not found");

        assert!(!result.success);
        assert_eq!(result.error, Some("File not found".to_string()));
    }

    #[test]
    fn test_permission_request() {
        let request = PermissionRequest::new(
            "req-123",
            "write",
            "file_write",
            "Write to config.json",
        )
        .with_path("/home/user/config.json");

        assert_eq!(request.tool, "write");
        assert_eq!(request.path, Some("/home/user/config.json".to_string()));
    }
}
