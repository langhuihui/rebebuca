//! PTY (Pseudo-Terminal) backend implementation
//!
//! Provides local terminal functionality using PTY

use async_trait::async_trait;
use std::sync::Arc;

use crate::adapters::terminal::TerminalAdapter;
use crate::protocol::{CreateTerminalParams, PtyProcessStats};
use crate::adapters::backend::{
    BackendType, TerminalBackend, TerminalCreateResult, TerminalHandle,
};

/// PTY backend implementation
pub struct PtyBackend {
    /// Inner terminal adapter (existing PTY implementation)
    adapter: Arc<TerminalAdapter>,
}

impl PtyBackend {
    /// Create a new PTY backend
    pub fn new(adapter: Arc<TerminalAdapter>) -> Self {
        Self { adapter }
    }
}

#[async_trait]
impl TerminalBackend for PtyBackend {
    fn backend_type(&self) -> BackendType {
        BackendType::Pty
    }

    async fn create(&self, params: CreateTerminalParams) -> Result<TerminalCreateResult, String> {
        let (pty_id, pid) = self.adapter.create(params).await?;
        Ok(TerminalCreateResult {
            handle: TerminalHandle::pty(pty_id),
            pid,
        })
    }

    async fn write(&self, handle: &TerminalHandle, data: &str) -> Result<(), String> {
        if handle.backend != BackendType::Pty {
            return Err(format!(
                "Invalid backend type: expected Pty, got {:?}",
                handle.backend
            ));
        }
        self.adapter.write(&handle.id, data).await
    }

    async fn resize(&self, handle: &TerminalHandle, cols: u16, rows: u16) -> Result<(), String> {
        if handle.backend != BackendType::Pty {
            return Err(format!(
                "Invalid backend type: expected Pty, got {:?}",
                handle.backend
            ));
        }
        self.adapter.resize(&handle.id, cols, rows).await
    }

    async fn kill(&self, handle: &TerminalHandle) -> Result<(), String> {
        if handle.backend != BackendType::Pty {
            return Err(format!(
                "Invalid backend type: expected Pty, got {:?}",
                handle.backend
            ));
        }
        self.adapter.kill(&handle.id).await
    }

    async fn force_kill(&self, handle: &TerminalHandle) -> Result<(), String> {
        if handle.backend != BackendType::Pty {
            return Err(format!(
                "Invalid backend type: expected Pty, got {:?}",
                handle.backend
            ));
        }
        self.adapter.force_kill(&handle.id).await
    }

    async fn is_alive(&self, handle: &TerminalHandle) -> bool {
        if handle.backend != BackendType::Pty {
            return false;
        }
        self.adapter.is_running(&handle.id).await
    }

    async fn get_process_stats(&self, handle: &TerminalHandle) -> Option<PtyProcessStats> {
        if handle.backend != BackendType::Pty {
            return None;
        }
        self.adapter.get_process_stats(&handle.id).await
    }

    async fn get_text(&self, _handle: &TerminalHandle, _lines: Option<usize>) -> Option<String> {
        // PTY backend doesn't support text retrieval yet
        // This could be implemented by reading from the PTY buffer
        None
    }

    async fn send_key(&self, handle: &TerminalHandle, key: &str) -> Result<bool, String> {
        if handle.backend != BackendType::Pty {
            return Ok(false);
        }
        // Convert key name to actual key sequence
        let key_sequence = match key.to_lowercase().as_str() {
            "enter" | "return" => "\r",
            "escape" | "esc" => "\x1b",
            "tab" => "\t",
            "backspace" => "\x08",
            "delete" => "\x7f",
            _ if key.len() == 1 => key,
            _ => return Ok(false),
        };
        self.write(handle, key_sequence).await?;
        Ok(true)
    }
}
