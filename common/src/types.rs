//! Common data types shared across Rebebuca projects

use serde::{Deserialize, Serialize};

/// Output type for process output streams
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum OutputType {
    Stdout,
    Stderr,
    System,
}

/// Terminal data event - emitted when terminal produces output
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TerminalDataEvent {
    pub pty_id: String,
    pub data: String,
}

/// Terminal exit event - emitted when terminal process exits
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TerminalExitEvent {
    pub pty_id: String,
    pub exit_code: Option<i32>,
}

/// Process statistics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProcessStats {
    pub pid: u32,
    pub cpu_usage: f64,
    pub memory_usage: u64,
    pub memory_usage_mb: String,
}

/// Process information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProcessInfo {
    pub pid: u32,
    pub name: String,
    pub cpu_usage: Option<f64>,
    pub memory_usage: Option<f64>,
}

/// PTY process statistics (extends ProcessStats with pty_id)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PtyProcessStats {
    pub pty_id: String,
    pub pid: u32,
    pub cpu_usage: f64,
    pub memory_usage: u64,
    pub memory_usage_mb: String,
}

impl PtyProcessStats {
    pub fn new(pty_id: String, pid: u32, stats: ProcessStats) -> Self {
        Self {
            pty_id,
            pid,
            cpu_usage: stats.cpu_usage,
            memory_usage: stats.memory_usage,
            memory_usage_mb: stats.memory_usage_mb,
        }
    }
}

/// Directory entry information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DirEntry {
    pub name: String,
    pub path: String,
    pub is_directory: bool,
    pub is_file: bool,
}

/// File information with metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileInfo {
    pub path: String,
    pub size: u64,
    pub is_directory: bool,
    pub is_file: bool,
    pub modified_at: Option<u64>,
}

/// Shell information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ShellInfo {
    pub id: String,
    pub name: String,
    pub path: String,
    pub available: bool,
    pub is_default: bool,
}

/// Port information with associated process
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PortInfo {
    pub port: u16,
    pub pid: u32,
    pub process: String,
    pub protocol: String,
}

/// Parameters for creating a new terminal
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateTerminalParams {
    pub shell: Option<String>,
    pub cwd: Option<String>,
    pub cols: Option<u16>,
    pub rows: Option<u16>,
    pub env: Option<std::collections::HashMap<String, String>>,
}

impl Default for CreateTerminalParams {
    fn default() -> Self {
        Self {
            shell: None,
            cwd: None,
            cols: Some(80),
            rows: Some(24),
            env: None,
        }
    }
}

/// SSH authentication method
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(tag = "type", rename_all = "lowercase")]
pub enum SshAuthMethod {
    Password { password: String },
    PrivateKey { key_path: String, passphrase: Option<String> },
}

/// SSH configuration for remote execution
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

/// Saved SSH configuration (for storage)
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

/// SSH connection status
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum SshConnectionStatus {
    Disconnected,
    Connecting,
    Connected,
    AgentReady,
}

/// SSH connection info
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SshConnectionInfo {
    pub id: String,
    pub status: SshConnectionStatus,
    pub task_count: u32,
    pub last_ping: Option<u64>,  // Timestamp of last successful ping
}

/// Agent message types for remote-agent communication
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum AgentMessage {
    /// Request to execute a command
    Execute {
        id: String,
        command: String,
        args: Option<Vec<String>>,
        cwd: Option<String>,
        env: Option<std::collections::HashMap<String, String>>,
    },
    /// Command output
    Output {
        id: String,
        output_type: OutputType,
        content: String,
    },
    /// Process has started
    ProcessStarted {
        id: String,
        pid: u32,
    },
    /// Process has finished
    ProcessFinished {
        id: String,
        exit_code: Option<i32>,
    },
    /// Error occurred
    Error {
        id: String,
        message: String,
    },
    /// Ping request
    Ping,
    /// Pong response
    Pong,
    /// Request agent version
    GetVersion,
    /// Agent version response
    Version {
        version: String,
    },
}
