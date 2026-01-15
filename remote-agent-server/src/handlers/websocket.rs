//! WebSocket handler for real-time communication

use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        Query, State,
    },
    response::IntoResponse,
};
use futures::{SinkExt, StreamExt};
use serde::Deserialize;
use tokio::sync::mpsc;
use uuid::Uuid;

use super::http::AppState;
use crate::protocol::{
    CreateTerminalParams, ExistsParams, MkdirParams, OutgoingMessage, ReadDirParams,
    ReadFileParams, RemoveParams, Request, Response, StatParams, StorageDeleteParams,
    StorageGetParams, StorageSetParams, TerminalKillParams,
    TerminalResizeParams, TerminalWriteParams, WriteFileParams,
};

/// Query parameters for WebSocket connection
#[derive(Debug, Deserialize)]
pub struct WsParams {
    /// Client ID (optional, will be generated if not provided)
    pub client_id: Option<String>,
}

/// WebSocket handler
pub async fn ws_handler(
    ws: WebSocketUpgrade,
    Query(params): Query<WsParams>,
    State(state): State<AppState>,
) -> impl IntoResponse {
    let client_id = params
        .client_id
        .unwrap_or_else(|| format!("client-{}", Uuid::new_v4()));

    ws.on_upgrade(move |socket| handle_websocket(socket, client_id, state))
}

/// Handle a WebSocket connection
async fn handle_websocket(socket: WebSocket, client_id: String, state: AppState) {
    tracing::info!("WebSocket connected: {}", client_id);

    // Create session
    {
        let mut table = state.connection_table.write().await;
        table.create_session(client_id.clone());
    }

    // Split the socket
    let (mut ws_sender, mut ws_receiver) = socket.split();

    // Create channel for outgoing messages
    let (tx, mut rx) = mpsc::unbounded_channel::<OutgoingMessage>();

    // Store sender in connection table
    {
        let mut table = state.connection_table.write().await;
        table.set_ws_sender(&client_id, tx.clone());
    }

    // Spawn task to forward terminal events to this client
    let _client_id_clone = client_id.clone();
    let _connection_table = state.connection_table.clone();
    let _terminal_data_tx = state.terminal_data_tx.clone();
    let _terminal_exit_tx = state.terminal_exit_tx.clone();

    // Spawn task to send outgoing messages
    let send_task = tokio::spawn(async move {
        while let Some(msg) = rx.recv().await {
            let json = serde_json::to_string(&msg).unwrap_or_default();
            if ws_sender.send(Message::Text(json.into())).await.is_err() {
                break;
            }
        }
    });

    // Handle incoming messages
    let client_id_for_recv = client_id.clone();
    let state_for_recv = state.clone();
    let tx_for_recv = tx.clone();

    while let Some(result) = ws_receiver.next().await {
        match result {
            Ok(Message::Text(text)) => {
                // Parse request
                match serde_json::from_str::<Request>(&text) {
                    Ok(request) => {
                        let response =
                            handle_request(&client_id_for_recv, request, &state_for_recv).await;
                        let _ = tx_for_recv.send(OutgoingMessage::Response(response));
                    }
                    Err(e) => {
                        tracing::error!("Failed to parse request: {}", e);
                    }
                }
            }
            Ok(Message::Binary(data)) => {
                // Binary messages might be terminal input
                tracing::debug!("Received binary message: {} bytes", data.len());
            }
            Ok(Message::Close(_)) => {
                tracing::info!("WebSocket closed: {}", client_id_for_recv);
                break;
            }
            Err(e) => {
                tracing::error!("WebSocket error: {}", e);
                break;
            }
            _ => {}
        }
    }

    // Cleanup
    {
        let mut table = state.connection_table.write().await;

        // Get all PTYs owned by this client and kill them
        let pty_ids: Vec<String> = table.get_client_ptys(&client_id);
        for pty_id in pty_ids.iter() {
            let _ = state.terminal_adapter.kill(pty_id).await;
        }

        table.remove_session(&client_id);
    }

    // Abort send task
    send_task.abort();

    tracing::info!("WebSocket cleanup complete: {}", client_id);
}

/// Handle a single request
async fn handle_request(client_id: &str, request: Request, state: &AppState) -> Response {
    let method = request.method.as_str();
    let id = request.id.clone();

    match method {
        // Terminal methods
        "terminal.create" => {
            match serde_json::from_value::<CreateTerminalParams>(request.params) {
                Ok(params) => match state.terminal_adapter.create(params).await {
                    Ok((pty_id, pid)) => {
                        // Register PTY with client
                        {
                            let mut table = state.connection_table.write().await;
                            table.register_pty(client_id, pty_id.clone());
                        }

                        Response::success(
                            id,
                            serde_json::json!({
                                "ptyId": pty_id,
                                "pid": pid
                            }),
                        )
                    }
                    Err(e) => Response::error(id, e),
                },
                Err(e) => Response::error(id, format!("Invalid params: {}", e)),
            }
        }

        "terminal.write" => match serde_json::from_value::<TerminalWriteParams>(request.params) {
            Ok(params) => match state.terminal_adapter.write(&params.pty_id, &params.data).await {
                Ok(_) => Response::success(id, serde_json::Value::Null),
                Err(e) => Response::error(id, e),
            },
            Err(e) => Response::error(id, format!("Invalid params: {}", e)),
        },

        "terminal.resize" => {
            match serde_json::from_value::<TerminalResizeParams>(request.params) {
                Ok(params) => {
                    match state
                        .terminal_adapter
                        .resize(&params.pty_id, params.cols, params.rows)
                        .await
                    {
                        Ok(_) => Response::success(id, serde_json::Value::Null),
                        Err(e) => Response::error(id, e),
                    }
                }
                Err(e) => Response::error(id, format!("Invalid params: {}", e)),
            }
        }

        "terminal.kill" => match serde_json::from_value::<TerminalKillParams>(request.params) {
            Ok(params) => match state.terminal_adapter.kill(&params.pty_id).await {
                Ok(_) => {
                    // Unregister PTY
                    {
                        let mut table = state.connection_table.write().await;
                        table.unregister_pty(&params.pty_id);
                    }
                    Response::success(id, serde_json::Value::Null)
                }
                Err(e) => Response::error(id, e),
            },
            Err(e) => Response::error(id, format!("Invalid params: {}", e)),
        },

        "terminal.forceKill" => {
            match serde_json::from_value::<TerminalKillParams>(request.params) {
                Ok(params) => match state.terminal_adapter.force_kill(&params.pty_id).await {
                    Ok(_) => {
                        // Unregister PTY
                        {
                            let mut table = state.connection_table.write().await;
                            table.unregister_pty(&params.pty_id);
                        }
                        Response::success(id, serde_json::Value::Null)
                    }
                    Err(e) => Response::error(id, e),
                },
                Err(e) => Response::error(id, format!("Invalid params: {}", e)),
            }
        }

        "terminal.isRunning" => {
            match serde_json::from_value::<TerminalKillParams>(request.params) {
                Ok(params) => {
                    let is_running = state.terminal_adapter.is_running(&params.pty_id).await;
                    Response::success(id, is_running)
                }
                Err(e) => Response::error(id, format!("Invalid params: {}", e)),
            }
        }

        "terminal.getProcessStats" => {
            match serde_json::from_value::<TerminalKillParams>(request.params) {
                Ok(params) => {
                    let stats = state.terminal_adapter.get_process_stats(&params.pty_id).await;
                    Response::success(id, stats)
                }
                Err(e) => Response::error(id, format!("Invalid params: {}", e)),
            }
        }

        // File system methods
        "fs.readTextFile" => match serde_json::from_value::<ReadFileParams>(request.params) {
            Ok(params) => match state.filesystem_adapter.read_text_file(&params.path).await {
                Ok(content) => Response::success(id, content),
                Err(e) => Response::error(id, e),
            },
            Err(e) => Response::error(id, format!("Invalid params: {}", e)),
        },

        "fs.writeTextFile" => match serde_json::from_value::<WriteFileParams>(request.params) {
            Ok(params) => {
                match state
                    .filesystem_adapter
                    .write_text_file(&params.path, &params.content)
                    .await
                {
                    Ok(_) => Response::success(id, serde_json::Value::Null),
                    Err(e) => Response::error(id, e),
                }
            }
            Err(e) => Response::error(id, format!("Invalid params: {}", e)),
        },

        "fs.readDir" => match serde_json::from_value::<ReadDirParams>(request.params) {
            Ok(params) => match state.filesystem_adapter.read_dir(&params.path).await {
                Ok(entries) => Response::success(id, entries),
                Err(e) => Response::error(id, e),
            },
            Err(e) => Response::error(id, format!("Invalid params: {}", e)),
        },

        "fs.exists" => match serde_json::from_value::<ExistsParams>(request.params) {
            Ok(params) => match state.filesystem_adapter.exists(&params.path).await {
                Ok(exists) => Response::success(id, exists),
                Err(e) => Response::error(id, e),
            },
            Err(e) => Response::error(id, format!("Invalid params: {}", e)),
        },

        "fs.stat" => match serde_json::from_value::<StatParams>(request.params) {
            Ok(params) => match state.filesystem_adapter.stat(&params.path).await {
                Ok(info) => Response::success(id, info),
                Err(e) => Response::error(id, e),
            },
            Err(e) => Response::error(id, format!("Invalid params: {}", e)),
        },

        "fs.mkdir" => match serde_json::from_value::<MkdirParams>(request.params) {
            Ok(params) => {
                match state
                    .filesystem_adapter
                    .mkdir(&params.path, params.recursive)
                    .await
                {
                    Ok(_) => Response::success(id, serde_json::Value::Null),
                    Err(e) => Response::error(id, e),
                }
            }
            Err(e) => Response::error(id, format!("Invalid params: {}", e)),
        },

        "fs.remove" => match serde_json::from_value::<RemoveParams>(request.params) {
            Ok(params) => {
                match state
                    .filesystem_adapter
                    .remove(&params.path, params.recursive)
                    .await
                {
                    Ok(_) => Response::success(id, serde_json::Value::Null),
                    Err(e) => Response::error(id, e),
                }
            }
            Err(e) => Response::error(id, format!("Invalid params: {}", e)),
        },

        // System methods
        "system.getPlatform" => {
            Response::success(id, state.system_adapter.get_platform())
        }

        "system.getArch" => {
            Response::success(id, state.system_adapter.get_arch())
        }

        "system.getAvailableShells" => {
            Response::success(id, state.system_adapter.get_available_shells())
        }

        "system.listPorts" => {
            Response::success(id, state.system_adapter.list_ports())
        }

        "system.getHomeDirectory" => {
            Response::success(id, state.system_adapter.get_home_directory())
        }

        "system.generateLogPath" => {
            #[derive(Deserialize)]
            struct Params {
                #[serde(rename = "taskId")]
                task_id: String,
                pid: Option<u32>,
            }
            match serde_json::from_value::<Params>(request.params) {
                Ok(params) => {
                    let info = state.system_adapter.generate_log_path(&params.task_id, params.pid);
                    Response::success(id, info)
                }
                Err(e) => Response::error(id, format!("Invalid params: {}", e)),
            }
        }

        // Storage methods
        // Note: Use fixed user ID "default" for all clients to share storage
        // This ensures tasks and settings persist across browser sessions
        "storage.get" => match serde_json::from_value::<StorageGetParams>(request.params) {
            Ok(params) => {
                let value = state.storage_adapter.get("default", &params.key).await;
                Response::success(id, value)
            }
            Err(e) => Response::error(id, format!("Invalid params: {}", e)),
        },

        "storage.set" => match serde_json::from_value::<StorageSetParams>(request.params) {
            Ok(params) => {
                match state
                    .storage_adapter
                    .set("default", &params.key, params.value)
                    .await
                {
                    Ok(_) => Response::success(id, serde_json::Value::Null),
                    Err(e) => Response::error(id, e),
                }
            }
            Err(e) => Response::error(id, format!("Invalid params: {}", e)),
        },

        "storage.delete" => match serde_json::from_value::<StorageDeleteParams>(request.params) {
            Ok(params) => match state.storage_adapter.delete("default", &params.key).await {
                Ok(_) => Response::success(id, serde_json::Value::Null),
                Err(e) => Response::error(id, e),
            },
            Err(e) => Response::error(id, format!("Invalid params: {}", e)),
        },

        "storage.save" => match state.storage_adapter.save("default").await {
            Ok(_) => Response::success(id, serde_json::Value::Null),
            Err(e) => Response::error(id, e),
        },

        // Updater methods
        "updater.getVersion" => {
            Response::success(id, env!("CARGO_PKG_VERSION"))
        }

        "updater.checkForUpdates" => {
            match check_for_updates().await {
                Ok(result) => Response::success(id, result),
                Err(e) => Response::error(id, e),
            }
        }

        "updater.downloadAndInstall" => {
            match download_and_install_update().await {
                Ok(result) => Response::success(id, result),
                Err(e) => Response::error(id, e),
            }
        }

        _ => Response::error(id, format!("Unknown method: {}", method)),
    }
}

/// Check for updates from the releases server
///
/// Uses a unified version number across platforms, but will only report an update
/// as available when the corresponding remote-agent-server artifact exists.
async fn check_for_updates() -> Result<serde_json::Value, String> {
    const RELEASES_URL: &str = "https://download.m7s.live/rb/releases.json";
    const BASE_URL: &str = "https://download.m7s.live/rb";
    const CURRENT_VERSION: &str = env!("CARGO_PKG_VERSION");

    // Fetch releases data
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

    let response = client
        .get(RELEASES_URL)
        .send()
        .await
        .map_err(|e| format!("Failed to fetch releases: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("Failed to fetch releases: HTTP {}", response.status()));
    }

    let data: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse releases: {}", e))?;

    // Simple releases.json format: { latest, releases }
    let latest_version = data
        .get("latest")
        .and_then(|v| v.as_str())
        .unwrap_or(CURRENT_VERSION);

    let version_newer = compare_versions(latest_version, CURRENT_VERSION) > 0;

    // Default: no update
    let mut available = false;

    // Only claim update is available if the remote-agent-server artifact exists
    if version_newer {
        let os = std::env::consts::OS;
        let arch = std::env::consts::ARCH;

        // We publish remote-agent-server for Linux only
        if os == "linux" {
            let arch_name = match arch {
                "x86_64" => "x86_64",
                "aarch64" => "aarch64",
                _ => "",
            };

            if !arch_name.is_empty() {
                let version_tag = format!("v{}", latest_version);
                let artifact_url = format!(
                    "{}/{}/remote-agent-server/rebebuca-remote-server-linux-{}.tar.gz",
                    BASE_URL,
                    version_tag,
                    arch_name
                );

                // HEAD check
                if let Ok(resp) = client.head(&artifact_url).send().await {
                    available = resp.status().is_success();
                }
            }
        }
    }

    // Get release notes for the latest version
    let notes = if available {
        data.get("releases")
            .and_then(|r| r.as_array())
            .and_then(|arr| arr.first())
            .and_then(|r| r.get("body"))
            .and_then(|b| b.as_str())
            .unwrap_or("")
            .to_string()
    } else {
        String::new()
    };

    Ok(serde_json::json!({
        "available": available,
        "currentVersion": CURRENT_VERSION,
        "latestVersion": latest_version,
        "notes": notes
    }))
}

/// Compare two version strings (semver)
/// Returns: 1 if v1 > v2, -1 if v1 < v2, 0 if equal
fn compare_versions(v1: &str, v2: &str) -> i32 {
    let parse = |v: &str| -> Vec<u32> {
        v.split('.')
            .filter_map(|s| s.parse().ok())
            .collect()
    };

    let parts1 = parse(v1);
    let parts2 = parse(v2);

    for i in 0..parts1.len().max(parts2.len()) {
        let p1 = parts1.get(i).copied().unwrap_or(0);
        let p2 = parts2.get(i).copied().unwrap_or(0);

        if p1 > p2 {
            return 1;
        }
        if p1 < p2 {
            return -1;
        }
    }

    0
}

/// Download and install update, then restart the server
///
/// This downloads the versioned remote-agent-server tarball (no `latest/` directory),
/// extracts it, replaces the current binary and `dist/`, then restarts.
async fn download_and_install_update() -> Result<serde_json::Value, String> {
    const BASE_URL: &str = "https://download.m7s.live/rb";
    const RELEASES_URL: &str = "https://download.m7s.live/rb/releases.json";

    // Only supported on Linux for now
    let os = std::env::consts::OS;
    if os != "linux" {
        return Err(format!("Unsupported OS for remote-agent-server update: {}", os));
    }

    let arch = std::env::consts::ARCH;
    let arch_name = match arch {
        "x86_64" => "x86_64",
        "aarch64" => "aarch64",
        _ => return Err(format!("Unsupported architecture: {}", arch)),
    };

    // Resolve target version from releases.json
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

    let resp = client
        .get(RELEASES_URL)
        .send()
        .await
        .map_err(|e| format!("Failed to fetch releases: {}", e))?;

    if !resp.status().is_success() {
        return Err(format!("Failed to fetch releases: HTTP {}", resp.status()));
    }

    let data: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| format!("Failed to parse releases: {}", e))?;

    let latest_version = data
        .get("latest")
        .and_then(|v| v.as_str())
        .ok_or_else(|| "Missing latest version in releases.json".to_string())?;

    let version_tag = format!("v{}", latest_version);

    // Build tarball URL in version directory
    let download_url = format!(
        "{}/{}/remote-agent-server/rebebuca-remote-server-linux-{}.tar.gz",
        BASE_URL, version_tag, arch_name
    );

    tracing::info!("Downloading update from: {}", download_url);

    // Download tarball
    let dl_client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(300))
        .build()
        .map_err(|e| format!("Failed to create download client: {}", e))?;

    let response = dl_client
        .get(&download_url)
        .send()
        .await
        .map_err(|e| format!("Failed to download update: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("Failed to download update: HTTP {}", response.status()));
    }

    let bytes = response
        .bytes()
        .await
        .map_err(|e| format!("Failed to read update data: {}", e))?;

    // Prepare temp dir
    let tmp_dir = std::env::temp_dir().join(format!("rebebuca-remote-server-update-{}", Uuid::new_v4()));
    tokio::fs::create_dir_all(&tmp_dir)
        .await
        .map_err(|e| format!("Failed to create temp dir: {}", e))?;

    let archive_path = tmp_dir.join("rebebuca-remote-server.tar.gz");
    tokio::fs::write(&archive_path, &bytes)
        .await
        .map_err(|e| format!("Failed to write archive: {}", e))?;

    // Extract archive using system tar
    let status = tokio::process::Command::new("tar")
        .arg("-xzf")
        .arg(&archive_path)
        .arg("-C")
        .arg(&tmp_dir)
        .status()
        .await
        .map_err(|e| format!("Failed to run tar: {}", e))?;

    if !status.success() {
        return Err("Failed to extract archive (tar exited with non-zero status)".to_string());
    }

    let extracted_dir = tmp_dir.join("rebebuca-remote-server");
    let new_bin = extracted_dir.join("rebebuca-remote-server");
    let new_dist = extracted_dir.join("dist");

    if !new_bin.exists() {
        return Err("Extracted archive missing rebebuca-remote-server binary".to_string());
    }

    // Resolve current executable and install dir
    let current_exe = std::env::current_exe()
        .map_err(|e| format!("Failed to get current executable path: {}", e))?;
    let current_exe = std::fs::canonicalize(&current_exe).unwrap_or(current_exe);

    let install_dir = current_exe
        .parent()
        .ok_or_else(|| "Failed to determine install dir".to_string())?
        .to_path_buf();

    // Backup current binary
    let backup_path = current_exe.with_extension("backup");
    if backup_path.exists() {
        let _ = tokio::fs::remove_file(&backup_path).await;
    }

    tokio::fs::rename(&current_exe, &backup_path)
        .await
        .map_err(|e| format!("Failed to backup current binary: {}", e))?;

    // Install new binary
    tokio::fs::copy(&new_bin, &current_exe)
        .await
        .map_err(|e| format!("Failed to copy new binary: {}", e))?;

    // Ensure executable bit
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let mut perms = tokio::fs::metadata(&current_exe)
            .await
            .map_err(|e| format!("Failed to get new binary metadata: {}", e))?
            .permissions();
        perms.set_mode(0o755);
        tokio::fs::set_permissions(&current_exe, perms)
            .await
            .map_err(|e| format!("Failed to set executable permission: {}", e))?;
    }

    // Replace dist/
    if new_dist.exists() {
        let current_dist = install_dir.join("dist");
        if current_dist.exists() {
            let _ = tokio::fs::remove_dir_all(&current_dist).await;
        }

        // Try rename first; fall back to cp -r if needed
        match tokio::fs::rename(&new_dist, &current_dist).await {
            Ok(_) => {}
            Err(_) => {
                let status = tokio::process::Command::new("cp")
                    .arg("-r")
                    .arg(&new_dist)
                    .arg(&current_dist)
                    .status()
                    .await
                    .map_err(|e| format!("Failed to copy dist via cp: {}", e))?;
                if !status.success() {
                    return Err("Failed to install dist assets".to_string());
                }
            }
        }
    }

    tracing::info!("Update installed successfully, scheduling restart...");

    // Schedule restart
    tokio::spawn(async move {
        tokio::time::sleep(std::time::Duration::from_secs(1)).await;

        let args: Vec<String> = std::env::args().collect();
        match std::process::Command::new(&current_exe).args(&args[1..]).spawn() {
            Ok(_) => {
                tracing::info!("New process started, exiting current process...");
                std::process::exit(0);
            }
            Err(e) => {
                tracing::error!("Failed to start new process: {}", e);
                let _ = std::fs::rename(&backup_path, &current_exe);
            }
        }
    });

    Ok(serde_json::json!({
        "success": true,
        "message": "Update installed, server will restart shortly"
    }))
}
