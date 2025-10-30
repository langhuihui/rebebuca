use gpui::*;
use rebebuca_core::{AppState, RunConfig};
use std::sync::Arc;
use crate::components::{ConfigSidebar, ConsoleArea, HistorySidebar, RunConfigDialog, SystemTray, I18nProvider, SettingsPanel, ErrorDisplay, ErrorNotification, CustomTitlebar};

pub struct RebebucaApp {
    app_state: Arc<AppState>,
    config_dialog: Option<RunConfigDialog>,
    settings_panel: Option<SettingsPanel>,
    error_display: Option<ErrorDisplay>,
    error_notification: Option<ErrorNotification>,
    selected_config: Option<RunConfig>,
    system_tray: Option<SystemTray>,
    sidebar_entity: Option<Entity<ConfigSidebar>>,
}

impl RebebucaApp {
    pub fn new(app_state: AppState) -> Self {
        let app_state = Arc::new(app_state);
        Self {
            app_state: app_state.clone(),
            config_dialog: None,
            settings_panel: None,
            error_display: Some(ErrorDisplay::new(app_state.clone())),
            error_notification: Some(ErrorNotification::new(app_state.clone())),
            selected_config: None,
            system_tray: None,
            sidebar_entity: None,
        }
    }

    pub fn initialize_system_tray(&mut self) {
        self.system_tray = Some(SystemTray::new(self.app_state.clone()));
    }

    pub fn get_i18n_provider(&self) -> I18nProvider {
        I18nProvider::new(self.app_state.clone())
    }

    pub fn open_config_dialog(&mut self, config: Option<RunConfig>) {
        eprintln!("[DEBUG] open_config_dialog called");
        self.config_dialog = Some(RunConfigDialog::new(self.app_state.clone()));
        if let Some(ref mut dialog) = self.config_dialog {
            dialog.open(config);
            eprintln!("[DEBUG] Dialog opened, is_open: {}", dialog.is_open());
        }
    }

    pub fn close_config_dialog(&mut self) {
        if let Some(ref mut dialog) = self.config_dialog {
            dialog.close();
        }
        self.config_dialog = None;
    }

    pub fn open_settings(&mut self) {
        self.settings_panel = Some(SettingsPanel::new(self.app_state.clone()));
        if let Some(ref mut panel) = self.settings_panel {
            panel.set_visible(true);
        }
    }

    pub fn close_settings(&mut self) {
        if let Some(ref mut panel) = self.settings_panel {
            panel.set_visible(false);
        }
        self.settings_panel = None;
    }

    pub fn show_error_display(&mut self) {
        if self.error_display.is_none() {
            self.error_display = Some(ErrorDisplay::new(self.app_state.clone()));
        }
    }

    pub fn hide_error_display(&mut self) {
        self.error_display = None;
    }

    pub fn add_error_notification(&mut self, error: rebebuca_core::AppError, severity: rebebuca_core::ErrorSeverity) {
        if let Some(ref mut notification) = self.error_notification {
            notification.add_notification(error, severity, true);
        }
    }

    pub fn execute_config(&mut self, config: RunConfig) {
        self.selected_config = Some(config);
        // The console area will handle the actual execution
    }

    pub async fn create_config(&mut self, config: RunConfig) -> Result<RunConfig, String> {
        match self.app_state.config_manager.create_config(config).await {
            Ok(new_config) => {
                // Update the run_configs list
                let mut configs = self.app_state.run_configs.lock().await;
                configs.push(new_config.clone());
                Ok(new_config)
            }
            Err(e) => Err(format!("Failed to create config: {}", e)),
        }
    }

    pub async fn update_config(&mut self, id: &str, config: RunConfig) -> Result<Option<RunConfig>, String> {
        match self.app_state.config_manager.update_config(id, config).await {
            Ok(Some(updated_config)) => {
                // Update the run_configs list
                let mut configs = self.app_state.run_configs.lock().await;
                if let Some(existing) = configs.iter_mut().find(|c| c.id == id) {
                    *existing = updated_config.clone();
                }
                Ok(Some(updated_config))
            }
            Ok(None) => Ok(None),
            Err(e) => Err(format!("Failed to update config: {}", e)),
        }
    }

    pub async fn delete_config(&mut self, id: &str) -> Result<bool, String> {
        match self.app_state.config_manager.delete_config(id).await {
            Ok(deleted) => {
                if deleted {
                    // Update the run_configs list
                    let mut configs = self.app_state.run_configs.lock().await;
                    configs.retain(|c| c.id != id);
                }
                Ok(deleted)
            }
            Err(e) => Err(format!("Failed to delete config: {}", e)),
        }
    }

    pub async fn duplicate_config(&mut self, id: &str) -> Result<Option<RunConfig>, String> {
        match self.app_state.config_manager.duplicate_config(id).await {
            Ok(Some(duplicated_config)) => {
                // Update the run_configs list
                let mut configs = self.app_state.run_configs.lock().await;
                configs.push(duplicated_config.clone());
                Ok(Some(duplicated_config))
            }
            Ok(None) => Ok(None),
            Err(e) => Err(format!("Failed to duplicate config: {}", e)),
        }
    }
}

impl Render for RebebucaApp {
    fn render(&mut self, window: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        div()
            .size_full()
            .bg(rgb(0x1e1e1e))
            .text_color(rgb(0xffffff))
            .relative() // Make this a positioning context for absolute children
            .child(
                // Main layout with three panels
                div()
                    .size_full()
                    .pt(px(52.0)) // Padding top for titlebar (44px titlebar + 8px extra margin)
                    .flex()
                    .gap_2()
                    .p_4()
                    .child(
                        // Left sidebar - Config list
                        div()
                            .w_64()
                            .h_full()
                            .child({
                                // Use window.use_state to persist sidebar entity across renders
                                let app_entity = cx.entity();
                                let app_entity_clone = app_entity.clone();
                                let app_state = self.app_state.clone();
                                window.use_state(cx, move |_window, cx| {
                                    let mut sidebar = ConfigSidebar::new(app_state);
                                    sidebar.set_app_entity(app_entity_clone.clone());
                                    sidebar
                                })
                            })
                    )
                    .child(
                        // Center - Console area
                        div()
                            .flex_1()
                            .h_full()
                            .child(
                                cx.new(|_cx| ConsoleArea::new(self.app_state.clone()))
                            )
                    )
                    .child(
                        // Right sidebar - History list
                        div()
                            .w_64()
                            .h_full()
                            .child(
                                cx.new(|_cx| HistorySidebar::new(self.app_state.clone()))
                            )
                    )
            )
            .child(
                // Custom titlebar - rendered last to ensure it's on top of everything
                cx.new(|_cx| CustomTitlebar::new("Rebebuca"))
            )
            // Settings panel
            .child(
                if let Some(ref mut panel) = self.settings_panel {
                    cx.new(|_cx| panel.clone())
                } else {
                    cx.new(|_cx| SettingsPanel::new(self.app_state.clone()))
                }
            )
            // Error display
            .child(
                if let Some(ref mut error_display) = self.error_display {
                    cx.new(|_cx| error_display.clone())
                } else {
                    cx.new(|_cx| ErrorDisplay::new(self.app_state.clone()))
                }
            )
            // Error notifications
            .child(
                if let Some(ref mut error_notification) = self.error_notification {
                    cx.new(|_cx| error_notification.clone())
                } else {
                    cx.new(|_cx| ErrorNotification::new(self.app_state.clone()))
                }
            )
            // Config dialog - render last to ensure it's on top
            .child({
                let has_dialog = self.config_dialog.is_some();
                if has_dialog {
                    eprintln!("[DEBUG] Rendering dialog, is_open: {}", self.config_dialog.as_ref().unwrap().is_open());
                }
                if let Some(ref mut dialog) = self.config_dialog {
                    cx.new(|_cx| dialog.clone())
                } else {
                    // Create a closed dialog as placeholder
                    cx.new(|_cx| {
                        let mut d = RunConfigDialog::new(self.app_state.clone());
                        d.close();
                        d
                    })
                }
            })
    }
}
