//! System information adapter

use crate::protocol::LogPathInfo;
pub use rebebuca_common::{
    port::list_listening_ports,
    process::{get_process_info, kill_process},
    shell::get_available_shells,
    PortInfo, ProcessInfo, ShellInfo,
};

/// System adapter for system information
pub struct SystemAdapter;

impl SystemAdapter {
    pub fn new() -> Self {
        Self
    }

    /// Get the platform (darwin, linux, windows)
    pub fn get_platform(&self) -> &'static str {
        #[cfg(target_os = "macos")]
        {
            "darwin"
        }
        #[cfg(target_os = "linux")]
        {
            "linux"
        }
        #[cfg(target_os = "windows")]
        {
            "windows"
        }
        #[cfg(not(any(target_os = "macos", target_os = "linux", target_os = "windows")))]
        {
            "unknown"
        }
    }

    /// Get the architecture
    pub fn get_arch(&self) -> &'static str {
        std::env::consts::ARCH
    }

    /// Get available shells
    pub fn get_available_shells(&self) -> Vec<ShellInfo> {
        get_available_shells()
    }

    /// List listening ports
    pub fn list_ports(&self) -> Vec<PortInfo> {
        list_listening_ports()
    }

    /// Generate a log path for a task
    pub fn generate_log_path(&self, task_id: &str, pid: Option<u32>) -> LogPathInfo {
        let timestamp = chrono_like_timestamp();
        let pid_str = pid.map(|p| p.to_string()).unwrap_or_else(|| "0".to_string());
        let log_filename = format!("{}_{}_{}.log", task_id, pid_str, timestamp);
        
        let log_dir = std::env::temp_dir().join("rebebuca-logs");
        let _ = std::fs::create_dir_all(&log_dir);
        
        let log_path = log_dir.join(&log_filename);

        LogPathInfo {
            log_filename,
            log_path: log_path.to_string_lossy().to_string(),
        }
    }

    /// Get home directory
    pub fn get_home_directory(&self) -> String {
        std::env::var("HOME")
            .or_else(|_| std::env::var("USERPROFILE"))
            .unwrap_or_else(|_| "/".to_string())
    }

    /// Get process info by PID (from common)
    pub fn get_process_info(&self, pid: u32) -> Option<ProcessInfo> {
        get_process_info(pid)
    }

    /// Kill a process by PID (from common)
    pub fn kill_process(&self, pid: u32) -> Result<(), String> {
        kill_process(pid)
    }
}

fn chrono_like_timestamp() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs();
    
    // Simple timestamp format
    format!("{}", now)
}
