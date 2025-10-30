use gpui::*;
use rebebuca_core::{AppState, RunHistory, HistoryStatus};
use std::sync::Arc;

pub struct HistorySidebar {
    #[allow(dead_code)]
    app_state: Arc<AppState>,
    #[allow(dead_code)]
    selected_history: Option<String>,
}

impl HistorySidebar {
    pub fn new(app_state: Arc<AppState>) -> Self {
        Self {
            app_state,
            selected_history: None,
        }
    }

    fn render_history_list(&self, _cx: &mut Context<Self>) -> impl IntoElement {
        // For now, we'll render a placeholder list
        // Later we'll integrate with the actual history from app_state
        div()
            .flex_1()
            .overflow_y_hidden()
            .child(
                div()
                    .p_2()
                    .child("No history yet")
                    .text_color(rgb(0x888888))
            )
    }

    #[allow(dead_code)]
    fn render_history_item(&self, history: &RunHistory, _cx: &mut Context<Self>) -> impl IntoElement {
        let status_color = Self::get_status_color(&history.status);
        let status_text = Self::get_status_text(&history.status);
        
        div()
            .p_3()
            .border_b_1()
            .border_color(rgb(0x404040))
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
                            .child(history.name.clone())
                    )
                    .child(
                        div()
                            .px_2()
                            .py_1()
                            .bg(status_color)
                            .rounded_md()
                            .text_xs()
                            .text_color(rgb(0xffffff))
                            .child(status_text)
                    )
            )
            .child(
                div()
                    .text_xs()
                    .text_color(rgb(0x888888))
                    .mb_1()
                    .child(history.command.clone())
            )
            .child(
                div()
                    .text_xs()
                    .text_color(rgb(0x666666))
                    .child(
                        format!("{}", history.timestamp.format("%Y-%m-%d %H:%M:%S"))
                    )
            )
    }

    fn render_clear_button(&self, _cx: &mut Context<Self>) -> impl IntoElement {
        div()
            .p_2()
            .border_b_1()
            .border_color(rgb(0x404040))
            .child(
                div()
                    .px_3()
                    .py_2()
                    .bg(rgb(0xdc3545))
                    .rounded_md()
                    .text_color(rgb(0xffffff))
                    .text_sm()
                    .cursor_pointer()
                    .hover(|style| style.bg(rgb(0xc82333)))
                    .child("Clear History")
            )
    }

    #[allow(dead_code)]
    fn get_status_color(status: &HistoryStatus) -> Hsla {
        match status {
            HistoryStatus::Running => Hsla::blue(),
            HistoryStatus::Success => Hsla::green(),
            HistoryStatus::Error => Hsla::red(),
        }
    }

    #[allow(dead_code)]
    fn get_status_text(status: &HistoryStatus) -> &'static str {
        match status {
            HistoryStatus::Running => "Running",
            HistoryStatus::Success => "Success",
            HistoryStatus::Error => "Error",
        }
    }
}

impl Render for HistorySidebar {
    fn render(&mut self, _: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        div()
            .w_64()
            .h_full()
            .bg(rgb(0x2d2d2d))
            .border_l_1()
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
                            .child("Run History")
                    )
            )
            .child(self.render_clear_button(cx))
            .child(self.render_history_list(cx))
    }
}