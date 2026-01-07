use crate::types::{AgentMessage, OutputType, SshAuthMethod, SshConfig};
use log::{error, info};
use serde::{Deserialize, Serialize};
use ssh2::Session;
use std::collections::HashMap;
use std::io::{BufRead, BufReader, Write};
use std::net::TcpStream;
use std::path::PathBuf;
use std::sync::Arc;
use tauri::Manager;
use tokio::sync::Mutex;
use uuid::Uuid;

#[derive(Clone)]
pub struct SshConnection {
    config: SshConfig,
    agent_deployed: bool,
    agent_path: Option<String>,
}

// Store active SSH connections
lazy_static::lazy_static! {
    static ref SSH_CONNECTIONS: Arc<Mutex<HashMap<String, Arc<Mutex<SshConnection>>>>> = 
        Arc::new(Mutex::new(HashMap::new()));
}

impl SshConnection {
    pub fn new(config: SshConfig) -> Self {
        Self {
            config,
            agent_deployed: false,
            agent_path: None,
        }
    }

    fn create_session(&self) -> Result<Session, String> {
        let tcp = TcpStream::connect(format!("{}:{}", self.config.host, self.config.port))
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
                let passphrase = passphrase.as_deref();
                session
                    .userauth_pubkey_file(&self.config.username, None, std::path::Path::new(key_path), passphrase)
                    .map_err(|e| format!("SSH key authentication failed: {}", e))?;
            }
        }

        if !session.authenticated() {
            return Err("SSH authentication failed".to_string());
        }

        Ok(session)
    }

    async fn deploy_agent(&mut self, app_handle: &tauri::AppHandle) -> Result<(), String> {
        if self.agent_deployed {
            return Ok(());
        }

        info!("Deploying remote agent to {}@{}", self.config.username, self.config.host);

        let session = self.create_session()?;

        // Get the agent binary path from the app resources
        let agent_path = app_handle
            .path()
            .resource_dir()
            .map_err(|e| format!("Failed to get resource dir: {}", e))?
            .join("rebebuca-remote-agent");

        // Read the agent binary
        let agent_binary = std::fs::read(&agent_path)
            .map_err(|e| format!("Failed to read agent binary: {}", e))?;

        // Transfer the agent to remote
        let remote_path = format!("/tmp/rebebuca-remote-agent-{}", Uuid::new_v4());
        let mut remote_file = session
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

        info!("Agent deployed successfully to {}", remote_path);
        self.agent_deployed = true;
        self.agent_path = Some(remote_path);

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
        // Deploy agent if not already deployed
        self.deploy_agent(app_handle).await?;

        let agent_path = self.agent_path.as_ref()
            .ok_or("Agent path not available")?;

        let session = self.create_session()?;
        let exec_id = Uuid::new_v4().to_string();

        // Start the remote agent and send execute command
        let mut channel = session
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

        channel
            .write_all(format!("{}\n", json).as_bytes())
            .map_err(|e| format!("Failed to send execute command: {}", e))?;

        channel
            .flush()
            .map_err(|e| format!("Failed to flush channel: {}", e))?;

        // Read responses from agent in a background task
        // The channel will be properly closed when the reader finishes or encounters an error
        let app_handle_clone = app_handle.clone();
        let task_id_clone = task_id.clone();
        let reader = BufReader::new(channel);

        tokio::spawn(async move {
            for line in reader.lines() {
                match line {
                    Ok(line) => {
                        if let Ok(msg) = serde_json::from_str::<AgentMessage>(&line) {
                            match msg {
                                AgentMessage::Output { id, output_type, content } => {
                                    let _ = app_handle_clone.emit(
                                        "ssh-output",
                                        serde_json::json!({
                                            "taskId": task_id_clone,
                                            "type": match output_type {
                                                OutputType::Stdout => "stdout",
                                                OutputType::Stderr => "stderr",
                                                OutputType::System => "system",
                                            },
                                            "content": content,
                                        }),
                                    );
                                }
                                AgentMessage::ProcessStarted { id, pid } => {
                                    let _ = app_handle_clone.emit(
                                        "ssh-process-started",
                                        serde_json::json!({
                                            "taskId": task_id_clone,
                                            "pid": pid,
                                        }),
                                    );
                                }
                                AgentMessage::ProcessFinished { id, exit_code } => {
                                    let _ = app_handle_clone.emit(
                                        "ssh-process-finished",
                                        serde_json::json!({
                                            "taskId": task_id_clone,
                                            "exitCode": exit_code,
                                        }),
                                    );
                                }
                                AgentMessage::Error { id, message } => {
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

#[tauri::command]
pub async fn test_ssh_connection(config: SshConfig) -> Result<String, String> {
    info!("Testing SSH connection to {}@{}:{}", config.username, config.host, config.port);
    
    let connection = SshConnection::new(config);
    let session = connection.create_session()?;
    
    // Try to get server banner
    let banner = session.banner().unwrap_or("Unknown").to_string();
    
    Ok(format!("Connected successfully. Server: {}", banner))
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
    let connection_key = format!("{}@{}:{}", config.username, config.host, config.port);
    
    let mut connections = SSH_CONNECTIONS.lock().await;
    let connection = connections
        .entry(connection_key)
        .or_insert_with(|| Arc::new(Mutex::new(SshConnection::new(config))));
    
    let mut conn = connection.lock().await;
    conn.execute_remote(&app_handle, task_id, command, args, cwd, env).await
}

#[tauri::command]
pub async fn close_ssh_connection(host: String, port: u16, username: String) -> Result<(), String> {
    let connection_key = format!("{}@{}:{}", username, host, port);
    let mut connections = SSH_CONNECTIONS.lock().await;
    connections.remove(&connection_key);
    Ok(())
}
