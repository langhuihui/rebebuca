//! Orchestration module for Tauri
//!
//! This module provides orchestration capabilities for the Tauri desktop application,
//! including local tool execution and session management.

mod executor;
mod llm;
mod session;

pub use executor::LocalToolExecutor;
pub use session::{OrchestrationSession, SessionManager};

use rebebuca_orchestration::{
    context::{ErrorEvent, OrchestrationEvent},
    orchestrator::TaskGoal,
};
use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tauri::{AppHandle, Emitter, State};
use tokio::sync::mpsc;

/// Orchestration configuration from frontend
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OrchestrationConfig {
    pub project_path: String,
    pub supervisor_provider: ProviderConfig,
    pub worker_provider: ProviderConfig,
    pub max_rounds: Option<usize>,
    pub auto_approve_permissions: Option<bool>,
}

/// Provider configuration (matches frontend)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderConfig {
    pub provider: String,
    pub model: String,
    pub api_key: Option<String>,
    pub base_url: Option<String>,
}

/// Orchestration status
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OrchestrationStatus {
    pub session_id: String,
    pub status: String, // "idle", "running", "completed", "error"
    pub current_round: usize,
    pub max_rounds: usize,
    pub current_action: String,
}

/// Create a new orchestration session
#[tauri::command]
pub async fn create_orchestration_session(
    app_handle: AppHandle,
    config: OrchestrationConfig,
    session_manager: State<'_, SessionManager>,
) -> Result<String, String> {
    let session_id = uuid::Uuid::new_v4().to_string();
    
    // Create tool executor
    let executor = LocalToolExecutor::new(
        app_handle.clone(),
        &config.project_path,
        &session_id,
    );
    
    // Create session
    let session = OrchestrationSession::new(
        session_id.clone(),
        config,
        Arc::new(executor),
    );
    
    // Store session
    session_manager.add_session(session).await;
    
    log::info!("[Orchestration] Created session: {}", session_id);
    
    Ok(session_id)
}

/// Start orchestration
#[tauri::command]
pub async fn start_orchestration(
    app_handle: AppHandle,
    session_id: String,
    goal: TaskGoal,
    session_manager: State<'_, SessionManager>,
) -> Result<(), String> {
    let session = session_manager
        .get_session(&session_id)
        .await
        .ok_or_else(|| format!("Session not found: {}", session_id))?;
    
    // Setup event forwarding
    let (tx, mut rx) = mpsc::unbounded_channel::<OrchestrationEvent>();
    
    let app_handle_clone = app_handle.clone();
    tokio::spawn(async move {
        log::info!("[Orchestration] Event forwarding task started");
        while let Some(event) = rx.recv().await {
            let event_name = format!("orchestration:{}", event.event_type());
            log::debug!("[Orchestration] Forwarding event: {} for session", event_name);
            if let Err(e) = app_handle_clone.emit(&event_name, &event) {
                log::error!("[Orchestration] Failed to emit event {}: {}", event_name, e);
            } else {
                log::debug!("[Orchestration] Successfully emitted event: {}", event_name);
            }
        }
        log::warn!("[Orchestration] Event forwarding task ended (channel closed)");
    });
    
    // Start orchestration in background
    let session_clone = session.clone();
    let app_handle_err = app_handle.clone();
    let session_id_for_log = session_id.clone();
    tokio::spawn(async move {
        log::info!("[Orchestration] Background task started for session: {}", session_id_for_log);
        if let Err(e) = session_clone.start(goal, Some(tx)).await {
            let error_msg = format!("Orchestration failed: {}", e);
            // Don't treat "stopped by user" as an error
            if !error_msg.contains("stopped by user") && !error_msg.contains("Orchestration stopped by user") {
                log::error!("[Orchestration] Session {} failed: {}", session_id, error_msg);
                
                // Emit error event to frontend
                let error_event = OrchestrationEvent::Error(ErrorEvent {
                    session_id: session_id.clone(),
                    error: error_msg,
                    agent: None,
                    recoverable: false,
                    timestamp: Utc::now(),
                });
                if let Err(emit_err) = app_handle_err.emit("orchestration:error", &error_event) {
                    log::error!("[Orchestration] Failed to emit error event: {}", emit_err);
                }
            } else {
                log::info!("[Orchestration] Session {} stopped by user", session_id);
            }
        }
    });
    
    Ok(())
}

/// Stop orchestration
#[tauri::command]
pub async fn stop_orchestration(
    session_id: String,
    session_manager: State<'_, SessionManager>,
) -> Result<(), String> {
    let session = session_manager
        .get_session(&session_id)
        .await
        .ok_or_else(|| format!("Session not found: {}", session_id))?;
    
    session.stop().await;
    
    log::info!("[Orchestration] Stopped session: {}", session_id);
    
    Ok(())
}

/// Get orchestration status
#[tauri::command]
pub async fn get_orchestration_status(
    session_id: String,
    session_manager: State<'_, SessionManager>,
) -> Result<OrchestrationStatus, String> {
    let session = session_manager
        .get_session(&session_id)
        .await
        .ok_or_else(|| format!("Session not found: {}", session_id))?;
    
    Ok(session.get_status().await)
}

/// Remove orchestration session
#[tauri::command]
pub async fn remove_orchestration_session(
    session_id: String,
    session_manager: State<'_, SessionManager>,
) -> Result<(), String> {
    session_manager.remove_session(&session_id).await;
    log::info!("[Orchestration] Removed session: {}", session_id);
    Ok(())
}

/// Check if boulder state exists for a project path
#[tauri::command]
pub async fn check_boulder_state(project_path: String) -> Result<Option<serde_json::Value>, String> {
    use rebebuca_orchestration::boulder_state::BoulderStateManager;
    use std::path::Path;
    
    let project_path = Path::new(&project_path);
    let boulder_manager = BoulderStateManager::new(project_path);
    
    match boulder_manager.load().await {
        Ok(Some(state)) => {
            // Return boulder state info
            Ok(Some(serde_json::json!({
                "exists": true,
                "session_id": state.session_id,
                "plan_name": state.plan_name,
                "goal": {
                    "objective": state.goal.objective,
                    "taskName": state.goal.task_name,
                    "acceptanceCriteria": state.goal.acceptance_criteria,
                    "context": state.goal.context,
                    "constraints": state.goal.constraints,
                },
                "progress": {
                    "current_round": state.progress.current_round,
                    "current_action": state.progress.current_action,
                },
                "created_at": state.created_at.to_rfc3339(),
                "updated_at": state.updated_at.to_rfc3339(),
            })))
        }
        Ok(None) => Ok(Some(serde_json::json!({ "exists": false }))),
        Err(e) => Err(format!("Failed to check boulder state: {}", e)),
    }
}
