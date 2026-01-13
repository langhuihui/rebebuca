//! MCP Server Process Manager - DEPRECATED
//!
//! This module was used to spawn an external Node.js MCP server process.
//! It has been replaced by mcp_http_server.rs which implements the MCP server
//! directly in Rust within the Tauri application.
//!
//! This file is kept for reference only and is no longer used.

#![allow(dead_code)]
#![allow(unused_imports)]

use std::process::Stdio;
use tokio::process::Command;
use log::{info, warn};
use tauri::Manager;

/// MCP Server process handle
pub struct MCPServer {
    child: Option<tokio::process::Child>,
}

impl MCPServer {
    pub fn new() -> Self {
        Self { child: None }
    }

    /// Start the MCP debug server
    pub async fn start(&mut self, app_handle: &tauri::AppHandle) -> Result<(), String> {
        // Only start in dev mode
        #[cfg(debug_assertions)]
        {
            // Get the project root directory
            // In dev mode, we can use the current working directory or find the script relative to the binary
            let mut script_path = std::env::current_dir().unwrap_or_else(|_| std::path::PathBuf::from("."));
            
            // First, try current working directory (most common in dev)
            let potential_script = script_path.join("scripts").join("mcp-debug-server-http.js");
            if potential_script.exists() {
                info!("[MCP] Found script at: {:?}", potential_script);
                return self.start_server(&potential_script).await;
            }
            
            // Try to find from resource dir (for when running from target/debug)
            if let Ok(resource_dir) = app_handle.path().resource_dir() {
                let mut search_path = resource_dir.clone();
                // Go up: resources -> debug -> target -> src-tauri -> project root
                for _ in 0..5 {
                    let potential_script = search_path.join("scripts").join("mcp-debug-server-http.js");
                    if potential_script.exists() {
                        info!("[MCP] Found script at: {:?}", potential_script);
                        return self.start_server(&potential_script).await;
                    }
                    if let Some(parent) = search_path.parent() {
                        search_path = parent.to_path_buf();
                    } else {
                        break;
                    }
                }
            }
            
            // Alternative: try to find node and use absolute path
            // Get the current executable path and work from there
            if let Ok(exe_path) = std::env::current_exe() {
                let mut search_path = exe_path.parent().unwrap().to_path_buf();
                for _ in 0..6 {
                    let potential_script = search_path.join("scripts").join("mcp-debug-server-http.js");
                    if potential_script.exists() {
                        info!("[MCP] Found script at: {:?}", potential_script);
                        return self.start_server(&potential_script).await;
                    }
                    if let Some(parent) = search_path.parent() {
                        search_path = parent.to_path_buf();
                    } else {
                        break;
                    }
                }
            }
            
            // Last resort: try to find node in PATH and use a relative path
            // This assumes the script is in a known location relative to the binary
            warn!("[MCP] Could not find script path automatically, trying with node from PATH");
            
            // Try to find node
            let node_path = which_node().await;
            if let Some(node) = node_path {
                // Try to use a path relative to where we think the project might be
                // This is a fallback and may not work in all cases
                let script_arg = "../../scripts/mcp-debug-server-http.js";
                return self.start_with_node(&node, script_arg).await;
            }
            
            Err("Could not find MCP server script or Node.js".to_string())
        }
        
        #[cfg(not(debug_assertions))]
        {
            info!("[MCP] Skipping MCP server start (release build)");
            Ok(())
        }
    }

    async fn start_server(&mut self, script_path: &std::path::Path) -> Result<(), String> {
        let node_path = which_node().await.ok_or_else(|| "Node.js not found in PATH".to_string())?;
        
        info!("[MCP] Starting MCP debug server: {:?}", script_path);
        
        let mut cmd = Command::new(&node_path);
        cmd.arg(script_path.to_string_lossy().as_ref());
        cmd.arg("3001"); // Default port
        cmd.stdout(Stdio::null()); // Suppress output
        cmd.stderr(Stdio::null());
        cmd.stdin(Stdio::null());
        
        // Don't create a new process group on Windows
        #[cfg(not(target_os = "windows"))]
        {
            use std::os::unix::process::CommandExt;
            cmd.process_group(0);
        }
        
        let child = cmd.spawn().map_err(|e| format!("Failed to spawn MCP server: {}", e))?;
        
        self.child = Some(child);
        
        // Give it a moment to start
        tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;
        
        info!("[MCP] MCP debug server started on http://127.0.0.1:3001/mcp/sse");
        
        Ok(())
    }

    async fn start_with_node(&mut self, node_path: &str, script_arg: &str) -> Result<(), String> {
        info!("[MCP] Starting MCP debug server with node: {}", node_path);
        
        let mut cmd = Command::new(node_path);
        cmd.arg(script_arg);
        cmd.arg("3001");
        cmd.stdout(Stdio::null());
        cmd.stderr(Stdio::null());
        cmd.stdin(Stdio::null());
        
        #[cfg(not(target_os = "windows"))]
        {
            use std::os::unix::process::CommandExt;
            cmd.process_group(0);
        }
        
        let child = cmd.spawn().map_err(|e| format!("Failed to spawn MCP server: {}", e))?;
        
        self.child = Some(child);
        
        tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;
        
        info!("[MCP] MCP debug server started on http://127.0.0.1:3001/mcp/sse");
        
        Ok(())
    }

    /// Stop the MCP server
    pub async fn stop(&mut self) {
        if let Some(mut child) = self.child.take() {
            info!("[MCP] Stopping MCP debug server");
            let _ = child.kill().await;
            let _ = child.wait().await;
            info!("[MCP] MCP debug server stopped");
        }
    }
}

impl Drop for MCPServer {
    fn drop(&mut self) {
        // Try to stop on drop, but we can't use async here
        // So we'll just log a warning
        if self.child.is_some() {
            warn!("[MCP] MCP server process still running on drop");
        }
    }
}

/// Find node executable in PATH
async fn which_node() -> Option<String> {
    #[cfg(target_os = "windows")]
    {
        // On Windows, try common locations
        let common_paths = [
            "node.exe",
            "C:\\Program Files\\nodejs\\node.exe",
            "C:\\Program Files (x86)\\nodejs\\node.exe",
        ];
        
        for path in &common_paths {
            if std::path::Path::new(path).exists() {
                return Some(path.to_string());
            }
        }
        
        // Try to find in PATH
        if let Ok(output) = Command::new("where").arg("node").output().await {
            if output.status.success() {
                let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
                if !path.is_empty() {
                    return Some(path);
                }
            }
        }
    }
    
    #[cfg(not(target_os = "windows"))]
    {
        // On Unix, try which/whereis
        if let Ok(output) = Command::new("which").arg("node").output().await {
            if output.status.success() {
                let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
                if !path.is_empty() {
                    return Some(path);
                }
            }
        }
    }
    
    None
}
