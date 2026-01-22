//! # Rebebuca Agent Orchestration Framework
//!
//! This crate provides a comprehensive framework for orchestrating multiple AI agents
//! to collaborate on complex tasks. It supports various orchestration patterns including
//! sequential, parallel, and supervisor-worker modes.
//!
//! ## Features
//!
//! - **Agent Abstraction**: Generic `Agent` trait for different agent implementations
//! - **Tool Executor**: Abstracted tool execution supporting local and remote environments
//! - **Orchestration Patterns**: Sequential, Parallel, and Supervisor-Worker patterns
//! - **Execution Tracking**: Comprehensive execution traces for debugging and monitoring
//! - **Event System**: Real-time event streaming for UI updates
//!
//! ## Architecture
//!
//! ```text
//! ┌─────────────────────────────────────────────────────────────┐
//! │                    Orchestrator Layer                        │
//! │  (Sequential, Parallel, SupervisorWorker patterns)          │
//! └─────────────────────────────────────────────────────────────┘
//!                              │
//! ┌─────────────────────────────────────────────────────────────┐
//! │                      Agent Layer                             │
//! │  (Supervisor Agent, Worker Agent, Custom Agents)            │
//! └─────────────────────────────────────────────────────────────┘
//!                              │
//! ┌─────────────────────────────────────────────────────────────┐
//! │                   ToolExecutor Layer                         │
//! │  (LocalToolExecutor, RemoteToolExecutor)                    │
//! └─────────────────────────────────────────────────────────────┘
//! ```

pub mod agent;
pub mod boulder_state;
pub mod context;
pub mod errors;
pub mod hooks;
pub mod orchestrator;
pub mod patterns;
pub mod tools;
pub mod verification;

// Re-export commonly used types
pub use agent::{Agent, AgentInput, AgentOutput};
pub use boulder_state::{BoulderState, BoulderStateManager, ProgressInfo};
pub use context::{ExecutionConfig, ExecutionContext, ExecutionTrace};
pub use errors::{OrchestrationError, Result};
pub use hooks::{HookEvent, HookHandler, Hooks};
pub use orchestrator::{Orchestrator, OrchestratorInput, OrchestratorOutput};
pub use tools::{ToolDefinition, ToolExecutor, ToolResult};
pub use verification::{VerificationContext, Verifier};

// Re-export patterns
pub use patterns::{
    parallel::ParallelOrchestrator, sequential::SequentialOrchestrator,
    supervisor::SupervisorWorkerOrchestrator,
};
