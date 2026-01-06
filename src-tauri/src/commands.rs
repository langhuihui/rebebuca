use crate::process::get_logs_dir;
use std::fs;
use std::process::Command;
use tauri::Manager;
use uuid::Uuid;

#[tauri::command]
pub fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
pub async fn open_logs_folder(app_handle: tauri::AppHandle) -> Result<(), String> {
    let logs_dir = get_logs_dir(&app_handle)?;

    // Open the logs directory in the system file manager
    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .arg(&logs_dir)
            .spawn()
            .map_err(|e| format!("Failed to open logs folder: {}", e))?;
    }

    #[cfg(target_os = "windows")]
    {
        Command::new("explorer")
            .arg(&logs_dir)
            .spawn()
            .map_err(|e| format!("Failed to open logs folder: {}", e))?;
    }

    #[cfg(target_os = "linux")]
    {
        Command::new("xdg-open")
            .arg(&logs_dir)
            .spawn()
            .map_err(|e| format!("Failed to open logs folder: {}", e))?;
    }

    Ok(())
}

#[tauri::command]
pub async fn open_file_with_default_app(path: String) -> Result<(), String> {
    // Open the file with the system default application
    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .arg(&path)
            .spawn()
            .map_err(|e| format!("Failed to open file: {}", e))?;
    }

    #[cfg(target_os = "windows")]
    {
        Command::new("cmd")
            .args(["/c", "start", "", &path])
            .spawn()
            .map_err(|e| format!("Failed to open file: {}", e))?;
    }

    #[cfg(target_os = "linux")]
    {
        Command::new("xdg-open")
            .arg(&path)
            .spawn()
            .map_err(|e| format!("Failed to open file: {}", e))?;
    }

    Ok(())
}

#[tauri::command]
pub async fn open_in_system_terminal(command: String, cwd: Option<String>) -> Result<(), String> {
    // Open a new system terminal window and execute the command
    #[cfg(target_os = "macos")]
    {
        // Use AppleScript to open Terminal.app and execute the command
        let script = if let Some(ref dir) = cwd {
            format!(
                r#"tell application "Terminal"
                    activate
                    do script "cd '{}' && {}"
                end tell"#,
                dir.replace("'", "'\\''"),
                command.replace("\"", "\\\"")
            )
        } else {
            format!(
                r#"tell application "Terminal"
                    activate
                    do script "{}"
                end tell"#,
                command.replace("\"", "\\\"")
            )
        };
        
        Command::new("osascript")
            .args(["-e", &script])
            .spawn()
            .map_err(|e| format!("Failed to open system terminal: {}", e))?;
    }

    #[cfg(target_os = "windows")]
    {
        // Use PowerShell's Start-Process to open a new cmd window
        // This handles complex commands better than cmd /c start
        let full_command = if let Some(ref dir) = cwd {
            // Escape single quotes in the command for PowerShell
            let escaped_cmd = command.replace("'", "''");
            let escaped_dir = dir.replace("'", "''");
            format!(
                "Start-Process cmd -ArgumentList '/k','cd /d \"{}\" && {}' -WorkingDirectory '{}'",
                escaped_dir, escaped_cmd, escaped_dir
            )
        } else {
            let escaped_cmd = command.replace("'", "''");
            format!(
                "Start-Process cmd -ArgumentList '/k','{}'",
                escaped_cmd
            )
        };
        
        Command::new("powershell")
            .args(["-NoProfile", "-Command", &full_command])
            .spawn()
            .map_err(|e| format!("Failed to open system terminal: {}", e))?;
    }

    #[cfg(target_os = "linux")]
    {
        // Try common terminal emulators
        let terminals = ["gnome-terminal", "konsole", "xfce4-terminal", "xterm"];
        let mut success = false;
        
        for terminal in terminals {
            let result = if terminal == "gnome-terminal" {
                let mut cmd = Command::new(terminal);
                cmd.arg("--");
                if let Some(ref dir) = cwd {
                    cmd.args(["bash", "-c", &format!("cd '{}' && {} ; exec bash", dir, command)]);
                } else {
                    cmd.args(["bash", "-c", &format!("{} ; exec bash", command)]);
                }
                cmd.spawn()
            } else if terminal == "konsole" {
                let mut cmd = Command::new(terminal);
                if let Some(ref dir) = cwd {
                    cmd.args(["--workdir", dir]);
                }
                cmd.args(["-e", "bash", "-c", &format!("{} ; exec bash", command)]);
                cmd.spawn()
            } else {
                let mut cmd = Command::new(terminal);
                cmd.args(["-e", "bash", "-c"]);
                if let Some(ref dir) = cwd {
                    cmd.arg(&format!("cd '{}' && {} ; exec bash", dir, command));
                } else {
                    cmd.arg(&format!("{} ; exec bash", command));
                }
                cmd.spawn()
            };
            
            if result.is_ok() {
                success = true;
                break;
            }
        }
        
        if !success {
            return Err("No supported terminal emulator found. Please install gnome-terminal, konsole, xfce4-terminal, or xterm.".to_string());
        }
    }

    Ok(())
}

#[tauri::command]
pub async fn delete_log_file(app_handle: tauri::AppHandle, log_filename: String) -> Result<(), String> {
    let logs_dir = get_logs_dir(&app_handle)?;
    let log_path = logs_dir.join(&log_filename);

    if log_path.exists() {
        fs::remove_file(&log_path).map_err(|e| format!("Failed to delete log file: {}", e))?;
    }

    Ok(())
}

/// Generate a log file path for a task execution
/// Returns { log_filename: String, log_path: String }
#[tauri::command]
pub async fn generate_log_path(app_handle: tauri::AppHandle) -> Result<serde_json::Value, String> {
    let logs_dir = get_logs_dir(&app_handle)?;
    let uuid = Uuid::new_v4().to_string();
    let timestamp = chrono::Local::now().format("%Y%m%d_%H%M%S");
    let log_filename = format!("{}_{}.log", timestamp, &uuid[0..8]);
    let log_path = logs_dir.join(&log_filename);
    
    Ok(serde_json::json!({
        "log_filename": log_filename,
        "log_path": log_path.to_string_lossy().to_string()
    }))
}

#[tauri::command]
pub async fn read_log_file(app_handle: tauri::AppHandle, log_filename: String) -> Result<String, String> {
    let logs_dir = get_logs_dir(&app_handle)?;
    let log_path = logs_dir.join(&log_filename);

    if !log_path.exists() {
        return Err("Log file does not exist".to_string());
    }

    let content = fs::read_to_string(&log_path)
        .map_err(|e| format!("Failed to read log file: {}", e))?;

    Ok(content)
}

/// Get the application log directory path
#[tauri::command]
pub async fn get_app_log_dir(app_handle: tauri::AppHandle) -> Result<String, String> {
    let app_log_dir = app_handle
        .path()
        .app_log_dir()
        .map_err(|e| format!("Failed to get app log directory: {}", e))?;
    
    Ok(app_log_dir.to_string_lossy().to_string())
}

/// Open the application log directory in system file manager
#[tauri::command]
pub async fn open_app_log_folder(app_handle: tauri::AppHandle) -> Result<(), String> {
    let app_log_dir = app_handle
        .path()
        .app_log_dir()
        .map_err(|e| format!("Failed to get app log directory: {}", e))?;
    
    // Create log directory if it doesn't exist
    fs::create_dir_all(&app_log_dir)
        .map_err(|e| format!("Failed to create log directory: {}", e))?;

    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .arg(&app_log_dir)
            .spawn()
            .map_err(|e| format!("Failed to open log folder: {}", e))?;
    }

    #[cfg(target_os = "windows")]
    {
        Command::new("explorer")
            .arg(&app_log_dir)
            .spawn()
            .map_err(|e| format!("Failed to open log folder: {}", e))?;
    }

    #[cfg(target_os = "linux")]
    {
        Command::new("xdg-open")
            .arg(&app_log_dir)
            .spawn()
            .map_err(|e| format!("Failed to open log folder: {}", e))?;
    }

    Ok(())
}

/// List all log files in the application log directory
#[tauri::command]
pub async fn list_app_log_files(app_handle: tauri::AppHandle) -> Result<Vec<serde_json::Value>, String> {
    let app_log_dir = app_handle
        .path()
        .app_log_dir()
        .map_err(|e| format!("Failed to get app log directory: {}", e))?;
    
    if !app_log_dir.exists() {
        return Ok(vec![]);
    }
    
    let mut files = Vec::new();
    
    let entries = fs::read_dir(&app_log_dir)
        .map_err(|e| format!("Failed to read log directory: {}", e))?;
    
    for entry in entries {
        if let Ok(entry) = entry {
            let path = entry.path();
            if path.is_file() {
                if let Some(filename) = path.file_name() {
                    let filename = filename.to_string_lossy().to_string();
                    if filename.ends_with(".log") {
                        let metadata = fs::metadata(&path).ok();
                        let size = metadata.as_ref().map(|m| m.len()).unwrap_or(0);
                        let modified = metadata
                            .and_then(|m| m.modified().ok())
                            .map(|t| {
                                let datetime: chrono::DateTime<chrono::Local> = t.into();
                                datetime.format("%Y-%m-%d %H:%M:%S").to_string()
                            })
                            .unwrap_or_default();
                        
                        files.push(serde_json::json!({
                            "name": filename,
                            "path": path.to_string_lossy().to_string(),
                            "size": size,
                            "modified": modified
                        }));
                    }
                }
            }
        }
    }
    
    // Sort by modified time (newest first)
    files.sort_by(|a, b| {
        let a_modified = a.get("modified").and_then(|v| v.as_str()).unwrap_or("");
        let b_modified = b.get("modified").and_then(|v| v.as_str()).unwrap_or("");
        b_modified.cmp(a_modified)
    });
    
    Ok(files)
}

/// Read application log file content
#[tauri::command]
pub async fn read_app_log_file(app_handle: tauri::AppHandle, filename: String) -> Result<String, String> {
    let app_log_dir = app_handle
        .path()
        .app_log_dir()
        .map_err(|e| format!("Failed to get app log directory: {}", e))?;
    
    let log_path = app_log_dir.join(&filename);
    
    if !log_path.exists() {
        return Err("Log file does not exist".to_string());
    }
    
    let content = fs::read_to_string(&log_path)
        .map_err(|e| format!("Failed to read log file: {}", e))?;
    
    Ok(content)
}

/// Terminal information
#[derive(serde::Serialize, serde::Deserialize, Clone)]
pub struct TerminalInfo {
    pub id: String,
    pub name: String,
    pub path: String,
    pub available: bool,
    pub is_default: bool,
}

/// Get available system terminals
#[tauri::command]
pub async fn get_available_terminals() -> Result<Vec<TerminalInfo>, String> {
    let mut terminals = Vec::new();

    #[cfg(target_os = "macos")]
    {
        // Check for Terminal.app
        if std::path::Path::new("/System/Applications/Utilities/Terminal.app").exists() {
            terminals.push(TerminalInfo {
                id: "terminal".to_string(),
                name: "Terminal".to_string(),
                path: "/System/Applications/Utilities/Terminal.app".to_string(),
                available: true,
                is_default: true,
            });
        }

        // Check for iTerm2
        let iterm_paths = [
            "/Applications/iTerm.app",
            "/Users/*/Applications/iTerm.app",
        ];
        for path in &iterm_paths {
            if std::path::Path::new(path).exists() {
                terminals.push(TerminalInfo {
                    id: "iterm2".to_string(),
                    name: "iTerm2".to_string(),
                    path: path.to_string(),
                    available: true,
                    is_default: false,
                });
                break;
            }
        }

        // Check for Warp
        if std::path::Path::new("/Applications/Warp.app").exists() {
            terminals.push(TerminalInfo {
                id: "warp".to_string(),
                name: "Warp".to_string(),
                path: "/Applications/Warp.app".to_string(),
                available: true,
                is_default: false,
            });
        }

        // Check for Alacritty
        if std::path::Path::new("/Applications/Alacritty.app").exists() {
            terminals.push(TerminalInfo {
                id: "alacritty".to_string(),
                name: "Alacritty".to_string(),
                path: "/Applications/Alacritty.app".to_string(),
                available: true,
                is_default: false,
            });
        }

        // Check for Kitty
        if std::path::Path::new("/Applications/kitty.app").exists() {
            terminals.push(TerminalInfo {
                id: "kitty".to_string(),
                name: "Kitty".to_string(),
                path: "/Applications/kitty.app".to_string(),
                available: true,
                is_default: false,
            });
        }
    }

    #[cfg(target_os = "windows")]
    {
        // Check for cmd.exe (always available)
        if let Ok(comspec) = std::env::var("COMSPEC") {
            terminals.push(TerminalInfo {
                id: "cmd".to_string(),
                name: "Command Prompt".to_string(),
                path: comspec,
                available: true,
                is_default: true,
            });
        }

        // Check for PowerShell
        let powershell_paths = [
            "C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe",
            "C:\\Windows\\SysWOW64\\WindowsPowerShell\\v1.0\\powershell.exe",
        ];
        for path in &powershell_paths {
            if std::path::Path::new(path).exists() {
                terminals.push(TerminalInfo {
                    id: "powershell".to_string(),
                    name: "PowerShell".to_string(),
                    path: path.to_string(),
                    available: true,
                    is_default: false,
                });
                break;
            }
        }

        // Check for PowerShell 7+
        let pwsh_paths = [
            "C:\\Program Files\\PowerShell\\7\\pwsh.exe",
            "C:\\Program Files (x86)\\PowerShell\\7\\pwsh.exe",
        ];
        for path in &pwsh_paths {
            if std::path::Path::new(path).exists() {
                terminals.push(TerminalInfo {
                    id: "pwsh".to_string(),
                    name: "PowerShell 7+".to_string(),
                    path: path.to_string(),
                    available: true,
                    is_default: false,
                });
                break;
            }
        }

        // Check for Windows Terminal
        // Windows Terminal is installed via Microsoft Store or Winget
        // Check if wt.exe is in PATH
        if Command::new("where")
            .args(["wt.exe"])
            .output()
            .map(|o| o.status.success())
            .unwrap_or(false)
        {
            terminals.push(TerminalInfo {
                id: "windows-terminal".to_string(),
                name: "Windows Terminal".to_string(),
                path: "wt.exe".to_string(),
                available: true,
                is_default: false,
            });
        }

        // Check for Git Bash
        let git_bash_paths = [
            "C:\\Program Files\\Git\\bin\\bash.exe",
            "C:\\Program Files (x86)\\Git\\bin\\bash.exe",
        ];
        for path in &git_bash_paths {
            if std::path::Path::new(path).exists() {
                terminals.push(TerminalInfo {
                    id: "git-bash".to_string(),
                    name: "Git Bash".to_string(),
                    path: path.to_string(),
                    available: true,
                    is_default: false,
                });
                break;
            }
        }
    }

    #[cfg(target_os = "linux")]
    {
        // Check for common Linux terminal emulators
        let terminals_to_check = [
            ("gnome-terminal", "GNOME Terminal"),
            ("konsole", "Konsole"),
            ("xfce4-terminal", "Xfce Terminal"),
            ("mate-terminal", "MATE Terminal"),
            ("lxterminal", "LXTerminal"),
            ("xterm", "XTerm"),
            ("alacritty", "Alacritty"),
            ("kitty", "Kitty"),
            ("tilix", "Tilix"),
            ("terminator", "Terminator"),
        ];

        let mut found_default = false;
        for (cmd, name) in &terminals_to_check {
            // Check if the terminal is available in PATH
            if Command::new("which")
                .arg(cmd)
                .output()
                .map(|o| o.status.success())
                .unwrap_or(false)
            {
                let is_default = !found_default;
                if is_default {
                    found_default = true;
                }
                
                terminals.push(TerminalInfo {
                    id: cmd.to_string(),
                    name: name.to_string(),
                    path: cmd.to_string(),
                    available: true,
                    is_default,
                });
            }
        }
    }

    if terminals.is_empty() {
        return Err("No system terminals found".to_string());
    }

    Ok(terminals)
}

/// Open a command in a specific system terminal
#[tauri::command]
pub async fn open_in_specific_terminal(
    terminal_id: String,
    command: String,
    cwd: Option<String>,
) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        match terminal_id.as_str() {
            "terminal" => {
                // Use AppleScript to open Terminal.app
                let script = if let Some(ref dir) = cwd {
                    format!(
                        r#"tell application "Terminal"
                            activate
                            do script "cd '{}' && {}"
                        end tell"#,
                        dir.replace("'", "'\\''"),
                        command.replace("\"", "\\\"")
                    )
                } else {
                    format!(
                        r#"tell application "Terminal"
                            activate
                            do script "{}"
                        end tell"#,
                        command.replace("\"", "\\\"")
                    )
                };
                
                Command::new("osascript")
                    .args(["-e", &script])
                    .spawn()
                    .map_err(|e| format!("Failed to open Terminal: {}", e))?;
            }
            "iterm2" => {
                // Use AppleScript to open iTerm2
                let script = if let Some(ref dir) = cwd {
                    format!(
                        r#"tell application "iTerm"
                            create window with default profile
                            tell current session of current window
                                write text "cd '{}' && {}"
                            end tell
                        end tell"#,
                        dir.replace("'", "'\\''"),
                        command.replace("\"", "\\\"")
                    )
                } else {
                    format!(
                        r#"tell application "iTerm"
                            create window with default profile
                            tell current session of current window
                                write text "{}"
                            end tell
                        end tell"#,
                        command.replace("\"", "\\\"")
                    )
                };
                
                Command::new("osascript")
                    .args(["-e", &script])
                    .spawn()
                    .map_err(|e| format!("Failed to open iTerm2: {}", e))?;
            }
            "warp" | "alacritty" | "kitty" => {
                // For other terminals, use open command with shell execution
                let app_name = match terminal_id.as_str() {
                    "warp" => "Warp",
                    "alacritty" => "Alacritty",
                    "kitty" => "kitty",
                    _ => return Err("Unknown terminal".to_string()),
                };
                
                let exec_command = if let Some(ref dir) = cwd {
                    format!("cd '{}' && {}", dir.replace("'", "'\\''"), command)
                } else {
                    command.clone()
                };
                
                Command::new("open")
                    .args(["-a", app_name, "--args", "-e", &exec_command])
                    .spawn()
                    .map_err(|e| format!("Failed to open {}: {}", app_name, e))?;
            }
            _ => return Err(format!("Unknown terminal: {}", terminal_id)),
        }
    }

    #[cfg(target_os = "windows")]
    {
        match terminal_id.as_str() {
            "cmd" => {
                let full_command = if let Some(ref dir) = cwd {
                    format!("cd /d \"{}\" && {}", dir, command)
                } else {
                    command.clone()
                };
                
                Command::new("cmd")
                    .args(["/k", &full_command])
                    .spawn()
                    .map_err(|e| format!("Failed to open Command Prompt: {}", e))?;
            }
            "powershell" | "pwsh" => {
                let ps_exe = if terminal_id == "pwsh" { "pwsh" } else { "powershell" };
                let full_command = if let Some(ref dir) = cwd {
                    format!("Set-Location '{}'; {}", dir.replace("'", "''"), command)
                } else {
                    command.clone()
                };
                
                Command::new(ps_exe)
                    .args(["-NoExit", "-Command", &full_command])
                    .spawn()
                    .map_err(|e| format!("Failed to open PowerShell: {}", e))?;
            }
            "windows-terminal" => {
                // Windows Terminal uses wt.exe
                let mut cmd = Command::new("wt");
                if let Some(ref dir) = cwd {
                    cmd.args(["-d", dir]);
                }
                cmd.arg("cmd").args(["/k", &command]);
                cmd.spawn()
                    .map_err(|e| format!("Failed to open Windows Terminal: {}", e))?;
            }
            "git-bash" => {
                let git_bash_path = if std::path::Path::new("C:\\Program Files\\Git\\bin\\bash.exe").exists() {
                    "C:\\Program Files\\Git\\bin\\bash.exe"
                } else {
                    "C:\\Program Files (x86)\\Git\\bin\\bash.exe"
                };
                
                let exec_command = if let Some(ref dir) = cwd {
                    format!("cd '{}' && {}", dir.replace("\\", "/"), command)
                } else {
                    command.clone()
                };
                
                Command::new(git_bash_path)
                    .args(["-c", &format!("{}; exec bash", exec_command)])
                    .spawn()
                    .map_err(|e| format!("Failed to open Git Bash: {}", e))?;
            }
            _ => return Err(format!("Unknown terminal: {}", terminal_id)),
        }
    }

    #[cfg(target_os = "linux")]
    {
        match terminal_id.as_str() {
            "gnome-terminal" => {
                let mut cmd = Command::new("gnome-terminal");
                cmd.arg("--");
                if let Some(ref dir) = cwd {
                    cmd.args(["bash", "-c", &format!("cd '{}' && {} ; exec bash", dir, command)]);
                } else {
                    cmd.args(["bash", "-c", &format!("{} ; exec bash", command)]);
                }
                cmd.spawn()
                    .map_err(|e| format!("Failed to open GNOME Terminal: {}", e))?;
            }
            "konsole" => {
                let mut cmd = Command::new("konsole");
                if let Some(ref dir) = cwd {
                    cmd.args(["--workdir", dir]);
                }
                cmd.args(["-e", "bash", "-c", &format!("{} ; exec bash", command)]);
                cmd.spawn()
                    .map_err(|e| format!("Failed to open Konsole: {}", e))?;
            }
            other => {
                // Generic approach for other terminals
                let mut cmd = Command::new(other);
                cmd.args(["-e", "bash", "-c"]);
                if let Some(ref dir) = cwd {
                    cmd.arg(&format!("cd '{}' && {} ; exec bash", dir, command));
                } else {
                    cmd.arg(&format!("{} ; exec bash", command));
                }
                cmd.spawn()
                    .map_err(|e| format!("Failed to open {}: {}", other, e))?;
            }
        }
    }

    Ok(())
}
