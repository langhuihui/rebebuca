use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RunConfig {
    pub name: String,
    pub command: String,
    pub working_directory: Option<String>,
    pub environment: Option<HashMap<String, String>>,
    pub arguments: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProcessInfo {
    pub internal_id: String,  // 内部UUID，用于前端查找历史记录
    pub system_pid: Option<u32>,  // 系统PID，用于显示和进程管理
    pub config_name: String,
    pub status: ProcessStatus,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProcessStats {
    pub process_id: String,
    pub cpu_usage: f64,
    pub memory_usage: u64,
    pub memory_usage_mb: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ProcessStatus {
    Running,
    Stopped,
    Error,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OutputEvent {
    pub process_id: String,
    pub output_type: OutputType,
    pub content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum OutputType {
    Stdout,
    Stderr,
    System,
}

// Tray menu data structures
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RunningProcess {
    pub id: String,           // PTY ID or process ID
    pub name: String,         // Display name
    pub task_id: Option<String>, // Associated task ID (for restart)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FavoriteTask {
    pub id: String,           // Task ID
    pub name: String,         // Display name
    pub command: String,      // Command to execute
    pub cwd: Option<String>,  // Working directory
}
