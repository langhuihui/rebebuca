use gpui::*;
use rebebuca_core::{AppState, ErrorSeverity, ErrorEntry, RecoveryAction};
use std::sync::Arc;

/// Error display component for showing application errors
#[derive(Clone)]
pub struct ErrorDisplay {
    app_state: Arc<AppState>,
    is_visible: bool,
    selected_error: Option<String>,
    show_resolved: bool,
    filter_severity: Option<ErrorSeverity>,
}

impl ErrorDisplay {
    pub fn new(app_state: Arc<AppState>) -> Self {
        Self {
            app_state,
            is_visible: false,
            selected_error: None,
            show_resolved: false,
            filter_severity: None,
        }
    }

    pub fn set_visible(&mut self, visible: bool) {
        self.is_visible = visible;
    }

    pub fn is_visible(&self) -> bool {
        self.is_visible
    }

    pub fn set_selected_error(&mut self, error_id: Option<String>) {
        self.selected_error = error_id;
    }

    pub fn set_show_resolved(&mut self, show: bool) {
        self.show_resolved = show;
    }

    pub fn set_filter_severity(&mut self, severity: Option<ErrorSeverity>) {
        self.filter_severity = severity;
    }

    /// Get filtered errors
    async fn get_filtered_errors(&self) -> Result<Vec<ErrorEntry>> {
        let mut errors = self.app_state.error_handler.get_errors().await?;
        
        // Filter by resolved status
        if !self.show_resolved {
            errors.retain(|e| !e.resolved);
        }
        
        // Filter by severity
        if let Some(severity) = self.filter_severity {
            errors.retain(|e| e.severity == severity);
        }
        
        // Sort by timestamp (newest first)
        errors.sort_by(|a, b| b.timestamp.cmp(&a.timestamp));
        
        Ok(errors)
    }

    /// Get severity color
    fn get_severity_color(severity: &ErrorSeverity) -> Hsla {
        match severity {
            ErrorSeverity::Low => rgb(0x888888).into(), // Gray
            ErrorSeverity::Medium => rgb(0xff8000).into(), // Orange
            ErrorSeverity::High => rgb(0xff0000).into(), // Red
            ErrorSeverity::Critical => rgb(0xcc0000).into(), // Dark red
        }
    }

    /// Get severity text
    fn get_severity_text(severity: &ErrorSeverity) -> &'static str {
        match severity {
            ErrorSeverity::Low => "Low",
            ErrorSeverity::Medium => "Medium",
            ErrorSeverity::High => "High",
            ErrorSeverity::Critical => "Critical",
        }
    }

    /// Get recovery action text
    fn get_recovery_action_text(action: &RecoveryAction) -> String {
        match action {
            RecoveryAction::Retry { max_attempts, delay_ms } => {
                format!("Retry ({} attempts, {}ms delay)", max_attempts, delay_ms)
            }
            RecoveryAction::Fallback { default_value } => {
                format!("Fallback to: {}", default_value)
            }
            RecoveryAction::Skip => "Skip operation".to_string(),
            RecoveryAction::Restart { component } => {
                format!("Restart component: {}", component)
            }
            RecoveryAction::Report { message } => {
                format!("Report: {}", message)
            }
            RecoveryAction::None => "No action".to_string(),
        }
    }

    /// Render error list
    fn render_error_list(&self, errors: &[ErrorEntry], _cx: &mut Context<Self>) -> Div {
        if errors.is_empty() {
            return div()
                .flex_1()
                .flex()
                .items_center()
                .justify_center()
                .child(
                    div()
                        .text_center()
                        .child(
                            div()
                                .text_lg()
                                .text_color(rgb(0x888888))
                                .child("No errors found")
                        )
                );
        }

        div()
            .flex_1()
            .overflow_y_hidden()
            .child(
                div()
                    .flex()
                    .flex_col()
                    .children(errors.iter().map(|error| {
                        let is_selected = self.selected_error.as_ref() == Some(&error.id);
                        self.render_error_item(error, is_selected)
                    }))
            )
    }

    /// Render individual error item
    fn render_error_item(&self, error: &ErrorEntry, is_selected: bool) -> Div {
        let severity_color = Self::get_severity_color(&error.severity);
        let severity_text = Self::get_severity_text(&error.severity);
        let recovery_text = Self::get_recovery_action_text(&error.recovery_action);
        
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
                    .items_start()
                    .mb_2()
                    .child(
                        div()
                            .flex_1()
                            .child(
                                div()
                                    .text_sm()
                                    .font_weight(FontWeight::MEDIUM)
                                    .text_color(rgb(0xffffff))
                                    .mb_1()
                                    .child(error.error.to_string())
                            )
                            .child(
                                div()
                                    .text_xs()
                                    .text_color(rgb(0x888888))
                                    .mb_1()
                                    .child(error.context.clone())
                            )
                            .child(
                                div()
                                    .text_xs()
                                    .text_color(rgb(0x666666))
                                    .child(format!("{}", error.timestamp.format("%Y-%m-%d %H:%M:%S")))
                            )
                    )
                    .child(
                        div()
                            .flex()
                            .flex_col()
                            .items_end()
                            .gap_1()
                            .child(
                                div()
                                    .px_2()
                                    .py_1()
                                    .bg(severity_color)
                                    .rounded_md()
                                    .text_xs()
                                    .text_color(rgb(0xffffff))
                                    .child(severity_text)
                            )
                            .child(
                                if error.resolved {
                                    div()
                                        .px_2()
                                        .py_1()
                                        .bg(rgb(0x28a745))
                                        .rounded_md()
                                        .text_xs()
                                        .text_color(rgb(0xffffff))
                                        .child("Resolved")
                                } else {
                                    div()
                                        .px_2()
                                        .py_1()
                                        .bg(rgb(0xdc3545))
                                        .rounded_md()
                                        .text_xs()
                                        .text_color(rgb(0xffffff))
                                        .child("Active")
                                }
                            )
                    )
            )
            .child(
                div()
                    .text_xs()
                    .text_color(rgb(0x666666))
                    .child(format!("Recovery: {}", recovery_text))
            )
    }

    /// Render error details
    fn render_error_details(&self, error: &ErrorEntry, _cx: &mut Context<Self>) -> Div {
        div()
            .flex_1()
            .p_4()
            .bg(rgb(0x1e1e1e))
            .child(
                div()
                    .flex()
                    .flex_col()
                    .gap_4()
                    .child(
                        // Error header
                        div()
                            .pb_4()
                            .border_b_1()
                            .border_color(rgb(0x404040))
                            .child(
                                div()
                                    .flex()
                                    .justify_between()
                                    .items_center()
                                    .mb_2()
                                    .child(
                                        div()
                                            .text_lg()
                                            .font_weight(FontWeight::BOLD)
                                            .text_color(rgb(0xffffff))
                                            .child("Error Details")
                                    )
                                    .child(
                                        div()
                                            .flex()
                                            .gap_2()
                                            .child(
                                                if !error.resolved {
                                                    div()
                                                        .px_3()
                                                        .py_1()
                                                        .bg(rgb(0x007acc))
                                                        .rounded_md()
                                                        .text_sm()
                                                        .text_color(rgb(0xffffff))
                                                        .cursor_pointer()
                                                        .hover(|style| style.bg(rgb(0x005a9e)))
                        .child("Mark as Resolved")
                    } else {
                        div()
                    }
                                            )
                                    )
                            )
                            .child(
                                div()
                                    .text_sm()
                                    .text_color(rgb(0x888888))
                                    .child(format!("ID: {}", error.id))
                            )
                    )
                    .child(
                        // Error message
                        div()
                            .child(
                                div()
                                    .text_sm()
                                    .font_weight(FontWeight::MEDIUM)
                                    .text_color(rgb(0xffffff))
                                    .mb_2()
                                    .child("Error Message")
                            )
                            .child(
                                div()
                                    .p_3()
                                    .bg(rgb(0x2a2a2a))
                                    .rounded_md()
                                    .text_sm()
                                    .text_color(rgb(0xffffff))
                                    .child(error.error.to_string())
                            )
                    )
                    .child(
                        // Context
                        div()
                            .child(
                                div()
                                    .text_sm()
                                    .font_weight(FontWeight::MEDIUM)
                                    .text_color(rgb(0xffffff))
                                    .mb_2()
                                    .child("Context")
                            )
                            .child(
                                div()
                                    .p_3()
                                    .bg(rgb(0x2a2a2a))
                                    .rounded_md()
                                    .text_sm()
                                    .text_color(rgb(0xcccccc))
                                    .child(error.context.clone())
                            )
                    )
                    .child(
                        // Recovery action
                        div()
                            .child(
                                div()
                                    .text_sm()
                                    .font_weight(FontWeight::MEDIUM)
                                    .text_color(rgb(0xffffff))
                                    .mb_2()
                                    .child("Recovery Action")
                            )
                            .child(
                                div()
                                    .p_3()
                                    .bg(rgb(0x2a2a2a))
                                    .rounded_md()
                                    .text_sm()
                                    .text_color(rgb(0xcccccc))
                                    .child(Self::get_recovery_action_text(&error.recovery_action))
                            )
                    )
                    .child(
                        // Resolution (if resolved)
                        if error.resolved {
                            div()
                                .child(
                                    div()
                                        .text_sm()
                                        .font_weight(FontWeight::MEDIUM)
                                        .text_color(rgb(0xffffff))
                                        .mb_2()
                                        .child("Resolution")
                                )
                                .child(
                                    div()
                                        .p_3()
                                        .bg(rgb(0x2a2a2a))
                                        .rounded_md()
                                        .text_sm()
                                        .text_color(rgb(0xcccccc))
                                        .child(error.resolution.as_deref().unwrap_or("No resolution provided").to_string())
                                )
                        } else {
                            div()
                        }
                    )
            )
    }

    /// Render toolbar
    fn render_toolbar(&self, _cx: &mut Context<Self>) -> Div {
        div()
            .p_3()
            .bg(rgb(0x2a2a2a))
            .border_b_1()
            .border_color(rgb(0x404040))
            .flex()
            .items_center()
            .gap_3()
            .child(
                // Clear resolved errors button
                div()
                    .px_3()
                    .py_1()
                    .bg(rgb(0x6c757d))
                    .rounded_md()
                    .text_color(rgb(0xffffff))
                    .text_sm()
                    .cursor_pointer()
                    .hover(|style| style.bg(rgb(0x5a6268)))
                    .child("Clear Resolved")
            )
            .child(
                // Clear all errors button
                div()
                    .px_3()
                    .py_1()
                    .bg(rgb(0xdc3545))
                    .rounded_md()
                    .text_color(rgb(0xffffff))
                    .text_sm()
                    .cursor_pointer()
                    .hover(|style| style.bg(rgb(0xc82333)))
                    .child("Clear All")
            )
            .child(
                // Show resolved toggle
                div()
                    .flex()
                    .items_center()
                    .gap_2()
                    .child(
                        div()
                            .text_sm()
                            .text_color(rgb(0xcccccc))
                            .child("Show Resolved")
                    )
                    .child(
                        div()
                            .w_4()
                            .h_4()
                            .bg(if self.show_resolved { rgb(0x007acc) } else { rgb(0x404040) })
                            .rounded_sm()
                            .cursor_pointer()
                            .hover(|style| style.bg(if self.show_resolved { rgb(0x005a9e) } else { rgb(0x555555) }))
                    )
            )
    }
}

impl Render for ErrorDisplay {
    fn render(&mut self, _: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        if !self.is_visible {
            return div();
        }

        // Get filtered errors (this would be async in a real implementation)
        let errors = match tokio::runtime::Handle::current().block_on(self.get_filtered_errors()) {
            Ok(errors) => errors,
            Err(_) => Vec::new(),
        };

        // Find selected error
        let selected_error = if let Some(error_id) = &self.selected_error {
            errors.iter().find(|e| e.id == *error_id)
        } else {
            None
        };

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
                div()
                    .flex_1()
                    .flex()
                    .child(
                        // Error list
                        div()
                            .w_96()
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
                                            .child("Error Log")
                                    )
                            )
                            .child(
                                // Error list
                                self.render_error_list(&errors, cx)
                            )
                    )
                    .child(
                        // Error details
                        if let Some(error) = selected_error {
                            self.render_error_details(error, cx)
                        } else {
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
                                                .text_lg()
                                                .text_color(rgb(0x888888))
                                                .child("Select an error to view details")
                                        )
                                )
                        }
                    )
            )
    }
}
