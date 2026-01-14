//! Connection table for managing client sessions
//!
//! Inspired by Zellij's ConnectionTable implementation

use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::{mpsc::UnboundedSender, RwLock};

use super::session::ClientSession;
use crate::protocol::OutgoingMessage;

/// Connection table managing all client sessions
#[derive(Debug, Default)]
pub struct ConnectionTable {
    /// Map of client ID to session
    sessions: HashMap<String, ClientSession>,
    /// Map of PTY ID to client ID (for routing events)
    pty_to_client: HashMap<String, String>,
}

impl ConnectionTable {
    pub fn new() -> Self {
        Self {
            sessions: HashMap::new(),
            pty_to_client: HashMap::new(),
        }
    }

    /// Create a new client session
    pub fn create_session(&mut self, client_id: String) -> &mut ClientSession {
        let session = ClientSession::new(client_id.clone());
        self.sessions.insert(client_id.clone(), session);
        self.sessions.get_mut(&client_id).unwrap()
    }

    /// Get a session by client ID
    #[allow(dead_code)]
    pub fn get_session(&self, client_id: &str) -> Option<&ClientSession> {
        self.sessions.get(client_id)
    }

    /// Get a mutable session by client ID
    #[allow(dead_code)]
    pub fn get_session_mut(&mut self, client_id: &str) -> Option<&mut ClientSession> {
        self.sessions.get_mut(client_id)
    }

    /// Set WebSocket sender for a session
    pub fn set_ws_sender(&mut self, client_id: &str, sender: UnboundedSender<OutgoingMessage>) {
        if let Some(session) = self.sessions.get_mut(client_id) {
            session.set_ws_sender(sender);
        }
    }

    /// Register a PTY with a client
    pub fn register_pty(&mut self, client_id: &str, pty_id: String) {
        self.pty_to_client.insert(pty_id.clone(), client_id.to_string());
        if let Some(session) = self.sessions.get_mut(client_id) {
            session.add_pty(pty_id);
        }
    }

    /// Unregister a PTY
    pub fn unregister_pty(&mut self, pty_id: &str) {
        if let Some(client_id) = self.pty_to_client.remove(pty_id) {
            if let Some(session) = self.sessions.get_mut(&client_id) {
                session.remove_pty(pty_id);
            }
        }
    }

    /// Get the client ID that owns a PTY
    #[allow(dead_code)]
    pub fn get_pty_owner(&self, pty_id: &str) -> Option<&String> {
        self.pty_to_client.get(pty_id)
    }

    /// Send a message to a specific client
    pub fn send_to_client(&self, client_id: &str, message: OutgoingMessage) -> Result<(), String> {
        if let Some(session) = self.sessions.get(client_id) {
            session.send(message)
        } else {
            Err(format!("Client {} not found", client_id))
        }
    }

    /// Send a message to the owner of a PTY
    pub fn send_to_pty_owner(&self, pty_id: &str, message: OutgoingMessage) -> Result<(), String> {
        if let Some(client_id) = self.pty_to_client.get(pty_id) {
            self.send_to_client(client_id, message)
        } else {
            Err(format!("PTY {} has no owner", pty_id))
        }
    }

    /// Remove a client session
    pub fn remove_session(&mut self, client_id: &str) -> Option<ClientSession> {
        if let Some(mut session) = self.sessions.remove(client_id) {
            // Remove all PTYs owned by this session
            for pty_id in &session.pty_ids {
                self.pty_to_client.remove(pty_id);
            }
            session.cleanup();
            Some(session)
        } else {
            None
        }
    }

    /// Get all PTY IDs owned by a client
    pub fn get_client_ptys(&self, client_id: &str) -> Vec<String> {
        self.sessions
            .get(client_id)
            .map(|s| s.pty_ids.clone())
            .unwrap_or_default()
    }

    /// Check if a client exists
    #[allow(dead_code)]
    pub fn has_client(&self, client_id: &str) -> bool {
        self.sessions.contains_key(client_id)
    }

    /// Get the number of connected clients
    #[allow(dead_code)]
    pub fn client_count(&self) -> usize {
        self.sessions.len()
    }
}

/// Thread-safe connection table wrapper
pub type SharedConnectionTable = Arc<RwLock<ConnectionTable>>;

/// Create a new shared connection table
pub fn create_shared_connection_table() -> SharedConnectionTable {
    Arc::new(RwLock::new(ConnectionTable::new()))
}
