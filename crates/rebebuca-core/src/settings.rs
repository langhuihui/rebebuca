use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, RwLock};

/// Application settings
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppSettings {
    pub theme: Theme,
    pub language: String,
    pub font_family: String,
    pub font_size: u16,
    pub auto_save: bool,
    pub max_history_items: usize,
    pub console_buffer_size: usize,
    pub show_line_numbers: bool,
    pub word_wrap: bool,
    pub auto_scroll: bool,
    pub confirm_before_delete: bool,
    pub show_system_tray: bool,
    pub minimize_to_tray: bool,
    pub start_minimized: bool,
    pub window_width: u32,
    pub window_height: u32,
    pub window_x: i32,
    pub window_y: i32,
    pub window_maximized: bool,
    pub sidebar_width: u32,
    pub history_sidebar_width: u32,
    pub custom_shortcuts: HashMap<String, String>,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            theme: Theme::Dark,
            language: "en".to_string(),
            font_family: "Monaco, 'Courier New', monospace".to_string(),
            font_size: 14,
            auto_save: true,
            max_history_items: 1000,
            console_buffer_size: 10000,
            show_line_numbers: true,
            word_wrap: false,
            auto_scroll: true,
            confirm_before_delete: true,
            show_system_tray: true,
            minimize_to_tray: true,
            start_minimized: false,
            window_width: 1200,
            window_height: 800,
            window_x: 100,
            window_y: 100,
            window_maximized: false,
            sidebar_width: 300,
            history_sidebar_width: 250,
            custom_shortcuts: HashMap::new(),
        }
    }
}

/// Theme options
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum Theme {
    Light,
    Dark,
    Auto,
}

/// Settings manager
#[derive(Debug)]
pub struct SettingsManager {
    settings: Arc<RwLock<AppSettings>>,
    settings_file: String,
}

impl SettingsManager {
    pub fn new(settings_file: String) -> Result<Self> {
        let settings = if std::path::Path::new(&settings_file).exists() {
            let content = std::fs::read_to_string(&settings_file)?;
            serde_json::from_str(&content).unwrap_or_default()
        } else {
            AppSettings::default()
        };

        Ok(Self {
            settings: Arc::new(RwLock::new(settings)),
            settings_file,
        })
    }

    pub fn get_settings(&self) -> AppSettings {
        self.settings.read().unwrap().clone()
    }

    pub fn update_settings<F>(&self, updater: F) -> Result<()>
    where
        F: FnOnce(&mut AppSettings),
    {
        let mut settings = self.settings.write().unwrap();
        updater(&mut settings);
        self.save_settings()?;
        Ok(())
    }

    pub fn set_theme(&self, theme: Theme) -> Result<()> {
        self.update_settings(|s| s.theme = theme)
    }

    pub fn set_language(&self, language: String) -> Result<()> {
        self.update_settings(|s| s.language = language)
    }

    pub fn set_font_family(&self, font_family: String) -> Result<()> {
        self.update_settings(|s| s.font_family = font_family)
    }

    pub fn set_font_size(&self, font_size: u16) -> Result<()> {
        self.update_settings(|s| s.font_size = font_size)
    }

    pub fn set_auto_save(&self, auto_save: bool) -> Result<()> {
        self.update_settings(|s| s.auto_save = auto_save)
    }

    pub fn set_max_history_items(&self, max_items: usize) -> Result<()> {
        self.update_settings(|s| s.max_history_items = max_items)
    }

    pub fn set_console_buffer_size(&self, buffer_size: usize) -> Result<()> {
        self.update_settings(|s| s.console_buffer_size = buffer_size)
    }

    pub fn set_show_line_numbers(&self, show: bool) -> Result<()> {
        self.update_settings(|s| s.show_line_numbers = show)
    }

    pub fn set_word_wrap(&self, wrap: bool) -> Result<()> {
        self.update_settings(|s| s.word_wrap = wrap)
    }

    pub fn set_auto_scroll(&self, auto_scroll: bool) -> Result<()> {
        self.update_settings(|s| s.auto_scroll = auto_scroll)
    }

    pub fn set_confirm_before_delete(&self, confirm: bool) -> Result<()> {
        self.update_settings(|s| s.confirm_before_delete = confirm)
    }

    pub fn set_show_system_tray(&self, show: bool) -> Result<()> {
        self.update_settings(|s| s.show_system_tray = show)
    }

    pub fn set_minimize_to_tray(&self, minimize: bool) -> Result<()> {
        self.update_settings(|s| s.minimize_to_tray = minimize)
    }

    pub fn set_start_minimized(&self, start_minimized: bool) -> Result<()> {
        self.update_settings(|s| s.start_minimized = start_minimized)
    }

    pub fn set_window_size(&self, width: u32, height: u32) -> Result<()> {
        self.update_settings(|s| {
            s.window_width = width;
            s.window_height = height;
        })
    }

    pub fn set_window_position(&self, x: i32, y: i32) -> Result<()> {
        self.update_settings(|s| {
            s.window_x = x;
            s.window_y = y;
        })
    }

    pub fn set_window_maximized(&self, maximized: bool) -> Result<()> {
        self.update_settings(|s| s.window_maximized = maximized)
    }

    pub fn set_sidebar_width(&self, width: u32) -> Result<()> {
        self.update_settings(|s| s.sidebar_width = width)
    }

    pub fn set_history_sidebar_width(&self, width: u32) -> Result<()> {
        self.update_settings(|s| s.history_sidebar_width = width)
    }

    pub fn set_custom_shortcut(&self, action: String, shortcut: String) -> Result<()> {
        self.update_settings(|s| {
            s.custom_shortcuts.insert(action, shortcut);
        })
    }

    pub fn remove_custom_shortcut(&self, action: String) -> Result<()> {
        self.update_settings(|s| {
            s.custom_shortcuts.remove(&action);
        })
    }

    pub fn reset_to_defaults(&self) -> Result<()> {
        let mut settings = self.settings.write().unwrap();
        *settings = AppSettings::default();
        self.save_settings()?;
        Ok(())
    }

    fn save_settings(&self) -> Result<()> {
        let settings = self.settings.read().unwrap();
        let content = serde_json::to_string_pretty(&*settings)?;
        std::fs::write(&self.settings_file, content)?;
        Ok(())
    }
}

/// Available themes
pub fn get_available_themes() -> Vec<Theme> {
    vec![Theme::Light, Theme::Dark, Theme::Auto]
}

/// Available languages
pub fn get_available_languages() -> Vec<(&'static str, &'static str)> {
    vec![
        ("en", "English"),
        ("zh-CN", "简体中文"),
        ("zh-TW", "繁體中文"),
        ("ja", "日本語"),
        ("ko", "한국어"),
        ("fr", "Français"),
        ("de", "Deutsch"),
        ("es", "Español"),
        ("ru", "Русский"),
        ("pt", "Português"),
    ]
}

/// Available font families
pub fn get_available_fonts() -> Vec<&'static str> {
    vec![
        "Monaco, 'Courier New', monospace",
        "'Fira Code', 'Courier New', monospace",
        "'JetBrains Mono', 'Courier New', monospace",
        "'Source Code Pro', 'Courier New', monospace",
        "'Consolas', 'Courier New', monospace",
        "'Menlo', 'Monaco', monospace",
        "'Ubuntu Mono', 'Courier New', monospace",
        "'Roboto Mono', 'Courier New', monospace",
    ]
}

/// Font size options
pub fn get_font_size_options() -> Vec<u16> {
    vec![10, 11, 12, 13, 14, 15, 16, 17, 18, 20, 22, 24, 26, 28, 30]
}

/// Default shortcuts
pub fn get_default_shortcuts() -> HashMap<String, String> {
    let mut shortcuts = HashMap::new();
    shortcuts.insert("new_config".to_string(), "Ctrl+N".to_string());
    shortcuts.insert("edit_config".to_string(), "Ctrl+E".to_string());
    shortcuts.insert("delete_config".to_string(), "Delete".to_string());
    shortcuts.insert("run_config".to_string(), "F5".to_string());
    shortcuts.insert("stop_config".to_string(), "Ctrl+C".to_string());
    shortcuts.insert("toggle_search".to_string(), "Ctrl+F".to_string());
    shortcuts.insert("toggle_filter".to_string(), "Ctrl+Shift+F".to_string());
    shortcuts.insert("toggle_theme".to_string(), "Ctrl+Shift+T".to_string());
    shortcuts.insert("toggle_fullscreen".to_string(), "F11".to_string());
    shortcuts.insert("quit".to_string(), "Ctrl+Q".to_string());
    shortcuts
}
