use anyhow::Result;
use std::fmt;
use std::sync::Arc;
use tokio::sync::RwLock;
use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};

/// Error types that can occur in the application
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AppError {
    /// Process execution errors
    ProcessError {
        command: String,
        exit_code: Option<i32>,
        message: String,
    },
    /// File I/O errors
    IoError {
        path: String,
        operation: String,
        message: String,
    },
    /// Configuration errors
    ConfigError {
        field: String,
        message: String,
    },
    /// Storage errors
    StorageError {
        operation: String,
        message: String,
    },
    /// Network errors
    NetworkError {
        url: String,
        message: String,
    },
    /// Validation errors
    ValidationError {
        field: String,
        value: String,
        message: String,
    },
    /// System errors
    SystemError {
        component: String,
        message: String,
    },
    /// Unknown errors
    Unknown {
        message: String,
    },
}

impl fmt::Display for AppError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            AppError::ProcessError { command, exit_code, message } => {
                write!(f, "Process error in '{}': {} (exit code: {:?})", command, message, exit_code)
            }
            AppError::IoError { path, operation, message } => {
                write!(f, "I/O error during {} on '{}': {}", operation, path, message)
            }
            AppError::ConfigError { field, message } => {
                write!(f, "Configuration error in field '{}': {}", field, message)
            }
            AppError::StorageError { operation, message } => {
                write!(f, "Storage error during {}: {}", operation, message)
            }
            AppError::NetworkError { url, message } => {
                write!(f, "Network error for '{}': {}", url, message)
            }
            AppError::ValidationError { field, value, message } => {
                write!(f, "Validation error for field '{}' with value '{}': {}", field, value, message)
            }
            AppError::SystemError { component, message } => {
                write!(f, "System error in component '{}': {}", component, message)
            }
            AppError::Unknown { message } => {
                write!(f, "Unknown error: {}", message)
            }
        }
    }
}

impl std::error::Error for AppError {}

/// Error severity levels
#[derive(Debug, Clone, Copy, PartialEq, PartialOrd, Eq, Hash, Serialize, Deserialize)]
pub enum ErrorSeverity {
    Low,
    Medium,
    High,
    Critical,
}

/// Error recovery action
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum RecoveryAction {
    /// Retry the operation
    Retry { max_attempts: u32, delay_ms: u64 },
    /// Fallback to default value
    Fallback { default_value: String },
    /// Skip the operation
    Skip,
    /// Restart the component
    Restart { component: String },
    /// Report to user
    Report { message: String },
    /// No action needed
    None,
}

/// Error entry in the error log
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ErrorEntry {
    pub id: String,
    pub error: AppError,
    pub severity: ErrorSeverity,
    pub timestamp: DateTime<Utc>,
    pub context: String,
    pub recovery_action: RecoveryAction,
    pub resolved: bool,
    pub resolution: Option<String>,
}

/// Error handler for managing application errors
pub struct ErrorHandler {
    /// Error log
    error_log: Arc<RwLock<Vec<ErrorEntry>>>,
    /// Maximum number of errors to keep
    max_errors: usize,
    /// Error reporting callbacks
    callbacks: Vec<Box<dyn Fn(&ErrorEntry) + Send + Sync>>,
}

impl std::fmt::Debug for ErrorHandler {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("ErrorHandler")
            .field("max_errors", &self.max_errors)
            .field("callbacks_count", &self.callbacks.len())
            .finish()
    }
}

impl ErrorHandler {
    pub fn new(max_errors: usize) -> Self {
        Self {
            error_log: Arc::new(RwLock::new(Vec::new())),
            max_errors,
            callbacks: Vec::new(),
        }
    }

    /// Report an error
    pub async fn report_error(
        &self,
        error: AppError,
        severity: ErrorSeverity,
        context: String,
        recovery_action: RecoveryAction,
    ) -> Result<String> {
        let error_id = uuid::Uuid::new_v4().to_string();
        let error_entry = ErrorEntry {
            id: error_id.clone(),
            error: error.clone(),
            severity,
            timestamp: Utc::now(),
            context,
            recovery_action: recovery_action.clone(),
            resolved: false,
            resolution: None,
        };

        // Add to error log
        {
            let mut log = self.error_log.write().await;
            log.push(error_entry.clone());
            
            // Maintain max_errors limit
            if log.len() > self.max_errors {
                log.remove(0);
            }
        }

        // Notify callbacks
        for callback in &self.callbacks {
            callback(&error_entry);
        }

        // Attempt recovery
        self.attempt_recovery(&error_entry).await?;

        Ok(error_id)
    }

    /// Get all errors
    pub async fn get_errors(&self) -> Result<Vec<ErrorEntry>> {
        let log = self.error_log.read().await;
        Ok(log.clone())
    }

    /// Get errors by severity
    pub async fn get_errors_by_severity(&self, severity: ErrorSeverity) -> Result<Vec<ErrorEntry>> {
        let log = self.error_log.read().await;
        Ok(log.iter()
            .filter(|entry| entry.severity == severity)
            .cloned()
            .collect())
    }

    /// Get unresolved errors
    pub async fn get_unresolved_errors(&self) -> Result<Vec<ErrorEntry>> {
        let log = self.error_log.read().await;
        Ok(log.iter()
            .filter(|entry| !entry.resolved)
            .cloned()
            .collect())
    }

    /// Mark error as resolved
    pub async fn resolve_error(&self, error_id: &str, resolution: String) -> Result<()> {
        let mut log = self.error_log.write().await;
        if let Some(entry) = log.iter_mut().find(|e| e.id == error_id) {
            entry.resolved = true;
            entry.resolution = Some(resolution);
        }
        Ok(())
    }

    /// Clear all errors
    pub async fn clear_errors(&self) -> Result<()> {
        let mut log = self.error_log.write().await;
        log.clear();
        Ok(())
    }

    /// Clear resolved errors
    pub async fn clear_resolved_errors(&self) -> Result<()> {
        let mut log = self.error_log.write().await;
        log.retain(|entry| !entry.resolved);
        Ok(())
    }

    /// Add error reporting callback
    pub fn add_callback<F>(&mut self, callback: F)
    where
        F: Fn(&ErrorEntry) + Send + Sync + 'static,
    {
        self.callbacks.push(Box::new(callback));
    }

    /// Attempt to recover from an error
    async fn attempt_recovery(&self, error_entry: &ErrorEntry) -> Result<()> {
        match &error_entry.recovery_action {
            RecoveryAction::Retry { max_attempts, delay_ms } => {
                // For now, just log the retry attempt
                // In a real implementation, this would retry the operation
                log::warn!("Retry recovery for error {}: {} attempts with {}ms delay", 
                    error_entry.id, max_attempts, delay_ms);
            }
            RecoveryAction::Fallback { default_value } => {
                log::info!("Fallback recovery for error {}: using default value '{}'", 
                    error_entry.id, default_value);
            }
            RecoveryAction::Skip => {
                log::info!("Skip recovery for error {}: operation will be skipped", 
                    error_entry.id);
            }
            RecoveryAction::Restart { component } => {
                log::warn!("Restart recovery for error {}: restarting component '{}'", 
                    error_entry.id, component);
            }
            RecoveryAction::Report { message } => {
                log::error!("Report recovery for error {}: {}", error_entry.id, message);
            }
            RecoveryAction::None => {
                log::debug!("No recovery action for error {}", error_entry.id);
            }
        }
        Ok(())
    }

    /// Get error statistics
    pub async fn get_error_stats(&self) -> Result<ErrorStats> {
        let log = self.error_log.read().await;
        let total_errors = log.len();
        let resolved_errors = log.iter().filter(|e| e.resolved).count();
        let unresolved_errors = total_errors - resolved_errors;
        
        let severity_counts = log.iter().fold(
            std::collections::HashMap::new(),
            |mut acc, entry| {
                *acc.entry(entry.severity).or_insert(0) += 1;
                acc
            }
        );

        Ok(ErrorStats {
            total_errors,
            resolved_errors,
            unresolved_errors,
            severity_counts,
        })
    }
}

/// Error statistics
#[derive(Debug, Clone)]
pub struct ErrorStats {
    pub total_errors: usize,
    pub resolved_errors: usize,
    pub unresolved_errors: usize,
    pub severity_counts: std::collections::HashMap<ErrorSeverity, usize>,
}

/// Error context builder for better error reporting
pub struct ErrorContext {
    context: String,
}

impl ErrorContext {
    pub fn new() -> Self {
        Self {
            context: String::new(),
        }
    }

    pub fn add(mut self, key: &str, value: &str) -> Self {
        if !self.context.is_empty() {
            self.context.push_str("; ");
        }
        self.context.push_str(&format!("{}: {}", key, value));
        self
    }

    pub fn build(self) -> String {
        self.context
    }
}

impl Default for ErrorContext {
    fn default() -> Self {
        Self::new()
    }
}

/// Helper functions for creating common error types
pub mod error_helpers {
    use super::*;

    pub fn process_error(command: &str, exit_code: Option<i32>, message: &str) -> AppError {
        AppError::ProcessError {
            command: command.to_string(),
            exit_code,
            message: message.to_string(),
        }
    }

    pub fn io_error(path: &str, operation: &str, message: &str) -> AppError {
        AppError::IoError {
            path: path.to_string(),
            operation: operation.to_string(),
            message: message.to_string(),
        }
    }

    pub fn config_error(field: &str, message: &str) -> AppError {
        AppError::ConfigError {
            field: field.to_string(),
            message: message.to_string(),
        }
    }

    pub fn storage_error(operation: &str, message: &str) -> AppError {
        AppError::StorageError {
            operation: operation.to_string(),
            message: message.to_string(),
        }
    }

    pub fn validation_error(field: &str, value: &str, message: &str) -> AppError {
        AppError::ValidationError {
            field: field.to_string(),
            value: value.to_string(),
            message: message.to_string(),
        }
    }

    pub fn system_error(component: &str, message: &str) -> AppError {
        AppError::SystemError {
            component: component.to_string(),
            message: message.to_string(),
        }
    }
}

/// Error recovery strategies
pub mod recovery_strategies {
    use super::*;

    /// Retry strategy for transient errors
    pub fn retry_strategy(max_attempts: u32, delay_ms: u64) -> RecoveryAction {
        RecoveryAction::Retry { max_attempts, delay_ms }
    }

    /// Fallback strategy for configuration errors
    pub fn fallback_strategy(default_value: &str) -> RecoveryAction {
        RecoveryAction::Fallback { 
            default_value: default_value.to_string() 
        }
    }

    /// Skip strategy for non-critical errors
    pub fn skip_strategy() -> RecoveryAction {
        RecoveryAction::Skip
    }

    /// Restart strategy for component errors
    pub fn restart_strategy(component: &str) -> RecoveryAction {
        RecoveryAction::Restart { 
            component: component.to_string() 
        }
    }

    /// Report strategy for critical errors
    pub fn report_strategy(message: &str) -> RecoveryAction {
        RecoveryAction::Report { 
            message: message.to_string() 
        }
    }
}
