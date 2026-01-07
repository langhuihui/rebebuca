use std::process::Command;
use std::path::Path;
#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

/// Port process info
#[derive(serde::Serialize)]
pub struct PortProcess {
    pub port: u16,
    pub pid: u32,
    pub name: String,
    pub command: String,
}

/// Get processes listening on ports
#[tauri::command]
pub async fn get_port_processes() -> Result<Vec<PortProcess>, String> {
    let mut result = Vec::new();
    
    #[cfg(target_os = "macos")]
    {
        // Use lsof to get listening ports on macOS
        let output = Command::new("lsof")
            .args(["-iTCP", "-sTCP:LISTEN", "-P", "-n"])
            .output()
            .map_err(|e| format!("Failed to run lsof: {}", e))?;
        
        let stdout = String::from_utf8_lossy(&output.stdout);
        
        for line in stdout.lines().skip(1) {
            let parts: Vec<&str> = line.split_whitespace().collect();
            if parts.len() >= 9 {
                let name = parts[0].to_string();
                let pid: u32 = parts[1].parse().unwrap_or(0);
                let addr = parts[8];
                
                // Extract port from address like "*:3000" or "127.0.0.1:3000"
                if let Some(port_str) = addr.split(':').last() {
                    if let Ok(port) = port_str.parse::<u16>() {
                        // Get full command
                        let cmd_output = Command::new("ps")
                            .args(["-p", &pid.to_string(), "-o", "command="])
                            .output()
                            .ok();
                        
                        let command = cmd_output
                            .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
                            .unwrap_or_default();
                        
                        result.push(PortProcess {
                            port,
                            pid,
                            name,
                            command,
                        });
                    }
                }
            }
        }
    }
    
    #[cfg(target_os = "windows")]
    {
        // Use netstat on Windows - wrap with cmd /c to prevent popup windows
        let output = Command::new("cmd")
            .args(["/c", "netstat -ano -p TCP"])
            .creation_flags(0x08000000) // CREATE_NO_WINDOW
            .output()
            .map_err(|e| format!("Failed to run netstat: {}", e))?;
        
        let stdout = String::from_utf8_lossy(&output.stdout);
        
        for line in stdout.lines() {
            if line.contains("LISTENING") {
                let parts: Vec<&str> = line.split_whitespace().collect();
                if parts.len() >= 5 {
                    let local_addr = parts[1];
                    let pid: u32 = parts[4].parse().unwrap_or(0);
                    
                    if let Some(port_str) = local_addr.split(':').last() {
                        if let Ok(port) = port_str.parse::<u16>() {
                            // Get process name using tasklist - wrap with cmd /c to prevent popup windows
                            let name_output = Command::new("cmd")
                                .args(["/c", &format!("tasklist /FI \"PID eq {}\" /FO CSV /NH", pid)])
                                .creation_flags(0x08000000) // CREATE_NO_WINDOW
                                .output()
                                .ok();
                            
                            let name = name_output
                                .and_then(|o| {
                                    let s = String::from_utf8_lossy(&o.stdout);
                                    let trimmed = s.trim();
                                    // tasklist CSV format: "process.exe","pid","Session Name","Session#","Mem Usage"
                                    // Skip if output contains "INFO:" (no matching process) or is empty
                                    if trimmed.is_empty() || trimmed.starts_with("INFO:") || !trimmed.contains(',') {
                                        return None;
                                    }
                                    // Extract first field (process name) from CSV
                                    trimmed.split(',')
                                        .next()
                                        .map(|s| s.trim().trim_matches('"').to_string())
                                })
                                .unwrap_or_else(|| format!("PID:{}", pid));
                            
                            // Get full command line using WMIC
                            let cmd_output = Command::new("cmd")
                                .args(["/c", &format!("wmic process where \"ProcessId={}\" get CommandLine /format:list", pid)])
                                .creation_flags(0x08000000) // CREATE_NO_WINDOW
                                .output()
                                .ok();
                            
                            let command = cmd_output
                                .and_then(|o| {
                                    let s = String::from_utf8_lossy(&o.stdout);
                                    // WMIC output format: "CommandLine=<full command>"
                                    // Find and extract the command line from the output
                                    s.lines()
                                        .find_map(|line| {
                                            line.trim()
                                                .strip_prefix("CommandLine=")
                                                .and_then(|c| {
                                                    let trimmed = c.trim();
                                                    if trimmed.is_empty() {
                                                        None
                                                    } else {
                                                        Some(trimmed.to_string())
                                                    }
                                                })
                                        })
                                })
                                .unwrap_or_default();
                            
                            // Determine the best display name
                            let display_name = if name.starts_with("PID:") {
                                // tasklist failed, try to extract name from command line
                                if !command.is_empty() {
                                    // Extract executable name from command line
                                    // Handle both quoted and unquoted paths
                                    let exe_path = if command.starts_with('"') {
                                        // Quoted path: extract between quotes
                                        // For "C:\path\to\app.exe" args, we want C:\path\to\app.exe
                                        command.splitn(3, '"').nth(1).unwrap_or(&command)
                                    } else {
                                        // Unquoted path: extract until first space (the executable part)
                                        command.split_whitespace().next().unwrap_or(&command)
                                    };
                                    
                                    // Use std::path::Path for proper cross-platform path handling
                                    Path::new(exe_path)
                                        .file_name()
                                        .and_then(|os_str| os_str.to_str())
                                        .map(|s| s.to_string())
                                        .unwrap_or_else(|| {
                                            // Fallback: manually extract filename if Path fails
                                            exe_path.split(&['\\', '/'][..])
                                                .last()
                                                .unwrap_or(exe_path)
                                                .to_string()
                                        })
                                } else {
                                    // Both tasklist and WMIC failed, use PID fallback
                                    name.clone()
                                }
                            } else {
                                // tasklist succeeded, use its result
                                name.clone()
                            };
                            
                            result.push(PortProcess {
                                port,
                                pid,
                                name: display_name,
                                command,
                            });
                        }
                    }
                }
            }
        }
    }
    
    #[cfg(target_os = "linux")]
    {
        // Use ss or netstat on Linux
        let output = Command::new("ss")
            .args(["-tlnp"])
            .output()
            .or_else(|_| {
                Command::new("netstat")
                    .args(["-tlnp"])
                    .output()
            })
            .map_err(|e| format!("Failed to run ss/netstat: {}", e))?;
        
        let stdout = String::from_utf8_lossy(&output.stdout);
        
        for line in stdout.lines().skip(1) {
            let parts: Vec<&str> = line.split_whitespace().collect();
            if parts.len() >= 6 {
                let local_addr = parts[3];
                
                if let Some(port_str) = local_addr.rsplit(':').next() {
                    if let Ok(port) = port_str.parse::<u16>() {
                        // Parse pid from "users:(("name",pid=123,fd=4))"
                        let pid_info = parts.get(6).unwrap_or(&"");
                        let pid = pid_info
                            .split("pid=")
                            .nth(1)
                            .and_then(|s| s.split(',').next())
                            .and_then(|s| s.parse::<u32>().ok())
                            .unwrap_or(0);
                        
                        let name = pid_info
                            .split("((\"")
                            .nth(1)
                            .and_then(|s| s.split('"').next())
                            .unwrap_or("")
                            .to_string();
                        
                        result.push(PortProcess {
                            port,
                            pid,
                            name,
                            command: String::new(),
                        });
                    }
                }
            }
        }
    }
    
    // Sort by port
    result.sort_by_key(|p| p.port);
    
    // Remove duplicates
    result.dedup_by_key(|p| (p.port, p.pid));
    
    Ok(result)
}

/// Kill process by port
#[tauri::command]
pub async fn kill_process_by_port(port: u16) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        let output = Command::new("lsof")
            .args(["-ti", &format!(":{}", port)])
            .output()
            .map_err(|e| format!("Failed to run lsof: {}", e))?;
        
        let pids = String::from_utf8_lossy(&output.stdout);
        for pid in pids.lines() {
            if !pid.is_empty() {
                let _ = Command::new("kill")
                    .args(["-9", pid])
                    .output();
            }
        }
    }
    
    #[cfg(target_os = "windows")]
    {
        // First get PID from netstat - wrap with cmd /c to prevent popup windows
        let output = Command::new("cmd")
            .args(["/c", &format!("netstat -ano | findstr \":{}\" | findstr \"LISTENING\"", port)])
            .creation_flags(0x08000000) // CREATE_NO_WINDOW
            .output()
            .map_err(|e| format!("Failed to run netstat: {}", e))?;
        
        let stdout = String::from_utf8_lossy(&output.stdout);
        for line in stdout.lines() {
            if line.contains(&format!(":{}", port)) && line.contains("LISTENING") {
                let parts: Vec<&str> = line.split_whitespace().collect();
                if let Some(pid) = parts.last() {
                    let _ = Command::new("taskkill")
                        .args(["/F", "/PID", pid])
                        .output();
                }
            }
        }
    }
    
    #[cfg(target_os = "linux")]
    {
        let _ = Command::new("fuser")
            .args(["-k", &format!("{}/tcp", port)])
            .output();
    }
    
    Ok(())
}

/// Kill process by PID
#[tauri::command]
pub async fn kill_process_by_pid(pid: u32) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        let output = Command::new("kill")
            .args(["-9", &pid.to_string()])
            .output()
            .map_err(|e| format!("Failed to kill process: {}", e))?;
        
        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(format!("Failed to kill process {}: {}", pid, stderr));
        }
    }
    
    #[cfg(target_os = "windows")]
    {
        let output = Command::new("taskkill")
            .args(["/F", "/PID", &pid.to_string()])
            .creation_flags(0x08000000) // CREATE_NO_WINDOW
            .output()
            .map_err(|e| format!("Failed to kill process: {}", e))?;
        
        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(format!("Failed to kill process {}: {}", pid, stderr));
        }
    }
    
    #[cfg(target_os = "linux")]
    {
        let output = Command::new("kill")
            .args(["-9", &pid.to_string()])
            .output()
            .map_err(|e| format!("Failed to kill process: {}", e))?;
        
        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(format!("Failed to kill process {}: {}", pid, stderr));
        }
    }
    
    Ok(())
}
