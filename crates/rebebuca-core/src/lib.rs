pub mod models;
pub mod process;
pub mod storage;
pub mod config_manager;
pub mod i18n;
pub mod syntax_highlighting;
pub mod search_filter;
pub mod settings;
pub mod performance;
pub mod error_handling;
pub mod tests;

use anyhow::Result;
use std::sync::Arc;
use tokio::sync::{Mutex, RwLock};

use storage::StorageManager;
use config_manager::ConfigManager;
// use settings::SettingsManager;

#[derive(Debug, Clone)]
pub struct AppState {
    pub storage_manager: Arc<StorageManager>,
    pub config_manager: Arc<ConfigManager>,
    pub i18n_manager: Arc<RwLock<i18n::I18nManager>>,
    pub search_manager: Arc<RwLock<search_filter::SearchManager>>,
    pub settings_manager: Arc<settings::SettingsManager>,
    pub performance_manager: Arc<performance::PerformanceManager>,
    pub error_handler: Arc<error_handling::ErrorHandler>,
    pub run_configs: Arc<Mutex<Vec<models::RunConfig>>>,
    pub run_history: Arc<Mutex<Vec<models::RunHistory>>>,
}

impl AppState {
    pub async fn new() -> Result<Self> {
        let storage_manager = Arc::new(StorageManager::new()?);
        let config_manager = Arc::new(ConfigManager::new(storage_manager.clone()));
        let i18n_manager = Arc::new(RwLock::new(i18n::I18nManager::new()));
        let search_manager = Arc::new(RwLock::new(search_filter::SearchManager::new()));
        let settings_manager = Arc::new(settings::SettingsManager::new("settings.json".to_string())?);
        let performance_manager = Arc::new(performance::PerformanceManager::new());
        let error_handler = Arc::new(error_handling::ErrorHandler::new(1000));
        
        // Load initial data
        config_manager.load_configs().await?;
        let run_configs = Arc::new(Mutex::new(config_manager.get_all_configs().await?));
        let run_history = Arc::new(Mutex::new(storage_manager.load_history().await?));

        Ok(Self {
            storage_manager,
            config_manager,
            i18n_manager,
            search_manager,
            settings_manager,
            performance_manager,
            error_handler,
            run_configs,
            run_history,
        })
    }
}

pub use models::*;
pub use process::*;
pub use storage::*;
pub use i18n::*;
pub use syntax_highlighting::*;
pub use search_filter::*;
pub use settings::*;
pub use config_manager::*;
pub use performance::*;
pub use error_handling::*;
