//! Shell detection and environment utilities

use crate::types::ShellInfo;
use std::collections::HashMap;
use std::path::Path;

/// Known shell paths to check
const SHELL_PATHS: &[(&str, &str, &str)] = &[
    ("zsh", "Zsh", "/bin/zsh"),
    ("bash", "Bash", "/bin/bash"),
    ("sh", "Bourne Shell", "/bin/sh"),
    ("fish", "Fish", "/usr/bin/fish"),
    ("fish", "Fish", "/usr/local/bin/fish"),
    ("fish", "Fish", "/opt/homebrew/bin/fish"),
];

/// Get the default shell from environment
pub fn get_default_shell() -> String {
    std::env::var("SHELL").unwrap_or_else(|_| "/bin/sh".to_string())
}

/// Get list of available shells on the system
pub fn get_available_shells() -> Vec<ShellInfo> {
    let default_shell = get_default_shell();
    let mut shells = Vec::new();
    let mut seen_paths = std::collections::HashSet::new();

    for (id, name, path) in SHELL_PATHS {
        if seen_paths.contains(*path) {
            continue;
        }

        let available = Path::new(path).exists();
        if available {
            seen_paths.insert(*path);
            shells.push(ShellInfo {
                id: id.to_string(),
                name: name.to_string(),
                path: path.to_string(),
                available,
                is_default: *path == default_shell,
            });
        }
    }

    shells
}

/// Get shell environment variables by running the shell and extracting env
/// This captures the full environment including shell initialization
pub fn get_shell_env(shell_path: Option<&str>) -> HashMap<String, String> {
    let shell = shell_path
        .map(|s| s.to_string())
        .unwrap_or_else(get_default_shell);

    // Try to get environment from an interactive shell
    let output = std::process::Command::new(&shell)
        .args(["-ilc", "env"])
        .output();

    let mut env_map = HashMap::new();

    if let Ok(output) = output {
        if output.status.success() {
            let env_str = String::from_utf8_lossy(&output.stdout);
            for line in env_str.lines() {
                if let Some((key, value)) = line.split_once('=') {
                    env_map.insert(key.to_string(), value.to_string());
                }
            }
        }
    }

    // Fallback: use current process environment
    if env_map.is_empty() {
        for (key, value) in std::env::vars() {
            env_map.insert(key, value);
        }
    }

    env_map
}

/// Strip ANSI escape codes from a string
pub fn strip_ansi_codes(s: &str) -> String {
    let mut result = String::with_capacity(s.len());
    let mut chars = s.chars().peekable();

    while let Some(c) = chars.next() {
        if c == '\x1b' {
            // ESC character - start of escape sequence
            if chars.peek() == Some(&'[') {
                chars.next(); // consume '['
                // Skip until we hit a letter (end of CSI sequence)
                while let Some(&next) = chars.peek() {
                    chars.next();
                    if next.is_ascii_alphabetic() {
                        break;
                    }
                }
            } else if chars.peek() == Some(&']') {
                // OSC sequence - skip until BEL or ST
                chars.next(); // consume ']'
                while let Some(&next) = chars.peek() {
                    chars.next();
                    if next == '\x07' {
                        break;
                    }
                    if next == '\x1b' {
                        if chars.peek() == Some(&'\\') {
                            chars.next();
                            break;
                        }
                    }
                }
            }
        } else {
            result.push(c);
        }
    }

    result
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_strip_ansi_codes() {
        assert_eq!(strip_ansi_codes("\x1b[31mred\x1b[0m"), "red");
        assert_eq!(strip_ansi_codes("no escape"), "no escape");
        assert_eq!(strip_ansi_codes("\x1b[1;32mgreen bold\x1b[0m"), "green bold");
    }

    #[test]
    fn test_get_default_shell() {
        let shell = get_default_shell();
        assert!(!shell.is_empty());
    }
}
