//! File system adapter

use std::path::Path;
use tokio::fs;

use crate::config::Config;
use crate::protocol::{DirEntry, FileInfo};

/// File system adapter for file operations
pub struct FileSystemAdapter {
    config: Config,
}

impl FileSystemAdapter {
    pub fn new(config: Config) -> Self {
        Self { config }
    }

    /// Check if a path is allowed by security config
    fn check_path(&self, path: &str) -> Result<(), String> {
        if !self.config.is_path_allowed(path) {
            return Err(format!("Access denied: {}", path));
        }
        Ok(())
    }

    /// Read a text file
    pub async fn read_text_file(&self, path: &str) -> Result<String, String> {
        self.check_path(path)?;
        fs::read_to_string(path)
            .await
            .map_err(|e| format!("Failed to read file: {}", e))
    }

    /// Write a text file
    pub async fn write_text_file(&self, path: &str, content: &str) -> Result<(), String> {
        self.check_path(path)?;
        fs::write(path, content)
            .await
            .map_err(|e| format!("Failed to write file: {}", e))
    }

    /// Read directory contents
    pub async fn read_dir(&self, path: &str) -> Result<Vec<DirEntry>, String> {
        self.check_path(path)?;

        let mut entries = Vec::new();
        let mut dir = fs::read_dir(path)
            .await
            .map_err(|e| format!("Failed to read directory: {}", e))?;

        while let Some(entry) = dir
            .next_entry()
            .await
            .map_err(|e| format!("Failed to read entry: {}", e))?
        {
            let metadata = entry
                .metadata()
                .await
                .map_err(|e| format!("Failed to get metadata: {}", e))?;

            entries.push(DirEntry {
                name: entry.file_name().to_string_lossy().to_string(),
                path: entry.path().to_string_lossy().to_string(),
                is_directory: metadata.is_dir(),
                is_file: metadata.is_file(),
            });
        }

        // Sort entries: directories first, then files, alphabetically
        entries.sort_by(|a, b| {
            match (a.is_directory, b.is_directory) {
                (true, false) => std::cmp::Ordering::Less,
                (false, true) => std::cmp::Ordering::Greater,
                _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
            }
        });

        Ok(entries)
    }

    /// Check if a path exists
    pub async fn exists(&self, path: &str) -> Result<bool, String> {
        self.check_path(path)?;
        Ok(Path::new(path).exists())
    }

    /// Get file/directory info
    pub async fn stat(&self, path: &str) -> Result<FileInfo, String> {
        self.check_path(path)?;

        let metadata = fs::metadata(path)
            .await
            .map_err(|e| format!("Failed to get metadata: {}", e))?;

        let modified_at = metadata
            .modified()
            .ok()
            .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
            .map(|d| d.as_millis() as u64);

        Ok(FileInfo {
            path: path.to_string(),
            size: metadata.len(),
            is_directory: metadata.is_dir(),
            is_file: metadata.is_file(),
            modified_at,
        })
    }

    /// Create a directory
    pub async fn mkdir(&self, path: &str, recursive: bool) -> Result<(), String> {
        self.check_path(path)?;

        if recursive {
            fs::create_dir_all(path)
                .await
                .map_err(|e| format!("Failed to create directory: {}", e))
        } else {
            fs::create_dir(path)
                .await
                .map_err(|e| format!("Failed to create directory: {}", e))
        }
    }

    /// Remove a file or directory
    pub async fn remove(&self, path: &str, recursive: bool) -> Result<(), String> {
        self.check_path(path)?;

        let metadata = fs::metadata(path)
            .await
            .map_err(|e| format!("Failed to get metadata: {}", e))?;

        if metadata.is_dir() {
            if recursive {
                fs::remove_dir_all(path)
                    .await
                    .map_err(|e| format!("Failed to remove directory: {}", e))
            } else {
                fs::remove_dir(path)
                    .await
                    .map_err(|e| format!("Failed to remove directory: {}", e))
            }
        } else {
            fs::remove_file(path)
                .await
                .map_err(|e| format!("Failed to remove file: {}", e))
        }
    }
}
