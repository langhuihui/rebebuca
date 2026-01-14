//! PTY Terminal adapter
//!
//! Creates and manages pseudo-terminals using nix::pty

use nix::pty::{openpty, OpenptyResult, Winsize};
use nix::sys::signal::{kill, Signal};
use nix::unistd::{close, dup2, execvp, fork, setsid, ForkResult, Pid};
use std::collections::HashMap;
use std::ffi::CString;
use std::os::unix::io::{AsRawFd, RawFd};
use std::sync::Arc;
use tokio::sync::{mpsc, RwLock};
use uuid::Uuid;

use crate::protocol::{CreateTerminalParams, PtyProcessStats, TerminalDataEvent, TerminalExitEvent};

/// PTY handle for a single terminal instance
#[derive(Debug)]
pub struct PtyHandle {
    #[allow(dead_code)]
    pub pty_id: String,
    pub master_fd: RawFd,
    pub pid: Pid,
    pub cols: u16,
    pub rows: u16,
    shutdown_tx: Option<mpsc::Sender<()>>,
}

impl PtyHandle {
    /// Write data to the PTY
    pub fn write(&self, data: &[u8]) -> Result<(), String> {
        unsafe {
            let ret = libc::write(self.master_fd, data.as_ptr() as *const libc::c_void, data.len());
            if ret < 0 {
                return Err(format!("Write failed: {}", std::io::Error::last_os_error()));
            }
        }
        Ok(())
    }

    /// Resize the PTY
    pub fn resize(&mut self, cols: u16, rows: u16) -> Result<(), String> {
        let winsize = Winsize {
            ws_col: cols,
            ws_row: rows,
            ws_xpixel: 0,
            ws_ypixel: 0,
        };

        unsafe {
            #[allow(clippy::useless_conversion)]
            if libc::ioctl(self.master_fd, libc::TIOCSWINSZ.into(), &winsize) < 0 {
                return Err("Failed to resize PTY".to_string());
            }
        }

        self.cols = cols;
        self.rows = rows;
        Ok(())
    }

    /// Send SIGTERM to the process
    pub fn kill(&self) -> Result<(), String> {
        kill(self.pid, Signal::SIGTERM).map_err(|e| format!("Kill failed: {}", e))
    }

    /// Send SIGKILL to the process (force kill)
    pub fn force_kill(&self) -> Result<(), String> {
        kill(self.pid, Signal::SIGKILL).map_err(|e| format!("Force kill failed: {}", e))
    }

    /// Check if the process is still running
    pub fn is_running(&self) -> bool {
        match kill(self.pid, None) {
            Ok(_) => true,
            Err(_) => false,
        }
    }

    /// Signal shutdown to the reader task
    pub fn shutdown(&mut self) {
        if let Some(tx) = self.shutdown_tx.take() {
            let _ = tx.try_send(());
        }
    }
}

impl Drop for PtyHandle {
    fn drop(&mut self) {
        // Close the master fd
        let _ = close(self.master_fd);
        // Signal shutdown
        self.shutdown();
    }
}

/// Terminal adapter managing multiple PTY instances
pub struct TerminalAdapter {
    ptys: Arc<RwLock<HashMap<String, PtyHandle>>>,
    /// Channel to send terminal data events
    data_tx: mpsc::UnboundedSender<TerminalDataEvent>,
    /// Channel to send terminal exit events
    exit_tx: mpsc::UnboundedSender<TerminalExitEvent>,
}

impl TerminalAdapter {
    pub fn new(
        data_tx: mpsc::UnboundedSender<TerminalDataEvent>,
        exit_tx: mpsc::UnboundedSender<TerminalExitEvent>,
    ) -> Self {
        Self {
            ptys: Arc::new(RwLock::new(HashMap::new())),
            data_tx,
            exit_tx,
        }
    }

    /// Create a new PTY terminal
    pub async fn create(&self, params: CreateTerminalParams) -> Result<(String, Option<u32>), String> {
        // Use client-specified pty_id if provided, otherwise generate one
        let pty_id = params.pty_id.unwrap_or_else(|| format!("pty-{}", Uuid::new_v4()));

        // Open a PTY pair
        let OpenptyResult { master, slave } =
            openpty(None, None).map_err(|e| format!("openpty failed: {}", e))?;

        let master_fd = master.as_raw_fd();
        let slave_fd = slave.as_raw_fd();

        // Fork the process
        let pid = match unsafe { fork() } {
            Ok(ForkResult::Parent { child }) => {
                // Parent process - close slave fd
                let _ = close(slave_fd);
                child
            }
            Ok(ForkResult::Child) => {
                // Child process
                // Close master fd
                let _ = close(master_fd);

                // Create a new session
                let _ = setsid();

                // Set controlling terminal
                unsafe {
                    #[allow(clippy::useless_conversion)]
                    libc::ioctl(slave_fd, libc::TIOCSCTTY.into(), 0);
                }

                // Redirect stdin, stdout, stderr to slave
                let _ = dup2(slave_fd, 0);
                let _ = dup2(slave_fd, 1);
                let _ = dup2(slave_fd, 2);

                if slave_fd > 2 {
                    let _ = close(slave_fd);
                }

                // Change directory if specified
                if let Some(cwd) = &params.cwd {
                    if !cwd.is_empty() {
                        let _ = std::env::set_current_dir(cwd);
                    }
                }

                // Set environment variables
                for (key, value) in &params.env {
                    std::env::set_var(key, value);
                }

                // Execute the command using shell
                let shell = params.shell_path
                    .as_ref()
                    .map(|s| s.as_str())
                    .unwrap_or("/bin/sh");
                
                let shell_cstr = CString::new(shell).unwrap();
                let c_flag = CString::new("-c").unwrap();
                
                // Build full command string
                let full_command = if params.args.is_empty() {
                    params.command.clone()
                } else {
                    format!("{} {}", params.command, params.args.join(" "))
                };
                let cmd_cstr = CString::new(full_command).unwrap();

                let exec_args = [
                    shell_cstr.clone(),
                    c_flag,
                    cmd_cstr,
                ];

                let _ = execvp(&shell_cstr, &exec_args);
                
                // If execvp returns, it failed
                std::process::exit(1);
            }
            Err(e) => {
                let _ = close(slave_fd);
                return Err(format!("fork failed: {}", e));
            }
        };

        // Forget the OwnedFd to prevent it from closing the fd
        std::mem::forget(master);
        std::mem::forget(slave);

        // Create shutdown channel
        let (shutdown_tx, mut shutdown_rx) = mpsc::channel::<()>(1);

        let pty_handle = PtyHandle {
            pty_id: pty_id.clone(),
            master_fd,
            pid,
            cols: 80,
            rows: 24,
            shutdown_tx: Some(shutdown_tx),
        };

        let pid_u32 = pid.as_raw() as u32;

        // Store the handle
        {
            let mut ptys = self.ptys.write().await;
            ptys.insert(pty_id.clone(), pty_handle);
        }

        // Spawn reader task
        let pty_id_clone = pty_id.clone();
        let data_tx = self.data_tx.clone();
        let exit_tx = self.exit_tx.clone();
        let ptys = self.ptys.clone();

        tokio::spawn(async move {
            loop {
                tokio::select! {
                    _ = shutdown_rx.recv() => {
                        break;
                    }
                    result = tokio::task::spawn_blocking({
                        let master_fd = master_fd;
                        move || {
                            // Use poll with timeout for non-blocking read
                            unsafe {
                                let mut pfd = libc::pollfd {
                                    fd: master_fd,
                                    events: libc::POLLIN,
                                    revents: 0,
                                };
                                let ret = libc::poll(&mut pfd, 1, 100); // 100ms timeout
                                if ret > 0 && (pfd.revents & libc::POLLIN) != 0 {
                                    let mut buf = [0u8; 4096];
                                    let n = libc::read(master_fd, buf.as_mut_ptr() as *mut libc::c_void, buf.len());
                                    if n > 0 {
                                        Some(buf[..n as usize].to_vec())
                                    } else {
                                        None // EOF or error
                                    }
                                } else if ret < 0 {
                                    None // Error
                                } else {
                                    Some(vec![]) // Timeout, no data
                                }
                            }
                        }
                    }) => {
                        match result {
                            Ok(Some(data)) if !data.is_empty() => {
                                let event = TerminalDataEvent {
                                    pty_id: pty_id_clone.clone(),
                                    data: String::from_utf8_lossy(&data).to_string(),
                                };
                                if data_tx.send(event).is_err() {
                                    break;
                                }
                            }
                            Ok(Some(_)) => {
                                // Timeout, continue
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

            // Get exit code
            let exit_code = unsafe {
                let mut status: libc::c_int = 0;
                let ret = libc::waitpid(pid.as_raw(), &mut status, libc::WNOHANG);
                if ret > 0 {
                    if libc::WIFEXITED(status) {
                        Some(libc::WEXITSTATUS(status))
                    } else {
                        None
                    }
                } else {
                    None
                }
            };

            // Send exit event
            let _ = exit_tx.send(TerminalExitEvent {
                pty_id: pty_id_clone.clone(),
                exit_code,
            });

            // Remove from ptys
            let mut ptys = ptys.write().await;
            ptys.remove(&pty_id_clone);
        });

        Ok((pty_id, Some(pid_u32)))
    }

    /// Write data to a PTY
    pub async fn write(&self, pty_id: &str, data: &str) -> Result<(), String> {
        let ptys = self.ptys.read().await;
        if let Some(pty) = ptys.get(pty_id) {
            pty.write(data.as_bytes())
        } else {
            Err(format!("PTY {} not found", pty_id))
        }
    }

    /// Resize a PTY
    pub async fn resize(&self, pty_id: &str, cols: u16, rows: u16) -> Result<(), String> {
        let mut ptys = self.ptys.write().await;
        if let Some(pty) = ptys.get_mut(pty_id) {
            pty.resize(cols, rows)
        } else {
            Err(format!("PTY {} not found", pty_id))
        }
    }

    /// Kill a PTY process
    pub async fn kill(&self, pty_id: &str) -> Result<(), String> {
        let ptys = self.ptys.read().await;
        if let Some(pty) = ptys.get(pty_id) {
            pty.kill()
        } else {
            Err(format!("PTY {} not found", pty_id))
        }
    }

    /// Force kill a PTY process
    pub async fn force_kill(&self, pty_id: &str) -> Result<(), String> {
        let ptys = self.ptys.read().await;
        if let Some(pty) = ptys.get(pty_id) {
            pty.force_kill()
        } else {
            Err(format!("PTY {} not found", pty_id))
        }
    }

    /// Check if a PTY is running
    pub async fn is_running(&self, pty_id: &str) -> bool {
        let ptys = self.ptys.read().await;
        if let Some(pty) = ptys.get(pty_id) {
            pty.is_running()
        } else {
            false
        }
    }

    /// Get process stats for a PTY
    pub async fn get_process_stats(&self, pty_id: &str) -> Option<PtyProcessStats> {
        let ptys = self.ptys.read().await;
        if let Some(pty) = ptys.get(pty_id) {
            // Use sysinfo to get process stats
            use sysinfo::{Pid as SysPid, System};
            
            let mut sys = System::new();
            sys.refresh_processes(sysinfo::ProcessesToUpdate::All, true);
            
            if let Some(process) = sys.process(SysPid::from_u32(pty.pid.as_raw() as u32)) {
                let memory_usage = process.memory();
                Some(PtyProcessStats {
                    pty_id: pty_id.to_string(),
                    pid: pty.pid.as_raw() as u32,
                    cpu_usage: process.cpu_usage(),
                    memory_usage,
                    memory_usage_mb: format!("{:.1}MB", memory_usage as f64 / 1024.0 / 1024.0),
                })
            } else {
                None
            }
        } else {
            None
        }
    }

    /// Get all active PTY IDs
    #[allow(dead_code)]
    pub async fn get_all_pty_ids(&self) -> Vec<String> {
        let ptys = self.ptys.read().await;
        ptys.keys().cloned().collect()
    }

    /// Shutdown all PTYs
    #[allow(dead_code)]
    pub async fn shutdown_all(&self) {
        let mut ptys = self.ptys.write().await;
        for (_, mut pty) in ptys.drain() {
            let _ = pty.force_kill();
            pty.shutdown();
        }
    }
}
