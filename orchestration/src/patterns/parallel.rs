//! # Parallel Orchestration Pattern
//!
//! Multiple agents execute in parallel, and their outputs are aggregated.
//!
//! ```text
//!         → Agent A ─┐
//! Input ─┼→ Agent B ─┼→ Aggregator → Output
//!         → Agent C ─┘
//! ```
//!
//! Use cases:
//! - Multi-angle analysis
//! - Parallel task processing
//! - Performance optimization

use async_trait::async_trait;
use futures::future::join_all;
use std::sync::Arc;
use tokio::sync::Semaphore;

use crate::agent::{Agent, AgentInput, AgentOutput};
use crate::context::{AgentExecution, ExecutionConfig, ExecutionContext};
use crate::errors::{OrchestrationError, Result};
use crate::orchestrator::{Orchestrator, OrchestratorInput, OrchestratorOutput};
use crate::tools::ToolExecutor;

/// Parallel orchestrator that executes agents concurrently
pub struct ParallelOrchestrator {
    name: String,
    max_retries: usize,
    parallel_limit: usize,
}

impl ParallelOrchestrator {
    /// Create a new parallel orchestrator
    pub fn new() -> Self {
        Self {
            name: "ParallelOrchestrator".to_string(),
            max_retries: 3,
            parallel_limit: 10,
        }
    }

    /// Set max retries per agent
    pub fn with_max_retries(mut self, max_retries: usize) -> Self {
        self.max_retries = max_retries;
        self
    }

    /// Set parallel execution limit
    pub fn with_parallel_limit(mut self, limit: usize) -> Self {
        self.parallel_limit = limit;
        self
    }

    /// Execute agents in parallel
    async fn execute_parallel(
        &self,
        agents: Vec<Arc<dyn Agent>>,
        input: AgentInput,
        tool_executor: Arc<dyn ToolExecutor>,
        ctx: &ExecutionContext,
    ) -> Result<Vec<AgentOutput>> {
        let semaphore = Arc::new(Semaphore::new(self.parallel_limit));
        let agents_count = agents.len();
        let mut handles = Vec::new();

        for (index, agent) in agents.into_iter().enumerate() {
            let input_clone = input.clone();
            let semaphore_clone = semaphore.clone();
            let tool_executor_clone = tool_executor.clone();
            let max_retries = self.max_retries;
            let logging_enabled = ctx.is_logging_enabled();
            let name = self.name.clone();

            let handle = tokio::spawn(async move {
                // Acquire semaphore permit
                let _permit = semaphore_clone.acquire().await.unwrap();

                if logging_enabled {
                    tracing::info!(
                        "[{}] Executing agent {}/{}: {}",
                        name,
                        index + 1,
                        agents_count,
                        agent.name()
                    );
                }

                // Execute agent with retry
                let output = Self::execute_agent_with_retry_static(
                    agent.clone(),
                    input_clone,
                    tool_executor_clone,
                    max_retries,
                )
                .await;

                (agent.name().to_string(), agent.role().to_string(), output)
            });

            handles.push(handle);
        }

        // Wait for all agents to complete
        let results = join_all(handles).await;

        // Collect outputs and check for failures
        let mut outputs = Vec::new();
        let mut failed_agents = Vec::new();

        for result in results {
            match result {
                Ok((agent_name, agent_role, output)) => {
                    // Create execution record
                    let mut exec_record =
                        AgentExecution::new(&agent_name, &agent_role, input.clone());

                    if output.is_successful() {
                        exec_record.succeed(output.clone());
                        outputs.push(output);
                    } else {
                        exec_record.fail(&output.content);
                        failed_agents.push(agent_name);
                    }

                    if ctx.is_tracing_enabled() {
                        ctx.add_agent_execution(exec_record).await;
                    }
                }
                Err(e) => {
                    failed_agents.push(format!("Task failed: {}", e));
                }
            }
        }

        // If any agents failed, return error
        if !failed_agents.is_empty() {
            return Err(OrchestrationError::agent_failure(
                failed_agents.join(", "),
                "Execution failed",
            ));
        }

        Ok(outputs)
    }

    // Static version for use in async block
    async fn execute_agent_with_retry_static(
        agent: Arc<dyn Agent>,
        input: AgentInput,
        tool_executor: Arc<dyn ToolExecutor>,
        max_retries: usize,
    ) -> AgentOutput {
        let mut last_error = None;

        for attempt in 0..=max_retries {
            match agent.execute(input.clone(), tool_executor.clone()).await {
                Ok(output) => return output,
                Err(e) => {
                    last_error = Some(e.to_string());
                    if attempt < max_retries {
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
            max_retries,
            last_error.unwrap_or_else(|| "Unknown error".to_string())
        ))
        .with_confidence(0.0)
    }

    /// Aggregate multiple agent outputs into a single result
    fn aggregate_results(&self, outputs: &[AgentOutput]) -> String {
        if outputs.is_empty() {
            return String::new();
        }

        if outputs.len() == 1 {
            return outputs[0].content.clone();
        }

        // Combine all outputs
        let mut result = String::from("Parallel execution results:\n\n");

        for (index, output) in outputs.iter().enumerate() {
            result.push_str(&format!("{}. {}\n", index + 1, output.content));
        }

        result
    }
}

impl Default for ParallelOrchestrator {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl Orchestrator for ParallelOrchestrator {
    fn name(&self) -> &str {
        &self.name
    }

    fn description(&self) -> &str {
        "Executes agents in parallel and aggregates their outputs"
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
        let mut config = ExecutionConfig::new();
        config.parallel_limit = self.parallel_limit;
        let ctx = ExecutionContext::new(tool_executor.session_id(), config);

        let agent_input = AgentInput::new(&input.content)
            .with_context(input.context)
            .with_metadata("orchestrator", self.name());

        // Execute agents in parallel
        let outputs = match self
            .execute_parallel(agents, agent_input, tool_executor, &ctx)
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

        // Aggregate results
        let aggregated = self.aggregate_results(&outputs);

        Ok(OrchestratorOutput::success(aggregated, outputs, trace))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::tools::NullToolExecutor;

    struct SimpleAgent {
        name: String,
        delay_ms: u64,
    }

    impl SimpleAgent {
        fn new(name: &str, delay_ms: u64) -> Self {
            Self {
                name: name.to_string(),
                delay_ms,
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
            tokio::time::sleep(std::time::Duration::from_millis(self.delay_ms)).await;
            Ok(AgentOutput::new(format!(
                "Result from {}: {}",
                self.name, input.content
            )))
        }
    }

    #[tokio::test]
    async fn test_parallel_orchestrator() {
        let orchestrator = ParallelOrchestrator::new();
        let tool_executor: Arc<dyn ToolExecutor> =
            Arc::new(NullToolExecutor::new("/tmp", "test-session"));

        let agents: Vec<Arc<dyn Agent>> = vec![
            Arc::new(SimpleAgent::new("Agent1", 10)),
            Arc::new(SimpleAgent::new("Agent2", 10)),
            Arc::new(SimpleAgent::new("Agent3", 10)),
        ];

        let input = OrchestratorInput::new("Test input");
        let output = orchestrator
            .orchestrate(agents, input, tool_executor)
            .await
            .unwrap();

        assert!(output.is_successful());
        assert_eq!(output.agent_outputs.len(), 3);
        assert!(output.result.contains("Parallel execution results"));
    }

    #[tokio::test]
    async fn test_parallel_empty_agents() {
        let orchestrator = ParallelOrchestrator::new();
        let tool_executor: Arc<dyn ToolExecutor> =
            Arc::new(NullToolExecutor::new("/tmp", "test-session"));

        let agents: Vec<Arc<dyn Agent>> = vec![];
        let input = OrchestratorInput::new("Test");

        let result = orchestrator.orchestrate(agents, input, tool_executor).await;

        assert!(result.is_err());
    }
}
