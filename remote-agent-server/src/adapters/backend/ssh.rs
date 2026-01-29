//! SSH backend implementation
//!
//! Provides remote terminal functionality via SSH using ssh2 crate.
//!
//! Features:
//! - SSH connection and authentication (password/key-based)
//! - PTY allocation on remote host
//! - Interactive shell execution
//! - Terminal resize support
//! - Asynchronous I/O with event channels
//!
//! Note: SSH types (SshConfig, SshAuthMethod, etc.) are shared via `rebebuca-common` crate
//! to maintain consistency with `src-tauri` implementation.

use async_trait::async_trait;
use std::collections::HashMap;
use std::io::{BufRead, BufReader, Read, Write};
use std::net::TcpStream;
use std::sync::Arc;
use tokio::sync::{mpsc, RwLock};
use tokio::time::{timeout, Duration};
use uuid::Uuid;

use crate::protocol::{CreateTerminalParams, PtyProcessStats, TerminalDataEvent, TerminalExitEvent};
use crate::adapters::backend::{
    BackendType, TerminalBackend, TerminalCreateResult, TerminalHandle,
};
use rebebuca_common::{SshAuthMethod, SshConfig};

/// SSH terminal session with active channel
struct SshTerminal {
    terminal_id: String,
    config: SshConfig,
    session: Arc<RwLock<ssh2::Session>>,
    channel: Arc<std::sync::Mutex<Option<ssh2::Channel>>>,
    cols: u16,
    rows: u16,
    /// Channel for sending terminal data events
    data_tx: Option<mpsc::UnboundedSender<TerminalDataEvent>>,
    /// Channel for sending terminal exit events
    exit_tx: Option<mpsc::UnboundedSender<TerminalExitEvent>>,
    /// Reader task handle
    reader_handle: Option<tokio::task::JoinHandle<()>>,
}

impl SshTerminal {
    /// Create SSH session and authenticate
    async fn create_session(config: &SshConfig) -> Result<Arc<RwLock<ssh2::Session>>, String> {
        let host = config.host.clone();
        let port = config.port;
        let username = config.username.clone();
        let auth = config.auth.clone();

        // Connect to SSH server
        let tcp = timeout(
            Duration::from_secs(10),
            tokio::task::spawn_blocking(move || {
                TcpStream::connect(format!("{}:{}", host, port))
            }),
        )
        .await
        .map_err(|e| format!("Connection timeout: {}", e))?
        .map_err(|e| format!("Failed to spawn blocking task: {}", e))?
        .map_err(|e| format!("Failed to connect to SSH server: {}", e))?;

        let mut session = ssh2::Session::new().map_err(|e| format!("Failed to create SSH session: {}", e))?;
        session.set_tcp_stream(tcp);
        session
            .handshake()
            .map_err(|e| format!("SSH handshake failed: {}", e))?;

        // Authenticate
        match auth {
            SshAuthMethod::Password { password } => {
                session
                    .userauth_password(&username, &password)
                    .map_err(|e| format!("SSH password authentication failed: {}", e))?;
            }
            SshAuthMethod::PrivateKey { key_path, passphrase } => {
                session
                    .userauth_pubkey_file(
                        &username,
                        None,
                        std::path::Path::new(&key_path),
                        passphrase.as_deref(),
                    )
                    .map_err(|e| format!("SSH key authentication failed: {}", e))?;
            }
        }

        if !session.authenticated() {
            return Err("SSH authentication failed".to_string());
        }

        Ok(Arc::new(RwLock::new(session)))
    }

    /// Allocate PTY and start shell on remote host
    async fn allocate_pty_and_shell(
        session: Arc<RwLock<ssh2::Session>>,
        cols: u16,
        rows: u16,
        shell: Option<&str>,
        cwd: Option<&str>,
        env: &HashMap<String, String>,
    ) -> Result<ssh2::Channel, String> {
        let session_guard = session.read().await;
        let mut channel = session_guard
            .channel_session()
            .map_err(|e| format!("Failed to open SSH channel: {}", e))?;

        // Request PTY with terminal size
        channel
            .request_pty(
                "xterm",
                None,
                Some((cols as u32, rows as u32, 0, 0)),
            )
            .map_err(|e| format!("Failed to request PTY: {}", e))?;

        // Set environment variables
        for (key, value) in env {
            let _ = channel.setenv(key, value);
        }

        // Start shell (or execute command if cwd is specified)
        if let Some(cwd) = cwd {
            // Change directory and start shell
            let shell_cmd = shell.unwrap_or("$SHELL");
            channel
                .exec(&format!("cd {} && exec {} -l", cwd, shell_cmd))
                .map_err(|e| format!("Failed to execute shell: {}", e))?;
        } else {
            // Start interactive shell
            channel
                .shell()
                .map_err(|e| format!("Failed to start shell: {}", e))?;
        }

        drop(session_guard);
        Ok(channel)
    }
}

/// SSH backend implementation
pub struct SshBackend {
    /// Active SSH terminals
    terminals: Arc<RwLock<HashMap<String, SshTerminal>>>,
    /// Channel to send terminal data events
    data_tx: Option<mpsc::UnboundedSender<TerminalDataEvent>>,
    /// Channel to send terminal exit events
    exit_tx: Option<mpsc::UnboundedSender<TerminalExitEvent>>,
}

impl SshBackend {
    /// Create a new SSH backend
    pub fn new(
        data_tx: Option<mpsc::UnboundedSender<TerminalDataEvent>>,
        exit_tx: Option<mpsc::UnboundedSender<TerminalExitEvent>>,
    ) -> Self {
        Self {
            terminals: Arc::new(RwLock::new(HashMap::new())),
            data_tx,
            exit_tx,
        }
    }
}

#[async_trait]
impl TerminalBackend for SshBackend {
    fn backend_type(&self) -> BackendType {
        BackendType::Ssh
    }

    async fn create(&self, params: CreateTerminalParams) -> Result<TerminalCreateResult, String> {
        let terminal_id = params
            .pty_id
            .unwrap_or_else(|| format!("ssh-{}", Uuid::new_v4()));

        // Extract SSH config from params.env
        // Note: In a real implementation, SSH config should be passed via a proper config structure
        // For now, we extract from env vars for compatibility
        let config = SshConfig {
            id: None,
            name: None,
            host: params
                .env
                .get("SSH_HOST")
                .cloned()
                .ok_or_else(|| "SSH_HOST not specified".to_string())?,
            port: params
                .env
                .get("SSH_PORT")
                .and_then(|p| p.parse().ok())
                .unwrap_or(22),
            username: params
                .env
                .get("SSH_USER")
                .cloned()
                .unwrap_or_else(|| "root".to_string()),
            auth: if let Some(password) = params.env.get("SSH_PASSWORD") {
                SshAuthMethod::Password {
                    password: password.clone(),
                }
            } else if let Some(key_path) = params.env.get("SSH_KEY_PATH") {
                SshAuthMethod::PrivateKey {
                    key_path: key_path.clone(),
                    passphrase: params.env.get("SSH_KEY_PASSPHRASE").cloned(),
                }
            } else {
                return Err("SSH authentication not specified (need SSH_PASSWORD or SSH_KEY_PATH)".to_string());
            },
            keep_alive_interval: params.env.get("SSH_KEEP_ALIVE_INTERVAL")
                .and_then(|v| v.parse().ok()),
            keep_connection: params.env.get("SSH_KEEP_CONNECTION")
                .and_then(|v| v.parse().ok()),
        };

        // Create SSH session
        let session = SshTerminal::create_session(&config).await?;

        // Allocate PTY and start shell
        let cols = params.cols.unwrap_or(80);
        let rows = params.rows.unwrap_or(24);
        let shell = params.shell_path.as_deref();
        let cwd = params.cwd.as_deref();
        
        let channel = SshTerminal::allocate_pty_and_shell(
            session.clone(),
            cols,
            rows,
            shell,
            cwd,
            &params.env,
        )
        .await?;

        // Spawn reader task to read from channel
        let terminal_id_clone = terminal_id.clone();
        let data_tx = self.data_tx.clone();
        let exit_tx = self.exit_tx.clone();
        let channel_arc = Arc::new(std::sync::Mutex::new(Some(channel)));
        let channel_for_reader = channel_arc.clone();

        let reader_handle = tokio::spawn(async move {
            loop {
                tokio::select! {
                    result = {
                        let channel_mutex = channel_for_reader.clone();
                        tokio::task::spawn_blocking(move || {
                            if let Ok(mut channel_opt) = channel_mutex.lock() {
                                if let Some(ref mut channel) = *channel_opt {
                                    // Use BufReader to read from channel (implements Read trait)
                                    let mut reader = BufReader::new(channel);
                                    let mut buf = vec![0u8; 4096];
                                    match reader.read(&mut buf) {
                                        Ok(0) => None, // EOF
                                        Ok(n) => Some(buf[..n].to_vec()),
                                        Err(e) if e.kind() == std::io::ErrorKind::WouldBlock => Some(vec![]), // No data
                                        Err(_) => None, // Error
                                    }
                                } else {
                                    None
                                }
                            } else {
                                None
                            }
                        })
                    } => {
                        match result {
                            Ok(Some(data)) if !data.is_empty() => {
                                if let Some(ref tx) = data_tx {
                                    let event = TerminalDataEvent {
                                        pty_id: terminal_id_clone.clone(),
                                        data: String::from_utf8_lossy(&data).to_string(),
                                    };
                                    if tx.send(event).is_err() {
                                        break;
                                    }
                                }
                            }
                            Ok(Some(_)) => {
                                // Empty data, continue
                                tokio::time::sleep(Duration::from_millis(100)).await;
                                continue;
                            }
                            Ok(None) | Err(_) => {
                                // EOF or error
                                break;
                            }
                        }
                    }
                }
            }

            // Send exit event
            if let Some(ref tx) = exit_tx {
                let _ = tx.send(TerminalExitEvent {
                    pty_id: terminal_id_clone.clone(),
                    exit_code: None,
                });
            }
        });

        let terminal = SshTerminal {
            terminal_id: terminal_id.clone(),
            config,
            session,
            channel: channel_arc,
            cols,
            rows,
            data_tx: self.data_tx.clone(),
            exit_tx: self.exit_tx.clone(),
            reader_handle: Some(reader_handle),
        };

        {
            let mut terminals = self.terminals.write().await;
            terminals.insert(terminal_id.clone(), terminal);
        }

        // TODO: Get actual PID from remote process (requires additional SSH command)
        Ok(TerminalCreateResult {
            handle: TerminalHandle::ssh(terminal_id),
            pid: None,
        })
    }

    async fn write(&self, handle: &TerminalHandle, data: &str) -> Result<(), String> {
        if handle.backend != BackendType::Ssh {
            return Err(format!(
                "Invalid backend type: expected Ssh, got {:?}",
                handle.backend
            ));
        }

        // Get channel reference and write data
        let data_bytes = data.as_bytes().to_vec();
        let channel_ref = {
            let terminals = self.terminals.read().await;
            terminals
                .get(&handle.id)
                .ok_or_else(|| format!("SSH terminal {} not found", handle.id))?
                .channel
                .clone()
        };

        // Write to channel in blocking thread
        tokio::task::spawn_blocking(move || {
            if let Ok(mut channel_opt) = channel_ref.lock() {
                if let Some(ref mut channel) = *channel_opt {
                    channel
                        .write_all(&data_bytes)
                        .map_err(|e| format!("Failed to write to SSH channel: {}", e))?;
                    channel
                        .flush()
                        .map_err(|e| format!("Failed to flush SSH channel: {}", e))?;
                    Ok(())
                } else {
                    Err("SSH channel not available".to_string())
                }
            } else {
                Err("Failed to lock SSH channel".to_string())
            }
        })
        .await
        .map_err(|e| format!("Write task failed: {}", e))?
    }

    async fn resize(&self, handle: &TerminalHandle, cols: u16, rows: u16) -> Result<(), String> {
        if handle.backend != BackendType::Ssh {
            return Err(format!(
                "Invalid backend type: expected Ssh, got {:?}",
                handle.backend
            ));
        }

        // Get channel reference first
        let channel_ref = {
            let terminals = self.terminals.read().await;
            terminals
                .get(&handle.id)
                .ok_or_else(|| format!("SSH terminal {} not found", handle.id))?
                .channel
                .clone()
        };

        // Resize channel
        let resize_result = {
            if let Ok(mut channel_opt) = channel_ref.lock() {
                if let Some(ref mut channel) = *channel_opt {
                    channel
                        .request_pty_size(cols as u32, rows as u32, None, None)
                        .map_err(|e| format!("Failed to resize SSH PTY: {}", e))
                } else {
                    Err("SSH channel not available".to_string())
                }
            } else {
                Err("Failed to lock SSH channel".to_string())
            }
        };

        // Update terminal size if resize succeeded
        if resize_result.is_ok() {
            let mut terminals = self.terminals.write().await;
            if let Some(terminal) = terminals.get_mut(&handle.id) {
                terminal.cols = cols;
                terminal.rows = rows;
            }
        }

        resize_result
    }

    async fn kill(&self, handle: &TerminalHandle) -> Result<(), String> {
        if handle.backend != BackendType::Ssh {
            return Err(format!(
                "Invalid backend type: expected Ssh, got {:?}",
                handle.backend
            ));
        }

        let mut terminals = self.terminals.write().await;
        if let Some(mut terminal) = terminals.remove(&handle.id) {
            // Close channel
            if let Ok(mut channel_opt) = terminal.channel.lock() {
                if let Some(mut channel) = channel_opt.take() {
                    let _ = channel.send_eof();
                    let _ = channel.wait_eof();
                    let _ = channel.close();
                    let _ = channel.wait_close();
                }
            }

            // Abort reader task
            if let Some(handle) = terminal.reader_handle.take() {
                handle.abort();
            }

            Ok(())
        } else {
            Err(format!("SSH terminal {} not found", handle.id))
        }
    }

    async fn force_kill(&self, handle: &TerminalHandle) -> Result<(), String> {
        // For SSH, force kill is the same as regular kill
        // (we close the channel which terminates the remote process)
        self.kill(handle).await
    }

    async fn is_alive(&self, handle: &TerminalHandle) -> bool {
        if handle.backend != BackendType::Ssh {
            return false;
        }

        // Get channel reference first
        let channel_ref = {
            let terminals = self.terminals.read().await;
            terminals
                .get(&handle.id)
                .map(|t| t.channel.clone())
        };

        // Check if channel exists
        if let Some(channel_ref) = channel_ref {
            if let Ok(channel_opt) = channel_ref.lock() {
                channel_opt.is_some()
            } else {
                false
            }
        } else {
            false
        }
    }

    async fn get_process_stats(&self, _handle: &TerminalHandle) -> Option<PtyProcessStats> {
        // SSH backend doesn't support process stats yet
        // Would require executing 'ps' command on remote host
        None
    }

    async fn get_text(&self, _handle: &TerminalHandle, _lines: Option<usize>) -> Option<String> {
        // SSH backend doesn't support text retrieval yet
        // Would require maintaining a scrollback buffer
        None
    }

    async fn send_key(&self, handle: &TerminalHandle, key: &str) -> Result<bool, String> {
        if handle.backend != BackendType::Ssh {
            return Ok(false);
        }

        // Convert key name to actual key sequence
        let key_sequence = match key.to_lowercase().as_str() {
            "enter" | "return" => "\r",
            "escape" | "esc" => "\x1b",
            "tab" => "\t",
            "backspace" => "\x08",
            "delete" => "\x7f",
            _ if key.len() == 1 => key,
            _ => return Ok(false),
        };
        self.write(handle, key_sequence).await?;
        Ok(true)
    }
}
