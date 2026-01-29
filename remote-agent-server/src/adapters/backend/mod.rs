//! Terminal backend abstraction
//!
//! Provides a unified interface for different terminal backends (PTY, SSH, Local, etc.)
//! Similar to claude_code_bridge's TerminalBackend abstraction.

mod pty;
mod ssh;
#[path = "trait.rs"]
mod trait_;

#[cfg(test)]
mod example;

pub use pty::PtyBackend;
pub use ssh::SshBackend;
pub use trait_::{
    BackendType, TerminalBackend, TerminalCreateResult, TerminalHandle,
};

use std::sync::Arc;
use crate::adapters::terminal::TerminalAdapter;
use crate::protocol::CreateTerminalParams;

/// Unified terminal backend manager
///
/// Manages multiple backend types and routes requests to the appropriate backend.
pub struct UnifiedTerminalBackend {
    /// PTY backend (local terminals)
    pty_backend: Option<Arc<PtyBackend>>,
    /// SSH backend (remote terminals)
    ssh_backend: Option<Arc<SshBackend>>,
    /// Default backend type
    default_backend: BackendType,
}

impl UnifiedTerminalBackend {
    /// Create a new unified backend manager
    pub fn new(
        pty_adapter: Option<Arc<TerminalAdapter>>,
        default_backend: Option<BackendType>,
        ssh_data_tx: Option<tokio::sync::mpsc::UnboundedSender<crate::protocol::TerminalDataEvent>>,
        ssh_exit_tx: Option<tokio::sync::mpsc::UnboundedSender<crate::protocol::TerminalExitEvent>>,
    ) -> Self {
        let pty_backend = pty_adapter.map(|adapter| Arc::new(PtyBackend::new(adapter)));
        let ssh_backend = Some(Arc::new(SshBackend::new(ssh_data_tx, ssh_exit_tx)));
        let default_backend = default_backend.unwrap_or(BackendType::Pty);

        Self {
            pty_backend,
            ssh_backend,
            default_backend,
        }
    }

    /// Get backend by type
    pub fn get_backend(&self, backend_type: BackendType) -> Option<Arc<dyn TerminalBackend>> {
        match backend_type {
            BackendType::Pty => self.pty_backend.clone().map(|b| b as Arc<dyn TerminalBackend>),
            BackendType::Ssh => self.ssh_backend.clone().map(|b| b as Arc<dyn TerminalBackend>),
            BackendType::Local => None, // Not implemented yet
        }
    }

    /// Get default backend
    pub fn get_default_backend(&self) -> Option<Arc<dyn TerminalBackend>> {
        self.get_backend(self.default_backend)
    }

    /// Detect backend type from parameters
    ///
    /// Checks environment variables and parameters to determine the appropriate backend.
    pub fn detect_backend_type(params: &CreateTerminalParams) -> BackendType {
        // Check for SSH configuration in environment
        if params.env.contains_key("SSH_HOST") || params.env.contains_key("SSH_CONNECTION_ID") {
            return BackendType::Ssh;
        }

        // Check command for SSH indicators
        if params.command.starts_with("ssh ") || params.command.contains("@") {
            return BackendType::Ssh;
        }

        // Default to PTY
        BackendType::Pty
    }

    /// Create terminal using auto-detected backend
    pub async fn create_with_auto_detect(
        &self,
        params: CreateTerminalParams,
    ) -> Result<TerminalCreateResult, String> {
        let backend_type = Self::detect_backend_type(&params);
        let backend = self
            .get_backend(backend_type)
            .ok_or_else(|| format!("Backend {:?} not available", backend_type))?;
        backend.create(params).await
    }

    /// Route request to appropriate backend based on handle
    pub async fn route_request<F, R>(&self, handle: &TerminalHandle, f: F) -> Result<R, String>
    where
        F: FnOnce(Arc<dyn TerminalBackend>) -> std::pin::Pin<Box<dyn std::future::Future<Output = Result<R, String>> + Send>>,
    {
        let backend = self
            .get_backend(handle.backend)
            .ok_or_else(|| format!("Backend {:?} not available", handle.backend))?;
        f(backend).await
    }
}

/// Factory function to create a unified backend
pub fn create_unified_backend(
    pty_adapter: Option<Arc<TerminalAdapter>>,
    default_backend: Option<BackendType>,
    ssh_data_tx: Option<tokio::sync::mpsc::UnboundedSender<crate::protocol::TerminalDataEvent>>,
    ssh_exit_tx: Option<tokio::sync::mpsc::UnboundedSender<crate::protocol::TerminalExitEvent>>,
) -> UnifiedTerminalBackend {
    UnifiedTerminalBackend::new(pty_adapter, default_backend, ssh_data_tx, ssh_exit_tx)
}
