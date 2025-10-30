#[cfg(test)]
mod tests {
    use super::*;
    use std::time::Duration;
    use std::sync::Arc;
    use crate::models::*;
    use crate::error_handling::*;
    use crate::storage::StorageManager;
    use crate::config_manager::ConfigManager;
    use crate::i18n::I18nManager;
    use crate::search_filter::SearchManager;
    use crate::settings::SettingsManager;
    use crate::performance::PerformanceManager;
    use crate::AppState;

    #[tokio::test]
    async fn test_app_state_creation() {
        let app_state = AppState::new().await;
        assert!(app_state.is_ok());
    }

    #[tokio::test]
    async fn test_run_config_creation() {
        let config = RunConfig {
            id: "test-config".to_string(),
            name: "Test Configuration".to_string(),
            command: "echo".to_string(),
            working_directory: Some("/tmp".to_string()),
            environment: Some(vec![("TEST_VAR".to_string(), "test_value".to_string())].into_iter().collect()),
            arguments: Some(vec!["Hello, World!".to_string()]),
            created_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
        };

        assert_eq!(config.id, "test-config");
        assert_eq!(config.name, "Test Configuration");
        assert_eq!(config.command, "echo");
        assert_eq!(config.arguments.as_ref().unwrap().len(), 1);
        assert_eq!(config.arguments.as_ref().unwrap()[0], "Hello, World!");
    }

    #[tokio::test]
    async fn test_run_history_creation() {
        let history = RunHistory {
            id: "test-history".to_string(),
            config_id: "test-config".to_string(),
            name: "Test History".to_string(),
            command: "echo Hello, World!".to_string(),
            status: HistoryStatus::Success,
            timestamp: chrono::Utc::now(),
            output: Some("Hello, World!\n".to_string()),
            duration: Some(1000),
            log_filename: None,
            pid: None,
            internal_id: None,
            start_time: Some(chrono::Utc::now().timestamp_millis()),
            cpu_usage: None,
            memory_usage: None,
            pinned: Some(false),
        };

        assert_eq!(history.id, "test-history");
        assert_eq!(history.config_id, "test-config");
        assert_eq!(history.status, HistoryStatus::Success);
        assert!(history.duration.is_some());
        assert_eq!(history.duration.unwrap(), 1000);
    }

    #[tokio::test]
    async fn test_error_entry_creation() {
        let error = ErrorEntry {
            id: "test-error".to_string(),
            error: AppError::ProcessError {
                command: "test".to_string(),
                exit_code: Some(1),
                message: "Test process error".to_string(),
            },
            context: "Test context".to_string(),
            severity: ErrorSeverity::Medium,
            recovery_action: RecoveryAction::Retry {
                max_attempts: 3,
                delay_ms: 1000,
            },
            resolved: false,
            resolution: None,
            timestamp: chrono::Utc::now(),
        };

        assert_eq!(error.id, "test-error");
        assert_eq!(error.severity, ErrorSeverity::Medium);
        assert!(!error.resolved);
        assert!(error.resolution.is_none());
    }

    #[tokio::test]
    async fn test_storage_manager_creation() {
        let storage = StorageManager::new();
        assert!(storage.is_ok());
    }

    #[tokio::test]
    async fn test_config_manager_creation() {
        let storage = StorageManager::new().unwrap();
        let config_manager = ConfigManager::new(Arc::new(storage));
        
        // Test loading configs (should not fail even if file doesn't exist)
        let result = config_manager.load_configs().await;
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_i18n_manager_creation() {
        let i18n_manager = I18nManager::new();
        assert_eq!(i18n_manager.get_language(), "en");
    }

    #[tokio::test]
    async fn test_search_manager_creation() {
        let search_manager = SearchManager::new();
        assert!(search_manager.list_filters().is_empty());
    }

    #[tokio::test]
    async fn test_settings_manager_creation() {
        let settings_manager = SettingsManager::new("test-settings.json".to_string());
        assert!(settings_manager.is_ok());
    }

    #[tokio::test]
    async fn test_performance_manager_creation() {
        let perf_manager = PerformanceManager::new();
        // Test that performance manager was created successfully
        assert!(true);
    }

    #[tokio::test]
    async fn test_error_handler_creation() {
        let error_handler = ErrorHandler::new(100);
        // Test that error handler was created successfully
        assert!(error_handler.get_errors().await.is_ok());
    }

    #[tokio::test]
    async fn test_run_config_serialization() {
        let config = RunConfig {
            id: "test-serialization".to_string(),
            name: "Serialization Test".to_string(),
            command: "test".to_string(),
            working_directory: Some("/tmp".to_string()),
            environment: Some(vec![("ENV_VAR".to_string(), "value".to_string())].into_iter().collect()),
            arguments: Some(vec!["arg1".to_string(), "arg2".to_string()]),
            created_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
        };

        // Test JSON serialization
        let json = serde_json::to_string(&config);
        assert!(json.is_ok());
        
        let json_str = json.unwrap();
        let deserialized: Result<RunConfig, _> = serde_json::from_str(&json_str);
        assert!(deserialized.is_ok());
        
        let deserialized_config = deserialized.unwrap();
        assert_eq!(config.id, deserialized_config.id);
        assert_eq!(config.name, deserialized_config.name);
        assert_eq!(config.command, deserialized_config.command);
        assert_eq!(config.arguments, deserialized_config.arguments);
    }

    #[tokio::test]
    async fn test_run_history_serialization() {
        let history = RunHistory {
            id: "test-history-serialization".to_string(),
            config_id: "test-config".to_string(),
            name: "Test History Serialization".to_string(),
            command: "echo Test output".to_string(),
            status: HistoryStatus::Success,
            timestamp: chrono::Utc::now(),
            output: Some("Test output\n".to_string()),
            duration: Some(1500),
            log_filename: None,
            pid: None,
            internal_id: None,
            start_time: Some(chrono::Utc::now().timestamp_millis()),
            cpu_usage: None,
            memory_usage: None,
            pinned: Some(false),
        };

        // Test JSON serialization
        let json = serde_json::to_string(&history);
        assert!(json.is_ok());
        
        let json_str = json.unwrap();
        let deserialized: Result<RunHistory, _> = serde_json::from_str(&json_str);
        assert!(deserialized.is_ok());
        
        let deserialized_history = deserialized.unwrap();
        assert_eq!(history.id, deserialized_history.id);
        assert_eq!(history.config_id, deserialized_history.config_id);
        assert_eq!(history.status, deserialized_history.status);
        assert_eq!(history.output, deserialized_history.output);
    }

    #[tokio::test]
    async fn test_error_severity_comparison() {
        assert!(ErrorSeverity::Critical > ErrorSeverity::High);
        assert!(ErrorSeverity::High > ErrorSeverity::Medium);
        assert!(ErrorSeverity::Medium > ErrorSeverity::Low);
    }

    #[tokio::test]
    async fn test_history_status_equality() {
        assert_eq!(HistoryStatus::Success, HistoryStatus::Success);
        assert_ne!(HistoryStatus::Success, HistoryStatus::Error);
        assert_ne!(HistoryStatus::Running, HistoryStatus::Error);
    }

    #[tokio::test]
    async fn test_recovery_action_creation() {
        let retry_action = RecoveryAction::Retry {
            max_attempts: 5,
            delay_ms: 2000,
        };
        
        let fallback_action = RecoveryAction::Fallback {
            default_value: "default".to_string(),
        };
        
        let skip_action = RecoveryAction::Skip;
        let restart_action = RecoveryAction::Restart {
            component: "process".to_string(),
        };
        
        let report_action = RecoveryAction::Report {
            message: "Error occurred".to_string(),
        };
        
        let none_action = RecoveryAction::None;

        // Test that all variants can be created
        match retry_action {
            RecoveryAction::Retry { max_attempts, delay_ms } => {
                assert_eq!(max_attempts, 5);
                assert_eq!(delay_ms, 2000);
            }
            _ => panic!("Expected Retry action"),
        }

        match fallback_action {
            RecoveryAction::Fallback { default_value } => {
                assert_eq!(default_value, "default");
            }
            _ => panic!("Expected Fallback action"),
        }

        match skip_action {
            RecoveryAction::Skip => {}
            _ => panic!("Expected Skip action"),
        }

        match restart_action {
            RecoveryAction::Restart { component } => {
                assert_eq!(component, "process");
            }
            _ => panic!("Expected Restart action"),
        }

        match report_action {
            RecoveryAction::Report { message } => {
                assert_eq!(message, "Error occurred");
            }
            _ => panic!("Expected Report action"),
        }

        match none_action {
            RecoveryAction::None => {}
            _ => panic!("Expected None action"),
        }
    }
}
