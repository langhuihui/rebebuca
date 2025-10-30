use anyhow::Result;
use chrono::Utc;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::Mutex;
use uuid::Uuid;

use crate::models::RunConfig;
use crate::storage::StorageManager;

#[derive(Debug)]
pub struct ConfigManager {
    storage_manager: Arc<StorageManager>,
    configs: Arc<Mutex<Vec<RunConfig>>>,
}

impl ConfigManager {
    pub fn new(storage_manager: Arc<StorageManager>) -> Self {
        Self {
            storage_manager,
            configs: Arc::new(Mutex::new(Vec::new())),
        }
    }

    pub async fn load_configs(&self) -> Result<()> {
        let configs = self.storage_manager.load_configs().await?;
        let mut configs_lock = self.configs.lock().await;
        *configs_lock = configs;
        Ok(())
    }

    pub async fn save_configs(&self) -> Result<()> {
        let configs = self.configs.lock().await;
        self.storage_manager.save_configs(&*configs).await?;
        Ok(())
    }

    pub async fn get_all_configs(&self) -> Result<Vec<RunConfig>> {
        let configs = self.configs.lock().await;
        Ok(configs.clone())
    }

    pub async fn get_config_by_id(&self, id: &str) -> Result<Option<RunConfig>> {
        let configs = self.configs.lock().await;
        Ok(configs.iter().find(|c| c.id == id).cloned())
    }

    pub async fn create_config(&self, mut config: RunConfig) -> Result<RunConfig> {
        // Generate new ID and timestamps
        config.id = Uuid::new_v4().to_string();
        config.created_at = Utc::now();
        config.updated_at = Utc::now();

        let mut configs = self.configs.lock().await;
        configs.push(config.clone());
        self.storage_manager.save_configs(&*configs).await?;
        
        Ok(config)
    }

    pub async fn update_config(&self, id: &str, mut updated_config: RunConfig) -> Result<Option<RunConfig>> {
        let mut configs = self.configs.lock().await;
        
        if let Some(config) = configs.iter_mut().find(|c| c.id == id) {
            // Preserve original ID and created_at
            updated_config.id = config.id.clone();
            updated_config.created_at = config.created_at;
            updated_config.updated_at = Utc::now();
            
            *config = updated_config.clone();
            self.storage_manager.save_configs(&*configs).await?;
            Ok(Some(updated_config))
        } else {
            Ok(None)
        }
    }

    pub async fn delete_config(&self, id: &str) -> Result<bool> {
        let mut configs = self.configs.lock().await;
        let original_len = configs.len();
        configs.retain(|c| c.id != id);
        
        if configs.len() < original_len {
            self.storage_manager.save_configs(&*configs).await?;
            Ok(true)
        } else {
            Ok(false)
        }
    }

    pub async fn duplicate_config(&self, id: &str) -> Result<Option<RunConfig>> {
        if let Some(config) = self.get_config_by_id(id).await? {
            let mut duplicated = config.clone();
            duplicated.name = format!("{} (Copy)", duplicated.name);
            duplicated.id = Uuid::new_v4().to_string();
            duplicated.created_at = Utc::now();
            duplicated.updated_at = Utc::now();
            
            Ok(Some(self.create_config(duplicated).await?))
        } else {
            Ok(None)
        }
    }

    pub async fn search_configs(&self, query: &str) -> Result<Vec<RunConfig>> {
        let configs = self.configs.lock().await;
        let query_lower = query.to_lowercase();
        
        let results: Vec<RunConfig> = configs
            .iter()
            .filter(|config| {
                config.name.to_lowercase().contains(&query_lower) ||
                config.command.to_lowercase().contains(&query_lower) ||
                config.working_directory.as_ref()
                    .map(|dir| dir.to_lowercase().contains(&query_lower))
                    .unwrap_or(false)
            })
            .cloned()
            .collect();
        
        Ok(results)
    }

    pub async fn get_configs_count(&self) -> usize {
        let configs = self.configs.lock().await;
        configs.len()
    }

    pub async fn clear_all_configs(&self) -> Result<()> {
        let mut configs = self.configs.lock().await;
        configs.clear();
        self.storage_manager.save_configs(&*configs).await?;
        Ok(())
    }
}
