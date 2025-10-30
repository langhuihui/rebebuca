use gpui::*;
use rebebuca_core::{AppState, AppError, ErrorSeverity};
use std::sync::Arc;
use std::collections::VecDeque;
use chrono::{DateTime, Utc};

/// Error notification component for showing toast-style error messages
#[derive(Clone)]
pub struct ErrorNotification {
    #[allow(dead_code)]
    app_state: Arc<AppState>,
    notifications: VecDeque<NotificationItem>,
    max_notifications: usize,
    #[allow(dead_code)]
    auto_dismiss_delay: std::time::Duration,
}

#[derive(Debug, Clone)]
#[allow(dead_code)]
struct NotificationItem {
    id: String,
    error: AppError,
    severity: ErrorSeverity,
    timestamp: DateTime<Utc>,
    auto_dismiss: bool,
    dismissed: bool,
}

impl ErrorNotification {
    pub fn new(app_state: Arc<AppState>) -> Self {
        Self {
            app_state,
            notifications: VecDeque::new(),
            max_notifications: 5,
            auto_dismiss_delay: std::time::Duration::from_secs(5),
        }
    }

    /// Add a new error notification
    pub fn add_notification(
        &mut self,
        error: AppError,
        severity: ErrorSeverity,
        auto_dismiss: bool,
    ) {
        let notification = NotificationItem {
            id: uuid::Uuid::new_v4().to_string(),
            error,
            severity,
            timestamp: Utc::now(),
            auto_dismiss,
            dismissed: false,
        };

        self.notifications.push_back(notification);

        // Maintain max_notifications limit
        while self.notifications.len() > self.max_notifications {
            self.notifications.pop_front();
        }
    }

    /// Dismiss a notification
    pub fn dismiss_notification(&mut self, notification_id: &str) {
        if let Some(notification) = self.notifications.iter_mut().find(|n| n.id == notification_id) {
            notification.dismissed = true;
        }
    }

    /// Dismiss all notifications
    pub fn dismiss_all(&mut self) {
        for notification in &mut self.notifications {
            notification.dismissed = true;
        }
    }

    /// Get visible notifications
    fn get_visible_notifications(&self) -> Vec<&NotificationItem> {
        self.notifications
            .iter()
            .filter(|n| !n.dismissed)
            .collect()
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

    /// Get severity icon
    fn get_severity_icon(severity: &ErrorSeverity) -> &'static str {
        match severity {
            ErrorSeverity::Low => "ℹ",
            ErrorSeverity::Medium => "⚠",
            ErrorSeverity::High => "⚠",
            ErrorSeverity::Critical => "🚨",
        }
    }

    /// Render individual notification
    fn render_notification(&self, notification: &NotificationItem, _cx: &mut Context<Self>) -> impl IntoElement {
        let severity_color = Self::get_severity_color(&notification.severity);
        let severity_icon = Self::get_severity_icon(&notification.severity);
        
        div()
            .p_4()
            .mb_2()
            .bg(rgb(0x2a2a2a))
            .border_l_4()
            .border_color(severity_color)
            .rounded_md()
            .shadow_lg()
            .child(
                div()
                    .flex()
                    .items_start()
                    .gap_3()
                    .child(
                        // Severity icon
                        div()
                            .text_lg()
                            .text_color(severity_color)
                            .child(severity_icon)
                    )
                    .child(
                        // Error content
                        div()
                            .flex_1()
                            .child(
                                div()
                                    .text_sm()
                                    .font_weight(FontWeight::MEDIUM)
                                    .text_color(rgb(0xffffff))
                                    .mb_1()
                                    .child(notification.error.to_string())
                            )
                            .child(
                                div()
                                    .text_xs()
                                    .text_color(rgb(0x888888))
                                    .child(format!("{}", notification.timestamp.format("%H:%M:%S")))
                            )
                    )
                    .child(
                        // Dismiss button
                        div()
                            .w_6()
                            .h_6()
                            .bg(rgb(0x404040))
                            .rounded_md()
                            .flex()
                            .items_center()
                            .justify_center()
                            .cursor_pointer()
                            .hover(|style| style.bg(rgb(0x555555)))
                            .child("×")
                    )
            )
    }

    /// Render notification container
    fn render_notifications(&self, _cx: &mut Context<Self>) -> impl IntoElement {
        let visible_notifications = self.get_visible_notifications();
        
        if visible_notifications.is_empty() {
            return div();
        }

        div()
            .absolute()
            .top_4()
            .right_4()
            .w_96()
            .tab_index(1000)
            .child(
                div()
                    .flex()
                    .flex_col()
                    .children(visible_notifications.iter().map(|notification| {
                        self.render_notification(notification, _cx)
                    }))
            )
    }
}

impl Render for ErrorNotification {
    fn render(&mut self, _: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        self.render_notifications(cx)
    }
}

/// Error handler integration for automatic notifications
pub struct ErrorNotificationHandler {
    #[allow(dead_code)]
    error_handler: Arc<rebebuca_core::ErrorHandler>,
    notification_component: ErrorNotification,
}

impl ErrorNotificationHandler {
    pub fn new(app_state: Arc<AppState>) -> Self {
        let notification_component = ErrorNotification::new(app_state.clone());
        let error_handler = app_state.error_handler.clone();
        
        let mut handler = Self {
            error_handler,
            notification_component,
        };
        
        // Set up error reporting callback
        handler.setup_error_callback();
        
        handler
    }

    fn setup_error_callback(&mut self) {
        // Error callback setup will be implemented later
        // This requires a different approach due to ownership constraints
    }

    pub fn get_notification_component(&mut self) -> &mut ErrorNotification {
        &mut self.notification_component
    }
}


