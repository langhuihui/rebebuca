//! Orchestration module for Remote Agent Server
//!
//! This module provides orchestration capabilities for the web frontend,
//! using the existing adapters (Terminal, FileSystem) for tool execution.

mod executor;

pub use executor::RemoteToolExecutor;

use rebebuca_orchestration::{
    context::OrchestrationEvent,
};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::{mpsc, RwLock};

use crate::adapters::{FileSystemAdapter, TerminalAdapter};
use crate::protocol::{Event, OutgoingMessage};

/// Orchestration session for remote server
pub struct RemoteOrchestrationSession {
    pub id: String,
    pub config: OrchestrationConfig,
    pub tool_executor: Arc<RemoteToolExecutor>,
    state: SessionState,
    event_tx: Option<mpsc::UnboundedSender<OutgoingMessage>>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SessionState {
    Idle,
    Running,
    Completed,
    Error,
}

/// Orchestration configuration from frontend
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OrchestrationConfig {
    pub project_path: String,
    pub supervisor_provider: ProviderConfig,
    pub worker_provider: ProviderConfig,
    pub max_rounds: Option<usize>,
    pub auto_approve_permissions: Option<bool>,
}

/// Provider configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderConfig {
    pub provider: String,
    pub model: String,
    pub api_key: Option<String>,
    pub base_url: Option<String>,
}

/// Orchestration status response
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OrchestrationStatus {
    pub session_id: String,
    pub status: String,
    pub current_round: usize,
    pub max_rounds: usize,
    pub current_action: String,
}

/// Session manager for remote server
pub struct RemoteSessionManager {
    sessions: RwLock<HashMap<String, Arc<RwLock<RemoteOrchestrationSession>>>>,
}

impl RemoteSessionManager {
    pub fn new() -> Self {
        Self {
            sessions: RwLock::new(HashMap::new()),
        }
    }

    pub async fn create_session(
        &self,
        config: OrchestrationConfig,
        terminal_adapter: Arc<TerminalAdapter>,
        fs_adapter: Arc<FileSystemAdapter>,
    ) -> String {
        let session_id = uuid::Uuid::new_v4().to_string();

        let executor = RemoteToolExecutor::new(
            terminal_adapter,
            fs_adapter,
            &config.project_path,
            &session_id,
        );

        let session = RemoteOrchestrationSession {
            id: session_id.clone(),
            config,
            tool_executor: Arc::new(executor),
            state: SessionState::Idle,
            event_tx: None,
        };

        let mut sessions = self.sessions.write().await;
        sessions.insert(session_id.clone(), Arc::new(RwLock::new(session)));

        session_id
    }

    pub async fn get_session(
        &self,
        id: &str,
    ) -> Option<Arc<RwLock<RemoteOrchestrationSession>>> {
        let sessions = self.sessions.read().await;
        sessions.get(id).cloned()
    }

    pub async fn remove_session(&self, id: &str) {
        let mut sessions = self.sessions.write().await;
        sessions.remove(id);
    }
}

impl Default for RemoteSessionManager {
    fn default() -> Self {
        Self::new()
    }
}

/// Helper to emit orchestration events via WebSocket
pub fn emit_orchestration_event(
    tx: &mpsc::UnboundedSender<OutgoingMessage>,
    event: OrchestrationEvent,
) {
    let event_name = format!("orchestration.{}", event.event_type());
    let ws_event = Event::new(event_name, &event);
    let _ = tx.send(OutgoingMessage::Event(ws_event));
}
