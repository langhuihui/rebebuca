use anyhow::Result;
use std::collections::VecDeque;
use std::sync::Arc;
use tokio::sync::RwLock;

/// Performance optimization utilities and caching mechanisms
#[derive(Debug)]
pub struct PerformanceManager {
    /// Console output cache for efficient rendering
    console_cache: Arc<RwLock<ConsoleCache>>,
    /// List virtualization cache
    list_cache: Arc<RwLock<ListCache>>,
    /// Search result cache
    search_cache: Arc<RwLock<SearchCache>>,
}

/// Cached console output for efficient rendering
#[derive(Debug, Clone)]
pub struct ConsoleCache {
    /// Cached rendered lines
    pub rendered_lines: VecDeque<String>,
    /// Maximum number of lines to keep in cache
    pub max_lines: usize,
    /// Whether the cache is dirty and needs regeneration
    pub is_dirty: bool,
    /// Last processed output hash
    pub last_output_hash: u64,
}

/// Cached list data for virtualization
#[derive(Debug, Clone)]
pub struct ListCache {
    /// Cached visible items
    pub visible_items: Vec<usize>,
    /// Total item count
    pub total_count: usize,
    /// Scroll position
    pub scroll_offset: f32,
    /// Item height
    pub item_height: f32,
    /// Viewport height
    pub viewport_height: f32,
}

/// Cached search results
#[derive(Debug, Clone)]
pub struct SearchCache {
    /// Cached search results
    pub results: Vec<SearchResult>,
    /// Last search query
    pub last_query: String,
    /// Whether the cache is valid
    pub is_valid: bool,
}

#[derive(Debug, Clone)]
pub struct SearchResult {
    pub start: usize,
    pub end: usize,
    pub text: String,
    pub line_number: usize,
}

impl PerformanceManager {
    pub fn new() -> Self {
        Self {
            console_cache: Arc::new(RwLock::new(ConsoleCache::new(1000))),
            list_cache: Arc::new(RwLock::new(ListCache::new())),
            search_cache: Arc::new(RwLock::new(SearchCache::new())),
        }
    }

    /// Get console cache
    pub fn get_console_cache(&self) -> Arc<RwLock<ConsoleCache>> {
        self.console_cache.clone()
    }

    /// Get list cache
    pub fn get_list_cache(&self) -> Arc<RwLock<ListCache>> {
        self.list_cache.clone()
    }

    /// Get search cache
    pub fn get_search_cache(&self) -> Arc<RwLock<SearchCache>> {
        self.search_cache.clone()
    }

    /// Update console cache with new output
    pub async fn update_console_cache(&self, output: &str) -> Result<()> {
        let mut cache = self.console_cache.write().await;
        let output_hash = self.calculate_hash(output);
        
        if cache.last_output_hash != output_hash {
            cache.is_dirty = true;
            cache.last_output_hash = output_hash;
            
            // Process output into lines
            let lines: Vec<String> = output.lines().map(|s| s.to_string()).collect();
            
            // Update cache with new lines
            for line in lines {
                cache.rendered_lines.push_back(line);
                
                // Maintain max_lines limit
                if cache.rendered_lines.len() > cache.max_lines {
                    cache.rendered_lines.pop_front();
                }
            }
        }
        
        Ok(())
    }

    /// Update list cache for virtualization
    pub async fn update_list_cache(
        &self,
        total_count: usize,
        scroll_offset: f32,
        item_height: f32,
        viewport_height: f32,
    ) -> Result<()> {
        let mut cache = self.list_cache.write().await;
        
        cache.total_count = total_count;
        cache.scroll_offset = scroll_offset;
        cache.item_height = item_height;
        cache.viewport_height = viewport_height;
        
        // Calculate visible range
        let start_index = (scroll_offset / item_height).floor() as usize;
        let visible_count = (viewport_height / item_height).ceil() as usize + 1; // +1 for partial items
        let end_index = (start_index + visible_count).min(total_count);
        
        cache.visible_items = (start_index..end_index).collect();
        
        Ok(())
    }

    /// Update search cache
    pub async fn update_search_cache(&self, query: &str, results: Vec<SearchResult>) -> Result<()> {
        let mut cache = self.search_cache.write().await;
        
        cache.last_query = query.to_string();
        cache.results = results;
        cache.is_valid = true;
        
        Ok(())
    }

    /// Check if search cache is valid for given query
    pub async fn is_search_cache_valid(&self, query: &str) -> bool {
        let cache = self.search_cache.read().await;
        cache.is_valid && cache.last_query == query
    }

    /// Get cached search results
    pub async fn get_cached_search_results(&self) -> Vec<SearchResult> {
        let cache = self.search_cache.read().await;
        cache.results.clone()
    }

    /// Invalidate all caches
    pub async fn invalidate_all_caches(&self) -> Result<()> {
        {
            let mut console_cache = self.console_cache.write().await;
            console_cache.is_dirty = true;
        }
        
        {
            let mut search_cache = self.search_cache.write().await;
            search_cache.is_valid = false;
        }
        
        Ok(())
    }

    /// Calculate simple hash for content
    fn calculate_hash(&self, content: &str) -> u64 {
        use std::collections::hash_map::DefaultHasher;
        use std::hash::{Hash, Hasher};
        
        let mut hasher = DefaultHasher::new();
        content.hash(&mut hasher);
        hasher.finish()
    }
}

impl ConsoleCache {
    pub fn new(max_lines: usize) -> Self {
        Self {
            rendered_lines: VecDeque::new(),
            max_lines,
            is_dirty: false,
            last_output_hash: 0,
        }
    }

    /// Get visible lines for rendering
    pub fn get_visible_lines(&self, start_line: usize, count: usize) -> Vec<String> {
        self.rendered_lines
            .iter()
            .skip(start_line)
            .take(count)
            .cloned()
            .collect()
    }

    /// Get total line count
    pub fn get_line_count(&self) -> usize {
        self.rendered_lines.len()
    }

    /// Check if cache is dirty
    pub fn is_dirty(&self) -> bool {
        self.is_dirty
    }

    /// Mark cache as clean
    pub fn mark_clean(&mut self) {
        self.is_dirty = false;
    }
}

impl ListCache {
    pub fn new() -> Self {
        Self {
            visible_items: Vec::new(),
            total_count: 0,
            scroll_offset: 0.0,
            item_height: 0.0,
            viewport_height: 0.0,
        }
    }

    /// Get visible item indices
    pub fn get_visible_items(&self) -> &[usize] {
        &self.visible_items
    }

    /// Get total item count
    pub fn get_total_count(&self) -> usize {
        self.total_count
    }

    /// Get scroll position
    pub fn get_scroll_offset(&self) -> f32 {
        self.scroll_offset
    }

    /// Get item height
    pub fn get_item_height(&self) -> f32 {
        self.item_height
    }

    /// Get viewport height
    pub fn get_viewport_height(&self) -> f32 {
        self.viewport_height
    }
}

impl SearchCache {
    pub fn new() -> Self {
        Self {
            results: Vec::new(),
            last_query: String::new(),
            is_valid: false,
        }
    }

    /// Get cached results
    pub fn get_results(&self) -> &[SearchResult] {
        &self.results
    }

    /// Check if cache is valid
    pub fn is_valid(&self) -> bool {
        self.is_valid
    }

    /// Get last query
    pub fn get_last_query(&self) -> &str {
        &self.last_query
    }
}

/// Performance settings for the application
#[derive(Debug, Clone)]
pub struct PerformanceSettings {
    /// Maximum console buffer size in lines
    pub max_console_lines: usize,
    /// Maximum history items to keep
    pub max_history_items: usize,
    /// Enable list virtualization
    pub enable_list_virtualization: bool,
    /// Enable search result caching
    pub enable_search_caching: bool,
    /// Enable console output caching
    pub enable_console_caching: bool,
    /// Debounce delay for search in milliseconds
    pub search_debounce_ms: u64,
    /// Debounce delay for list updates in milliseconds
    pub list_update_debounce_ms: u64,
}

impl Default for PerformanceSettings {
    fn default() -> Self {
        Self {
            max_console_lines: 1000,
            max_history_items: 100,
            enable_list_virtualization: true,
            enable_search_caching: true,
            enable_console_caching: true,
            search_debounce_ms: 300,
            list_update_debounce_ms: 100,
        }
    }
}
