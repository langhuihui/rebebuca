mod pty;

use pty::{create_pty, write_pty, resize_pty, close_pty, execute_task, kill_task, get_pty_process_stats, PtyManager};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::process::Stdio;
use std::sync::Arc;
use tauri::{Emitter, Manager, menu::{Menu, MenuItem, Submenu, PredefinedMenuItem}, tray::TrayIconBuilder};
#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::process::{Child, Command as TokioCommand};
use tokio::sync::Mutex;
use uuid::Uuid;
use log::info;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RunConfig {
    pub name: String,
    pub command: String,
    pub working_directory: Option<String>,
    pub environment: Option<HashMap<String, String>>,
    pub arguments: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProcessInfo {
    pub internal_id: String,  // 内部UUID，用于前端查找历史记录
    pub system_pid: Option<u32>,  // 系统PID，用于显示和进程管理
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

// Helper function to get logs directory
fn get_logs_dir(app_handle: &tauri::AppHandle) -> Result<PathBuf, String> {
    let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data directory: {}", e))?;

    let logs_dir = app_data_dir.join("logs");

    // Create logs directory if it doesn't exist
    fs::create_dir_all(&logs_dir).map_err(|e| format!("Failed to create logs directory: {}", e))?;

    Ok(logs_dir)
}

// Global state for managing processes
pub struct ProcessManager {
    processes: Arc<Mutex<HashMap<String, Child>>>,
}

impl ProcessManager {
    pub fn new() -> Self {
        Self {
            processes: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub fn get_processes_arc(&self) -> Arc<Mutex<HashMap<String, Child>>> {
        Arc::clone(&self.processes)
    }

    pub async fn add_process(&self, id: String, child: Child) {
        let mut processes = self.processes.lock().await;
        processes.insert(id, child);
    }

    pub async fn remove_process(&self, id: &str) {
        let mut processes = self.processes.lock().await;
        processes.remove(id);
    }

    pub async fn kill_process(&self, id: &str) -> Result<(), String> {
        let mut processes = self.processes.lock().await;
        println!("[TAURI] kill_process called with id: {}", id);
        println!("[TAURI] Available process keys: {:?}", processes.keys().collect::<Vec<_>>());
        
        if let Some(child) = processes.get_mut(id) {
            child
                .kill()
                .await
                .map_err(|e| format!("Failed to kill process: {}", e))?;
            processes.remove(id);
            println!("[TAURI] Successfully killed and removed process: {}", id);
            Ok(())
        } else {
            println!("[TAURI] Process not found with key: {}", id);
            Err("Process not found".to_string())
        }
    }
}

#[tauri::command]
async fn execute_command(
    config: RunConfig,
    app_handle: tauri::AppHandle,
    process_manager: tauri::State<'_, ProcessManager>,
) -> Result<String, String> {
    let internal_uuid = Uuid::new_v4().to_string();

    // Create log file
    let logs_dir = get_logs_dir(&app_handle)?;
    let timestamp = chrono::Local::now().format("%Y%m%d_%H%M%S");
    let log_filename = format!("{}_{}.log", timestamp, &internal_uuid[0..8]);
    let log_path = logs_dir.join(&log_filename);

    // Parse the command - use the command as program name directly
    let program = config.command.trim();
    if program.is_empty() {
        return Err("Empty command".to_string());
    }

    // Use arguments directly from config.arguments, but handle quotes properly
    let mut cmd_args: Vec<String> = config.arguments.unwrap_or_default();

    // Remove surrounding quotes from arguments that have them
    for arg in &mut cmd_args {
        if arg.starts_with('"') && arg.ends_with('"') && arg.len() > 1 {
            *arg = arg[1..arg.len() - 1].to_string();
        }
    }

    // Special handling for Windows ping command to ensure real-time output
    #[cfg(target_os = "windows")]
    if program == "ping" {
        // Add -t flag to ping continuously if not already present
        if !cmd_args.iter().any(|arg| arg == "-t" || arg == "/t") {
            cmd_args.push("-t".to_string());
        }
    }

    // Create the command
    let mut cmd = TokioCommand::new(program);
    cmd.args(&cmd_args);

    // Set working directory if provided
    if let Some(working_dir) = config.working_directory {
        if !working_dir.is_empty() {
            cmd.current_dir(working_dir);
        }
    }

    // Set environment variables if provided
    if let Some(env_vars) = config.environment {
        for (key, value) in env_vars {
            cmd.env(key, value);
        }
    }

    // For Windows ping command, add special handling to ensure unbuffered output
    #[cfg(target_os = "windows")]
    if program == "ping" {
        // Force unbuffered output for ping command
        cmd.env("PYTHONUNBUFFERED", "1");
        cmd.env("PYTHONIOENCODING", "utf-8");
    }

    // Configure stdout and stderr
    cmd.stdout(Stdio::piped());
    cmd.stderr(Stdio::piped());

    // Send system message - starting
    let full_command = if cmd_args.is_empty() {
        config.command.clone()
    } else {
        // Quote arguments that contain spaces
        let quoted_args: Vec<String> = cmd_args
            .iter()
            .map(|arg| {
                if arg.contains(' ') {
                    format!("\"{}\"", arg)
                } else {
                    arg.to_string()
                }
            })
            .collect();
        format!("{} {}", config.command, quoted_args.join(" "))
    };
    println!("[TAURI] Executing command: {}", full_command);
    println!("[TAURI] Command: {}, Args: {:?}", program, cmd_args);
    let _ = app_handle.emit(
        "process-output",
        OutputEvent {
            process_id: internal_uuid.clone(),
            output_type: OutputType::System,
            content: format!("Starting: {}\n", full_command),
        },
    );

    // Spawn the process
    let mut child = cmd
        .spawn()
        .map_err(|e| {
            println!("[TAURI] Failed to spawn process: {}", e);
            format!("Failed to spawn process: {}", e)
        })?;

    // Get the PID
    let pid = child.id();

    // Send process info (moved to after process storage)
    println!("[TAURI] Process started - Internal UUID: {}, System PID: {}", internal_uuid, pid.unwrap_or(0));

    // Take stdout and stderr
    let stdout = child.stdout.take().ok_or_else(|| {
        println!("[TAURI] Failed to capture stdout");
        "Failed to capture stdout".to_string()
    })?;
    let stderr = child.stderr.take().ok_or_else(|| {
        println!("[TAURI] Failed to capture stderr");
        "Failed to capture stderr".to_string()
    })?;

    let internal_uuid_clone = internal_uuid.clone();
    let app_handle_clone = app_handle.clone();
    let log_path_clone = log_path.clone();

    // Spawn task for stdout with immediate reading
    let stdout_handle = tokio::spawn(async move {
        let mut reader = BufReader::new(stdout);
        let mut log_file = tokio::fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(&log_path_clone)
            .await
            .ok();

        let mut buffer = Vec::new();
        let mut total_output = String::new();
        
        loop {
            buffer.clear();
            match reader.read_until(b'\n', &mut buffer).await {
                Ok(0) => {
                    println!("[TAURI] stdout EOF reached for PID: {}", internal_uuid_clone);
                    break; // EOF
                }
                Ok(_) => {
                    // Convert bytes to string, handling encoding issues
                    let content = match String::from_utf8(buffer.clone()) {
                        Ok(s) => s,
                        Err(_) => {
                            // If UTF-8 conversion fails, try to decode as GBK/CP936 (Windows Chinese encoding)
                            // or use lossy conversion as fallback
                            String::from_utf8_lossy(&buffer).to_string()
                        }
                    };
                    
                    // Skip empty lines or just whitespace
                    if content.trim().is_empty() {
                        continue;
                    }
                    
                    total_output.push_str(&content);

                    // Write to log file
                    if let Some(ref mut file) = log_file {
                        let _ = file.write_all(content.as_bytes()).await;
                    }

                    // Emit output immediately
                    println!("[TAURI] Sending stdout output - PID: {}, Content: {:?}", 
                             internal_uuid_clone, content.chars().take(100).collect::<String>());
                    let _ = app_handle_clone.emit(
                        "process-output",
                        OutputEvent {
                            process_id: internal_uuid_clone.clone(),
                            output_type: OutputType::Stdout,
                            content,
                        },
                    );
                }
                Err(e) => {
                    println!("[TAURI] stdout read error for PID {}: {}", internal_uuid_clone, e);
                    break;
                }
            }
        }
        
        // If we captured any output, ensure it's all sent
        if !total_output.is_empty() {
            println!("Total stdout captured: {} bytes", total_output.len());
        }
    });

    let internal_uuid_clone = internal_uuid.clone();
    let app_handle_clone = app_handle.clone();
    let log_path_clone = log_path.clone();

    // Spawn task for stderr with immediate reading
    let stderr_handle = tokio::spawn(async move {
        let mut reader = BufReader::new(stderr);
        let mut log_file = tokio::fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(&log_path_clone)
            .await
            .ok();

        let mut buffer = Vec::new();
        let mut total_error = String::new();
        
        loop {
            buffer.clear();
            match reader.read_until(b'\n', &mut buffer).await {
                Ok(0) => {
                    println!("[TAURI] stderr EOF reached for PID: {}", internal_uuid_clone);
                    break; // EOF
                }
                Ok(_) => {
                    // Convert bytes to string, handling encoding issues
                    let raw_content = match String::from_utf8(buffer.clone()) {
                        Ok(s) => s,
                        Err(_) => {
                            // If UTF-8 conversion fails, use lossy conversion as fallback
                            String::from_utf8_lossy(&buffer).to_string()
                        }
                    };
                    
                    let content = format!("[ERROR] {}", raw_content);
                    total_error.push_str(&content);

                    // Write to log file
                    if let Some(ref mut file) = log_file {
                        let _ = file.write_all(content.as_bytes()).await;
                    }

                    println!("[TAURI] Sending stderr output - PID: {}, Content: {:?}", 
                             internal_uuid_clone, content.chars().take(100).collect::<String>());
                    let _ = app_handle_clone.emit(
                        "process-output",
                        OutputEvent {
                            process_id: internal_uuid_clone.clone(),
                            output_type: OutputType::Stderr,
                            content,
                        },
                    );
                }
                Err(e) => {
                    println!("[TAURI] stderr read error for PID {}: {}", internal_uuid_clone, e);
                    break;
                }
            }
        }
        
        // If we captured any error output, log it
        if !total_error.is_empty() {
            println!("Total stderr captured: {} bytes, Content: {:?}", 
                     total_error.len(), total_error.chars().take(200).collect::<String>());
        }
    });

    // Store the child process using consistent key
    let process_key = pid.map(|p| p.to_string()).unwrap_or_else(|| internal_uuid.clone());
    println!("[TAURI] Storing process with key: {} (pid: {:?}, internal_uuid: {})", process_key, pid, internal_uuid);
    process_manager.add_process(process_key.clone(), child).await;
    
    // Verify the process was stored
    {
        let processes = process_manager.get_processes_arc();
        let processes_guard = processes.lock().await;
        println!("[TAURI] Process stored successfully. Available processes: {:?}", processes_guard.keys().collect::<Vec<_>>());
    }

    // Send process-started event will be sent after execute_command returns

    // Give stdout/stderr tasks more time to start and capture output
    // This is especially important for fast-executing commands like 'dir'
    // For ping command, we need more time to ensure output is captured
    let sleep_duration = if program == "ping" {
        tokio::time::Duration::from_millis(500) // Increased for ping
    } else {
        tokio::time::Duration::from_millis(50)
    };
    tokio::time::sleep(sleep_duration).await;

    // Return the result first
    let result = serde_json::json!({
        "internal_uuid": internal_uuid, // 返回内部UUID，用于前端查找历史记录
        "system_pid": pid, // 返回系统PID，用于进程管理
        "log_filename": log_filename
    })
    .to_string();

    // Spawn task to wait for process completion AFTER returning the result
    // This ensures the process remains in the manager when the function returns
    let internal_uuid_clone = internal_uuid.clone();
    let app_handle_clone = app_handle.clone();
    let processes_arc = process_manager.get_processes_arc();
    let process_key = process_key.clone();
    let stdout_handle_clone = stdout_handle;
    let stderr_handle_clone = stderr_handle;

    // Start the completion monitoring task in the background
    // For long-running processes, we should not immediately remove them from the manager
    tokio::spawn(async move {
        // Wait for stdout/stderr tasks to complete first
        // This ensures all output from fast-executing commands is captured
        if let Ok(_) = tokio::try_join!(stdout_handle_clone, stderr_handle_clone) {
            println!("Both stdout and stderr tasks completed successfully");
        } else {
            println!("One or both output tasks failed to complete");
        }
        
        // Now wait for the process to exit
        let status = {
            let mut processes = processes_arc.lock().await;
            println!("[TAURI] Process completion task - looking for process_key: {}", process_key);
            println!("[TAURI] Available processes before waiting: {:?}", processes.keys().collect::<Vec<_>>());
            if let Some(mut child) = processes.remove(&process_key) {
                println!("[TAURI] Found process {} in manager, waiting for completion", process_key);
                drop(processes); // Release the lock before awaiting
                child.wait().await
            } else {
                println!("[TAURI] Process {} not found in manager during completion", process_key);
                return;
            }
        };

        // Process was already removed from manager when we started waiting for completion


        match status {
            Ok(exit_status) => {
                let status_type = if exit_status.success() {
                    ProcessStatus::Stopped
                } else {
                    ProcessStatus::Error
                };

                println!("[TAURI] Process exited with code: {:?}", exit_status.code());
                let _ = app_handle_clone.emit(
                    "process-output",
                    OutputEvent {
                        process_id: internal_uuid_clone.clone(),
                        output_type: OutputType::System,
                        content: format!("Process exited with code: {:?}\n", exit_status.code()),
                    },
                );

                println!("[TAURI] Sending process-stopped event - Internal UUID: {}, Status: {:?}", 
                         internal_uuid_clone, status_type);
                let _ = app_handle_clone.emit(
                    "process-stopped",
                    ProcessInfo {
                        internal_id: internal_uuid_clone,
                        system_pid: None,
                        config_name: String::new(),
                        status: status_type,
                    },
                );
            }
            Err(e) => {
                let _ = app_handle_clone.emit(
                    "process-output",
                    OutputEvent {
                        process_id: internal_uuid_clone.clone(),
                        output_type: OutputType::System,
                        content: format!("Process error: {}\n", e),
                    },
                );

                let _ = app_handle_clone.emit(
                    "process-stopped",
                    ProcessInfo {
                        internal_id: internal_uuid_clone,
                        system_pid: None,
                        config_name: String::new(),
                        status: ProcessStatus::Error,
                    },
                );
            }
        }
    });

    // process-started event will be sent by frontend after execute_command completes

    // Return the result
    Ok(result)
}

#[tauri::command]
async fn kill_process(
    system_pid: String,
    process_manager: tauri::State<'_, ProcessManager>,
    app_handle: tauri::AppHandle,
) -> Result<(), String> {
    process_manager.kill_process(&system_pid).await?;

    let _ = app_handle.emit(
        "process-output",
        OutputEvent {
            process_id: system_pid.clone(),
            output_type: OutputType::System,
            content: "Process killed by user\n".to_string(),
        },
    );

    let _ = app_handle.emit(
        "process-stopped",
        ProcessInfo {
            internal_id: system_pid.clone(), // 这里system_pid是系统PID，但前端会通过系统PID找到对应的历史记录
            system_pid: system_pid.parse().ok(), // 解析系统PID
            config_name: String::new(),
            status: ProcessStatus::Stopped,
        },
    );

    Ok(())
}

#[tauri::command]
async fn open_logs_folder(app_handle: tauri::AppHandle) -> Result<(), String> {
    let logs_dir = get_logs_dir(&app_handle)?;

    // Open the logs directory in the system file manager
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&logs_dir)
            .spawn()
            .map_err(|e| format!("Failed to open logs folder: {}", e))?;
    }

    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .arg(&logs_dir)
            .spawn()
            .map_err(|e| format!("Failed to open logs folder: {}", e))?;
    }

    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(&logs_dir)
            .spawn()
            .map_err(|e| format!("Failed to open logs folder: {}", e))?;
    }

    Ok(())
}

#[tauri::command]
async fn open_file_with_default_app(path: String) -> Result<(), String> {
    // Open the file with the system default application
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&path)
            .spawn()
            .map_err(|e| format!("Failed to open file: {}", e))?;
    }

    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("cmd")
            .args(["/c", "start", "", &path])
            .spawn()
            .map_err(|e| format!("Failed to open file: {}", e))?;
    }

    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(&path)
            .spawn()
            .map_err(|e| format!("Failed to open file: {}", e))?;
    }

    Ok(())
}

#[tauri::command]
async fn open_in_system_terminal(command: String, cwd: Option<String>) -> Result<(), String> {
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
        
        std::process::Command::new("osascript")
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
        
        std::process::Command::new("powershell")
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
                let mut cmd = std::process::Command::new(terminal);
                cmd.arg("--");
                if let Some(ref dir) = cwd {
                    cmd.args(["bash", "-c", &format!("cd '{}' && {} ; exec bash", dir, command)]);
                } else {
                    cmd.args(["bash", "-c", &format!("{} ; exec bash", command)]);
                }
                cmd.spawn()
            } else if terminal == "konsole" {
                let mut cmd = std::process::Command::new(terminal);
                if let Some(ref dir) = cwd {
                    cmd.args(["--workdir", dir]);
                }
                cmd.args(["-e", "bash", "-c", &format!("{} ; exec bash", command)]);
                cmd.spawn()
            } else {
                let mut cmd = std::process::Command::new(terminal);
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
async fn delete_log_file(app_handle: tauri::AppHandle, log_filename: String) -> Result<(), String> {
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
async fn generate_log_path(app_handle: tauri::AppHandle) -> Result<serde_json::Value, String> {
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
async fn read_log_file(app_handle: tauri::AppHandle, log_filename: String) -> Result<String, String> {
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
async fn get_app_log_dir(app_handle: tauri::AppHandle) -> Result<String, String> {
    let app_log_dir = app_handle
        .path()
        .app_log_dir()
        .map_err(|e| format!("Failed to get app log directory: {}", e))?;
    
    Ok(app_log_dir.to_string_lossy().to_string())
}

/// Open the application log directory in system file manager
#[tauri::command]
async fn open_app_log_folder(app_handle: tauri::AppHandle) -> Result<(), String> {
    let app_log_dir = app_handle
        .path()
        .app_log_dir()
        .map_err(|e| format!("Failed to get app log directory: {}", e))?;
    
    // Create log directory if it doesn't exist
    fs::create_dir_all(&app_log_dir)
        .map_err(|e| format!("Failed to create log directory: {}", e))?;

    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&app_log_dir)
            .spawn()
            .map_err(|e| format!("Failed to open log folder: {}", e))?;
    }

    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .arg(&app_log_dir)
            .spawn()
            .map_err(|e| format!("Failed to open log folder: {}", e))?;
    }

    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(&app_log_dir)
            .spawn()
            .map_err(|e| format!("Failed to open log folder: {}", e))?;
    }

    Ok(())
}

/// List all log files in the application log directory
#[tauri::command]
async fn list_app_log_files(app_handle: tauri::AppHandle) -> Result<Vec<serde_json::Value>, String> {
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
async fn read_app_log_file(app_handle: tauri::AppHandle, filename: String) -> Result<String, String> {
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

#[tauri::command]
async fn get_process_stats(system_pid: String, process_manager: tauri::State<'_, ProcessManager>) -> Result<ProcessStats, String> {
    println!("[TAURI] get_process_stats called for system_pid: {}", system_pid);
    let processes = process_manager.get_processes_arc();
    let processes_guard = processes.lock().await;
    
    println!("[TAURI] Current processes in manager: {:?}", processes_guard.keys().collect::<Vec<_>>());
    println!("[TAURI] Looking for process with key: {}", system_pid);
    println!("[TAURI] Process manager state: {} processes total", processes_guard.len());
    
    // Check if process still exists in our manager
    if let Some(child) = processes_guard.get(&system_pid) {
        if let Some(pid) = child.id() {
            // Get process stats using sysinfo
            let mut sys = sysinfo::System::new_all();
            sys.refresh_processes();
            
            if let Some(process) = sys.process(sysinfo::Pid::from_u32(pid)) {
                let cpu_usage = process.cpu_usage() as f64;
                let memory_usage = process.memory();
                let memory_usage_mb = format!("{:.1}MB", memory_usage as f64 / 1024.0 / 1024.0);
                
                return Ok(ProcessStats {
                    process_id: system_pid,
                    cpu_usage,
                    memory_usage,
                    memory_usage_mb,
                });
            } else {
                // Process exists in our manager but not in system - it has finished
                // Remove it from our manager to avoid future calls
                drop(processes_guard);
                process_manager.remove_process(&system_pid).await;
                return Err("Process has finished".to_string());
            }
        } else {
            return Err("Process has no PID".to_string());
        }
    }
    
    // Process not found in our manager - it has been removed (likely finished)
    Err("Process not found - it has finished".to_string())
}

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
async fn get_running_processes(process_manager: tauri::State<'_, ProcessManager>) -> Result<Vec<String>, String> {
    let processes = process_manager.get_processes_arc();
    let processes_guard = processes.lock().await;
    Ok(processes_guard.keys().cloned().collect())
}

#[tauri::command]
async fn restart_process(
    system_pid: String,
    config: RunConfig,
    process_manager: tauri::State<'_, ProcessManager>,
    app_handle: tauri::AppHandle,
) -> Result<String, String> {
    // First kill the existing process
    if let Err(e) = process_manager.kill_process(&system_pid).await {
        println!("Warning: Failed to kill existing process {}: {}", system_pid, e);
    }

    // Wait a bit for the process to be fully terminated
    tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;

    // Start the new process
    execute_command(config, app_handle, process_manager).await
}

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
async fn get_port_processes() -> Result<Vec<PortProcess>, String> {
    use std::process::Command;
    
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
                                .map(|o| {
                                    let s = String::from_utf8_lossy(&o.stdout);
                                    s.split(',').next().unwrap_or("").trim_matches('"').to_string()
                                })
                                .unwrap_or_default();
                            
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
async fn kill_process_by_port(port: u16) -> Result<(), String> {
    use std::process::Command;
    
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
async fn kill_process_by_pid(pid: u32) -> Result<(), String> {
    use std::process::Command;
    
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

/// Execute command result
#[derive(serde::Serialize)]
pub struct AdminExecResult {
    pub success: bool,
    pub stdout: String,
    pub stderr: String,
    pub exit_code: Option<i32>,
}

/// Execute a command with administrator privileges
/// - macOS: Uses osascript with "administrator privileges"
/// - Windows: Uses PowerShell Start-Process -Verb RunAs
/// - Linux: Uses pkexec (PolicyKit)
#[tauri::command]
async fn execute_with_admin(command: String, args: Option<Vec<String>>) -> Result<AdminExecResult, String> {
    use std::process::Command;
    
    let args = args.unwrap_or_default();
    
    #[cfg(target_os = "macos")]
    {
        // Build full command string
        let full_command = if args.is_empty() {
            command.clone()
        } else {
            format!("{} {}", command, args.join(" "))
        };
        
        // Escape for AppleScript
        let escaped_command = full_command
            .replace("\\", "\\\\\\\\")
            .replace("\"", "\\\"")
            .replace("'", "'\\''");
        
        let script = format!(
            r#"do shell script "{}" with administrator privileges"#,
            escaped_command
        );
        
        println!("[Admin] Executing with admin privileges: {}", full_command);
        
        let output = Command::new("osascript")
            .args(["-e", &script])
            .output()
            .map_err(|e| format!("Failed to execute osascript: {}", e))?;
        
        let stdout = String::from_utf8_lossy(&output.stdout).to_string();
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();
        
        // Check if user cancelled
        if stderr.contains("User canceled") || stderr.contains("user canceled") {
            return Err("User cancelled the operation".to_string());
        }
        
        Ok(AdminExecResult {
            success: output.status.success(),
            stdout,
            stderr,
            exit_code: output.status.code(),
        })
    }
    
    #[cfg(target_os = "windows")]
    {
        // Build full command string for cmd.exe
        let full_command = if args.is_empty() {
            command.clone()
        } else {
            format!("{} {}", command, args.join(" "))
        };
        
        // Escape for PowerShell
        let escaped_command = full_command.replace("\"", "`\"");
        
        // Create a temp script to capture output
        let temp_dir = std::env::temp_dir();
        let stdout_file = temp_dir.join(format!("rebebuca_admin_stdout_{}.txt", std::process::id()));
        let stderr_file = temp_dir.join(format!("rebebuca_admin_stderr_{}.txt", std::process::id()));
        
        // PowerShell script to run as admin and capture output
        let ps_script = format!(
            r#"
            $process = Start-Process -FilePath "cmd.exe" -ArgumentList '/c {} > "{}" 2> "{}"' -Verb RunAs -Wait -PassThru
            exit $process.ExitCode
            "#,
            escaped_command,
            stdout_file.display(),
            stderr_file.display()
        );
        
        println!("[Admin] Executing with admin privileges: {}", full_command);
        
        let output = Command::new("powershell")
            .args(["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", &ps_script])
            .output()
            .map_err(|e| format!("Failed to execute PowerShell: {}", e))?;
        
        // Read output files
        let stdout = std::fs::read_to_string(&stdout_file).unwrap_or_default();
        let stderr = std::fs::read_to_string(&stderr_file).unwrap_or_default();
        
        // Cleanup temp files
        let _ = std::fs::remove_file(&stdout_file);
        let _ = std::fs::remove_file(&stderr_file);
        
        // Check if user cancelled (UAC denied)
        if stderr.contains("Operation was canceled") || !output.status.success() && stdout.is_empty() && stderr.is_empty() {
            return Err("User cancelled the operation or UAC was denied".to_string());
        }
        
        Ok(AdminExecResult {
            success: output.status.success(),
            stdout,
            stderr,
            exit_code: output.status.code(),
        })
    }
    
    #[cfg(target_os = "linux")]
    {
        // Use pkexec (PolicyKit) for Linux
        println!("[Admin] Executing with pkexec: {} {:?}", command, args);
        
        let output = Command::new("pkexec")
            .arg(&command)
            .args(&args)
            .output()
            .map_err(|e| format!("Failed to execute pkexec: {}", e))?;
        
        let stdout = String::from_utf8_lossy(&output.stdout).to_string();
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();
        
        // Check if user cancelled
        if stderr.contains("dismissed") || stderr.contains("Not authorized") {
            return Err("User cancelled the operation or not authorized".to_string());
        }
        
        Ok(AdminExecResult {
            success: output.status.success(),
            stdout,
            stderr,
            exit_code: output.status.code(),
        })
    }
}

/// Request file system access permission on macOS
/// This triggers the system permission dialog for accessing protected directories
#[tauri::command]
async fn request_folder_access(path: String) -> Result<bool, String> {
    use std::process::Command;
    
    #[cfg(target_os = "macos")]
    {
        // Try to list directory contents to trigger permission dialog
        let output = Command::new("ls")
            .arg(&path)
            .output();
        
        match output {
            Ok(o) => {
                if o.status.success() {
                    Ok(true)
                } else {
                    let stderr = String::from_utf8_lossy(&o.stderr);
                    if stderr.contains("Operation not permitted") {
                        // macOS will show permission dialog automatically when app tries to access
                        // We need to use NSOpenPanel or similar to trigger proper permission request
                        // For now, return false and let user grant permission in System Preferences
                        Err("Permission denied. Please grant access in System Preferences > Security & Privacy > Privacy > Files and Folders".to_string())
                    } else {
                        Err(stderr.to_string())
                    }
                }
            }
            Err(e) => Err(format!("Failed to access path: {}", e))
        }
    }
    
    #[cfg(not(target_os = "macos"))]
    {
        // On Windows/Linux, just check if path exists and is accessible
        use std::path::Path;
        let path = Path::new(&path);
        if path.exists() {
            match std::fs::read_dir(path) {
                Ok(_) => Ok(true),
                Err(e) => Err(format!("Cannot access folder: {}", e))
            }
        } else {
            Err("Path does not exist".to_string())
        }
    }
}

/// Check if a command requires admin privileges
#[tauri::command]
fn check_needs_admin(command: String) -> bool {
    let cmd_lower = command.to_lowercase();
    let cmd_trimmed = cmd_lower.trim();
    
    // Commands that typically need admin
    let admin_commands = [
        "sudo ",
        "su ",
        "doas ",
        "pkexec ",
        // Windows admin commands
        "runas ",
        "net user",
        "net localgroup",
        "netsh ",
        "bcdedit",
        "diskpart",
        "sfc ",
        "dism ",
        "chkdsk ",
        // System modification commands
        "chmod ",
        "chown ",
        "mount ",
        "umount ",
        "fdisk ",
        "mkfs ",
        "systemctl ",
        "service ",
        "launchctl ",
        // Package managers that may need admin
        "apt ",
        "apt-get ",
        "yum ",
        "dnf ",
        "pacman ",
        "brew services",
    ];
    
    // Check if command starts with any admin command
    for admin_cmd in admin_commands {
        if cmd_trimmed.starts_with(admin_cmd) {
            return true;
        }
    }
    
    // Check for sudo in piped commands
    if cmd_lower.contains("| sudo ") || cmd_lower.contains("&& sudo ") || cmd_lower.contains("; sudo ") {
        return true;
    }
    
    false
}


#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(
            tauri_plugin_log::Builder::new()
                .target(tauri_plugin_log::Target::new(
                    tauri_plugin_log::TargetKind::LogDir { file_name: Some("app".into()) },
                ))
                .max_file_size(5_000_000) // 5MB per file
                .rotation_strategy(tauri_plugin_log::RotationStrategy::KeepAll)
                .level(log::LevelFilter::Info)
                .build()
        )
        .setup(|app| {
            info!("[APP] Rebebuca starting up...");
            
            // Create a simple static tray icon
            // The frontend can create additional dynamic menus if needed
            info!("[TRAY] Creating tray icon in Rust backend");
            
            // Create tray menu items
            let quit_item = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;
            let show_item = MenuItem::with_id(app, "show", "显示主窗口", true, None::<&str>)?;
            
            // Create the menu
            let menu = Menu::with_items(app, &[&show_item, &quit_item])?;
            
            // Create application menu with Edit submenu (for copy/paste shortcuts) and Help submenu
            // Edit menu - required for keyboard shortcuts on macOS
            let edit_submenu = Submenu::with_items(app, "Edit", true, &[
                &PredefinedMenuItem::undo(app, Some("Undo"))?,
                &PredefinedMenuItem::redo(app, Some("Redo"))?,
                &PredefinedMenuItem::separator(app)?,
                &PredefinedMenuItem::cut(app, Some("Cut"))?,
                &PredefinedMenuItem::copy(app, Some("Copy"))?,
                &PredefinedMenuItem::paste(app, Some("Paste"))?,
                &PredefinedMenuItem::select_all(app, Some("Select All"))?,
            ])?;
            
            // Help menu
            let about_item = MenuItem::with_id(app, "about", "关于 Rebebuca", true, None::<&str>)?;
            let website_item = MenuItem::with_id(app, "website", "访问官网", true, None::<&str>)?;
            let help_submenu = Submenu::with_items(app, "帮助", true, &[&about_item, &website_item])?;
            
            let app_menu = Menu::with_items(app, &[&edit_submenu, &help_submenu])?;
            app.set_menu(app_menu)?;
            
            // Handle application menu events
            app.on_menu_event(|app_handle, event| {
                match event.id.as_ref() {
                    "about" => {
                        info!("[MENU] About menu item clicked");
                        // Emit event to frontend to show about dialog
                        let _ = app_handle.emit("show-about-dialog", ());
                    }
                    "website" => {
                        info!("[MENU] Website menu item clicked");
                        // Open the website in default browser
                        let _ = std::process::Command::new("open")
                            .arg("https://rebebuca.com")
                            .spawn();
                        #[cfg(target_os = "windows")]
                        {
                            let _ = std::process::Command::new("cmd")
                                .args(["/c", "start", "https://rebebuca.com"])
                                .spawn();
                        }
                        #[cfg(target_os = "linux")]
                        {
                            let _ = std::process::Command::new("xdg-open")
                                .arg("https://rebebuca.com")
                                .spawn();
                        }
                    }
                    _ => {}
                }
            });
            
            // Get the default window icon
            let tray_icon = app.default_window_icon()
                .ok_or("No default window icon available")?
                .clone();
            
            // Create tray icon - use a unique ID
            let _tray = TrayIconBuilder::with_id("rust-tray")
                .icon(tray_icon)
                .menu(&menu)
                .show_menu_on_left_click(false)  // macOS: right-click for menu
                .on_menu_event(|app, event| {
                    match event.id.as_ref() {
                        "quit" => {
                            info!("[TRAY] Quit menu item clicked");
                            app.exit(0);
                        }
                        "show" => {
                            info!("[TRAY] Show menu item clicked");
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                        _ => {}
                    }
                })
                .on_tray_icon_event(|tray, event| {
                    // Handle left-click to show window
                    if let tauri::tray::TrayIconEvent::Click { button, .. } = event {
                        if button == tauri::tray::MouseButton::Left {
                            info!("[TRAY] Tray icon left-clicked");
                            if let Some(app) = tray.app_handle().get_webview_window("main") {
                                let _ = app.show();
                                let _ = app.set_focus();
                            }
                        }
                    }
                })
                .build(app)?;
            
            info!("[TRAY] Tray icon created successfully");
            Ok(())
        })
        .manage(ProcessManager::new())
        .manage(PtyManager::new())
        .invoke_handler(tauri::generate_handler![
            greet,
            execute_command,
            kill_process,
            restart_process,
            get_running_processes,
            open_logs_folder,
            open_file_with_default_app,
            open_in_system_terminal,
            delete_log_file,
            generate_log_path,
            read_log_file,
            get_process_stats,
            create_pty,
            write_pty,
            resize_pty,
            close_pty,
            execute_task,
            kill_task,
            get_pty_process_stats,
            get_app_log_dir,
            open_app_log_folder,
            list_app_log_files,
            read_app_log_file,
            get_port_processes,
            kill_process_by_port,
            kill_process_by_pid,
            execute_with_admin,
            request_folder_access,
            check_needs_admin
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
