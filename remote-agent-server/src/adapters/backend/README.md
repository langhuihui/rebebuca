# Terminal Backend Abstraction

This module provides a unified interface for different terminal backends (PTY, SSH, Local, etc.), similar to `claude_code_bridge`'s terminal backend abstraction.

## Architecture

The backend abstraction consists of:

1. **`TerminalBackend` trait**: Defines the unified interface for all terminal backends
2. **Backend implementations**:
   - `PtyBackend`: Local pseudo-terminal (PTY) backend
   - `SshBackend`: Remote terminal via SSH (placeholder implementation)
   - `LocalBackend`: Direct system terminal (not yet implemented)

3. **`UnifiedTerminalBackend`**: Manages multiple backends and routes requests automatically

## Usage

### Basic Usage

```rust
use crate::adapters::backend::*;
use crate::adapters::terminal::TerminalAdapter;
use std::sync::Arc;
use tokio::sync::mpsc;

// Create PTY adapter
let (data_tx, _) = mpsc::unbounded_channel();
let (exit_tx, _) = mpsc::unbounded_channel();
let pty_adapter = Arc::new(TerminalAdapter::new(data_tx, exit_tx));

// Create unified backend
let unified_backend = create_unified_backend(Some(pty_adapter), None);

// Create terminal with auto-detection
let params = CreateTerminalParams {
    pty_id: None,
    command: "echo".to_string(),
    args: vec!["Hello".to_string()],
    cwd: None,
    env: HashMap::new(),
    shell_path: None,
};

let result = unified_backend.create_with_auto_detect(params).await?;
let handle = result.handle;

// Write to terminal
unified_backend
    .route_request(&handle, |backend| {
        Box::pin(async move { backend.write(&handle, "test\n").await })
    })
    .await?;
```

### Manual Backend Selection

```rust
// Get specific backend
let pty_backend = unified_backend.get_backend(BackendType::Pty)?;

// Create terminal directly
let params = CreateTerminalParams { /* ... */ };
let result = pty_backend.create(params).await?;
```

### Backend Detection

The system automatically detects the appropriate backend based on:

1. **Environment variables**: `SSH_HOST`, `SSH_CONNECTION_ID` → SSH backend
2. **Command pattern**: Commands starting with `ssh ` or containing `@` → SSH backend
3. **Default**: PTY backend

```rust
let backend_type = UnifiedTerminalBackend::detect_backend_type(&params);
// Returns BackendType::Pty, BackendType::Ssh, or BackendType::Local
```

## Backend Types

### PTY Backend

- **Type**: `BackendType::Pty`
- **Use case**: Local terminal sessions
- **Implementation**: Uses existing `TerminalAdapter` with PTY support
- **Status**: ✅ Fully implemented

### SSH Backend

- **Type**: `BackendType::Ssh`
- **Use case**: Remote terminal sessions via SSH
- **Implementation**: ✅ Fully implemented using ssh2 crate
- **Status**: ✅ Complete implementation
- **Features**:
  - SSH connection and authentication (password/key-based)
  - PTY allocation on remote host
  - Interactive shell execution
  - Terminal resize support
  - Asynchronous I/O with event channels

### Local Backend

- **Type**: `BackendType::Local`
- **Use case**: Direct system terminal access
- **Implementation**: Not yet implemented
- **Status**: ❌ Not implemented

## Integration with Existing Code

To integrate with existing WebSocket handlers:

```rust
// In handlers/websocket.rs
use crate::adapters::backend::*;

// Replace direct TerminalAdapter usage with UnifiedTerminalBackend
let unified_backend = state.unified_terminal_backend.clone();

// Handle terminal.create
match unified_backend.create_with_auto_detect(params).await {
    Ok(result) => {
        // Register terminal handle
        Response::success(id, json!({
            "handle": result.handle,
            "pid": result.pid
        }))
    }
    Err(e) => Response::error(id, e),
}
```

## Benefits

1. **Unified Interface**: All terminal backends use the same API
2. **Easy Extension**: Add new backends by implementing `TerminalBackend` trait
3. **Automatic Detection**: System automatically selects the right backend
4. **Type Safety**: Backend type is encoded in `TerminalHandle`
5. **Flexibility**: Can manually select backend or use auto-detection

## Future Improvements

- [x] Complete SSH backend implementation
- [ ] Add Local backend implementation
- [ ] Add backend-specific configuration
- [ ] Add connection pooling for SSH
- [ ] Add backend health checks
- [ ] Add metrics and monitoring
