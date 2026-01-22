//! # Agent trait and core types
//!
//! This module defines the core Agent trait and associated types for the
//! multi-agent orchestration framework.

use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;

use crate::errors::Result;
use crate::tools::ToolExecutor;

/// Input to an agent
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentInput {
    /// Main content/prompt for the agent
    pub content: String,

    /// Additional context data (JSON-serializable)
    #[serde(default)]
    pub context: serde_json::Value,

    /// Metadata key-value pairs
    #[serde(default)]
    pub metadata: HashMap<String, String>,
}

impl AgentInput {
    /// Create a new agent input with content
    pub fn new(content: impl Into<String>) -> Self {
        Self {
            content: content.into(),
            context: serde_json::json!({}),
            metadata: HashMap::new(),
        }
    }

    /// Add context data
    pub fn with_context(mut self, context: serde_json::Value) -> Self {
        self.context = context;
        self
    }

    /// Add metadata
    pub fn with_metadata(mut self, key: impl Into<String>, value: impl Into<String>) -> Self {
        self.metadata.insert(key.into(), value.into());
        self
    }

    /// Merge additional context into existing context
    pub fn merge_context(&mut self, additional: serde_json::Value) {
        if let (serde_json::Value::Object(existing), serde_json::Value::Object(new)) =
            (&mut self.context, additional)
        {
            for (k, v) in new {
                existing.insert(k, v);
            }
        }
    }
}

/// Output from an agent
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentOutput {
    /// Main response content
    pub content: String,

    /// Additional data (JSON-serializable)
    #[serde(default)]
    pub data: serde_json::Value,

    /// Confidence score (0.0 - 1.0)
    pub confidence: f64,

    /// Metadata key-value pairs
    #[serde(default)]
    pub metadata: HashMap<String, String>,
}

impl AgentOutput {
    /// Create a new agent output with content
    pub fn new(content: impl Into<String>) -> Self {
        Self {
            content: content.into(),
            data: serde_json::json!({}),
            confidence: 1.0,
            metadata: HashMap::new(),
        }
    }

    /// Set confidence score
    pub fn with_confidence(mut self, confidence: f64) -> Self {
        self.confidence = confidence.clamp(0.0, 1.0);
        self
    }

    /// Add data
    pub fn with_data(mut self, data: serde_json::Value) -> Self {
        self.data = data;
        self
    }

    /// Add metadata
    pub fn with_metadata(mut self, key: impl Into<String>, value: impl Into<String>) -> Self {
        self.metadata.insert(key.into(), value.into());
        self
    }

    /// Check if output is successful (confidence > 0.5)
    pub fn is_successful(&self) -> bool {
        self.confidence > 0.5
    }
}

impl Default for AgentOutput {
    fn default() -> Self {
        Self::new("")
    }
}

/// Core Agent trait
///
/// Agents implement this trait to participate in orchestration.
/// Each agent has a name, description, and execution logic.
#[async_trait]
pub trait Agent: Send + Sync {
    /// Agent name (must be unique within an orchestration)
    fn name(&self) -> &str;

    /// Agent description (what it does)
    fn description(&self) -> &str;

    /// Agent role (e.g., "supervisor", "worker")
    fn role(&self) -> &str {
        "agent"
    }

    /// Execute the agent's logic
    ///
    /// Takes input and a tool executor, produces output asynchronously.
    /// The tool executor is injected to allow the agent to use tools
    /// in both local (Tauri) and remote (WebSocket) environments.
    async fn execute(
        &self,
        input: AgentInput,
        tool_executor: Arc<dyn ToolExecutor>,
    ) -> Result<AgentOutput>;
}

/// Agent state
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum AgentState {
    /// Agent is idle, waiting for work
    Idle,
    /// Agent is running
    Running,
    /// Agent is waiting for another agent
    Waiting,
    /// Agent has completed its task
    Completed,
    /// Agent encountered an error
    Error,
}

impl Default for AgentState {
    fn default() -> Self {
        Self::Idle
    }
}

impl std::fmt::Display for AgentState {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Idle => write!(f, "idle"),
            Self::Running => write!(f, "running"),
            Self::Waiting => write!(f, "waiting"),
            Self::Completed => write!(f, "completed"),
            Self::Error => write!(f, "error"),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_agent_input_creation() {
        let input = AgentInput::new("test content")
            .with_context(serde_json::json!({"key": "value"}))
            .with_metadata("meta1", "value1");

        assert_eq!(input.content, "test content");
        assert_eq!(input.context["key"], "value");
        assert_eq!(input.metadata["meta1"], "value1");
    }

    #[test]
    fn test_agent_output_creation() {
        let output = AgentOutput::new("test response")
            .with_confidence(0.8)
            .with_data(serde_json::json!({"result": 42}))
            .with_metadata("meta1", "value1");

        assert_eq!(output.content, "test response");
        assert_eq!(output.confidence, 0.8);
        assert_eq!(output.data["result"], 42);
        assert_eq!(output.metadata["meta1"], "value1");
        assert!(output.is_successful());
    }

    #[test]
    fn test_agent_output_confidence_clamp() {
        let output = AgentOutput::new("test").with_confidence(1.5);
        assert_eq!(output.confidence, 1.0);

        let output = AgentOutput::new("test").with_confidence(-0.5);
        assert_eq!(output.confidence, 0.0);
    }

    #[test]
    fn test_agent_state_display() {
        assert_eq!(AgentState::Idle.to_string(), "idle");
        assert_eq!(AgentState::Running.to_string(), "running");
        assert_eq!(AgentState::Completed.to_string(), "completed");
    }
}
