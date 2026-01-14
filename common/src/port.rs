//! Port and process detection utilities

use crate::types::PortInfo;
use std::process::Command;

/// List all listening TCP ports with their associated processes
#[cfg(target_os = "macos")]
pub fn list_listening_ports() -> Vec<PortInfo> {
    let output = Command::new("lsof")
        .args(["-iTCP", "-sTCP:LISTEN", "-P", "-n"])
        .output();

    let mut ports = Vec::new();

    if let Ok(output) = output {
        if output.status.success() {
            let stdout = String::from_utf8_lossy(&output.stdout);
            for line in stdout.lines().skip(1) {
                // Skip header
                if let Some(info) = parse_lsof_line(line) {
                    ports.push(info);
                }
            }
        }
    }

    ports
}

/// List all listening TCP ports with their associated processes
#[cfg(target_os = "linux")]
pub fn list_listening_ports() -> Vec<PortInfo> {
    // Try ss first, fall back to netstat
    let output = Command::new("ss").args(["-tlnp"]).output();

    if let Ok(output) = output {
        if output.status.success() {
            return parse_ss_output(&String::from_utf8_lossy(&output.stdout));
        }
    }

    // Fallback to netstat
    let output = Command::new("netstat").args(["-tlnp"]).output();

    if let Ok(output) = output {
        if output.status.success() {
            return parse_netstat_output(&String::from_utf8_lossy(&output.stdout));
        }
    }

    Vec::new()
}

#[cfg(target_os = "macos")]
fn parse_lsof_line(line: &str) -> Option<PortInfo> {
    let parts: Vec<&str> = line.split_whitespace().collect();
    if parts.len() < 9 {
        return None;
    }

    let process = parts[0].to_string();
    let pid: u32 = parts[1].parse().ok()?;

    // NAME column is the 9th field (index 8), format: "*:port" or "127.0.0.1:port"
    // The last field might be "(LISTEN)" so we look for the field containing ":"
    let name = parts.iter().rev()
        .find(|p| p.contains(':') && !p.starts_with('('))?;
    
    let port_str = name.rsplit(':').next()?;
    let port: u16 = port_str.parse().ok()?;

    Some(PortInfo {
        port,
        pid,
        process,
        protocol: "tcp".to_string(),
    })
}

#[cfg(target_os = "linux")]
fn parse_ss_output(output: &str) -> Vec<PortInfo> {
    let mut ports = Vec::new();

    for line in output.lines().skip(1) {
        let parts: Vec<&str> = line.split_whitespace().collect();
        if parts.len() < 5 {
            continue;
        }

        // Local address is typically in format *:port or 0.0.0.0:port
        let local_addr = parts[3];
        let port_str = local_addr.rsplit(':').next();

        if let Some(port_str) = port_str {
            if let Ok(port) = port_str.parse::<u16>() {
                // Process info is in the last column, format: users:(("process",pid=123,fd=4))
                let process_info = parts.last().unwrap_or(&"");
                let (process, pid) = parse_ss_process_info(process_info);

                ports.push(PortInfo {
                    port,
                    pid,
                    process,
                    protocol: "tcp".to_string(),
                });
            }
        }
    }

    ports
}

#[cfg(target_os = "linux")]
fn parse_ss_process_info(info: &str) -> (String, u32) {
    // Format: users:(("process",pid=123,fd=4))
    let mut process = String::new();
    let mut pid = 0u32;

    if let Some(start) = info.find("((\"") {
        if let Some(end) = info[start + 3..].find("\"") {
            process = info[start + 3..start + 3 + end].to_string();
        }
    }

    if let Some(start) = info.find("pid=") {
        let rest = &info[start + 4..];
        if let Some(end) = rest.find(|c: char| !c.is_ascii_digit()) {
            if let Ok(p) = rest[..end].parse() {
                pid = p;
            }
        }
    }

    (process, pid)
}

#[cfg(target_os = "linux")]
fn parse_netstat_output(output: &str) -> Vec<PortInfo> {
    let mut ports = Vec::new();

    for line in output.lines().skip(2) {
        // Skip headers
        let parts: Vec<&str> = line.split_whitespace().collect();
        if parts.len() < 7 {
            continue;
        }

        // Local address is in format 0.0.0.0:port
        let local_addr = parts[3];
        let port_str = local_addr.rsplit(':').next();

        if let Some(port_str) = port_str {
            if let Ok(port) = port_str.parse::<u16>() {
                // PID/Program is in the last column, format: pid/program
                let pid_prog = parts.last().unwrap_or(&"");
                let (pid, process) = if let Some(idx) = pid_prog.find('/') {
                    let pid = pid_prog[..idx].parse().unwrap_or(0);
                    let process = pid_prog[idx + 1..].to_string();
                    (pid, process)
                } else {
                    (0, String::new())
                };

                ports.push(PortInfo {
                    port,
                    pid,
                    process,
                    protocol: "tcp".to_string(),
                });
            }
        }
    }

    ports
}

/// Kill a process by PID
pub fn kill_process(pid: u32) -> Result<(), String> {
    let output = Command::new("kill")
        .args(["-9", &pid.to_string()])
        .output()
        .map_err(|e| format!("Failed to execute kill: {}", e))?;

    if output.status.success() {
        Ok(())
    } else {
        Err(format!(
            "Failed to kill process {}: {}",
            pid,
            String::from_utf8_lossy(&output.stderr)
        ))
    }
}

/// Kill a process listening on a specific port
pub fn kill_process_on_port(port: u16) -> Result<(), String> {
    let ports = list_listening_ports();

    for info in ports {
        if info.port == port {
            return kill_process(info.pid);
        }
    }

    Err(format!("No process found listening on port {}", port))
}
