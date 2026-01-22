//! Orchestration patterns
//!
//! This module provides different patterns for orchestrating multiple agents:
//!
//! - **Sequential**: Agents execute one after another
//! - **Parallel**: Agents execute concurrently
//! - **Supervisor-Worker**: A supervisor agent coordinates worker agents

pub mod parallel;
pub mod sequential;
pub mod supervisor;

pub use parallel::ParallelOrchestrator;
pub use sequential::SequentialOrchestrator;
pub use supervisor::{SupervisorWorkerConfig, SupervisorWorkerOrchestrator};
