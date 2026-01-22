//! Orchestration session management

use async_trait::async_trait;
use rebebuca_orchestration::{
    agent::{Agent, AgentInput, AgentOutput},
    boulder_state::{BoulderState, BoulderStateManager},
    context::{ExecutionConfig, ExecutionContext, OrchestrationEvent},
    errors::Result,
    orchestrator::{OrchestratorOutput, TaskGoal},
    patterns::{SupervisorWorkerConfig, SupervisorWorkerOrchestrator},
    tools::ToolExecutor,
};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::sync::Mutex;
use tokio::sync::{mpsc, RwLock};
use super::{llm::LLMClient, llm::LLMMessage, OrchestrationConfig, OrchestrationStatus, ProviderConfig};

/// Safely truncate a string to a maximum number of characters (handles UTF-8 correctly)
fn truncate_string(s: &str, max_chars: usize) -> String {
    s.chars().take(max_chars).collect::<String>()
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

fn is_rate_limit_error(error: &str) -> bool {
    let lower = error.to_lowercase();
    lower.contains("rate limit") 
        || lower.contains("ratelimit") 
        || lower.contains(" 429") 
        || lower.contains("status 429")
        || lower.contains(" 403")
        || lower.contains("status 403")
        || lower.contains("access denied")
}

fn is_retryable_llm_error(error: &str) -> bool {
    let lower = error.to_lowercase();
    if is_rate_limit_error(error) {
        return true;
    }
    lower.contains("internal server error")
        || lower.contains("system error")
        || lower.contains("status 500")
        || lower.contains("status 502")
        || lower.contains("status 503")
        || lower.contains("status 504")
        || lower.contains(" 500")
        || lower.contains(" 502")
        || lower.contains(" 503")
        || lower.contains(" 504")
        || lower.contains("api_error")
}

/// Orchestration session state
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SessionState {
    Idle,
    Running,
    Completed,
    Error,
}

impl std::fmt::Display for SessionState {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Idle => write!(f, "idle"),
            Self::Running => write!(f, "running"),
            Self::Completed => write!(f, "completed"),
            Self::Error => write!(f, "error"),
        }
    }
}

/// Orchestration session
pub struct OrchestrationSession {
    pub id: String,
    config: OrchestrationConfig,
    tool_executor: Arc<dyn ToolExecutor>,
    state: Arc<RwLock<SessionState>>,
    current_round: Arc<RwLock<usize>>,
    current_action: Arc<RwLock<String>>,
    abort_flag: Arc<RwLock<bool>>,
    boulder_manager: BoulderStateManager,
    goal: Arc<RwLock<Option<TaskGoal>>>,
}

impl OrchestrationSession {
    pub fn new(
        id: String,
        config: OrchestrationConfig,
        tool_executor: Arc<dyn ToolExecutor>,
    ) -> Self {
        let project_path = Path::new(&config.project_path);
        let boulder_manager = BoulderStateManager::new(project_path);
        
        Self {
            id,
            config,
            tool_executor,
            state: Arc::new(RwLock::new(SessionState::Idle)),
            current_round: Arc::new(RwLock::new(0)),
            current_action: Arc::new(RwLock::new("Initializing".to_string())),
            abort_flag: Arc::new(RwLock::new(false)),
            boulder_manager,
            goal: Arc::new(RwLock::new(None)),
        }
    }

    /// Resume session from boulder state
    pub async fn resume_from_boulder(&self) -> Result<Option<BoulderState>> {
        match self.boulder_manager.load().await {
            Ok(Some(state)) => {
                log::info!("[OrchestrationSession] Resuming from boulder state for session: {}", state.session_id);
                
                // Update session state from boulder
                *self.current_round.write().await = state.progress.current_round;
                *self.current_action.write().await = state.progress.current_action.clone();
                
                // Restore goal
                *self.goal.write().await = Some(state.goal.clone());
                
                // Append current session ID to boulder
                let mut updated_state = state.clone();
                updated_state.append_session_id(self.id.clone());
                self.boulder_manager.save(&updated_state).await?;
                
                Ok(Some(updated_state))
            }
            Ok(None) => {
                log::info!("[OrchestrationSession] No boulder state found for session: {}", self.id);
                Ok(None)
            }
            Err(e) => {
                log::warn!("[OrchestrationSession] Failed to load boulder state: {}", e);
                Err(rebebuca_orchestration::errors::OrchestrationError::Internal(format!("Failed to load boulder state: {}", e)))
            }
        }
    }

    /// Save current state to boulder
    pub async fn save_to_boulder(&self, goal: &TaskGoal) -> Result<()> {
        let round = *self.current_round.read().await;
        let action = self.current_action.read().await.clone();
        let goal_guard = self.goal.read().await;
        let current_goal = goal_guard.as_ref().unwrap_or(goal);

        let mut boulder = match self.boulder_manager.load().await? {
            Some(existing) => existing,
            None => BoulderState::new(
                self.id.clone(),
                format!("task-{}", self.id),
                self.config.project_path.clone(),
                current_goal.clone(),
            ),
        };

        boulder.goal = current_goal.clone();
        boulder.update_progress(round, action);
        boulder.progress.max_rounds = self.config.max_rounds.unwrap_or(boulder.progress.max_rounds);
        boulder.append_session_id(self.id.clone());

        self.boulder_manager.save(&boulder).await?;
        Ok(())
    }

    async fn load_or_init_boulder(&self, goal: &TaskGoal) -> Result<BoulderState> {
        if let Some(state) = self.boulder_manager.load().await? {
            return Ok(state);
        }

        Ok(BoulderState::new(
            self.id.clone(),
            format!("task-{}", self.id),
            self.config.project_path.clone(),
            goal.clone(),
        ))
    }

    async fn load_or_init_boulder_from_goal(&self) -> Result<Option<BoulderState>> {
        let goal_guard = self.goal.read().await;
        let goal = match goal_guard.as_ref() {
            Some(goal) => goal.clone(),
            None => return Ok(None),
        };

        Ok(Some(self.load_or_init_boulder(&goal).await?))
    }

    pub async fn update_progress_state(
        &self,
        current_round: usize,
        current_action: String,
        completed_steps: usize,
        total_steps: usize,
        max_rounds: usize,
    ) -> Result<()> {
        let mut round_guard = self.current_round.write().await;
        let previous_round = *round_guard;
        if current_round >= previous_round {
            *round_guard = current_round;
        }
        drop(round_guard);

        if !current_action.is_empty() {
            let mut action_guard = self.current_action.write().await;
            if current_round >= previous_round || action_guard.is_empty() {
                *action_guard = current_action.clone();
            }
        }

        let mut boulder = match self.load_or_init_boulder_from_goal().await? {
            Some(state) => state,
            None => return Ok(()),
        };

        let should_update_round = current_round >= boulder.progress.current_round;
        if should_update_round {
            boulder.progress.current_round = current_round;
            boulder.progress.current_action = current_action.clone();
            boulder.progress.completed_steps = completed_steps;
            boulder.progress.total_steps = total_steps;
            boulder.progress.max_rounds = max_rounds;
            boulder.updated_at = chrono::Utc::now();
        } else if !current_action.is_empty() {
            boulder.progress.current_action = current_action.clone();
            boulder.progress.total_steps = boulder.progress.total_steps.max(total_steps);
            boulder.progress.max_rounds = boulder.progress.max_rounds.max(max_rounds);
            boulder.updated_at = chrono::Utc::now();
        }

        boulder.append_session_id(self.id.clone());
        self.boulder_manager.save(&boulder).await?;
        Ok(())
    }

    pub async fn append_conversation_entry(&self, entry: serde_json::Value) -> Result<()> {
        let mut boulder = match self.load_or_init_boulder_from_goal().await? {
            Some(state) => state,
            None => return Ok(()),
        };

        boulder.add_conversation(entry.to_string());
        boulder.append_session_id(self.id.clone());
        self.boulder_manager.save(&boulder).await?;
        Ok(())
    }

    async fn handle_event_for_persistence(&self, event: &OrchestrationEvent) -> Result<()> {
        match event {
            OrchestrationEvent::Progress(progress) => {
                self.update_progress_state(
                    progress.current_round,
                    progress.current_action.clone(),
                    progress.current_step,
                    progress.total_steps,
                    progress.max_rounds,
                )
                .await?;
            }
            OrchestrationEvent::AgentMessage(message) => {
                self.append_conversation_entry(serde_json::json!({
                    "type": "agent_message",
                    "session_id": message.session_id,
                    "from_agent": message.from_agent,
                    "to_agent": message.to_agent,
                    "message_type": message.message_type,
                    "content": message.content,
                    "timestamp": message.timestamp,
                }))
                .await?;
            }
            OrchestrationEvent::Complete(complete) => {
                self.append_conversation_entry(serde_json::json!({
                    "type": "complete",
                    "session_id": complete.session_id,
                    "success": complete.success,
                    "summary": complete.summary,
                    "timestamp": complete.timestamp,
                }))
                .await?;
            }
            OrchestrationEvent::Error(error) => {
                self.append_conversation_entry(serde_json::json!({
                    "type": "error",
                    "session_id": error.session_id,
                    "error": error.error,
                    "agent": error.agent,
                    "recoverable": error.recoverable,
                    "timestamp": error.timestamp,
                }))
                .await?;
            }
            _ => {}
        }

        Ok(())
    }

    /// Start the orchestration
    pub async fn start(
        &self,
        goal: TaskGoal,
        event_tx: Option<mpsc::UnboundedSender<OrchestrationEvent>>,
    ) -> Result<()> {
        log::info!("[OrchestrationSession] Starting session {} with goal: {}", self.id, goal.objective);
        
        // Try to resume from boulder state if exists
        let boulder_state = self.resume_from_boulder().await?;
        let incoming_task_name = goal.task_name.clone();
        let mut effective_goal = if let Some(ref boulder) = boulder_state {
            log::info!("[OrchestrationSession] Resuming from boulder state - round {}", boulder.progress.current_round);
            boulder.goal.clone()
        } else {
            // Store goal for later saves
            *self.goal.write().await = Some(goal.clone());
            goal.clone()
        };
        if effective_goal.task_name.is_none() {
            effective_goal.task_name = incoming_task_name;
        }
        
        // Save initial state to boulder
        *self.goal.write().await = Some(effective_goal.clone());
        if let Err(e) = self.save_to_boulder(&effective_goal).await {
            log::warn!("[OrchestrationSession] Failed to save initial boulder state: {}", e);
        }
        
        // Set state to running
        {
            let mut state = self.state.write().await;
            *state = SessionState::Running;
        }
        
        log::info!("[OrchestrationSession] State set to Running");

        // Create orchestrator config
        let max_steps_per_round = 100;
        let sw_config = SupervisorWorkerConfig::new()
            .with_max_rounds(self.config.max_rounds.unwrap_or(10))
            .with_max_steps_per_round(max_steps_per_round)
            .with_auto_approve(self.config.auto_approve_permissions.unwrap_or(true));

        let orchestrator = SupervisorWorkerOrchestrator::new(sw_config);

        let (internal_event_tx, mut internal_event_rx) =
            mpsc::unbounded_channel::<OrchestrationEvent>();
        let external_event_tx = event_tx.clone();
        let session_for_events = self.clone();
        tokio::spawn(async move {
            while let Some(event) = internal_event_rx.recv().await {
                if let Err(e) = session_for_events.handle_event_for_persistence(&event).await {
                    log::warn!("[OrchestrationSession] Failed to persist event: {}", e);
                }
                if let Some(tx) = &external_event_tx {
                    let _ = tx.send(event);
                }
            }
        });

        // Create LLM agents
        log::info!("[OrchestrationSession] Creating SupervisorAgent with provider: {}, model: {}, api_key: {:?}, base_url: {:?}", 
            self.config.supervisor_provider.provider,
            self.config.supervisor_provider.model,
            self.config.supervisor_provider.api_key.as_ref().map(|k| if k.is_empty() { "<empty>" } else { "***" }),
            self.config.supervisor_provider.base_url);
        let supervisor: Arc<dyn Agent> = Arc::new(SupervisorAgent::new(
            self.config.supervisor_provider.clone(),
            self.id.clone(),
            Some(internal_event_tx.clone()),
        ));
        log::info!("[OrchestrationSession] Creating WorkerAgent with provider: {}, model: {}, api_key: {:?}, base_url: {:?}", 
            self.config.worker_provider.provider,
            self.config.worker_provider.model,
            self.config.worker_provider.api_key.as_ref().map(|k| if k.is_empty() { "<empty>" } else { "***" }),
            self.config.worker_provider.base_url);
        // Create worker agent with streaming wrapper
        let worker_provider = self.config.worker_provider.clone();
        let max_rounds = self.config.max_rounds.unwrap_or(10);
        let progress_file_path = PathBuf::from(&self.config.project_path).join(".task-progress.json");
        let progress_md_path = PathBuf::from(&self.config.project_path)
            .join(task_progress_filename(
                effective_goal
                    .task_name
                    .as_deref()
                    .unwrap_or(&effective_goal.objective),
            ));
        let event_tx_for_worker = Some(internal_event_tx.clone());
        let event_tx_for_progress = Some(internal_event_tx.clone());
        let worker: Arc<dyn Agent> = Arc::new(StreamingWorkerAgent::new(
            worker_provider,
            self.id.clone(),
            event_tx_for_worker,
            event_tx_for_progress,
            progress_file_path,
            progress_md_path,
            max_rounds,
        ));

        // Create execution context
        let exec_config = ExecutionConfig::new()
            .with_auto_approve(self.config.auto_approve_permissions.unwrap_or(true));
        
        let ctx = ExecutionContext::new(&self.id, exec_config)
            .with_event_sender(internal_event_tx.clone());
        
        if event_tx.is_some() {
            log::info!("[OrchestrationSession] Setting up event sender");
        } else {
            log::warn!("[OrchestrationSession] No event sender provided - events will not be forwarded");
        }

        let default_max_rounds = self.config.max_rounds.unwrap_or(10);
        let default_total_steps = max_steps_per_round;
        let (initial_round, initial_action, initial_completed_steps, initial_total_steps, initial_max_rounds) =
            if let Some(ref boulder) = boulder_state {
                let total_steps = if boulder.progress.total_steps > 0 {
                    boulder.progress.total_steps
                } else {
                    default_total_steps
                };
                let max_rounds = if boulder.progress.max_rounds > 0 {
                    boulder.progress.max_rounds
                } else {
                    default_max_rounds
                };
                (
                    boulder.progress.current_round,
                    boulder.progress.current_action.clone(),
                    boulder.progress.completed_steps,
                    total_steps,
                    max_rounds,
                )
            } else {
                (
                    0,
                    "Starting orchestration".to_string(),
                    0,
                    default_total_steps,
                    default_max_rounds,
                )
            };
        ctx.emit_progress(
            initial_completed_steps,
            initial_total_steps,
            initial_round,
            initial_max_rounds,
            initial_action,
        );
        log::info!("[OrchestrationSession] Emitted initial progress event");

        log::info!("[OrchestrationSession] Starting run_loop");
        // Before starting, check if already aborted
        if *self.abort_flag.read().await {
            log::info!("[OrchestrationSession] Already aborted before starting");
            // Set state to Idle instead of returning error
            {
                let mut state = self.state.write().await;
                *state = SessionState::Idle;
            }
            // User stop is not an error, just return Ok
            return Ok(());
        }
        
        // Start a background task to periodically update context state with abort flag
        // We'll update ctx state periodically so run_loop can check it
        let abort_flag_for_periodic = self.abort_flag.clone();
        let _periodic_updater = tokio::spawn(async move {
            loop {
                tokio::time::sleep(tokio::time::Duration::from_millis(200)).await;
                if *abort_flag_for_periodic.read().await {
                    log::info!("[OrchestrationSession] Abort flag detected in periodic updater");
                    break;
                }
            }
        });
        
        // Run orchestration
        // The run_loop will check for "_abort_requested" in context state
        // We'll update it periodically by checking abort_flag
        let result = {
            // Update context state before starting (if aborted)
            if *self.abort_flag.read().await {
                ctx.set_state("_abort_requested", serde_json::json!(true)).await;
            }
            
            // Start a background task to periodically update context state
            // We'll use a channel to signal when abort is detected, then update ctx in main task
            let (abort_tx, abort_rx) = tokio::sync::mpsc::unbounded_channel::<()>();
            let abort_flag_monitor = self.abort_flag.clone();
            let monitor_handle = tokio::spawn(async move {
                loop {
                    tokio::time::sleep(tokio::time::Duration::from_millis(100)).await; // Check frequently
                    if *abort_flag_monitor.read().await {
                        let _ = abort_tx.send(());
                        break;
                    }
                }
            });
            
            // Use tokio::select! to run run_loop and handle abort signals concurrently
            let mut abort_rx_for_select = abort_rx;
            let abort_flag_for_check = self.abort_flag.clone();
            
            tokio::select! {
                // Run the orchestration
                run_result = orchestrator.run_loop(
                    supervisor,
                    worker,
                    effective_goal,
                    self.tool_executor.clone(),
                    &ctx,
                ) => {
                    monitor_handle.abort();
                    // Update context state if abort was detected during run_loop
                    if *self.abort_flag.read().await {
                        ctx.set_state("_abort_requested", serde_json::json!(true)).await;
                    }
                    run_result
                }
                
                // Handle abort signal
                _ = async {
                    while let Some(_) = abort_rx_for_select.recv().await {
                        log::info!("[OrchestrationSession] Abort signal received, updating context state");
                        ctx.set_state("_abort_requested", serde_json::json!(true)).await;
                        // Continue waiting for more signals or run_loop completion
                    }
                } => {
                    monitor_handle.abort();
                    // Abort signal received, but run_loop may still be running
                    // Check abort_flag and return a user stop output
                    if *abort_flag_for_check.read().await {
                        log::info!("[OrchestrationSession] Abort detected, stopping orchestration");
                        ctx.set_state("_abort_requested", serde_json::json!(true)).await;
                        // Complete trace and return user stop output
                        ctx.complete_trace().await;
                        let trace = ctx.get_trace().await;
                        // Return a failure output (we'll handle it specially in start function)
                        Ok(OrchestratorOutput::failure(
                            "Orchestration stopped by user".to_string(),
                            trace,
                        ))
                    } else {
                        // Channel closed but not aborted
                        log::warn!("[OrchestrationSession] Abort channel closed unexpectedly");
                        Err(rebebuca_orchestration::errors::OrchestrationError::Internal("Abort channel closed".to_string()))
                    }
                }
            }
        };
        
        // Check if result indicates user stop
        let is_user_stop = if let Ok(ref output) = result {
            !output.success && output.error.as_ref().map(|e| e.contains("stopped by user")).unwrap_or(false)
        } else {
            false
        };
        
        // Check if aborted after run_loop completes
        let was_aborted = *self.abort_flag.read().await || is_user_stop;
        if was_aborted {
            log::info!("[OrchestrationSession] Orchestration was aborted by user");
            // Update context state for cleanup
            ctx.set_state("_abort_requested", serde_json::json!(true)).await;
            // Set state to Idle instead of Error when stopped by user
            {
                let mut state = self.state.write().await;
                *state = SessionState::Idle;
            }
            // User stop is not an error, return Ok(())
            return Ok(());
        }
        
        log::info!("[OrchestrationSession] run_loop completed with result: {:?}", result.is_ok());

        // Update state based on result
        {
            let mut state = self.state.write().await;
            if result.is_ok() {
                let output = result.as_ref().unwrap();
                if output.success {
                    *state = SessionState::Completed;
                } else {
                    *state = SessionState::Error;
                }
            } else {
                *state = SessionState::Error;
            }
        }

        // Save final state to boulder (or delete if completed)
        if let Ok(ref output) = result {
            if output.success {
                // Delete boulder state on successful completion
                if let Err(e) = self.boulder_manager.delete().await {
                    log::warn!("[OrchestrationSession] Failed to delete boulder state: {}", e);
                }
            } else {
                // Save state even on error for recovery
                if let Some(ref goal) = *self.goal.read().await {
                    if let Err(e) = self.save_to_boulder(goal).await {
                        log::warn!("[OrchestrationSession] Failed to save boulder state: {}", e);
                    }
                }
            }
        }

        result.map(|_| ())
    }

    /// Stop the orchestration
    pub async fn stop(&self) {
        log::info!("[OrchestrationSession] Stop called for session: {}", self.id);
        let mut abort = self.abort_flag.write().await;
        *abort = true;
        drop(abort); // Release the lock immediately
        
        // Update state
        let mut state = self.state.write().await;
        *state = SessionState::Idle;
        drop(state);
        
        log::info!("[OrchestrationSession] Abort flag set to true, state set to Idle");
    }

    /// Get current status
    pub async fn get_status(&self) -> OrchestrationStatus {
        let state = self.state.read().await;
        let round = self.current_round.read().await;
        let action = self.current_action.read().await;

        OrchestrationStatus {
            session_id: self.id.clone(),
            status: state.to_string(),
            current_round: *round,
            max_rounds: self.config.max_rounds.unwrap_or(10),
            current_action: action.clone(),
        }
    }

    /// Check if aborted
    #[allow(dead_code)]
    pub async fn is_aborted(&self) -> bool {
        *self.abort_flag.read().await
    }
}

impl Clone for OrchestrationSession {
    fn clone(&self) -> Self {
        let project_path = Path::new(&self.config.project_path);
        let boulder_manager = BoulderStateManager::new(project_path);
        
        Self {
            id: self.id.clone(),
            config: self.config.clone(),
            tool_executor: self.tool_executor.clone(),
            state: self.state.clone(),
            current_round: self.current_round.clone(),
            current_action: self.current_action.clone(),
            abort_flag: self.abort_flag.clone(),
            boulder_manager,
            goal: self.goal.clone(),
        }
    }
}

/// Session manager
pub struct SessionManager {
    sessions: RwLock<HashMap<String, OrchestrationSession>>,
}

impl SessionManager {
    pub fn new() -> Self {
        Self {
            sessions: RwLock::new(HashMap::new()),
        }
    }

    pub async fn add_session(&self, session: OrchestrationSession) {
        let mut sessions = self.sessions.write().await;
        sessions.insert(session.id.clone(), session);
    }

    pub async fn get_session(&self, id: &str) -> Option<OrchestrationSession> {
        let sessions = self.sessions.read().await;
        sessions.get(id).cloned()
    }

    pub async fn remove_session(&self, id: &str) {
        let mut sessions = self.sessions.write().await;
        sessions.remove(id);
    }

    #[allow(dead_code)]
    pub async fn list_sessions(&self) -> Vec<String> {
        let sessions = self.sessions.read().await;
        sessions.keys().cloned().collect()
    }
}

impl Default for SessionManager {
    fn default() -> Self {
        Self::new()
    }
}

// =============================================================================
// Mock Agents (Placeholder until LLM integration)
// =============================================================================

/// Real supervisor agent using LLM
struct SupervisorAgent {
    client: LLMClient,
    session_id: String,
    event_tx: Option<mpsc::UnboundedSender<OrchestrationEvent>>,
}

impl SupervisorAgent {
    fn new(
        provider: ProviderConfig,
        session_id: String,
        event_tx: Option<mpsc::UnboundedSender<OrchestrationEvent>>,
    ) -> Self {
        Self {
            client: LLMClient::new(provider),
            session_id,
            event_tx,
        }
    }

    fn emit_usage(&self, prompt_tokens: u32, completion_tokens: u32) {
        if let Some(tx) = &self.event_tx {
            let event = OrchestrationEvent::Usage(rebebuca_orchestration::context::UsageEvent {
                session_id: self.session_id.clone(),
                agent: Some("supervisor".to_string()),
                prompt_tokens,
                completion_tokens,
                total_tokens: prompt_tokens + completion_tokens,
                timestamp: chrono::Utc::now(),
            });
            let _ = tx.send(event);
        }
    }
}

#[async_trait]
impl Agent for SupervisorAgent {
    fn name(&self) -> &str {
        "Supervisor"
    }

    fn description(&self) -> &str {
        "Supervisor agent that coordinates the worker using LLM"
    }

    fn role(&self) -> &str {
        "supervisor"
    }

    async fn execute(
        &self,
        input: AgentInput,
        _tool_executor: Arc<dyn ToolExecutor>,
    ) -> Result<AgentOutput> {
        log::info!(
            "[Supervisor] Processing input: {}",
            truncate_string(&input.content, 100)
        );

        // Build system prompt for supervisor - simple coordinator role
        let system_prompt = r#"You are a Supervisor coordinating a Worker agent.

## Your responsibilities:
1. First round: Pass the ORIGINAL task goal directly to Worker
2. When Worker reports back: Check if ALL acceptance criteria are met
3. If ALL criteria met → return "complete"
4. If NOT all criteria met → return "continue" with the original goal (Worker continues working)
5. If Worker has errors → return "retry" with the original goal
6. If cannot continue → return "abort"

## CRITICAL Rules:
- Do NOT break down tasks or add intermediate steps
- Do NOT micro-manage - just pass the original goal
- When checking completion: Compare Worker's report against the ACCEPTANCE CRITERIA
- If any acceptance criterion is NOT met, Worker must continue

## Response Format (JSON only)

First round OR need to continue:
{"type": "continue", "instruction": "<THE ORIGINAL TASK GOAL>"}

ALL acceptance criteria verified as met:
{"type": "complete", "summary": "Summary of achievements"}

Worker encountered errors:
{"type": "retry", "reason": "Error description", "instruction": "<THE ORIGINAL TASK GOAL>"}

Cannot continue:
{"type": "abort", "reason": "Why aborting"}"#;

        let init_progress_prompt = r#"You are a Supervisor initializing the task progress document.

## Your task:
- Generate a Markdown progress document for the task goal and acceptance criteria.
- Output Markdown ONLY (no JSON, no extra commentary).
- Use clear sections: Title, Task Name, Objective, Acceptance Criteria, Breakdown & Progress.
- The Breakdown & Progress section must be a checklist with unchecked items.
- Only include goal-related progress; do NOT include collaboration chatter, tool logs, or command details.

## Output:
Markdown only."#;

        // Convert AgentInput to LLM messages
        let mut messages = Vec::new();
        
        // Add context if available
        if let Some(context) = input.context.as_object() {
            if let Some(history) = context.get("history").and_then(|h| h.as_array()) {
                // Add conversation history
                for (i, msg) in history.iter().enumerate() {
                    if let Some(msg_str) = msg.as_str() {
                        messages.push(LLMMessage {
                            role: if i % 2 == 0 { "assistant".to_string() } else { "user".to_string() },
                            content: msg_str.to_string(),
                        });
                    }
                }
            }
        }

        // Add current input
        messages.push(LLMMessage {
            role: "user".to_string(),
            content: input.content,
        });

        // Check abort before LLM call
        // Note: We can't cancel the HTTP request once sent, but we can check before sending
        // The abort check in run_loop will catch it after the call completes
        
        let is_init = input
            .context
            .as_object()
            .and_then(|ctx| ctx.get("purpose"))
            .and_then(|v| v.as_str())
            .map(|v| v == "init_progress_doc")
            .unwrap_or(false);

        let chosen_prompt = if is_init { init_progress_prompt } else { system_prompt };

        let retry_delays_seconds: [u64; 20] = [
            1, 1, 2, 3, 5, 8, 13, 21, 34, 55,
            89, 144, 233, 377, 610, 987, 1597, 2584, 4181, 6765,
        ];
        let mut attempt: usize = 0;

        log::info!("[Supervisor] Calling LLM with {} messages", messages.len());
        let mut first_attempt = true;
        loop {
            if !first_attempt {
                let delay = if attempt < retry_delays_seconds.len() {
                    retry_delays_seconds[attempt]
                } else {
                    *retry_delays_seconds.last().unwrap()
                };
                
                // Emit retry info to frontend so user knows what's happening
                if let Some(tx) = &self.event_tx {
                    let event = OrchestrationEvent::WorkerStream(rebebuca_orchestration::context::WorkerStreamEvent {
                        session_id: self.session_id.clone(),
                        content: format!("\n[Supervisor] LLM 调用被拦截 (403/429)，等待 {}s 后重试 (第 {}/{})...\n", 
                            delay, attempt + 1, retry_delays_seconds.len()),
                        is_complete: false,
                        timestamp: chrono::Utc::now(),
                        from: Some("supervisor".to_string()),
                    });
                    let _ = tx.send(event);
                }
                
                tokio::time::sleep(tokio::time::Duration::from_secs(delay)).await;
                attempt = attempt.saturating_add(1);
            }
            first_attempt = false;

            match self
                .client
                .chat_with_tools(messages.clone(), Some(chosen_prompt), &[])
                .await
            {
                Ok(response) => {
                    log::info!(
                        "[Supervisor] LLM response received: {} chars",
                        response.content.len()
                    );
                    log::debug!(
                        "[Supervisor] LLM response: {}",
                        truncate_string(&response.content, 200)
                    );
                    if let Some(usage) = response.usage {
                        self.emit_usage(usage.prompt_tokens, usage.completion_tokens);
                    }
                    return Ok(AgentOutput::new(response.content));
                }
                Err(e) => {
                    log::error!("[Supervisor] LLM call failed: {}", e);
                    if is_retryable_llm_error(&e) && attempt < retry_delays_seconds.len() {
                        continue;
                    }

                    if is_init {
                        return Err(rebebuca_orchestration::errors::OrchestrationError::agent_failure("Supervisor", e));
                    }

                    // Fallback to continue decision
                    return Ok(AgentOutput::new(format!(
                        r#"{{"type": "continue", "instruction": "Continue with the task. Previous attempt failed: {}"}}"#,
                        e
                    )));
                }
            }
        }
    }
}

/// Streaming Worker wrapper that uses LLM streaming API
struct StreamingWorkerAgent {
    client: LLMClient,
    session_id: String,
    event_tx: Option<mpsc::UnboundedSender<OrchestrationEvent>>,
    event_tx_for_progress: Option<mpsc::UnboundedSender<OrchestrationEvent>>,
    progress_file_path: PathBuf,
    progress_md_path: PathBuf,
    loop_detection_state: Mutex<LoopDetectionState>,
    max_rounds: usize,
}

const MIN_STEPS_BEFORE_LOOP_DETECTION: usize = 50;

struct LoopDetectionState {
    last_output_hash: Option<String>,
    repeated_output_count: u32,
}

impl StreamingWorkerAgent {
    fn new(
        provider: ProviderConfig,
        session_id: String,
        event_tx: Option<mpsc::UnboundedSender<OrchestrationEvent>>,
        event_tx_for_progress: Option<mpsc::UnboundedSender<OrchestrationEvent>>,
        progress_file_path: PathBuf,
        progress_md_path: PathBuf,
        max_rounds: usize,
    ) -> Self {
        Self {
            client: LLMClient::new(provider),
            session_id,
            event_tx,
            event_tx_for_progress,
            progress_file_path,
            progress_md_path,
            loop_detection_state: Mutex::new(LoopDetectionState {
                last_output_hash: None,
                repeated_output_count: 0,
            }),
            max_rounds,
        }
    }

    fn detect_infinite_loop(&self, content: &str, step: usize) -> bool {
        if step < MIN_STEPS_BEFORE_LOOP_DETECTION {
            return false;
        }

        let mut state = self.loop_detection_state.lock().unwrap();
        let hash = format!("{:x}", md5::compute(content));
        if hash == state.last_output_hash.clone().unwrap_or_default() {
            state.repeated_output_count += 1;
            log::warn!("[StreamingWorker] Repeated output detected ({} times)", state.repeated_output_count);
            if state.repeated_output_count >= 3 {
                log::error!("[StreamingWorker] Infinite loop detected, stopping");
                return true;
            }
        } else {
            state.last_output_hash = Some(hash);
            state.repeated_output_count = 0;
        }
        false
    }

    fn emit_stream(&self, content: &str, is_complete: bool) {
        if let Some(tx) = &self.event_tx {
            let event = OrchestrationEvent::WorkerStream(rebebuca_orchestration::context::WorkerStreamEvent {
                session_id: self.session_id.clone(),
                content: content.to_string(),
                is_complete,
                timestamp: chrono::Utc::now(),
                from: Some("worker".to_string()),
            });
            let _ = tx.send(event);
        }
    }

    fn emit_tool_use(&self, tool_name: &str, status: &str, args: Option<&serde_json::Value>, result: Option<&str>) {
        if let Some(tx) = &self.event_tx {
            let event = OrchestrationEvent::ToolUse(rebebuca_orchestration::context::ToolUseEvent {
                session_id: self.session_id.clone(),
                tool_name: tool_name.to_string(),
                status: status.to_string(),
                args: args.cloned(),
                result: result.map(|s| s.to_string()),
                timestamp: chrono::Utc::now(),
            });
            let _ = tx.send(event);
        }
    }

    fn emit_usage(&self, prompt_tokens: u32, completion_tokens: u32) {
        if let Some(tx) = &self.event_tx {
            let event = OrchestrationEvent::Usage(rebebuca_orchestration::context::UsageEvent {
                session_id: self.session_id.clone(),
                agent: Some("worker".to_string()),
                prompt_tokens,
                completion_tokens,
                total_tokens: prompt_tokens + completion_tokens,
                timestamp: chrono::Utc::now(),
            });
            let _ = tx.send(event);
        }
    }

    async fn save_progress_to_file(&self, current_action: &str, step: usize) {
        let progress = serde_json::json!({
            "session_id": self.session_id,
            "current_action": current_action,
            "step": step,
            "updated_at": chrono::Utc::now().to_rfc3339(),
        });

        // Also try to write to file (non-blocking)
        let progress_str = serde_json::to_string_pretty(&progress).unwrap_or_default();
        let path = self.progress_file_path.clone();
        tokio::spawn(async move {
            if let Ok(_) = tokio::fs::write(&path, &progress_str).await {
                log::debug!("[StreamingWorker] Saved progress to {:?}", path);
            } else {
                log::warn!("[StreamingWorker] Failed to save progress to {:?}", path);
            }
        });
    }
}

#[async_trait]
impl Agent for StreamingWorkerAgent {
    fn name(&self) -> &str {
        "Worker"
    }

    fn description(&self) -> &str {
        "Worker agent that executes tasks using LLM and tools with streaming support"
    }

    fn role(&self) -> &str {
        "worker"
    }

    async fn execute(
        &self,
        input: AgentInput,
        tool_executor: Arc<dyn ToolExecutor>,
    ) -> Result<AgentOutput> {
        log::info!(
            "[StreamingWorker] Processing instruction: {}",
            truncate_string(&input.content, 100)
        );

        let session_id = self.session_id.clone();
        let event_tx = self.event_tx.clone();

        // Build system prompt for worker
        let progress_path = self.progress_file_path.display().to_string();
        let progress_md_path = self.progress_md_path.display().to_string();
        let system_prompt = r#"You are a Worker agent that executes tasks autonomously using tools.

Available tools:
- read: Read file contents. Args: {"path": "file path"}
- write: Write content to file. Args: {"path": "file path", "content": "content"}
- bash: Execute shell command. Args: {"command": "command string"}
- glob: Find files by pattern. Args: {"pattern": "glob pattern"}
- grep: Search in files. Args: {"pattern": "search pattern", "path": "path"}

CRITICAL: Always provide required arguments. Never use empty {} or null.

Your workflow:
1. Analyze the goal and plan your approach
2. Execute tools to gather information and make changes
3. Continue working until the goal is FULLY achieved
4. Only report completion when ALL objectives are met

Progress files:
- Structured round/step tracking (.task-progress.json):
  {progress_path}
- Human-readable task progress (<task>-progress.md):
  {progress_md_path}

Update the markdown progress file immediately after each meaningful progress change (for example after a tool completes or a milestone is achieved), and ensure you update it at least once at the end of each round.
Before reporting completion, confirm you have updated the markdown progress file for the current round.
If the markdown progress file does not exist, create it.

When writing the markdown progress file:
- Read the existing file (if any)
- Append or update with your latest progress
- ONLY include progress related to the task goal and acceptance criteria
- Do NOT include collaboration chatter, tool logs, or step-by-step command details
- Keep it concise and task-focused (free text)

When using tools:
- Use tools via function calling
- After receiving tool results, continue planning and executing
- Keep working until the task is truly complete

When the task is COMPLETE, respond with JSON:
{"done": true, "summary": "What was accomplished", "success": true, "actions": ["actions taken"], "exitReason": "completed"}

When you need MORE WORK, just continue using tools - do NOT output JSON yet."#
            .replace("{progress_path}", &progress_path)
            .replace("{progress_md_path}", &progress_md_path);

        // Get available tools from executor
        let available_tools = tool_executor.available_tools();
        log::info!("[StreamingWorker] Available tools: {:?}", available_tools.iter().map(|t| &t.name).collect::<Vec<_>>());

        // Agentic loop - keep working until task is complete (no step limit)
        let mut step = 0;
        let mut all_actions: Vec<String> = Vec::new();
        let mut all_issues: Vec<String> = Vec::new();
        let mut conversation: Vec<LLMMessage> = vec![LLMMessage {
            role: "user".to_string(),
            content: format!("Goal: {}\n\nWork autonomously to achieve this goal. Use tools as needed.\n\nIMPORTANT: When the task is FULLY complete, respond with JSON: {{\"done\": true, \"summary\": \"...\"}}\nDo NOT stop until you explicitly report done.", input.content),
        }];
        let mut exit_reason: Option<&str> = None;

        loop {
            step += 1;

            log::info!("[StreamingWorker] Step {}", step);

            // Emit progress event for frontend
            self.save_progress_to_file(&format!("Worker step {}", step), step).await;

            // Call LLM with streaming support
            let session_id_for_stream = session_id.clone();
            let event_tx_for_stream = event_tx.clone();

        let retry_delays_seconds: [u64; 20] = [
            1, 1, 2, 3, 5, 8, 13, 21, 34, 55,
            89, 144, 233, 377, 610, 987, 1597, 2584, 4181, 6765,
        ];
        let mut attempt: usize = 0;

        let response = loop {
            let call_result = self.client.chat_with_tools_stream(
                conversation.clone(),
                Some(&system_prompt),
                &available_tools,
                {
                    let session_id = session_id_for_stream.clone();
                    let event_tx = event_tx_for_stream.clone();
                    move |chunk: &str| -> std::result::Result<(), String> {
                        if let Some(tx) = &event_tx {
                            let event = OrchestrationEvent::WorkerStream(rebebuca_orchestration::context::WorkerStreamEvent {
                                session_id: session_id.clone(),
                                content: chunk.to_string(),
                                is_complete: false,
                                timestamp: chrono::Utc::now(),
                                from: Some("worker".to_string()),
                            });
                            let _ = tx.send(event);
                        }
                        Ok(())
                    }
                }
            ).await;

            match call_result {
                Ok(resp) => break Ok(resp),
                Err(e) => {
                    if is_retryable_llm_error(&e) && attempt < retry_delays_seconds.len() {
                        let wait_seconds = retry_delays_seconds[attempt];
                        self.emit_stream(
                            &format!("\n[Worker] LLM 调用被拦截 (403/429)，等待 {}s 后重试 (第 {}/{})...\n", wait_seconds, attempt + 1, retry_delays_seconds.len()),
                            false,
                        );
                        tokio::time::sleep(tokio::time::Duration::from_secs(wait_seconds)).await;
                        attempt += 1;
                        continue;
                    }
                    break Err(e);
                }
            }
        };

        let response = match response {
            Ok(resp) => resp,
            Err(e) => {
                self.emit_stream(&format!("\n错误: {}\n", e), true);
                all_issues.push(format!("LLM call failed: {}", e));
                exit_reason = if is_rate_limit_error(&e) {
                    Some("rate_limited")
                } else {
                    Some("llm_error")
                };
                break;
            }
        };

            log::info!("[StreamingWorker] Step {} - LLM response: {} chars, {} tool call(s)",
                step, response.content.len(), response.tool_calls.len());
            if let Some(usage) = response.usage {
                self.emit_usage(usage.prompt_tokens, usage.completion_tokens);
            }

            // Infinite loop detection - check if output is repeating
            if self.detect_infinite_loop(&response.content, step) {
                self.emit_stream(&format!("\n⚠️ 检测到重复输出，任务可能陷入无限循环\n"), true);
                let report = serde_json::json!({
                    "summary": "Task may be stuck in infinite loop",
                    "success": false,
                    "actions": all_actions,
                    "issues": all_issues,
                    "error": "Infinite loop detected - output repeating",
                    "exitReason": "infinite_loop",
                });
                return Ok(AgentOutput::new(serde_json::to_string(&report).unwrap()));
            }

            // Check if LLM says it's done (no tool calls and has "done": true in response)
            if response.tool_calls.is_empty() {
                // Check if response indicates completion
                if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(&response.content) {
                    if parsed.get("done").and_then(|d| d.as_bool()).unwrap_or(false) {
                        log::info!("[StreamingWorker] Task completed by LLM");
                        let summary = parsed.get("summary").and_then(|s| s.as_str()).unwrap_or("Task completed");
                        self.emit_stream(&format!("\n✅ 任务完成: {}\n", summary), true);
                        
                        // Build final report
                        let report = serde_json::json!({
                            "summary": summary,
                            "success": parsed.get("success").and_then(|s| s.as_bool()).unwrap_or(true),
                            "actions": all_actions,
                            "issues": all_issues,
                            "exitReason": "completed",
                        });
                        return Ok(AgentOutput::new(serde_json::to_string(&report).unwrap()));
                    }
                }
                
                // No tool calls - LLM is thinking, add response and prompt to continue
                log::info!("[StreamingWorker] No tool calls, LLM thinking: {}", 
                    response.content.chars().take(100).collect::<String>());
                
                // Add the response to conversation and prompt to continue
                if !response.content.is_empty() {
                    conversation.push(LLMMessage {
                        role: "assistant".to_string(),
                        content: response.content.clone(),
                    });
                }
                conversation.push(LLMMessage {
                    role: "user".to_string(),
                    content: "Continue working on the task. Use tools to make progress. If the task is complete, respond with {\"done\": true, \"summary\": \"...\"}".to_string(),
                });
                continue;
            }
            
            // Execute tool calls
            let mut tool_results_for_llm: Vec<String> = Vec::new();
            
            for tool_call in &response.tool_calls {
                log::info!("[StreamingWorker] Executing tool: {} with args: {:?}", 
                    tool_call.name, tool_call.input);
                
                // Validate tool call arguments
                if tool_call.input.is_object() && tool_call.input.as_object().unwrap().is_empty() {
                    let error_msg = format!("Tool '{}' called with empty arguments", tool_call.name);
                    log::warn!("[StreamingWorker] {}", error_msg);
                    all_issues.push(error_msg.clone());
                    tool_results_for_llm.push(format!("[{}] Error: {}", tool_call.name, error_msg));
                    self.emit_stream(&format!("✗ {} 参数错误\n", tool_call.name), false);
                    continue;
                }
                
                // Display tool call with arguments
                let args_display = if let Some(obj) = tool_call.input.as_object() {
                    obj.iter()
                        .map(|(k, v)| {
                            let v_str = match v {
                                serde_json::Value::String(s) => {
                                    if s.len() > 60 {
                                        format!("\"{}...\"", s.chars().take(60).collect::<String>())
                                    } else {
                                        format!("\"{}\"", s)
                                    }
                                }
                                _ => v.to_string()
                            };
                            format!("{}={}", k, v_str)
                        })
                        .collect::<Vec<_>>()
                        .join(", ")
                } else {
                    tool_call.input.to_string()
                };
                self.emit_stream(&format!("▶ {}({})\n", tool_call.name, args_display), false);

                // 发送工具开始事件
                self.emit_tool_use(&tool_call.name, "start", Some(&tool_call.input), None);

                match tool_executor.execute(&tool_call.name, tool_call.input.clone()).await {
                    Ok(result) => {
                        if result.success {
                            let output_preview = result.output.chars().take(500).collect::<String>();
                            all_actions.push(format!("{}: completed", tool_call.name));
                            tool_results_for_llm.push(format!("[{}] Success:\n{}", tool_call.name, output_preview));
                            self.emit_stream(&format!("✓ {} 完成\n", tool_call.name), false);
                            // 发送工具完成事件
                            self.emit_tool_use(&tool_call.name, "complete", Some(&tool_call.input), Some(&result.output));
                            if tool_call.name == "bash" || tool_call.name == "command" {
                                if !result.output.is_empty() {
                                    self.emit_stream(&format!("{}\n", result.output), false);
                                }
                            } else if !result.output.is_empty() && result.output.len() < 2000 {
                                self.emit_stream(&format!("{}\n", result.output), false);
                            }
                        } else {
                            let error_msg = result.error.unwrap_or_else(|| "Unknown error".to_string());
                            all_issues.push(format!("{}: {}", tool_call.name, error_msg));
                            tool_results_for_llm.push(format!("[{}] Error: {}", tool_call.name, error_msg));
                            self.emit_stream(&format!("✗ {} 失败: {}\n", tool_call.name, error_msg), false);
                            // 发送工具错误事件
                            self.emit_tool_use(&tool_call.name, "error", Some(&tool_call.input), Some(&error_msg));
                        }
                    }
                    Err(e) => {
                        let error_msg = e.to_string();
                        all_issues.push(format!("{}: {}", tool_call.name, error_msg));
                        tool_results_for_llm.push(format!("[{}] Error: {}", tool_call.name, error_msg));
                        self.emit_stream(&format!("✗ {} 错误: {}\n", tool_call.name, error_msg), false);
                        // 发送工具错误事件
                        self.emit_tool_use(&tool_call.name, "error", Some(&tool_call.input), Some(&error_msg));
                    }
                }
            }
            
            // Add assistant response and tool results to conversation
            conversation.push(LLMMessage {
                role: "assistant".to_string(),
                content: response.content.clone(),
            });
            
            // Add tool results as user message for next iteration
            if !tool_results_for_llm.is_empty() {
                conversation.push(LLMMessage {
                    role: "user".to_string(),
                    content: format!("Tool results:\n{}\n\nContinue working towards the goal. Use more tools if needed, or respond with {{\"done\": true, \"summary\": \"...\"}} if complete.", 
                        tool_results_for_llm.join("\n\n")),
                });
            }
        }
        
        // Build final report if loop ended without explicit completion
        let report = serde_json::json!({
            "summary": format!("Completed {} steps", step),
            "success": all_issues.is_empty(),
            "actions": all_actions,
            "issues": all_issues,
            "exitReason": exit_reason.unwrap_or("stopped"),
        });
        
        self.emit_stream("\n", true);
        Ok(AgentOutput::new(serde_json::to_string(&report).unwrap()))
    }
}

/// Real worker agent using LLM (non-streaming, kept for compatibility)
#[allow(dead_code)]
struct WorkerAgent {
    client: LLMClient,
}

impl WorkerAgent {
    #[allow(dead_code)]
    fn new(provider: ProviderConfig) -> Self {
        Self {
            client: LLMClient::new(provider),
        }
    }
    
    /// Execute with streaming support (internal method)
    #[allow(dead_code)]
    async fn execute_with_streaming<F>(
        &self,
        input: AgentInput,
        tool_executor: Arc<dyn ToolExecutor>,
        mut on_stream: F,
    ) -> rebebuca_orchestration::errors::Result<AgentOutput>
    where
        F: FnMut(&str) -> std::result::Result<(), String>,
    {
        log::info!(
            "[Worker] Processing instruction with streaming: {}",
            truncate_string(&input.content, 100)
        );

        // Build system prompt for worker
        let system_prompt = r#"You are a Worker agent that executes tasks by using tools.

Available tools:
- read: Read file contents
  Required args: {"path": "file path"} (path is REQUIRED - DO NOT use empty object {})
- write: Write content to file
  Required args: {"path": "file path", "content": "content"} (both path and content are REQUIRED - DO NOT use empty object {})
- bash: Execute shell command
  Required args: {"command": "command string"} (command is REQUIRED - DO NOT use empty object {})
  Example: {"command": "ls -la"} or {"command": "npm install", "timeout": 60000}
  Optional args: {"timeout": 30000} (timeout in milliseconds, default: 30000)
- glob: Find files by pattern
  Required args: {"pattern": "glob pattern"} (pattern is REQUIRED - DO NOT use empty object {})
  Example: {"pattern": "**/*.ts"} or {"pattern": "src/**/*.js"}
- grep: Search in files
  Required args: {"pattern": "search pattern", "path": "file or directory path"} (both pattern and path are REQUIRED - DO NOT use empty object {})
  Example: {"pattern": "function", "path": "src/main.ts"}

CRITICAL: When calling tools, you MUST provide ALL required arguments as a valid JSON object. 
- DO NOT call tools with empty arguments: {}
- DO NOT call tools with null arguments: null
- ALWAYS include the required parameters in the function call
- Example for bash: {"command": "ls"} NOT {}
- Example for glob: {"pattern": "*.ts"} NOT {}

Your role is to:
1. Understand the supervisor's high-level goal
2. Plan and execute the necessary steps to achieve the goal
3. Use tools as needed to gather information and perform actions
4. Report your progress and results

## Tool Usage:
When you need to use a tool, use the function calling capability. The tools will be executed automatically, and you should describe the results in your summary.

You must respond in JSON format:
{
  "summary": "A clear summary of what you accomplished",
  "success": true/false,
  "actions": ["high-level actions you took"],
  "issues": ["any issues encountered"],
  "needs_decision": "optional question for supervisor"
}

Use tools when needed - they will be executed automatically."#;

        // Build user message
        let messages = vec![LLMMessage {
            role: "user".to_string(),
            content: format!("Goal: {}\n\nPlan and execute the necessary steps to achieve this goal. Use tools as needed and report your progress and results in JSON format.", input.content),
        }];

        // Get available tools from executor
        let available_tools = tool_executor.available_tools();
        log::info!("[Worker] Available tools: {:?}", available_tools.iter().map(|t| &t.name).collect::<Vec<_>>());
        
        // Call LLM with streaming support
        log::info!("[Worker] Calling LLM with streaming, instruction: {} chars", input.content.len());
        match self.client.chat_with_tools_stream(messages, Some(system_prompt), &available_tools, |chunk| {
            on_stream(chunk).map_err(|e| e)
        }).await {
            Ok(response) => {
                log::info!("[Worker] LLM streaming response completed: {} chars, {} tool call(s)", 
                    response.content.len(), response.tool_calls.len());
                
                // Execute tool calls from LLM response
                let mut tool_results = Vec::new();
                let mut tool_actions = Vec::new();
                let mut tool_issues = Vec::new();
                
                for tool_call in &response.tool_calls {
                    log::info!("[Worker] Executing tool: {} (id: {}) with args: {:?}", 
                        tool_call.name, tool_call.id, tool_call.input);
                    
                    // Validate tool call arguments before execution
                    if tool_call.input.is_object() {
                        let obj = tool_call.input.as_object().unwrap();
                        if obj.is_empty() {
                            let error_msg = format!("Tool '{}' called with empty arguments. Please provide required parameters.", tool_call.name);
                            log::warn!("[Worker] {}", error_msg);
                            tool_issues.push(format!("{} execution error: {}", tool_call.name, error_msg));
                            tool_results.push(format!("[{}] Execution error: {}", tool_call.name, error_msg));
                            let _ = on_stream(&format!("✗ {} 执行错误: {}\n", tool_call.name, error_msg));
                            continue;
                        }
                    }
                    
                    // Emit tool execution status via stream
                    let _ = on_stream(&format!("\n执行工具: {}\n", tool_call.name));
                    
                    match tool_executor.execute(&tool_call.name, tool_call.input.clone()).await {
                        Ok(result) => {
                            if result.success {
                                tool_actions.push(format!("{}: {}", tool_call.name, result.output.chars().take(100).collect::<String>()));
                                tool_results.push(format!("[{}] Success: {}", tool_call.name, result.output.chars().take(200).collect::<String>()));
                                // 发送完成状态
                                let _ = on_stream(&format!("✓ {} 执行成功\n", tool_call.name));
                                // 发送完整的命令输出（特别是 bash 命令）
                                if tool_call.name == "bash" || tool_call.name == "command" {
                                    if !result.output.is_empty() {
                                        let _ = on_stream(&format!("{}\n", result.output));
                                    }
                                } else if !result.output.is_empty() && result.output.len() < 2000 {
                                    // 对于其他工具，如果输出不太长，也发送完整输出
                                    let _ = on_stream(&format!("{}\n", result.output));
                                }
                            } else {
                                let error_msg = result.error.unwrap_or_else(|| "Unknown error".to_string());
                                tool_issues.push(format!("{} failed: {}", tool_call.name, error_msg));
                                tool_results.push(format!("[{}] Error: {}", tool_call.name, error_msg));
                                let _ = on_stream(&format!("✗ {} 执行失败: {}\n", tool_call.name, error_msg));
                            }
                        }
                        Err(e) => {
                            tool_issues.push(format!("{} execution error: {}", tool_call.name, e));
                            tool_results.push(format!("[{}] Execution error: {}", tool_call.name, e));
                            let _ = on_stream(&format!("✗ {} 执行错误: {}\n", tool_call.name, e));
                        }
                    }
                }
                
                // Try to extract and parse JSON from response content
                let json_str = if response.content.trim_start().starts_with('{') {
                    response.content.trim()
                } else {
                    // If not JSON, try to find JSON in the content
                    if let Some(start) = response.content.find('{') {
                        if let Some(end) = response.content.rfind('}') {
                            &response.content[start..=end]
                        } else {
                            response.content.trim()
                        }
                    } else {
                        response.content.trim()
                    }
                };
                
                // Parse JSON and build final report
                let report_content = if let Ok(mut parsed) = serde_json::from_str::<serde_json::Value>(json_str) {
                    // Don't modify summary - keep it as the LLM generated it
                    
                    // Merge tool actions into actions array - only high-level descriptions
                    if let Some(actions) = parsed.get_mut("actions").and_then(|a| a.as_array_mut()) {
                        for action in &tool_actions {
                            // Extract high-level description, remove raw tool output
                            let high_level = if let Some(colon_pos) = action.find(':') {
                                let tool_name = &action[..colon_pos];
                                format!("{}: 已执行", tool_name)
                            } else {
                                action.clone()
                            };
                            actions.push(serde_json::Value::String(high_level));
                        }
                    }
                    
                    // Merge tool issues into issues array
                    if let Some(issues) = parsed.get_mut("issues").and_then(|i| i.as_array_mut()) {
                        for issue in &tool_issues {
                            issues.push(serde_json::Value::String(issue.clone()));
                        }
                    }
                    
                    serde_json::to_string(&parsed).unwrap_or_else(|_| json_str.to_string())
                } else {
                    // If parsing fails, create a minimal report
                    if !tool_results.is_empty() {
                        format!(
                            r#"{{"summary": "已完成工具操作", "success": {}, "actions": {}, "issues": {}}}"#,
                            tool_issues.is_empty(),
                            serde_json::to_string(&tool_actions).unwrap_or_else(|_| "[]".to_string()),
                            serde_json::to_string(&tool_issues).unwrap_or_else(|_| "[]".to_string())
                        )
                    } else {
                        json_str.to_string()
                    }
                };

                Ok(AgentOutput::new(report_content))
            }
            Err(e) => {
                log::error!("[Worker] LLM streaming call failed: {}", e);
                let _ = on_stream(&format!("\n错误: {}\n", e));
                // Fallback to simple report
                Ok(AgentOutput::new(format!(
                    r#"{{"summary": "Failed to process instruction: {}", "success": false, "actions": [], "issues": ["LLM call failed"]}}"#,
                    e
                )))
            }
        }
    }
}

#[async_trait]
impl Agent for WorkerAgent {
    fn name(&self) -> &str {
        "Worker"
    }

    fn description(&self) -> &str {
        "Worker agent that executes tasks using LLM and tools"
    }

    fn role(&self) -> &str {
        "worker"
    }

    async fn execute(
        &self,
        input: AgentInput,
        tool_executor: Arc<dyn ToolExecutor>,
    ) -> Result<AgentOutput> {
        log::info!(
            "[Worker] Processing instruction: {}",
            truncate_string(&input.content, 100)
        );

        // Build system prompt for worker
        let system_prompt = r#"You are a Worker agent that executes tasks by using tools.

Available tools:
- read: Read file contents
  Required args: {"path": "file path"} (path is REQUIRED - DO NOT use empty object {})
- write: Write content to file
  Required args: {"path": "file path", "content": "content"} (both path and content are REQUIRED - DO NOT use empty object {})
- bash: Execute shell command
  Required args: {"command": "command string"} (command is REQUIRED - DO NOT use empty object {})
  Example: {"command": "ls -la"} or {"command": "npm install", "timeout": 60000}
  Optional args: {"timeout": 30000} (timeout in milliseconds, default: 30000)
- glob: Find files by pattern
  Required args: {"pattern": "glob pattern"} (pattern is REQUIRED - DO NOT use empty object {})
  Example: {"pattern": "**/*.ts"} or {"pattern": "src/**/*.js"}
- grep: Search in files
  Required args: {"pattern": "search pattern", "path": "file or directory path"} (both pattern and path are REQUIRED - DO NOT use empty object {})
  Example: {"pattern": "function", "path": "src/main.ts"}

CRITICAL: When calling tools, you MUST provide ALL required arguments as a valid JSON object. 
- DO NOT call tools with empty arguments: {}
- DO NOT call tools with null arguments: null
- ALWAYS include the required parameters in the function call
- Example for bash: {"command": "ls"} NOT {}
- Example for glob: {"pattern": "*.ts"} NOT {}

Your role is to:
1. Understand the supervisor's high-level goal
2. Plan and execute the necessary steps to achieve the goal
3. Use tools as needed to gather information and perform actions
4. Report your progress and results

## Tool Usage:
When you need to use a tool, use the function calling capability. The tools will be executed automatically, and you should describe the results in your summary.

You must respond in JSON format:
{
  "summary": "A clear summary of what you accomplished",
  "success": true/false,
  "actions": ["high-level actions you took"],
  "issues": ["any issues encountered"],
  "needs_decision": "optional question for supervisor"
}

Use tools when needed - they will be executed automatically."#;

        // Build user message
        let messages = vec![LLMMessage {
            role: "user".to_string(),
            content: format!("Goal: {}\n\nPlan and execute the necessary steps to achieve this goal. Use tools as needed and report your progress and results in JSON format.", input.content),
        }];

        // Get available tools from executor
        let available_tools = tool_executor.available_tools();
        log::info!("[Worker] Available tools: {:?}", available_tools.iter().map(|t| &t.name).collect::<Vec<_>>());
        
        // Check if we should use streaming (via context metadata)
        // If streaming is enabled, we'll use the streaming API and emit events via the callback
        let _stream_callback = input.metadata.get("stream_callback_session_id");
        
        // For now, always use non-streaming API
        // Streaming will be handled at orchestration level by wrapping the execution
        log::info!("[Worker] Calling LLM with instruction: {} chars", input.content.len());
        
        let response = self.client.chat_with_tools(messages, Some(system_prompt), &available_tools).await
            .map_err(|e| rebebuca_orchestration::errors::OrchestrationError::agent_failure("Worker", e))?;
        
        {
                log::info!("[Worker] LLM response received: {} chars, {} tool call(s)", 
                    response.content.len(), response.tool_calls.len());
                log::debug!("[Worker] LLM response: {}", truncate_string(&response.content, 200));
                
                // Execute tool calls from LLM response
                let mut tool_results = Vec::new();
                let mut tool_actions = Vec::new();
                let mut tool_issues = Vec::new();
                
                for tool_call in &response.tool_calls {
                    log::info!("[Worker] Executing tool: {} (id: {}) with args: {:?}", 
                        tool_call.name, tool_call.id, tool_call.input);
                    
                    // Validate tool call arguments before execution
                    if tool_call.input.is_object() {
                        let obj = tool_call.input.as_object().unwrap();
                        if obj.is_empty() {
                            let error_msg = format!("Tool '{}' called with empty arguments. Please provide required parameters.", tool_call.name);
                            log::warn!("[Worker] {}", error_msg);
                            tool_issues.push(format!("{} execution error: {}", tool_call.name, error_msg));
                            tool_results.push(format!("[{}] Execution error: {}", tool_call.name, error_msg));
                            continue;
                        }
                    }
                    
                    // Note: We can't emit streaming events here because we don't have ExecutionContext
                    // Streaming events will be handled at the orchestration level
                    
                    match tool_executor.execute(&tool_call.name, tool_call.input.clone()).await {
                        Ok(result) => {
                            if result.success {
                                tool_actions.push(format!("{}: {}", tool_call.name, result.output.chars().take(100).collect::<String>()));
                                tool_results.push(format!("[{}] Success: {}", tool_call.name, result.output.chars().take(200).collect::<String>()));
                            } else {
                                let error_msg = result.error.unwrap_or_else(|| "Unknown error".to_string());
                                tool_issues.push(format!("{} failed: {}", tool_call.name, error_msg));
                                tool_results.push(format!("[{}] Error: {}", tool_call.name, error_msg));
                            }
                        }
                        Err(e) => {
                            tool_issues.push(format!("{} execution error: {}", tool_call.name, e));
                            tool_results.push(format!("[{}] Execution error: {}", tool_call.name, e));
                        }
                    }
                }
                
                // Try to extract and parse JSON from response content
                let json_str = if response.content.trim_start().starts_with('{') {
                    response.content.trim()
                } else {
                    // If not JSON, try to find JSON in the content
                    if let Some(start) = response.content.find('{') {
                        if let Some(end) = response.content.rfind('}') {
                            &response.content[start..=end]
                        } else {
                            response.content.trim()
                        }
                    } else {
                        response.content.trim()
                    }
                };
                
                // Parse JSON and build final report
                let report_content = if let Ok(mut parsed) = serde_json::from_str::<serde_json::Value>(json_str) {
                    // Don't modify summary - keep it as the LLM generated it
                    // The summary should describe what was accomplished, not how
                    
                    // Merge tool actions into actions array - only high-level descriptions
                    if let Some(actions) = parsed.get_mut("actions").and_then(|a| a.as_array_mut()) {
                        for action in &tool_actions {
                            // Extract high-level description, remove raw tool output
                            let high_level = if let Some(colon_pos) = action.find(':') {
                                let tool_name = &action[..colon_pos];
                                // Just keep tool name and brief description, not full output
                                format!("{}: 已执行", tool_name)
                            } else {
                                action.clone()
                            };
                            actions.push(serde_json::Value::String(high_level));
                        }
                    }
                    
                    // Merge tool issues into issues array
                    if let Some(issues) = parsed.get_mut("issues").and_then(|i| i.as_array_mut()) {
                        for issue in &tool_issues {
                            issues.push(serde_json::Value::String(issue.clone()));
                        }
                    }
                    
                    serde_json::to_string(&parsed).unwrap_or_else(|_| json_str.to_string())
                } else {
                    // If parsing fails, create a minimal report
                    if !tool_results.is_empty() {
                        format!(
                            r#"{{"summary": "已完成工具操作", "success": {}, "actions": {}, "issues": {}}}"#,
                            tool_issues.is_empty(),
                            serde_json::to_string(&tool_actions).unwrap_or_else(|_| "[]".to_string()),
                            serde_json::to_string(&tool_issues).unwrap_or_else(|_| "[]".to_string())
                        )
                    } else {
                        json_str.to_string()
                    }
                };

            Ok(AgentOutput::new(report_content))
        }
    }
}

/// Mock supervisor agent for testing (kept as fallback)
#[allow(dead_code)]
struct MockSupervisorAgent {
    provider: ProviderConfig,
}

impl MockSupervisorAgent {
    #[allow(dead_code)]
    fn new(provider: &ProviderConfig) -> Self {
        Self {
            provider: provider.clone(),
        }
    }
}

#[async_trait]
impl Agent for MockSupervisorAgent {
    fn name(&self) -> &str {
        "Supervisor"
    }

    fn description(&self) -> &str {
        "Supervisor agent that coordinates the worker"
    }

    fn role(&self) -> &str {
        "supervisor"
    }

    async fn execute(
        &self,
        input: AgentInput,
        _tool_executor: Arc<dyn ToolExecutor>,
    ) -> Result<AgentOutput> {
        // TODO: Replace with actual LLM call using self.provider
        log::info!(
            "[MockSupervisor] Received input: {}",
            truncate_string(&input.content, 100)
        );

        // For now, just complete after receiving a worker report
        if input.content.contains("Worker Report") || input.content.contains("Done") {
            Ok(AgentOutput::new(
                r#"{"type": "complete", "summary": "Task completed successfully (mock)"}"#,
            ))
        } else {
            Ok(AgentOutput::new(
                r#"{"type": "continue", "instruction": "Please analyze the project structure and report what you find."}"#,
            ))
        }
    }
}

/// Mock worker agent for testing
#[allow(dead_code)]
struct MockWorkerAgent {
    provider: ProviderConfig,
}

impl MockWorkerAgent {
    #[allow(dead_code)]
    fn new(provider: &ProviderConfig) -> Self {
        Self {
            provider: provider.clone(),
        }
    }
}

#[async_trait]
impl Agent for MockWorkerAgent {
    fn name(&self) -> &str {
        "Worker"
    }

    fn description(&self) -> &str {
        "Worker agent that executes tasks"
    }

    fn role(&self) -> &str {
        "worker"
    }

    async fn execute(
        &self,
        input: AgentInput,
        tool_executor: Arc<dyn ToolExecutor>,
    ) -> Result<AgentOutput> {
        // TODO: Replace with actual LLM call using self.provider
        log::info!(
            "[MockWorker] Received instruction: {}",
            truncate_string(&input.content, 100)
        );

        // For testing, try to list files
        let result = tool_executor
            .execute(
                "bash",
                serde_json::json!({
                    "command": "ls -la | head -20",
                    "timeout": 5000
                }),
            )
            .await;

        let output = match result {
            Ok(r) if r.success => r.output,
            Ok(r) => format!("Command failed: {}", r.error.unwrap_or_default()),
            Err(e) => format!("Error: {}", e),
        };

        Ok(AgentOutput::new(format!(
            r#"{{"summary": "Listed directory contents", "success": true, "actions": ["ls -la"], "output": "{}"}}"#,
            output.replace('"', "\\\"").replace('\n', "\\n")
        )))
    }
}
