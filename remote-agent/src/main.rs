use rebebuca_common::{AgentMessage, OutputType};
use std::collections::HashMap;
use std::io::{self, BufRead, BufReader, Write};
use std::process::{Command, Stdio};
use std::sync::{Arc, Mutex};
use std::thread::JoinHandle;

// Agent version - update this when making changes
const AGENT_VERSION: &str = "0.1.1";

fn send_message(msg: &AgentMessage) -> io::Result<()> {
    let json = serde_json::to_string(msg)?;
    println!("{}", json);
    io::stdout().flush()?;
    Ok(())
}

fn execute_command(
    id: String,
    command: String,
    args: Option<Vec<String>>,
    cwd: Option<String>,
    env: Option<HashMap<String, String>>,
    running_tasks: Arc<Mutex<Vec<JoinHandle<()>>>>,
) {
    let handle = std::thread::spawn(move || {
        // Build the full command string
        let full_command = if let Some(args) = &args {
            if args.is_empty() {
                command.clone()
            } else {
                format!("{} {}", command, args.join(" "))
            }
        } else {
            command.clone()
        };
        
        // Use absolute path /bin/sh to execute the command
        // This is necessary because the agent runs without PATH set
        let mut cmd = Command::new("/bin/sh");
        cmd.arg("-c").arg(&full_command);
        
        // Only set current_dir if cwd is Some and not empty
        if let Some(ref cwd_path) = cwd {
            if !cwd_path.is_empty() {
                cmd.current_dir(cwd_path);
            }
        }
        
        if let Some(env) = env {
            for (key, value) in env {
                cmd.env(key, value);
            }
        }
        
        cmd.stdout(Stdio::piped())
            .stderr(Stdio::piped());
        
        match cmd.spawn() {
            Ok(mut child) => {
                let pid = child.id();
                
                let _ = send_message(&AgentMessage::ProcessStarted {
                    id: id.clone(),
                    pid,
                });
                
                // Read stdout in a separate thread
                let stdout_id = id.clone();
                let stdout_handle = if let Some(stdout) = child.stdout.take() {
                    Some(std::thread::spawn(move || {
                        let reader = BufReader::new(stdout);
                        for line in reader.lines() {
                            if let Ok(line) = line {
                                let _ = send_message(&AgentMessage::Output {
                                    id: stdout_id.clone(),
                                    output_type: OutputType::Stdout,
                                    content: format!("{}\n", line),
                                });
                            }
                        }
                    }))
                } else {
                    None
                };
                
                // Read stderr in a separate thread
                let stderr_id = id.clone();
                let stderr_handle = if let Some(stderr) = child.stderr.take() {
                    Some(std::thread::spawn(move || {
                        let reader = BufReader::new(stderr);
                        for line in reader.lines() {
                            if let Ok(line) = line {
                                let _ = send_message(&AgentMessage::Output {
                                    id: stderr_id.clone(),
                                    output_type: OutputType::Stderr,
                                    content: format!("{}\n", line),
                                });
                            }
                        }
                    }))
                } else {
                    None
                };
                
                // Wait for output threads to finish
                if let Some(handle) = stdout_handle {
                    let _ = handle.join();
                }
                if let Some(handle) = stderr_handle {
                    let _ = handle.join();
                }
                
                // Wait for process to finish
                match child.wait() {
                    Ok(status) => {
                        let _ = send_message(&AgentMessage::ProcessFinished {
                            id: id.clone(),
                            exit_code: status.code(),
                        });
                    }
                    Err(e) => {
                        let _ = send_message(&AgentMessage::Error {
                            id: id.clone(),
                            message: format!("Failed to wait for process: {}", e),
                        });
                    }
                }
            }
            Err(e) => {
                let _ = send_message(&AgentMessage::Error {
                    id: id.clone(),
                    message: format!("Failed to spawn process: {}", e),
                });
            }
        }
    });
    
    // Store the handle so we can wait for it later
    running_tasks.lock().unwrap().push(handle);
}

#[tokio::main]
async fn main() {
    eprintln!("Rebebuca Remote Agent started");
    
    // Track running tasks so we can wait for them before exiting
    let running_tasks: Arc<Mutex<Vec<JoinHandle<()>>>> = Arc::new(Mutex::new(Vec::new()));
    
    let stdin = io::stdin();
    let reader = BufReader::new(stdin);
    
    for line in reader.lines() {
        match line {
            Ok(line) => {
                if line.trim().is_empty() {
                    continue;
                }
                
                match serde_json::from_str::<AgentMessage>(&line) {
                    Ok(msg) => {
                        match msg {
                            AgentMessage::Execute { id, command, args, cwd, env } => {
                                execute_command(id, command, args, cwd, env, running_tasks.clone());
                            }
                            AgentMessage::Ping => {
                                let _ = send_message(&AgentMessage::Pong);
                            }
                            AgentMessage::GetVersion => {
                                let _ = send_message(&AgentMessage::Version {
                                    version: AGENT_VERSION.to_string(),
                                });
                            }
                            _ => {
                                eprintln!("Unexpected message from client");
                            }
                        }
                    }
                    Err(e) => {
                        eprintln!("Failed to parse message: {}", e);
                    }
                }
            }
            Err(e) => {
                eprintln!("Error reading from stdin: {}", e);
                break;
            }
        }
    }
    
    // Wait for all running tasks to complete before exiting
    let handles: Vec<JoinHandle<()>> = {
        let mut tasks = running_tasks.lock().unwrap();
        std::mem::take(&mut *tasks)
    };
    
    for handle in handles {
        let _ = handle.join();
    }
    
    eprintln!("Rebebuca Remote Agent stopped");
}
