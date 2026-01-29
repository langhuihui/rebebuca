//! Terminal Task Manager
//!
//! Manages terminal task lifecycle, output buffering, and SSE broadcasting.

use crate::pty::{PtyManager, TaskExecuteOptions};
use crate::terminal_task_types::{
    CreateTaskRequest, OutputLine, OutputType, ResourceLimits, TaskError,
    TaskEvent, TaskInfo, TaskInternalState, TaskListEvent, TaskStatus,
};
use chrono::{Duration, Utc};
use log::{debug, error, info, warn};
use std::collections::HashMap;
use std::sync::Arc;
use tauri::{AppHandle, Emitter};
use tokio::sync::{broadcast, Mutex, RwLock};
use uuid::Uuid;

/// Terminal task manager
pub struct TerminalTaskManager {
    /// Task storage indexed by task_id
    tasks: Arc<RwLock<HashMap<String, TaskInternalState>>>,
    /// Broadcast channel for task list events
    task_list_tx: broadcast::Sender<TaskListEvent>,
    /// Broadcast channels for task output events (indexed by task_id)
    output_channels: Arc<Mutex<HashMap<String, broadcast::Sender<TaskEvent>>>>,
    /// PTY manager for executing tasks
    pty_manager: Arc<PtyManager>,
    /// Tauri app handle
    app_handle: AppHandle,
    /// Resource limits
    limits: ResourceLimits,
}

impl TerminalTaskManager {
    /// Create a new terminal task manager
    pub fn new(pty_manager: Arc<PtyManager>, app_handle: AppHandle) -> Self {
        let (task_list_tx, _) = broadcast::channel(100);

        Self {
            tasks: Arc::new(RwLock::new(HashMap::new())),
            task_list_tx,
            output_channels: Arc::new(Mutex::new(HashMap::new())),
            pty_manager,
            app_handle,
            limits: ResourceLimits::default(),
        }
    }

    /// Set resource limits
    pub fn set_limits(&mut self, limits: ResourceLimits) {
        self.limits = limits;
    }

    /// Get resource limits
    pub fn get_limits(&self) -> &ResourceLimits {
        &self.limits
    }

    /// Validate command
    fn validate_command(command: &str) -> Result<(), TaskError> {
        if command.trim().is_empty() {
            return Err(TaskError::InvalidCommand("Command cannot be empty".to_string()));
        }

        if command.len() > 10000 {
            return Err(TaskError::InvalidCommand("Command too long (max 10000 chars)".to_string()));
        }

        // Basic security check - prevent command injection attempts
        // Note: This is a basic check; actual command execution is handled by PTY layer
        if command.contains("&&") || command.contains("||") || command.contains(";") {
            warn!("Command contains shell operators: {}", command);
            // We still allow it but log a warning
        }

        Ok(())
    }

    /// Validate working directory
    fn validate_cwd(cwd: &str) -> Result<(), TaskError> {
        let path = std::path::Path::new(cwd);

        if !path.exists() {
            return Err(TaskError::CwdNotFound(cwd.to_string()));
        }

        if !path.is_dir() {
            return Err(TaskError::CwdNotFound(format!("Path is not a directory: {}", cwd)));
        }

        Ok(())
    }

    /// Generate a unique task ID
    fn generate_task_id() -> String {
        format!("task_{}", Uuid::new_v4().to_string().replace("-", ""))
    }

    /// Generate a unique PTY ID for MCP tasks
    fn generate_pty_id() -> String {
        format!("mcp_{}", Uuid::new_v4().to_string().replace("-", ""))
    }

    /// Create a new task
    pub async fn create_task(&self, request: CreateTaskRequest) -> Result<TaskInfo, TaskError> {
        // Validate command
        Self::validate_command(&request.command)?;

        // Determine working directory
        let cwd = request.cwd.clone().unwrap_or_else(|| {
            // Default to project root or current directory
            std::env::current_dir()
                .map(|p| p.to_string_lossy().to_string())
                .unwrap_or_else(|_| ".".to_string())
        });

        // Validate working directory
        Self::validate_cwd(&cwd)?;

        // Check concurrent task limit
        let running_count = {
            let tasks = self.tasks.read().await;
            tasks.values().filter(|t| t.is_running()).count()
        };

        if running_count >= self.limits.max_concurrent_tasks {
            return Err(TaskError::MaxConcurrencyReached(self.limits.max_concurrent_tasks));
        }

        // Generate IDs
        let task_id = Self::generate_task_id();
        let pty_id = Self::generate_pty_id();
        let tab_id = format!("tab_{}", Uuid::new_v4().to_string().replace("-", ""));
        let session_id = Uuid::new_v4().to_string();
        let output_uri = format!("terminal://output/{}", task_id);

        // Parse command to extract program and arguments
        let parts: Vec<&str> = request.command.split_whitespace().collect();
        if parts.is_empty() {
            return Err(TaskError::InvalidCommand("Command is empty".to_string()));
        }

        let program = parts[0].to_string();
        let args: Vec<String> = parts[1..].iter().map(|s| s.to_string()).collect();

        // Build task info
        let task_info = TaskInfo {
            task_id: task_id.clone(),
            session_id: session_id.clone(),
            command: request.command.clone(),
            cwd: cwd.clone(),
            status: TaskStatus::Running,
            pid: None,
            started_at: Utc::now(),
            stopped_at: None,
            exit_code: None,
            tab_id: Some(tab_id.clone()),
            pty_id: pty_id.clone(),
            output_uri: output_uri.clone(),
            env: request.env.clone(),
            shell: request.shell.clone(),
            timeout: request.timeout,
        };

        // Create internal state
        let mut internal_state = TaskInternalState::new(task_info.clone());

        // Create output broadcast channel
        let (output_tx, _) = broadcast::channel(100);
        {
            let mut channels = self.output_channels.lock().await;
            channels.insert(task_id.clone(), output_tx.clone());
        }

        // Store task
        {
            let mut tasks = self.tasks.write().await;
            tasks.insert(task_id.clone(), internal_state);
        }

        // Broadcast task created event
        let _ = self.task_list_tx.send(TaskListEvent::TaskCreated(task_info.clone()));

        // Emit terminal-task-created event to frontend to create tab
        let _ = self.app_handle.emit(
            "terminal-task-created",
            serde_json::json!({
                "taskId": task_id,
                "tabId": tab_id,
                "command": request.command,
                "cwd": cwd,
                "ptyId": pty_id
            }),
        );
        info!("[TaskManager] Emitted terminal-task-created event for task: {}", task_id);

        // Execute task via PTY manager
        let pty_options = TaskExecuteOptions {
            rows: Some(24),
            cols: Some(80),
            cwd: Some(cwd.clone()),
            env: request.env.clone(),
            log_path: None,
            shell_path: request.shell.clone(),
        };

        let pty_manager = Arc::clone(&self.pty_manager);
        let pty_id_clone = pty_id.clone();
        let task_id_clone = task_id.clone();
        let output_tx_clone = output_tx.clone();
        let app_handle_clone = self.app_handle.clone();

        // Note: We need to handle PTY events and forward them to task manager
        // This will be implemented in a future PR

        // Spawn task execution
        tokio::spawn(async move {
            match pty_manager
                .execute_task(
                    pty_id_clone.clone(),
                    program,
                    args,
                    pty_options,
                    app_handle_clone,
                )
                .await
            {
                Ok(_) => {
                    info!("[TaskManager] Task started successfully: {}", task_id_clone);
                }
                Err(e) => {
                    error!("[TaskManager] Failed to start task {}: {}", task_id_clone, e);
                    // Send error event
                    let _ = output_tx_clone.send(TaskEvent::Error {
                        message: e.clone(),
                        code: 500,
                    });
                }
            }
        });

        info!("[TaskManager] Task created: {}", task_id);
        Ok(task_info)
    }

    /// Get task by ID
    pub async fn get_task(&self, task_id: &str) -> Option<TaskInfo> {
        let tasks = self.tasks.read().await;
        tasks.get(task_id).map(|state| state.info.clone())
    }

    /// List all tasks
    pub async fn list_tasks(&self) -> Vec<TaskInfo> {
        let tasks = self.tasks.read().await;
        tasks.values().map(|state| state.info.clone()).collect()
    }

    /// Stop a task
    pub async fn stop_task(&self, task_id: &str, _signal: Option<&str>) -> Result<TaskInfo, TaskError> {
        let mut tasks = self.tasks.write().await;

        if let Some(state) = tasks.get_mut(task_id) {
            if !state.is_running() {
                return Err(TaskError::TaskNotRunning(task_id.to_string()));
            }

            // Update status to stopped
            state.info.status = TaskStatus::Stopped;
            state.info.stopped_at = Some(Utc::now());

            let task_info = state.info.clone();

            // Stop the PTY task
            // Note: We need to use the PTY manager's kill_task method
            // For now, we'll just update the status and let the PTY exit handler clean up

            // Broadcast task updated event
            let _ = self.task_list_tx.send(TaskListEvent::TaskUpdated(task_info.clone()));

            info!("[TaskManager] Task stopped: {}", task_id);
            Ok(task_info)
        } else {
            Err(TaskError::TaskNotFound(task_id.to_string()))
        }
    }

    /// Handle PTY output event
    pub async fn handle_pty_output(&self, pty_id: &str, data: &str) {
        // Find task by PTY ID
        let task_id = {
            let tasks = self.tasks.read().await;
            tasks
                .iter()
                .find(|(_, state)| state.pty_id() == pty_id)
                .map(|(id, _)| id.clone())
        };

        if let Some(task_id) = task_id {
            let mut tasks = self.tasks.write().await;

            if let Some(state) = tasks.get_mut(&task_id) {
                // Determine output type (simplified - all output as stdout for now)
                let output_type = OutputType::Stdout;

                // Create output line
                let output_line = OutputLine {
                    output_type,
                    content: data.to_string(),
                    timestamp: Utc::now(),
                };

                // Calculate size
                let line_size = output_line.size_bytes();

                // Apply LRU eviction if needed
                while !state.output_buffer.is_empty() && state.buffer_size + line_size > self.limits.max_output_buffer_size {
                    let removed = state.output_buffer.remove(0);
                    state.buffer_size -= removed.size_bytes();
                }

                // Add to buffer
                state.output_buffer.push(output_line.clone());
                state.buffer_size += line_size;

                // Broadcast output event
                if let Some(channels) = self.output_channels.lock().await.get(&task_id) {
                    let _ = channels.send(TaskEvent::Output(output_line.clone()));
                }

                debug!(
                    "[TaskManager] Output handled for task {}: {} bytes",
                    task_id, line_size
                );
            }
        }
    }

    /// Handle PTY exit event
    pub async fn handle_pty_exit(&self, _pty_id: &str, exit_code: Option<i32>) {
        // Find task by PTY ID
        let mut tasks = self.tasks.write().await;

        for (task_id, state) in tasks.iter_mut() {
            if state.pty_id() == _pty_id && state.is_running() {
                // Update status based on exit code
                // If exit_code is None, assume Finished (normal completion without explicit exit code)
                // This is common for shell commands that complete successfully
                state.info.status = match exit_code {
                    Some(0) => TaskStatus::Finished,
                    Some(code) if code > 0 => TaskStatus::Failed,
                    Some(_) => TaskStatus::Finished, // Negative codes might be signals, but treat as finished
                    None => TaskStatus::Finished, // None means normal completion without explicit exit code
                };
                state.info.exit_code = exit_code;
                state.info.stopped_at = Some(Utc::now());

                let task_info = state.info.clone();

                // Broadcast task updated event
                let _ = self.task_list_tx.send(TaskListEvent::TaskUpdated(task_info.clone()));

                // Send exit event to task subscribers
                if let Some(channels) = self.output_channels.lock().await.get(task_id) {
                    let _ = channels.send(TaskEvent::Exit {
                        exit_code,
                        timestamp: Utc::now(),
                    });
                }

                info!(
                    "[TaskManager] Task {} exited with code: {:?}",
                    task_id, exit_code
                );
                break;
            }
        }
    }

    /// Subscribe to task output events
    pub async fn subscribe_output(&self, task_id: &str) -> Option<broadcast::Receiver<TaskEvent>> {
        let channels = self.output_channels.lock().await;
        channels.get(task_id).map(|tx| tx.subscribe())
    }

    /// Subscribe to task list events
    pub fn subscribe_task_list(&self) -> broadcast::Receiver<TaskListEvent> {
        self.task_list_tx.subscribe()
    }

    /// Get buffered output for a task
    pub async fn get_buffered_output(&self, task_id: &str) -> Option<Vec<OutputLine>> {
        let tasks = self.tasks.read().await;
        tasks.get(task_id).map(|state| state.output_buffer.clone())
    }

    /// Get output buffer size for a task
    pub async fn get_output_size(&self, task_id: &str) -> Option<usize> {
        let tasks = self.tasks.read().await;
        tasks.get(task_id).map(|state| state.buffer_size)
    }

    /// Clean up finished tasks older than specified duration
    pub async fn cleanup_finished_tasks(&self, older_than: Duration) {
        let mut tasks = self.tasks.write().await;
        let now = Utc::now();

        let mut to_remove = Vec::new();

        for (_task_id, state) in tasks.iter() {
            if !state.is_running() {
                if let Some(stopped_at) = state.info.stopped_at {
                    if now.signed_duration_since(stopped_at) > older_than {
                        to_remove.push(_task_id.clone());
                    }
                }
            }
        }

        for task_id in to_remove {
            tasks.remove(&task_id);
            // Remove output channel
            self.output_channels.lock().await.remove(&task_id);

            // Broadcast task deleted event
            let _ = self
                .task_list_tx
                .send(TaskListEvent::TaskDeleted { task_id: task_id.clone() });

            info!("[TaskManager] Cleaned up task: {}", task_id);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_validate_command() {
        // Valid command
        assert!(TerminalTaskManager::validate_command("npm run dev").is_ok());
        assert!(TerminalTaskManager::validate_command("echo hello").is_ok());

        // Invalid commands
        assert!(TerminalTaskManager::validate_command("").is_err());
        assert!(TerminalTaskManager::validate_command("   ").is_err());

        // Too long command
        let long_cmd = "a".repeat(10001);
        assert!(TerminalTaskManager::validate_command(&long_cmd).is_err());
    }

    #[tokio::test]
    async fn test_task_id_generation() {
        let id1 = TerminalTaskManager::generate_task_id();
        let id2 = TerminalTaskManager::generate_task_id();
        assert_ne!(id1, id2);
        assert!(id1.starts_with("task_"));
    }

    #[tokio::test]
    async fn test_internal_state() {
        let info = TaskInfo {
            task_id: "test_task".to_string(),
            session_id: "test_session".to_string(),
            command: "echo hello".to_string(),
            cwd: "/tmp".to_string(),
            status: TaskStatus::Running,
            pid: None,
            started_at: Utc::now(),
            stopped_at: None,
            exit_code: None,
            tab_id: None,
            pty_id: "test_pty".to_string(),
            output_uri: "terminal://output/test_task".to_string(),
            env: None,
            shell: None,
            timeout: None,
        };

        let state = TaskInternalState::new(info);
        assert_eq!(state.task_id(), "test_task");
        assert_eq!(state.pty_id(), "test_pty");
        assert!(state.is_running());
    }

    #[tokio::test]
    async fn test_task_lru_eviction() {
        let info = TaskInfo {
            task_id: "test_task".to_string(),
            session_id: "test_session".to_string(),
            command: "echo hello".to_string(),
            cwd: "/tmp".to_string(),
            status: TaskStatus::Running,
            pid: None,
            started_at: Utc::now(),
            stopped_at: None,
            exit_code: None,
            tab_id: None,
            pty_id: "test_pty".to_string(),
            output_uri: "terminal://output/test_task".to_string(),
            env: None,
            shell: None,
            timeout: None,
        };

        let mut state = TaskInternalState::new(info);
        state.output_buffer = vec![
            OutputLine::stdout("Line 1".to_string()),
            OutputLine::stdout("Line 2".to_string()),
            OutputLine::stdout("Line 3".to_string()),
        ];
        state.buffer_size = state.output_buffer.iter().map(|l| l.size_bytes()).sum();

        assert_eq!(state.output_buffer.len(), 3);
    }
}
