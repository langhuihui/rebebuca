use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::process::Stdio;
use std::sync::Arc;
use tauri::Emitter;
use tokio::io::{AsyncBufReadExt, BufReader};
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
        format!("{} {}", config.command, cmd_args.join(" "))
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

    // Spawn task for stdout
    let stdout_handle = tokio::spawn(async move {
        let reader = BufReader::new(stdout);
        let mut lines = reader.lines();

        while let Ok(Some(line)) = lines.next_line().await {
            let _ = app_handle_clone.emit(
                "process-output",
                OutputEvent {
                    process_id: process_id_clone.clone(),
                    output_type: OutputType::Stdout,
                    content: format!("{}\n", line),
                },
            );
        }
    });

    let process_id_clone = process_id.clone();
    let app_handle_clone = app_handle.clone();

    // Spawn task for stderr
    let stderr_handle = tokio::spawn(async move {
        let reader = BufReader::new(stderr);
        let mut lines = reader.lines();

        while let Ok(Some(line)) = lines.next_line().await {
            let _ = app_handle_clone.emit(
                "process-output",
                OutputEvent {
                    process_id: process_id_clone.clone(),
                    output_type: OutputType::Stderr,
                    content: format!("{}\n", line),
                },
            );
        }
    });

    // Store the child process
    process_manager.add_process(process_id.clone(), child).await;

    // Spawn task to wait for process completion
    let process_id_clone = process_id.clone();
    let app_handle_clone = app_handle.clone();
    let processes_arc = process_manager.get_processes_arc();

    tokio::spawn(async move {
        // Wait for stdout and stderr to finish
        let _ = tokio::join!(stdout_handle, stderr_handle);

        // Wait for the process to exit
        let status = {
            let mut processes = processes_arc.lock().await;
            if let Some(mut child) = processes.remove(&process_id_clone) {
                drop(processes); // Release the lock before awaiting
                child.wait().await
            } else {
                return;
            }
        };

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

    Ok(process_id)
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
        .invoke_handler(tauri::generate_handler![greet, execute_command, kill_process])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
