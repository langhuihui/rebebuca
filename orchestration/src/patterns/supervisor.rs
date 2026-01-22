//! # Supervisor-Worker Orchestration Pattern
//!
//! A supervisor agent coordinates worker agents to accomplish complex tasks.
//!
//! ```text
//! ┌─────────────────────────────────────────────────────────────┐
//! │                  SupervisorWorkerOrchestrator                │
//! │  (协调监工和工人之间的交互，管理任务循环)                      │
//! └────────────────────────┬────────────────────────────────────┘
//!                          │
//!          ┌───────────────┴───────────────┐
//!          │                               │
//! ┌────────▼────────┐            ┌─────────▼─────────┐
//! │ SupervisorAgent │◄──────────►│   WorkerAgent     │
//! │   (监工)        │   对话     │    (工人)         │
//! ├─────────────────┤            ├───────────────────┤
//! │ • 分解任务      │            │ • 执行具体操作    │
//! │ • 下达指令      │            │ • 使用工具        │
//! │ • 评估结果      │            │ • 汇报结果        │
//! │ • 决策终止      │            │                   │
//! └─────────────────┘            └─────────┬─────────┘
//!                                          │
//!                                ┌─────────▼─────────┐
//!                                │   ToolExecutor    │
//!                                │ (read/write/bash) │
//!                                └───────────────────┘
//! ```
//!
//! Use cases:
//! - Complex task completion
//! - Code generation and modification
//! - Research and analysis tasks

use async_trait::async_trait;
use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};
use std::sync::Arc;
use tokio::sync::mpsc;

use crate::agent::{Agent, AgentInput};
use crate::context::{
    AgentExecution, CompleteEvent, ExecutionConfig, ExecutionContext, OrchestrationEvent,
};
use crate::errors::{OrchestrationError, Result};
use crate::orchestrator::{Orchestrator, OrchestratorInput, OrchestratorOutput, TaskGoal};
use crate::tools::ToolExecutor;
use crate::verification::{VerificationContext, Verifier};

/// Configuration for supervisor-worker orchestration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SupervisorWorkerConfig {
    /// Maximum number of rounds
    pub max_rounds: usize,
    /// Maximum steps per round
    pub max_steps_per_round: usize,
    /// Auto-approve permission requests
    pub auto_approve_permissions: bool,
    /// Stuck detection threshold (consecutive similar responses)
    pub stuck_threshold: usize,
    /// Minimum history length before stuck detection kicks in
    pub min_steps_before_stuck_check: usize,
}

impl Default for SupervisorWorkerConfig {
    fn default() -> Self {
        Self {
            max_rounds: 10,
            max_steps_per_round: 100,
            auto_approve_permissions: true,
            stuck_threshold: 3,
            min_steps_before_stuck_check: 50,
        }
    }
}

impl SupervisorWorkerConfig {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn with_max_rounds(mut self, rounds: usize) -> Self {
        self.max_rounds = rounds;
        self
    }

    pub fn with_max_steps_per_round(mut self, steps: usize) -> Self {
        self.max_steps_per_round = steps;
        self
    }

    pub fn with_auto_approve(mut self, auto_approve: bool) -> Self {
        self.auto_approve_permissions = auto_approve;
        self
    }

    pub fn with_min_steps_before_stuck_check(mut self, steps: usize) -> Self {
        self.min_steps_before_stuck_check = steps;
        self
    }
}

/// Supervisor decision types
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "lowercase")]
pub enum SupervisorDecision {
    /// Continue with next instruction
    Continue { instruction: String },
    /// Retry the last operation
    Retry { reason: String, instruction: String },
    /// Task is complete
    Complete { summary: String },
    /// Abort the task
    Abort { reason: String },
}

/// Worker report
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkerReport {
    /// Execution summary
    pub summary: String,
    /// Whether execution was successful
    pub success: bool,
    /// Actions performed
    pub actions: Vec<String>,
    /// Issues encountered
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub issues: Vec<String>,
    /// Needs supervisor decision on something
    #[serde(skip_serializing_if = "Option::is_none")]
    pub needs_decision: Option<String>,
    /// Exit reason for this round
    #[serde(skip_serializing_if = "Option::is_none", rename = "exitReason", alias = "exit_reason")]
    pub exit_reason: Option<String>,
}

/// Supervisor-Worker orchestrator
pub struct SupervisorWorkerOrchestrator {
    name: String,
    config: SupervisorWorkerConfig,
}

fn task_progress_filename(task_name: &str) -> String {
    let mut output = String::new();
    let mut last_dash = false;

    for ch in task_name.chars() {
        if ch.is_alphanumeric() {
            for lower in ch.to_lowercase() {
                output.push(lower);
            }
            last_dash = false;
        } else if !last_dash {
            output.push('-');
            last_dash = true;
        }
    }

    let trimmed = output.trim_matches('-');
    let mut normalized: String = trimmed.chars().take(40).collect();
    if normalized.is_empty() {
        normalized = "task".to_string();
    }

    format!("{}-progress.md", normalized)
}

fn build_initial_progress_doc_prompt(goal: &TaskGoal, path: &str) -> String {
    let task_name = goal.task_name.as_deref().unwrap_or(&goal.objective);
    let criteria_list = if goal.acceptance_criteria.is_empty() {
        "(无)".to_string()
    } else {
        goal.acceptance_criteria
            .iter()
            .enumerate()
            .map(|(idx, c)| format!("{}. {}", idx + 1, c))
            .collect::<Vec<_>>()
            .join("\n")
    };

    let constraints_list = if goal.constraints.is_empty() {
        "(无)".to_string()
    } else {
        goal.constraints
            .iter()
            .map(|c| format!("- {}", c))
            .collect::<Vec<_>>()
            .join("\n")
    };

    let context_block = goal
        .context
        .as_deref()
        .filter(|ctx| !ctx.trim().is_empty())
        .map(|ctx| format!("## 背景信息\n{}\n", ctx))
        .unwrap_or_else(|| "".to_string());

    format!(
        "请为以下任务生成进度文档（Markdown 格式），并且只输出 Markdown 内容，不要输出任何解释：\n\n任务名称：{}\n任务目标：{}\n验收标准：\n{}\n约束条件：\n{}\n{}\n要求：\n- 文档必须用于记录与任务目标/验收标准相关的进展\n- 不要包含协作过程、工具日志或命令细节\n- 使用清晰的章节结构：标题、目标、验收标准、拆解与进展（用勾选框）\n- 初始化进度，默认全部未完成\n\n请将文档写入路径：{}\n",
        task_name,
        goal.objective,
        criteria_list,
        constraints_list,
        context_block,
        path
    )
}

impl SupervisorWorkerOrchestrator {
    /// Create a new supervisor-worker orchestrator
    pub fn new(config: SupervisorWorkerConfig) -> Self {
        Self {
            name: "SupervisorWorkerOrchestrator".to_string(),
            config,
        }
    }

    /// Run the supervisor-worker loop
    pub async fn run_loop(
        &self,
        supervisor: Arc<dyn Agent>,
        worker: Arc<dyn Agent>,
        goal: TaskGoal,
        tool_executor: Arc<dyn ToolExecutor>,
        ctx: &ExecutionContext,
    ) -> Result<OrchestratorOutput> {
        let mut current_round = 0;
        let mut all_outputs = Vec::new();
        let mut conversation_history = Vec::new();

        let progress_doc_path = task_progress_filename(
            goal.task_name.as_deref().unwrap_or(&goal.objective),
        );
        let project_path = tool_executor.project_path().to_string();
        let progress_doc_full_path = format!(
            "{}/{}",
            project_path.trim_end_matches('/'),
            &progress_doc_path
        );
        let initial_instruction = format!(
            "任务目标:\n{}\n\n完成标准:\n{}\n{}\n{}\n\n请在进度变化时及时更新任务进度文档，并确保每轮结束至少更新一次。进度文档仅记录与任务目标/验收标准相关的进展，不要包含协作过程、工具日志或详细命令。若文档不存在请创建。\n进度文档路径（绝对路径）: {}",
            goal.objective,
            goal.acceptance_criteria
                .iter()
                .enumerate()
                .map(|(i, c)| format!("{}. {}", i + 1, c))
                .collect::<Vec<_>>()
                .join("\n"),
            if let Some(ctx) = goal.context.as_deref() {
                format!("\n背景信息:\n{}", ctx)
            } else {
                String::new()
            },
            if !goal.constraints.is_empty() {
                format!(
                    "\n约束条件:\n{}",
                    goal.constraints
                        .iter()
                        .enumerate()
                        .map(|(i, c)| format!("{}. {}", i + 1, c))
                        .collect::<Vec<_>>()
                        .join("\n")
                )
            } else {
                String::new()
            },
            progress_doc_full_path
        );

        ctx.emit_progress(
            0,
            self.config.max_steps_per_round,
            0,
            self.config.max_rounds,
            "Supervisor initializing progress doc",
        );

        let init_prompt = build_initial_progress_doc_prompt(&goal, &progress_doc_full_path);
        let init_input = AgentInput::new(&init_prompt).with_context(serde_json::json!({
            "role": "supervisor",
            "purpose": "init_progress_doc",
            "progress_doc_path": progress_doc_full_path,
        }));

        let init_output = supervisor.execute(init_input, tool_executor.clone()).await?;
        let init_content = init_output.content.trim();
        if init_content.is_empty() {
            let error_msg = format!(
                "Supervisor returned empty progress doc for {}",
                progress_doc_full_path
            );
            log::warn!("[SupervisorWorkerOrchestrator] {}", error_msg);
            ctx.emit_error(&error_msg, Some(supervisor.name().to_string()), false);
            ctx.complete_trace().await;
            let trace = ctx.get_trace().await;
            return Ok(OrchestratorOutput::failure(error_msg, trace));
        }

        let progress_doc_initialized = match tool_executor
            .execute(
                "write",
                serde_json::json!({
                    "path": progress_doc_full_path.as_str(),
                    "content": init_content,
                }),
            )
            .await
        {
            Ok(result) if result.success => true,
            _ => false,
        };

        if !progress_doc_initialized {
            let error_msg = format!(
                "Failed to initialize progress doc at {}",
                progress_doc_full_path
            );
            log::warn!("[SupervisorWorkerOrchestrator] {}", error_msg);
            ctx.emit_error(&error_msg, Some(supervisor.name().to_string()), false);
            ctx.complete_trace().await;
            let trace = ctx.get_trace().await;
            return Ok(OrchestratorOutput::failure(error_msg, trace));
        }

        ctx.emit_agent_message(
            supervisor.name(),
            worker.name(),
            "instruction",
            &format!(
                "监工已通过 LLM 初始化任务进度文档并写入拆解内容：{}",
                progress_doc_full_path
            ),
        );

        ctx.emit_progress(0, self.config.max_steps_per_round, 0, self.config.max_rounds, "Starting worker");

        let mut decision = SupervisorDecision::Continue {
            instruction: initial_instruction,
        };

        // Main loop
        while current_round < self.config.max_rounds {
            // Check for abort via context state (if set by session)
            // The session will periodically update this state when abort_flag is set
            // Check more frequently to catch abort quickly
            if let Some(abort_value) = ctx.get_state("_abort_requested").await {
                if abort_value.as_bool().unwrap_or(false) {
                    log::info!("[SupervisorWorkerOrchestrator] Abort requested, stopping loop at round {}", current_round);
                    ctx.emit_error("Orchestration stopped by user", None, false);
                    ctx.complete_trace().await;
                    let trace = ctx.get_trace().await;
                    return Ok(OrchestratorOutput::failure("Orchestration stopped by user".to_string(), trace));
                }
            }
            
            current_round += 1;

            ctx.emit_progress(
                0,
                self.config.max_steps_per_round,
                current_round,
                self.config.max_rounds,
                format!("Round {}", current_round),
            );

            // Handle decision
            match &decision {
                SupervisorDecision::Complete { summary } => {
                    ctx.emit_event(OrchestrationEvent::Complete(CompleteEvent {
                        session_id: ctx.session_id.clone(),
                        success: true,
                        summary: summary.clone(),
                        duration_ms: 0, // Will be set by trace
                        timestamp: Utc::now(),
                    }));

                    ctx.complete_trace().await;
                    let trace = ctx.get_trace().await;
                    return Ok(OrchestratorOutput::success(summary, all_outputs, trace));
                }

                SupervisorDecision::Abort { reason } => {
                    ctx.emit_error(reason, Some(supervisor.name().to_string()), false);

                    ctx.complete_trace().await;
                    let trace = ctx.get_trace().await;
                    return Ok(OrchestratorOutput::failure(reason, trace));
                }

                SupervisorDecision::Continue { instruction }
                | SupervisorDecision::Retry { instruction, .. } => {
                    // For round 2 and later, read progress document and include it in instruction
                    let final_instruction = if current_round >= 1 {
                        // Read progress document
                        let progress_doc_content = match tool_executor
                            .execute(
                                "read",
                                serde_json::json!({
                                    "path": progress_doc_full_path.as_str()
                            }),
                            )
                            .await
                        {
                            Ok(result) if result.success => Some(result.output),
                            _ => None,
                        };
                        
                        if let Some(content) = progress_doc_content {
                            format!(
                                "{}\n\n=== 任务进度文档内容 (绝对路径: {}) ===\n{}\n\n请根据以上进度文档继续工作。",
                                instruction,
                                progress_doc_full_path,
                                content
                            )
                        } else {
                            format!(
                                "{}\n\n注意：任务进度文档 (绝对路径: {}) 不可用，请先创建/更新该文档后再继续工作。",
                                instruction,
                                progress_doc_full_path
                            )
                        }
                    } else {
                        instruction.clone()
                    };
                    
                    // Send instruction to worker
                    let instruction_sender = if current_round == 1 && conversation_history.is_empty() {
                        "System"
                    } else {
                        supervisor.name()
                    };
                    ctx.emit_agent_message(
                        instruction_sender,
                        worker.name(),
                        "instruction",
                        &final_instruction,
                    );

                    let worker_input = AgentInput::new(&final_instruction)
                        .with_context(serde_json::json!({
                            "role": "worker",
                            "round": current_round,
                            "history": conversation_history,
                        }));

                    let mut worker_exec = AgentExecution::new(worker.name(), worker.role(), worker_input.clone());
                    
                    ctx.emit_progress(
                        0,
                        self.config.max_steps_per_round,
                        current_round,
                        self.config.max_rounds,
                        "Worker executing",
                    );

                    // Check abort before worker execution
                    if let Some(abort_value) = ctx.get_state("_abort_requested").await {
                        if abort_value.as_bool().unwrap_or(false) {
                            log::info!("[SupervisorWorkerOrchestrator] Abort requested before worker execution");
                            ctx.emit_error("Orchestration stopped by user", None, false);
                            ctx.complete_trace().await;
                            let trace = ctx.get_trace().await;
                            return Ok(OrchestratorOutput::failure("Orchestration stopped by user".to_string(), trace));
                        }
                    }
                    
                    // Emit streaming start event
                    ctx.emit_worker_stream("开始执行任务...\n\n", false);

                    // Execute worker with streaming support
                    // We'll use a wrapper approach: execute worker and emit streaming events
                    // For true streaming, we'd need to modify the Agent trait or use a custom wrapper
                    // For now, we'll emit progress updates and final content
                    // Note: The worker.execute() call may take a long time (LLM API calls)
                    // We can't cancel it mid-flight, but we'll check abort after it completes
                    let worker_output = worker.execute(worker_input, tool_executor.clone()).await?;
                    
                    // Check abort after worker execution (this is where we catch it after LLM calls)
                    if let Some(abort_value) = ctx.get_state("_abort_requested").await {
                        if abort_value.as_bool().unwrap_or(false) {
                            log::info!("[SupervisorWorkerOrchestrator] Abort requested after worker execution");
                            ctx.emit_error("Orchestration stopped by user", None, false);
                            ctx.complete_trace().await;
                            let trace = ctx.get_trace().await;
                            return Ok(OrchestratorOutput::failure("Orchestration stopped by user".to_string(), trace));
                        }
                    }
                    worker_exec.succeed(worker_output.clone());

                    if ctx.is_tracing_enabled() {
                        ctx.add_agent_execution(worker_exec).await;
                    }

                    // Parse worker report
                    let report = self.parse_worker_report(&worker_output.content);
                    conversation_history.push(worker_output.content.clone());
                    all_outputs.push(worker_output.clone());

                    // Emit final streaming content (complete)
                    // Extract summary for streaming display
                    let stream_content = if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(&worker_output.content) {
                        if let Some(summary) = parsed.get("summary").and_then(|s| s.as_str()) {
                            format!("{}\n\n", summary)
                        } else {
                            format!("{}\n\n", worker_output.content)
                        }
                    } else {
                        format!("{}\n\n", worker_output.content)
                    };
                    ctx.emit_worker_stream(&stream_content, true);

                    // MANDATORY VERIFICATION: Verify worker claims independently
                    // Don't trust worker self-reports - verify with tools
                    ctx.emit_progress(
                        0,
                        self.config.max_steps_per_round,
                        current_round,
                        self.config.max_rounds,
                        "Verifying worker results...",
                    );

                    let project_path = tool_executor.project_path().to_string();
                    let progress_doc_full_path = format!(
                        "{}/{}",
                        project_path.trim_end_matches('/'),
                        &progress_doc_path
                    );

                    let verification_context = VerificationContext {
                        project_path: project_path.clone(),
                        modified_files: Vec::new(), // Will be extracted by verifier
                        actions: report.actions.clone(),
                        tool_executor: tool_executor.clone(),
                    };

                    let verification_result = Verifier::verify(
                        verification_context,
                        &worker_output.content,
                        report.success,
                    )
                    .await
                    .unwrap_or_else(|e| {
                        // If verification fails, create a warning result
                        crate::verification::VerificationResult {
                            passed: false,
                            issues: vec![crate::verification::VerificationIssue {
                                r#type: crate::verification::IssueType::Other,
                                description: format!("Verification check failed: {}", e),
                                severity: crate::verification::IssueSeverity::Medium,
                            }],
                            summary: format!("Verification encountered an error: {}", e),
                        }
                    });

                    // Emit verification result
                    if !verification_result.passed {
                        ctx.emit_agent_message(
                            "Verifier",
                            supervisor.name(),
                            "verification_warning",
                            &verification_result.summary,
                        );
                    }

                    // Only send final report to supervisor after streaming is complete
                    // Include issues in the report so supervisor can handle them
                    let report_content = if !report.issues.is_empty() {
                        format!(
                            "{}\n\n遇到问题 (请处理):\n{}",
                            report.summary,
                            report.issues.iter()
                                .map(|i| format!("- {}", i))
                                .collect::<Vec<_>>()
                                .join("\n")
                        )
                    } else {
                        report.summary.clone()
                    };
                    
                    ctx.emit_agent_message(
                        worker.name(),
                        supervisor.name(),
                        "report",
                        &report_content,
                    );

                    // Include verification results in supervisor review prompt
                    let verification_info = if !verification_result.passed {
                        format!(
                            "\n\n⚠️ VERIFICATION WARNING:\n{}\n\nIssues found:\n{}",
                            verification_result.summary,
                            verification_result
                                .issues
                                .iter()
                                .map(|i| format!("- [{}] {}", 
                                    match i.severity {
                                        crate::verification::IssueSeverity::Critical => "CRITICAL",
                                        crate::verification::IssueSeverity::High => "HIGH",
                                        crate::verification::IssueSeverity::Medium => "MEDIUM",
                                        crate::verification::IssueSeverity::Low => "LOW",
                                    },
                                    i.description
                                ))
                                .collect::<Vec<_>>()
                                .join("\n")
                        )
                    } else {
                        "\n\n✅ Verification passed - no issues found".to_string()
                    };

                    let progress_doc_content = match tool_executor
                        .execute(
                            "read",
                            serde_json::json!({
                                    "path": progress_doc_full_path.as_str()
                            }),
                        )
                        .await
                    {
                        Ok(result) if result.success => Some(result.output),
                        _ => None,
                    };

                    let progress_doc_context = if let Some(content) = progress_doc_content {
                        format!("\n\n任务进度文档 (绝对路径: {}):\n{}", progress_doc_full_path, content)
                    } else {
                        format!("\n\n任务进度文档 (绝对路径: {}): not available", progress_doc_full_path)
                    };

                    let progress_doc_instruction = format!(
                        "\n\nCRITICAL: The task progress document is at {}. It must only contain progress related to the task goal/acceptance criteria (no collaboration chatter, tool logs, or command details). Always read this file only.",
                        progress_doc_full_path
                    );

                    let review_prompt = format!(
                        "Worker Report:\n{}\n\nSuccess: {}\nActions: {:?}\nIssues: {:?}{}\n{}\n{}\n\nPlease evaluate if the current goal is achieved.\n\nIf the goal IS achieved:\n- Provide the NEXT SINGLE high-level goal (NOT specific commands or steps)\n- Do NOT break it down into steps\n- Do NOT mention specific tools or commands\n\nIf the goal is NOT achieved OR verification found issues:\n- Decide whether to retry with the same goal or continue with a different goal\n- Still provide only a high-level goal, never specific steps\n\nCRITICAL REMINDERS:\n- You are a SUPERVISOR setting objectives, NOT a worker doing the work\n- Only set goals, never give specific commands or tool names\n- Give ONE goal at a time, not a list of steps\n- Trust the Worker to figure out HOW to achieve the goal\n- If verification found issues, you may need to have the worker address them",
                        report.summary,
                        report.success,
                        report.actions,
                        report.issues,
                        verification_info,
                        progress_doc_context,
                        progress_doc_instruction
                    );

                    // Check abort before supervisor execution
                    if let Some(abort_value) = ctx.get_state("_abort_requested").await {
                        if abort_value.as_bool().unwrap_or(false) {
                            log::info!("[SupervisorWorkerOrchestrator] Abort requested before supervisor execution");
                            ctx.emit_error("Orchestration stopped by user", None, false);
                            ctx.complete_trace().await;
                            let trace = ctx.get_trace().await;
                            return Ok(OrchestratorOutput::failure("Orchestration stopped by user".to_string(), trace));
                        }
                    }
                    
                    // Check abort before supervisor execution
                    if let Some(abort_value) = ctx.get_state("_abort_requested").await {
                        if abort_value.as_bool().unwrap_or(false) {
                            log::info!("[SupervisorWorkerOrchestrator] Abort requested before supervisor execution");
                            ctx.emit_error("Orchestration stopped by user", None, false);
                            ctx.complete_trace().await;
                            let trace = ctx.get_trace().await;
                            return Ok(OrchestratorOutput::failure("Orchestration stopped by user".to_string(), trace));
                        }
                    }
                    
                    let supervisor_input = AgentInput::new(&review_prompt)
                        .with_context(serde_json::json!({
                            "role": "supervisor",
                            "round": current_round,
                            "worker_report": report,
                            "history": conversation_history,
                        }));

                    let mut supervisor_exec = AgentExecution::new(supervisor.name(), supervisor.role(), supervisor_input.clone());
                    // Note: supervisor.execute() may take a long time (LLM API calls)
                    // We can't cancel it mid-flight, but we'll check abort after it completes
                    let supervisor_output = supervisor.execute(supervisor_input, tool_executor.clone()).await?;
                    
                    // Check abort after supervisor execution (this is where we catch it after LLM calls)
                    if let Some(abort_value) = ctx.get_state("_abort_requested").await {
                        if abort_value.as_bool().unwrap_or(false) {
                            log::info!("[SupervisorWorkerOrchestrator] Abort requested after supervisor execution");
                            ctx.emit_error("Orchestration stopped by user", None, false);
                            ctx.complete_trace().await;
                            let trace = ctx.get_trace().await;
                            return Ok(OrchestratorOutput::failure("Orchestration stopped by user".to_string(), trace));
                        }
                    }
                    supervisor_exec.succeed(supervisor_output.clone());

                    if ctx.is_tracing_enabled() {
                        ctx.add_agent_execution(supervisor_exec).await;
                    }

                    // Parse next decision
                    decision = self.parse_supervisor_decision(&supervisor_output.content)?;
                    conversation_history.push(supervisor_output.content.clone());
                    all_outputs.push(supervisor_output);
                }
            }

            // Check for stuck state
            if self.is_stuck(&conversation_history) {
                ctx.emit_error("Task appears stuck in a loop", None, true);
                
                ctx.complete_trace().await;
                let trace = ctx.get_trace().await;
                return Ok(OrchestratorOutput::failure(
                    "Task stuck in a loop - aborting",
                    trace,
                ));
            }
        }

        // Max rounds exceeded
        ctx.emit_error(
            &format!("Maximum rounds ({}) exceeded", self.config.max_rounds),
            None,
            false,
        );

        ctx.complete_trace().await;
        let trace = ctx.get_trace().await;
        Ok(OrchestratorOutput::failure(
            format!("Maximum rounds ({}) exceeded", self.config.max_rounds),
            trace,
        ))
    }

    /// Parse supervisor decision from output
    fn parse_supervisor_decision(&self, content: &str) -> Result<SupervisorDecision> {
        // Try to parse as JSON
        if let Ok(decision) = serde_json::from_str::<SupervisorDecision>(content) {
            return Ok(decision);
        }

        // Try to find JSON in the content
        if let Some(start) = content.find('{') {
            if let Some(end) = content.rfind('}') {
                let json_str = &content[start..=end];
                if let Ok(decision) = serde_json::from_str::<SupervisorDecision>(json_str) {
                    return Ok(decision);
                }
            }
        }

        // Default to continue with the content as instruction
        Ok(SupervisorDecision::Continue {
            instruction: content.to_string(),
        })
    }

    /// Parse worker report from output
    fn parse_worker_report(&self, content: &str) -> WorkerReport {
        // Try to parse as JSON
        if let Ok(report) = serde_json::from_str::<WorkerReport>(content) {
            return report;
        }

        // Try to find JSON in the content
        if let Some(start) = content.find('{') {
            if let Some(end) = content.rfind('}') {
                let json_str = &content[start..=end];
                if let Ok(report) = serde_json::from_str::<WorkerReport>(json_str) {
                    return report;
                }
            }
        }

        // Default report
        WorkerReport {
            summary: content.to_string(),
            success: true,
            actions: vec![],
            issues: vec![],
            needs_decision: None,
            exit_reason: None,
        }
    }

    /// Check if the orchestration is stuck
    fn is_stuck(&self, history: &[String]) -> bool {
        if history.len() < self.config.min_steps_before_stuck_check {
            return false;
        }

        if history.len() < self.config.stuck_threshold {
            return false;
        }

        let window = self.config.stuck_threshold * 2;
        let recent = if history.len() > window {
            &history[history.len() - window..]
        } else {
            history
        };

        let mut last_hash: Option<u64> = None;
        let mut consecutive = 0;

        for content in recent {
            let mut hasher = DefaultHasher::new();
            content.hash(&mut hasher);
            let hash = hasher.finish();
            if last_hash == Some(hash) {
                consecutive += 1;
                if consecutive >= self.config.stuck_threshold {
                    return true;
                }
            } else {
                last_hash = Some(hash);
                consecutive = 1;
            }
        }

        false
    }
}

impl Default for SupervisorWorkerOrchestrator {
    fn default() -> Self {
        Self::new(SupervisorWorkerConfig::default())
    }
}

#[async_trait]
impl Orchestrator for SupervisorWorkerOrchestrator {
    fn name(&self) -> &str {
        &self.name
    }

    fn description(&self) -> &str {
        "Supervisor-Worker pattern: A supervisor coordinates workers to accomplish tasks"
    }

    async fn orchestrate(
        &self,
        agents: Vec<Arc<dyn Agent>>,
        input: OrchestratorInput,
        tool_executor: Arc<dyn ToolExecutor>,
    ) -> Result<OrchestratorOutput> {
        // Require exactly 2 agents: supervisor and worker
        if agents.len() != 2 {
            return Err(OrchestrationError::invalid_config(
                "SupervisorWorkerOrchestrator requires exactly 2 agents (supervisor and worker)",
            ));
        }

        let supervisor = agents[0].clone();
        let worker = agents[1].clone();

        // Parse task goal from input
        let goal = if let Ok(goal) = serde_json::from_value::<TaskGoal>(input.context.clone()) {
            goal
        } else {
            TaskGoal::new(&input.content)
        };

        // Create execution context with event channel
        let (tx, _rx) = mpsc::unbounded_channel::<OrchestrationEvent>();
        let config = ExecutionConfig::new()
            .with_auto_approve(self.config.auto_approve_permissions);
        let ctx = ExecutionContext::new(tool_executor.session_id(), config)
            .with_event_sender(tx);

        self.run_loop(supervisor, worker, goal, tool_executor, &ctx).await
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::agent::AgentOutput;
    use crate::tools::NullToolExecutor;

    struct MockSupervisor;

    #[async_trait]
    impl Agent for MockSupervisor {
        fn name(&self) -> &str {
            "MockSupervisor"
        }

        fn description(&self) -> &str {
            "A mock supervisor for testing"
        }

        fn role(&self) -> &str {
            "supervisor"
        }

        async fn execute(
            &self,
            input: AgentInput,
            _tool_executor: Arc<dyn ToolExecutor>,
        ) -> Result<AgentOutput> {
            // Simple logic: complete after first round
            if input.content.contains("Worker Report") {
                Ok(AgentOutput::new(r#"{"type": "complete", "summary": "Task completed successfully"}"#))
            } else {
                Ok(AgentOutput::new(r#"{"type": "continue", "instruction": "Please do the task"}"#))
            }
        }
    }

    struct MockWorker;

    #[async_trait]
    impl Agent for MockWorker {
        fn name(&self) -> &str {
            "MockWorker"
        }

        fn description(&self) -> &str {
            "A mock worker for testing"
        }

        fn role(&self) -> &str {
            "worker"
        }

        async fn execute(
            &self,
            _input: AgentInput,
            _tool_executor: Arc<dyn ToolExecutor>,
        ) -> Result<AgentOutput> {
            Ok(AgentOutput::new(r#"{"summary": "Done", "success": true, "actions": ["completed task"]}"#))
        }
    }

    #[tokio::test]
    async fn test_supervisor_worker_basic() {
        let config = SupervisorWorkerConfig::new().with_max_rounds(5);
        let orchestrator = SupervisorWorkerOrchestrator::new(config);
        let tool_executor: Arc<dyn ToolExecutor> =
            Arc::new(NullToolExecutor::new("/tmp", "test-session"));

        let agents: Vec<Arc<dyn Agent>> = vec![
            Arc::new(MockSupervisor),
            Arc::new(MockWorker),
        ];

        let input = OrchestratorInput::new("Test task")
            .with_context(serde_json::json!({
                "objective": "Complete a test",
                "acceptance_criteria": ["Test passes"]
            }));

        let output = orchestrator
            .orchestrate(agents, input, tool_executor)
            .await
            .unwrap();

        assert!(output.is_successful());
        assert!(output.result.contains("completed"));
    }

    #[tokio::test]
    async fn test_supervisor_worker_wrong_agent_count() {
        let orchestrator = SupervisorWorkerOrchestrator::default();
        let tool_executor: Arc<dyn ToolExecutor> =
            Arc::new(NullToolExecutor::new("/tmp", "test-session"));

        let agents: Vec<Arc<dyn Agent>> = vec![Arc::new(MockSupervisor)];
        let input = OrchestratorInput::new("Test");

        let result = orchestrator.orchestrate(agents, input, tool_executor).await;

        assert!(result.is_err());
    }
}
