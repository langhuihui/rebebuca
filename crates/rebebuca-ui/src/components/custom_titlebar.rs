use gpui::*;

/// Custom titlebar component for transparent windows
pub struct CustomTitlebar {
    title: String,
}

impl CustomTitlebar {
    pub fn new(title: impl Into<String>) -> Self {
        Self {
            title: title.into(),
        }
    }

    pub fn with_title(mut self, title: impl Into<String>) -> Self {
        self.title = title.into();
        self
    }
}

impl Render for CustomTitlebar {
    fn render(&mut self, _window: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        let title = self.title.clone();
        
        div()
            .absolute()
            .top_0()
            .left_0()
            .right_0()
            .h(px(44.0)) // macOS standard titlebar height
            .bg(rgb(0x1e1e1e)) // Solid background to completely cover system titlebar
            .border_b_1()
            .border_color(rgb(0x404040))
            .flex()
            .items_center()
            .justify_between()
            .px(px(12.0))
            .py(px(6.0))
            .child(
                // Left spacer to cover system traffic lights area
                div()
                    .w(px(78.0)) // Standard macOS traffic lights width
                    .h_full()
            )
            .child(
                // Title area (draggable region) - centered
                div()
                    .flex()
                    .flex_1()
                    .items_center()
                    .justify_center()
                    .h_full()
                    .cursor_move()
                    .child(
                        div()
                            .text_base()
                            .text_color(rgb(0xffffff))
                            .font_weight(FontWeight::MEDIUM)
                            .truncate()
                            .cursor_move()
                            .child(title.clone())
                    )
            )
            .child(
                // Window controls on the right side
                div()
                    .flex()
                    .items_center()
                    .gap_1()
                    .child(
                        // Minimize button (macOS style)
                        div()
                            .w(px(28.0))
                            .h(px(28.0))
                            .rounded_md()
                            .flex()
                            .items_center()
                            .justify_center()
                            .hover(|style| style.bg(gpui::Fill::Color(gpui::Hsla::white().alpha(0.1).into())))
                            .cursor_pointer()
                            .child(
                                div()
                                    .w(px(12.0))
                                    .h(px(1.0))
                                    .bg(rgb(0xcccccc))
                            )
                            .on_mouse_down(MouseButton::Left, cx.listener(move |_, _event, window, _cx| {
                                window.minimize_window();
                            }))
                    )
                    .child(
                        // Close button (macOS style - red circle with X)
                        div()
                            .w(px(12.0))
                            .h(px(12.0))
                            .rounded_full()
                            .bg(rgb(0xff5f5656))
                            .flex()
                            .items_center()
                            .justify_center()
                            .hover(|style| {
                                style.bg(rgb(0xff6f6666))
                            })
                            .cursor_pointer()
                            .child(
                                // Simple white square representing X
                                div()
                                    .w(px(5.0))
                                    .h(px(5.0))
                                    .bg(rgb(0xffffff))
                                    .rounded_sm()
                            )
                            .on_mouse_down(MouseButton::Left, cx.listener(move |_, _event, _window, cx| {
                                cx.quit();
                            }))
                    )
            )
    }
}
