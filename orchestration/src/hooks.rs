//! # Hooks System
//!
//! This module provides hooks for intercepting and customizing orchestration behavior.
//! Hooks can be used to:
//! - Monitor tool usage
//! - Implement permission policies
//! - Add logging/metrics
//! - Customize agent behavior

use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use std::sync::Arc;

use crate::agent::AgentOutput;
use crate::tools::{ToolDefinition, ToolResult};

/// Hook events that can be intercepted
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum HookEvent {
    /// Before tool execution
    PreToolUse,
    /// After tool execution
    PostToolUse,
    /// Before agent execution
    PreAgentExecute,
    /// After agent execution
    PostAgentExecute,
    /// When orchestration starts
    OrchestrationStart,
    /// When orchestration ends
    OrchestrationEnd,
    /// When an error occurs
    OnError,
}

/// Context passed to hook handlers
#[derive(Debug, Clone)]
pub struct HookContext {
    /// Session ID
    pub session_id: String,
    /// Current agent name (if applicable)
    pub agent_name: Option<String>,
    /// Current tool name (if applicable)
    pub tool_name: Option<String>,
    /// Additional data
    pub data: serde_json::Value,
}

impl HookContext {
    pub fn new(session_id: impl Into<String>) -> Self {
        Self {
            session_id: session_id.into(),
            agent_name: None,
            tool_name: None,
            data: serde_json::json!({}),
        }
    }

    pub fn with_agent(mut self, agent: impl Into<String>) -> Self {
        self.agent_name = Some(agent.into());
        self
    }

    pub fn with_tool(mut self, tool: impl Into<String>) -> Self {
        self.tool_name = Some(tool.into());
        self
    }

    pub fn with_data(mut self, data: serde_json::Value) -> Self {
        self.data = data;
        self
    }
}

/// Result of a hook handler
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HookResult {
    /// Whether to continue with the operation
    pub continue_execution: bool,
    /// Modified data (for pre-hooks)
    pub modified_data: Option<serde_json::Value>,
    /// Message/reason
    pub message: Option<String>,
}

impl HookResult {
    /// Continue execution
    pub fn continue_() -> Self {
        Self {
            continue_execution: true,
            modified_data: None,
            message: None,
        }
    }

    /// Stop execution
    pub fn stop(message: impl Into<String>) -> Self {
        Self {
            continue_execution: false,
            modified_data: None,
            message: Some(message.into()),
        }
    }

    /// Continue with modified data
    pub fn modify(data: serde_json::Value) -> Self {
        Self {
            continue_execution: true,
            modified_data: Some(data),
            message: None,
        }
    }
}

impl Default for HookResult {
    fn default() -> Self {
        Self::continue_()
    }
}

/// Hook handler trait
#[async_trait]
pub trait HookHandler: Send + Sync {
    /// Handle a hook event
    async fn handle(&self, event: HookEvent, context: HookContext) -> HookResult;

    /// Get the events this handler is interested in
    fn events(&self) -> Vec<HookEvent>;
}

/// Pre-tool-use hook input
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PreToolUseInput {
    pub tool: ToolDefinition,
    pub args: serde_json::Value,
}

/// Post-tool-use hook input
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PostToolUseInput {
    pub tool_name: String,
    pub args: serde_json::Value,
    pub result: ToolResult,
}

/// Pre-agent-execute hook input
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PreAgentInput {
    pub agent_name: String,
    pub input_content: String,
}

/// Post-agent-execute hook input
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PostAgentInput {
    pub agent_name: String,
    pub output: AgentOutput,
}

/// Hooks manager for an orchestration
pub struct Hooks {
    handlers: Vec<Arc<dyn HookHandler>>,
}

impl Hooks {
    /// Create a new hooks manager
    pub fn new() -> Self {
        Self {
            handlers: Vec::new(),
        }
    }

    /// Add a hook handler
    pub fn add_handler(&mut self, handler: Arc<dyn HookHandler>) {
        self.handlers.push(handler);
    }

    /// Trigger a hook event
    pub async fn trigger(&self, event: HookEvent, context: HookContext) -> HookResult {
        for handler in &self.handlers {
            if handler.events().contains(&event) {
                let result = handler.handle(event, context.clone()).await;
                if !result.continue_execution {
                    return result;
                }
            }
        }
        HookResult::continue_()
    }

    /// Check if any handlers are registered for an event
    pub fn has_handlers_for(&self, event: HookEvent) -> bool {
        self.handlers.iter().any(|h| h.events().contains(&event))
    }
}

impl Default for Hooks {
    fn default() -> Self {
        Self::new()
    }
}

/// Logging hook handler - logs all events
pub struct LoggingHook {
    log_level: tracing::Level,
}

impl LoggingHook {
    pub fn new(level: tracing::Level) -> Self {
        Self { log_level: level }
    }
}

#[async_trait]
impl HookHandler for LoggingHook {
    async fn handle(&self, event: HookEvent, context: HookContext) -> HookResult {
        match self.log_level {
            tracing::Level::DEBUG => {
                tracing::debug!(
                    event = ?event,
                    session = %context.session_id,
                    agent = ?context.agent_name,
                    tool = ?context.tool_name,
                    "Hook event"
                );
            }
            tracing::Level::INFO => {
                tracing::info!(
                    event = ?event,
                    session = %context.session_id,
                    "Hook event"
                );
            }
            _ => {}
        }
        HookResult::continue_()
    }

    fn events(&self) -> Vec<HookEvent> {
        vec![
            HookEvent::PreToolUse,
            HookEvent::PostToolUse,
            HookEvent::PreAgentExecute,
            HookEvent::PostAgentExecute,
            HookEvent::OrchestrationStart,
            HookEvent::OrchestrationEnd,
            HookEvent::OnError,
        ]
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    struct TestHook {
        should_stop: bool,
    }

    #[async_trait]
    impl HookHandler for TestHook {
        async fn handle(&self, _event: HookEvent, _context: HookContext) -> HookResult {
            if self.should_stop {
                HookResult::stop("Test stop")
            } else {
                HookResult::continue_()
            }
        }

        fn events(&self) -> Vec<HookEvent> {
            vec![HookEvent::PreToolUse]
        }
    }

    #[tokio::test]
    async fn test_hooks_continue() {
        let mut hooks = Hooks::new();
        hooks.add_handler(Arc::new(TestHook { should_stop: false }));

        let context = HookContext::new("session-123").with_tool("read");
        let result = hooks.trigger(HookEvent::PreToolUse, context).await;

        assert!(result.continue_execution);
    }

    #[tokio::test]
    async fn test_hooks_stop() {
        let mut hooks = Hooks::new();
        hooks.add_handler(Arc::new(TestHook { should_stop: true }));

        let context = HookContext::new("session-123").with_tool("bash");
        let result = hooks.trigger(HookEvent::PreToolUse, context).await;

        assert!(!result.continue_execution);
        assert_eq!(result.message, Some("Test stop".to_string()));
    }

    #[tokio::test]
    async fn test_hooks_no_handler() {
        let hooks = Hooks::new();
        let context = HookContext::new("session-123");
        let result = hooks.trigger(HookEvent::PreToolUse, context).await;

        assert!(result.continue_execution);
    }
}
