use gpui::*;

/// Icon data structure for SVG icons
#[derive(Debug, Clone)]
pub struct IconData {
    pub view_box: &'static str,
    pub paths: Vec<IconPath>,
}

#[derive(Debug, Clone)]
pub struct IconPath {
    pub d: Option<&'static str>,
    pub points: Option<&'static str>,
    pub x1: Option<&'static str>,
    pub y1: Option<&'static str>,
    pub x2: Option<&'static str>,
    pub y2: Option<&'static str>,
    pub cx: Option<&'static str>,
    pub cy: Option<&'static str>,
    pub r: Option<&'static str>,
    pub x: Option<&'static str>,
    pub y: Option<&'static str>,
    pub width: Option<&'static str>,
    pub height: Option<&'static str>,
    pub rx: Option<&'static str>,
    pub ry: Option<&'static str>,
    pub fill: Option<&'static str>,
    pub stroke: Option<&'static str>,
    pub stroke_width: Option<&'static str>,
    pub stroke_linecap: Option<&'static str>,
    pub stroke_linejoin: Option<&'static str>,
}

impl IconPath {
    pub fn line(x1: &'static str, y1: &'static str, x2: &'static str, y2: &'static str) -> Self {
        Self {
            d: None,
            points: None,
            x1: Some(x1),
            y1: Some(y1),
            x2: Some(x2),
            y2: Some(y2),
            cx: None,
            cy: None,
            r: None,
            x: None,
            y: None,
            width: None,
            height: None,
            rx: None,
            ry: None,
            fill: None,
            stroke: Some("currentColor"),
            stroke_width: Some("2"),
            stroke_linecap: Some("round"),
            stroke_linejoin: Some("round"),
        }
    }

    pub fn polyline(points: &'static str) -> Self {
        Self {
            d: None,
            points: Some(points),
            x1: None,
            y1: None,
            x2: None,
            y2: None,
            cx: None,
            cy: None,
            r: None,
            x: None,
            y: None,
            width: None,
            height: None,
            rx: None,
            ry: None,
            fill: None,
            stroke: Some("currentColor"),
            stroke_width: Some("2"),
            stroke_linecap: Some("round"),
            stroke_linejoin: Some("round"),
        }
    }

    pub fn polygon(points: &'static str) -> Self {
        Self {
            d: None,
            points: Some(points),
            x1: None,
            y1: None,
            x2: None,
            y2: None,
            cx: None,
            cy: None,
            r: None,
            x: None,
            y: None,
            width: None,
            height: None,
            rx: None,
            ry: None,
            fill: Some("currentColor"),
            stroke: None,
            stroke_width: None,
            stroke_linecap: None,
            stroke_linejoin: None,
        }
    }

    pub fn path(d: &'static str) -> Self {
        Self {
            d: Some(d),
            points: None,
            x1: None,
            y1: None,
            x2: None,
            y2: None,
            cx: None,
            cy: None,
            r: None,
            x: None,
            y: None,
            width: None,
            height: None,
            rx: None,
            ry: None,
            fill: None,
            stroke: Some("currentColor"),
            stroke_width: Some("2"),
            stroke_linecap: Some("round"),
            stroke_linejoin: Some("round"),
        }
    }

    pub fn circle(cx: &'static str, cy: &'static str, r: &'static str) -> Self {
        Self {
            d: None,
            points: None,
            x1: None,
            y1: None,
            x2: None,
            y2: None,
            cx: Some(cx),
            cy: Some(cy),
            r: Some(r),
            x: None,
            y: None,
            width: None,
            height: None,
            rx: None,
            ry: None,
            fill: None,
            stroke: Some("currentColor"),
            stroke_width: Some("2"),
            stroke_linecap: Some("round"),
            stroke_linejoin: Some("round"),
        }
    }

    pub fn rect(
        x: &'static str,
        y: &'static str,
        width: &'static str,
        height: &'static str,
        rx: Option<&'static str>,
        ry: Option<&'static str>,
    ) -> Self {
        Self {
            d: None,
            points: None,
            x1: None,
            y1: None,
            x2: None,
            y2: None,
            cx: None,
            cy: None,
            r: None,
            x: Some(x),
            y: Some(y),
            width: Some(width),
            height: Some(height),
            rx,
            ry,
            fill: None,
            stroke: Some("currentColor"),
            stroke_width: Some("2"),
            stroke_linecap: Some("round"),
            stroke_linejoin: Some("round"),
        }
    }
}

/// Icon definitions based on the TypeScript icon components
pub struct Icons;

impl Icons {
    /// Close icon (X)
    pub fn close() -> IconData {
        IconData {
            view_box: "0 0 24 24",
            paths: vec![
                IconPath::line("18", "6", "6", "18"),
                IconPath::line("6", "6", "18", "18"),
            ],
        }
    }

    /// Check icon (checkmark)
    pub fn check() -> IconData {
        IconData {
            view_box: "0 0 24 24",
            paths: vec![IconPath::polyline("20 6 9 17 4 12")],
        }
    }

    /// Play icon
    pub fn play() -> IconData {
        IconData {
            view_box: "0 0 24 24",
            paths: vec![IconPath::polygon("5 3 19 12 5 21 5 3")],
        }
    }

    /// Edit icon
    pub fn edit() -> IconData {
        IconData {
            view_box: "0 0 24 24",
            paths: vec![
                IconPath::path("M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"),
                IconPath::path("M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"),
            ],
        }
    }

    /// Stop icon
    pub fn stop(is_running: bool) -> IconData {
        let fill_color = if is_running { "#ef4444" } else { "#6b7280" };
        IconData {
            view_box: "0 0 24 24",
            paths: vec![IconPath {
                d: None,
                points: None,
                x1: None,
                y1: None,
                x2: None,
                y2: None,
                cx: None,
                cy: None,
                r: None,
                x: Some("5"),
                y: Some("5"),
                width: Some("16"),
                height: Some("16"),
                rx: Some("1"),
                ry: None,
                fill: Some(fill_color),
                stroke: None,
                stroke_width: None,
                stroke_linecap: None,
                stroke_linejoin: None,
            }],
        }
    }

    /// Export icon
    pub fn export() -> IconData {
        IconData {
            view_box: "0 0 24 24",
            paths: vec![
                IconPath::path("M3 6h18"),
                IconPath::path("M3 12h18"),
                IconPath::path("M3 18h18"),
                IconPath::path("M12 15l3 3 3-3"),
            ],
        }
    }

    /// Clear/Delete icon
    pub fn clear() -> IconData {
        IconData {
            view_box: "0 0 24 24",
            paths: vec![
                IconPath::path("M3 6h18"),
                IconPath::path("M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"),
                IconPath::path("M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"),
            ],
        }
    }

    /// Folder icon
    pub fn folder() -> IconData {
        IconData {
            view_box: "0 0 24 24",
            paths: vec![IconPath::path(
                "M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z",
            )],
        }
    }

    /// Replay/Restart icon
    pub fn replay() -> IconData {
        IconData {
            view_box: "0 0 24 24",
            paths: vec![
                IconPath::path("M19.8 16a9 9 0 1 1-7.8-13 9.75 9.75 0 0 1 6.74 2.74L21 8"),
                IconPath::path("M21 3v5h-5"),
                IconPath {
                    d: None,
                    points: Some("16 14 24 18 16 22 16 14"),
                    x1: None,
                    y1: None,
                    x2: None,
                    y2: None,
                    cx: None,
                    cy: None,
                    r: None,
                    x: None,
                    y: None,
                    width: None,
                    height: None,
                    rx: None,
                    ry: None,
                    fill: Some("#00d084"),
                    stroke: Some("#00d084"),
                    stroke_width: Some("2"),
                    stroke_linecap: Some("round"),
                    stroke_linejoin: Some("round"),
                },
            ],
        }
    }

    /// File icon
    pub fn file() -> IconData {
        IconData {
            view_box: "0 0 24 24",
            paths: vec![IconPath::path(
                "M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z",
            )],
        }
    }

    /// Replay history icon
    pub fn replay_history() -> IconData {
        IconData {
            view_box: "0 0 24 24",
            paths: vec![
                IconPath::path("M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"),
                IconPath::path("M3 3v5h5"),
            ],
        }
    }

    /// Delete icon
    pub fn delete() -> IconData {
        IconData {
            view_box: "0 0 24 24",
            paths: vec![
                IconPath::path("M3 6h18"),
                IconPath::path("M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"),
                IconPath::path("M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"),
            ],
        }
    }

    /// Sun icon (light theme)
    pub fn sun() -> IconData {
        IconData {
            view_box: "0 0 24 24",
            paths: vec![
                IconPath::circle("12", "12", "5"),
                IconPath::line("12", "1", "12", "3"),
                IconPath::line("12", "21", "12", "23"),
                IconPath::line("4.22", "4.22", "5.64", "5.64"),
                IconPath::line("18.36", "18.36", "19.78", "19.78"),
                IconPath::line("1", "12", "3", "12"),
                IconPath::line("21", "12", "23", "12"),
                IconPath::line("4.22", "19.78", "5.64", "18.36"),
                IconPath::line("18.36", "5.64", "19.78", "4.22"),
            ],
        }
    }

    /// Moon icon (dark theme)
    pub fn moon() -> IconData {
        IconData {
            view_box: "0 0 24 24",
            paths: vec![IconPath::path("M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z")],
        }
    }

    /// System icon
    pub fn system() -> IconData {
        IconData {
            view_box: "0 0 24 24",
            paths: vec![
                IconPath::rect("2", "3", "20", "14", Some("2"), Some("2")),
                IconPath::line("8", "21", "16", "21"),
                IconPath::line("12", "17", "12", "21"),
            ],
        }
    }

    /// Sidebar icon
    pub fn sidebar() -> IconData {
        IconData {
            view_box: "0 0 24 24",
            paths: vec![
                IconPath {
                    d: None,
                    points: None,
                    x1: None,
                    y1: None,
                    x2: None,
                    y2: None,
                    cx: None,
                    cy: None,
                    r: None,
                    x: Some("2"),
                    y: Some("3"),
                    width: Some("20"),
                    height: Some("18"),
                    rx: Some("2"),
                    ry: Some("2"),
                    fill: Some("none"),
                    stroke: Some("currentColor"),
                    stroke_width: Some("1.5"),
                    stroke_linecap: Some("round"),
                    stroke_linejoin: Some("round"),
                },
                IconPath {
                    d: None,
                    points: None,
                    x1: None,
                    y1: None,
                    x2: None,
                    y2: None,
                    cx: None,
                    cy: None,
                    r: None,
                    x: Some("2"),
                    y: Some("3"),
                    width: Some("10"),
                    height: Some("18"),
                    rx: Some("2"),
                    ry: Some("2"),
                    fill: Some("rgba(255,255,255,0.3)"),
                    stroke: None,
                    stroke_width: None,
                    stroke_linecap: None,
                    stroke_linejoin: None,
                },
                IconPath {
                    d: None,
                    points: None,
                    x1: None,
                    y1: None,
                    x2: None,
                    y2: None,
                    cx: None,
                    cy: None,
                    r: None,
                    x: Some("2"),
                    y: Some("3"),
                    width: Some("10"),
                    height: Some("18"),
                    rx: Some("2"),
                    ry: Some("2"),
                    fill: Some("none"),
                    stroke: Some("currentColor"),
                    stroke_width: Some("1.5"),
                    stroke_linecap: Some("round"),
                    stroke_linejoin: Some("round"),
                },
            ],
        }
    }

    /// History panel icon
    pub fn history_panel() -> IconData {
        IconData {
            view_box: "0 0 24 24",
            paths: vec![
                IconPath {
                    d: None,
                    points: None,
                    x1: None,
                    y1: None,
                    x2: None,
                    y2: None,
                    cx: None,
                    cy: None,
                    r: None,
                    x: Some("2"),
                    y: Some("3"),
                    width: Some("20"),
                    height: Some("18"),
                    rx: Some("2"),
                    ry: Some("2"),
                    fill: Some("none"),
                    stroke: Some("currentColor"),
                    stroke_width: Some("1.5"),
                    stroke_linecap: Some("round"),
                    stroke_linejoin: Some("round"),
                },
                IconPath {
                    d: None,
                    points: None,
                    x1: None,
                    y1: None,
                    x2: None,
                    y2: None,
                    cx: None,
                    cy: None,
                    r: None,
                    x: Some("12"),
                    y: Some("3"),
                    width: Some("10"),
                    height: Some("18"),
                    rx: Some("2"),
                    ry: Some("2"),
                    fill: Some("rgba(255,255,255,0.3)"),
                    stroke: None,
                    stroke_width: None,
                    stroke_linecap: None,
                    stroke_linejoin: None,
                },
                IconPath {
                    d: None,
                    points: None,
                    x1: None,
                    y1: None,
                    x2: None,
                    y2: None,
                    cx: None,
                    cy: None,
                    r: None,
                    x: Some("12"),
                    y: Some("3"),
                    width: Some("10"),
                    height: Some("18"),
                    rx: Some("2"),
                    ry: Some("2"),
                    fill: Some("none"),
                    stroke: Some("currentColor"),
                    stroke_width: Some("1.5"),
                    stroke_linecap: Some("round"),
                    stroke_linejoin: Some("round"),
                },
            ],
        }
    }

    /// New config icon
    pub fn new_config() -> IconData {
        IconData {
            view_box: "0 0 24 24",
            paths: vec![
                IconPath::circle("12", "12", "10"),
                IconPath::line("12", "8", "12", "16"),
                IconPath::line("8", "12", "16", "12"),
            ],
        }
    }

    /// Status indicator icon
    pub fn status_indicator() -> IconData {
        IconData {
            view_box: "0 0 24 24",
            paths: vec![IconPath::circle("12", "12", "6")],
        }
    }

    /// Pin icon (filled)
    pub fn pin() -> IconData {
        IconData {
            view_box: "0 0 24 24",
            paths: vec![IconPath {
                d: Some("M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"),
                points: None,
                x1: None,
                y1: None,
                x2: None,
                y2: None,
                cx: None,
                cy: None,
                r: None,
                x: None,
                y: None,
                width: None,
                height: None,
                rx: None,
                ry: None,
                fill: Some("currentColor"),
                stroke: None,
                stroke_width: None,
                stroke_linecap: None,
                stroke_linejoin: None,
            }],
        }
    }

    /// Pin icon (outline)
    pub fn pin_outline() -> IconData {
        IconData {
            view_box: "0 0 24 24",
            paths: vec![IconPath {
                d: Some("M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"),
                points: None,
                x1: None,
                y1: None,
                x2: None,
                y2: None,
                cx: None,
                cy: None,
                r: None,
                x: None,
                y: None,
                width: None,
                height: None,
                rx: None,
                ry: None,
                fill: Some("none"),
                stroke: Some("currentColor"),
                stroke_width: Some("2"),
                stroke_linecap: Some("round"),
                stroke_linejoin: Some("round"),
            }],
        }
    }
}

/// Convert IconData to SVG string
pub fn icon_to_svg_string(icon_data: &IconData) -> String {
    let mut svg = format!(r#"<svg xmlns="http://www.w3.org/2000/svg" viewBox="{}">"#, icon_data.view_box);
    
    for path in &icon_data.paths {
        svg.push_str("<");
        
        // Determine element type based on available fields
        if path.d.is_some() {
            svg.push_str("path");
            if let Some(d) = path.d {
                svg.push_str(&format!(r#" d="{}""#, d));
            }
        } else if path.points.is_some() {
            // Check if it's a polygon or polyline based on fill
            if path.fill.is_some() {
                svg.push_str("polygon");
            } else {
                svg.push_str("polyline");
            }
            if let Some(points) = path.points {
                svg.push_str(&format!(r#" points="{}""#, points));
            }
        } else if path.cx.is_some() && path.cy.is_some() && path.r.is_some() {
            svg.push_str("circle");
            if let Some(cx) = path.cx {
                svg.push_str(&format!(r#" cx="{}""#, cx));
            }
            if let Some(cy) = path.cy {
                svg.push_str(&format!(r#" cy="{}""#, cy));
            }
            if let Some(r) = path.r {
                svg.push_str(&format!(r#" r="{}""#, r));
            }
        } else if path.x1.is_some() && path.y1.is_some() && path.x2.is_some() && path.y2.is_some() {
            svg.push_str("line");
            if let Some(x1) = path.x1 {
                svg.push_str(&format!(r#" x1="{}""#, x1));
            }
            if let Some(y1) = path.y1 {
                svg.push_str(&format!(r#" y1="{}""#, y1));
            }
            if let Some(x2) = path.x2 {
                svg.push_str(&format!(r#" x2="{}""#, x2));
            }
            if let Some(y2) = path.y2 {
                svg.push_str(&format!(r#" y2="{}""#, y2));
            }
        } else if path.x.is_some() && path.y.is_some() && path.width.is_some() && path.height.is_some() {
            svg.push_str("rect");
            if let Some(x) = path.x {
                svg.push_str(&format!(r#" x="{}""#, x));
            }
            if let Some(y) = path.y {
                svg.push_str(&format!(r#" y="{}""#, y));
            }
            if let Some(width) = path.width {
                svg.push_str(&format!(r#" width="{}""#, width));
            }
            if let Some(height) = path.height {
                svg.push_str(&format!(r#" height="{}""#, height));
            }
            if let Some(rx) = path.rx {
                svg.push_str(&format!(r#" rx="{}""#, rx));
            }
            if let Some(ry) = path.ry {
                svg.push_str(&format!(r#" ry="{}""#, ry));
            }
        }
        
        // Add styling attributes
        if let Some(fill) = path.fill {
            svg.push_str(&format!(r#" fill="{}""#, fill));
        } else {
            svg.push_str(r#" fill="currentColor""#);
        }
        
        if let Some(stroke) = path.stroke {
            svg.push_str(&format!(r#" stroke="{}""#, stroke));
        }
        
        if let Some(stroke_width) = path.stroke_width {
            svg.push_str(&format!(r#" stroke-width="{}""#, stroke_width));
        }
        
        if let Some(stroke_linecap) = path.stroke_linecap {
            svg.push_str(&format!(r#" stroke-linecap="{}""#, stroke_linecap));
        }
        
        if let Some(stroke_linejoin) = path.stroke_linejoin {
            svg.push_str(&format!(r#" stroke-linejoin="{}""#, stroke_linejoin));
        }
        
        svg.push_str("/>");
    }
    
    svg.push_str("</svg>");
    svg
}

/// Helper function to create an icon element from IconData
/// Currently creates a styled div with the icon representation
/// This is a simplified implementation until we can properly render SVG files
pub fn create_icon_element(_icon_data: &IconData, size: f32) -> impl IntoElement {
    // Create a div that represents the icon
    // For now, we'll use a styled div with proper sizing
    // In the future, this could load an SVG file created from icon_data
    div()
        .size(px(size))
        .flex()
        .items_center()
        .justify_center()
        .bg(gpui::Fill::Color(gpui::Hsla::white().alpha(0.1).into()))
        .rounded_md()
        .child(
            div()
                .text_color(gpui::Hsla::white())
                .text_xs()
                .font_weight(gpui::FontWeight::BOLD)
                .child("⚬") // Placeholder icon character
        )
}
