mod admin;
mod commands;
mod debug;
mod mcp_http_server;
mod mcp_server;
mod oauth_callback_server;
mod orchestration;
mod port;
mod process;
mod pty;
mod shell_env;
mod ssh;
mod terminal_task_manager;
mod terminal_task_types;
mod tray;
mod types;

use log::{info, warn};
use pty::{close_pty, create_pty, execute_task, force_kill_task, get_pty_process_stats, get_shell_integration_path, is_task_running, kill_task, resize_pty, write_pty, PtyManager};
use std::sync::Arc;
use tauri::{
    async_runtime,
    menu::{Menu, MenuItem, PredefinedMenuItem, Submenu},
    tray::TrayIconBuilder,
    Emitter, Manager, Listener,
};
use terminal_task_manager::TerminalTaskManager;

// Re-export types for use in other modules
pub use types::*;

// Re-export managers
pub use process::ProcessManager;
pub use tray::TrayState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(
            tauri_plugin_updater::Builder::new()
                .header("User-Agent", concat!("Rebebuca/", env!("CARGO_PKG_VERSION")))
                .expect("Failed to set User-Agent header")
                .build()
        )
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_http::init())
        .plugin(
            tauri_plugin_log::Builder::new()
                .target(tauri_plugin_log::Target::new(
                    tauri_plugin_log::TargetKind::LogDir {
                        file_name: Some("app".into()),
                    },
                ))
                .max_file_size(5_000_000) // 5MB per file
                .rotation_strategy(tauri_plugin_log::RotationStrategy::KeepAll)
                .level(log::LevelFilter::Info)
                .build(),
        )
        .setup(|app| {
            // Initialize debug module startup time
            debug::init_startup_time();
            
            // Start MCP HTTP server in dev mode
            #[cfg(debug_assertions)]
            {
                let app_handle = app.app_handle().clone();

                // Listen for PTY output events and forward to task manager
                // This must be registered before task manager is created to catch early events
                app.listen("pty-output", {
                    let app_handle = app_handle.clone();
                    move |event| {
                        let payload = event.payload();
                        if let Ok(pty_event) = serde_json::from_str::<serde_json::Value>(payload) {
                            if let (Some(pty_id), Some(data)) = (
                                pty_event.get("pty_id").and_then(|v| v.as_str()),
                                pty_event.get("data").and_then(|v| v.as_str()),
                            ) {
                                // Only process MCP tasks (pty_id starts with "mcp_")
                                if pty_id.starts_with("mcp_") {
                                    let app_handle = app_handle.clone();
                                    let pty_id = pty_id.to_string();
                                    let data = data.to_string();
                                    async_runtime::spawn(async move {
                                        if let Some(task_manager) = app_handle.try_state::<Arc<TerminalTaskManager>>() {
                                            task_manager.handle_pty_output(&pty_id, &data).await;
                                        }
                                    });
                                }
                            }
                        }
                    }
                });

                // Listen for PTY exit events and forward to task manager
                app.listen("pty-exit", {
                    let app_handle = app_handle.clone();
                    move |event| {
                        let payload = event.payload();
                        if let Ok(pty_event) = serde_json::from_str::<serde_json::Value>(payload) {
                            if let Some(pty_id) = pty_event.get("pty_id").and_then(|v| v.as_str()) {
                                // Only process MCP tasks (pty_id starts with "mcp_")
                                if pty_id.starts_with("mcp_") {
                                    let exit_code = pty_event.get("exit_code").and_then(|v| v.as_i64()).map(|c| c as i32);
                                    let app_handle = app_handle.clone();
                                    let pty_id = pty_id.to_string();
                                    async_runtime::spawn(async move {
                                        if let Some(task_manager) = app_handle.try_state::<Arc<TerminalTaskManager>>() {
                                            task_manager.handle_pty_exit(&pty_id, exit_code).await;
                                        }
                                    });
                                }
                            }
                        }
                    }
                });

                async_runtime::spawn(async move {
                    // Small delay to ensure app is fully initialized
                    tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;

                    // Create and initialize terminal task manager without PtyManager for now
                    // We'll need to refactor to allow passing PtyManager later
                    let pty_manager = PtyManager::new();
                    let task_manager = Arc::new(TerminalTaskManager::new(Arc::new(pty_manager), app_handle.clone()));

                    // Store task manager in app state
                    app_handle.manage(task_manager.clone());

                    if let Err(e) = mcp_http_server::start_server(app_handle, 3001, Some(task_manager)).await {
                        warn!("[MCP] Failed to start MCP HTTP server: {}", e);
                    } else {
                        info!("[MCP] MCP HTTP server started successfully with terminal task manager");
                    }
                });
            }
            
            info!("[APP] Rebebuca starting up...");

            // Ensure main window is visible
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
                info!("[APP] Main window shown");
            } else {
                info!("[APP] Warning: Main window not found");
            }

            // Create a simple static tray icon
            // The frontend can create additional dynamic menus if needed
            info!("[TRAY] Creating tray icon in Rust backend");

            // Create tray menu items
            let quit_item = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;
            let show_item = MenuItem::with_id(app, "show", "显示主窗口", true, None::<&str>)?;
            let devtools_item = MenuItem::with_id(app, "devtools", "打开开发者工具", true, None::<&str>)?;

            // Create the menu
            let menu = Menu::with_items(app, &[&show_item, &devtools_item, &quit_item])?;

            // Create application menu with Edit submenu (for copy/paste shortcuts) and Help submenu
            // Edit menu - required for keyboard shortcuts on macOS
            let edit_submenu = Submenu::with_items(
                app,
                "Edit",
                true,
                &[
                    &PredefinedMenuItem::undo(app, Some("Undo"))?,
                    &PredefinedMenuItem::redo(app, Some("Redo"))?,
                    &PredefinedMenuItem::separator(app)?,
                    &PredefinedMenuItem::cut(app, Some("Cut"))?,
                    &PredefinedMenuItem::copy(app, Some("Copy"))?,
                    &PredefinedMenuItem::paste(app, Some("Paste"))?,
                    &PredefinedMenuItem::select_all(app, Some("Select All"))?,
                ],
            )?;

            // Help menu
            let about_item = MenuItem::with_id(app, "about", "关于 Rebebuca", true, None::<&str>)?;
            let website_item = MenuItem::with_id(app, "website", "访问官网", true, None::<&str>)?;
            let help_devtools_item = MenuItem::with_id(app, "app-devtools", "打开开发者工具", true, None::<&str>)?;
            let help_submenu =
                Submenu::with_items(app, "帮助", true, &[&about_item, &website_item, &help_devtools_item])?;

            let app_menu = Menu::with_items(app, &[&edit_submenu, &help_submenu])?;
            app.set_menu(app_menu)?;

            // Handle application menu events
            app.on_menu_event(|app_handle, event| {
                match event.id.as_ref() {
                    "about" => {
                        info!("[MENU] About menu item clicked");
                        // Emit event to frontend to show about dialog
                        let _ = app_handle.emit("show-about-dialog", ());
                    }
                    "website" => {
                        info!("[MENU] Website menu item clicked");
                        // Open the website in default browser
                        #[cfg(target_os = "macos")]
                        {
                            let _ =
                                std::process::Command::new("open")
                                    .arg("https://rebebuca.com")
                                    .spawn();
                        }
                        #[cfg(target_os = "windows")]
                        {
                            let _ = std::process::Command::new("cmd")
                                .args(["/c", "start", "https://rebebuca.com"])
                                .spawn();
                        }
                        #[cfg(target_os = "linux")]
                        {
                            let _ = std::process::Command::new("xdg-open")
                                .arg("https://rebebuca.com")
                                .spawn();
                        }
                    }
                    "devtools" | "app-devtools" => {
                        info!("[MENU] Developer tools menu item clicked");
                        // Open developer tools for the main window
                        if let Some(window) = app_handle.get_webview_window("main") {
                            let _ = window.open_devtools();
                            info!("[MENU] Developer tools opened");
                        } else {
                            info!("[MENU] Main window not found");
                        }
                    }
                    _ => {}
                }
            });

            // Get the default window icon
            let tray_icon = app
                .default_window_icon()
                .ok_or("No default window icon available")?
                .clone();

            // Create tray icon - use a unique ID
            let _tray = TrayIconBuilder::with_id("rust-tray")
                .icon(tray_icon)
                .menu(&menu)
                .show_menu_on_left_click(false) // macOS: right-click for menu
                .on_menu_event(|app, event| {
                    let event_id = event.id.as_ref();
                    info!("[TRAY] Menu event: {}", event_id);

                    // Handle static menu items
                    match event_id {
                        "quit" => {
                            info!("[TRAY] Quit menu item clicked");
                            app.exit(0);
                        }
                        "show" => {
                            info!("[TRAY] Show menu item clicked");
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                        "devtools" => {
                            info!("[TRAY] Developer tools menu item clicked");
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.open_devtools();
                                info!("[TRAY] Developer tools opened");
                                // Also show the window when opening devtools
                                let _ = window.show();
                                let _ = window.set_focus();
                            } else {
                                info!("[TRAY] Main window not found");
                            }
                        }
                        _ => {
                            // Handle dynamic menu items (restart, stop, force_stop, run_favorite, run_recent)
                            if event_id.starts_with("restart:") {
                                let process_id = event_id.strip_prefix("restart:").unwrap_or("");
                                info!("[TRAY] Restart process: {}", process_id);
                                let _ = app.emit("tray-restart-process", process_id.to_string());
                            } else if event_id.starts_with("force_stop:") {
                                let process_id = event_id.strip_prefix("force_stop:").unwrap_or("");
                                info!("[TRAY] Force stop process: {}", process_id);
                                let _ = app.emit("tray-force-stop-process", process_id.to_string());
                            } else if event_id.starts_with("stop:") {
                                let process_id = event_id.strip_prefix("stop:").unwrap_or("");
                                info!("[TRAY] Stop process: {}", process_id);
                                let _ = app.emit("tray-stop-process", process_id.to_string());
                            } else if event_id.starts_with("run_favorite:") {
                                let task_id = event_id.strip_prefix("run_favorite:").unwrap_or("");
                                info!("[TRAY] Run favorite task: {}", task_id);
                                let _ = app.emit("tray-run-favorite", task_id.to_string());
                            } else if event_id.starts_with("run_recent:") {
                                let task_id = event_id.strip_prefix("run_recent:").unwrap_or("");
                                info!("[TRAY] Run recent task: {}", task_id);
                                let _ = app.emit("tray-run-recent", task_id.to_string());
                            }
                        }
                    }
                })
                .on_tray_icon_event(|tray, event| {
                    // Handle left-click to show window
                    if let tauri::tray::TrayIconEvent::Click { button, .. } = event {
                        if button == tauri::tray::MouseButton::Left {
                            info!("[TRAY] Tray icon left-clicked");
                            if let Some(app) = tray.app_handle().get_webview_window("main") {
                                let _ = app.show();
                                let _ = app.set_focus();
                            }
                        }
                    }
                })
                .build(app)?;

            info!("[TRAY] Tray icon created successfully");
            Ok(())
        })
        .manage(ProcessManager::new())
        .manage(PtyManager::new())
        .manage(TrayState::new())
        .manage(orchestration::SessionManager::new())
        .invoke_handler(tauri::generate_handler![
            // commands module
            commands::greet,
            commands::open_logs_folder,
            commands::open_file_with_default_app,
            commands::open_in_system_terminal,
            commands::delete_log_file,
            commands::generate_log_path,
            commands::rename_log_file,
            commands::read_log_file,
            commands::get_app_log_dir,
            commands::open_app_log_folder,
            commands::list_app_log_files,
            commands::read_app_log_file,
            commands::clear_app_log_file,
            commands::get_available_terminals,
            commands::open_in_specific_terminal,
            commands::get_available_shells,
            commands::execute_powershell_command,
            commands::check_full_disk_access,
            commands::open_full_disk_access_settings,
            commands::open_url_in_browser,
            commands::fetch_models,
            oauth_callback_server::start_oauth_callback_server,
            // process module
            process::execute_command,
            process::kill_process_cmd,
            process::restart_process,
            process::get_process_stats,
            process::get_running_processes,
            // tray module
            tray::update_tray_running_processes,
            tray::update_tray_favorites,
            tray::update_tray_recent_tasks,
            // port module
            port::get_port_processes,
            port::kill_process_by_port,
            port::kill_process_by_pid,
            // admin module
            admin::execute_with_admin,
            admin::request_folder_access,
            admin::check_needs_admin,
            // pty module
            create_pty,
            write_pty,
            resize_pty,
            close_pty,
            execute_task,
            kill_task,
            force_kill_task,
            is_task_running,
            get_pty_process_stats,
            get_shell_integration_path,
            // ssh module
            ssh::test_ssh_connection,
            ssh::execute_ssh_command,
            ssh::execute_ssh_command_by_id,
            ssh::close_ssh_connection,
            ssh::list_ssh_configs,
            ssh::save_ssh_config,
            ssh::delete_ssh_config,
            ssh::get_ssh_connection_status,
            ssh::connect_ssh,
            ssh::disconnect_ssh,
            ssh::test_ssh_agent,
            ssh::list_ssh_directory,
            ssh::get_ssh_home_directory,
            ssh::get_ssh_shells,
            // debug module
            debug::get_frontend_logs,
            debug::get_tauri_logs,
            debug::get_dom_tree,
            debug::get_all_debug_info,
            debug::mcp_update_frontend_logs,
            debug::mcp_update_dom_tree,
            debug::mcp_update_task_list,
            debug::mcp_get_server_port,
            // orchestration module
            orchestration::create_orchestration_session,
            orchestration::start_orchestration,
            orchestration::stop_orchestration,
            orchestration::get_orchestration_status,
            orchestration::remove_orchestration_session,
            orchestration::check_boulder_state,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
