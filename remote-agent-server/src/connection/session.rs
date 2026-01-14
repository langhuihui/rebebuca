//! Client session management

use tokio::sync::mpsc::UnboundedSender;

use crate::protocol::OutgoingMessage;

/// Represents a connected client session
#[derive(Debug)]
pub struct ClientSession {
    /// Unique client ID
    #[allow(dead_code)]
    pub client_id: String,
    /// WebSocket sender for this client
    pub ws_sender: Option<UnboundedSender<OutgoingMessage>>,
    /// Active PTY IDs owned by this session
    pub pty_ids: Vec<String>,
    /// Whether this is a read-only session
    #[allow(dead_code)]
    pub is_read_only: bool,
    /// Session creation timestamp
    #[allow(dead_code)]
    pub created_at: u64,
}

impl ClientSession {
    pub fn new(client_id: String) -> Self {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs();

        Self {
            client_id,
            ws_sender: None,
            pty_ids: Vec::new(),
            is_read_only: false,
            created_at: now,
        }
    }

    /// Set the WebSocket sender
    pub fn set_ws_sender(&mut self, sender: UnboundedSender<OutgoingMessage>) {
        self.ws_sender = Some(sender);
    }

    /// Send a message to this client
    pub fn send(&self, message: OutgoingMessage) -> Result<(), String> {
        if let Some(sender) = &self.ws_sender {
            sender
                .send(message)
                .map_err(|e| format!("Failed to send message: {}", e))
        } else {
            Err("No WebSocket connection".to_string())
        }
    }

    /// Add a PTY to this session
    pub fn add_pty(&mut self, pty_id: String) {
        self.pty_ids.push(pty_id);
    }

    /// Remove a PTY from this session
    pub fn remove_pty(&mut self, pty_id: &str) {
        self.pty_ids.retain(|id| id != pty_id);
    }

    /// Check if this session owns a PTY
    #[allow(dead_code)]
    pub fn owns_pty(&self, pty_id: &str) -> bool {
        self.pty_ids.contains(&pty_id.to_string())
    }

    /// Cleanup session resources
    pub fn cleanup(&mut self) {
        self.ws_sender = None;
        self.pty_ids.clear();
    }
}
