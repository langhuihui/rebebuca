use gpui::*;
use rebebuca_core::{AppState, FilterType, HistoryStatus};
use std::sync::Arc;

pub struct FilterPanel {
    #[allow(dead_code)]
    app_state: Arc<AppState>,
    selected_status: Option<HistoryStatus>,
    selected_config: Option<String>,
    date_range_start: Option<String>,
    date_range_end: Option<String>,
    is_visible: bool,
}

impl FilterPanel {
    pub fn new(app_state: Arc<AppState>) -> Self {
        Self {
            app_state,
            selected_status: None,
            selected_config: None,
            date_range_start: None,
            date_range_end: None,
            is_visible: false,
        }
    }

    pub fn set_visible(&mut self, visible: bool) {
        self.is_visible = visible;
    }

    pub fn is_visible(&self) -> bool {
        self.is_visible
    }

    pub fn set_status_filter(&mut self, status: Option<HistoryStatus>) {
        self.selected_status = status;
    }

    pub fn get_status_filter(&self) -> Option<HistoryStatus> {
        self.selected_status.clone()
    }

    pub fn set_config_filter(&mut self, config_id: Option<String>) {
        self.selected_config = config_id;
    }

    pub fn get_config_filter(&self) -> Option<&String> {
        self.selected_config.as_ref()
    }

    pub fn set_date_range(&mut self, start: Option<String>, end: Option<String>) {
        self.date_range_start = start;
        self.date_range_end = end;
    }

    pub fn get_date_range(&self) -> (Option<&String>, Option<&String>) {
        (self.date_range_start.as_ref(), self.date_range_end.as_ref())
    }

    pub fn clear_filters(&mut self) {
        self.selected_status = None;
        self.selected_config = None;
        self.date_range_start = None;
        self.date_range_end = None;
    }

    pub fn has_active_filters(&self) -> bool {
        self.selected_status.is_some() 
            || self.selected_config.is_some() 
            || self.date_range_start.is_some() 
            || self.date_range_end.is_some()
    }

    pub fn get_filter_type(&self) -> FilterType {
        if let Some(status) = &self.selected_status {
            FilterType::Status(status.clone())
        } else if let Some(config_id) = &self.selected_config {
            FilterType::Config(config_id.clone())
        } else if self.date_range_start.is_some() || self.date_range_end.is_some() {
            // For simplicity, we'll use a placeholder date range
            // In a real implementation, you'd parse the date strings
            FilterType::DateRange(
                chrono::Utc::now() - chrono::Duration::days(30),
                chrono::Utc::now()
            )
        } else {
            FilterType::All
        }
    }

    fn render_status_button(&self, status: HistoryStatus, label: &str, color: Hsla) -> impl IntoElement {
        let is_selected = self.selected_status == Some(status);
        
        div()
            .px_3()
            .py_2()
            .bg(if is_selected { color } else { rgb(0x1a1a1a).into() })
            .border_1()
            .border_color(if is_selected { color } else { rgb(0x404040).into() })
            .text_color(if is_selected { rgb(0xffffff) } else { rgb(0x888888) })
            .text_sm()
            .rounded_md()
            .cursor_pointer()
            .hover(|style| style.bg(if is_selected { color } else { rgb(0x2a2a2a).into() }))
            .child(label.to_string())
    }
}

impl Render for FilterPanel {
    #[allow(refining_impl_trait)]
    fn render(&mut self, _: &mut Window, _cx: &mut Context<Self>) -> impl IntoElement {
        if !self.is_visible {
            return div();
        }

        div()
            .flex()
            .flex_col()
            .gap_3()
            .p_4()
            .bg(rgb(0x2a2a2a))
            .border_b_1()
            .border_color(rgb(0x404040))
            .child(
                // Header
                div()
                    .flex()
                    .items_center()
                    .justify_between()
                    .child(
                        div()
                            .text_lg()
                            .text_color(rgb(0xffffff))
                            .font_weight(FontWeight::BOLD)
                            .child("Filters")
                    )
                    .child(
                        div()
                            .px_3()
                            .py_1()
                            .bg(rgb(0x404040))
                            .text_color(rgb(0xffffff))
                            .text_sm()
                            .rounded_md()
                            .cursor_pointer()
                            .hover(|style| style.bg(rgb(0x505050)))
                            .child("Clear All")
                    )
            )
            .child(
                // Status filter
                div()
                    .flex()
                    .flex_col()
                    .gap_2()
                    .child(
                        div()
                            .text_sm()
                            .text_color(rgb(0x888888))
                            .font_weight(FontWeight::MEDIUM)
                            .child("Status")
                    )
                    .child(
                        div()
                            .flex()
                            .gap_2()
                            .child(
                                self.render_status_button(HistoryStatus::Running, "Running", rgb(0x007acc).into())
                            )
                            .child(
                                self.render_status_button(HistoryStatus::Success, "Success", rgb(0x28a745).into())
                            )
                            .child(
                                self.render_status_button(HistoryStatus::Error, "Error", rgb(0xdc3545).into())
                            )
                            .child(div())
                    )
            )
            .child(
                // Config filter
                div()
                    .flex()
                    .flex_col()
                    .gap_2()
                    .child(
                        div()
                            .text_sm()
                            .text_color(rgb(0x888888))
                            .font_weight(FontWeight::MEDIUM)
                            .child("Configuration")
                    )
                    .child(
                        div()
                            .px_3()
                            .py_2()
                            .bg(rgb(0x1a1a1a))
                            .border_1()
                            .border_color(rgb(0x404040))
                            .rounded_md()
                            .text_sm()
                            .text_color(rgb(0xffffff))
                            .child(
                                self.selected_config
                                    .as_ref()
                                    .map(|s| s.as_str().to_string())
                                    .unwrap_or("All configurations".to_string())
                            )
                    )
            )
            .child(
                // Date range filter
                div()
                    .flex()
                    .flex_col()
                    .gap_2()
                    .child(
                        div()
                            .text_sm()
                            .text_color(rgb(0x888888))
                            .font_weight(FontWeight::MEDIUM)
                            .child("Date Range")
                    )
                    .child(
                        div()
                            .flex()
                            .gap_2()
                            .child(
                                div()
                                    .flex_1()
                                    .child(
                                        div()
                                            .px_3()
                                            .py_2()
                                            .bg(rgb(0x1a1a1a))
                                            .border_1()
                                            .border_color(rgb(0x404040))
                                            .rounded_md()
                                            .text_sm()
                                            .text_color(rgb(0xffffff))
                                            .child(
                                                self.date_range_start
                                                    .as_ref()
                                                    .map(|s| s.as_str().to_string())
                                                    .unwrap_or("Start date".to_string())
                                            )
                                    )
                            )
                            .child(
                                div()
                                    .flex_1()
                                    .child(
                                        div()
                                            .px_3()
                                            .py_2()
                                            .bg(rgb(0x1a1a1a))
                                            .border_1()
                                            .border_color(rgb(0x404040))
                                            .rounded_md()
                                            .text_sm()
                                            .text_color(rgb(0xffffff))
                                            .child(
                                self.date_range_end
                                    .as_ref()
                                    .map(|s| s.as_str().to_string())
                                    .unwrap_or("End date".to_string())
                                            )
                                    )
                            )
                    )
            )
    }

}
