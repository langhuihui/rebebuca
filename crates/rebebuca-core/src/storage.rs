use crate::models::*;
use anyhow::{Context, Result};
use chrono::{DateTime, Utc};
use dirs;
use serde_json;
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use log::{debug, error, info, warn};

#[derive(Debug)]
pub struct StorageManager {
    config_dir: PathBuf,
    data_dir: PathBuf,
    logs_dir: PathBuf,
}

impl StorageManager {
    pub fn new() -> Result<Self> {
        let config_dir = dirs::config_dir()
            .ok_or_else(|| anyhow::anyhow!("Failed to get config directory"))?
            .join("rebebuca");
        
        let data_dir = dirs::data_dir()
            .ok_or_else(|| anyhow::anyhow!("Failed to get data directory"))?
            .join("rebebuca");
        
        let logs_dir = data_dir.join("logs");

        // Create directories if they don't exist
        fs::create_dir_all(&config_dir)
            .context("Failed to create config directory")?;
        fs::create_dir_all(&data_dir)
            .context("Failed to create data directory")?;
        fs::create_dir_all(&logs_dir)
            .context("Failed to create logs directory")?;

        Ok(Self {
            config_dir,
            data_dir,
            logs_dir,
        })
    }

    pub fn get_logs_dir(&self) -> &PathBuf {
        &self.logs_dir
    }

    // Configuration management
    pub async fn load_configs(&self) -> Result<Vec<RunConfig>> {
        let config_path = self.config_dir.join("configs.json");
        
        if !config_path.exists() {
            // Return default configs if none exist
            return Ok(self.get_default_configs());
        }

        let content = fs::read_to_string(&config_path)
            .context("Failed to read configs file")?;
        
        let configs: Vec<RunConfig> = serde_json::from_str(&content)
            .context("Failed to parse configs file")?;
        
        debug!("Loaded {} configs from storage", configs.len());
        Ok(configs)
    }

    pub async fn save_configs(&self, configs: &[RunConfig]) -> Result<()> {
        let config_path = self.config_dir.join("configs.json");
        let content = serde_json::to_string_pretty(configs)
            .context("Failed to serialize configs")?;
        
        fs::write(&config_path, content)
            .context("Failed to write configs file")?;
        
        debug!("Saved {} configs to storage", configs.len());
        Ok(())
    }

    // History management
    pub async fn load_history(&self) -> Result<Vec<RunHistory>> {
        let history_path = self.config_dir.join("history.json");
        
        if !history_path.exists() {
            return Ok(Vec::new());
        }

        let content = fs::read_to_string(&history_path)
            .context("Failed to read history file")?;
        
        let history: Vec<RunHistory> = serde_json::from_str(&content)
            .context("Failed to parse history file")?;
        
        debug!("Loaded {} history items from storage", history.len());
        Ok(history)
    }

    pub async fn save_history(&self, history: &[RunHistory]) -> Result<()> {
        let history_path = self.config_dir.join("history.json");
        
        // Only save recent 100 items to prevent file from growing too large
        let recent_history = if history.len() > 100 {
            &history[..100]
        } else {
            history
        };
        
        let content = serde_json::to_string_pretty(recent_history)
            .context("Failed to serialize history")?;
        
        fs::write(&history_path, content)
            .context("Failed to write history file")?;
        
        debug!("Saved {} history items to storage", recent_history.len());
        Ok(())
    }

    // Log file management
    pub async fn read_log_file(&self, log_filename: &str) -> Result<String> {
        let log_path = self.logs_dir.join(log_filename);
        
        if !log_path.exists() {
            return Err(anyhow::anyhow!("Log file does not exist"));
        }

        let content = fs::read_to_string(&log_path)
            .context("Failed to read log file")?;
        
        Ok(content)
    }

    pub async fn delete_log_file(&self, log_filename: &str) -> Result<()> {
        let log_path = self.logs_dir.join(log_filename);
        
        if log_path.exists() {
            fs::remove_file(&log_path)
                .context("Failed to delete log file")?;
            debug!("Deleted log file: {}", log_filename);
        }
        
        Ok(())
    }

    pub async fn open_logs_folder(&self) -> Result<()> {
        #[cfg(target_os = "macos")]
        {
            std::process::Command::new("open")
                .arg(&self.logs_dir)
                .spawn()
                .context("Failed to open logs folder")?;
        }

        #[cfg(target_os = "windows")]
        {
            std::process::Command::new("explorer")
                .arg(&self.logs_dir)
                .spawn()
                .context("Failed to open logs folder")?;
        }

        #[cfg(target_os = "linux")]
        {
            std::process::Command::new("xdg-open")
                .arg(&self.logs_dir)
                .spawn()
                .context("Failed to open logs folder")?;
        }

        Ok(())
    }

    fn get_default_configs(&self) -> Vec<RunConfig> {
        vec![
            RunConfig::new(
                "1".to_string(),
                "示例配置 - Echo".to_string(),
                "echo".to_string(),
                None,
                None,
                Some(vec!["Hello, Rebebuca!".to_string()]),
            ),
            RunConfig::new(
                "2".to_string(),
                "示例配置 - 列出文件".to_string(),
                "ls".to_string(),
                None,
                None,
                Some(vec!["-la".to_string()]),
            ),
        ]
    }
}

// Application state management
pub struct AppState {
    pub configs: Vec<RunConfig>,
    pub history: Vec<RunHistory>,
    pub storage: StorageManager,
    pub process_manager: crate::process::ProcessManager,
}

impl AppState {
    pub async fn new() -> Result<Self> {
        let storage = StorageManager::new()?;
        let process_manager = crate::process::ProcessManager::new();
        
        let configs = storage.load_configs().await.unwrap_or_else(|e| {
            error!("Failed to load configs: {}", e);
            storage.get_default_configs()
        });
        
        let history = storage.load_history().await.unwrap_or_else(|e| {
            error!("Failed to load history: {}", e);
            Vec::new()
        });

        Ok(Self {
            configs,
            history,
            storage,
            process_manager,
        })
    }

    // Configuration CRUD operations
    pub async fn add_config(&mut self, config: RunConfig) -> Result<()> {
        self.configs.push(config);
        self.storage.save_configs(&self.configs).await?;
        Ok(())
    }

    pub async fn update_config(&mut self, id: &str, updates: RunConfigUpdate) -> Result<()> {
        if let Some(config) = self.configs.iter_mut().find(|c| c.id == id) {
            config.update(updates);
            self.storage.save_configs(&self.configs).await?;
        }
        Ok(())
    }

    pub async fn delete_config(&mut self, id: &str) -> Result<()> {
        self.configs.retain(|c| c.id != id);
        self.storage.save_configs(&self.configs).await?;
        Ok(())
    }

    pub fn get_config(&self, id: &str) -> Option<&RunConfig> {
        self.configs.iter().find(|c| c.id == id)
    }

    // History operations
    pub async fn add_history(&mut self, history_item: RunHistory) -> Result<()> {
        self.history.insert(0, history_item); // Insert at beginning
        self.storage.save_history(&self.history).await?;
        Ok(())
    }

    pub async fn update_history(&mut self, id: &str, updates: RunHistoryUpdate) -> Result<()> {
        if let Some(history_item) = self.history.iter_mut().find(|h| h.id == id) {
            history_item.update(updates);
            self.storage.save_history(&self.history).await?;
        }
        Ok(())
    }

    pub async fn delete_history(&mut self, id: &str) -> Result<()> {
        if let Some(history_item) = self.history.iter().find(|h| h.id == id) {
            // Delete associated log file if it exists
            if let Some(log_filename) = &history_item.log_filename {
                if let Err(e) = self.storage.delete_log_file(log_filename).await {
                    warn!("Failed to delete log file {}: {}", log_filename, e);
                }
            }
        }
        
        self.history.retain(|h| h.id != id);
        self.storage.save_history(&self.history).await?;
        Ok(())
    }

    pub async fn clear_history(&mut self) -> Result<()> {
        // Delete all log files before clearing history
        for item in &self.history {
            if let Some(log_filename) = &item.log_filename {
                if let Err(e) = self.storage.delete_log_file(log_filename).await {
                    warn!("Failed to delete log file {}: {}", log_filename, e);
                }
            }
        }
        
        self.history.clear();
        self.storage.save_history(&self.history).await?;
        Ok(())
    }

    pub fn get_history(&self, id: &str) -> Option<&RunHistory> {
        self.history.iter().find(|h| h.id == id)
    }

    pub fn find_history_by_process_id(&self, process_id: &str) -> Option<&RunHistory> {
        // First try to find by pid (system PID)
        let result = self.history.iter().find(|item| {
            item.pid.as_ref().map(|pid| pid == process_id).unwrap_or(false)
        });

        // If not found and processId looks like a UUID, try to find by internalId
        if result.is_none() && process_id.contains("-") {
            return self.history.iter().find(|item| {
                item.internal_id.as_ref().map(|id| id == process_id).unwrap_or(false)
            });
        }

        result
    }
}
