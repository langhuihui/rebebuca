use gpui::*;
use rebebuca_core::AppState;
use std::sync::Arc;

pub struct I18nProvider {
    app_state: Arc<AppState>,
}

impl I18nProvider {
    pub fn new(app_state: Arc<AppState>) -> Self {
        Self { app_state }
    }

    pub async fn translate(&self, key: &str) -> String {
        let i18n_manager = self.app_state.i18n_manager.read().await;
        i18n_manager.translate(key)
    }

    pub async fn set_language(&self, language: &str) {
        let mut i18n_manager = self.app_state.i18n_manager.write().await;
        i18n_manager.set_language(language);
    }

    pub async fn get_language(&self) -> String {
        let i18n_manager = self.app_state.i18n_manager.read().await;
        i18n_manager.get_language().to_string()
    }

    pub async fn get_available_languages(&self) -> Vec<String> {
        let i18n_manager = self.app_state.i18n_manager.read().await;
        i18n_manager.get_available_languages()
    }
}

impl Render for I18nProvider {
    fn render(&mut self, _: &mut Window, _cx: &mut Context<Self>) -> impl IntoElement {
        // I18nProvider is a utility component, not rendered
        div()
    }
}
