//! # Execution context and configuration
//!
//! This module provides the execution context for managing orchestration state,
//! including agent management, state tracking, execution traces, and event streaming.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::{mpsc, RwLock};

use crate::agent::{AgentInput, AgentOutput, AgentState};
use crate::tools::ToolResult;

/// Execution configuration for orchestrators
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutionConfig {
    /// Maximum time for entire orchestration
    #[serde(with = "duration_serde")]
    pub timeout: Duration,

    /// Maximum number of retries per agent
    pub max_retries: usize,

    /// Maximum parallel agent executions
    pub parallel_limit: usize,

    /// Enable detailed logging
    pub enable_logging: bool,

    /// Enable execution tracing
    pub enable_tracing: bool,

    /// Auto-approve permission requests
    pub auto_approve_permissions: bool,
}

mod duration_serde {
    use serde::{Deserialize, Deserializer, Serialize, Serializer};
    use std::time::Duration;

    pub fn serialize<S>(duration: &Duration, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        duration.as_millis().serialize(serializer)
    }

    pub fn deserialize<'de, D>(deserializer: D) -> Result<Duration, D::Error>
    where
        D: Deserializer<'de>,
    {
        let millis = u64::deserialize(deserializer)?;
        Ok(Duration::from_millis(millis))
    }
}

impl Default for ExecutionConfig {
    fn default() -> Self {
        Self {
            timeout: Duration::from_secs(300), // 5 minutes
            max_retries: 3,
            parallel_limit: 10,
            enable_logging: true,
            enable_tracing: true,
            auto_approve_permissions: true,
        }
    }
}

impl ExecutionConfig {
    /// Create a new execution config with default values
    pub fn new() -> Self {
        Self::default()
    }

    /// Set timeout
    pub fn with_timeout(mut self, timeout: Duration) -> Self {
        self.timeout = timeout;
        self
    }

    /// Set max retries
    pub fn with_max_retries(mut self, max_retries: usize) -> Self {
        self.max_retries = max_retries;
        self
    }

    /// Set parallel limit
    pub fn with_parallel_limit(mut self, parallel_limit: usize) -> Self {
        self.parallel_limit = parallel_limit;
        self
    }

    /// Enable logging
    pub fn with_logging(mut self, enable: bool) -> Self {
        self.enable_logging = enable;
        self
    }

    /// Enable tracing
    pub fn with_tracing(mut self, enable: bool) -> Self {
        self.enable_tracing = enable;
        self
    }

    /// Set auto-approve permissions
    pub fn with_auto_approve(mut self, auto_approve: bool) -> Self {
        self.auto_approve_permissions = auto_approve;
        self
    }
}

/// Execution trace for tracking orchestration runs
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutionTrace {
    /// Start time
    pub start_time: DateTime<Utc>,

    /// End time
    #[serde(skip_serializing_if = "Option::is_none")]
    pub end_time: Option<DateTime<Utc>>,

    /// Agent executions
    pub agent_executions: Vec<AgentExecution>,

    /// Tool executions
    pub tool_executions: Vec<ToolExecution>,

    /// Total execution duration in milliseconds
    #[serde(skip_serializing_if = "Option::is_none")]
    pub duration_ms: Option<u64>,
}

impl ExecutionTrace {
    /// Create a new execution trace
    pub fn new() -> Self {
        Self {
            start_time: Utc::now(),
            end_time: None,
            agent_executions: Vec::new(),
            tool_executions: Vec::new(),
            duration_ms: None,
        }
    }

    /// Add an agent execution record
    pub fn add_agent_execution(&mut self, execution: AgentExecution) {
        self.agent_executions.push(execution);
    }

    /// Add a tool execution record
    pub fn add_tool_execution(&mut self, execution: ToolExecution) {
        self.tool_executions.push(execution);
    }

    /// Mark the trace as complete
    pub fn complete(&mut self) {
        self.end_time = Some(Utc::now());
        self.duration_ms = Some(
            self.end_time
                .unwrap()
                .signed_duration_since(self.start_time)
                .num_milliseconds() as u64,
        );
    }

    /// Get total duration if completed
    pub fn duration(&self) -> Option<chrono::Duration> {
        self.duration_ms
            .map(|ms| chrono::Duration::milliseconds(ms as i64))
    }
}

impl Default for ExecutionTrace {
    fn default() -> Self {
        Self::new()
    }
}

/// Record of a single agent execution
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentExecution {
    /// Agent name
    pub agent_name: String,

    /// Agent role
    pub agent_role: String,

    /// Start time
    pub start_time: DateTime<Utc>,

    /// End time
    #[serde(skip_serializing_if = "Option::is_none")]
    pub end_time: Option<DateTime<Utc>>,

    /// Input to agent
    pub input: AgentInput,

    /// Output from agent
    #[serde(skip_serializing_if = "Option::is_none")]
    pub output: Option<AgentOutput>,

    /// Whether execution succeeded
    pub success: bool,

    /// Error message if failed
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,

    /// Execution duration in milliseconds
    #[serde(skip_serializing_if = "Option::is_none")]
    pub duration_ms: Option<u64>,
}

impl AgentExecution {
    /// Create a new agent execution record
    pub fn new(agent_name: impl Into<String>, agent_role: impl Into<String>, input: AgentInput) -> Self {
        Self {
            agent_name: agent_name.into(),
            agent_role: agent_role.into(),
            start_time: Utc::now(),
            end_time: None,
            input,
            output: None,
            success: false,
            error: None,
            duration_ms: None,
        }
    }

    /// Mark execution as successful with output
    pub fn succeed(&mut self, output: AgentOutput) {
        self.success = true;
        self.output = Some(output);
        self.end_time = Some(Utc::now());
        self.duration_ms = Some(
            self.end_time
                .unwrap()
                .signed_duration_since(self.start_time)
                .num_milliseconds() as u64,
        );
    }

    /// Mark execution as failed with error
    pub fn fail(&mut self, error: impl Into<String>) {
        self.success = false;
        self.error = Some(error.into());
        self.end_time = Some(Utc::now());
        self.duration_ms = Some(
            self.end_time
                .unwrap()
                .signed_duration_since(self.start_time)
                .num_milliseconds() as u64,
        );
    }
}

/// Record of a single tool execution
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolExecution {
    /// Tool name
    pub tool_name: String,

    /// Start time
    pub start_time: DateTime<Utc>,

    /// End time
    #[serde(skip_serializing_if = "Option::is_none")]
    pub end_time: Option<DateTime<Utc>>,

    /// Tool arguments
    pub args: serde_json::Value,

    /// Tool result
    #[serde(skip_serializing_if = "Option::is_none")]
    pub result: Option<ToolResult>,

    /// Execution duration in milliseconds
    #[serde(skip_serializing_if = "Option::is_none")]
    pub duration_ms: Option<u64>,
}

impl ToolExecution {
    /// Create a new tool execution record
    pub fn new(tool_name: impl Into<String>, args: serde_json::Value) -> Self {
        Self {
            tool_name: tool_name.into(),
            start_time: Utc::now(),
            end_time: None,
            args,
            result: None,
            duration_ms: None,
        }
    }

    /// Complete the execution with result
    pub fn complete(&mut self, result: ToolResult) {
        self.result = Some(result);
        self.end_time = Some(Utc::now());
        self.duration_ms = Some(
            self.end_time
                .unwrap()
                .signed_duration_since(self.start_time)
                .num_milliseconds() as u64,
        );
    }
}

/// Orchestration event types for real-time UI updates
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum OrchestrationEvent {
    /// Progress update
    Progress(ProgressEvent),
    /// Agent message
    AgentMessage(AgentMessageEvent),
    /// Tool use notification
    ToolUse(ToolUseEvent),
    /// Agent state change
    StateChange(StateChangeEvent),
    /// Orchestration complete
    Complete(CompleteEvent),
    /// Error occurred
    Error(ErrorEvent),
    /// Worker streaming content (for real-time display during execution)
    WorkerStream(WorkerStreamEvent),
    /// Token usage update
    Usage(UsageEvent),
}

impl OrchestrationEvent {
    /// Get event type name
    pub fn event_type(&self) -> &'static str {
        match self {
            Self::Progress(_) => "progress",
            Self::AgentMessage(_) => "agent_message",
            Self::ToolUse(_) => "tool_use",
            Self::StateChange(_) => "state_change",
            Self::Complete(_) => "complete",
            Self::Error(_) => "error",
            Self::WorkerStream(_) => "worker_stream",
            Self::Usage(_) => "usage",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProgressEvent {
    pub session_id: String,
    pub current_step: usize,
    pub total_steps: usize,
    pub current_round: usize,
    pub max_rounds: usize,
    pub current_action: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentMessageEvent {
    pub session_id: String,
    pub from_agent: String,
    pub to_agent: String,
    pub message_type: String, // "instruction", "report", "decision"
    pub content: String,
    pub timestamp: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ToolUseEvent {
    pub session_id: String,
    pub tool_name: String,
    pub status: String, // "start", "complete", "error"
    pub args: Option<serde_json::Value>,
    pub result: Option<String>,
    pub timestamp: DateTime<Utc>,
}

/// Worker streaming content event (for real-time display during execution)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkerStreamEvent {
    pub session_id: String,
    pub content: String, // Incremental content chunk
    pub is_complete: bool, // Whether this is the final chunk
    pub timestamp: DateTime<Utc>,
    pub from: Option<String>, // "worker" or "supervisor"
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StateChangeEvent {
    pub session_id: String,
    pub agent_name: String,
    pub old_state: AgentState,
    pub new_state: AgentState,
    pub timestamp: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CompleteEvent {
    pub session_id: String,
    pub success: bool,
    pub summary: String,
    pub duration_ms: u64,
    pub timestamp: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ErrorEvent {
    pub session_id: String,
    pub error: String,
    pub agent: Option<String>,
    pub recoverable: bool,
    pub timestamp: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UsageEvent {
    pub session_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub agent: Option<String>,
    pub prompt_tokens: u32,
    pub completion_tokens: u32,
    pub total_tokens: u32,
    pub timestamp: DateTime<Utc>,
}

/// Execution context for managing orchestration state
pub struct ExecutionContext {
    /// Session ID
    pub session_id: String,

    /// Configuration
    config: ExecutionConfig,

    /// State storage
    state: Arc<RwLock<HashMap<String, serde_json::Value>>>,

    /// Execution trace
    trace: Arc<RwLock<ExecutionTrace>>,

    /// Event sender for real-time updates
    event_sender: Option<mpsc::UnboundedSender<OrchestrationEvent>>,
}

impl ExecutionContext {
    /// Create a new execution context
    pub fn new(session_id: impl Into<String>, config: ExecutionConfig) -> Self {
        Self {
            session_id: session_id.into(),
            config,
            state: Arc::new(RwLock::new(HashMap::new())),
            trace: Arc::new(RwLock::new(ExecutionTrace::new())),
            event_sender: None,
        }
    }

    /// Set event sender for real-time updates
    pub fn with_event_sender(mut self, sender: mpsc::UnboundedSender<OrchestrationEvent>) -> Self {
        self.event_sender = Some(sender);
        self
    }

    /// Get configuration
    pub fn config(&self) -> &ExecutionConfig {
        &self.config
    }

    /// Get state value
    pub async fn get_state(&self, key: &str) -> Option<serde_json::Value> {
        let state = self.state.read().await;
        state.get(key).cloned()
    }

    /// Set state value
    pub async fn set_state(&self, key: impl Into<String>, value: serde_json::Value) {
        let mut state = self.state.write().await;
        state.insert(key.into(), value);
    }

    /// Remove state value
    pub async fn remove_state(&self, key: &str) -> Option<serde_json::Value> {
        let mut state = self.state.write().await;
        state.remove(key)
    }

    /// Clear all state
    pub async fn clear_state(&self) {
        let mut state = self.state.write().await;
        state.clear();
    }

    /// Get execution trace
    pub async fn get_trace(&self) -> ExecutionTrace {
        self.trace.read().await.clone()
    }

    /// Add agent execution to trace
    pub async fn add_agent_execution(&self, execution: AgentExecution) {
        let mut trace = self.trace.write().await;
        trace.add_agent_execution(execution);
    }

    /// Add tool execution to trace
    pub async fn add_tool_execution(&self, execution: ToolExecution) {
        let mut trace = self.trace.write().await;
        trace.add_tool_execution(execution);
    }

    /// Complete execution trace
    pub async fn complete_trace(&self) {
        let mut trace = self.trace.write().await;
        trace.complete();
    }

    /// Check if logging is enabled
    pub fn is_logging_enabled(&self) -> bool {
        self.config.enable_logging
    }

    /// Check if tracing is enabled
    pub fn is_tracing_enabled(&self) -> bool {
        self.config.enable_tracing
    }

    /// Emit an event
    pub fn emit_event(&self, event: OrchestrationEvent) {
        if let Some(sender) = &self.event_sender {
            let _ = sender.send(event);
        }
    }

    /// Emit a progress event
    pub fn emit_progress(&self, current_step: usize, total_steps: usize, current_round: usize, max_rounds: usize, action: impl Into<String>) {
        self.emit_event(OrchestrationEvent::Progress(ProgressEvent {
            session_id: self.session_id.clone(),
            current_step,
            total_steps,
            current_round,
            max_rounds,
            current_action: action.into(),
        }));
    }

    /// Emit an agent message event
    pub fn emit_agent_message(&self, from: impl Into<String>, to: impl Into<String>, msg_type: impl Into<String>, content: impl Into<String>) {
        self.emit_event(OrchestrationEvent::AgentMessage(AgentMessageEvent {
            session_id: self.session_id.clone(),
            from_agent: from.into(),
            to_agent: to.into(),
            message_type: msg_type.into(),
            content: content.into(),
            timestamp: Utc::now(),
        }));
    }

    /// Emit a tool use event
    pub fn emit_tool_use(&self, tool: impl Into<String>, status: impl Into<String>, args: Option<serde_json::Value>, result: Option<String>) {
        self.emit_event(OrchestrationEvent::ToolUse(ToolUseEvent {
            session_id: self.session_id.clone(),
            tool_name: tool.into(),
            status: status.into(),
            args,
            result,
            timestamp: Utc::now(),
        }));
    }

    /// Emit worker streaming content (for real-time display)
    pub fn emit_worker_stream(&self, content: impl Into<String>, is_complete: bool) {
        self.emit_event(OrchestrationEvent::WorkerStream(WorkerStreamEvent {
            session_id: self.session_id.clone(),
            content: content.into(),
            is_complete,
            timestamp: Utc::now(),
            from: Some("worker".to_string()),
        }));
    }

    /// Emit an error event
    pub fn emit_error(&self, error: impl Into<String>, agent: Option<String>, recoverable: bool) {
        self.emit_event(OrchestrationEvent::Error(ErrorEvent {
            session_id: self.session_id.clone(),
            error: error.into(),
            agent,
            recoverable,
            timestamp: Utc::now(),
        }));
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_execution_config() {
        let config = ExecutionConfig::new()
            .with_timeout(Duration::from_secs(60))
            .with_max_retries(5)
            .with_parallel_limit(20)
            .with_logging(false)
            .with_tracing(false);

        assert_eq!(config.timeout.as_secs(), 60);
        assert_eq!(config.max_retries, 5);
        assert_eq!(config.parallel_limit, 20);
        assert!(!config.enable_logging);
        assert!(!config.enable_tracing);
    }

    #[tokio::test]
    async fn test_execution_context() {
        let config = ExecutionConfig::new();
        let ctx = ExecutionContext::new("session-123", config);

        // Test state management
        ctx.set_state("key1", serde_json::json!("value1")).await;
        assert_eq!(
            ctx.get_state("key1").await,
            Some(serde_json::json!("value1"))
        );

        ctx.set_state("key2", serde_json::json!(42)).await;
        assert_eq!(ctx.get_state("key2").await, Some(serde_json::json!(42)));

        assert_eq!(
            ctx.remove_state("key1").await,
            Some(serde_json::json!("value1"))
        );
        assert!(ctx.get_state("key1").await.is_none());

        ctx.clear_state().await;
        assert!(ctx.get_state("key2").await.is_none());
    }

    #[test]
    fn test_execution_trace() {
        let mut trace = ExecutionTrace::new();
        assert!(trace.end_time.is_none());
        assert!(trace.duration_ms.is_none());

        trace.complete();
        assert!(trace.end_time.is_some());
        assert!(trace.duration_ms.is_some());
    }

    #[test]
    fn test_agent_execution() {
        let input = AgentInput::new("test");
        let mut exec = AgentExecution::new("TestAgent", "worker", input);

        assert!(!exec.success);
        assert!(exec.output.is_none());
        assert!(exec.end_time.is_none());

        let output = AgentOutput::new("result").with_confidence(0.9);
        exec.succeed(output);

        assert!(exec.success);
        assert!(exec.output.is_some());
        assert!(exec.end_time.is_some());
        assert!(exec.duration_ms.is_some());
    }
}
