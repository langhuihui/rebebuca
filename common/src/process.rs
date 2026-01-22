//! Process statistics and management utilities

use crate::types::{ProcessInfo, ProcessStats};
use sysinfo::{Pid, ProcessesToUpdate, System};
use std::process::Command;

/// Get process statistics for a given PID
pub fn get_process_stats(pid: u32) -> Option<ProcessStats> {
    let mut sys = System::new();
    sys.refresh_processes(ProcessesToUpdate::All, true);

    let sysinfo_pid = Pid::from_u32(pid);

    sys.process(sysinfo_pid).map(|process| {
        let memory_usage = process.memory();
        let memory_mb = memory_usage as f64 / 1024.0 / 1024.0;

        ProcessStats {
            pid,
            cpu_usage: process.cpu_usage() as f64,
            memory_usage,
            memory_usage_mb: format!("{:.2} MB", memory_mb),
        }
    })
}

/// Get detailed process information for a given PID
pub fn get_process_info(pid: u32) -> Option<ProcessInfo> {
    get_process_stats(pid).map(|stats| {
        let name = get_process_name(pid);
        ProcessInfo {
            pid: stats.pid,
            name,
            cpu_usage: Some(stats.cpu_usage),
            memory_usage: Some(stats.memory_usage as f64),
        }
    })
}

/// Get process name from PID
fn get_process_name(pid: u32) -> String {
    Command::new("ps")
        .arg("-p")
        .arg(pid.to_string())
        .arg("-o")
        .arg("comm=")
        .output()
        .ok()
        .and_then(|output| String::from_utf8(output.stdout).ok().map(|s| s.trim().to_string()))
        .unwrap_or_else(|| "unknown".to_string())
}

/// Check if a process is running
pub fn is_process_running(pid: u32) -> bool {
    let mut sys = System::new();
    sys.refresh_processes(ProcessesToUpdate::All, false);

    sys.process(Pid::from_u32(pid)).is_some()
}

/// Kill a process by PID (tries SIGTERM first, then SIGKILL)
pub fn kill_process(pid: u32) -> Result<(), String> {
    // Try SIGTERM first
    let output = Command::new("kill")
        .arg("-15") // SIGTERM
        .arg(pid.to_string())
        .output()
        .map_err(|e| format!("Failed to execute kill: {}", e))?;
    
    if !output.status.success() {
        // Try SIGKILL if SIGTERM failed
        let kill_output = Command::new("kill")
            .arg("-9") // SIGKILL
            .arg(pid.to_string())
            .output()
            .map_err(|e| format!("Failed to execute kill -9: {}", e))?;
        
        if !kill_output.status.success() {
            return Err(String::from_utf8_lossy(&kill_output.stderr).to_string());
        }
    }
    
    Ok(())
}

/// Format bytes to human readable string
pub fn format_bytes(bytes: u64) -> String {
    const KB: u64 = 1024;
    const MB: u64 = KB * 1024;
    const GB: u64 = MB * 1024;

    if bytes >= GB {
        format!("{:.2} GB", bytes as f64 / GB as f64)
    } else if bytes >= MB {
        format!("{:.2} MB", bytes as f64 / MB as f64)
    } else if bytes >= KB {
        format!("{:.2} KB", bytes as f64 / KB as f64)
    } else {
        format!("{} B", bytes)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_format_bytes() {
        assert_eq!(format_bytes(500), "500 B");
        assert_eq!(format_bytes(1024), "1.00 KB");
        assert_eq!(format_bytes(1024 * 1024), "1.00 MB");
        assert_eq!(format_bytes(1024 * 1024 * 1024), "1.00 GB");
    }

    #[test]
    fn test_current_process_stats() {
        let pid = std::process::id();
        let stats = get_process_stats(pid);
        assert!(stats.is_some());
    }

    #[test]
    fn test_current_process_info() {
        let pid = std::process::id();
        let info = get_process_info(pid);
        assert!(info.is_some());
        assert_eq!(info.unwrap().pid, pid);
    }

    #[test]
    fn test_is_process_running() {
        let pid = std::process::id();
        assert!(is_process_running(pid));
        
        // Non-existent PID should return false
        assert!(!is_process_running(99999999));
    }
}
