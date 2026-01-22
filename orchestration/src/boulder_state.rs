//! # Boulder State Persistence
//!
//! This module provides persistent state management for orchestration sessions.
//! Similar to Oh-My-OpenCode's boulder.json, this allows sessions to be saved
//! and restored, enabling task continuity across application restarts.

use crate::orchestrator::TaskGoal;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use tokio::fs;
use tokio::io::{AsyncReadExt, AsyncWriteExt};

/// Boulder state representing the current state of an orchestration session
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BoulderState {
    /// Session ID
    pub session_id: String,
    /// Plan name or task identifier
    pub plan_name: String,
    /// Project path
    pub project_path: String,
    /// Task goal
    pub goal: TaskGoal,
    /// Progress information
    pub progress: ProgressInfo,
    /// Conversation history (for context recovery)
    pub conversation_history: Vec<String>,
    /// Current supervisor decision
    #[serde(skip_serializing_if = "Option::is_none")]
    pub current_decision: Option<String>,
    /// Completed milestones
    pub completed_milestones: Vec<String>,
    /// Custom context data
    #[serde(default)]
    pub context: HashMap<String, serde_json::Value>,
    /// Timestamps
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    /// Session IDs that contributed to this boulder
    #[serde(default)]
    pub session_ids: Vec<String>,
}

/// Progress information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProgressInfo {
    /// Current round number
    pub current_round: usize,
    /// Maximum rounds
    pub max_rounds: usize,
    /// Number of completed steps
    pub completed_steps: usize,
    /// Total expected steps (may be 0 if unknown)
    pub total_steps: usize,
    /// Current action description
    pub current_action: String,
    /// Whether the task appears stuck
    #[serde(default)]
    pub is_stuck: bool,
    /// Number of consecutive stuck detections
    #[serde(default)]
    pub stuck_count: usize,
}

impl Default for ProgressInfo {
    fn default() -> Self {
        Self {
            current_round: 0,
            max_rounds: 10,
            completed_steps: 0,
            total_steps: 0,
            current_action: "Initializing".to_string(),
            is_stuck: false,
            stuck_count: 0,
        }
    }
}

impl BoulderState {
    /// Create a new boulder state
    pub fn new(session_id: String, plan_name: String, project_path: String, goal: TaskGoal) -> Self {
        let now = Utc::now();
        Self {
            session_id,
            plan_name,
            project_path,
            goal,
            progress: ProgressInfo::default(),
            conversation_history: Vec::new(),
            current_decision: None,
            completed_milestones: Vec::new(),
            context: HashMap::new(),
            created_at: now,
            updated_at: now,
            session_ids: vec![],
        }
    }

    /// Update progress
    pub fn update_progress(&mut self, round: usize, action: String) {
        self.progress.current_round = round;
        self.progress.current_action = action;
        self.updated_at = Utc::now();
    }

    /// Add to conversation history
    pub fn add_conversation(&mut self, message: String) {
        self.conversation_history.push(message);
        // Keep only last 100 messages to avoid bloat
        if self.conversation_history.len() > 100 {
            self.conversation_history.remove(0);
        }
        self.updated_at = Utc::now();
    }

    /// Append session ID
    pub fn append_session_id(&mut self, session_id: String) {
        if !self.session_ids.contains(&session_id) {
            self.session_ids.push(session_id);
        }
        self.updated_at = Utc::now();
    }

    /// Mark milestone as completed
    pub fn complete_milestone(&mut self, milestone: String) {
        if !self.completed_milestones.contains(&milestone) {
            self.completed_milestones.push(milestone);
        }
        self.updated_at = Utc::now();
    }

    /// Set context value
    pub fn set_context(&mut self, key: String, value: serde_json::Value) {
        self.context.insert(key, value);
        self.updated_at = Utc::now();
    }
}

/// Boulder state manager for file I/O
pub struct BoulderStateManager {
    base_dir: PathBuf,
}

impl BoulderStateManager {
    /// Create a new boulder state manager
    pub fn new(project_path: &Path) -> Self {
        let base_dir = project_path.join(".rebebuca");
        Self { base_dir }
    }

    /// Get the boulder state file path
    fn boulder_path(&self) -> PathBuf {
        self.base_dir.join("boulder.json")
    }

    /// Ensure the base directory exists
    async fn ensure_dir(&self) -> Result<(), std::io::Error> {
        if !self.base_dir.exists() {
            fs::create_dir_all(&self.base_dir).await?;
        }
        Ok(())
    }

    /// Save boulder state to file
    pub async fn save(&self, state: &BoulderState) -> Result<(), anyhow::Error> {
        self.ensure_dir().await?;
        
        let path = self.boulder_path();
        let json = serde_json::to_string_pretty(state)?;
        
        let mut file = fs::File::create(&path).await?;
        file.write_all(json.as_bytes()).await?;
        file.sync_all().await?;
        
        Ok(())
    }

    /// Load boulder state from file
    pub async fn load(&self) -> Result<Option<BoulderState>, anyhow::Error> {
        let path = self.boulder_path();
        
        if !path.exists() {
            return Ok(None);
        }

        let mut file = fs::File::open(&path).await?;
        let mut contents = String::new();
        file.read_to_string(&mut contents).await?;

        let state: BoulderState = serde_json::from_str(&contents)?;
        Ok(Some(state))
    }

    /// Delete boulder state file
    pub async fn delete(&self) -> Result<(), anyhow::Error> {
        let path = self.boulder_path();
        if path.exists() {
            fs::remove_file(&path).await?;
        }
        Ok(())
    }

    /// Check if boulder state exists
    pub fn exists(&self) -> bool {
        self.boulder_path().exists()
    }

    /// Get the base directory path
    pub fn base_dir(&self) -> &Path {
        &self.base_dir
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[tokio::test]
    async fn test_boulder_state_creation() {
        let state = BoulderState::new(
            "test-session".to_string(),
            "test-plan".to_string(),
            "/test/path".to_string(),
            TaskGoal {
                objective: "Test objective".to_string(),
                task_name: None,
                acceptance_criteria: vec!["Criterion 1".to_string()],
                context: None,
                constraints: vec![],
            },
        );

        assert_eq!(state.session_id, "test-session");
        assert_eq!(state.plan_name, "test-plan");
        assert_eq!(state.progress.current_round, 0);
    }

    #[tokio::test]
    async fn test_boulder_state_save_load() {
        let temp_dir = TempDir::new().unwrap();
        let manager = BoulderStateManager::new(temp_dir.path());

        let mut state = BoulderState::new(
            "test-session".to_string(),
            "test-plan".to_string(),
            temp_dir.path().to_string_lossy().to_string(),
            TaskGoal {
                objective: "Test objective".to_string(),
                task_name: None,
                acceptance_criteria: vec!["Criterion 1".to_string()],
                context: None,
                constraints: vec![],
            },
        );

        state.update_progress(5, "Testing".to_string());
        state.add_conversation("Test message".to_string());

        // Save
        manager.save(&state).await.unwrap();

        // Load
        let loaded = manager.load().await.unwrap().unwrap();
        assert_eq!(loaded.session_id, state.session_id);
        assert_eq!(loaded.progress.current_round, 5);
        assert_eq!(loaded.conversation_history.len(), 1);
    }
}
