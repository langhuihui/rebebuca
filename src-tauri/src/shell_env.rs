/// Shell environment utilities
/// 
/// This module provides functionality to load environment variables from a login shell.
/// This is crucial for macOS and Linux GUI apps which don't inherit shell PATH.

use std::collections::HashMap;
use std::process::{Command, Stdio};
use std::sync::OnceLock;

/// Global cache for shell environment variables
/// This prevents repeated permission dialogs on macOS when accessing user folders
#[cfg(not(target_os = "windows"))]
static SHELL_ENV_CACHE: OnceLock<HashMap<String, String>> = OnceLock::new();

/// Get shell environment variables by running a login shell
/// This is crucial for macOS and Linux GUI apps which don't inherit shell PATH
/// The result is cached to prevent repeated permission dialogs on macOS
#[cfg(not(target_os = "windows"))]
pub fn get_shell_env() -> HashMap<String, String> {
    // Return cached environment if available
    // This prevents repeated macOS permission dialogs when shell profile
    // accesses protected directories (Documents, Desktop, etc.)
    SHELL_ENV_CACHE.get_or_init(|| {
        let shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/bash".to_string());
        let mut env_map = HashMap::new();
        
        // Try to get environment from a login shell
        // Use -l for login shell (but NOT -i to avoid interactive prompts and reduce permission requests)
        let result = Command::new(&shell)
            .args(["-l", "-c", "env"])
            .stdin(Stdio::null())
            .stdout(Stdio::piped())
            .stderr(Stdio::null())
            .output();
        
        if let Ok(output) = result {
            if output.status.success() {
                let stdout = String::from_utf8_lossy(&output.stdout);
                for line in stdout.lines() {
                    // Use splitn to handle values that contain '=' characters
                    // e.g., VAR=key=value should parse as key='VAR' value='key=value'
                    if let Some((key, value)) = line.split_once('=') {
                        env_map.insert(key.to_string(), value.to_string());
                    }
                }
                println!("[SHELL_ENV] Loaded {} environment variables from login shell (cached)", env_map.len());
            }
        }
        
        // If we couldn't get env from shell, use basic fallback
        if env_map.is_empty() || !env_map.contains_key("PATH") {
            let default_path = "/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin";
            let current_path = std::env::var("PATH").unwrap_or_default();
            let combined_path = if current_path.is_empty() {
                default_path.to_string()
            } else {
                format!("{}:{}", current_path, default_path)
            };
            env_map.insert("PATH".to_string(), combined_path.clone());
            println!("[SHELL_ENV] Using fallback PATH: {}", combined_path);
        }
        
        env_map
    }).clone()
}

#[cfg(target_os = "windows")]
pub fn get_shell_env() -> HashMap<String, String> {
    // On Windows, environment is usually correctly inherited from parent process
    // Return empty map - we'll rely on the process's inherited environment
    HashMap::new()
}
