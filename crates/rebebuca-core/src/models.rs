use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use chrono::{DateTime, Utc};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RunConfig {
    pub id: String,
    pub name: String,
    pub command: String,
    pub working_directory: Option<String>,
    pub environment: Option<HashMap<String, String>>,
    pub arguments: Option<Vec<String>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProcessInfo {
    pub internal_id: String,  // Internal UUID for frontend lookup
    pub system_pid: Option<u32>,  // System PID for display and process management
    pub config_name: String,
    pub status: ProcessStatus,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProcessStats {
    pub process_id: String,
    pub cpu_usage: f64,
    pub memory_usage: u64,
    pub memory_usage_mb: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ProcessStatus {
    Running,
    Stopped,
    Error,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OutputEvent {
    pub process_id: String,
    pub output_type: OutputType,
    pub content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum OutputType {
    Stdout,
    Stderr,
    System,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RunHistory {
    pub id: String,
    pub config_id: String,
    pub name: String,
    pub command: String,
    pub status: HistoryStatus,
    pub timestamp: DateTime<Utc>,
    pub output: Option<String>,
    pub duration: Option<u64>, // in milliseconds
    pub log_filename: Option<String>,
    pub pid: Option<String>, // System PID or internal ID for process management
    pub internal_id: Option<String>, // Internal UUID for event matching
    pub start_time: Option<i64>, // Unix timestamp in milliseconds
    pub cpu_usage: Option<String>,
    pub memory_usage: Option<String>,
    pub pinned: Option<bool>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum HistoryStatus {
    Running,
    Success,
    Error,
}

impl From<ProcessStatus> for HistoryStatus {
    fn from(status: ProcessStatus) -> Self {
        match status {
            ProcessStatus::Running => HistoryStatus::Running,
            ProcessStatus::Stopped => HistoryStatus::Success,
            ProcessStatus::Error => HistoryStatus::Error,
        }
    }
}

impl From<HistoryStatus> for ProcessStatus {
    fn from(status: HistoryStatus) -> Self {
        match status {
            HistoryStatus::Running => ProcessStatus::Running,
            HistoryStatus::Success => ProcessStatus::Stopped,
            HistoryStatus::Error => ProcessStatus::Error,
        }
    }
}

// Helper functions for creating new instances
impl RunConfig {
    pub fn new(
        id: String,
        name: String,
        command: String,
        working_directory: Option<String>,
        environment: Option<HashMap<String, String>>,
        arguments: Option<Vec<String>>,
    ) -> Self {
        let now = Utc::now();
        Self {
            id,
            name,
            command,
            working_directory,
            environment,
            arguments,
            created_at: now,
            updated_at: now,
        }
    }

    pub fn update(&mut self, updates: RunConfigUpdate) {
        if let Some(name) = updates.name {
            self.name = name;
        }
        if let Some(command) = updates.command {
            self.command = command;
        }
        if let Some(working_directory) = updates.working_directory {
            self.working_directory = working_directory;
        }
        if let Some(environment) = updates.environment {
            self.environment = environment;
        }
        if let Some(arguments) = updates.arguments {
            self.arguments = arguments;
        }
        self.updated_at = Utc::now();
    }
}

#[derive(Debug, Clone)]
pub struct RunConfigUpdate {
    pub name: Option<String>,
    pub command: Option<String>,
    pub working_directory: Option<Option<String>>,
    pub environment: Option<Option<HashMap<String, String>>>,
    pub arguments: Option<Option<Vec<String>>>,
}

impl RunHistory {
    pub fn new(
        id: String,
        config_id: String,
        name: String,
        command: String,
        status: HistoryStatus,
    ) -> Self {
        Self {
            id,
            config_id,
            name,
            command,
            status,
            timestamp: Utc::now(),
            output: None,
            duration: None,
            log_filename: None,
            pid: None,
            internal_id: None,
            start_time: Some(Utc::now().timestamp_millis()),
            cpu_usage: None,
            memory_usage: None,
            pinned: Some(false),
        }
    }

    pub fn update(&mut self, updates: RunHistoryUpdate) {
        if let Some(status) = updates.status {
            self.status = status;
        }
        if let Some(output) = updates.output {
            self.output = output;
        }
        if let Some(duration) = updates.duration {
            self.duration = duration;
        }
        if let Some(log_filename) = updates.log_filename {
            self.log_filename = log_filename;
        }
        if let Some(pid) = updates.pid {
            self.pid = pid;
        }
        if let Some(internal_id) = updates.internal_id {
            self.internal_id = internal_id;
        }
        if let Some(cpu_usage) = updates.cpu_usage {
            self.cpu_usage = cpu_usage;
        }
        if let Some(memory_usage) = updates.memory_usage {
            self.memory_usage = memory_usage;
        }
        if let Some(pinned) = updates.pinned {
            self.pinned = pinned;
        }
    }
}

#[derive(Debug, Clone)]
pub struct RunHistoryUpdate {
    pub status: Option<HistoryStatus>,
    pub output: Option<Option<String>>,
    pub duration: Option<Option<u64>>,
    pub log_filename: Option<Option<String>>,
    pub pid: Option<Option<String>>,
    pub internal_id: Option<Option<String>>,
    pub cpu_usage: Option<Option<String>>,
    pub memory_usage: Option<Option<String>>,
    pub pinned: Option<Option<bool>>,
}
