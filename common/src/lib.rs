//! Common types and utilities for Rebebuca projects
//!
//! This crate provides shared functionality between:
//! - `remote-agent`: Lightweight agent running on remote machines via SSH (stdin/stdout executor)

pub mod types;

#[cfg(unix)]
pub mod shell;

#[cfg(unix)]
pub mod port;

#[cfg(unix)]
pub mod process;

pub use types::*;
