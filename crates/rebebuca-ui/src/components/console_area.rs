use gpui::*;
use rebebuca_core::{AppState, RunConfig};
use crate::components::{SearchBar, SearchHighlighter, render_highlighted_text, render_search_stats, IconButtons};
use std::sync::Arc;

pub struct ConsoleArea {
    #[allow(dead_code)]
    app_state: Arc<AppState>,
    output: String,
    is_running: bool,
    current_config: Option<RunConfig>,
    search_bar: SearchBar,
    search_highlighter: SearchHighlighter,
    show_search: bool,
}

impl ConsoleArea {
    pub fn new(app_state: Arc<AppState>) -> Self {
        Self {
            app_state: app_state.clone(),
            output: String::new(),
            is_running: false,
            current_config: None,
            search_bar: SearchBar::new(app_state),
            search_highlighter: SearchHighlighter::new(),
            show_search: false,
        }
    }

    pub fn execute_config(&mut self, config: RunConfig) {
        self.current_config = Some(config.clone());
        self.output.clear();
        self.is_running = true;
        
        // For now, just show a placeholder message
        self.output = format!("Executing: {}\nWorking directory: {}\nArguments: {}\n\n[Process execution will be implemented here]",
            config.command,
            config.working_directory.as_deref().unwrap_or("current directory"),
            config.arguments.as_ref().map(|args| args.join(" ")).unwrap_or_default()
        );
    }

    pub fn stop_current_process(&mut self) {
        self.is_running = false;
        self.output.push_str("\n[Process stopped]\n");
    }

    pub fn clear_output(&mut self) {
        self.output.clear();
        self.search_highlighter.clear_matches();
    }

    pub fn toggle_search(&mut self) {
        self.show_search = !self.show_search;
        self.search_bar.set_visible(self.show_search);
    }

    pub fn search_in_output(&mut self, query: String) {
        self.search_bar.set_search_text(query.clone());
        
        if !query.is_empty() {
            let matches = self.search_bar.search_in_text(&self.output).unwrap_or_default();
            self.search_highlighter.set_matches(matches);
        } else {
            self.search_highlighter.clear_matches();
        }
    }

    pub fn next_search_match(&mut self) {
        if self.search_highlighter.has_matches() {
            self.search_highlighter.next_match();
        }
    }

    pub fn previous_search_match(&mut self) {
        if self.search_highlighter.has_matches() {
            self.search_highlighter.previous_match();
        }
    }

    pub fn clear_search(&mut self) {
        self.search_bar.clear_filter();
        self.search_highlighter.clear_matches();
    }

    fn render_console_content(&self, _cx: &mut Context<Self>) -> impl IntoElement {
        if self.output.is_empty() && !self.is_running {
            // Welcome screen
            div()
                .flex_1()
                .flex()
                .items_center()
                .justify_center()
                .child(
                    div()
                        .text_center()
                        .child(
                            div()
                                .text_2xl()
                                .font_weight(FontWeight::BOLD)
                                .text_color(rgb(0xffffff))
                                .mb_4()
                                .child("Welcome to Rebebuca")
                        )
                        .child(
                            div()
                                .text_lg()
                                .text_color(rgb(0x888888))
                                .child("Select a configuration to run or create a new one")
                        )
                )
        } else {
            // Console output
            div()
                .flex_1()
                .p_4()
                .bg(rgb(0x1e1e1e))
                .child(
                    div()
                        .font_family("Monaco, 'Courier New', monospace")
                        .text_sm()
                        .whitespace_normal()
                        .child(
                                if self.output.is_empty() {
                                    div()
                                        .text_color(rgb(0xffffff))
                                        .child("No output yet...")
                                        .into_any()
                                } else {
                                    render_highlighted_text(&self.output, &self.search_highlighter, _cx)
                                }
                        )
                )
        }
    }

    fn render_toolbar(&self, _cx: &mut Context<Self>) -> impl IntoElement {
        div()
            .p_2()
            .border_b_1()
            .border_color(rgb(0x404040))
            .bg(rgb(0x2d2d2d))
            .flex()
            .gap_2()
            .child(
                // Restart/Play button
                IconButtons::replay()
                    .with_size(16.0)
                    .render()
            )
            .child(
                // Stop button
                IconButtons::stop(self.is_running)
                    .with_size(16.0)
                    .render()
            )
            .child(
                // Clear button
                IconButtons::clear()
                    .with_size(16.0)
                    .render()
            )
            .child(
                // Search button - can add search icon here if needed
                div()
                    .px_3()
                    .py_1()
                    .bg(if self.show_search { rgb(0x007acc) } else { rgb(0x6c757d) })
                    .rounded_md()
                    .text_color(rgb(0xffffff))
                    .text_sm()
                    .cursor_pointer()
                    .hover(|style| style.bg(if self.show_search { rgb(0x005a9e) } else { rgb(0x5a6268) }))
                    .child("Search")
            )
            .child(
                // Search stats
                if self.search_highlighter.has_matches() {
                    render_search_stats(&self.search_highlighter, _cx)
                } else {
                    div().into_any()
                }
            )
    }
}

impl Render for ConsoleArea {
    fn render(&mut self, _: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        div()
            .flex_1()
            .h_full()
            .bg(rgb(0x1e1e1e))
            .flex()
            .flex_col()
            .child(
                // Toolbar
                self.render_toolbar(cx)
            )
            .child(
                // Search bar
                if self.show_search {
                    // For now, just show a placeholder search bar
                    div()
                        .p_4()
                        .bg(rgb(0x2a2a2a))
                        .border_b_1()
                        .border_color(rgb(0x404040))
                        .child("Search functionality (placeholder)")
                        .into_any()
                } else {
                    div().into_any()
                }
            )
            .child(
                // Console content
                self.render_console_content(cx)
            )
    }
}