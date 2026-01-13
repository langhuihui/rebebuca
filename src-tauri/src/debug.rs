use std::fs;
use std::path::PathBuf;
use std::sync::OnceLock;
use tauri::Manager;

// Store app startup time to filter logs from current session
static APP_STARTUP_TIME: OnceLock<std::time::SystemTime> = OnceLock::new();

/// Initialize app startup time (should be called during app setup)
pub fn init_startup_time() {
    APP_STARTUP_TIME.set(std::time::SystemTime::now()).ok();
}

/// Debug API response structure
#[derive(serde::Serialize)]
pub struct DebugApiResponse {
    pub success: bool,
    pub data: serde_json::Value,
    pub error: Option<String>,
}

/// Get frontend logs (passed from frontend)
#[tauri::command]
pub async fn get_frontend_logs(logs: Vec<serde_json::Value>) -> Result<DebugApiResponse, String> {
    Ok(DebugApiResponse {
        success: true,
        data: serde_json::json!(logs),
        error: None,
    })
}

/// Get Tauri logs from current session (since app startup)
/// Returns logs from the most recent log file
#[tauri::command]
pub async fn get_tauri_logs(app_handle: tauri::AppHandle) -> Result<DebugApiResponse, String> {
    let app_log_dir = app_handle
        .path()
        .app_log_dir()
        .map_err(|e| format!("Failed to get app log directory: {}", e))?;
    
    if !app_log_dir.exists() {
        return Ok(DebugApiResponse {
            success: true,
            data: serde_json::json!([]),
            error: None,
        });
    }
    
    // List all log files
    let mut log_files: Vec<(PathBuf, std::time::SystemTime)> = Vec::new();
    
    let entries = fs::read_dir(&app_log_dir)
        .map_err(|e| format!("Failed to read log directory: {}", e))?;
    
    for entry in entries {
        if let Ok(entry) = entry {
            let path = entry.path();
            if path.is_file() {
                if let Some(filename) = path.file_name() {
                    let filename = filename.to_string_lossy();
                    if filename.ends_with(".log") {
                        if let Ok(metadata) = fs::metadata(&path) {
                            if let Ok(modified) = metadata.modified() {
                                log_files.push((path, modified));
                            }
                        }
                    }
                }
            }
        }
    }
    
    // Sort by modified time (newest first)
    log_files.sort_by(|a, b| b.1.cmp(&a.1));
    
    // Get the most recent log file
    if let Some((log_path, file_modified)) = log_files.first() {
        let content = fs::read_to_string(log_path)
            .map_err(|e| format!("Failed to read log file: {}", e))?;
        
        // Parse log lines
        let all_lines: Vec<String> = content.lines().map(|s| s.to_string()).collect();
        
        // Filter lines from current session (after app startup)
        let startup_time = APP_STARTUP_TIME.get().copied().unwrap_or_else(|| {
            // If startup time not set, use file modified time minus 1 hour as fallback
            file_modified.checked_sub(std::time::Duration::from_secs(3600))
                .unwrap_or(*file_modified)
        });
        
        // Try to parse timestamps from log lines and filter
        // Log format is typically: [YYYY-MM-DD HH:MM:SS.mmm] [LEVEL] message
        let mut session_lines: Vec<String> = Vec::new();
        let mut found_startup = false;
        
        for line in &all_lines {
            // Try to extract timestamp from log line
            // Format: [YYYY-MM-DD HH:MM:SS.mmm] or similar
            if let Some(timestamp_str) = extract_timestamp_from_log_line(line) {
                if let Ok(log_time) = parse_log_timestamp(&timestamp_str) {
                    if log_time >= startup_time {
                        found_startup = true;
                        session_lines.push(line.clone());
                    } else if found_startup {
                        // If we've already found startup logs, continue adding
                        session_lines.push(line.clone());
                    }
                } else if found_startup {
                    // If we can't parse timestamp but we've started collecting, include it
                    session_lines.push(line.clone());
                }
            } else if found_startup {
                // If we can't extract timestamp but we've started collecting, include it
                session_lines.push(line.clone());
            } else {
                // If file was modified after startup, assume all lines are from current session
                if *file_modified >= startup_time {
                    session_lines.push(line.clone());
                }
            }
        }
        
        // If no lines matched, but file is recent, return all lines
        if session_lines.is_empty() && *file_modified >= startup_time {
            session_lines = all_lines.clone();
        }
        
        Ok(DebugApiResponse {
            success: true,
            data: serde_json::json!({
                "filename": log_path.file_name().and_then(|n| n.to_str()).unwrap_or("unknown"),
                "lines": session_lines,
                "line_count": session_lines.len(),
                "total_lines": all_lines.len(),
            }),
            error: None,
        })
    } else {
        Ok(DebugApiResponse {
            success: true,
            data: serde_json::json!({
                "filename": null,
                "lines": [],
                "line_count": 0,
            }),
            error: None,
        })
    }
}

/// Get DOM tree information (passed from frontend)
#[tauri::command]
pub async fn get_dom_tree(dom_info: serde_json::Value) -> Result<DebugApiResponse, String> {
    Ok(DebugApiResponse {
        success: true,
        data: dom_info,
        error: None,
    })
}

/// Get all debug information (frontend logs, Tauri logs, DOM tree)
#[tauri::command]
pub async fn get_all_debug_info(
    app_handle: tauri::AppHandle,
    frontend_logs: Vec<serde_json::Value>,
    dom_info: serde_json::Value,
) -> Result<DebugApiResponse, String> {
    // Get Tauri logs
    let tauri_logs_result = get_tauri_logs(app_handle).await;
    let tauri_logs = match tauri_logs_result {
        Ok(response) => response.data,
        Err(e) => serde_json::json!({
            "error": e,
            "lines": [],
        }),
    };
    
    Ok(DebugApiResponse {
        success: true,
        data: serde_json::json!({
            "frontend_logs": frontend_logs,
            "tauri_logs": tauri_logs,
            "dom_tree": dom_info,
            "timestamp": chrono::Local::now().to_rfc3339(),
        }),
        error: None,
    })
}

/// Extract timestamp string from log line
/// Supports formats like: [2025-01-15 10:30:45.123] or [2025-01-15T10:30:45.123Z]
fn extract_timestamp_from_log_line(line: &str) -> Option<String> {
    // Look for timestamp in brackets at the start: [YYYY-MM-DD HH:MM:SS.mmm]
    if let Some(start) = line.find('[') {
        if let Some(end) = line[start + 1..].find(']') {
            let timestamp = &line[start + 1..start + 1 + end];
            // Check if it looks like a timestamp (contains date and time)
            if timestamp.contains('-') && (timestamp.contains(':') || timestamp.contains('T')) {
                return Some(timestamp.to_string());
            }
        }
    }
    None
}

/// Parse log timestamp string to SystemTime
/// Supports formats like: "2025-01-15 10:30:45.123" or "2025-01-15T10:30:45.123Z"
fn parse_log_timestamp(timestamp_str: &str) -> Result<std::time::SystemTime, ()> {
    // Try parsing with chrono
    // Remove milliseconds if present for simpler parsing
    let cleaned = timestamp_str
        .replace('T', " ")
        .replace('Z', "")
        .trim()
        .to_string();
    
    // Try different formats
    let formats = [
        "%Y-%m-%d %H:%M:%S%.f",
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%d %H:%M",
    ];
    
    for format in &formats {
        if let Ok(dt) = chrono::NaiveDateTime::parse_from_str(&cleaned, format) {
            let local_result = dt.and_local_timezone(chrono::Local);
            if let chrono::LocalResult::Single(datetime) = local_result {
                return Ok(datetime.into());
            } else if let chrono::LocalResult::Ambiguous(datetime, _) = local_result {
                return Ok(datetime.into());
            }
        }
    }
    
    Err(())
}

/// Update frontend logs in MCP server cache
#[tauri::command]
pub async fn mcp_update_frontend_logs(
    app_handle: tauri::AppHandle,
    logs: Vec<serde_json::Value>,
) -> Result<(), String> {
    use tauri::Manager;
    if let Some(state) = app_handle.try_state::<crate::mcp_http_server::MCPServerState>() {
        crate::mcp_http_server::update_frontend_logs(&state, logs).await;
        Ok(())
    } else {
        Err("MCP server not running".to_string())
    }
}

/// Update DOM tree in MCP server cache
#[tauri::command]
pub async fn mcp_update_dom_tree(
    app_handle: tauri::AppHandle,
    dom_info: serde_json::Value,
) -> Result<(), String> {
    use tauri::Manager;
    if let Some(state) = app_handle.try_state::<crate::mcp_http_server::MCPServerState>() {
        crate::mcp_http_server::update_dom_tree(&state, dom_info).await;
        Ok(())
    } else {
        Err("MCP server not running".to_string())
    }
}
