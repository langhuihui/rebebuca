//! Backend adapters for terminal, filesystem, system, and storage

mod filesystem;
mod storage;
mod system;
mod terminal;

pub use filesystem::FileSystemAdapter;
pub use storage::StorageAdapter;
pub use system::SystemAdapter;
pub use terminal::TerminalAdapter;
