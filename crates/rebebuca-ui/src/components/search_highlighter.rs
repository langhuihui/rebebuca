use gpui::*;
use rebebuca_core::SearchMatch;
use std::collections::VecDeque;

pub struct SearchHighlighter {
    matches: Vec<SearchMatch>,
    current_match_index: Option<usize>,
}

impl SearchHighlighter {
    pub fn new() -> Self {
        Self {
            matches: Vec::new(),
            current_match_index: None,
        }
    }

    pub fn set_matches(&mut self, matches: Vec<SearchMatch>) {
        self.matches = matches;
        self.current_match_index = if self.matches.is_empty() { None } else { Some(0) };
    }

    pub fn get_matches(&self) -> &[SearchMatch] {
        &self.matches
    }

    pub fn get_current_match_index(&self) -> Option<usize> {
        self.current_match_index
    }

    pub fn get_current_match(&self) -> Option<&SearchMatch> {
        self.current_match_index.and_then(|i| self.matches.get(i))
    }

    pub fn next_match(&mut self) -> Option<&SearchMatch> {
        if self.matches.is_empty() {
            return None;
        }

        self.current_match_index = Some(
            (self.current_match_index.unwrap_or(0) + 1) % self.matches.len()
        );
        self.matches.get(self.current_match_index.unwrap())
    }

    pub fn previous_match(&mut self) -> Option<&SearchMatch> {
        if self.matches.is_empty() {
            return None;
        }

        let len = self.matches.len();
        self.current_match_index = Some(
            (self.current_match_index.unwrap_or(0) + len - 1) % len
        );
        self.matches.get(self.current_match_index.unwrap())
    }

    pub fn clear_matches(&mut self) {
        self.matches.clear();
        self.current_match_index = None;
    }

    pub fn has_matches(&self) -> bool {
        !self.matches.is_empty()
    }

    pub fn get_match_count(&self) -> usize {
        self.matches.len()
    }
}

impl Default for SearchHighlighter {
    fn default() -> Self {
        Self::new()
    }
}

/// Render text with search matches highlighted
pub fn render_highlighted_text(
    text: &str,
    highlighter: &SearchHighlighter,
    _cx: &mut Context<impl Render>,
) -> AnyElement {
    if highlighter.get_matches().is_empty() {
        return div()
            .text_sm()
            .text_color(rgb(0xffffff))
            .font_family("monospace")
            .whitespace_normal()
            .child(text.to_string())
            .into_any();
    }

    let mut elements = VecDeque::new();
    let mut last_end = 0;

    for (index, match_item) in highlighter.get_matches().iter().enumerate() {
        // Add text before the match
        if match_item.start > last_end {
            let before_text = &text[last_end..match_item.start];
            elements.push_back(
                div()
                    .text_sm()
                    .text_color(rgb(0xffffff))
                    .font_family("monospace")
                    .whitespace_normal()
                    .child(before_text.to_string())
            );
        }

        // Add the highlighted match
        let is_current = highlighter.get_current_match_index() == Some(index);
        let bg_color = if is_current {
            rgb(0x007acc) // Blue for current match
        } else {
            rgb(0xffff00) // Yellow for other matches
        };
        let text_color = if is_current {
            rgb(0xffffff) // White text for current match
        } else {
            rgb(0x000000) // Black text for other matches
        };

        elements.push_back(
            div()
                .text_sm()
                .text_color(text_color)
                .font_family("monospace")
                .whitespace_normal()
                .bg(bg_color)
                .px_1()
                .rounded_sm()
                .child(match_item.text.clone())
        );

        last_end = match_item.end;
    }

    // Add remaining text after the last match
    if last_end < text.len() {
        let after_text = &text[last_end..];
        elements.push_back(
            div()
                .text_sm()
                .text_color(rgb(0xffffff))
                .font_family("monospace")
                .whitespace_normal()
                    .child(after_text.to_string())
        );
    }

    // If no matches were processed, render the entire text
    if elements.is_empty() {
        elements.push_back(
            div()
                .text_sm()
                .text_color(rgb(0xffffff))
                .font_family("monospace")
                .whitespace_normal()
                .child(text.to_string())
        );
    }

    div()
        .flex()
        .flex_wrap()
        .children(elements)
        .into_any()
}

/// Render search match statistics
pub fn render_search_stats(
    highlighter: &SearchHighlighter,
    _cx: &mut Context<impl Render>,
) -> AnyElement {
    if !highlighter.has_matches() {
        return div().into_any();
    }

    let current = highlighter.get_current_match_index().unwrap_or(0) + 1;
    let total = highlighter.get_match_count();

    div()
        .flex()
        .items_center()
        .gap_2()
        .px_3()
        .py_1()
        .bg(rgb(0x1a1a1a))
        .border_1()
        .border_color(rgb(0x404040))
        .rounded_md()
        .text_sm()
        .text_color(rgb(0x888888))
        .child(format!("{} of {}", current, total))
        .into_any()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_search_highlighter() {
        let mut highlighter = SearchHighlighter::new();
        
        let matches = vec![
            SearchMatch {
                start: 0,
                end: 4,
                text: "test".to_string(),
            },
            SearchMatch {
                start: 10,
                end: 14,
                text: "test".to_string(),
            },
        ];

        highlighter.set_matches(matches);
        assert_eq!(highlighter.get_match_count(), 2);
        assert_eq!(highlighter.get_current_match_index(), Some(0));

        let next = highlighter.next_match();
        assert!(next.is_some());
        assert_eq!(highlighter.get_current_match_index(), Some(1));

        let prev = highlighter.previous_match();
        assert!(prev.is_some());
        assert_eq!(highlighter.get_current_match_index(), Some(0));
    }
}
