use std::process::Command;

/// Execute command result
#[derive(serde::Serialize)]
pub struct AdminExecResult {
    pub success: bool,
    pub stdout: String,
    pub stderr: String,
    pub exit_code: Option<i32>,
}

/// Execute a command with administrator privileges
/// - macOS: Uses osascript with "administrator privileges"
/// - Windows: Uses PowerShell Start-Process -Verb RunAs
/// - Linux: Uses pkexec (PolicyKit)
#[tauri::command]
pub async fn execute_with_admin(command: String, args: Option<Vec<String>>) -> Result<AdminExecResult, String> {
    let args = args.unwrap_or_default();
    
    #[cfg(target_os = "macos")]
    {
        // Build full command string
        let full_command = if args.is_empty() {
            command.clone()
        } else {
            format!("{} {}", command, args.join(" "))
        };
        
        // Escape for AppleScript
        let escaped_command = full_command
            .replace("\\", "\\\\\\\\")
            .replace("\"", "\\\"")
            .replace("'", "'\\''");
        
        let script = format!(
            r#"do shell script "{}" with administrator privileges"#,
            escaped_command
        );
        
        println!("[Admin] Executing with admin privileges: {}", full_command);
        
        let output = Command::new("osascript")
            .args(["-e", &script])
            .output()
            .map_err(|e| format!("Failed to execute osascript: {}", e))?;
        
        let stdout = String::from_utf8_lossy(&output.stdout).to_string();
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();
        
        // Check if user cancelled
        if stderr.contains("User canceled") || stderr.contains("user canceled") {
            return Err("User cancelled the operation".to_string());
        }
        
        Ok(AdminExecResult {
            success: output.status.success(),
            stdout,
            stderr,
            exit_code: output.status.code(),
        })
    }
    
    #[cfg(target_os = "windows")]
    {
        // Build full command string for cmd.exe
        let full_command = if args.is_empty() {
            command.clone()
        } else {
            format!("{} {}", command, args.join(" "))
        };
        
        // Escape for PowerShell
        let escaped_command = full_command.replace("\"", "`\"");
        
        // Create a temp script to capture output
        let temp_dir = std::env::temp_dir();
        let stdout_file = temp_dir.join(format!("rebebuca_admin_stdout_{}.txt", std::process::id()));
        let stderr_file = temp_dir.join(format!("rebebuca_admin_stderr_{}.txt", std::process::id()));
        
        // PowerShell script to run as admin and capture output
        let ps_script = format!(
            r#"
            $process = Start-Process -FilePath "cmd.exe" -ArgumentList '/c {} > "{}" 2> "{}"' -Verb RunAs -Wait -PassThru
            exit $process.ExitCode
            "#,
            escaped_command,
            stdout_file.display(),
            stderr_file.display()
        );
        
        println!("[Admin] Executing with admin privileges: {}", full_command);
        
        let output = Command::new("powershell")
            .args(["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", &ps_script])
            .output()
            .map_err(|e| format!("Failed to execute PowerShell: {}", e))?;
        
        // Read output files
        let stdout = std::fs::read_to_string(&stdout_file).unwrap_or_default();
        let stderr = std::fs::read_to_string(&stderr_file).unwrap_or_default();
        
        // Cleanup temp files
        let _ = std::fs::remove_file(&stdout_file);
        let _ = std::fs::remove_file(&stderr_file);
        
        // Check if user cancelled (UAC denied)
        if stderr.contains("Operation was canceled") || !output.status.success() && stdout.is_empty() && stderr.is_empty() {
            return Err("User cancelled the operation or UAC was denied".to_string());
        }
        
        Ok(AdminExecResult {
            success: output.status.success(),
            stdout,
            stderr,
            exit_code: output.status.code(),
        })
    }
    
    #[cfg(target_os = "linux")]
    {
        // Use pkexec (PolicyKit) for Linux
        println!("[Admin] Executing with pkexec: {} {:?}", command, args);
        
        let output = Command::new("pkexec")
            .arg(&command)
            .args(&args)
            .output()
            .map_err(|e| format!("Failed to execute pkexec: {}", e))?;
        
        let stdout = String::from_utf8_lossy(&output.stdout).to_string();
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();
        
        // Check if user cancelled
        if stderr.contains("dismissed") || stderr.contains("Not authorized") {
            return Err("User cancelled the operation or not authorized".to_string());
        }
        
        Ok(AdminExecResult {
            success: output.status.success(),
            stdout,
            stderr,
            exit_code: output.status.code(),
        })
    }
}

/// Request file system access permission on macOS
/// This triggers the system permission dialog for accessing protected directories
#[tauri::command]
pub async fn request_folder_access(path: String) -> Result<bool, String> {
    #[cfg(target_os = "macos")]
    {
        // Try to list directory contents to trigger permission dialog
        let output = Command::new("ls")
            .arg(&path)
            .output();
        
        match output {
            Ok(o) => {
                if o.status.success() {
                    Ok(true)
                } else {
                    let stderr = String::from_utf8_lossy(&o.stderr);
                    if stderr.contains("Operation not permitted") {
                        // macOS will show permission dialog automatically when app tries to access
                        // We need to use NSOpenPanel or similar to trigger proper permission request
                        // For now, return false and let user grant permission in System Preferences
                        Err("Permission denied. Please grant access in System Preferences > Security & Privacy > Privacy > Files and Folders".to_string())
                    } else {
                        Err(stderr.to_string())
                    }
                }
            }
            Err(e) => Err(format!("Failed to access path: {}", e))
        }
    }
    
    #[cfg(not(target_os = "macos"))]
    {
        // On Windows/Linux, just check if path exists and is accessible
        use std::path::Path;
        let path = Path::new(&path);
        if path.exists() {
            match std::fs::read_dir(path) {
                Ok(_) => Ok(true),
                Err(e) => Err(format!("Cannot access folder: {}", e))
            }
        } else {
            Err("Path does not exist".to_string())
        }
    }
}

/// Check if a command requires admin privileges
#[tauri::command]
pub fn check_needs_admin(command: String) -> bool {
    let cmd_lower = command.to_lowercase();
    let cmd_trimmed = cmd_lower.trim();
    
    // Commands that typically need admin
    let admin_commands = [
        "sudo ",
        "su ",
        "doas ",
        "pkexec ",
        // Windows admin commands
        "runas ",
        "net user",
        "net localgroup",
        "netsh ",
        "bcdedit",
        "diskpart",
        "sfc ",
        "dism ",
        "chkdsk ",
        // System modification commands
        "chmod ",
        "chown ",
        "mount ",
        "umount ",
        "fdisk ",
        "mkfs ",
        "systemctl ",
        "service ",
        "launchctl ",
        // Package managers that may need admin
        "apt ",
        "apt-get ",
        "yum ",
        "dnf ",
        "pacman ",
        "brew services",
    ];
    
    // Check if command starts with any admin command
    for admin_cmd in admin_commands {
        if cmd_trimmed.starts_with(admin_cmd) {
            return true;
        }
    }
    
    // Check for sudo in piped commands
    if cmd_lower.contains("| sudo ") || cmd_lower.contains("&& sudo ") || cmd_lower.contains("; sudo ") {
        return true;
    }
    
    false
}
