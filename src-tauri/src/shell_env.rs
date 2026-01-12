/// Shell environment utilities
///
/// This module provides functionality to load environment variables from a login shell.
/// This is crucial for macOS and Linux GUI apps which don't inherit shell PATH.

use std::collections::HashMap;

/// Global cache for shell environment variables
/// This prevents repeated permission dialogs on macOS when accessing user folders
#[cfg(not(target_os = "windows"))]
static SHELL_ENV_CACHE: std::sync::OnceLock<HashMap<String, String>> = std::sync::OnceLock::new();

/// Try to load environment from shell with given arguments
#[cfg(not(target_os = "windows"))]
fn try_load_env_from_shell(shell: &str, args: &[&str]) -> Option<HashMap<String, String>> {
    let result = std::process::Command::new(shell)
        .args(args)
        .stdin(std::process::Stdio::null())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::null())
        .output();
    
    if let Ok(output) = result {
        if output.status.success() {
            let mut env_map = HashMap::new();
            let stdout = String::from_utf8_lossy(&output.stdout);
            for line in stdout.lines() {
                // Use split_once to handle values that contain '=' characters
                // e.g., VAR=key=value should parse as key='VAR' value='key=value'
                if let Some((key, value)) = line.split_once('=') {
                    // Skip shell internal variables that can cause issues
                    if !key.starts_with('_') && !key.is_empty() {
                        env_map.insert(key.to_string(), value.to_string());
                    }
                }
            }
            if env_map.contains_key("PATH") && !env_map.get("PATH").map_or(true, |p| p.is_empty()) {
                return Some(env_map);
            }
        }
    }
    None
}

/// Get shell environment variables by running a login/interactive shell
/// This is crucial for macOS and Linux GUI apps which don't inherit shell PATH
/// The result is cached to prevent repeated permission dialogs on macOS
#[cfg(not(target_os = "windows"))]
pub fn get_shell_env() -> HashMap<String, String> {
    // Return cached environment if available
    // This prevents repeated macOS permission dialogs when shell profile
    // accesses protected directories (Documents, Desktop, etc.)
    SHELL_ENV_CACHE.get_or_init(|| {
        let shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/zsh".to_string());
        let shell_name = std::path::Path::new(&shell)
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("bash");
        
        println!("[SHELL_ENV] Attempting to load environment from shell: {} ({})", shell, shell_name);
        
        // Load environment using a SINGLE shell invocation to avoid multiple TCC permission dialogs.
        // On macOS, each shell invocation that loads .zshrc/.bashrc may trigger a permission dialog
        // if the shell config accesses protected directories (Downloads, Desktop, etc.)
        //
        // We use login+interactive shell (-l -i) which is the most complete, loading:
        // - For zsh: .zshenv, .zprofile, .zshrc, .zlogin
        // - For bash: .bash_profile/.profile and .bashrc
        // This ensures tools like nvm, rbenv, pyenv etc. are properly initialized.
        
        let mut env_map = try_load_env_from_shell(&shell, &["-l", "-i", "-c", "env"]);
        if env_map.is_some() {
            println!("[SHELL_ENV] Loaded environment using interactive login shell (-l -i)");
        } else {
            println!("[SHELL_ENV] Failed to load environment from shell, will use fallback paths");
        }
        
        // Fallback: /etc/paths and /etc/paths.d (macOS specific, no permission issues)
        #[cfg(target_os = "macos")]
        if env_map.is_none() || env_map.as_ref().map_or(true, |m| !m.contains_key("PATH")) {
            let mut macos_path = String::new();
            
            // Read /etc/paths
            if let Ok(paths) = std::fs::read_to_string("/etc/paths") {
                for line in paths.lines() {
                    let line = line.trim();
                    if !line.is_empty() && !macos_path.contains(line) {
                        if !macos_path.is_empty() {
                            macos_path.push(':');
                        }
                        macos_path.push_str(line);
                    }
                }
            }
            
            // Read /etc/paths.d/*
            if let Ok(entries) = std::fs::read_dir("/etc/paths.d") {
                for entry in entries.filter_map(|e| e.ok()) {
                    if let Ok(content) = std::fs::read_to_string(entry.path()) {
                        for line in content.lines() {
                            let line = line.trim();
                            if !line.is_empty() && !macos_path.contains(line) {
                                if !macos_path.is_empty() {
                                    macos_path.push(':');
                                }
                                macos_path.push_str(line);
                            }
                        }
                    }
                }
            }
            
            if !macos_path.is_empty() {
                println!("[SHELL_ENV] Adding macOS system paths from /etc/paths and /etc/paths.d");
                if let Some(ref mut map) = env_map {
                    if let Some(existing_path) = map.get("PATH") {
                        // Merge macOS paths with existing PATH
                        let merged = format!("{}:{}", existing_path, macos_path);
                        map.insert("PATH".to_string(), merged);
                    } else {
                        map.insert("PATH".to_string(), macos_path.clone());
                    }
                } else {
                    let mut map = HashMap::new();
                    map.insert("PATH".to_string(), macos_path);
                    env_map = Some(map);
                }
            }
        }
        
        // Finalize the environment map
        let mut final_map = env_map.unwrap_or_default();
        
        // Ensure common paths are included
        let common_paths = vec![
            "/opt/homebrew/bin",      // Apple Silicon Homebrew
            "/opt/homebrew/sbin",
            "/usr/local/bin",          // Intel Homebrew & common tools
            "/usr/local/sbin",
            "/usr/bin",
            "/bin",
            "/usr/sbin",
            "/sbin",
        ];
        
        // Also check for user-specific tool paths
        if let Ok(home) = std::env::var("HOME") {
            let user_paths = vec![
                format!("{}/.cargo/bin", home),           // Rust
                format!("{}/.local/bin", home),           // pip, pipx
                format!("{}/go/bin", home),               // Go
                format!("{}/.bun/bin", home),             // Bun
                format!("{}/.deno/bin", home),            // Deno
                format!("{}/Library/pnpm", home),         // pnpm (macOS)
                format!("{}/.pnpm", home),                // pnpm (Linux)
                format!("{}/.nvm/versions/node", home),   // nvm base path
                format!("{}/.volta/bin", home),           // Volta
                format!("{}/.rbenv/shims", home),         // rbenv
                format!("{}/.pyenv/shims", home),         // pyenv
            ];
            
            if let Some(existing_path) = final_map.get("PATH") {
                let mut path_parts: Vec<&str> = existing_path.split(':').collect();
                
                // Add user tool paths if they exist and are not already in PATH
                for user_path in &user_paths {
                    if std::path::Path::new(user_path).exists() && !path_parts.contains(&user_path.as_str()) {
                        path_parts.insert(0, user_path);
                    }
                }
                
                // Add common paths if not already present
                for common_path in &common_paths {
                    if !path_parts.contains(common_path) {
                        path_parts.push(common_path);
                    }
                }
                
                final_map.insert("PATH".to_string(), path_parts.join(":"));
            } else {
                // No PATH at all, build one from scratch
                let mut path_parts: Vec<String> = Vec::new();
                
                for user_path in &user_paths {
                    if std::path::Path::new(user_path).exists() {
                        path_parts.push(user_path.clone());
                    }
                }
                
                for common_path in common_paths {
                    path_parts.push(common_path.to_string());
                }
                
                final_map.insert("PATH".to_string(), path_parts.join(":"));
            }
        }
        
        // Log the final PATH for debugging
        if let Some(path) = final_map.get("PATH") {
            println!("[SHELL_ENV] Final PATH ({} entries): {}", path.split(':').count(), path);
        }
        println!("[SHELL_ENV] Loaded {} environment variables total (cached)", final_map.len());
        
        final_map
    }).clone()
}

#[cfg(target_os = "windows")]
pub fn get_shell_env() -> HashMap<String, String> {
    // On Windows, environment is usually correctly inherited from parent process
    // Return empty map - we'll rely on the process's inherited environment
    HashMap::new()
}
