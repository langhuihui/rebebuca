use crate::types::{
    AgentMessage, OutputType, SshAuthMethod, SshConfig, SshConnectionInfo, 
    SshConnectionStatus, SavedSshConfig
};
use log::{error, info, warn};
use serde::{Deserialize, Serialize};
use ssh2::Session;
use std::collections::HashMap;
use std::io::{BufRead, BufReader, Write};
use std::net::TcpStream;
use std::sync::Arc;
use tauri::{Emitter, Manager};
use tokio::sync::Mutex;
use tokio::time::{timeout, Duration};
use uuid::Uuid;

#[derive(Clone)]
pub struct SshConnection {
    config: SshConfig,
    config_id: String,  // ID for saved configuration
    agent_deployed: bool,
    agent_path: Option<String>,
    status: SshConnectionStatus,
    task_count: u32,
    keep_alive_interval: u64,  // Keep-alive interval in seconds
    keep_connection: bool,  // Whether to keep connection when no tasks
    keep_alive_handle: Option<Arc<tokio::task::JoinHandle<()>>>,
    session: Option<Arc<Mutex<ssh2::Session>>>,
}

// Store active SSH connections (keyed by config ID)
lazy_static::lazy_static! {
    static ref SSH_CONNECTIONS: Arc<Mutex<HashMap<String, Arc<Mutex<SshConnection>>>>> = 
        Arc::new(Mutex::new(HashMap::new()));
    
    // Store saved SSH configurations (keyed by config ID)
    static ref SSH_CONFIGS: Arc<Mutex<HashMap<String, SavedSshConfig>>> = 
        Arc::new(Mutex::new(HashMap::new()));
}

impl SshConnection {
    pub fn new(config: SshConfig, config_id: String) -> Self {
        let keep_alive_interval = config.keep_alive_interval.unwrap_or(60);
        let keep_connection = config.keep_connection.unwrap_or(false);
        
        Self {
            config,
            config_id,
            agent_deployed: false,
            agent_path: None,
            status: SshConnectionStatus::Disconnected,
            task_count: 0,
            keep_alive_interval,
            keep_connection,
            keep_alive_handle: None,
            session: None,
        }
    }
    
    fn get_connection_key(&self) -> String {
        format!("{}@{}:{}", self.config.username, self.config.host, self.config.port)
    }
    
    pub fn get_status(&self) -> SshConnectionStatus {
        self.status.clone()
    }
    
    pub fn get_task_count(&self) -> u32 {
        self.task_count
    }
    
    pub fn increment_task_count(&mut self) {
        self.task_count += 1;
    }
    
    pub fn decrement_task_count(&mut self) {
        if self.task_count > 0 {
            self.task_count -= 1;
        }
    }
    
    pub fn should_keep_connection(&self) -> bool {
        self.keep_connection || self.task_count > 0
    }

    async fn create_session(&mut self) -> Result<Arc<Mutex<ssh2::Session>>, String> {
        // Set timeout for connection (10 seconds)
        let connect_timeout = Duration::from_secs(10);
        
        let host = self.config.host.clone();
        let port = self.config.port;
        
        let tcp = timeout(
            connect_timeout,
            tokio::task::spawn_blocking(move || TcpStream::connect(format!("{}:{}", host, port)))
        ).await
            .map_err(|e| format!("Connection timeout: {}", e))?
            .map_err(|e| format!("Failed to spawn blocking task: {}", e))?
            .map_err(|e| format!("Failed to connect to SSH server: {}", e))?;

        let mut session = Session::new().map_err(|e| format!("Failed to create SSH session: {}", e))?;
        session.set_tcp_stream(tcp);
        session
            .handshake()
            .map_err(|e| format!("SSH handshake failed: {}", e))?;

        // Authenticate
        match &self.config.auth {
            SshAuthMethod::Password { password } => {
                session
                    .userauth_password(&self.config.username, password)
                    .map_err(|e| format!("SSH password authentication failed: {}", e))?;
            }
            SshAuthMethod::PrivateKey { key_path, passphrase } => {
                let passphrase = passphrase.clone();
                let key_path = key_path.clone();
                let username = self.config.username.clone();
                
                // For key auth, we need to do it synchronously as ssh2 doesn't support async well
                session.userauth_pubkey_file(
                    &username, 
                    None, 
                    std::path::Path::new(&key_path), 
                    passphrase.as_deref()
                ).map_err(|e| format!("SSH key authentication failed: {}", e))?;
            }
        }

        if !session.authenticated() {
            return Err("SSH authentication failed".to_string());
        }

        Ok(Arc::new(Mutex::new(session)))
    }
    
    async fn ping_agent(&self, session: Arc<Mutex<ssh2::Session>>, agent_path: &str) -> Result<bool, String> {
        Self::ping_agent_static(session, agent_path).await
    }

    async fn start_keep_alive(&mut self, _app_handle: tauri::AppHandle, session: Arc<Mutex<ssh2::Session>>, agent_path: String) {
        let interval = self.keep_alive_interval;
        let config_id = self.config_id.clone();
        
        // Spawn keep-alive task
        let _handle = tokio::spawn(async move {
            let mut interval_timer = tokio::time::interval(Duration::from_secs(interval));
            
            loop {
                interval_timer.tick().await;
                
                // Check if connection still exists
                let connection_exists = {
                    let connections = SSH_CONNECTIONS.lock().await;
                    connections.contains_key(&config_id)
                };
                
                if !connection_exists {
                    info!("[SSH] Keep-alive stopped: connection removed for {}", config_id);
                    break;
                }
                
                // Ping the agent
                let connections = SSH_CONNECTIONS.lock().await;
                if let Some(conn) = connections.get(&config_id) {
                    let conn_guard = conn.lock().await;
                    
                    // Check if we should still keep alive
                    if !conn_guard.should_keep_connection() {
                        info!("[SSH] Keep-alive stopped: no tasks and keep_connection=false for {}", config_id);
                        drop(conn_guard);
                        drop(connections);
                        break;
                    }
                    
                    drop(conn_guard);
                }
                drop(connections);
                
                // Ping agent
                match Self::ping_agent_static(session.clone(), &agent_path).await {
                    Ok(true) => {
                        info!("[SSH] Keep-alive ping successful for {}", config_id);
                        
                        // Update last ping time
                        let connections = SSH_CONNECTIONS.lock().await;
                        if let Some(_conn) = connections.get(&config_id) {
                            // Note: We can't update timestamp here easily without more refactoring
                            // For now, just log success
                        }
                        drop(connections);
                    }
                    Ok(false) => {
                        warn!("[SSH] Keep-alive ping failed: no pong received for {}", config_id);
                        // Connection might be dead, but don't disconnect yet
                    }
                    Err(e) => {
                        warn!("[SSH] Keep-alive ping error for {}: {}", config_id, e);
                        // Connection error, but continue trying
                    }
                }
            }
        });
        
        // Store the handle wrapped in Arc so we can keep a reference
        self.keep_alive_handle = Some(Arc::new(_handle));
    }
    
    async fn ping_agent_static(session: Arc<Mutex<ssh2::Session>>, agent_path: &str) -> Result<bool, String> {
        let session_clone = session.clone();
        let agent_path = agent_path.to_string();
        
        let result = timeout(Duration::from_secs(5), async move {
            let session_guard = session_clone.lock().await;
            
            let mut channel = match session_guard.channel_session() {
                Ok(ch) => ch,
                Err(e) => return Err(format!("Failed to open channel: {}", e)),
            };
            
            if let Err(e) = channel.exec(&agent_path) {
                return Err(format!("Failed to execute agent: {}", e));
            }
            
            let ping_msg = AgentMessage::Ping;
            let json = match serde_json::to_string(&ping_msg) {
                Ok(j) => j,
                Err(e) => return Err(format!("Failed to serialize ping: {}", e)),
            };
            
            if let Err(e) = channel.write_all(format!("{}\n", json).as_bytes()) {
                return Err(format!("Failed to send ping: {}", e));
            }
            
            if let Err(e) = channel.flush() {
                return Err(format!("Failed to flush: {}", e));
            }
            
            drop(session_guard);
            
            // Read response with timeout
            let reader = BufReader::new(channel);
            let line_future = async {
                let mut reader = reader;
                let mut line = String::new();
                match reader.read_line(&mut line) {
                    Ok(_) => Ok::<String, String>(line),
                    Err(e) => Err(format!("Failed to read response: {}", e)),
                }
            };
            
            let line_result = timeout(Duration::from_secs(2), line_future).await;
            match line_result {
                Ok(Ok(line)) => {
                    if let Ok(msg) = serde_json::from_str::<AgentMessage>(&line.trim()) {
                        Ok(matches!(msg, AgentMessage::Pong))
                    } else {
                        Ok(false)
                    }
                }
                Ok(Err(e)) => Err(e),
                Err(_) => Err("Read timeout".to_string()),
            }
        }).await;
        
        match result {
            Ok(Ok(is_pong)) => Ok(is_pong),
            Ok(Err(e)) => Err(e),
            Err(_) => Err("Ping timeout".to_string()),
        }
    }
    
    #[allow(dead_code)]
    async fn check_agent_version(&self, session: &Arc<Mutex<Session>>, agent_path: &str) -> Result<String, String> {
        let session_guard = session.lock().await;
        let mut channel = session_guard
            .channel_session()
            .map_err(|e| format!("Failed to open channel: {}", e))?;
        
        channel
            .exec(agent_path)
            .map_err(|e| format!("Failed to execute agent: {}", e))?;
        
        // Send get_version command
        let get_version_msg = AgentMessage::GetVersion;
        let json = serde_json::to_string(&get_version_msg)
            .map_err(|e| format!("Failed to serialize message: {}", e))?;
        
        channel
            .write_all(format!("{}\n", json).as_bytes())
            .map_err(|e| format!("Failed to send get_version command: {}", e))?;
        
        channel
            .flush()
            .map_err(|e| format!("Failed to flush channel: {}", e))?;
        
        // Close stdin to signal EOF
        channel
            .send_eof()
            .map_err(|e| format!("Failed to send EOF: {}", e))?;
        
        drop(session_guard);
        
        // Read response with timeout
        let result = timeout(Duration::from_secs(5), async {
            let reader = BufReader::new(channel);
            for line in reader.lines() {
                match line {
                    Ok(line) => {
                        if let Ok(msg) = serde_json::from_str::<AgentMessage>(&line) {
                            if let AgentMessage::Version { version } = msg {
                                return Ok(version);
                            }
                        }
                    }
                    Err(e) => return Err(format!("Error reading response: {}", e)),
                }
            }
            Err("No version response received".to_string())
        }).await;
        
        match result {
            Ok(Ok(version)) => Ok(version),
            Ok(Err(e)) => Err(e),
            Err(_) => Err("Version check timeout".to_string()),
        }
    }
    
    /// Detect remote server architecture by running `uname -m`
    async fn detect_remote_arch(&self, session: &Arc<Mutex<ssh2::Session>>) -> Result<String, String> {
        let session_guard = session.lock().await;
        let mut channel = session_guard
            .channel_session()
            .map_err(|e| format!("Failed to open channel: {}", e))?;
        
        channel
            .exec("uname -m")
            .map_err(|e| format!("Failed to execute uname: {}", e))?;
        
        drop(session_guard);
        
        // Read output
        let mut output = String::new();
        let reader = BufReader::new(&mut channel);
        for line in reader.lines() {
            if let Ok(line) = line {
                output = line.trim().to_string();
                break;
            }
        }
        
        // Wait for channel to close
        let _ = channel.wait_close();
        
        if output.is_empty() {
            Err("Failed to detect remote architecture".to_string())
        } else {
            info!("[SSH] Detected remote architecture: {}", output);
            Ok(output)
        }
    }
    
    async fn deploy_agent(&mut self, app_handle: &tauri::AppHandle) -> Result<(), String> {
        // Get or create session first
        let session = if let Some(ref sess) = self.session {
            sess.clone()
        } else {
            let new_session = self.create_session().await?;
            self.session = Some(new_session.clone());
            new_session
        };

        // Always deploy a fresh agent to ensure we have the latest version
        // This avoids version mismatch issues and is fast enough for most use cases
        info!("Deploying remote agent to {}@{}", self.config.username, self.config.host);

        // Detect remote architecture
        let remote_arch = self.detect_remote_arch(&session).await?;
        
        // Map architecture to agent binary suffix
        // uname -m returns: x86_64, aarch64, arm64, armv7l, i686, etc.
        let arch_suffix = match remote_arch.as_str() {
            "x86_64" | "amd64" => "x86_64",
            "aarch64" | "arm64" => "aarch64",
            _ => {
                return Err(format!("Unsupported remote architecture: {}. Supported: x86_64, aarch64", remote_arch));
            }
        };
        
        // Get the agent binary path from the app resources
        // Try architecture-specific binary first, fall back to generic
        let resource_dir = app_handle
            .path()
            .resource_dir()
            .map_err(|e| format!("Failed to get resource dir: {}", e))?;
        
        let arch_specific_path = resource_dir.join(format!("rebebuca-remote-agent-{}", arch_suffix));
        let generic_path = resource_dir.join("rebebuca-remote-agent");
        
        let agent_path = if arch_specific_path.exists() {
            info!("[SSH] Using architecture-specific agent: {:?}", arch_specific_path);
            arch_specific_path
        } else if generic_path.exists() {
            info!("[SSH] Using generic agent (may not match remote arch): {:?}", generic_path);
            generic_path
        } else {
            return Err(format!(
                "Agent binary not found. Looked for: {:?} and {:?}",
                arch_specific_path, generic_path
            ));
        };

        info!("[SSH] Agent binary path: {:?}", agent_path);

        // Read the agent binary
        let agent_binary = std::fs::read(&agent_path)
            .map_err(|e| format!("Failed to read agent binary from {:?}: {}", agent_path, e))?;

        // Transfer the agent to remote
        let remote_path = format!("/tmp/rebebuca-remote-agent-{}", Uuid::new_v4());
        
        let session_guard = session.lock().await;
        let mut remote_file = session_guard
            .scp_send(std::path::Path::new(&remote_path), 0o755, agent_binary.len() as u64, None)
            .map_err(|e| format!("Failed to initiate SCP transfer: {}", e))?;

        remote_file
            .write_all(&agent_binary)
            .map_err(|e| format!("Failed to write agent binary: {}", e))?;

        remote_file
            .send_eof()
            .map_err(|e| format!("Failed to send EOF: {}", e))?;

        remote_file
            .wait_eof()
            .map_err(|e| format!("Failed to wait for EOF: {}", e))?;

        remote_file
            .close()
            .map_err(|e| format!("Failed to close SCP channel: {}", e))?;

        remote_file
            .wait_close()
            .map_err(|e| format!("Failed to wait for close: {}", e))?;
        drop(session_guard);

        info!("Agent deployed successfully to {}", remote_path);
        self.agent_deployed = true;
        let remote_path_clone = remote_path.clone();
        self.agent_path = Some(remote_path_clone.clone());
        
        // Start keep-alive if interval is set
        if self.keep_alive_interval > 0 {
            self.start_keep_alive(app_handle.clone(), session, remote_path_clone).await;
        }

        Ok(())
    }
    
    pub async fn connect(&mut self, app_handle: &tauri::AppHandle) -> Result<(), String> {
        if matches!(self.status, SshConnectionStatus::Connected | SshConnectionStatus::AgentReady) {
            return Ok(());
        }
        
        self.status = SshConnectionStatus::Connecting;
        
        // Create session
        let session = self.create_session().await?;
        self.session = Some(session.clone());
        self.status = SshConnectionStatus::Connected;
        
        // Deploy agent
        self.deploy_agent(app_handle).await?;
        
        // Test agent connection
        if let Some(ref agent_path) = self.agent_path {
            match self.ping_agent(session.clone(), agent_path).await {
                Ok(true) => {
                    self.status = SshConnectionStatus::AgentReady;
                    info!("[SSH] Agent ready for {}", self.config_id);
                }
                Ok(false) => {
                    warn!("[SSH] Agent ping failed (no pong) for {}", self.config_id);
                    // Still mark as ready if agent is deployed
                    self.status = SshConnectionStatus::AgentReady;
                }
                Err(e) => {
                    warn!("[SSH] Agent ping error for {}: {}", self.config_id, e);
                    // Still mark as ready if agent is deployed
                    self.status = SshConnectionStatus::AgentReady;
                }
            }
        }
        
        Ok(())
    }
    
    pub async fn disconnect(&mut self) -> Result<(), String> {
        // Stop keep-alive
        if let Some(handle) = self.keep_alive_handle.take() {
            handle.abort();
        }
        
        // Close session (drop the Arc reference)
        drop(self.session.take());
        self.agent_deployed = false;
        self.agent_path = None;
        self.status = SshConnectionStatus::Disconnected;
        
        Ok(())
    }

    pub async fn execute_remote(
        &mut self,
        app_handle: &tauri::AppHandle,
        task_id: String,
        command: String,
        args: Option<Vec<String>>,
        cwd: Option<String>,
        env: Option<HashMap<String, String>>,
    ) -> Result<String, String> {
        // Ensure connection is established
        if !matches!(self.status, SshConnectionStatus::AgentReady) {
            self.connect(app_handle).await?;
        }
        
        // Always deploy fresh agent to ensure we have the latest version
        self.deploy_agent(app_handle).await?;
        
        // Increment task count
        self.increment_task_count();

        let agent_path = self.agent_path.as_ref()
            .ok_or("Agent path not available")?;
        
        info!("[SSH] Executing command on agent: {}", agent_path);

        let session = self.session.as_ref()
            .ok_or("Session not available")?
            .clone();
        let exec_id = Uuid::new_v4().to_string();

        // Start the remote agent and send execute command
        let session_guard = session.lock().await;
        let mut channel = session_guard
            .channel_session()
            .map_err(|e| format!("Failed to open channel: {}", e))?;

        channel
            .exec(agent_path)
            .map_err(|e| format!("Failed to execute agent: {}", e))?;

        // Send execute command to agent
        let execute_msg = AgentMessage::Execute {
            id: exec_id.clone(),
            command,
            args,
            cwd,
            env,
        };

        let json = serde_json::to_string(&execute_msg)
            .map_err(|e| format!("Failed to serialize message: {}", e))?;

        info!("[SSH] Sending execute command to agent: {}", json);

        channel
            .write_all(format!("{}\n", json).as_bytes())
            .map_err(|e| format!("Failed to send execute command: {}", e))?;

        channel
            .flush()
            .map_err(|e| format!("Failed to flush channel: {}", e))?;
        
        drop(session_guard);

        // Read responses from agent in a background task
        // The channel will be properly closed when the reader finishes or encounters an error
        let app_handle_clone = app_handle.clone();
        let task_id_clone = task_id.clone();
        let config_id_clone = self.config_id.clone();
        let exec_id_clone = exec_id.clone();
        let reader = BufReader::new(channel);

        info!("[SSH] Starting reader loop for exec_id: {}", exec_id_clone);

        tokio::spawn(async move {
            // Delay to allow frontend to set up event listeners
            // This is necessary because SSH tasks can complete very quickly
            // and the frontend needs time to mount the terminal component
            tokio::time::sleep(Duration::from_millis(150)).await;
            
            info!("[SSH] After delay, starting to read from channel");
            
            for line in reader.lines() {
                match line {
                    Ok(line) => {
                        info!("[SSH] Read line from channel: {} bytes", line.len());
                        if let Ok(msg) = serde_json::from_str::<AgentMessage>(&line) {
                            match msg {
                                AgentMessage::Output { id: _, output_type, content } => {
                                    // Send ssh-output event for history tracking
                                    let _ = app_handle_clone.emit(
                                        "ssh-output",
                                        serde_json::json!({
                                            "taskId": task_id_clone,
                                            "type": match output_type {
                                                OutputType::Stdout => "stdout",
                                                OutputType::Stderr => "stderr",
                                                OutputType::System => "system",
                                            },
                                            "content": content.clone(),
                                        }),
                                    );
                                    // Also send pty-output event so TerminalView can display it
                                    let _ = app_handle_clone.emit(
                                        "pty-output",
                                        serde_json::json!({
                                            "pty_id": exec_id_clone,
                                            "data": content,
                                        }),
                                    );
                                }
                                AgentMessage::ProcessStarted { id: _, pid } => {
                                    let _ = app_handle_clone.emit(
                                        "ssh-process-started",
                                        serde_json::json!({
                                            "taskId": task_id_clone,
                                            "pid": pid,
                                        }),
                                    );
                                }
                                AgentMessage::ProcessFinished { id: _, exit_code } => {
                                    let _ = app_handle_clone.emit(
                                        "ssh-process-finished",
                                        serde_json::json!({
                                            "taskId": task_id_clone,
                                            "exitCode": exit_code,
                                        }),
                                    );
                                    
                                    // Decrement task count when task finishes
                                    let should_disconnect = {
                                        let connections = SSH_CONNECTIONS.lock().await;
                                        if let Some(conn) = connections.get(&config_id_clone) {
                                            let mut conn_guard = conn.lock().await;
                                            conn_guard.decrement_task_count();
                                            
                                            // Check if we should disconnect
                                            let should = conn_guard.task_count == 0 && !conn_guard.should_keep_connection();
                                            if should {
                                                drop(conn_guard);
                                                drop(connections);
                                                true
                                            } else {
                                                false
                                            }
                                        } else {
                                            false
                                        }
                                    };
                                    
                                    // Disconnect outside the lock
                                    if should_disconnect {
                                        let connections = SSH_CONNECTIONS.lock().await;
                                        if let Some(conn) = connections.get(&config_id_clone) {
                                            let mut conn_guard = conn.lock().await;
                                            let _ = conn_guard.disconnect().await;
                                        }
                                    }
                                }
                                AgentMessage::Error { id: _, message } => {
                                    let _ = app_handle_clone.emit(
                                        "ssh-error",
                                        serde_json::json!({
                                            "taskId": task_id_clone,
                                            "message": message,
                                        }),
                                    );
                                }
                                _ => {}
                            }
                        }
                    }
                    Err(e) => {
                        error!("Error reading from SSH channel: {}", e);
                        break;
                    }
                }
            }
            // Channel is automatically closed when BufReader is dropped
        });

        Ok(exec_id)
    }
}

// Tauri commands

// Helper function to load SSH configs from storage
// Note: We'll use the adapter's storage system from frontend instead
// This is a placeholder - actual storage will be handled by frontend
async fn load_ssh_configs_from_storage(_app_handle: &tauri::AppHandle) -> Result<(), String> {
    // Storage loading will be handled by frontend through adapter
    // Backend just maintains in-memory cache
    Ok(())
}

// Helper function to save SSH configs to storage
// Note: We'll use the adapter's storage system from frontend instead
// This is a placeholder - actual storage will be handled by frontend
async fn save_ssh_configs_to_storage(_app_handle: &tauri::AppHandle) -> Result<(), String> {
    // Storage saving will be handled by frontend through adapter
    // Backend just maintains in-memory cache
    Ok(())
}

#[tauri::command]
pub async fn test_ssh_connection(config: SshConfig) -> Result<String, String> {
    info!("Testing SSH connection to {}@{}:{}", config.username, config.host, config.port);
    
    // Create a temporary connection for testing
    let config_id = config.id.clone().unwrap_or_else(|| Uuid::new_v4().to_string());
    let config_for_test = config.clone();
    let mut connection = SshConnection::new(config_for_test, config_id);
    
    // Try to create a session
    let session = connection.create_session().await?;
    let session_guard = session.lock().await;
    
    // Try to get server banner
    let banner = session_guard.banner().unwrap_or("Unknown").to_string();
    drop(session_guard);
    
    Ok(format!("Connected successfully. Server: {}", banner))
}

#[tauri::command]
pub async fn list_ssh_configs(
    app_handle: tauri::AppHandle,
) -> Result<Vec<SavedSshConfig>, String> {
    load_ssh_configs_from_storage(&app_handle).await?;
    
    let configs = SSH_CONFIGS.lock().await;
    Ok(configs.values().cloned().collect())
}

#[tauri::command]
pub async fn save_ssh_config(
    app_handle: tauri::AppHandle,
    config: SavedSshConfig,
) -> Result<(), String> {
    let mut configs = SSH_CONFIGS.lock().await;
    configs.insert(config.id.clone(), config.clone());
    drop(configs);
    
    save_ssh_configs_to_storage(&app_handle).await?;
    
    Ok(())
}

#[tauri::command]
pub async fn delete_ssh_config(
    app_handle: tauri::AppHandle,
    id: String,
) -> Result<(), String> {
    let mut configs = SSH_CONFIGS.lock().await;
    configs.remove(&id);
    drop(configs);
    
    save_ssh_configs_to_storage(&app_handle).await?;
    
    // Also disconnect if there's an active connection
    let conn_to_disconnect = {
        let mut connections = SSH_CONNECTIONS.lock().await;
        connections.remove(&id)
    };
    
    if let Some(conn) = conn_to_disconnect {
        let mut conn_guard = conn.lock().await;
        let _ = conn_guard.disconnect().await;
    }
    
    Ok(())
}

#[tauri::command]
pub async fn get_ssh_connection_status(
    id: String,
) -> Result<SshConnectionInfo, String> {
    let connections = SSH_CONNECTIONS.lock().await;
    
    if let Some(conn) = connections.get(&id) {
        let conn_guard = conn.lock().await;
        Ok(SshConnectionInfo {
            id: id.clone(),
            status: conn_guard.get_status(),
            task_count: conn_guard.get_task_count(),
            last_ping: None,  // TODO: track last ping timestamp
        })
    } else {
        Ok(SshConnectionInfo {
            id,
            status: SshConnectionStatus::Disconnected,
            task_count: 0,
            last_ping: None,
        })
    }
}

#[tauri::command]
pub async fn connect_ssh(
    app_handle: tauri::AppHandle,
    id: String,
) -> Result<(), String> {
    // Load configs first
    load_ssh_configs_from_storage(&app_handle).await?;
    
    // Get config
    let configs = SSH_CONFIGS.lock().await;
    let saved_config = configs.get(&id)
        .ok_or_else(|| format!("SSH config not found: {}", id))?;
    
    // Convert SavedSshConfig to SshConfig
    let ssh_config = SshConfig {
        id: Some(saved_config.id.clone()),
        name: Some(saved_config.name.clone()),
        host: saved_config.host.clone(),
        port: saved_config.port,
        username: saved_config.username.clone(),
        auth: saved_config.auth.clone(),
        keep_alive_interval: Some(saved_config.keep_alive_interval),
        keep_connection: Some(saved_config.keep_connection),
    };
    drop(configs);
    
    // Get or create connection
    let ssh_config_for_conn = ssh_config.clone();
    let id_for_conn = id.clone();
    
    let mut connections = SSH_CONNECTIONS.lock().await;
    let connection = connections
        .entry(id.clone())
        .or_insert_with(|| Arc::new(Mutex::new(SshConnection::new(ssh_config_for_conn, id_for_conn))));
    
    let mut conn = connection.lock().await;
    conn.connect(&app_handle).await?;
    
    Ok(())
}

#[tauri::command]
pub async fn disconnect_ssh(
    id: String,
) -> Result<(), String> {
    let connections = SSH_CONNECTIONS.lock().await;
    
    if let Some(conn) = connections.get(&id) {
        let mut conn_guard = conn.lock().await;
        conn_guard.disconnect().await?;
    }
    
    // Optionally remove from connections map
    // connections.remove(&id);
    
    Ok(())
}

#[tauri::command]
pub async fn test_ssh_agent(
    app_handle: tauri::AppHandle,
    id: String,
) -> Result<bool, String> {
    // Ensure connection is established
    connect_ssh(app_handle.clone(), id.clone()).await?;
    
    let (session_clone, agent_path_clone) = {
        let connections = SSH_CONNECTIONS.lock().await;
        if let Some(conn) = connections.get(&id) {
            let conn_guard = conn.lock().await;
            
            // Clone values before dropping the guard
            let session_opt = conn_guard.session.as_ref().map(|s| s.clone());
            let agent_path_opt = conn_guard.agent_path.as_ref().map(|p| p.clone());
            
            (session_opt, agent_path_opt)
        } else {
            (None, None)
        }
    };
    
    if let (Some(session), Some(agent_path)) = (session_clone, agent_path_clone) {
        // session is already Arc<Mutex<Session>>, pass it directly
        SshConnection::ping_agent_static(session, &agent_path).await
    } else {
        Ok(false)
    }
}

#[tauri::command]
pub async fn execute_ssh_command(
    app_handle: tauri::AppHandle,
    config: SshConfig,
    task_id: String,
    command: String,
    args: Option<Vec<String>>,
    cwd: Option<String>,
    env: Option<HashMap<String, String>>,
) -> Result<String, String> {
    // Use config ID if provided, otherwise generate one from connection key
    let config_id = config.id.clone().unwrap_or_else(|| {
        format!("{}@{}:{}", config.username, config.host, config.port)
    });
    
    let config_for_conn = config.clone(); // Clone for connection creation
    let config_id_for_conn = config_id.clone();
    
    let mut connections = SSH_CONNECTIONS.lock().await;
    let connection = connections
        .entry(config_id.clone())
        .or_insert_with(|| Arc::new(Mutex::new(SshConnection::new(config_for_conn, config_id_for_conn))));
    
    let mut conn = connection.lock().await;
    conn.execute_remote(&app_handle, task_id, command, args, cwd, env).await
}

#[tauri::command]
pub async fn execute_ssh_command_by_id(
    app_handle: tauri::AppHandle,
    config_id: String,
    task_id: String,
    command: String,
    args: Option<Vec<String>>,
    cwd: Option<String>,
    env: Option<HashMap<String, String>>,
) -> Result<String, String> {
    // Load configs first
    load_ssh_configs_from_storage(&app_handle).await?;
    
    // Get config
    let configs = SSH_CONFIGS.lock().await;
    let saved_config = configs.get(&config_id)
        .ok_or_else(|| format!("SSH config not found: {}", config_id))?;
    
    // Convert SavedSshConfig to SshConfig
    let ssh_config = SshConfig {
        id: Some(saved_config.id.clone()),
        name: Some(saved_config.name.clone()),
        host: saved_config.host.clone(),
        port: saved_config.port,
        username: saved_config.username.clone(),
        auth: saved_config.auth.clone(),
        keep_alive_interval: Some(saved_config.keep_alive_interval),
        keep_connection: Some(saved_config.keep_connection),
    };
    drop(configs);
    
    // Get or create connection
    let mut connections = SSH_CONNECTIONS.lock().await;
    let connection = connections
        .entry(config_id.clone())
        .or_insert_with(|| Arc::new(Mutex::new(SshConnection::new(ssh_config, config_id))));
    
    let mut conn = connection.lock().await;
    
    // Ensure connection is established and agent is ready
    if !matches!(conn.get_status(), SshConnectionStatus::AgentReady) {
        conn.connect(&app_handle).await?;
    }
    
    conn.execute_remote(&app_handle, task_id, command, args, cwd, env).await
}

#[tauri::command]
pub async fn close_ssh_connection(host: String, port: u16, username: String) -> Result<(), String> {
    // This is the old API - try to find by connection key
    let connection_key = format!("{}@{}:{}", username, host, port);
    let mut connections = SSH_CONNECTIONS.lock().await;
    
    // Try to find by connection key (for backward compatibility)
    let mut found_id: Option<String> = None;
    for (id, conn) in connections.iter() {
        let conn_guard = conn.lock().await;
        if conn_guard.get_connection_key() == connection_key {
            found_id = Some(id.clone());
            break;
        }
    }
    
    if let Some(id) = found_id {
        if let Some(conn) = connections.get(&id) {
            let mut conn_guard = conn.lock().await;
            let _ = conn_guard.disconnect().await;
        }
        connections.remove(&id);
    }
    
    Ok(())
}

/// Directory entry for remote file browser
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RemoteDirectoryEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub size: Option<u64>,
}

/// List remote directory contents via SSH
#[tauri::command]
pub async fn list_ssh_directory(
    app_handle: tauri::AppHandle,
    config_id: String,
    path: String,
) -> Result<Vec<RemoteDirectoryEntry>, String> {
    // Ensure connection is established
    connect_ssh(app_handle.clone(), config_id.clone()).await?;
    
    let connections = SSH_CONNECTIONS.lock().await;
    let conn = connections.get(&config_id)
        .ok_or_else(|| format!("SSH connection not found: {}", config_id))?;
    
    let conn_guard = conn.lock().await;
    let session = conn_guard.session.as_ref()
        .ok_or("SSH session not available")?;
    
    let session_guard = session.lock().await;
    let mut channel = session_guard
        .channel_session()
        .map_err(|e| format!("Failed to open channel: {}", e))?;
    
    // Use ls command to list directory contents
    // -la for long format with hidden files, parse output
    let cmd = format!("ls -la '{}' 2>/dev/null || echo 'ERROR_DIR_NOT_FOUND'", path.replace("'", "'\\''"));
    channel
        .exec(&cmd)
        .map_err(|e| format!("Failed to execute ls command: {}", e))?;
    
    drop(session_guard);
    
    // Read output
    let mut output = String::new();
    let reader = BufReader::new(&mut channel);
    for line in reader.lines() {
        if let Ok(line) = line {
            output.push_str(&line);
            output.push('\n');
        }
    }
    
    let _ = channel.wait_close();
    
    if output.contains("ERROR_DIR_NOT_FOUND") {
        return Err(format!("Directory not found: {}", path));
    }
    
    // Parse ls -la output - only include directories
    let mut entries = Vec::new();
    let base_path = if path.ends_with('/') { path.clone() } else { format!("{}/", path) };
    
    for line in output.lines().skip(1) { // Skip "total" line
        let parts: Vec<&str> = line.split_whitespace().collect();
        if parts.len() < 9 {
            continue;
        }
        
        let permissions = parts[0];
        let name = parts[8..].join(" "); // Handle filenames with spaces
        
        // Skip . and ..
        if name == "." || name == ".." {
            continue;
        }
        
        let is_dir = permissions.starts_with('d');
        
        // Only include directories, skip files
        if !is_dir {
            continue;
        }
        
        entries.push(RemoteDirectoryEntry {
            name: name.clone(),
            path: format!("{}{}", base_path, name),
            is_dir,
            size: None,
        });
    }
    
    // Sort alphabetically
    entries.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    
    Ok(entries)
}

/// Get user's home directory on remote server
#[tauri::command]
pub async fn get_ssh_home_directory(
    app_handle: tauri::AppHandle,
    config_id: String,
) -> Result<String, String> {
    // Ensure connection is established
    connect_ssh(app_handle.clone(), config_id.clone()).await?;
    
    let connections = SSH_CONNECTIONS.lock().await;
    let conn = connections.get(&config_id)
        .ok_or_else(|| format!("SSH connection not found: {}", config_id))?;
    
    let conn_guard = conn.lock().await;
    let session = conn_guard.session.as_ref()
        .ok_or("SSH session not available")?;
    
    let session_guard = session.lock().await;
    let mut channel = session_guard
        .channel_session()
        .map_err(|e| format!("Failed to open channel: {}", e))?;
    
    channel
        .exec("echo $HOME")
        .map_err(|e| format!("Failed to execute command: {}", e))?;
    
    drop(session_guard);
    
    // Read output
    let mut output = String::new();
    let reader = BufReader::new(&mut channel);
    for line in reader.lines() {
        if let Ok(line) = line {
            output = line.trim().to_string();
            break;
        }
    }
    
    let _ = channel.wait_close();
    
    if output.is_empty() {
        Ok("/".to_string())
    } else {
        Ok(output)
    }
}

/// Shell info from remote server
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RemoteShellInfo {
    pub id: String,
    pub name: String,
    pub path: String,
    pub is_default: bool,
}

/// Get available shells on remote server via SSH
#[tauri::command]
pub async fn get_ssh_shells(
    app_handle: tauri::AppHandle,
    config_id: String,
) -> Result<Vec<RemoteShellInfo>, String> {
    // Ensure connection is established
    connect_ssh(app_handle.clone(), config_id.clone()).await?;
    
    let connections = SSH_CONNECTIONS.lock().await;
    let conn = connections.get(&config_id)
        .ok_or_else(|| format!("SSH connection not found: {}", config_id))?;
    
    let conn_guard = conn.lock().await;
    let session = conn_guard.session.as_ref()
        .ok_or("SSH session not available")?;
    
    let session_guard = session.lock().await;
    let mut channel = session_guard
        .channel_session()
        .map_err(|e| format!("Failed to open channel: {}", e))?;
    
    // Get default shell and available shells from /etc/shells
    let cmd = r#"echo "DEFAULT:$SHELL"; cat /etc/shells 2>/dev/null | grep -v '^#' | grep -v '^$'"#;
    channel
        .exec(cmd)
        .map_err(|e| format!("Failed to execute command: {}", e))?;
    
    drop(session_guard);
    
    // Read output
    let mut output = String::new();
    let reader = BufReader::new(&mut channel);
    for line in reader.lines() {
        if let Ok(line) = line {
            output.push_str(&line);
            output.push('\n');
        }
    }
    
    let _ = channel.wait_close();
    
    // Parse output
    let mut shells = Vec::new();
    let mut default_shell = String::new();
    let mut seen_paths = std::collections::HashSet::new();
    
    for line in output.lines() {
        let line = line.trim();
        if line.starts_with("DEFAULT:") {
            default_shell = line.strip_prefix("DEFAULT:").unwrap_or("").trim().to_string();
        } else if line.starts_with('/') {
            // It's a shell path
            if seen_paths.contains(line) {
                continue;
            }
            seen_paths.insert(line.to_string());
            
            let name = std::path::Path::new(line)
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or(line);
            
            let display_name = match name {
                "bash" => "Bash",
                "zsh" => "Zsh",
                "fish" => "Fish",
                "sh" => "Sh",
                "dash" => "Dash",
                "ksh" | "ksh93" => "Ksh",
                "tcsh" => "Tcsh",
                "csh" => "Csh",
                _ => name,
            };
            
            let is_default = line == default_shell;
            
            shells.push(RemoteShellInfo {
                id: name.to_string(),
                name: display_name.to_string(),
                path: line.to_string(),
                is_default,
            });
        }
    }
    
    // Sort: default first, then alphabetically
    shells.sort_by(|a, b| {
        match (a.is_default, b.is_default) {
            (true, false) => std::cmp::Ordering::Less,
            (false, true) => std::cmp::Ordering::Greater,
            _ => a.name.cmp(&b.name),
        }
    });
    
    // If no shells found from /etc/shells, add common defaults
    if shells.is_empty() {
        shells.push(RemoteShellInfo {
            id: "bash".to_string(),
            name: "Bash".to_string(),
            path: "/bin/bash".to_string(),
            is_default: true,
        });
        shells.push(RemoteShellInfo {
            id: "sh".to_string(),
            name: "Sh".to_string(),
            path: "/bin/sh".to_string(),
            is_default: false,
        });
    }
    
    Ok(shells)
}
