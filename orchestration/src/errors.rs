//! Error types for the orchestration framework

use thiserror::Error;

/// Result type for orchestration operations
pub type Result<T> = std::result::Result<T, OrchestrationError>;

/// Errors that can occur during orchestration
#[derive(Debug, Error)]
pub enum OrchestrationError {
    /// Agent execution failed
    #[error("Agent '{agent}' failed: {message}")]
    AgentFailure { agent: String, message: String },

    /// Tool execution failed
    #[error("Tool '{tool}' failed: {message}")]
    ToolFailure { tool: String, message: String },

    /// Invalid configuration
    #[error("Invalid configuration: {0}")]
    InvalidConfig(String),

    /// Session not found
    #[error("Session not found: {0}")]
    SessionNotFound(String),

    /// Session already exists
    #[error("Session already exists: {0}")]
    SessionAlreadyExists(String),

    /// Operation timeout
    #[error("Operation timed out after {duration_ms}ms")]
    Timeout { duration_ms: u64 },

    /// Operation was aborted
    #[error("Operation was aborted: {reason}")]
    Aborted { reason: String },

    /// Maximum rounds exceeded
    #[error("Maximum rounds ({max_rounds}) exceeded")]
    MaxRoundsExceeded { max_rounds: usize },

    /// Permission denied
    #[error("Permission denied: {0}")]
    PermissionDenied(String),

    /// Verification failed
    #[error("Verification failed: {0}")]
    VerificationFailed(String),

    /// Serialization error
    #[error("Serialization error: {0}")]
    SerializationError(String),

    /// Internal error
    #[error("Internal error: {0}")]
    Internal(String),

    /// Other error
    #[error("{0}")]
    Other(#[from] anyhow::Error),
}

impl OrchestrationError {
    /// Create an agent failure error
    pub fn agent_failure(agent: impl Into<String>, message: impl Into<String>) -> Self {
        Self::AgentFailure {
            agent: agent.into(),
            message: message.into(),
        }
    }

    /// Create a tool failure error
    pub fn tool_failure(tool: impl Into<String>, message: impl Into<String>) -> Self {
        Self::ToolFailure {
            tool: tool.into(),
            message: message.into(),
        }
    }

    /// Create an invalid config error
    pub fn invalid_config(message: impl Into<String>) -> Self {
        Self::InvalidConfig(message.into())
    }

    /// Create a timeout error
    pub fn timeout(duration_ms: u64) -> Self {
        Self::Timeout { duration_ms }
    }

    /// Create an aborted error
    pub fn aborted(reason: impl Into<String>) -> Self {
        Self::Aborted {
            reason: reason.into(),
        }
    }
}
