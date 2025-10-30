use crate::theme::*;
use gpui::*;
use gpui_component::*;

pub struct WelcomeScreen;

impl WelcomeScreen {
    pub fn new() -> Self {
        Self
    }
}

impl Render for WelcomeScreen {
    fn render(&mut self, _: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        let theme = get_theme(crate::theme::ThemeMode::Dark);
        
        div()
            .flex_1()
            .flex()
            .items_center()
            .justify_center()
            .p_8()
            .child(
                div()
                    .max_w(px(400.0))
                    .text_center()
                    .child(
                        div()
                            .mb_8()
                            .child(
                                div()
                                    .text_4xl()
                                    .font_weight(FontWeight::BOLD)
                                    .text_color(theme.text)
                                    .mb_4()
                                    .child("Welcome to Rebebuca")
                            )
                            .child(
                                div()
                                    .text_lg()
                                    .text_color(theme.text_secondary)
                                    .child("A powerful run configuration management tool to help you quickly execute and manage various commands and scripts.")
                            )
                    )
                    .child(
                        div()
                            .gap_y_4()
                            .child(
                                // Quick Start
                                div()
                                    .p_4()
                                    .bg(theme.surface)
                                    .rounded_lg()
                                    .border_1()
                                    .border_color(theme.border)
                                    .text_left()
                                    .child(
                                        div()
                                            .flex()
                                            .items_start()
                                            .gap_3()
                                            .child(
                                                div()
                                                    .text_2xl()
                                                    .child("🚀")
                                            )
                                            .child(
                                                div()
                                                    .child(
                                                        div()
                                                            .text_lg()
                                                            .font_weight(FontWeight::SEMIBOLD)
                                                            .text_color(theme.text)
                                                            .mb_2()
                                                            .child("Quick Start")
                                                    )
                                                    .child(
                                                        div()
                                                            .text_sm()
                                                            .text_color(theme.text_secondary)
                                                            .child("Click the \"New\" button on the left to create your first run configuration")
                                                    )
                                            )
                                    )
                            )
                            .child(
                                // Efficient Execution
                                div()
                                    .p_4()
                                    .bg(theme.surface)
                                    .rounded_lg()
                                    .border_1()
                                    .border_color(theme.border)
                                    .text_left()
                                    .child(
                                        div()
                                            .flex()
                                            .items_start()
                                            .gap_3()
                                            .child(
                                                div()
                                                    .text_2xl()
                                                    .child("⚡")
                                            )
                                            .child(
                                                div()
                                                    .child(
                                                        div()
                                                            .text_lg()
                                                            .font_weight(FontWeight::SEMIBOLD)
                                                            .text_color(theme.text)
                                                            .mb_2()
                                                            .child("Efficient Execution")
                                                    )
                                                    .child(
                                                        div()
                                                            .text_sm()
                                                            .text_color(theme.text_secondary)
                                                            .child("Run commands with one click and view output in real-time")
                                                    )
                                            )
                                    )
                            )
                            .child(
                                // Configuration Management
                                div()
                                    .p_4()
                                    .bg(theme.surface)
                                    .rounded_lg()
                                    .border_1()
                                    .border_color(theme.border)
                                    .text_left()
                                    .child(
                                        div()
                                            .flex()
                                            .items_start()
                                            .gap_3()
                                            .child(
                                                div()
                                                    .text_2xl()
                                                    .child("📝")
                                            )
                                            .child(
                                                div()
                                                    .child(
                                                        div()
                                                            .text_lg()
                                                            .font_weight(FontWeight::SEMIBOLD)
                                                            .text_color(theme.text)
                                                            .mb_2()
                                                            .child("Configuration Management")
                                                    )
                                                    .child(
                                                        div()
                                                            .text_sm()
                                                            .text_color(theme.text_secondary)
                                                            .child("Support advanced configurations like working directory and environment variables")
                                                    )
                                            )
                                    )
                            )
                            .child(
                                // History
                                div()
                                    .p_4()
                                    .bg(theme.surface)
                                    .rounded_lg()
                                    .border_1()
                                    .border_color(theme.border)
                                    .text_left()
                                    .child(
                                        div()
                                            .flex()
                                            .items_start()
                                            .gap_3()
                                            .child(
                                                div()
                                                    .text_2xl()
                                                    .child("🕒")
                                            )
                                            .child(
                                                div()
                                                    .child(
                                                        div()
                                                            .text_lg()
                                                            .font_weight(FontWeight::SEMIBOLD)
                                                            .text_color(theme.text)
                                                            .mb_2()
                                                            .child("History")
                                                    )
                                                    .child(
                                                        div()
                                                            .text_sm()
                                                            .text_color(theme.text_secondary)
                                                            .child("Automatically save run history for easy re-execution")
                                                    )
                                            )
                                    )
                            )
                    )
            )
    }
}
