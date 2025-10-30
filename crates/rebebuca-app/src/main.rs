use anyhow::Result;
use gpui::*;
use log::info;
use rebebuca_core::AppState;
use rebebuca_ui::RebebucaApp;
use std::sync::Arc;

fn main() -> Result<()> {
    // Initialize logging
    env_logger::Builder::from_default_env()
        .filter_level(log::LevelFilter::Info)
        .init();

    info!("Starting Rebebuca GPUI application");

    // Create the GPUI application
    let app = Application::new();

    app.run(move |cx| {
        // Initialize the application state
        cx.spawn(async move |cx| {
            match AppState::new().await {
                Ok(app_state) => {
                    info!("Application state initialized successfully");
                    
                    // Create system tray
                    let app_state_arc = Arc::new(app_state);
                    setup_system_tray(&app_state_arc, cx)?;
                    
                    // Open the main window with transparent background and custom titlebar
                    let mut window_options = WindowOptions::default();
                    window_options.window_background = WindowBackgroundAppearance::Transparent;
                    window_options.titlebar = Some(TitlebarOptions {
                        title: Some("Rebebuca".into()),
                        appears_transparent: true, // Hide system titlebar to allow custom one
                        // Don't set traffic_light_position - let system buttons stay in default position
                        // Our custom titlebar will cover them with a solid background
                        traffic_light_position: None,
                    });
                    window_options.is_movable = true;
                    window_options.is_resizable = true;
                    window_options.is_minimizable = true;
                    
                    cx.open_window(window_options, |_window, cx| {
                        let view = cx.new(|_| RebebucaApp::new((*app_state_arc).clone()));
                        view
                    })?;
                }
                Err(e) => {
                    eprintln!("Failed to initialize application state: {}", e);
                    std::process::exit(1);
                }
            }

            Ok::<_, anyhow::Error>(())
        })
        .detach();
    });

    Ok(())
}

fn setup_system_tray(_app_state: &Arc<AppState>, _cx: &mut impl AppContext) -> Result<()> {
    // For now, we'll create a simple system tray setup
    // In a real implementation, this would use platform-specific APIs
    info!("Setting up system tray (placeholder implementation)");
    
    // TODO: Implement actual system tray functionality
    // This would include:
    // - Creating tray icon
    // - Setting up context menu
    // - Handling tray events
    
    Ok(())
}
