use gpui::*;
use rebebuca_core::{AppState, SearchFilter, FilterType, HistoryStatus};
use std::sync::Arc;

pub struct SearchBar {
    #[allow(dead_code)]
    app_state: Arc<AppState>,
    search_text: String,
    filter_type: FilterType,
    case_sensitive: bool,
    regex: bool,
    is_visible: bool,
}

impl SearchBar {
    pub fn new(app_state: Arc<AppState>) -> Self {
        Self {
            app_state,
            search_text: String::new(),
            filter_type: FilterType::All,
            case_sensitive: false,
            regex: false,
            is_visible: false,
        }
    }

    pub fn set_visible(&mut self, visible: bool) {
        self.is_visible = visible;
    }

    pub fn is_visible(&self) -> bool {
        self.is_visible
    }

    pub fn set_search_text(&mut self, text: String) {
        self.search_text = text;
    }

    pub fn get_search_text(&self) -> &str {
        &self.search_text
    }

    pub fn set_filter_type(&mut self, filter_type: FilterType) {
        self.filter_type = filter_type;
    }

    pub fn get_filter_type(&self) -> &FilterType {
        &self.filter_type
    }

    pub fn set_case_sensitive(&mut self, case_sensitive: bool) {
        self.case_sensitive = case_sensitive;
    }

    pub fn is_case_sensitive(&self) -> bool {
        self.case_sensitive
    }

    pub fn set_regex(&mut self, regex: bool) {
        self.regex = regex;
    }

    pub fn is_regex(&self) -> bool {
        self.regex
    }

    pub fn apply_filter(&self) -> Result<(), Box<dyn std::error::Error>> {
        let _filter = SearchFilter::new()
            .with_query(self.search_text.clone())
            .with_filter_type(self.filter_type.clone())
            .with_case_sensitive(self.case_sensitive)
            .with_regex(self.regex);

        // Apply the filter to the search manager
        // This would typically be done through the app state
        // For now, we'll just create the filter
        Ok(())
    }

    pub fn clear_filter(&mut self) {
        self.search_text.clear();
        self.filter_type = FilterType::All;
        self.case_sensitive = false;
        self.regex = false;
    }

    pub fn search_in_text(&self, text: &str) -> Result<Vec<rebebuca_core::SearchMatch>, anyhow::Error> {
        if self.search_text.is_empty() {
            return Ok(vec![]);
        }

        let filter = SearchFilter::new()
            .with_query(self.search_text.clone())
            .with_filter_type(self.filter_type.clone())
            .with_case_sensitive(self.case_sensitive)
            .with_regex(self.regex);

        filter.search_in_text(text)
    }
}

impl Render for SearchBar {
    #[allow(refining_impl_trait)]
    fn render(&mut self, _: &mut Window, _cx: &mut Context<Self>) -> impl IntoElement {
        if !self.is_visible {
            return div();
        }

        div()
            .flex()
            .flex_col()
            .gap_2()
            .p_4()
            .bg(rgb(0x2a2a2a))
            .border_b_1()
            .border_color(rgb(0x404040))
            .child(
                // Search input row
                div()
                    .flex()
                    .items_center()
                    .gap_2()
                    .child(
                        // Search input
                        div()
                            .flex_1()
                            .child(
                                div()
                                    .flex()
                                    .items_center()
                                    .px_3()
                                    .py_2()
                                    .bg(rgb(0x1a1a1a))
                                    .border_1()
                                    .border_color(rgb(0x404040))
                                    .rounded_md()
                                    .child(
                                        div()
                                            .text_sm()
                                            .text_color(rgb(0x888888))
                                            .child("🔍")
                                    )
                                    .child(
                                        div()
                                            .flex_1()
                                            .ml_2()
                                            .text_sm()
                                            .text_color(rgb(0xffffff))
                                            .child(self.search_text.clone())
                                    )
                            )
                    )
                    .child(
                        // Clear button
                        div()
                            .px_3()
                            .py_2()
                            .bg(rgb(0x404040))
                            .text_color(rgb(0xffffff))
                            .text_sm()
                            .rounded_md()
                            .cursor_pointer()
                            .hover(|style| style.bg(rgb(0x505050)))
                            .child("Clear")
                    )
            )
            .child(
                // Filter options row
                div()
                    .flex()
                    .items_center()
                    .gap_4()
                    .child(
                        // Filter type dropdown
                        div()
                            .flex()
                            .items_center()
                            .gap_2()
                            .child(
                                div()
                                    .text_sm()
                                    .text_color(rgb(0x888888))
                                    .child("Filter:")
                            )
                            .child(
                                div()
                                    .px_3()
                                    .py_1()
                                    .bg(rgb(0x1a1a1a))
                                    .border_1()
                                    .border_color(rgb(0x404040))
                                    .rounded_md()
                                    .text_sm()
                                    .text_color(rgb(0xffffff))
                                    .child(match &self.filter_type {
                                        FilterType::All => "All",
                                        FilterType::Status(HistoryStatus::Running) => "Running",
                                        FilterType::Status(HistoryStatus::Success) => "Success",
                                        FilterType::Status(HistoryStatus::Error) => "Error",
                                        FilterType::Config(_) => "Config",
                                        FilterType::DateRange(_, _) => "Date Range",
                                        FilterType::Text(_) => "Text",
                                    })
                            )
                    )
                    .child(
                        // Case sensitive checkbox
                        div()
                            .flex()
                            .items_center()
                            .gap_2()
                            .child(
                                div()
                                    .w_4()
                                    .h_4()
                                    .border_1()
                                    .border_color(if self.case_sensitive { rgb(0x007acc) } else { rgb(0x404040) })
                                    .bg(if self.case_sensitive { rgb(0x007acc) } else { rgb(0x1a1a1a) })
                                    .rounded_sm()
                                    .child(
                                        if self.case_sensitive {
                                            div()
                                                .text_xs()
                                                .text_color(rgb(0xffffff))
                                                .child("✓")
                                        } else {
                                            div()
                                        }
                                    )
                            )
                            .child(
                                div()
                                    .text_sm()
                                    .text_color(rgb(0x888888))
                                    .child("Case sensitive")
                            )
                    )
                    .child(
                        // Regex checkbox
                        div()
                            .flex()
                            .items_center()
                            .gap_2()
                            .child(
                                div()
                                    .w_4()
                                    .h_4()
                                    .border_1()
                                    .border_color(if self.regex { rgb(0x007acc) } else { rgb(0x404040) })
                                    .bg(if self.regex { rgb(0x007acc) } else { rgb(0x1a1a1a) })
                                    .rounded_sm()
                                    .child(
                                        if self.regex {
                                            div()
                                                .text_xs()
                                                .text_color(rgb(0xffffff))
                                                .child("✓")
                                        } else {
                                            div()
                                        }
                                    )
                            )
                            .child(
                                div()
                                    .text_sm()
                                    .text_color(rgb(0x888888))
                                    .child("Regex")
                            )
                    )
            )
    }
}
