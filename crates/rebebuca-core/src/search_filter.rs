use anyhow::Result;
use chrono::{DateTime, Utc};
use crate::{RunConfig, RunHistory, HistoryStatus};
use std::collections::HashMap;

#[derive(Debug, Clone, PartialEq)]
pub enum FilterType {
    All,
    Status(HistoryStatus),
    Config(String),
    DateRange(DateTime<Utc>, DateTime<Utc>),
    Text(String),
}

#[derive(Debug, Clone)]
pub struct SearchFilter {
    pub query: String,
    pub filter_type: FilterType,
    pub case_sensitive: bool,
    pub regex: bool,
}

impl Default for SearchFilter {
    fn default() -> Self {
        Self {
            query: String::new(),
            filter_type: FilterType::All,
            case_sensitive: false,
            regex: false,
        }
    }
}

impl SearchFilter {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn with_query(mut self, query: String) -> Self {
        self.query = query;
        self
    }

    pub fn with_filter_type(mut self, filter_type: FilterType) -> Self {
        self.filter_type = filter_type;
        self
    }

    pub fn with_case_sensitive(mut self, case_sensitive: bool) -> Self {
        self.case_sensitive = case_sensitive;
        self
    }

    pub fn with_regex(mut self, regex: bool) -> Self {
        self.regex = regex;
        self
    }

    /// Filter run history based on the search criteria
    pub fn filter_history(&self, history: &[RunHistory]) -> Result<Vec<RunHistory>> {
        let mut filtered = Vec::new();

        for item in history {
            if self.matches_history(item)? {
                filtered.push(item.clone());
            }
        }

        Ok(filtered)
    }

    /// Filter run configurations based on the search criteria
    pub fn filter_configs(&self, configs: &[RunConfig]) -> Result<Vec<RunConfig>> {
        let mut filtered = Vec::new();

        for config in configs {
            if self.matches_config(config)? {
                filtered.push(config.clone());
            }
        }

        Ok(filtered)
    }

    /// Search in console output text
    pub fn search_in_text(&self, text: &str) -> Result<Vec<SearchMatch>> {
        if self.query.is_empty() {
            return Ok(vec![]);
        }

        let search_text = if self.case_sensitive {
            text.to_string()
        } else {
            text.to_lowercase()
        };

        let search_query = if self.case_sensitive {
            self.query.clone()
        } else {
            self.query.to_lowercase()
        };

        let mut matches = Vec::new();

        if self.regex {
            self.search_regex(&search_text, &search_query, &mut matches)?;
        } else {
            self.search_plain(&search_text, &search_query, &mut matches);
        }

        Ok(matches)
    }

    fn matches_history(&self, history: &RunHistory) -> Result<bool> {
        // Check filter type
        match &self.filter_type {
            FilterType::All => {}
            FilterType::Status(status) => {
                if &history.status != status {
                    return Ok(false);
                }
            }
            FilterType::Config(config_id) => {
                if &history.config_id != config_id {
                    return Ok(false);
                }
            }
            FilterType::DateRange(start, end) => {
                if let Some(start_time) = history.start_time {
                    let start_secs = start.timestamp();
                    let end_secs = end.timestamp();
                    if start_time < start_secs * 1000 || start_time > end_secs * 1000 {
                        return Ok(false);
                    }
                } else {
                    return Ok(false);
                }
            }
            FilterType::Text(_) => {
                // Text filtering is handled by query matching
            }
        }

        // Check query match
        if !self.query.is_empty() {
            let output_text = history.output.as_ref().map(|s| s.as_str()).unwrap_or("");
            let search_text = if self.case_sensitive {
                format!("{} {}", history.config_id, output_text)
            } else {
                format!("{} {}", history.config_id, output_text).to_lowercase()
            };

            let search_query = if self.case_sensitive {
                self.query.clone()
            } else {
                self.query.to_lowercase()
            };

            if self.regex {
                Ok(self.matches_regex(&search_text, &search_query)?)
            } else {
                Ok(search_text.contains(&search_query))
            }
        } else {
            Ok(true)
        }
    }

    fn matches_config(&self, config: &RunConfig) -> Result<bool> {
        if self.query.is_empty() {
            return Ok(true);
        }

        let args_text = config.arguments.as_ref()
            .map(|args| args.join(" "))
            .unwrap_or_default();
        let search_text = if self.case_sensitive {
            format!("{} {} {}", config.name, config.command, args_text)
        } else {
            format!("{} {} {}", config.name, config.command, args_text).to_lowercase()
        };

        let search_query = if self.case_sensitive {
            self.query.clone()
        } else {
            self.query.to_lowercase()
        };

        if self.regex {
            Ok(self.matches_regex(&search_text, &search_query)?)
        } else {
            Ok(search_text.contains(&search_query))
        }
    }

    fn search_regex(&self, text: &str, query: &str, matches: &mut Vec<SearchMatch>) -> Result<()> {
        use regex::Regex;
        
        let regex = if self.case_sensitive {
            Regex::new(query)?
        } else {
            Regex::new(&format!("(?i){}", query))?
        };

        for mat in regex.find_iter(text) {
            matches.push(SearchMatch {
                start: mat.start(),
                end: mat.end(),
                text: mat.as_str().to_string(),
            });
        }

        Ok(())
    }

    fn search_plain(&self, text: &str, query: &str, matches: &mut Vec<SearchMatch>) {
        let mut start = 0;
        while let Some(pos) = text[start..].find(query) {
            let actual_pos = start + pos;
            matches.push(SearchMatch {
                start: actual_pos,
                end: actual_pos + query.len(),
                text: query.to_string(),
            });
            start = actual_pos + 1;
        }
    }

    fn matches_regex(&self, text: &str, query: &str) -> Result<bool> {
        use regex::Regex;
        
        let regex = if self.case_sensitive {
            Regex::new(query)?
        } else {
            Regex::new(&format!("(?i){}", query))?
        };

        Ok(regex.is_match(text))
    }
}

#[derive(Debug, Clone)]
pub struct SearchMatch {
    pub start: usize,
    pub end: usize,
    pub text: String,
}

#[derive(Debug, Clone)]
pub struct SearchManager {
    filters: HashMap<String, SearchFilter>,
    current_filter: Option<String>,
}

impl Default for SearchManager {
    fn default() -> Self {
        Self::new()
    }
}

impl SearchManager {
    pub fn new() -> Self {
        Self {
            filters: HashMap::new(),
            current_filter: None,
        }
    }

    pub fn add_filter(&mut self, name: String, filter: SearchFilter) {
        self.filters.insert(name, filter);
    }

    pub fn remove_filter(&mut self, name: &str) -> Option<SearchFilter> {
        self.filters.remove(name)
    }

    pub fn get_filter(&self, name: &str) -> Option<&SearchFilter> {
        self.filters.get(name)
    }

    pub fn get_filter_mut(&mut self, name: &str) -> Option<&mut SearchFilter> {
        self.filters.get_mut(name)
    }

    pub fn set_current_filter(&mut self, name: Option<String>) {
        self.current_filter = name;
    }

    pub fn get_current_filter(&self) -> Option<&SearchFilter> {
        self.current_filter.as_ref().and_then(|name| self.filters.get(name))
    }

    pub fn get_current_filter_mut(&mut self) -> Option<&mut SearchFilter> {
        self.current_filter.as_mut().and_then(|name| self.filters.get_mut(name))
    }

    pub fn list_filters(&self) -> Vec<&String> {
        self.filters.keys().collect()
    }

    /// Apply current filter to history
    pub fn filter_history(&self, history: &[RunHistory]) -> Result<Vec<RunHistory>> {
        if let Some(filter) = self.get_current_filter() {
            filter.filter_history(history)
        } else {
            Ok(history.to_vec())
        }
    }

    /// Apply current filter to configs
    pub fn filter_configs(&self, configs: &[RunConfig]) -> Result<Vec<RunConfig>> {
        if let Some(filter) = self.get_current_filter() {
            filter.filter_configs(configs)
        } else {
            Ok(configs.to_vec())
        }
    }

    /// Search in text using current filter
    pub fn search_in_text(&self, text: &str) -> Result<Vec<SearchMatch>> {
        if let Some(filter) = self.get_current_filter() {
            filter.search_in_text(text)
        } else {
            Ok(vec![])
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Utc;

    #[test]
    fn test_search_filter_basic() {
        let filter = SearchFilter::new()
            .with_query("test".to_string())
            .with_case_sensitive(false);

        let text = "This is a test string with test word";
        let matches = filter.search_in_text(text).unwrap();
        
        assert_eq!(matches.len(), 2);
        assert_eq!(matches[0].start, 10);
        assert_eq!(matches[0].end, 14);
        assert_eq!(matches[1].start, 27);
        assert_eq!(matches[1].end, 31);
    }

    #[test]
    fn test_search_filter_case_sensitive() {
        let filter = SearchFilter::new()
            .with_query("Test".to_string())
            .with_case_sensitive(true);

        let text = "This is a test string with Test word";
        let matches = filter.search_in_text(text).unwrap();
        
        assert_eq!(matches.len(), 1);
        assert_eq!(matches[0].start, 27);
        assert_eq!(matches[0].end, 31);
    }

    #[test]
    fn test_filter_history_by_status() {
        let filter = SearchFilter::new()
            .with_filter_type(FilterType::Status(HistoryStatus::Success));

        let history = vec![
            RunHistory {
                id: "1".to_string(),
                config_id: "config1".to_string(),
                name: "Test 1".to_string(),
                command: "echo test".to_string(),
                status: HistoryStatus::Success,
                timestamp: chrono::Utc::now(),
                output: Some("test".to_string()),
                duration: Some(100),
                log_filename: None,
                pid: None,
                internal_id: None,
                start_time: Some(chrono::Utc::now().timestamp_millis()),
                cpu_usage: None,
                memory_usage: None,
                pinned: Some(false),
            },
            RunHistory {
                id: "2".to_string(),
                config_id: "config2".to_string(),
                name: "Test 2".to_string(),
                command: "echo error".to_string(),
                status: HistoryStatus::Error,
                timestamp: chrono::Utc::now(),
                output: Some("error".to_string()),
                duration: Some(200),
                log_filename: None,
                pid: None,
                internal_id: None,
                start_time: Some(chrono::Utc::now().timestamp_millis()),
                cpu_usage: None,
                memory_usage: None,
                pinned: Some(false),
            },
        ];

        let filtered = filter.filter_history(&history).unwrap();
        assert_eq!(filtered.len(), 1);
        assert_eq!(filtered[0].status, HistoryStatus::Success);
    }
}
