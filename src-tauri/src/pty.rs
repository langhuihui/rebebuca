use crate::shell_env::get_shell_env;
use portable_pty::{native_pty_system, CommandBuilder, PtyPair, PtySize};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs::{File, OpenOptions};
use std::io::{Read, Write, BufWriter};
use std::path::PathBuf;
use std::sync::Arc;
use std::thread;
use tauri::{AppHandle, Emitter, Manager};
use tokio::sync::Mutex;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;
#[cfg(target_os = "windows")]
use std::process::Command;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PtyOptions {
    pub rows: u16,
    pub cols: u16,
    pub cwd: Option<String>,
    pub env: Option<HashMap<String, String>>,
    pub shell: Option<String>,
}

impl Default for PtyOptions {
    fn default() -> Self {
        Self {
            rows: 24,
            cols: 80,
            cwd: None,
            env: None,
            shell: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PtyOutputEvent {
    pub pty_id: String,
    pub data: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PtyExitEvent {
    pub pty_id: String,
    pub exit_code: Option<i32>,
}

/// Options for executing a task in PTY
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskExecuteOptions {
    pub rows: Option<u16>,
    pub cols: Option<u16>,
    pub cwd: Option<String>,
    pub env: Option<HashMap<String, String>>,
    pub log_path: Option<String>,
}

impl Default for TaskExecuteOptions {
    fn default() -> Self {
        Self {
            rows: Some(24),
            cols: Some(80),
            cwd: None,
            env: None,
            log_path: None,
        }
    }
}

/// Strip ANSI escape codes from a string for clean log output
fn strip_ansi_codes(s: &str) -> String {
    // Simple regex-free ANSI stripping for performance
    let mut result = String::with_capacity(s.len());
    let mut chars = s.chars().peekable();
    
    while let Some(c) = chars.next() {
        if c == '\x1b' {
            // Skip escape sequence
            if chars.peek() == Some(&'[') {
                chars.next(); // consume '['
                // Skip until we find a letter (end of CSI sequence)
                while let Some(&nc) = chars.peek() {
                    chars.next();
                    if nc.is_ascii_alphabetic() || nc == '~' {
                        break;
                    }
                }
            } else if chars.peek() == Some(&']') {
                // OSC sequence - skip until ST (bell or ESC \)
                chars.next(); // consume ']'
                while let Some(&nc) = chars.peek() {
                    chars.next();
                    if nc == '\x07' {
                        break;
                    }
                    if nc == '\x1b' {
                        if chars.peek() == Some(&'\\') {
                            chars.next();
                            break;
                        }
                    }
                }
            }
        } else {
            result.push(c);
        }
    }
    
    result
}

struct PtyInstance {
    pair: PtyPair,
    writer: Box<dyn Write + Send>,
    #[allow(dead_code)]
    child: Box<dyn portable_pty::Child + Send + Sync>,
}

/// Task instance for task execution
struct TaskInstance {
    child: Arc<Mutex<Box<dyn portable_pty::Child + Send + Sync>>>,
    writer: Arc<Mutex<Box<dyn Write + Send>>>,
    #[allow(dead_code)]
    pty_id: String,
}

pub struct PtyManager {
    instances: Arc<Mutex<HashMap<String, Arc<Mutex<PtyInstance>>>>>,
    task_instances: Arc<Mutex<HashMap<String, TaskInstance>>>,
}

impl PtyManager {
    pub fn new() -> Self {
        Self {
            instances: Arc::new(Mutex::new(HashMap::new())),
            task_instances: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    /// Get the default shell for the current platform
    fn get_default_shell() -> String {
        #[cfg(target_os = "windows")]
        {
            std::env::var("COMSPEC").unwrap_or_else(|_| "cmd.exe".to_string())
        }

        #[cfg(not(target_os = "windows"))]
        {
            std::env::var("SHELL").unwrap_or_else(|_| "/bin/bash".to_string())
        }
    }

    /// Create a new PTY instance
    pub async fn create_pty(
        &self,
        pty_id: String,
        options: PtyOptions,
        app_handle: AppHandle,
    ) -> Result<String, String> {
        let pty_system = native_pty_system();

        let size = PtySize {
            rows: options.rows,
            cols: options.cols,
            pixel_width: 0,
            pixel_height: 0,
        };

        // Retry openpty up to 3 times with delay
        let mut pair = None;
        let mut last_error = None;
        for attempt in 0..3 {
            match pty_system.openpty(size) {
                Ok(p) => {
                    pair = Some(p);
                    break;
                }
                Err(e) => {
                    last_error = Some(e);
                    if attempt < 2 {
                        println!("[PTY] openpty attempt {} failed, retrying in 100ms...", attempt + 1);
                        tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
                    }
                }
            }
        }
        
        let pair = pair.ok_or_else(|| {
            format!("Failed to open PTY after retries: {:?}", last_error)
        }).map_err(|e| format!("Failed to open PTY: {}", e))?;

        let shell = options.shell.unwrap_or_else(Self::get_default_shell);

        let mut cmd = CommandBuilder::new(&shell);
        // Add -l flag for login shell to load user's shell profile
        #[cfg(not(target_os = "windows"))]
        cmd.arg("-l");

        // Set working directory
        if let Some(cwd) = options.cwd {
            cmd.cwd(cwd);
        }

        // Load shell environment variables first (crucial for macOS GUI apps)
        let shell_env = get_shell_env();
        for (key, value) in &shell_env {
            cmd.env(key, value);
        }

        // Set user-provided environment variables (override shell env if needed)
        if let Some(env) = options.env {
            for (key, value) in env {
                cmd.env(key, value);
            }
        }

        // Set TERM environment variable for proper terminal emulation
        cmd.env("TERM", "xterm-256color");
        
        // Set TERM_PROGRAM to identify Rebebuca for shell integration
        cmd.env("TERM_PROGRAM", "rebebuca");

        // Spawn the shell process
        let child = pair
            .slave
            .spawn_command(cmd)
            .map_err(|e| format!("Failed to spawn shell: {}", e))?;

        // Get reader and writer
        let mut reader = pair
            .master
            .try_clone_reader()
            .map_err(|e| format!("Failed to clone reader: {}", e))?;

        let writer = pair
            .master
            .take_writer()
            .map_err(|e| format!("Failed to take writer: {}", e))?;

        let instance = PtyInstance {
            pair,
            writer,
            child,
        };

        let pty_id_clone = pty_id.clone();
        let instances_arc = Arc::clone(&self.instances);

        // Store the instance
        {
            let mut instances = self.instances.lock().await;
            instances.insert(pty_id.clone(), Arc::new(Mutex::new(instance)));
        }

        // Spawn a thread to read PTY output
        let app_handle_clone = app_handle.clone();
        let pty_id_for_thread = pty_id.clone();

        thread::spawn(move || {
            let mut buffer = [0u8; 4096];

            loop {
                match reader.read(&mut buffer) {
                    Ok(0) => {
                        // EOF - PTY closed
                        println!("[PTY] EOF reached for PTY: {}", pty_id_for_thread);
                        break;
                    }
                    Ok(n) => {
                        // Convert to string, handling potential encoding issues
                        let data = String::from_utf8_lossy(&buffer[..n]).to_string();

                        // Emit output event
                        let _ = app_handle_clone.emit(
                            "pty-output",
                            PtyOutputEvent {
                                pty_id: pty_id_for_thread.clone(),
                                data,
                            },
                        );
                    }
                    Err(e) => {
                        println!("[PTY] Read error for PTY {}: {}", pty_id_for_thread, e);
                        break;
                    }
                }
            }

            // Emit exit event
            let _ = app_handle_clone.emit(
                "pty-exit",
                PtyExitEvent {
                    pty_id: pty_id_for_thread.clone(),
                    exit_code: None,
                },
            );

            // Clean up instance
            let instances_arc_clone = instances_arc.clone();
            let pty_id_cleanup = pty_id_for_thread.clone();
            tokio::spawn(async move {
                let mut instances = instances_arc_clone.lock().await;
                instances.remove(&pty_id_cleanup);
                println!("[PTY] Cleaned up PTY: {}", pty_id_cleanup);
            });
        });

        println!("[PTY] Created PTY: {} with shell: {}", pty_id_clone, shell);
        Ok(pty_id_clone)
    }

    /// Write data to a PTY (shell or task)
    pub async fn write_to_pty(&self, pty_id: &str, data: &str) -> Result<(), String> {
        // First try shell PTY instances
        {
            let instances = self.instances.lock().await;
            if let Some(instance_arc) = instances.get(pty_id) {
                let mut instance = instance_arc.lock().await;
                instance
                    .writer
                    .write_all(data.as_bytes())
                    .map_err(|e| format!("Failed to write to PTY: {}", e))?;
                instance
                    .writer
                    .flush()
                    .map_err(|e| format!("Failed to flush PTY: {}", e))?;
                return Ok(());
            }
        }
        
        // Then try task PTY instances
        {
            let task_instances = self.task_instances.lock().await;
            if let Some(task_instance) = task_instances.get(pty_id) {
                let mut writer = task_instance.writer.lock().await;
                writer
                    .write_all(data.as_bytes())
                    .map_err(|e| format!("Failed to write to task PTY: {}", e))?;
                writer
                    .flush()
                    .map_err(|e| format!("Failed to flush task PTY: {}", e))?;
                return Ok(());
            }
        }
        
        Err(format!("PTY not found: {}", pty_id))
    }

    /// Resize a PTY
    pub async fn resize_pty(&self, pty_id: &str, rows: u16, cols: u16) -> Result<(), String> {
        let instances = self.instances.lock().await;

        if let Some(instance_arc) = instances.get(pty_id) {
            let instance = instance_arc.lock().await;
            instance
                .pair
                .master
                .resize(PtySize {
                    rows,
                    cols,
                    pixel_width: 0,
                    pixel_height: 0,
                })
                .map_err(|e| format!("Failed to resize PTY: {}", e))?;
            println!("[PTY] Resized PTY {} to {}x{}", pty_id, cols, rows);
            Ok(())
        } else {
            Err(format!("PTY not found: {}", pty_id))
        }
    }

    /// Close a PTY
    pub async fn close_pty(&self, pty_id: &str) -> Result<(), String> {
        let mut instances = self.instances.lock().await;
        
        if instances.remove(pty_id).is_some() {
            println!("[PTY] Closed PTY: {}", pty_id);
            Ok(())
        } else {
            Err(format!("PTY not found: {}", pty_id))
        }
    }

    /// Check if a PTY exists
    #[allow(dead_code)]
    pub async fn has_pty(&self, pty_id: &str) -> bool {
        let instances = self.instances.lock().await;
        instances.contains_key(pty_id)
    }

    /// Execute a command in a new PTY (for task execution)
    /// Unlike create_pty which spawns a shell, this executes a specific command
    /// Note: Task PTYs don't support write_to_pty since they run a specific command
    pub async fn execute_task(
        &self,
        pty_id: String,
        command: String,
        args: Vec<String>,
        options: TaskExecuteOptions,
        app_handle: AppHandle,
    ) -> Result<String, String> {
        let pty_system = native_pty_system();

        let size = PtySize {
            rows: options.rows.unwrap_or(24),
            cols: options.cols.unwrap_or(80),
            pixel_width: 0,
            pixel_height: 0,
        };

        // Retry openpty up to 3 times with delay
        let mut pair = None;
        let mut last_error = None;
        for attempt in 0..3 {
            match pty_system.openpty(size) {
                Ok(p) => {
                    pair = Some(p);
                    break;
                }
                Err(e) => {
                    last_error = Some(e);
                    if attempt < 2 {
                        println!("[PTY] execute_task openpty attempt {} failed, retrying in 100ms...", attempt + 1);
                        tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
                    }
                }
            }
        }
        
        let pair = pair.ok_or_else(|| {
            format!("Failed to open PTY after retries: {:?}", last_error)
        }).map_err(|e| format!("Failed to open PTY: {}", e))?;

        // Build command with arguments
        // On Windows, we need to use cmd.exe /c to run batch scripts like npm.cmd
        #[cfg(target_os = "windows")]
        let mut cmd = {
            let mut c = CommandBuilder::new("cmd.exe");
            c.arg("/c");
            c.arg(&command);
            for arg in &args {
                c.arg(arg);
            }
            c
        };
        
        #[cfg(not(target_os = "windows"))]
        let mut cmd = {
            // Use shell to execute the command to ensure proper TTY handling
            // This is important for sudo password prompts on macOS
            let shell = Self::get_default_shell();
            let mut c = CommandBuilder::new(&shell);
            c.arg("-c");
            
            // Build the full command string with proper escaping
            let full_command = if args.is_empty() {
                command.clone()
            } else {
                // Escape arguments and join them
                let escaped_args: Vec<String> = args.iter().map(|arg| {
                    // If arg contains spaces or special chars, quote it
                    if arg.contains(' ') || arg.contains('"') || arg.contains('\'') || arg.contains('$') {
                        format!("'{}'", arg.replace("'", "'\\''"))
                    } else {
                        arg.clone()
                    }
                }).collect();
                format!("{} {}", command, escaped_args.join(" "))
            };
            c.arg(&full_command);
            c
        };

        // Set working directory
        if let Some(cwd) = &options.cwd {
            cmd.cwd(cwd);
        }

        // Load shell environment variables first (crucial for macOS GUI apps)
        let shell_env = get_shell_env();
        for (key, value) in &shell_env {
            cmd.env(key, value);
        }

        // Set user-provided environment variables (override shell env if needed)
        if let Some(env) = &options.env {
            for (key, value) in env {
                cmd.env(key, value);
            }
        }

        // Set TERM environment variable for proper terminal emulation
        cmd.env("TERM", "xterm-256color");

        // Spawn the command process
        let child = pair
            .slave
            .spawn_command(cmd)
            .map_err(|e| format!("Failed to spawn command: {}", e))?;

        // Get reader
        let mut reader = pair
            .master
            .try_clone_reader()
            .map_err(|e| format!("Failed to clone reader: {}", e))?;

        // Get writer for keyboard input
        let writer = pair
            .master
            .take_writer()
            .map_err(|e| format!("Failed to take writer: {}", e))?;

        // Store the child process and writer for later use
        let child_arc = Arc::new(Mutex::new(child));
        let writer_arc = Arc::new(Mutex::new(writer));
        
        let task_instance = TaskInstance {
            child: child_arc,
            writer: writer_arc,
            pty_id: pty_id.clone(),
        };
        
        {
            let mut task_instances = self.task_instances.lock().await;
            task_instances.insert(pty_id.clone(), task_instance);
        }
        
        let pty_id_clone = pty_id.clone();
        let task_instances_arc = Arc::clone(&self.task_instances);

        // Get Tokio runtime handle for use in the thread
        let runtime_handle = tokio::runtime::Handle::current();

        // Spawn a thread to read PTY output and wait for process exit
        let app_handle_clone = app_handle.clone();
        let pty_id_for_thread = pty_id.clone();
        let command_display = if args.is_empty() {
            command.clone()
        } else {
            format!("{} {}", command, args.join(" "))
        };
        
        // Create log file if path is provided
        let log_path = options.log_path.clone();

        thread::spawn(move || {
            // Keep pair alive in thread scope
            let _pair = pair;
            let mut buffer = [0u8; 4096];
            
            // Open log file for writing if path is provided
            let mut log_writer: Option<BufWriter<File>> = log_path.as_ref().and_then(|path| {
                OpenOptions::new()
                    .create(true)
                    .append(true)
                    .open(PathBuf::from(path))
                    .ok()
                    .map(|f| BufWriter::new(f))
            });
            
            if log_writer.is_some() {
                println!("[PTY] Log file opened for task PTY: {}", pty_id_for_thread);
            }

            // Read output in a loop
            loop {
                match reader.read(&mut buffer) {
                    Ok(0) => {
                        // EOF - process finished
                        println!("[PTY] EOF reached for task PTY: {}", pty_id_for_thread);
                        break;
                    }
                    Ok(n) => {
                        // Convert to string, handling potential encoding issues
                        let data = String::from_utf8_lossy(&buffer[..n]).to_string();
                        
                        // Write to log file if available
                        if let Some(ref mut writer) = log_writer {
                            // Strip ANSI escape codes for log file
                            let clean_data = strip_ansi_codes(&data);
                            let _ = writer.write_all(clean_data.as_bytes());
                            let _ = writer.flush();
                        }

                        // Emit output event
                        let _ = app_handle_clone.emit(
                            "pty-output",
                            PtyOutputEvent {
                                pty_id: pty_id_for_thread.clone(),
                                data,
                            },
                        );
                    }
                    Err(e) => {
                        println!("[PTY] Read error for task PTY {}: {}", pty_id_for_thread, e);
                        break;
                    }
                }
            }
            
            // Flush and close log file
            if let Some(ref mut writer) = log_writer {
                let _ = writer.flush();
                println!("[PTY] Log file closed for task PTY: {}", pty_id_for_thread);
            }

            // Wait for child process and get exit code
            // Note: We can't easily get the exit code from the shared child in the thread
            // The process should have already exited when we reach EOF
            let exit_code: Option<i32> = None;

            // Emit exit event with exit code
            let _ = app_handle_clone.emit(
                "pty-exit",
                PtyExitEvent {
                    pty_id: pty_id_for_thread.clone(),
                    exit_code,
                },
            );

            // Clean up task instance
            let pty_id_cleanup = pty_id_for_thread.clone();
            runtime_handle.spawn(async move {
                let mut task_instances = task_instances_arc.lock().await;
                task_instances.remove(&pty_id_cleanup);
                println!("[PTY] Cleaned up task PTY: {}", pty_id_cleanup);
            });
        });

        println!("[PTY] Created task PTY: {} for command: {}", pty_id_clone, command_display);
        Ok(pty_id_clone)
    }
    
    /// Kill a task process
    pub async fn kill_task(&self, pty_id: &str) -> Result<(), String> {
        // First, kill the task process
        let mut task_instances = self.task_instances.lock().await;
        
        if let Some(task_instance) = task_instances.remove(pty_id) {
            let child = task_instance.child.lock().await;
            
            // On Windows, use taskkill with /T flag to kill the entire process tree
            // This is necessary because cmd.exe /c spawns child processes that won't be killed
            // by just killing the cmd.exe process
            #[cfg(target_os = "windows")]
            {
                if let Some(pid) = child.process_id() {
                    println!("[PTY] Killing process tree for PID: {} (PTY: {})", pid, pty_id);
                    let output = Command::new("taskkill")
                        .args(["/F", "/T", "/PID", &pid.to_string()])
                        .creation_flags(0x08000000) // CREATE_NO_WINDOW
                        .output();
                    
                    match output {
                        Ok(result) => {
                            if result.status.success() {
                                println!("[PTY] Successfully killed process tree for PID: {}", pid);
                            } else {
                                let stderr = String::from_utf8_lossy(&result.stderr);
                                println!("[PTY] taskkill warning for PID {}: {}", pid, stderr);
                                // Don't return error - process might have already exited
                            }
                        }
                        Err(e) => {
                            println!("[PTY] Failed to run taskkill for PID {}: {}", pid, e);
                            // Fallback to normal kill
                            drop(child);
                            let mut child = task_instance.child.lock().await;
                            let _ = child.kill();
                        }
                    }
                } else {
                    // No PID available, try normal kill
                    drop(child);
                    let mut child = task_instance.child.lock().await;
                    child.kill().map_err(|e| format!("Failed to kill task: {}", e))?;
                }
            }
            
            // On non-Windows platforms, use the standard kill method
            #[cfg(not(target_os = "windows"))]
            {
                drop(child);
                let mut child = task_instance.child.lock().await;
                child.kill().map_err(|e| format!("Failed to kill task: {}", e))?;
            }
            
            println!("[PTY] Killed task PTY: {}", pty_id);
            Ok(())
        } else {
            // Also check regular PTY instances and close them
            drop(task_instances);
            // Note: We don't close shell PTY here since it might be reused
            // The close_pty will be called separately if needed
            Err(format!("Task PTY not found: {}", pty_id))
        }
    }
    
    /// Force kill a task process using SIGKILL (Unix) or forceful termination (Windows)
    pub async fn force_kill_task(&self, pty_id: &str) -> Result<(), String> {
        let mut task_instances = self.task_instances.lock().await;
        
        if let Some(task_instance) = task_instances.remove(pty_id) {
            let child = task_instance.child.lock().await;
            
            #[cfg(target_os = "windows")]
            {
                if let Some(pid) = child.process_id() {
                    println!("[PTY] Force killing process tree for PID: {} (PTY: {})", pid, pty_id);
                    let output = Command::new("taskkill")
                        .args(["/F", "/T", "/PID", &pid.to_string()])
                        .creation_flags(0x08000000) // CREATE_NO_WINDOW
                        .output();
                    
                    match output {
                        Ok(result) => {
                            if result.status.success() {
                                println!("[PTY] Successfully force killed process tree for PID: {}", pid);
                            } else {
                                let stderr = String::from_utf8_lossy(&result.stderr);
                                println!("[PTY] taskkill warning for PID {}: {}", pid, stderr);
                            }
                        }
                        Err(e) => {
                            println!("[PTY] Failed to run taskkill for PID {}: {}", pid, e);
                        }
                    }
                }
            }
            
            #[cfg(not(target_os = "windows"))]
            {
                if let Some(pid) = child.process_id() {
                    println!("[PTY] Force killing process with SIGKILL for PID: {} (PTY: {})", pid, pty_id);
                    // Use kill -9 (SIGKILL) to force kill the process and its children
                    let _ = std::process::Command::new("kill")
                        .args(["-9", &pid.to_string()])
                        .output();
                    
                    // Also try to kill the process group
                    let _ = std::process::Command::new("kill")
                        .args(["-9", &format!("-{}", pid)])
                        .output();
                    
                    println!("[PTY] Force killed process with SIGKILL for PID: {}", pid);
                } else {
                    // Fallback to normal kill
                    drop(child);
                    let mut child = task_instance.child.lock().await;
                    let _ = child.kill();
                }
            }
            
            println!("[PTY] Force killed task PTY: {}", pty_id);
            Ok(())
        } else {
            drop(task_instances);
            Err(format!("Task PTY not found: {}", pty_id))
        }
    }
    
    /// Check if a task process is still running
    pub async fn is_task_running(&self, pty_id: &str) -> Result<bool, String> {
        let task_instances = self.task_instances.lock().await;
        
        if let Some(task_instance) = task_instances.get(pty_id) {
            let child = task_instance.child.lock().await;
            
            if let Some(pid) = child.process_id() {
                // Check if process is still running using sysinfo
                let mut sys = sysinfo::System::new();
                sys.refresh_processes();
                
                let is_running = sys.process(sysinfo::Pid::from_u32(pid)).is_some();
                Ok(is_running)
            } else {
                Ok(false)
            }
        } else {
            Ok(false)
        }
    }
}

// Tauri commands

#[tauri::command]
pub async fn create_pty(
    pty_id: String,
    options: Option<PtyOptions>,
    pty_manager: tauri::State<'_, PtyManager>,
    app_handle: AppHandle,
) -> Result<String, String> {
    let opts = options.unwrap_or_default();
    pty_manager.create_pty(pty_id, opts, app_handle).await
}

#[tauri::command]
pub async fn write_pty(
    pty_id: String,
    data: String,
    pty_manager: tauri::State<'_, PtyManager>,
) -> Result<(), String> {
    pty_manager.write_to_pty(&pty_id, &data).await
}

#[tauri::command]
pub async fn resize_pty(
    pty_id: String,
    rows: u16,
    cols: u16,
    pty_manager: tauri::State<'_, PtyManager>,
) -> Result<(), String> {
    pty_manager.resize_pty(&pty_id, rows, cols).await
}

#[tauri::command]
pub async fn close_pty(
    pty_id: String,
    pty_manager: tauri::State<'_, PtyManager>,
) -> Result<(), String> {
    pty_manager.close_pty(&pty_id).await
}

/// Execute a task command in a PTY
/// Unlike create_pty which spawns a shell, this executes a specific command
#[tauri::command]
pub async fn execute_task(
    pty_id: String,
    command: String,
    args: Vec<String>,
    options: Option<TaskExecuteOptions>,
    pty_manager: tauri::State<'_, PtyManager>,
    app_handle: AppHandle,
) -> Result<String, String> {
    let opts = options.unwrap_or_default();
    pty_manager.execute_task(pty_id, command, args, opts, app_handle).await
}

/// Kill a task process
#[tauri::command]
pub async fn kill_task(
    pty_id: String,
    pty_manager: tauri::State<'_, PtyManager>,
    app_handle: AppHandle,
) -> Result<(), String> {
    let result = pty_manager.kill_task(&pty_id).await;
    
    // Always emit pty-exit event when kill_task is called
    // This ensures the frontend is notified even if the reading thread
    // doesn't detect the process exit (especially on Windows with taskkill)
    if result.is_ok() {
        let _ = app_handle.emit(
            "pty-exit",
            PtyExitEvent {
                pty_id: pty_id.clone(),
                exit_code: Some(-1), // -1 indicates killed by user
            },
        );
        println!("[PTY] Emitted pty-exit event for killed task: {}", pty_id);
    }
    
    result
}

/// Force kill a task process (SIGKILL on Unix, forceful termination on Windows)
#[tauri::command]
pub async fn force_kill_task(
    pty_id: String,
    pty_manager: tauri::State<'_, PtyManager>,
    app_handle: AppHandle,
) -> Result<(), String> {
    let result = pty_manager.force_kill_task(&pty_id).await;
    
    // Always emit pty-exit event when force_kill_task is called
    if result.is_ok() {
        let _ = app_handle.emit(
            "pty-exit",
            PtyExitEvent {
                pty_id: pty_id.clone(),
                exit_code: Some(-9), // -9 indicates force killed (SIGKILL)
            },
        );
        println!("[PTY] Emitted pty-exit event for force killed task: {}", pty_id);
    }
    
    result
}

/// Check if a task process is still running
#[tauri::command]
pub async fn is_task_running(
    pty_id: String,
    pty_manager: tauri::State<'_, PtyManager>,
) -> Result<bool, String> {
    pty_manager.is_task_running(&pty_id).await
}

/// Process stats structure
#[derive(serde::Serialize)]
pub struct PtyProcessStats {
    pub pty_id: String,
    pub pid: u32,
    pub cpu_usage: f64,
    pub memory_usage: u64,
    pub memory_usage_mb: String,
}

/// Get process stats for a PTY task
#[tauri::command]
pub async fn get_pty_process_stats(
    pty_id: String,
    pty_manager: tauri::State<'_, PtyManager>,
) -> Result<PtyProcessStats, String> {
    let task_instances = pty_manager.task_instances.lock().await;
    
    if let Some(task) = task_instances.get(&pty_id) {
        let child = task.child.lock().await;
        
        if let Some(pid) = child.process_id() {
            // Get process stats using sysinfo
            let mut sys = sysinfo::System::new_all();
            sys.refresh_processes();
            
            if let Some(process) = sys.process(sysinfo::Pid::from_u32(pid)) {
                let cpu_usage = process.cpu_usage() as f64;
                let memory_usage = process.memory();
                let memory_usage_mb = format!("{:.1}MB", memory_usage as f64 / 1024.0 / 1024.0);
                
                return Ok(PtyProcessStats {
                    pty_id,
                    pid,
                    cpu_usage,
                    memory_usage,
                    memory_usage_mb,
                });
            } else {
                return Err("Process not found in system".to_string());
            }
        } else {
            return Err("Process has no PID".to_string());
        }
    }
    
    Err("PTY task not found".to_string())
}

/// Get the path to shell integration script for a specific shell
#[tauri::command]
pub fn get_shell_integration_path(
    shell: String,
    app_handle: AppHandle,
) -> Result<String, String> {
    let script_name = match shell.as_str() {
        "bash" | "/bin/bash" | "/usr/bin/bash" => "bash.sh",
        "zsh" | "/bin/zsh" | "/usr/bin/zsh" => "zsh.sh",
        _ => return Err(format!("Unsupported shell for integration: {}", shell)),
    };
    
    // Get the resource directory
    let resource_path = app_handle
        .path()
        .resource_dir()
        .map_err(|e| format!("Failed to get resource dir: {}", e))?;
    
    let script_path = resource_path.join("shell-integration").join(script_name);
    
    if script_path.exists() {
        Ok(script_path.to_string_lossy().to_string())
    } else {
        Err(format!("Shell integration script not found: {:?}", script_path))
    }
}
