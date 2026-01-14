//! Server configuration management

use serde::{Deserialize, Serialize};
use std::net::IpAddr;
use std::path::PathBuf;

/// Server configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Config {
    #[serde(default)]
    pub server: ServerConfig,
    #[serde(default)]
    pub auth: AuthConfig,
    #[serde(default)]
    pub security: SecurityConfig,
}

impl Default for Config {
    fn default() -> Self {
        Self {
            server: ServerConfig::default(),
            auth: AuthConfig::default(),
            security: SecurityConfig::default(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerConfig {
    /// Host to bind to
    #[serde(default = "default_host")]
    pub host: IpAddr,
    /// Port to listen on
    #[serde(default = "default_port")]
    pub port: u16,
    /// Directory containing static files (Vue dist)
    #[serde(default = "default_static_dir")]
    pub static_dir: PathBuf,
    /// TLS certificate path (optional)
    pub tls_cert: Option<PathBuf>,
    /// TLS key path (optional)
    pub tls_key: Option<PathBuf>,
}

impl Default for ServerConfig {
    fn default() -> Self {
        Self {
            host: default_host(),
            port: default_port(),
            static_dir: default_static_dir(),
            tls_cert: None,
            tls_key: None,
        }
    }
}

fn default_host() -> IpAddr {
    "0.0.0.0".parse().unwrap()
}

fn default_port() -> u16 {
    8080
}

fn default_static_dir() -> PathBuf {
    // Try to find the dist directory relative to the executable or current dir
    let candidates = [
        PathBuf::from("../dist"),      // When running from remote-agent-server/
        PathBuf::from("./dist"),       // When running from project root
        PathBuf::from("dist"),         // Alternative
    ];
    
    for candidate in &candidates {
        if candidate.exists() && candidate.is_dir() {
            return candidate.clone();
        }
    }
    
    // Default fallback
    PathBuf::from("./dist")
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthConfig {
    /// Simple password authentication (for single-user mode)
    /// In production, consider more robust authentication
    #[serde(default)]
    pub password: Option<String>,
    /// Session token expiry in hours
    #[serde(default = "default_session_expiry")]
    pub session_expiry_hours: u64,
}

impl Default for AuthConfig {
    fn default() -> Self {
        Self {
            password: None,
            session_expiry_hours: default_session_expiry(),
        }
    }
}

fn default_session_expiry() -> u64 {
    24
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SecurityConfig {
    /// Allowed paths for file system access (whitelist)
    /// If empty, all paths are allowed
    #[serde(default)]
    pub allowed_paths: Vec<PathBuf>,
    /// Denied commands (blacklist)
    #[serde(default)]
    pub denied_commands: Vec<String>,
}

impl Default for SecurityConfig {
    fn default() -> Self {
        Self {
            allowed_paths: vec![],
            denied_commands: vec![],
        }
    }
}

impl Config {
    /// Load configuration from file
    pub fn load(path: &PathBuf) -> anyhow::Result<Self> {
        let content = std::fs::read_to_string(path)?;
        let config: Config = toml::from_str(&content)?;
        Ok(config)
    }

    /// Load configuration from file or use defaults
    pub fn load_or_default(path: Option<&PathBuf>) -> Self {
        match path {
            Some(p) if p.exists() => Self::load(p).unwrap_or_default(),
            _ => Self::default(),
        }
    }

    /// Check if a path is allowed
    pub fn is_path_allowed(&self, path: &str) -> bool {
        if self.security.allowed_paths.is_empty() {
            return true;
        }
        let path = PathBuf::from(path);
        self.security
            .allowed_paths
            .iter()
            .any(|allowed| path.starts_with(allowed))
    }

    /// Check if TLS is configured
    pub fn has_tls(&self) -> bool {
        self.server.tls_cert.is_some() && self.server.tls_key.is_some()
    }
}
