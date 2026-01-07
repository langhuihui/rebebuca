use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::io::{self, BufRead, BufReader, Write};
use std::process::{Command, Stdio};
use std::sync::Arc;
use tokio::sync::Mutex;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "lowercase")]
enum OutputType {
    Stdout,
    Stderr,
    System,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
enum AgentMessage {
    Execute {
        id: String,
        command: String,
        args: Option<Vec<String>>,
        cwd: Option<String>,
        env: Option<HashMap<String, String>>,
    },
    Output {
        id: String,
        output_type: OutputType,
        content: String,
    },
    ProcessStarted {
        id: String,
        pid: u32,
    },
    ProcessFinished {
        id: String,
        exit_code: Option<i32>,
    },
    Error {
        id: String,
        message: String,
    },
    Ping,
    Pong,
}

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
) {
    tokio::spawn(async move {
        let mut cmd = Command::new(&command);
        
        if let Some(args) = args {
            cmd.args(args);
        }
        
        if let Some(cwd) = cwd {
            cmd.current_dir(cwd);
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
                
                // Handle stdout
                if let Some(stdout) = child.stdout.take() {
                    let id_clone = id.clone();
                    tokio::spawn(async move {
                        let reader = BufReader::new(stdout);
                        for line in reader.lines() {
                            if let Ok(line) = line {
                                let _ = send_message(&AgentMessage::Output {
                                    id: id_clone.clone(),
                                    output_type: OutputType::Stdout,
                                    content: format!("{}\n", line),
                                });
                            }
                        }
                    });
                }
                
                // Handle stderr
                if let Some(stderr) = child.stderr.take() {
                    let id_clone = id.clone();
                    tokio::spawn(async move {
                        let reader = BufReader::new(stderr);
                        for line in reader.lines() {
                            if let Ok(line) = line {
                                let _ = send_message(&AgentMessage::Output {
                                    id: id_clone.clone(),
                                    output_type: OutputType::Stderr,
                                    content: format!("{}\n", line),
                                });
                            }
                        }
                    });
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
}

#[tokio::main]
async fn main() {
    eprintln!("Rebebuca Remote Agent started");
    
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
                                execute_command(id, command, args, cwd, env);
                            }
                            AgentMessage::Ping => {
                                let _ = send_message(&AgentMessage::Pong);
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
    
    eprintln!("Rebebuca Remote Agent stopped");
}
