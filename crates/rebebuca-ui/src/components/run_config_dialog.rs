use gpui::*;
use rebebuca_core::{AppState, RunConfig};
use std::sync::Arc;

#[derive(Clone)]
pub struct RunConfigDialog {
    #[allow(dead_code)]
    app_state: Arc<AppState>,
    is_open: bool,
    config: Option<RunConfig>,
    name: String,
    command: String,
    working_directory: String,
    arguments: String,
    environment: String,
    focused_field: Option<FieldId>,
}

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
enum FieldId {
    Name,
    Command,
    WorkingDirectory,
    Arguments,
    Environment,
}

impl FieldId {
    fn to_element_id(&self) -> ElementId {
        match self {
            FieldId::Name => ElementId::from("input_name"),
            FieldId::Command => ElementId::from("input_command"),
            FieldId::WorkingDirectory => ElementId::from("input_working_directory"),
            FieldId::Arguments => ElementId::from("input_arguments"),
            FieldId::Environment => ElementId::from("input_environment"),
        }
    }
}

impl RunConfigDialog {
    pub fn new(app_state: Arc<AppState>) -> Self {
        Self {
            app_state,
            is_open: false,
            config: None,
            name: String::new(),
            command: String::new(),
            working_directory: String::new(),
            arguments: String::new(),
            environment: String::new(),
            focused_field: None,
        }
    }

    pub fn open(&mut self, config: Option<RunConfig>) {
        self.is_open = true;
        self.config = config.clone();
        
        if let Some(config) = config {
            self.name = config.name.clone();
            self.command = config.command.clone();
            self.working_directory = config.working_directory.unwrap_or_default();
            self.arguments = config.arguments.as_ref()
                .map(|args| args.join(" "))
                .unwrap_or_default();
            self.environment = config.environment.as_ref()
                .map(|env| env.iter()
                    .map(|(k, v)| format!("{}={}", k, v))
                    .collect::<Vec<_>>()
                    .join("\n"))
                .unwrap_or_default();
        } else {
            self.name = String::new();
            self.command = String::new();
            self.working_directory = String::new();
            self.arguments = String::new();
            self.environment = String::new();
        }
    }

    pub fn close(&mut self) {
        self.is_open = false;
    }

    pub fn is_open(&self) -> bool {
        self.is_open
    }

    fn get_field_text(&self, field: FieldId) -> &String {
        match field {
            FieldId::Name => &self.name,
            FieldId::Command => &self.command,
            FieldId::WorkingDirectory => &self.working_directory,
            FieldId::Arguments => &self.arguments,
            FieldId::Environment => &self.environment,
        }
    }

    fn get_field_text_mut(&mut self, field: FieldId) -> &mut String {
        match field {
            FieldId::Name => &mut self.name,
            FieldId::Command => &mut self.command,
            FieldId::WorkingDirectory => &mut self.working_directory,
            FieldId::Arguments => &mut self.arguments,
            FieldId::Environment => &mut self.environment,
        }
    }

    fn render_input_field(
        &mut self,
        field: FieldId,
        label: &'static str,
        value: &str,
        _window: &mut Window,
        cx: &mut Context<Self>,
    ) -> impl IntoElement {
        let field_id = field.to_element_id();
        let is_focused = self.focused_field == Some(field);
        let field_clone = field;
        let value_str = value.to_string();
        
        div()
            .gap_y_2()
            .child(
                div()
                    .text_sm()
                    .font_weight(FontWeight::MEDIUM)
                    .text_color(rgb(0xffffff))
                    .child(label)
            )
            .child(
                div()
                    .id(field_id)
                    .w_full()
                    .px_3()
                    .py_2()
                    .bg(if is_focused { rgb(0x505050) } else { rgb(0x404040) })
                    .border_1()
                    .border_color(if is_focused { rgb(0x007acc) } else { rgb(0x606060) })
                    .rounded_md()
                    .text_color(rgb(0xffffff))
                    .cursor_text()
                    .on_click(cx.listener(move |this, _event, _window, cx| {
                        this.focused_field = Some(field_clone);
                        cx.notify();
                    }))
                    .child(value_str)
            )
    }

    fn render_form(&mut self, window: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        let name = self.name.clone();
        let command = self.command.clone();
        let working_directory = self.working_directory.clone();
        let arguments = self.arguments.clone();
        let environment = self.environment.clone();
        
        div()
            .p_6()
            .gap_y_4()
            .child(self.render_input_field(FieldId::Name, "Name", &name, window, cx))
            .child(self.render_input_field(FieldId::Command, "Command", &command, window, cx))
            .child(self.render_input_field(FieldId::WorkingDirectory, "Working Directory", &working_directory, window, cx))
            .child(self.render_input_field(FieldId::Arguments, "Arguments (space-separated)", &arguments, window, cx))
            .child(self.render_input_field(FieldId::Environment, "Environment Variables (one per line, format: KEY=value)", &environment, window, cx))
    }

    fn render_buttons(&mut self, cx: &mut Context<Self>, _window: &mut Window) -> impl IntoElement {
        
        div()
            .flex()
            .justify_end()
            .gap_3()
            .p_6()
            .border_t_1()
            .border_color(rgb(0x404040))
            .child(
                // Cancel button
                div()
                    .id(ElementId::from("cancel_button"))
                    .px_4()
                    .py_2()
                    .bg(rgb(0x6c757d))
                    .rounded_md()
                    .text_color(rgb(0xffffff))
                    .text_sm()
                    .cursor_pointer()
                    .hover(|style| style.bg(rgb(0x5a6268)))
                    .on_click(cx.listener(move |this, _event, _window, _cx| {
                        this.close();
                    }))
                    .child("Cancel")
            )
            .child(
                // Save button
                div()
                    .id(ElementId::from("save_button"))
                    .px_4()
                    .py_2()
                    .bg(rgb(0x007acc))
                    .rounded_md()
                    .text_color(rgb(0xffffff))
                    .text_sm()
                    .cursor_pointer()
                    .hover(|style| style.bg(rgb(0x005a9e)))
                    .on_click(cx.listener(move |this, _event, _window, _cx| {
                        this.on_save();
                    }))
                    .child("Save")
            )
    }

    fn on_save(&mut self) {
        // TODO: Implement save logic
        // For now, just close the dialog
        self.close();
    }
}

impl Render for RunConfigDialog {
    fn render(&mut self, window: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        if !self.is_open {
            return div();
        }

        div()
            .absolute()
            .inset_0()
            .bg(rgba(0x80000000))
            .flex()
            .items_center()
            .justify_center()
            .child(
                div()
                    .w_96()
                    .bg(rgb(0x2d2d2d))
                    .rounded_lg()
                    .border_1()
                    .border_color(rgb(0x404040))
                    .shadow_lg()
                    .child(
                        div()
                            .flex()
                            .flex_col()
                            .child(
                                // Header
                                div()
                                    .p_6()
                                    .border_b_1()
                                    .border_color(rgb(0x404040))
                                    .child(
                                        div()
                                            .text_lg()
                                            .font_weight(FontWeight::BOLD)
                                            .text_color(rgb(0xffffff))
                                            .child(
                                                if self.config.is_some() {
                                                    "Edit Configuration"
                                                } else {
                                                    "New Configuration"
                                                }
                                            )
                                    )
                            )
                            .child(self.render_form(window, cx))
                            .child(self.render_buttons(cx, window))
                    )
            )
    }
}