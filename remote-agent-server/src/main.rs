//! Rebebuca Remote Server
//!
//! A server that provides WebSocket API for the Rebebuca web frontend,
//! enabling remote terminal execution and file management.

mod adapters;
mod auth;
mod config;
mod connection;
mod handlers;
mod orchestration;
mod protocol;

use std::net::SocketAddr;
use std::path::PathBuf;
use std::sync::Arc;

use axum_server::tls_rustls::RustlsConfig;
use clap::Parser;
use tokio::sync::mpsc;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

use adapters::{FileSystemAdapter, StorageAdapter, SystemAdapter, TerminalAdapter};
use config::Config;
use connection::table::create_shared_connection_table;
use handlers::{create_router, AppState};
use protocol::{Event, OutgoingMessage, TerminalDataEvent, TerminalExitEvent};

/// Rebebuca Remote Server
#[derive(Parser, Debug)]
#[command(name = "rebebuca-remote-server")]
#[command(about = "Remote server for Rebebuca web frontend")]
#[command(version)]
struct Args {
    /// Configuration file path
    #[arg(short, long, default_value = "config.toml")]
    config: PathBuf,

    /// Host to bind to (overrides config)
    #[arg(long)]
    host: Option<String>,

    /// Port to listen on (overrides config)
    #[arg(short, long)]
    port: Option<u16>,

    /// Static files directory (overrides config)
    #[arg(long)]
    static_dir: Option<PathBuf>,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Initialize logging
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "rebebuca_server=info,tower_http=info".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    // Parse command line arguments
    let args = Args::parse();

    // Load configuration
    let mut config = Config::load_or_default(Some(&args.config));

    // Override with command line arguments
    if let Some(host) = args.host {
        config.server.host = host.parse()?;
    }
    if let Some(port) = args.port {
        config.server.port = port;
    }
    if let Some(static_dir) = args.static_dir {
        config.server.static_dir = static_dir;
    }

    let config = Arc::new(config);

    // Create connection table
    let connection_table = create_shared_connection_table();

    // Create channels for terminal events
    let (terminal_data_tx, mut terminal_data_rx) = mpsc::unbounded_channel::<TerminalDataEvent>();
    let (terminal_exit_tx, mut terminal_exit_rx) = mpsc::unbounded_channel::<TerminalExitEvent>();

    // Create adapters
    let terminal_adapter = Arc::new(TerminalAdapter::new(
        terminal_data_tx.clone(),
        terminal_exit_tx.clone(),
    ));
    let filesystem_adapter = Arc::new(FileSystemAdapter::new((*config).clone()));
    let system_adapter = Arc::new(SystemAdapter::new());
    let storage_adapter = Arc::new(StorageAdapter::default());

    // Create application state
    let state = AppState {
        config: config.clone(),
        connection_table: connection_table.clone(),
        terminal_adapter: terminal_adapter.clone(),
        filesystem_adapter,
        system_adapter,
        storage_adapter,
        terminal_data_tx,
        terminal_exit_tx,
    };

    // Spawn task to forward terminal data events to clients
    let connection_table_for_data = connection_table.clone();
    tokio::spawn(async move {
        while let Some(event) = terminal_data_rx.recv().await {
            let table = connection_table_for_data.read().await;
            let msg = OutgoingMessage::Event(Event::new("terminal.data", &event));
            if let Err(e) = table.send_to_pty_owner(&event.pty_id, msg) {
                tracing::warn!("Failed to send terminal data to client: {} (pty_id: {})", e, event.pty_id);
            }
        }
    });

    // Spawn task to forward terminal exit events to clients
    let connection_table_for_exit = connection_table.clone();
    tokio::spawn(async move {
        while let Some(event) = terminal_exit_rx.recv().await {
            let table = connection_table_for_exit.read().await;
            let msg = OutgoingMessage::Event(Event::new("terminal.exit", &event));
            if let Err(e) = table.send_to_pty_owner(&event.pty_id, msg) {
                tracing::warn!("Failed to send terminal exit to client: {} (pty_id: {})", e, event.pty_id);
            }
        }
    });

    // Create router
    let app = create_router(state);

    // Bind address
    let addr = SocketAddr::new(config.server.host, config.server.port);

    // Start server
    if config.has_tls() {
        // HTTPS mode
        let tls_config = RustlsConfig::from_pem_file(
            config.server.tls_cert.as_ref().unwrap(),
            config.server.tls_key.as_ref().unwrap(),
        )
        .await?;

        tracing::info!("Starting HTTPS server on https://{}", addr);
        axum_server::bind_rustls(addr, tls_config)
            .serve(app.into_make_service())
            .await?;
    } else {
        // HTTP mode
        tracing::info!("Starting HTTP server on http://{}", addr);
        tracing::warn!("Running without TLS. Consider using HTTPS in production.");

        let listener = tokio::net::TcpListener::bind(addr).await?;
        axum::serve(listener, app).await?;
    }

    Ok(())
}
