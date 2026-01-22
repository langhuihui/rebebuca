//! # Orchestrator trait and core types
//!
//! This module defines the Orchestrator trait which coordinates multiple agents
//! to accomplish complex tasks through various patterns.

use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;

use crate::agent::{Agent, AgentOutput};
use crate::context::ExecutionTrace;
use crate::errors::Result;
use crate::tools::ToolExecutor;

/// Input to an orchestrator
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OrchestratorInput {
    /// Main content/prompt for the orchestration
    pub content: String,

    /// Additional context data (JSON-serializable)
    #[serde(default)]
    pub context: serde_json::Value,

    /// Metadata key-value pairs
    #[serde(default)]
    pub metadata: HashMap<String, String>,
}

impl OrchestratorInput {
    /// Create a new orchestrator input
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
}

/// Output from an orchestrator
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OrchestratorOutput {
    /// Final result of orchestration
    pub result: String,

    /// Individual agent outputs (in execution order)
    pub agent_outputs: Vec<AgentOutput>,

    /// Execution trace
    pub execution_trace: ExecutionTrace,

    /// Whether orchestration succeeded
    pub success: bool,

    /// Error message if failed
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

impl OrchestratorOutput {
    /// Create a successful output
    pub fn success(
        result: impl Into<String>,
        agent_outputs: Vec<AgentOutput>,
        execution_trace: ExecutionTrace,
    ) -> Self {
        Self {
            result: result.into(),
            agent_outputs,
            execution_trace,
            success: true,
            error: None,
        }
    }

    /// Create a failed output
    pub fn failure(error: impl Into<String>, execution_trace: ExecutionTrace) -> Self {
        Self {
            result: String::new(),
            agent_outputs: Vec::new(),
            execution_trace,
            success: false,
            error: Some(error.into()),
        }
    }

    /// Check if orchestration succeeded
    pub fn is_successful(&self) -> bool {
        self.success
    }
}

/// Core Orchestrator trait
///
/// Orchestrators implement this trait to coordinate multiple agents
/// in various patterns (sequential, parallel, supervisor-worker, etc.).
#[async_trait]
pub trait Orchestrator: Send + Sync {
    /// Orchestrator name (must be unique)
    fn name(&self) -> &str;

    /// Orchestrator description (what pattern it uses)
    fn description(&self) -> &str;

    /// Execute orchestration with the provided agents and input
    ///
    /// # Arguments
    /// * `agents` - List of agents to orchestrate
    /// * `input` - Orchestration input
    /// * `tool_executor` - Tool executor for agents to use
    ///
    /// # Returns
    /// * `Ok(OrchestratorOutput)` - Orchestration result
    /// * `Err` - If orchestration fails
    async fn orchestrate(
        &self,
        agents: Vec<Arc<dyn Agent>>,
        input: OrchestratorInput,
        tool_executor: Arc<dyn ToolExecutor>,
    ) -> Result<OrchestratorOutput>;
}

/// Task goal for supervisor-worker pattern
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskGoal {
    /// Task objective description
    pub objective: String,

    /// Task display name (optional)
    #[serde(rename = "taskName", default, skip_serializing_if = "Option::is_none")]
    pub task_name: Option<String>,

    /// Acceptance criteria (what defines success)
    #[serde(rename = "acceptanceCriteria", default)]
    pub acceptance_criteria: Vec<String>,

    /// Optional context information
    #[serde(skip_serializing_if = "Option::is_none")]
    pub context: Option<String>,

    /// Optional constraints
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub constraints: Vec<String>,
}

impl TaskGoal {
    /// Create a new task goal
    pub fn new(objective: impl Into<String>) -> Self {
        Self {
            objective: objective.into(),
            task_name: None,
            acceptance_criteria: Vec::new(),
            context: None,
            constraints: Vec::new(),
        }
    }

    /// Add acceptance criterion
    pub fn with_criterion(mut self, criterion: impl Into<String>) -> Self {
        self.acceptance_criteria.push(criterion.into());
        self
    }

    /// Add multiple acceptance criteria
    pub fn with_criteria(mut self, criteria: Vec<String>) -> Self {
        self.acceptance_criteria.extend(criteria);
        self
    }

    /// Set context
    pub fn with_context(mut self, context: impl Into<String>) -> Self {
        self.context = Some(context.into());
        self
    }

    /// Add constraint
    pub fn with_constraint(mut self, constraint: impl Into<String>) -> Self {
        self.constraints.push(constraint.into());
        self
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_orchestrator_input() {
        let input = OrchestratorInput::new("Test content")
            .with_context(serde_json::json!({"key": "value"}))
            .with_metadata("meta1", "value1");

        assert_eq!(input.content, "Test content");
        assert_eq!(input.context["key"], "value");
        assert_eq!(input.metadata["meta1"], "value1");
    }

    #[test]
    fn test_orchestrator_output_success() {
        let trace = ExecutionTrace::new();
        let outputs = vec![AgentOutput::new("result1")];

        let success = OrchestratorOutput::success("Final result", outputs, trace);
        assert!(success.is_successful());
        assert_eq!(success.result, "Final result");
        assert!(success.error.is_none());
    }

    #[test]
    fn test_orchestrator_output_failure() {
        let trace = ExecutionTrace::new();
        let failure = OrchestratorOutput::failure("Something went wrong", trace);

        assert!(!failure.is_successful());
        assert_eq!(failure.error, Some("Something went wrong".to_string()));
    }

    #[test]
    fn test_task_goal() {
        let goal = TaskGoal::new("Build a REST API")
            .with_criterion("All endpoints respond with valid JSON")
            .with_criterion("Tests pass")
            .with_context("This is for a user management system")
            .with_constraint("Use async/await");

        assert_eq!(goal.objective, "Build a REST API");
        assert_eq!(goal.acceptance_criteria.len(), 2);
        assert!(goal.context.is_some());
        assert_eq!(goal.constraints.len(), 1);
    }
}
