//! OAuth Callback Server (loopback)
//!
//! This small HTTP server runs on 127.0.0.1 and receives tokens from the
//! auth server after the user finishes OAuth login in the system browser.
//! It then emits an event to the Tauri frontend.

use axum::{
    extract::{Query, State},
    response::{Html, IntoResponse},
    routing::get,
    Router,
};
use log::{error, info};
use serde::Deserialize;
use serde_json::json;
use std::sync::Arc;
use tauri::Emitter;
use tokio::sync::Mutex;

#[derive(Clone)]
struct OAuthCallbackState {
    app_handle: tauri::AppHandle,
}

#[derive(Debug, Deserialize)]
struct OAuthCallbackQuery {
    #[serde(rename = "accessToken")]
    access_token: String,
    #[serde(rename = "refreshToken")]
    refresh_token: String,
    provider: Option<String>,
}

async fn oauth_callback(
    State(state): State<OAuthCallbackState>,
    Query(query): Query<OAuthCallbackQuery>,
) -> impl IntoResponse {
    info!(
        "[OAUTH] Received callback (provider={:?})",
        query.provider.as_deref().unwrap_or("unknown")
    );

    // Emit tokens to frontend
    let payload = json!({
        "accessToken": query.access_token,
        "refreshToken": query.refresh_token,
        "provider": query.provider,
    });

    if let Err(e) = state.app_handle.emit("oauth-tokens-received", payload) {
        error!("[OAUTH] Failed to emit oauth-tokens-received: {}", e);
    }

    // Simple success page
    Html(
        r#"<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Rebebuca Login</title>
    <style>
      body { font-family: -apple-system, system-ui, sans-serif; padding: 24px; }
      .card { max-width: 520px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 12px; padding: 20px; }
      h1 { margin: 0 0 12px; font-size: 18px; }
      p { margin: 0; color: #374151; }
      code { background: #f3f4f6; padding: 2px 6px; border-radius: 6px; }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>Login successful</h1>
      <p>You can close this window and return to <code>Rebebuca</code>.</p>
    </div>
  </body>
</html>"#,
    )
}

// Global server port (started on-demand)
lazy_static::lazy_static! {
    static ref OAUTH_PORT: Arc<Mutex<Option<u16>>> = Arc::new(Mutex::new(None));
}

/// Start (or get) the OAuth loopback callback server.
///
/// Returns the loopback callback URL, e.g. http://127.0.0.1:12345/oauth/callback
#[tauri::command]
pub async fn start_oauth_callback_server(app_handle: tauri::AppHandle) -> Result<String, String> {
    let mut guard = OAUTH_PORT.lock().await;

    if let Some(port) = *guard {
        return Ok(format!("http://127.0.0.1:{}/oauth/callback", port));
    }

    let state = OAuthCallbackState { app_handle: app_handle.clone() };

    let app = Router::new()
        .route("/oauth/callback", get(oauth_callback))
        .with_state(state);

    let listener = tokio::net::TcpListener::bind("127.0.0.1:0")
        .await
        .map_err(|e| format!("Failed to bind loopback oauth server: {}", e))?;

    let port = listener
        .local_addr()
        .map_err(|e| format!("Failed to read loopback oauth server port: {}", e))?
        .port();

    info!("[OAUTH] Loopback callback server started on 127.0.0.1:{}", port);

    *guard = Some(port);
    drop(guard);

    tokio::spawn(async move {
        if let Err(e) = axum::serve(listener, app).await {
            error!("[OAUTH] Loopback oauth server error: {}", e);
        }
    });

    Ok(format!("http://127.0.0.1:{}/oauth/callback", port))
}
