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
