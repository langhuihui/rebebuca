use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Translations {
    pub language: String,
    pub translations: HashMap<String, String>,
}

impl Default for Translations {
    fn default() -> Self {
        Self {
            language: "en".to_string(),
            translations: HashMap::new(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct I18nManager {
    current_language: String,
    translations: HashMap<String, Translations>,
}

impl Default for I18nManager {
    fn default() -> Self {
        let mut manager = Self {
            current_language: "en".to_string(),
            translations: HashMap::new(),
        };
        
        // Load default translations
        manager.load_default_translations();
        manager
    }
}

impl I18nManager {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn load_default_translations(&mut self) {
        // English translations
        let mut en_translations = HashMap::new();
        en_translations.insert("app.title".to_string(), "Rebebuca".to_string());
        en_translations.insert("app.welcome".to_string(), "Welcome to Rebebuca".to_string());
        en_translations.insert("app.welcome.subtitle".to_string(), "Select a configuration to run or create a new one".to_string());
        
        // Config sidebar
        en_translations.insert("config.title".to_string(), "Configurations".to_string());
        en_translations.insert("config.new".to_string(), "New Config".to_string());
        en_translations.insert("config.no_configs".to_string(), "No configurations yet".to_string());
        en_translations.insert("config.play".to_string(), "Play".to_string());
        en_translations.insert("config.edit".to_string(), "Edit".to_string());
        en_translations.insert("config.delete".to_string(), "Delete".to_string());
        en_translations.insert("config.duplicate".to_string(), "Duplicate".to_string());
        
        // Console area
        en_translations.insert("console.restart".to_string(), "Restart".to_string());
        en_translations.insert("console.stop".to_string(), "Stop".to_string());
        en_translations.insert("console.clear".to_string(), "Clear".to_string());
        en_translations.insert("console.no_output".to_string(), "No output yet...".to_string());
        
        // History sidebar
        en_translations.insert("history.title".to_string(), "History".to_string());
        en_translations.insert("history.clear".to_string(), "Clear History".to_string());
        en_translations.insert("history.no_history".to_string(), "No history yet".to_string());
        en_translations.insert("history.status.running".to_string(), "Running".to_string());
        en_translations.insert("history.status.success".to_string(), "Success".to_string());
        en_translations.insert("history.status.failed".to_string(), "Failed".to_string());
        en_translations.insert("history.status.stopped".to_string(), "Stopped".to_string());
        
        // Config dialog
        en_translations.insert("dialog.new_config".to_string(), "New Configuration".to_string());
        en_translations.insert("dialog.edit_config".to_string(), "Edit Configuration".to_string());
        en_translations.insert("dialog.name".to_string(), "Name:".to_string());
        en_translations.insert("dialog.command".to_string(), "Command:".to_string());
        en_translations.insert("dialog.working_directory".to_string(), "Working Directory:".to_string());
        en_translations.insert("dialog.arguments".to_string(), "Arguments:".to_string());
        en_translations.insert("dialog.environment".to_string(), "Environment Variables (KEY=VALUE per line):".to_string());
        en_translations.insert("dialog.cancel".to_string(), "Cancel".to_string());
        en_translations.insert("dialog.save".to_string(), "Save".to_string());
        
        // System tray
        en_translations.insert("tray.show".to_string(), "Show Window".to_string());
        en_translations.insert("tray.hide".to_string(), "Hide Window".to_string());
        en_translations.insert("tray.quit".to_string(), "Quit".to_string());
        
        self.translations.insert("en".to_string(), Translations {
            language: "en".to_string(),
            translations: en_translations,
        });

        // Chinese translations
        let mut zh_translations = HashMap::new();
        zh_translations.insert("app.title".to_string(), "Rebebuca".to_string());
        zh_translations.insert("app.welcome".to_string(), "欢迎使用 Rebebuca".to_string());
        zh_translations.insert("app.welcome.subtitle".to_string(), "选择一个配置运行或创建新配置".to_string());
        
        // Config sidebar
        zh_translations.insert("config.title".to_string(), "配置列表".to_string());
        zh_translations.insert("config.new".to_string(), "新建配置".to_string());
        zh_translations.insert("config.no_configs".to_string(), "暂无配置".to_string());
        zh_translations.insert("config.play".to_string(), "运行".to_string());
        zh_translations.insert("config.edit".to_string(), "编辑".to_string());
        zh_translations.insert("config.delete".to_string(), "删除".to_string());
        zh_translations.insert("config.duplicate".to_string(), "复制".to_string());
        
        // Console area
        zh_translations.insert("console.restart".to_string(), "重启".to_string());
        zh_translations.insert("console.stop".to_string(), "停止".to_string());
        zh_translations.insert("console.clear".to_string(), "清空".to_string());
        zh_translations.insert("console.no_output".to_string(), "暂无输出...".to_string());
        
        // History sidebar
        zh_translations.insert("history.title".to_string(), "历史记录".to_string());
        zh_translations.insert("history.clear".to_string(), "清空历史".to_string());
        zh_translations.insert("history.no_history".to_string(), "暂无历史记录".to_string());
        zh_translations.insert("history.status.running".to_string(), "运行中".to_string());
        zh_translations.insert("history.status.success".to_string(), "成功".to_string());
        zh_translations.insert("history.status.failed".to_string(), "失败".to_string());
        zh_translations.insert("history.status.stopped".to_string(), "已停止".to_string());
        
        // Config dialog
        zh_translations.insert("dialog.new_config".to_string(), "新建配置".to_string());
        zh_translations.insert("dialog.edit_config".to_string(), "编辑配置".to_string());
        zh_translations.insert("dialog.name".to_string(), "名称:".to_string());
        zh_translations.insert("dialog.command".to_string(), "命令:".to_string());
        zh_translations.insert("dialog.working_directory".to_string(), "工作目录:".to_string());
        zh_translations.insert("dialog.arguments".to_string(), "参数:".to_string());
        zh_translations.insert("dialog.environment".to_string(), "环境变量 (每行一个 KEY=VALUE):".to_string());
        zh_translations.insert("dialog.cancel".to_string(), "取消".to_string());
        zh_translations.insert("dialog.save".to_string(), "保存".to_string());
        
        // System tray
        zh_translations.insert("tray.show".to_string(), "显示窗口".to_string());
        zh_translations.insert("tray.hide".to_string(), "隐藏窗口".to_string());
        zh_translations.insert("tray.quit".to_string(), "退出".to_string());
        
        self.translations.insert("zh".to_string(), Translations {
            language: "zh".to_string(),
            translations: zh_translations,
        });
    }

    pub fn set_language(&mut self, language: &str) {
        self.current_language = language.to_string();
    }

    pub fn get_language(&self) -> &str {
        &self.current_language
    }

    pub fn translate(&self, key: &str) -> String {
        if let Some(translations) = self.translations.get(&self.current_language) {
            if let Some(translation) = translations.translations.get(key) {
                return translation.clone();
            }
        }
        
        // Fallback to English
        if let Some(translations) = self.translations.get("en") {
            if let Some(translation) = translations.translations.get(key) {
                return translation.clone();
            }
        }
        
        // Return key if no translation found
        key.to_string()
    }

    pub fn get_available_languages(&self) -> Vec<String> {
        self.translations.keys().cloned().collect()
    }

    pub fn add_translation(&mut self, language: &str, key: &str, value: &str) {
        let translations = self.translations.entry(language.to_string()).or_insert_with(|| Translations {
            language: language.to_string(),
            translations: HashMap::new(),
        });
        translations.translations.insert(key.to_string(), value.to_string());
    }

    pub fn load_translations_from_file(&mut self, language: &str, translations: HashMap<String, String>) {
        self.translations.insert(language.to_string(), Translations {
            language: language.to_string(),
            translations,
        });
    }
}

pub type I18nManagerRef = Arc<RwLock<I18nManager>>;
