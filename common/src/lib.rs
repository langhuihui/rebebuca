//! Common types and utilities for Rebebuca projects
//!
//! This crate provides shared functionality between:
//! - `remote-agent`: Lightweight agent running on remote machines via SSH
//! - `remote-agent-server`: WebSocket server for web frontend
//! - `src-tauri`: Desktop application backend

pub mod types;

#[cfg(unix)]
pub mod shell;

#[cfg(unix)]
pub mod port;

#[cfg(unix)]
pub mod process;

pub use types::*;
