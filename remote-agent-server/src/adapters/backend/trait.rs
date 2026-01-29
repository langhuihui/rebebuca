//! Terminal backend trait definition
//!
//! Provides a unified interface for different terminal backends (PTY, SSH, Local, etc.)

use async_trait::async_trait;
use serde::{Deserialize, Serialize};

use crate::protocol::{CreateTerminalParams, PtyProcessStats};

/// Terminal backend identifier
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum BackendType {
    /// WebSocket PTY backend (local pseudo-terminal)
    Pty,
    /// SSH backend (remote terminal via SSH)
    Ssh,
    /// Local terminal backend (direct system terminal)
    Local,
}

impl BackendType {
    /// Get backend type from string
    pub fn from_str(s: &str) -> Option<Self> {
        match s.to_lowercase().as_str() {
            "pty" => Some(Self::Pty),
            "ssh" => Some(Self::Ssh),
            "local" => Some(Self::Local),
            _ => None,
        }
    }

    /// Get string representation
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Pty => "pty",
            Self::Ssh => "ssh",
            Self::Local => "local",
        }
    }
}

/// Terminal handle identifier
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct TerminalHandle {
    /// Backend type
    pub backend: BackendType,
    /// Terminal ID (unique within the backend)
    pub id: String,
}

impl TerminalHandle {
    pub fn new(backend: BackendType, id: String) -> Self {
        Self { backend, id }
    }

    pub fn pty(id: String) -> Self {
        Self::new(BackendType::Pty, id)
    }

    pub fn ssh(id: String) -> Self {
        Self::new(BackendType::Ssh, id)
    }

    pub fn local(id: String) -> Self {
        Self::new(BackendType::Local, id)
    }
}

/// Terminal creation result
#[derive(Debug, Clone)]
pub struct TerminalCreateResult {
    /// Terminal handle
    pub handle: TerminalHandle,
    /// Process ID (if available)
    pub pid: Option<u32>,
}

/// Terminal backend trait
///
/// All terminal backends must implement this trait to provide a unified interface.
#[async_trait]
pub trait TerminalBackend: Send + Sync {
    /// Get the backend type
    fn backend_type(&self) -> BackendType;

    /// Create a new terminal instance
    ///
    /// Returns a terminal handle and optional process ID.
    async fn create(&self, params: CreateTerminalParams) -> Result<TerminalCreateResult, String>;

    /// Write data to the terminal
    async fn write(&self, handle: &TerminalHandle, data: &str) -> Result<(), String>;

    /// Resize the terminal
    async fn resize(&self, handle: &TerminalHandle, cols: u16, rows: u16) -> Result<(), String>;

    /// Kill the terminal process (SIGTERM)
    async fn kill(&self, handle: &TerminalHandle) -> Result<(), String>;

    /// Force kill the terminal process (SIGKILL)
    async fn force_kill(&self, handle: &TerminalHandle) -> Result<(), String>;

    /// Check if the terminal is still alive
    async fn is_alive(&self, handle: &TerminalHandle) -> bool;

    /// Get process statistics (if available)
    async fn get_process_stats(&self, handle: &TerminalHandle) -> Option<PtyProcessStats>;

    /// Get text content from terminal (last N lines, if supported)
    async fn get_text(&self, handle: &TerminalHandle, lines: Option<usize>) -> Option<String>;

    /// Send a key to the terminal (if supported)
    async fn send_key(&self, handle: &TerminalHandle, key: &str) -> Result<bool, String>;
}
