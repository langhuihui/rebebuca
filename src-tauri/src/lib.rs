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
    pub process_id: String,
    pub config_name: String,
    pub pid: Option<u32>,
    pub status: ProcessStatus,
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
    fs::create_dir_all(&logs_dir)
        .map_err(|e| format!("Failed to create logs directory: {}", e))?;
    
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
    let process_id = Uuid::new_v4().to_string();
    
    // Create log file
    let logs_dir = get_logs_dir(&app_handle)?;
    let timestamp = chrono::Local::now().format("%Y%m%d_%H%M%S");
    let log_filename = format!("{}_{}.log", timestamp, &process_id[0..8]);
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
            *arg = arg[1..arg.len()-1].to_string();
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
    let _ = app_handle.emit(
        "process-output",
        OutputEvent {
            process_id: process_id.clone(),
            output_type: OutputType::System,
            content: format!("Starting: {}\n", full_command),
        },
    );

    // Spawn the process
    let mut child = cmd.spawn().map_err(|e| format!("Failed to spawn process: {}", e))?;

    // Get the PID
    let pid = child.id();

    // Send process info
    let _ = app_handle.emit(
        "process-started",
        ProcessInfo {
            process_id: process_id.clone(),
            config_name: config.name.clone(),
            pid,
            status: ProcessStatus::Running,
        },
    );

    // Take stdout and stderr
    let stdout = child.stdout.take().ok_or("Failed to capture stdout")?;
    let stderr = child.stderr.take().ok_or("Failed to capture stderr")?;

    let process_id_clone = process_id.clone();
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

        let mut buffer = String::new();
        loop {
            buffer.clear();
            match reader.read_line(&mut buffer).await {
                Ok(0) => break, // EOF
                Ok(_) => {
                    let content = buffer.clone();
                    
                    // Write to log file
                    if let Some(ref mut file) = log_file {
                        let _ = file.write_all(content.as_bytes()).await;
                    }
                    
                    let _ = app_handle_clone.emit(
                        "process-output",
                        OutputEvent {
                            process_id: process_id_clone.clone(),
                            output_type: OutputType::Stdout,
                            content,
                        },
                    );
                }
                Err(_) => break,
            }
        }
    });

    let process_id_clone = process_id.clone();
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

        let mut buffer = String::new();
        loop {
            buffer.clear();
            match reader.read_line(&mut buffer).await {
                Ok(0) => break, // EOF
                Ok(_) => {
                    let content = format!("[ERROR] {}", buffer);
                    
                    // Write to log file
                    if let Some(ref mut file) = log_file {
                        let _ = file.write_all(content.as_bytes()).await;
                    }
                    
                    let _ = app_handle_clone.emit(
                        "process-output",
                        OutputEvent {
                            process_id: process_id_clone.clone(),
                            output_type: OutputType::Stderr,
                            content,
                        },
                    );
                }
                Err(_) => break,
            }
        }
    });

    // Store the child process
    process_manager.add_process(process_id.clone(), child).await;

    // Yield to give stdout/stderr tasks a chance to start before we return
    // This helps ensure they're ready to capture output from fast-executing commands
    tokio::task::yield_now().await;

    // Spawn task to wait for process completion
    let process_id_clone = process_id.clone();
    let app_handle_clone = app_handle.clone();
    let processes_arc = process_manager.get_processes_arc();

    tokio::spawn(async move {
        // Wait for the process to exit first
        let status = {
            let mut processes = processes_arc.lock().await;
            if let Some(mut child) = processes.remove(&process_id_clone) {
                drop(processes); // Release the lock before awaiting
                child.wait().await
            } else {
                return;
            }
        };

        // Give stdout/stderr tasks a moment to finish reading any remaining output
        // but don't wait indefinitely for them to complete
        tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;

        match status {
            Ok(exit_status) => {
                let status_type = if exit_status.success() {
                    ProcessStatus::Stopped
                } else {
                    ProcessStatus::Error
                };

                let _ = app_handle_clone.emit(
                    "process-output",
                    OutputEvent {
                        process_id: process_id_clone.clone(),
                        output_type: OutputType::System,
                        content: format!("Process exited with code: {:?}\n", exit_status.code()),
                    },
                );

                let _ = app_handle_clone.emit(
                    "process-stopped",
                    ProcessInfo {
                        process_id: process_id_clone,
                        config_name: String::new(),
                        pid: None,
                        status: status_type,
                    },
                );
            }
            Err(e) => {
                let _ = app_handle_clone.emit(
                    "process-output",
                    OutputEvent {
                        process_id: process_id_clone.clone(),
                        output_type: OutputType::System,
                        content: format!("Process error: {}\n", e),
                    },
                );

                let _ = app_handle_clone.emit(
                    "process-stopped",
                    ProcessInfo {
                        process_id: process_id_clone,
                        config_name: String::new(),
                        pid: None,
                        status: ProcessStatus::Error,
                    },
                );
            }
        }
    });

    // Return both process_id and log_filename
    Ok(serde_json::json!({
        "process_id": process_id,
        "log_filename": log_filename
    }).to_string())
}

#[tauri::command]
async fn kill_process(
    process_id: String,
    process_manager: tauri::State<'_, ProcessManager>,
    app_handle: tauri::AppHandle,
) -> Result<(), String> {
    process_manager.kill_process(&process_id).await?;

    let _ = app_handle.emit(
        "process-output",
        OutputEvent {
            process_id: process_id.clone(),
            output_type: OutputType::System,
            content: "Process killed by user\n".to_string(),
        },
    );

    let _ = app_handle.emit(
        "process-stopped",
        ProcessInfo {
            process_id,
            config_name: String::new(),
            pid: None,
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
        fs::remove_file(&log_path)
            .map_err(|e| format!("Failed to delete log file: {}", e))?;
    }
    
    Ok(())
}

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
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
            delete_log_file
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
