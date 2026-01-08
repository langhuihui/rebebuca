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

// SSH configuration for remote execution
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SshConfig {
    pub id: Option<String>,  // Optional ID for saved configurations
    pub name: Option<String>,  // Optional name for saved configurations
    pub host: String,
    pub port: u16,
    pub username: String,
    pub auth: SshAuthMethod,
    pub keep_alive_interval: Option<u64>,  // Keep-alive interval in seconds (default: 60)
    pub keep_connection: Option<bool>,  // Whether to keep connection open when no tasks (default: false)
}

// Saved SSH configuration (for storage)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SavedSshConfig {
    pub id: String,
    pub name: String,
    pub host: String,
    pub port: u16,
    pub username: String,
    pub auth: SshAuthMethod,
    pub keep_alive_interval: u64,  // Keep-alive interval in seconds
    pub keep_connection: bool,  // Whether to keep connection open when no tasks
}

// SSH connection status
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SshConnectionStatus {
    Disconnected,
    Connecting,
    Connected,
    AgentReady,
}

// SSH connection info
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SshConnectionInfo {
    pub id: String,
    pub status: SshConnectionStatus,
    pub task_count: u32,
    pub last_ping: Option<u64>,  // Timestamp of last successful ping
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "lowercase")]
pub enum SshAuthMethod {
    Password { password: String },
    PrivateKey { key_path: String, passphrase: Option<String> },
}

// Remote agent communication protocol
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum AgentMessage {
    Execute {
        id: String,
        command: String,
        args: Option<Vec<String>>,
        cwd: Option<String>,
        env: Option<HashMap<String, String>>,
    },
    Output {
        id: String,
        output_type: OutputType,
        content: String,
    },
    ProcessStarted {
        id: String,
        pid: u32,
    },
    ProcessFinished {
        id: String,
        exit_code: Option<i32>,
    },
    Error {
        id: String,
        message: String,
    },
    Ping,
    Pong,
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

// Recent task for tray menu (similar to VSCode's recent projects in dock)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecentTask {
    pub id: String,           // Task ID
    pub name: String,         // Display name
    pub command: String,      // Command to execute
    pub cwd: Option<String>,  // Working directory
    pub timestamp: u64,       // Last run timestamp (ms)
}
