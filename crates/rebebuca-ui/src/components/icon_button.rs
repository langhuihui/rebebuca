use gpui::*;
use crate::icons::{IconData, Icons, create_icon_element};

/// Icon button component that displays an icon with optional text
#[derive(Clone)]
pub struct IconButton {
    icon: IconData,
    text: Option<String>,
    size: f32,
    variant: ButtonVariant,
    disabled: bool,
}

#[derive(Debug, Clone, PartialEq)]
pub enum ButtonVariant {
    Primary,
    Secondary,
    Ghost,
    Text,
    Danger,
}

impl IconButton {
    pub fn new(icon: IconData) -> Self {
        Self {
            icon,
            text: None,
            size: 16.0,
            variant: ButtonVariant::Ghost,
            disabled: false,
        }
    }

    pub fn with_text(mut self, text: impl Into<String>) -> Self {
        self.text = Some(text.into());
        self
    }

    pub fn with_size(mut self, size: f32) -> Self {
        self.size = size;
        self
    }

    pub fn with_variant(mut self, variant: ButtonVariant) -> Self {
        self.variant = variant;
        self
    }

    pub fn with_disabled(mut self, disabled: bool) -> Self {
        self.disabled = disabled;
        self
    }
}

impl IconButton {
    /// Render the button as a GPUI element
    pub fn render(self) -> impl IntoElement {
        let icon_element = create_icon_element(&self.icon, self.size);
        
        let base_button = div()
            .flex()
            .items_center()
            .justify_center()
            .gap(px(4.0))
            .px(px(8.0))
            .py(px(4.0))
            .rounded_md()
            .cursor_pointer();

        let styled_button = match self.variant {
            ButtonVariant::Primary => base_button
                .bg(gpui::Fill::Color(gpui::Hsla::black().alpha(0.1).into())),
            
            ButtonVariant::Secondary => base_button
                .border_1()
                .border_color(gpui::Hsla::black().alpha(0.2)),
            
            ButtonVariant::Ghost => base_button,
            
            ButtonVariant::Text => base_button
                .px(px(4.0))
                .py(px(2.0)),
            
            ButtonVariant::Danger => base_button
                .text_color(gpui::Hsla::red()),
        };

        let final_button = if self.disabled {
            styled_button
                .opacity(0.5)
                .cursor_not_allowed()
        } else {
            styled_button
        };

        if let Some(text) = self.text {
            final_button
                .child(icon_element)
                .child(
                    div()
                        .text_sm()
                        .child(text)
                )
        } else {
            final_button.child(icon_element)
        }
    }
}

/// Predefined icon buttons for common actions
pub struct IconButtons;

impl IconButtons {
    /// Play button for running commands
    pub fn play() -> IconButton {
        IconButton::new(Icons::play())
            .with_variant(ButtonVariant::Primary)
    }

    /// Stop button for stopping running processes
    pub fn stop(is_running: bool) -> IconButton {
        IconButton::new(Icons::stop(is_running))
            .with_variant(if is_running { ButtonVariant::Danger } else { ButtonVariant::Ghost })
    }

    /// Edit button for modifying configurations
    pub fn edit() -> IconButton {
        IconButton::new(Icons::edit())
            .with_variant(ButtonVariant::Ghost)
    }

    /// Delete button for removing items
    pub fn delete() -> IconButton {
        IconButton::new(Icons::delete())
            .with_variant(ButtonVariant::Danger)
    }

    /// Clear button for clearing content
    pub fn clear() -> IconButton {
        IconButton::new(Icons::clear())
            .with_variant(ButtonVariant::Ghost)
    }

    /// Pin button for pinning items
    pub fn pin(is_pinned: bool) -> IconButton {
        let icon = if is_pinned { Icons::pin() } else { Icons::pin_outline() };
        IconButton::new(icon)
            .with_variant(ButtonVariant::Ghost)
    }

    /// Replay button for re-running commands
    pub fn replay() -> IconButton {
        IconButton::new(Icons::replay())
            .with_variant(ButtonVariant::Ghost)
    }

    /// Replay history button
    pub fn replay_history() -> IconButton {
        IconButton::new(Icons::replay_history())
            .with_variant(ButtonVariant::Ghost)
    }

    /// File button for file operations
    pub fn file() -> IconButton {
        IconButton::new(Icons::file())
            .with_variant(ButtonVariant::Ghost)
    }

    /// Folder button for folder operations
    pub fn folder() -> IconButton {
        IconButton::new(Icons::folder())
            .with_variant(ButtonVariant::Ghost)
    }

    /// Check button for confirmation
    pub fn check() -> IconButton {
        IconButton::new(Icons::check())
            .with_variant(ButtonVariant::Primary)
    }

    /// Close button for closing dialogs
    pub fn close() -> IconButton {
        IconButton::new(Icons::close())
            .with_variant(ButtonVariant::Ghost)
    }

    /// New config button
    pub fn new_config() -> IconButton {
        IconButton::new(Icons::new_config())
            .with_variant(ButtonVariant::Primary)
            .with_text("新建配置")
    }

    /// Export button
    pub fn export() -> IconButton {
        IconButton::new(Icons::export())
            .with_variant(ButtonVariant::Ghost)
    }

    /// Sun button for light theme
    pub fn sun() -> IconButton {
        IconButton::new(Icons::sun())
            .with_variant(ButtonVariant::Ghost)
    }

    /// Moon button for dark theme
    pub fn moon() -> IconButton {
        IconButton::new(Icons::moon())
            .with_variant(ButtonVariant::Ghost)
    }

    /// System button
    pub fn system() -> IconButton {
        IconButton::new(Icons::system())
            .with_variant(ButtonVariant::Ghost)
    }

    /// Sidebar button
    pub fn sidebar() -> IconButton {
        IconButton::new(Icons::sidebar())
            .with_variant(ButtonVariant::Ghost)
    }

    /// History panel button
    pub fn history_panel() -> IconButton {
        IconButton::new(Icons::history_panel())
            .with_variant(ButtonVariant::Ghost)
    }
}

/// Action button group for displaying multiple related actions
#[derive(Clone)]
pub struct ActionButtonGroup {
    buttons: Vec<IconButton>,
    visible: bool,
}

impl ActionButtonGroup {
    pub fn new() -> Self {
        Self {
            buttons: Vec::new(),
            visible: false,
        }
    }

    pub fn with_buttons(mut self, buttons: Vec<IconButton>) -> Self {
        self.buttons = buttons;
        self
    }

    pub fn with_visibility(mut self, visible: bool) -> Self {
        self.visible = visible;
        self
    }

    pub fn add_button(mut self, button: IconButton) -> Self {
        self.buttons.push(button);
        self
    }
}

impl ActionButtonGroup {
    /// Render the button group as a GPUI element
    pub fn render(self) -> impl IntoElement {
        if self.buttons.is_empty() {
            return div();
        }

        div()
            .flex()
            .items_center()
            .gap(px(2.0))
            .opacity(if self.visible { 1.0 } else { 0.0 })
            .children(self.buttons.into_iter().map(|button| button.render()))
    }
}

/// Status indicator with icon
#[derive(Clone)]
pub struct StatusIndicator {
    status: StatusType,
    size: f32,
}

#[derive(Debug, Clone, PartialEq)]
pub enum StatusType {
    Success,
    Error,
    Warning,
    Info,
    Running,
}

impl StatusIndicator {
    pub fn new(status: StatusType) -> Self {
        Self {
            status,
            size: 8.0,
        }
    }

    pub fn with_size(mut self, size: f32) -> Self {
        self.size = size;
        self
    }

    fn get_status_color(&self) -> gpui::Hsla {
        match self.status {
            StatusType::Success => gpui::Hsla::green(),
            StatusType::Error => gpui::Hsla::red(),
            StatusType::Warning => gpui::Hsla::blue(), // Use blue instead of yellow
            StatusType::Info => gpui::Hsla::blue(),
            StatusType::Running => gpui::Hsla::blue(),
        }
    }
}

impl StatusIndicator {
    /// Render the status indicator as a GPUI element
    pub fn render(self) -> impl IntoElement {
        div()
            .size(px(self.size))
            .rounded_full()
            .bg(gpui::Fill::Color(self.get_status_color().into()))
    }
}