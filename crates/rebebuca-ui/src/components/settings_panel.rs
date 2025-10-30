use gpui::*;
use rebebuca_core::{AppState, AppSettings, Theme, get_available_themes, get_available_languages, get_available_fonts, get_font_size_options, get_default_shortcuts};
use std::sync::Arc;

/// Settings panel component
#[derive(Clone)]
pub struct SettingsPanel {
    app_state: Arc<AppState>,
    is_visible: bool,
    current_settings: AppSettings,
    selected_tab: SettingsTab,
}

#[derive(Debug, Clone, PartialEq)]
pub enum SettingsTab {
    General,
    Appearance,
    Behavior,
    Shortcuts,
    Advanced,
}

impl SettingsPanel {
    pub fn new(app_state: Arc<AppState>) -> Self {
        let current_settings = app_state.settings_manager.get_settings();
        Self {
            app_state,
            is_visible: false,
            current_settings,
            selected_tab: SettingsTab::General,
        }
    }

    pub fn set_visible(&mut self, visible: bool) {
        self.is_visible = visible;
        if visible {
            self.current_settings = self.app_state.settings_manager.get_settings();
        }
    }

    pub fn set_tab(&mut self, tab: SettingsTab) {
        self.selected_tab = tab;
    }

    pub fn get_current_settings(&self) -> &AppSettings {
        &self.current_settings
    }

    pub fn update_setting<F>(&mut self, updater: F) -> anyhow::Result<()>
    where
        F: FnOnce(&mut AppSettings),
    {
        updater(&mut self.current_settings);
        self.app_state.settings_manager.update_settings(|s| {
            *s = self.current_settings.clone();
        })?;
        Ok(())
    }

    pub fn reset_to_defaults(&mut self) -> anyhow::Result<()> {
        self.app_state.settings_manager.reset_to_defaults()?;
        self.current_settings = self.app_state.settings_manager.get_settings();
        Ok(())
    }

    fn render_tab_button(&self, tab: SettingsTab, label: &str, _cx: &mut Context<Self>) -> AnyElement {
        let is_selected = self.selected_tab == tab;
        div()
            .px_4()
            .py_2()
            .bg(if is_selected { rgb(0x007acc) } else { rgb(0x2a2a2a) })
            .text_color(if is_selected { rgb(0xffffff) } else { rgb(0xcccccc) })
            .text_sm()
            .rounded_md()
            .cursor_pointer()
            .hover(|style| style.bg(if is_selected { rgb(0x005a9e) } else { rgb(0x3a3a3a) }))
            .child(label.to_string())
            .into_any()
    }

    fn render_general_tab(&self, _cx: &mut Context<Self>) -> AnyElement {
        div()
            .flex_1()
            .p_6()
            .gap_y_4()
            .child(
                // Language
                div()
                    .gap_y_2()
                    .child(
                        div()
                            .text_sm()
                            .text_color(rgb(0xcccccc))
                            .child("Language")
                    )
                    .child(
                        div()
                            .flex()
                            .gap_2()
                            .children(
                                get_available_languages()
                                    .iter()
                                    .map(|(code, name)| {
                                        let is_selected = self.current_settings.language == *code;
                                        div()
                                            .px_3()
                                            .py_2()
                                            .bg(if is_selected { rgb(0x007acc) } else { rgb(0x404040) })
                                            .text_color(if is_selected { rgb(0xffffff) } else { rgb(0xcccccc) })
                                            .text_sm()
                                            .rounded_md()
                                            .cursor_pointer()
                                            .hover(|style| style.bg(if is_selected { rgb(0x005a9e) } else { rgb(0x505050) }))
                                            .child(format!("{} ({})", name, code))
                                    })
                                    .collect::<Vec<_>>()
                            )
                    )
            )
            .child(
                // Auto save
                div()
                    .flex()
                    .items_center()
                    .justify_between()
                    .child(
                        div()
                            .text_sm()
                            .text_color(rgb(0xcccccc))
                            .child("Auto save")
                    )
                    .child(
                        div()
                            .w_12()
                            .h_6()
                            .bg(if self.current_settings.auto_save { rgb(0x007acc) } else { rgb(0x404040) })
                            .rounded_full()
                            .cursor_pointer()
                            .child(
                                div()
                                    .w_5()
                                    .h_5()
                                    .bg(rgb(0xffffff))
                                    .rounded_full()
                                    .ml_1()
                                    .mt_0p5()
                            )
                    )
            )
            .child(
                // Confirm before delete
                div()
                    .flex()
                    .items_center()
                    .justify_between()
                    .child(
                        div()
                            .text_sm()
                            .text_color(rgb(0xcccccc))
                            .child("Confirm before delete")
                    )
                    .child(
                        div()
                            .w_12()
                            .h_6()
                            .bg(if self.current_settings.confirm_before_delete { rgb(0x007acc) } else { rgb(0x404040) })
                            .rounded_full()
                            .cursor_pointer()
                            .child(
                                div()
                                    .w_5()
                                    .h_5()
                                    .bg(rgb(0xffffff))
                                    .rounded_full()
                                    .ml_1()
                                    .mt_0p5()
                            )
                    )
            )
            .into_any()
    }

    fn render_appearance_tab(&self, _cx: &mut Context<Self>) -> AnyElement {
        div()
            .flex_1()
            .p_6()
            .gap_y_4()
            .child(
                // Theme
                div()
                    .gap_y_2()
                    .child(
                        div()
                            .text_sm()
                            .text_color(rgb(0xcccccc))
                            .child("Theme")
                    )
                    .child(
                        div()
                            .flex()
                            .gap_2()
                            .children(
                                get_available_themes()
                                    .iter()
                                    .map(|theme| {
                                        let is_selected = self.current_settings.theme == *theme;
                                        let theme_name = match theme {
                                            Theme::Light => "Light",
                                            Theme::Dark => "Dark",
                                            Theme::Auto => "Auto",
                                        };
                                        div()
                                            .px_3()
                                            .py_2()
                                            .bg(if is_selected { rgb(0x007acc) } else { rgb(0x404040) })
                                            .text_color(if is_selected { rgb(0xffffff) } else { rgb(0xcccccc) })
                                            .text_sm()
                                            .rounded_md()
                                            .cursor_pointer()
                                            .hover(|style| style.bg(if is_selected { rgb(0x005a9e) } else { rgb(0x505050) }))
                                            .child(theme_name)
                                    })
                                    .collect::<Vec<_>>()
                            )
                    )
            )
            .child(
                // Font family
                div()
                    .gap_y_2()
                    .child(
                        div()
                            .text_sm()
                            .text_color(rgb(0xcccccc))
                            .child("Font Family")
                    )
                    .child(
                        div()
                            .flex()
                            .gap_2()
                            .children(
                                get_available_fonts()
                                    .iter()
                                    .map(|font| {
                                        let is_selected = self.current_settings.font_family == *font;
                                        div()
                                            .px_3()
                                            .py_2()
                                            .bg(if is_selected { rgb(0x007acc) } else { rgb(0x404040) })
                                            .text_color(if is_selected { rgb(0xffffff) } else { rgb(0xcccccc) })
                                            .text_sm()
                                            .rounded_md()
                                            .cursor_pointer()
                                            .hover(|style| style.bg(if is_selected { rgb(0x005a9e) } else { rgb(0x505050) }))
                                            .child(*font)
                                    })
                                    .collect::<Vec<_>>()
                            )
                    )
            )
            .child(
                // Font size
                div()
                    .gap_y_2()
                    .child(
                        div()
                            .text_sm()
                            .text_color(rgb(0xcccccc))
                            .child("Font Size")
                    )
                    .child(
                        div()
                            .flex()
                            .gap_2()
                            .children(
                                get_font_size_options()
                                    .iter()
                                    .map(|size| {
                                        let is_selected = self.current_settings.font_size == *size;
                                        div()
                                            .px_3()
                                            .py_2()
                                            .bg(if is_selected { rgb(0x007acc) } else { rgb(0x404040) })
                                            .text_color(if is_selected { rgb(0xffffff) } else { rgb(0xcccccc) })
                                            .text_sm()
                                            .rounded_md()
                                            .cursor_pointer()
                                            .hover(|style| style.bg(if is_selected { rgb(0x005a9e) } else { rgb(0x505050) }))
                                            .child(size.to_string())
                                    })
                                    .collect::<Vec<_>>()
                            )
                    )
            )
            .into_any()
    }

    fn render_behavior_tab(&self, _cx: &mut Context<Self>) -> AnyElement {
        div()
            .flex_1()
            .p_6()
            .gap_y_4()
            .child(
                // Show line numbers
                div()
                    .flex()
                    .items_center()
                    .justify_between()
                    .child(
                        div()
                            .text_sm()
                            .text_color(rgb(0xcccccc))
                            .child("Show line numbers")
                    )
                    .child(
                        div()
                            .w_12()
                            .h_6()
                            .bg(if self.current_settings.show_line_numbers { rgb(0x007acc) } else { rgb(0x404040) })
                            .rounded_full()
                            .cursor_pointer()
                            .child(
                                div()
                                    .w_5()
                                    .h_5()
                                    .bg(rgb(0xffffff))
                                    .rounded_full()
                                    .ml_1()
                                    .mt_0p5()
                            )
                    )
            )
            .child(
                // Word wrap
                div()
                    .flex()
                    .items_center()
                    .justify_between()
                    .child(
                        div()
                            .text_sm()
                            .text_color(rgb(0xcccccc))
                            .child("Word wrap")
                    )
                    .child(
                        div()
                            .w_12()
                            .h_6()
                            .bg(if self.current_settings.word_wrap { rgb(0x007acc) } else { rgb(0x404040) })
                            .rounded_full()
                            .cursor_pointer()
                            .child(
                                div()
                                    .w_5()
                                    .h_5()
                                    .bg(rgb(0xffffff))
                                    .rounded_full()
                                    .ml_1()
                                    .mt_0p5()
                            )
                    )
            )
            .child(
                // Auto scroll
                div()
                    .flex()
                    .items_center()
                    .justify_between()
                    .child(
                        div()
                            .text_sm()
                            .text_color(rgb(0xcccccc))
                            .child("Auto scroll")
                    )
                    .child(
                        div()
                            .w_12()
                            .h_6()
                            .bg(if self.current_settings.auto_scroll { rgb(0x007acc) } else { rgb(0x404040) })
                            .rounded_full()
                            .cursor_pointer()
                            .child(
                                div()
                                    .w_5()
                                    .h_5()
                                    .bg(rgb(0xffffff))
                                    .rounded_full()
                                    .ml_1()
                                    .mt_0p5()
                            )
                    )
            )
            .child(
                // Show system tray
                div()
                    .flex()
                    .items_center()
                    .justify_between()
                    .child(
                        div()
                            .text_sm()
                            .text_color(rgb(0xcccccc))
                            .child("Show system tray")
                    )
                    .child(
                        div()
                            .w_12()
                            .h_6()
                            .bg(if self.current_settings.show_system_tray { rgb(0x007acc) } else { rgb(0x404040) })
                            .rounded_full()
                            .cursor_pointer()
                            .child(
                                div()
                                    .w_5()
                                    .h_5()
                                    .bg(rgb(0xffffff))
                                    .rounded_full()
                                    .ml_1()
                                    .mt_0p5()
                            )
                    )
            )
            .child(
                // Minimize to tray
                div()
                    .flex()
                    .items_center()
                    .justify_between()
                    .child(
                        div()
                            .text_sm()
                            .text_color(rgb(0xcccccc))
                            .child("Minimize to tray")
                    )
                    .child(
                        div()
                            .w_12()
                            .h_6()
                            .bg(if self.current_settings.minimize_to_tray { rgb(0x007acc) } else { rgb(0x404040) })
                            .rounded_full()
                            .cursor_pointer()
                            .child(
                                div()
                                    .w_5()
                                    .h_5()
                                    .bg(rgb(0xffffff))
                                    .rounded_full()
                                    .ml_1()
                                    .mt_0p5()
                            )
                    )
            )
            .into_any()
    }

    fn render_shortcuts_tab(&self, _cx: &mut Context<Self>) -> AnyElement {
        let default_shortcuts = get_default_shortcuts();
        
        div()
            .flex_1()
            .p_6()
            .gap_y_4()
            .child(
                div()
                    .text_sm()
                    .text_color(rgb(0xcccccc))
                    .child("Keyboard Shortcuts")
            )
            .child(
                div()
                    .gap_y_2()
                    .children(
                        default_shortcuts
                            .iter()
                            .map(|(action, shortcut)| {
                                div()
                                    .flex()
                                    .items_center()
                                    .justify_between()
                                    .p_3()
                                    .bg(rgb(0x2a2a2a))
                                    .rounded_md()
                                    .child(
                                        div()
                                            .text_sm()
                                            .text_color(rgb(0xcccccc))
                                            .child(action.replace("_", " ").to_uppercase())
                                    )
                                    .child(
                                        div()
                                            .px_2()
                                            .py_1()
                                            .bg(rgb(0x404040))
                                            .text_color(rgb(0xffffff))
                                            .text_sm()
                                            .rounded_md()
                                            .child(shortcut.clone())
                                    )
                            })
                            .collect::<Vec<_>>()
                    )
            )
            .into_any()
    }

    fn render_advanced_tab(&self, _cx: &mut Context<Self>) -> AnyElement {
        div()
            .flex_1()
            .p_6()
            .gap_y_4()
            .child(
                // Max history items
                div()
                    .gap_y_2()
                    .child(
                        div()
                            .text_sm()
                            .text_color(rgb(0xcccccc))
                            .child("Max history items")
                    )
                    .child(
                        div()
                            .px_3()
                            .py_2()
                            .bg(rgb(0x2a2a2a))
                            .text_color(rgb(0xffffff))
                            .text_sm()
                            .rounded_md()
                            .child(self.current_settings.max_history_items.to_string())
                    )
            )
            .child(
                // Console buffer size
                div()
                    .gap_y_2()
                    .child(
                        div()
                            .text_sm()
                            .text_color(rgb(0xcccccc))
                            .child("Console buffer size")
                    )
                    .child(
                        div()
                            .px_3()
                            .py_2()
                            .bg(rgb(0x2a2a2a))
                            .text_color(rgb(0xffffff))
                            .text_sm()
                            .rounded_md()
                            .child(self.current_settings.console_buffer_size.to_string())
                    )
            )
            .child(
                // Reset to defaults button
                div()
                    .pt_4()
                    .child(
                        div()
                            .px_4()
                            .py_2()
                            .bg(rgb(0xdc3545))
                            .text_color(rgb(0xffffff))
                            .text_sm()
                            .rounded_md()
                            .cursor_pointer()
                            .hover(|style| style.bg(rgb(0xc82333)))
                            .child("Reset to defaults")
                    )
            )
            .into_any()
    }
}

impl Render for SettingsPanel {
    #[allow(refining_impl_trait)]
    fn render(&mut self, _: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        if !self.is_visible {
            return div();
        }

        div()
            .absolute()
            .inset_0()
            .bg(rgba(0x80000000))
            .flex()
            .items_center()
            .justify_center()
            .child(
                div()
                    .w_96()
                    .h_96()
                    .bg(rgb(0x1e1e1e))
                    .rounded_lg()
                    .border_1()
                    .border_color(rgb(0x404040))
                    .flex()
                    .flex_col()
                    .child(
                        // Header
                        div()
                            .flex()
                            .items_center()
                            .justify_between()
                            .p_4()
                            .border_b_1()
                            .border_color(rgb(0x404040))
                            .child(
                                div()
                                    .text_lg()
                                    .text_color(rgb(0xffffff))
                                    .font_weight(FontWeight::BOLD)
                                    .child("Settings")
                            )
                            .child(
                                div()
                                    .w_8()
                                    .h_8()
                                    .bg(rgb(0xdc3545))
                                    .text_color(rgb(0xffffff))
                                    .rounded_full()
                                    .flex()
                                    .items_center()
                                    .justify_center()
                                    .cursor_pointer()
                                    .hover(|style| style.bg(rgb(0xc82333)))
                                    .child("×")
                            )
                    )
                    .child(
                        div()
                            .flex()
                            .flex_1()
                            .child(
                                // Sidebar
                                div()
                                    .w_48()
                                    .bg(rgb(0x2a2a2a))
                                    .border_r_1()
                                    .border_color(rgb(0x404040))
                                    .p_4()
                                    .gap_y_2()
                                    .child(self.render_tab_button(SettingsTab::General, "General", cx).into_any())
                                    .child(self.render_tab_button(SettingsTab::Appearance, "Appearance", cx).into_any())
                                    .child(self.render_tab_button(SettingsTab::Behavior, "Behavior", cx).into_any())
                                    .child(self.render_tab_button(SettingsTab::Shortcuts, "Shortcuts", cx).into_any())
                                    .child(self.render_tab_button(SettingsTab::Advanced, "Advanced", cx).into_any())
                            )
                            .child(
                                // Content
                                match self.selected_tab {
                                    SettingsTab::General => self.render_general_tab(cx).into_any(),
                                    SettingsTab::Appearance => self.render_appearance_tab(cx).into_any(),
                                    SettingsTab::Behavior => self.render_behavior_tab(cx).into_any(),
                                    SettingsTab::Shortcuts => self.render_shortcuts_tab(cx).into_any(),
                                    SettingsTab::Advanced => self.render_advanced_tab(cx).into_any(),
                                }
                            )
                    )
            )
    }
}
