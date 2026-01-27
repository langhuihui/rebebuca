//! Terminal Task Types
//!
//! Defines types for terminal task management including status, events, and errors.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Task status enumeration
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum TaskStatus {
    /// Task is currently running
    Running,
    /// Task was stopped by user
    Stopped,
    /// Task finished successfully (exit code = 0)
    Finished,
    /// Task failed (exit code != 0 or unknown)
    Failed,
}

impl std::fmt::Display for TaskStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            TaskStatus::Running => write!(f, "running"),
            TaskStatus::Stopped => write!(f, "stopped"),
            TaskStatus::Finished => write!(f, "finished"),
            TaskStatus::Failed => write!(f, "failed"),
        }
    }
}

/// Output type enumeration
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum OutputType {
    /// Standard output
    Stdout,
    /// Standard error
    Stderr,
}

impl std::fmt::Display for OutputType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            OutputType::Stdout => write!(f, "stdout"),
            OutputType::Stderr => write!(f, "stderr"),
        }
    }
}

/// Single output line from task execution
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OutputLine {
    /// Output type (stdout/stderr)
    #[serde(rename = "type")]
    pub output_type: OutputType,
    /// Output content
    pub content: String,
    /// Timestamp when this output was produced
    pub timestamp: DateTime<Utc>,
}

impl OutputLine {
    /// Create a new stdout output line
    pub fn stdout(content: String) -> Self {
        Self {
            output_type: OutputType::Stdout,
            content,
            timestamp: Utc::now(),
        }
    }

    /// Create a new stderr output line
    pub fn stderr(content: String) -> Self {
        Self {
            output_type: OutputType::Stderr,
            content,
            timestamp: Utc::now(),
        }
    }

    /// Calculate approximate memory size in bytes
    pub fn size_bytes(&self) -> usize {
        self.content.len() + std::mem::size_of::<OutputType>() + 24 // timestamp ~24 bytes
    }
}

/// Task information structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskInfo {
    /// Unique task identifier
    pub task_id: String,
    /// Session ID for SSE subscription
    pub session_id: String,
    /// Original command that was executed
    pub command: String,
    /// Working directory where task was executed
    pub cwd: String,
    /// Current task status
    pub status: TaskStatus,
    /// Process PID (if available)
    pub pid: Option<u32>,
    /// Task start time
    pub started_at: DateTime<Utc>,
    /// Task end time (if finished/stopped)
    pub stopped_at: Option<DateTime<Utc>>,
    /// Exit code (if available)
    pub exit_code: Option<i32>,
    /// Frontend tab ID (if created)
    pub tab_id: Option<String>,
    /// PTY identifier
    pub pty_id: String,
    /// Output resource URI for SSE subscription
    pub output_uri: String,
    /// Environment variables (if any)
    pub env: Option<HashMap<String, String>>,
    /// Shell type used (if any)
    pub shell: Option<String>,
    /// Timeout in seconds (if any)
    pub timeout: Option<u64>,
}

/// Internal task state with output buffer
#[derive(Debug)]
pub struct TaskInternalState {
    /// Task information
    pub info: TaskInfo,
    /// Output buffer (LRU)
    pub output_buffer: Vec<OutputLine>,
    /// Current buffer size in bytes
    pub buffer_size: usize,
}

impl TaskInternalState {
    /// Create a new internal task state
    pub fn new(info: TaskInfo) -> Self {
        Self {
            info,
            output_buffer: Vec::new(),
            buffer_size: 0,
        }
    }

    /// Get task ID
    pub fn task_id(&self) -> &str {
        &self.info.task_id
    }

    /// Get PTY ID
    pub fn pty_id(&self) -> &str {
        &self.info.pty_id
    }

    /// Check if task is running
    pub fn is_running(&self) -> bool {
        self.info.status == TaskStatus::Running
    }
}

/// Request to create a new task
#[derive(Debug, Clone, Deserialize)]
pub struct CreateTaskRequest {
    /// Command to execute
    pub command: String,
    /// Working directory (optional, defaults to project root)
    pub cwd: Option<String>,
    /// Shell type (optional, defaults to system shell)
    pub shell: Option<String>,
    /// Environment variables (optional)
    pub env: Option<HashMap<String, String>>,
    /// Timeout in seconds (0 means no limit)
    #[serde(default)]
    pub timeout: Option<u64>,
}

/// Request to stop a task
#[derive(Debug, Clone, Deserialize)]
pub struct StopTaskRequest {
    /// Task ID to stop
    pub task_id: String,
    /// Signal type (SIGTERM/SIGKILL, optional)
    pub signal: Option<String>,
}

/// Task event for SSE streaming
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "event", content = "data")]
pub enum TaskEvent {
    /// Output event
    #[serde(rename = "output")]
    Output(OutputLine),
    /// Exit event
    #[serde(rename = "exit")]
    Exit { exit_code: Option<i32>, timestamp: DateTime<Utc> },
    /// Error event
    #[serde(rename = "error")]
    Error { message: String, code: i32 },
}

/// Task list event for SSE streaming
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "event", content = "data")]
pub enum TaskListEvent {
    /// Task created
    #[serde(rename = "task_created")]
    TaskCreated(TaskInfo),
    /// Task updated
    #[serde(rename = "task_updated")]
    TaskUpdated(TaskInfo),
    /// Task deleted
    #[serde(rename = "task_deleted")]
    TaskDeleted { task_id: String },
}

/// Task error types
#[derive(Debug, Clone)]
pub enum TaskError {
    /// Command is invalid (empty or too long)
    InvalidCommand(String),

    /// Working directory not found
    CwdNotFound(String),

    /// Failed to start process
    ProcessStartFailed(String),

    /// Task not found
    TaskNotFound(String),

    /// Task is not in running state
    TaskNotRunning(String),

    /// Maximum concurrent tasks reached
    MaxConcurrencyReached(usize),

    /// Task timeout
    Timeout(u64),
}

impl std::fmt::Display for TaskError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            TaskError::InvalidCommand(msg) => write!(f, "Invalid command: {}", msg),
            TaskError::CwdNotFound(msg) => write!(f, "Working directory not found: {}", msg),
            TaskError::ProcessStartFailed(msg) => write!(f, "Failed to start process: {}", msg),
            TaskError::TaskNotFound(msg) => write!(f, "Task not found: {}", msg),
            TaskError::TaskNotRunning(msg) => write!(f, "Task is not running: {}", msg),
            TaskError::MaxConcurrencyReached(n) => write!(f, "Maximum concurrent tasks reached: {}", n),
            TaskError::Timeout(seconds) => write!(f, "Task timed out after {} seconds", seconds),
        }
    }
}

impl TaskError {
    /// Convert error to HTTP status code
    pub fn http_status_code(&self) -> u16 {
        match self {
            TaskError::InvalidCommand(_) => 400,
            TaskError::CwdNotFound(_) => 404,
            TaskError::ProcessStartFailed(_) => 500,
            TaskError::TaskNotFound(_) => 404,
            TaskError::TaskNotRunning(_) => 409,
            TaskError::MaxConcurrencyReached(_) => 503,
            TaskError::Timeout(_) => 408,
        }
    }

    /// Convert error to JSON-RPC error code
    pub fn json_rpc_code(&self) -> i32 {
        self.http_status_code() as i32
    }
}

/// Resource limits configuration
#[derive(Debug, Clone)]
pub struct ResourceLimits {
    /// Maximum number of concurrent tasks
    pub max_concurrent_tasks: usize,
    /// Maximum output buffer size per task in bytes
    pub max_output_buffer_size: usize,
    /// Maximum task duration in seconds (0 = no limit)
    pub max_task_duration: u64,
    /// Retention time for finished tasks in seconds
    pub finished_task_retention: u64,
}

impl Default for ResourceLimits {
    fn default() -> Self {
        Self {
            max_concurrent_tasks: 10,
            max_output_buffer_size: 10 * 1024 * 1024, // 10MB
            max_task_duration: 0, // No limit
            finished_task_retention: 1800, // 30 minutes
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_output_line_size_bytes() {
        let line = OutputLine::stdout("Hello, World!".to_string());
        assert_eq!(line.size_bytes(), 13 + std::mem::size_of::<OutputType>() + 24);
    }

    #[test]
    fn test_task_status_display() {
        assert_eq!(TaskStatus::Running.to_string(), "running");
        assert_eq!(TaskStatus::Stopped.to_string(), "stopped");
        assert_eq!(TaskStatus::Finished.to_string(), "finished");
        assert_eq!(TaskStatus::Failed.to_string(), "failed");
    }

    #[test]
    fn test_task_error_http_status_code() {
        assert_eq!(TaskError::InvalidCommand("".to_string()).http_status_code(), 400);
        assert_eq!(TaskError::CwdNotFound("".to_string()).http_status_code(), 404);
        assert_eq!(TaskError::ProcessStartFailed("".to_string()).http_status_code(), 500);
        assert_eq!(TaskError::TaskNotFound("".to_string()).http_status_code(), 404);
        assert_eq!(TaskError::TaskNotRunning("".to_string()).http_status_code(), 409);
        assert_eq!(TaskError::MaxConcurrencyReached(10).http_status_code(), 503);
        assert_eq!(TaskError::Timeout(300).http_status_code(), 408);
    }

    #[test]
    fn test_resource_limits_default() {
        let limits = ResourceLimits::default();
        assert_eq!(limits.max_concurrent_tasks, 10);
        assert_eq!(limits.max_output_buffer_size, 10 * 1024 * 1024);
        assert_eq!(limits.max_task_duration, 0);
        assert_eq!(limits.finished_task_retention, 1800);
    }
}
