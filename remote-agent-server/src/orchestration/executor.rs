//! RemoteToolExecutor - executes tools using existing adapters

use async_trait::async_trait;
use rebebuca_orchestration::{
    errors::{OrchestrationError, Result},
    tools::{PermissionRequest, PermissionResponse, ToolDefinition, ToolExecutor, ToolResult},
};
use serde_json::Value;
use std::path::PathBuf;
use std::sync::Arc;

use crate::adapters::{FileSystemAdapter, TerminalAdapter};

/// Remote tool executor using existing adapters
pub struct RemoteToolExecutor {
    terminal_adapter: Arc<TerminalAdapter>,
    fs_adapter: Arc<FileSystemAdapter>,
    project_path: PathBuf,
    session_id: String,
}

impl RemoteToolExecutor {
    pub fn new(
        terminal_adapter: Arc<TerminalAdapter>,
        fs_adapter: Arc<FileSystemAdapter>,
        project_path: impl Into<PathBuf>,
        session_id: impl Into<String>,
    ) -> Self {
        Self {
            terminal_adapter,
            fs_adapter,
            project_path: project_path.into(),
            session_id: session_id.into(),
        }
    }

    /// Read file using FileSystemAdapter
    async fn read_file(&self, args: &Value) -> Result<ToolResult> {
        let path = args
            .get("path")
            .and_then(|v| v.as_str())
            .ok_or_else(|| OrchestrationError::tool_failure("read", "Missing 'path' argument"))?;

        let full_path = self.resolve_path(path);
        let full_path_str = full_path.to_string_lossy();

        match self.fs_adapter.read_text_file(&full_path_str).await {
            Ok(content) => Ok(ToolResult::success(content)),
            Err(e) => Ok(ToolResult::failure(format!("Failed to read file: {}", e))),
        }
    }

    /// Write file using FileSystemAdapter
    async fn write_file(&self, args: &Value) -> Result<ToolResult> {
        let path = args
            .get("path")
            .and_then(|v| v.as_str())
            .ok_or_else(|| OrchestrationError::tool_failure("write", "Missing 'path' argument"))?;

        let content = args
            .get("content")
            .and_then(|v| v.as_str())
            .ok_or_else(|| {
                OrchestrationError::tool_failure("write", "Missing 'content' argument")
            })?;

        let full_path = self.resolve_path(path);
        let full_path_str = full_path.to_string_lossy();

        match self.fs_adapter.write_text_file(&full_path_str, content).await {
            Ok(_) => Ok(ToolResult::success(format!("Written to {}", path))),
            Err(e) => Ok(ToolResult::failure(format!("Failed to write file: {}", e))),
        }
    }

    /// Execute bash command using TerminalAdapter
    async fn execute_bash(&self, args: &Value) -> Result<ToolResult> {
        let command = args
            .get("command")
            .and_then(|v| v.as_str())
            .ok_or_else(|| {
                OrchestrationError::tool_failure("bash", "Missing 'command' argument")
            })?;

        let cwd = args
            .get("cwd")
            .and_then(|v| v.as_str())
            .map(|p| self.resolve_path(p).to_string_lossy().to_string())
            .unwrap_or_else(|| self.project_path.to_string_lossy().to_string());

        let timeout_ms = args
            .get("timeout")
            .and_then(|v| v.as_u64())
            .unwrap_or(30000);

        // Create a temporary terminal for command execution
        let _pty_id = format!("orch-{}-{}", self.session_id, uuid::Uuid::new_v4());

        // Execute command and capture output
        // For simplicity, we use a simple spawn approach here
        // In production, you'd want to use the terminal adapter's full capabilities
        let start_time = std::time::Instant::now();

        let result = tokio::time::timeout(
            std::time::Duration::from_millis(timeout_ms),
            async {
                let output = tokio::process::Command::new("bash")
                    .arg("-c")
                    .arg(command)
                    .current_dir(&cwd)
                    .output()
                    .await
                    .map_err(|e| format!("Failed to execute: {}", e))?;

                let stdout = String::from_utf8_lossy(&output.stdout);
                let stderr = String::from_utf8_lossy(&output.stderr);

                Ok::<_, String>((output.status, stdout.to_string(), stderr.to_string()))
            },
        )
        .await;

        let duration_ms = start_time.elapsed().as_millis() as u64;

        match result {
            Ok(Ok((status, stdout, stderr))) => {
                let output = if stderr.is_empty() {
                    stdout
                } else {
                    format!("{}\n{}", stdout, stderr)
                };

                if status.success() {
                    Ok(ToolResult::success(output).with_duration(duration_ms))
                } else {
                    Ok(ToolResult::failure(format!(
                        "Command failed with exit code {:?}:\n{}",
                        status.code(),
                        output
                    ))
                    .with_duration(duration_ms))
                }
            }
            Ok(Err(e)) => Ok(ToolResult::failure(e)),
            Err(_) => Ok(ToolResult::failure(format!(
                "Command timed out after {}ms",
                timeout_ms
            ))),
        }
    }

    /// Glob file search
    async fn glob_files(&self, args: &Value) -> Result<ToolResult> {
        let pattern = args
            .get("pattern")
            .and_then(|v| v.as_str())
            .ok_or_else(|| {
                OrchestrationError::tool_failure("glob", "Missing 'pattern' argument")
            })?;

        let cwd = args
            .get("cwd")
            .and_then(|v| v.as_str())
            .map(|p| self.resolve_path(p).to_string_lossy().to_string())
            .unwrap_or_else(|| self.project_path.to_string_lossy().to_string());

        let command = format!("find . -name '{}' -type f 2>/dev/null | head -100", pattern);

        let output = tokio::process::Command::new("bash")
            .arg("-c")
            .arg(&command)
            .current_dir(&cwd)
            .output()
            .await
            .map_err(|e| OrchestrationError::tool_failure("glob", e.to_string()))?;

        let files = String::from_utf8_lossy(&output.stdout);
        Ok(ToolResult::success(files.to_string()))
    }

    /// Grep content search
    async fn grep_content(&self, args: &Value) -> Result<ToolResult> {
        let pattern = args
            .get("pattern")
            .and_then(|v| v.as_str())
            .ok_or_else(|| {
                OrchestrationError::tool_failure("grep", "Missing 'pattern' argument")
            })?;

        let path = args.get("path").and_then(|v| v.as_str()).unwrap_or(".");
        let cwd = self.resolve_path(path).to_string_lossy().to_string();

        let command = format!(
            "rg --no-heading --line-number '{}' 2>/dev/null || grep -rn '{}' . 2>/dev/null | head -100",
            pattern, pattern
        );

        let output = tokio::process::Command::new("bash")
            .arg("-c")
            .arg(&command)
            .current_dir(&cwd)
            .output()
            .await
            .map_err(|e| OrchestrationError::tool_failure("grep", e.to_string()))?;

        let results = String::from_utf8_lossy(&output.stdout);
        Ok(ToolResult::success(results.to_string()))
    }

    /// Resolve path relative to project root
    fn resolve_path(&self, path: &str) -> PathBuf {
        let path = PathBuf::from(path);
        if path.is_absolute() {
            path
        } else {
            self.project_path.join(path)
        }
    }
}

#[async_trait]
impl ToolExecutor for RemoteToolExecutor {
    async fn execute(&self, tool: &str, args: Value) -> Result<ToolResult> {
        tracing::debug!(
            "[RemoteToolExecutor] Executing tool: {} with args: {:?}",
            tool,
            args
        );

        match tool {
            "read" => self.read_file(&args).await,
            "write" => self.write_file(&args).await,
            "bash" => self.execute_bash(&args).await,
            "glob" => self.glob_files(&args).await,
            "grep" => self.grep_content(&args).await,
            _ => Ok(ToolResult::failure(format!("Unknown tool: {}", tool))),
        }
    }

    fn available_tools(&self) -> Vec<ToolDefinition> {
        vec![
            ToolDefinition::new(
                "read",
                "Read file contents",
                serde_json::json!({
                    "type": "object",
                    "properties": {
                        "path": {"type": "string", "description": "File path to read"}
                    },
                    "required": ["path"]
                }),
            ),
            ToolDefinition::new(
                "write",
                "Write content to a file",
                serde_json::json!({
                    "type": "object",
                    "properties": {
                        "path": {"type": "string", "description": "File path to write"},
                        "content": {"type": "string", "description": "Content to write"}
                    },
                    "required": ["path", "content"]
                }),
            )
            .with_permission_required(true),
            ToolDefinition::new(
                "bash",
                "Execute a bash command",
                serde_json::json!({
                    "type": "object",
                    "properties": {
                        "command": {"type": "string", "description": "Command to execute"},
                        "cwd": {"type": "string", "description": "Working directory"},
                        "timeout": {"type": "integer", "description": "Timeout in milliseconds"}
                    },
                    "required": ["command"]
                }),
            )
            .with_permission_required(true),
            ToolDefinition::new(
                "glob",
                "Search for files matching a pattern",
                serde_json::json!({
                    "type": "object",
                    "properties": {
                        "pattern": {"type": "string", "description": "Glob pattern"},
                        "cwd": {"type": "string", "description": "Search directory"}
                    },
                    "required": ["pattern"]
                }),
            ),
            ToolDefinition::new(
                "grep",
                "Search for content in files",
                serde_json::json!({
                    "type": "object",
                    "properties": {
                        "pattern": {"type": "string", "description": "Search pattern"},
                        "path": {"type": "string", "description": "Path to search in"}
                    },
                    "required": ["pattern"]
                }),
            ),
        ]
    }

    fn project_path(&self) -> &str {
        self.project_path.to_str().unwrap_or("")
    }

    fn session_id(&self) -> &str {
        &self.session_id
    }

    async fn request_permission(&self, request: PermissionRequest) -> Result<PermissionResponse> {
        // Auto-approve for now
        tracing::debug!(
            "[RemoteToolExecutor] Auto-approving permission: {} - {}",
            request.tool,
            request.description
        );
        Ok(PermissionResponse::Allow)
    }
}
