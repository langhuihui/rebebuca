//! # Sequential Orchestration Pattern
//!
//! Agents execute one after another, with each agent's output becoming the input
//! for the next agent in the sequence.
//!
//! ```text
//! Input → Agent A → Agent B → Agent C → Output
//! ```
//!
//! Use cases:
//! - Data processing pipelines
//! - Multi-step reasoning
//! - Content generation and refinement

use async_trait::async_trait;
use std::sync::Arc;

use crate::agent::{Agent, AgentInput, AgentOutput};
use crate::context::{AgentExecution, ExecutionConfig, ExecutionContext};
use crate::errors::{OrchestrationError, Result};
use crate::orchestrator::{Orchestrator, OrchestratorInput, OrchestratorOutput};
use crate::tools::ToolExecutor;

/// Sequential orchestrator that executes agents one after another
pub struct SequentialOrchestrator {
    name: String,
    max_retries: usize,
}

impl SequentialOrchestrator {
    /// Create a new sequential orchestrator
    pub fn new() -> Self {
        Self {
            name: "SequentialOrchestrator".to_string(),
            max_retries: 3,
        }
    }

    /// Set max retries per agent
    pub fn with_max_retries(mut self, max_retries: usize) -> Self {
        self.max_retries = max_retries;
        self
    }

    /// Execute agents sequentially
    async fn execute_sequential(
        &self,
        agents: Vec<Arc<dyn Agent>>,
        mut input: AgentInput,
        tool_executor: Arc<dyn ToolExecutor>,
        ctx: &ExecutionContext,
    ) -> Result<Vec<AgentOutput>> {
        let mut outputs = Vec::new();

        for (index, agent) in agents.iter().enumerate() {
            // Create execution record
            let mut exec_record =
                AgentExecution::new(agent.name(), agent.role(), input.clone());

            if ctx.is_logging_enabled() {
                tracing::info!(
                    "[{}] Executing agent {}/{}: {}",
                    self.name,
                    index + 1,
                    agents.len(),
                    agent.name()
                );
            }

            // Execute agent with retry
            let output = self
                .execute_agent_with_retry(agent.clone(), input.clone(), tool_executor.clone())
                .await;

            let success = output.is_successful();

            if success {
                exec_record.succeed(output.clone());
                outputs.push(output.clone());

                // Use this output as input for next agent
                input = AgentInput::new(&output.content)
                    .with_context(output.data.clone())
                    .with_metadata("previous_agent", agent.name());
            } else {
                exec_record.fail(&output.content);
                
                // Add to trace if enabled
                if ctx.is_tracing_enabled() {
                    ctx.add_agent_execution(exec_record).await;
                }
                
                return Err(OrchestrationError::agent_failure(
                    agent.name(),
                    output.content,
                ));
            }

            // Add to trace if enabled
            if ctx.is_tracing_enabled() {
                ctx.add_agent_execution(exec_record).await;
            }
        }

        Ok(outputs)
    }

    /// Execute an agent with retry logic
    async fn execute_agent_with_retry(
        &self,
        agent: Arc<dyn Agent>,
        input: AgentInput,
        tool_executor: Arc<dyn ToolExecutor>,
    ) -> AgentOutput {
        let mut last_error = None;

        for attempt in 0..=self.max_retries {
            match agent.execute(input.clone(), tool_executor.clone()).await {
                Ok(output) => return output,
                Err(e) => {
                    last_error = Some(e.to_string());
                    if attempt < self.max_retries {
                        tokio::time::sleep(std::time::Duration::from_millis(
                            100 * 2_u64.pow(attempt as u32),
                        ))
                        .await;
                    }
                }
            }
        }

        // All retries failed
        AgentOutput::new(format!(
            "Agent {} failed after {} retries: {}",
            agent.name(),
            self.max_retries,
            last_error.unwrap_or_else(|| "Unknown error".to_string())
        ))
        .with_confidence(0.0)
    }
}

impl Default for SequentialOrchestrator {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl Orchestrator for SequentialOrchestrator {
    fn name(&self) -> &str {
        &self.name
    }

    fn description(&self) -> &str {
        "Executes agents sequentially, passing each output to the next input"
    }

    async fn orchestrate(
        &self,
        agents: Vec<Arc<dyn Agent>>,
        input: OrchestratorInput,
        tool_executor: Arc<dyn ToolExecutor>,
    ) -> Result<OrchestratorOutput> {
        if agents.is_empty() {
            return Err(OrchestrationError::invalid_config(
                "At least one agent is required",
            ));
        }

        // Create execution context
        let config = ExecutionConfig::new();
        let ctx = ExecutionContext::new(tool_executor.session_id(), config);

        let agent_input = AgentInput::new(&input.content)
            .with_context(input.context)
            .with_metadata("orchestrator", self.name());

        // Execute agents sequentially
        let outputs = match self
            .execute_sequential(agents, agent_input, tool_executor, &ctx)
            .await
        {
            Ok(outputs) => outputs,
            Err(e) => {
                ctx.complete_trace().await;
                let trace = ctx.get_trace().await;
                return Ok(OrchestratorOutput::failure(e.to_string(), trace));
            }
        };

        // Complete trace
        ctx.complete_trace().await;
        let trace = ctx.get_trace().await;

        // Get final result
        let final_output = outputs.last().unwrap();
        let result = final_output.content.clone();

        Ok(OrchestratorOutput::success(result, outputs, trace))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::tools::NullToolExecutor;

    struct SimpleAgent {
        name: String,
        prefix: String,
    }

    impl SimpleAgent {
        fn new(name: &str, prefix: &str) -> Self {
            Self {
                name: name.to_string(),
                prefix: prefix.to_string(),
            }
        }
    }

    #[async_trait]
    impl Agent for SimpleAgent {
        fn name(&self) -> &str {
            &self.name
        }

        fn description(&self) -> &str {
            "A simple test agent"
        }

        async fn execute(
            &self,
            input: AgentInput,
            _tool_executor: Arc<dyn ToolExecutor>,
        ) -> Result<AgentOutput> {
            Ok(AgentOutput::new(format!("{}: {}", self.prefix, input.content)))
        }
    }

    #[tokio::test]
    async fn test_sequential_orchestrator() {
        let orchestrator = SequentialOrchestrator::new();
        let tool_executor: Arc<dyn ToolExecutor> =
            Arc::new(NullToolExecutor::new("/tmp", "test-session"));

        let agents: Vec<Arc<dyn Agent>> = vec![
            Arc::new(SimpleAgent::new("Agent1", "Step 1")),
            Arc::new(SimpleAgent::new("Agent2", "Step 2")),
            Arc::new(SimpleAgent::new("Agent3", "Step 3")),
        ];

        let input = OrchestratorInput::new("Initial input");
        let output = orchestrator
            .orchestrate(agents, input, tool_executor)
            .await
            .unwrap();

        assert!(output.is_successful());
        assert_eq!(output.agent_outputs.len(), 3);
        assert!(output.result.contains("Step 3"));
    }

    #[tokio::test]
    async fn test_sequential_empty_agents() {
        let orchestrator = SequentialOrchestrator::new();
        let tool_executor: Arc<dyn ToolExecutor> =
            Arc::new(NullToolExecutor::new("/tmp", "test-session"));

        let agents: Vec<Arc<dyn Agent>> = vec![];
        let input = OrchestratorInput::new("Test");

        let result = orchestrator.orchestrate(agents, input, tool_executor).await;

        assert!(result.is_err());
    }
}
