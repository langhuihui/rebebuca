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
