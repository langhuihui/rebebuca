//! Process statistics utilities

use crate::types::ProcessStats;
use sysinfo::{Pid, ProcessesToUpdate, System};

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

/// Check if a process is running
pub fn is_process_running(pid: u32) -> bool {
    let mut sys = System::new();
    sys.refresh_processes(ProcessesToUpdate::All, false);

    sys.process(Pid::from_u32(pid)).is_some()
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
}
