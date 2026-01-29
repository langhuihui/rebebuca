//! Example usage of the terminal backend abstraction
//!
//! This file demonstrates how to use the unified terminal backend system.

#[cfg(test)]
mod tests {
    use super::super::*;
    use crate::adapters::terminal::TerminalAdapter;
    use crate::protocol::CreateTerminalParams;
    use std::collections::HashMap;
    use std::sync::Arc;
    use tokio::sync::mpsc;

    #[tokio::test]
    #[ignore] // Requires actual terminal setup
    async fn test_unified_backend() {
        // Create channels for terminal events
        let (data_tx, _data_rx) = mpsc::unbounded_channel();
        let (exit_tx, _exit_rx) = mpsc::unbounded_channel();

        // Create PTY adapter
        let pty_adapter = Arc::new(TerminalAdapter::new(data_tx, exit_tx));

        // Create unified backend
        let unified_backend = create_unified_backend(Some(pty_adapter), None);

        // Create a terminal with auto-detection
        let params = CreateTerminalParams {
            pty_id: None,
            command: "echo".to_string(),
            args: vec!["Hello, World!".to_string()],
            cwd: None,
            env: HashMap::new(),
            shell_path: None,
        };

        // This would create a PTY terminal (default)
        let result = unified_backend.create_with_auto_detect(params).await;
        assert!(result.is_ok());

        if let Ok(create_result) = result {
            let handle = &create_result.handle;

            // Write to terminal
            let write_result = unified_backend
                .route_request(handle, |backend| {
                    Box::pin(async move { backend.write(handle, "test\n").await })
                })
                .await;
            assert!(write_result.is_ok());

            // Resize terminal
            let resize_result = unified_backend
                .route_request(handle, |backend| {
                    Box::pin(async move { backend.resize(handle, 80, 24).await })
                })
                .await;
            assert!(resize_result.is_ok());

            // Check if alive
            let is_alive = unified_backend
                .route_request(handle, |backend| {
                    Box::pin(async move { Ok(backend.is_alive(handle).await) })
                })
                .await;
            assert!(is_alive.is_ok());
        }
    }

    #[tokio::test]
    async fn test_backend_detection() {
        // Test PTY detection (default)
        let mut params = CreateTerminalParams {
            pty_id: None,
            command: "echo".to_string(),
            args: vec![],
            cwd: None,
            env: HashMap::new(),
            shell_path: None,
        };

        let backend_type = UnifiedTerminalBackend::detect_backend_type(&params);
        assert_eq!(backend_type, BackendType::Pty);

        // Test SSH detection via env
        params.env.insert("SSH_HOST".to_string(), "example.com".to_string());
        let backend_type = UnifiedTerminalBackend::detect_backend_type(&params);
        assert_eq!(backend_type, BackendType::Ssh);

        // Test SSH detection via command
        params.env.clear();
        params.command = "ssh user@host".to_string();
        let backend_type = UnifiedTerminalBackend::detect_backend_type(&params);
        assert_eq!(backend_type, BackendType::Ssh);
    }
}
