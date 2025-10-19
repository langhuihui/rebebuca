use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::process::Stdio;
use std::sync::Arc;
use tauri::{Emitter, Manager};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::process::{Child, Command as TokioCommand};
use tokio::sync::Mutex;
use uuid::Uuid;

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
        if let Some(child) = processes.get_mut(id) {
            child
                .kill()
                .await
                .map_err(|e| format!("Failed to kill process: {}", e))?;
            processes.remove(id);
            Ok(())
        } else {
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
    println!("[TAURI] Storing process with key: {}", process_key);
    process_manager.add_process(process_key.clone(), child).await;

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

    // Spawn task to wait for process completion and ensure all output is captured
    let internal_uuid_clone = internal_uuid.clone();
    let app_handle_clone = app_handle.clone();
    let processes_arc = process_manager.get_processes_arc();
    // Use the same key as storage
    let process_key = process_key.clone();

    tokio::spawn(async move {
        // Wait for the process to exit first
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

        // Wait for stdout/stderr tasks to complete
        // This ensures all output from fast-executing commands is captured
        if let Ok(_) = tokio::try_join!(stdout_handle, stderr_handle) {
            println!("Both stdout and stderr tasks completed successfully");
        } else {
            println!("One or both output tasks failed to complete");
        }

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

    // Return internal_uuid, system_pid, and log_filename
    Ok(serde_json::json!({
        "internal_uuid": internal_uuid, // 返回内部UUID，用于前端查找历史记录
        "system_pid": pid, // 返回系统PID，用于进程管理
        "log_filename": log_filename
    })
    .to_string())
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
async fn delete_log_file(app_handle: tauri::AppHandle, log_filename: String) -> Result<(), String> {
    let logs_dir = get_logs_dir(&app_handle)?;
    let log_path = logs_dir.join(&log_filename);

    if log_path.exists() {
        fs::remove_file(&log_path).map_err(|e| format!("Failed to delete log file: {}", e))?;
    }

    Ok(())
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

#[tauri::command]
async fn get_process_stats(system_pid: String, process_manager: tauri::State<'_, ProcessManager>) -> Result<ProcessStats, String> {
    println!("[TAURI] get_process_stats called for system_pid: {}", system_pid);
    let processes = process_manager.get_processes_arc();
    let processes_guard = processes.lock().await;
    
    println!("[TAURI] Current processes in manager: {:?}", processes_guard.keys().collect::<Vec<_>>());
    println!("[TAURI] Looking for process with key: {}", system_pid);
    
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .manage(ProcessManager::new())
        .invoke_handler(tauri::generate_handler![
            greet,
            execute_command,
            kill_process,
            open_logs_folder,
            delete_log_file,
            read_log_file,
            get_process_stats
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
