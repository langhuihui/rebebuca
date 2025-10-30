use gpui::*;
use rebebuca_core::{AppState, RunConfig};
use std::sync::Arc;

pub struct ConfigSidebar {
    app_state: Arc<AppState>,
    selected_config: Option<String>,
    app_entity: Option<Entity<crate::app::RebebucaApp>>,
}

impl ConfigSidebar {
    pub fn new(app_state: Arc<AppState>) -> Self {
        Self {
            app_state,
            selected_config: None,
            app_entity: None,
        }
    }

    pub fn set_app_entity(&mut self, app_entity: Entity<crate::app::RebebucaApp>) {
        self.app_entity = Some(app_entity);
    }

    fn render_config_list(&self, _cx: &mut Context<Self>) -> impl IntoElement {
        // For now, we'll render a placeholder list
        // Later we'll integrate with the actual configs from app_state
        div()
            .flex_1()
            .overflow_y_hidden()
            .child(
                div()
                    .p_2()
                    .child("No configurations yet") // TODO: Use i18n
                    .text_color(rgb(0x888888))
            )
    }

    pub fn set_selected_config(&mut self, config_id: Option<String>) {
        self.selected_config = config_id;
    }

    pub fn get_selected_config(&self) -> Option<&String> {
        self.selected_config.as_ref()
    }

    #[allow(dead_code)]
    fn render_config_item(&self, config: &RunConfig, _cx: &mut Context<Self>) -> impl IntoElement {
        let is_selected = self.selected_config.as_ref() == Some(&config.id);
        
        div()
            .p_3()
            .border_b_1()
            .border_color(rgb(0x404040))
            .bg(if is_selected { rgb(0x3a3a3a) } else { rgb(0x2d2d2d) })
            .hover(|style| style.bg(rgb(0x3a3a3a)))
            .cursor_pointer()
            .child(
                div()
                    .flex()
                    .justify_between()
                    .items_center()
                    .mb_2()
                    .child(
                        div()
                            .text_sm()
                            .font_weight(FontWeight::MEDIUM)
                            .text_color(rgb(0xffffff))
                            .child(config.name.clone())
                    )
                    .child(
                        div()
                            .flex()
                            .gap_2()
                            .child(
                                // Play button
                                div()
                                    .w_6()
                                    .h_6()
                                    .bg(rgb(0x007acc))
                                    .rounded_md()
                                    .flex()
                                    .items_center()
                                    .justify_center()
                                    .cursor_pointer()
                                    .hover(|style| style.bg(rgb(0x005a9e)))
                                    .child("▶")
                            )
                            .child(
                                // Edit button
                                div()
                                    .w_6()
                                    .h_6()
                                    .bg(rgb(0x6c757d))
                                    .rounded_md()
                                    .flex()
                                    .items_center()
                                    .justify_center()
                                    .cursor_pointer()
                                    .hover(|style| style.bg(rgb(0x5a6268)))
                                    .child("✏")
                            )
                    )
            )
            .child(
                div()
                    .text_xs()
                    .text_color(rgb(0x888888))
                    .child(config.command.clone())
            )
    }

    #[allow(dead_code)]
    fn render_new_button(&mut self, cx: &mut Context<Self>, _window: &mut Window) -> impl IntoElement {
        let button_id = ElementId::from("new_config_button");
        let _app_state = self.app_state.clone();
        
        div()
            .p_2()
            .border_b_1()
            .border_color(rgb(0x404040))
            .child(
                div()
                    .id(button_id)
                    .px_3()
                    .py_2()
                    .bg(rgb(0x007acc))
                    .rounded_md()
                    .text_color(rgb(0xffffff))
                    .text_sm()
                    .cursor_pointer()
                    .hover(|style| style.bg(rgb(0x005a9e)))
                    .on_click(cx.listener(move |_this, event, _window, cx| {
                        eprintln!("=== BUTTON CLICKED! ===");
                        eprintln!("Event: {:?}", event);
                        // For now, just print - dialog will be handled by parent
                        eprintln!("Button clicked, need to open dialog");
                        // Notify this view changed
                        cx.notify();
                    }))
                    .child("+ New Config") // TODO: Use i18n
            )
    }

}

impl Render for ConfigSidebar {
    fn render(&mut self, _window: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        eprintln!("[DEBUG] ConfigSidebar::render called, app_entity.is_some(): {}", self.app_entity.is_some());
        div()
            .w_64()
            .h_full()
            .bg(rgb(0x2d2d2d))
            .border_r_1()
            .border_color(rgb(0x404040))
            .flex()
            .flex_col()
            .child(
                // Header
                div()
                    .p_3()
                    .border_b_1()
                    .border_color(rgb(0x404040))
                    .child(
                        div()
                            .text_lg()
                            .font_weight(FontWeight::BOLD)
                            .text_color(rgb(0xffffff))
                            .child("Configurations")
                    )
            )
            .child(
                // New Config button
                div()
                    .p_2()
                    .border_b_1()
                    .border_color(rgb(0x404040))
                    .child(
                        div()
                            .id(ElementId::from("new_config_button"))
                            .px_3()
                            .py_2()
                            .bg(rgb(0x007acc))
                            .rounded_md()
                            .text_color(rgb(0xffffff))
                            .text_sm()
                            .font_weight(FontWeight::MEDIUM)
                            .cursor_pointer()
                            .hover(|style| style.bg(rgb(0x005a9e)))
                            .on_click({
                                let app_entity = self.app_entity.clone();
                                eprintln!("[DEBUG] Setting up button click listener, app_entity.is_some(): {}", app_entity.is_some());
                                cx.listener(move |_this, event, _window, cx| {
                                    eprintln!("[DEBUG] ===== BUTTON CLICKED ======");
                                    eprintln!("[DEBUG] Event: {:?}", event);
                                    eprintln!("[DEBUG] app_entity.is_some(): {}", app_entity.is_some());
                                    // Directly open dialog via app_entity
                                    if let Some(ref app_entity) = app_entity {
                                        eprintln!("[DEBUG] app_entity found, calling open_config_dialog");
                                        app_entity.update(cx, |app, cx| {
                                            eprintln!("[DEBUG] Inside app.update, calling open_config_dialog");
                                            app.open_config_dialog(None);
                                            eprintln!("[DEBUG] open_config_dialog called, notifying");
                                            cx.notify();
                                        });
                                    } else {
                                        eprintln!("[DEBUG] ERROR: app_entity is None!");
                                    }
                                })
                            })
                            .child("+ New Config") // TODO: Use i18n
                    )
            )
            .child(self.render_config_list(cx))
    }
}