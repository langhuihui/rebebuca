use gpui::*;
use regex::Regex;
use std::collections::HashMap;

#[derive(Debug, Clone)]
pub struct AnsiConverter {
    escape_regex: Regex,
    color_map: HashMap<u8, Hsla>,
}

impl Default for AnsiConverter {
    fn default() -> Self {
        Self::new()
    }
}

impl AnsiConverter {
    pub fn new() -> Self {
        let escape_regex = Regex::new(r"\x1b\[([0-9;]+)m").unwrap();
        
        let mut color_map = HashMap::new();
        
        // Standard colors
        color_map.insert(30, hsla(0.0, 0.0, 0.0, 1.0)); // Black
        color_map.insert(31, hsla(0.0, 1.0, 0.5, 1.0)); // Red
        color_map.insert(32, hsla(120.0, 1.0, 0.4, 1.0)); // Green
        color_map.insert(33, hsla(60.0, 1.0, 0.5, 1.0)); // Yellow
        color_map.insert(34, hsla(240.0, 1.0, 0.5, 1.0)); // Blue
        color_map.insert(35, hsla(300.0, 1.0, 0.5, 1.0)); // Magenta
        color_map.insert(36, hsla(180.0, 1.0, 0.5, 1.0)); // Cyan
        color_map.insert(37, hsla(0.0, 0.0, 0.9, 1.0)); // White
        
        // Bright colors
        color_map.insert(90, hsla(0.0, 0.0, 0.3, 1.0)); // Bright Black
        color_map.insert(91, hsla(0.0, 1.0, 0.7, 1.0)); // Bright Red
        color_map.insert(92, hsla(120.0, 1.0, 0.6, 1.0)); // Bright Green
        color_map.insert(93, hsla(60.0, 1.0, 0.7, 1.0)); // Bright Yellow
        color_map.insert(94, hsla(240.0, 1.0, 0.7, 1.0)); // Bright Blue
        color_map.insert(95, hsla(300.0, 1.0, 0.7, 1.0)); // Bright Magenta
        color_map.insert(96, hsla(180.0, 1.0, 0.7, 1.0)); // Bright Cyan
        color_map.insert(97, hsla(0.0, 0.0, 1.0, 1.0)); // Bright White
        
        Self {
            escape_regex,
            color_map,
        }
    }

    pub fn convert_to_html(&self, text: &str) -> String {
        let mut result = String::new();
        let mut current_color = None;
        let mut bold = false;
        let mut italic = false;
        let mut underline = false;
        
        let mut chars = text.chars().peekable();
        
        while let Some(ch) = chars.next() {
            if ch == '\x1b' && chars.peek() == Some(&'[') {
                // Found ANSI escape sequence
                let mut escape = String::from("\x1b[");
                chars.next(); // consume '['
                
                while let Some(&ch) = chars.peek() {
                    if ch == 'm' {
                        escape.push(ch);
                        chars.next(); // consume 'm'
                        break;
                    } else {
                        escape.push(ch);
                        chars.next();
                    }
                }
                
                // Parse the escape sequence
                if let Some(captures) = self.escape_regex.captures(&escape) {
                    if let Some(codes_str) = captures.get(1) {
                        let codes: Vec<u8> = codes_str
                            .as_str()
                            .split(';')
                            .filter_map(|s| s.parse().ok())
                            .collect();
                        
                        for &code in &codes {
                            match code {
                                0 => {
                                    // Reset
                                    current_color = None;
                                    bold = false;
                                    italic = false;
                                    underline = false;
                                }
                                1 => bold = true,
                                3 => italic = true,
                                4 => underline = true,
                                22 => bold = false,
                                23 => italic = false,
                                24 => underline = false,
                                30..=37 | 90..=97 => {
                                    current_color = self.color_map.get(&code).copied();
                                }
                                _ => {}
                            }
                        }
                    }
                }
            } else {
                // Regular character
                let mut style = String::new();
                
                if let Some(color) = current_color {
                    let (r, g, b) = color.to_rgb();
                    let a = 1.0;
                    style.push_str(&format!("color: rgba({}, {}, {}, {});", 
                        (r * 255.0) as u8, 
                        (g * 255.0) as u8, 
                        (b * 255.0) as u8, 
                        a));
                }
                
                if bold {
                    style.push_str("font-weight: bold;");
                }
                if italic {
                    style.push_str("font-style: italic;");
                }
                if underline {
                    style.push_str("text-decoration: underline;");
                }
                
                if style.is_empty() {
                    result.push(ch);
                } else {
                    result.push_str(&format!("<span style=\"{}\">{}</span>", style, escape_html_char(ch)));
                }
            }
        }
        
        result
    }
}

fn escape_html_char(ch: char) -> String {
    match ch {
        '<' => "&lt;".to_string(),
        '>' => "&gt;".to_string(),
        '&' => "&amp;".to_string(),
        '"' => "&quot;".to_string(),
        '\'' => "&#39;".to_string(),
        _ => ch.to_string(),
    }
}

fn hsla(h: f32, s: f32, l: f32, a: f32) -> Hsla {
    Hsla::hsl(h / 360.0, s, l).with_alpha(a)
}
