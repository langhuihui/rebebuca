//! Storage adapter for persisting user data

use serde_json::Value;
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;
use tokio::fs;
use tokio::sync::RwLock;

/// Storage adapter for key-value persistence
pub struct StorageAdapter {
    /// Storage directory
    storage_dir: PathBuf,
    /// In-memory cache per user
    cache: Arc<RwLock<HashMap<String, HashMap<String, Value>>>>,
}

impl StorageAdapter {
    pub fn new(storage_dir: PathBuf) -> Self {
        Self {
            storage_dir,
            cache: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// Get the storage file path for a user
    fn get_user_file(&self, user_id: &str) -> PathBuf {
        self.storage_dir.join(format!("{}.json", user_id))
    }

    /// Load user data from file
    async fn load_user_data(&self, user_id: &str) -> HashMap<String, Value> {
        let file_path = self.get_user_file(user_id);
        
        if file_path.exists() {
            if let Ok(content) = fs::read_to_string(&file_path).await {
                if let Ok(data) = serde_json::from_str(&content) {
                    return data;
                }
            }
        }
        
        HashMap::new()
    }

    /// Save user data to file
    async fn save_user_data(&self, user_id: &str, data: &HashMap<String, Value>) -> Result<(), String> {
        tracing::debug!("Saving user data for user_id: {}, storage_dir: {:?}", user_id, self.storage_dir);

        // Ensure storage directory exists
        if !self.storage_dir.exists() {
            tracing::debug!("Creating storage directory: {:?}", self.storage_dir);
            if let Err(e) = fs::create_dir_all(&self.storage_dir).await {
                return Err(format!("Failed to create storage directory: {}", e));
            }
            tracing::debug!("Storage directory created successfully");
        }

        let file_path = self.get_user_file(user_id);
        tracing::debug!("Writing to file: {:?}", file_path);

        let content = serde_json::to_string_pretty(data)
            .map_err(|e| format!("Failed to serialize data: {}", e))?;

        if let Err(e) = fs::write(&file_path, content).await {
            return Err(format!("Failed to write storage file: {}", e));
        }

        tracing::debug!("User data saved successfully");
        Ok(())
    }

    /// Get a value from storage
    pub async fn get(&self, user_id: &str, key: &str) -> Option<Value> {
        // Check cache first
        {
            let cache = self.cache.read().await;
            if let Some(user_data) = cache.get(user_id) {
                return user_data.get(key).cloned();
            }
        }

        // Load from file
        let user_data = self.load_user_data(user_id).await;
        let value = user_data.get(key).cloned();

        // Update cache
        {
            let mut cache = self.cache.write().await;
            cache.insert(user_id.to_string(), user_data);
        }

        value
    }

    /// Set a value in storage
    pub async fn set(&self, user_id: &str, key: &str, value: Value) -> Result<(), String> {
        // Load current data
        let mut user_data = {
            let cache = self.cache.read().await;
            match cache.get(user_id).cloned() {
                Some(data) => data,
                None => self.load_user_data(user_id).await,
            }
        };

        user_data.insert(key.to_string(), value);

        // Update cache
        {
            let mut cache = self.cache.write().await;
            cache.insert(user_id.to_string(), user_data.clone());
        }

        // Save to file
        self.save_user_data(user_id, &user_data).await
    }

    /// Delete a value from storage
    pub async fn delete(&self, user_id: &str, key: &str) -> Result<(), String> {
        // Load current data
        let mut user_data = self.load_user_data(user_id).await;
        user_data.remove(key);

        // Update cache
        {
            let mut cache = self.cache.write().await;
            cache.insert(user_id.to_string(), user_data.clone());
        }

        // Save to file
        self.save_user_data(user_id, &user_data).await
    }

    /// Save all cached data (flush to disk)
    pub async fn save(&self, user_id: &str) -> Result<(), String> {
        let cache = self.cache.read().await;
        if let Some(user_data) = cache.get(user_id) {
            self.save_user_data(user_id, user_data).await
        } else {
            Ok(())
        }
    }

    /// Clear cache for a user
    #[allow(dead_code)]
    pub async fn clear_cache(&self, user_id: &str) {
        let mut cache = self.cache.write().await;
        cache.remove(user_id);
    }
}

impl Default for StorageAdapter {
    fn default() -> Self {
        let storage_dir = std::env::temp_dir().join("rebebuca-storage");
        Self::new(storage_dir)
    }
}
