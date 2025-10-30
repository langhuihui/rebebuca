use crate::models::*;
use anyhow::{Context, Result};
use std::collections::HashMap;
use std::path::PathBuf;
use std::process::Stdio;
use std::sync::Arc;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::process::{Child, Command as TokioCommand};
use tokio::sync::Mutex;
use uuid::Uuid;
use log::{debug, error, info, warn};

pub type ProcessId = String;

#[derive(Debug)]
pub struct ProcessManager {
    processes: Arc<Mutex<HashMap<ProcessId, Child>>>,
}

impl ProcessManager {
    pub fn new() -> Self {
        Self {
            processes: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub fn get_processes_arc(&self) -> Arc<Mutex<HashMap<ProcessId, Child>>> {
        Arc::clone(&self.processes)
    }

    pub async fn add_process(&self, id: ProcessId, child: Child) {
        let mut processes = self.processes.lock().await;
        processes.insert(id, child);
    }

    pub async fn remove_process(&self, id: &ProcessId) {
        let mut processes = self.processes.lock().await;
        processes.remove(id);
    }

    pub async fn kill_process(&self, id: &ProcessId) -> Result<()> {
        let mut processes = self.processes.lock().await;
        debug!("Kill process called with id: {}", id);
        debug!("Available process keys: {:?}", processes.keys().collect::<Vec<_>>());
        
        if let Some(child) = processes.get_mut(id) {
            child
                .kill()
                .await
                .context("Failed to kill process")?;
            processes.remove(id);
            info!("Successfully killed and removed process: {}", id);
            Ok(())
        } else {
            warn!("Process not found with key: {}", id);
            Err(anyhow::anyhow!("Process not found"))
        }
    }

    pub async fn get_process_stats(&self, system_pid: &str) -> Result<ProcessStats> {
        debug!("get_process_stats called for system_pid: {}", system_pid);
        let processes = self.processes.lock().await;
        
        debug!("Current processes in manager: {:?}", processes.keys().collect::<Vec<_>>());
        debug!("Looking for process with key: {}", system_pid);
        debug!("Process manager state: {} processes total", processes.len());
        
        // Check if process still exists in our manager
        if let Some(child) = processes.get(system_pid) {
            if let Some(pid) = child.id() {
                // Get process stats using sysinfo
                let mut sys = sysinfo::System::new_all();
                sys.refresh_processes();
                
                if let Some(process) = sys.process(sysinfo::Pid::from_u32(pid)) {
                    let cpu_usage = process.cpu_usage() as f64;
                    let memory_usage = process.memory();
                    let memory_usage_mb = format!("{:.1}MB", memory_usage as f64 / 1024.0 / 1024.0);
                    
                    return Ok(ProcessStats {
                        process_id: system_pid.to_string(),
                        cpu_usage,
                        memory_usage,
                        memory_usage_mb,
                    });
                } else {
                    // Process exists in our manager but not in system - it has finished
                    // Remove it from our manager to avoid future calls
                    drop(processes);
                    self.remove_process(&system_pid.to_string()).await;
                    return Err(anyhow::anyhow!("Process has finished"));
                }
            } else {
                return Err(anyhow::anyhow!("Process has no PID"));
            }
        }
        
        // Process not found in our manager - it has been removed (likely finished)
        Err(anyhow::anyhow!("Process not found - it has finished"))
    }
}

pub struct ProcessExecutor {
    process_manager: Arc<ProcessManager>,
    logs_dir: PathBuf,
}

impl ProcessExecutor {
    pub fn new(process_manager: Arc<ProcessManager>, logs_dir: PathBuf) -> Self {
        Self {
            process_manager,
            logs_dir,
        }
    }

    pub async fn execute_command(&self, config: &RunConfig) -> Result<ProcessExecutionResult> {
        let internal_uuid = Uuid::new_v4().to_string();

        // Create log file
        let timestamp = chrono::Local::now().format("%Y%m%d_%H%M%S");
        let log_filename = format!("{}_{}.log", timestamp, &internal_uuid[0..8]);
        let log_path = self.logs_dir.join(&log_filename);

        // Parse the command - use the command as program name directly
        let program = config.command.trim();
        if program.is_empty() {
            return Err(anyhow::anyhow!("Empty command"));
        }

        // Use arguments directly from config.arguments, but handle quotes properly
        let mut cmd_args: Vec<String> = config.arguments.clone().unwrap_or_default();

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
        if let Some(working_dir) = &config.working_directory {
            if !working_dir.is_empty() {
                cmd.current_dir(working_dir);
            }
        }

        // Set environment variables if provided
        if let Some(env_vars) = &config.environment {
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

        // Spawn the process
        let mut child = cmd
            .spawn()
            .context("Failed to spawn process")?;

        // Get the PID
        let pid = child.id();

        info!("Process started - Internal UUID: {}, System PID: {:?}", internal_uuid, pid);

        // Take stdout and stderr
        let stdout = child.stdout.take().ok_or_else(|| {
            anyhow::anyhow!("Failed to capture stdout")
        })?;
        let stderr = child.stderr.take().ok_or_else(|| {
            anyhow::anyhow!("Failed to capture stderr")
        })?;

        // Store the child process using consistent key
        let process_key = pid.map(|p| p.to_string()).unwrap_or_else(|| internal_uuid.clone());
        debug!("Storing process with key: {} (pid: {:?}, internal_uuid: {})", process_key, pid, internal_uuid);
        self.process_manager.add_process(process_key.clone(), child).await;
        
        // Verify the process was stored
        {
            let processes = self.process_manager.get_processes_arc();
            let processes_guard = processes.lock().await;
            debug!("Process stored successfully. Available processes: {:?}", processes_guard.keys().collect::<Vec<_>>());
        }

        // Spawn tasks for stdout and stderr handling
        let stdout_handle = self.spawn_stdout_handler(internal_uuid.clone(), stdout, log_path.clone()).await;
        let stderr_handle = self.spawn_stderr_handler(internal_uuid.clone(), stderr, log_path.clone()).await;

        // Spawn completion monitoring task
        let process_manager = Arc::clone(&self.process_manager);
        let process_key_clone = process_key.clone();
        let internal_uuid_clone = internal_uuid.clone();
        tokio::spawn(async move {
            // Wait for stdout/stderr tasks to complete first
            if let Ok(_) = tokio::try_join!(stdout_handle, stderr_handle) {
                debug!("Both stdout and stderr tasks completed successfully");
            } else {
                warn!("One or both output tasks failed to complete");
            }
            
            // Now wait for the process to exit
            let status = {
                let mut processes = process_manager.processes.lock().await;
                debug!("Process completion task - looking for process_key: {}", process_key_clone);
                debug!("Available processes before waiting: {:?}", processes.keys().collect::<Vec<_>>());
                if let Some(mut child) = processes.remove(&process_key_clone) {
                    debug!("Found process {} in manager, waiting for completion", process_key_clone);
                    drop(processes); // Release the lock before awaiting
                    child.wait().await
                } else {
                    warn!("Process {} not found in manager during completion", process_key_clone);
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

                    info!("Process exited with code: {:?}", exit_status.code());
                }
                Err(e) => {
                    error!("Process error: {}", e);
                }
            }
        });

        Ok(ProcessExecutionResult {
            internal_uuid,
            system_pid: pid,
            log_filename,
        })
    }

    async fn spawn_stdout_handler(
        &self,
        internal_uuid: String,
        stdout: tokio::process::ChildStdout,
        log_path: PathBuf,
    ) -> tokio::task::JoinHandle<()> {
        tokio::spawn(async move {
            let mut reader = BufReader::new(stdout);
            let mut log_file = tokio::fs::OpenOptions::new()
                .create(true)
                .append(true)
                .open(&log_path)
                .await
                .ok();

            let mut buffer = Vec::new();
            let mut total_output = String::new();
            
            loop {
                buffer.clear();
                match reader.read_until(b'\n', &mut buffer).await {
                    Ok(0) => {
                        debug!("stdout EOF reached for PID: {}", internal_uuid);
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

                        // Emit output immediately (this would be handled by the UI layer)
                        debug!("Sending stdout output - PID: {}, Content: {:?}", 
                               internal_uuid, content.chars().take(100).collect::<String>());
                    }
                    Err(e) => {
                        error!("stdout read error for PID {}: {}", internal_uuid, e);
                        break;
                    }
                }
            }
            
            // If we captured any output, ensure it's all sent
            if !total_output.is_empty() {
                debug!("Total stdout captured: {} bytes", total_output.len());
            }
        })
    }

    async fn spawn_stderr_handler(
        &self,
        internal_uuid: String,
        stderr: tokio::process::ChildStderr,
        log_path: PathBuf,
    ) -> tokio::task::JoinHandle<()> {
        tokio::spawn(async move {
            let mut reader = BufReader::new(stderr);
            let mut log_file = tokio::fs::OpenOptions::new()
                .create(true)
                .append(true)
                .open(&log_path)
                .await
                .ok();

            let mut buffer = Vec::new();
            let mut total_error = String::new();
            
            loop {
                buffer.clear();
                match reader.read_until(b'\n', &mut buffer).await {
                    Ok(0) => {
                        debug!("stderr EOF reached for PID: {}", internal_uuid);
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

                        debug!("Sending stderr output - PID: {}, Content: {:?}", 
                               internal_uuid, content.chars().take(100).collect::<String>());
                    }
                    Err(e) => {
                        error!("stderr read error for PID {}: {}", internal_uuid, e);
                        break;
                    }
                }
            }
            
            // If we captured any error output, log it
            if !total_error.is_empty() {
                debug!("Total stderr captured: {} bytes, Content: {:?}", 
                     total_error.len(), total_error.chars().take(200).collect::<String>());
            }
        })
    }
}

#[derive(Debug, Clone)]
pub struct ProcessExecutionResult {
    pub internal_uuid: String,
    pub system_pid: Option<u32>,
    pub log_filename: String,
}
