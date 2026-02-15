import UFX from '@leeoniya/ufuzzy';
import type { FilterDefinition, FilterCategory } from '@/ffmpeg/types/preset';

/**
 * 搜索结果匹配范围
 */
export interface MatchRange {
  start: number;
  end: number;
}

/**
 * 带高亮的搜索结果
 */
export interface SearchResultWithHighlight extends FilterDefinition {
  matchRanges?: MatchRange[];
  highlightText?: string;
}

/**
 * 搜索历史项
 */
export interface SearchHistoryItem {
  query: string;
  timestamp: number;
}

/**
 * 热门滤镜
 */
export interface PopularFilter {
  filter: FilterDefinition;
  popularity: number;
}

/**
 * 搜索选项
 */
export interface SearchOptions {
  fuzzy?: boolean;           // 是否启用模糊搜索
  maxResults?: number;       // 最大结果数
  includeDescription?: boolean;  // 是否搜索描述
  caseSensitive?: boolean;  // 是否区分大小写
}

/**
 * 搜索结果
 */
export interface SearchResults {
  results: SearchResultWithHighlight[];
  query: string;
  executionTime: number;
}

/**
 * 滤镜搜索服务
 * 提供高性能模糊搜索、搜索历史、热门滤镜功能
 */
export class FilterSearchService {
  private fuzzy: UFX;
  private filters: FilterDefinition[] = [];
  private searchHistory: SearchHistoryItem[] = [];
  private maxHistorySize = 20;
  private popularFilters: Map<string, number> = new Map();

  // 搜索缓存
  private searchCache = new Map<string, { results: SearchResultWithHighlight[]; timestamp: number }>();
  private readonly SEARCH_CACHE_TTL = 30000; // 30秒缓存
  private readonly MAX_SEARCH_CACHE_SIZE = 50;

  constructor() {
    this.fuzzy = new UFX({
      // 模糊搜索配置
      intraIns: 1,       // 允许插入字符
      intraSub: 1,      // 允许替换字符
      intraTrn: 1,      // 允许转置字符（注意：是 intraTrn 不是 intraTran）
      intraDel: 1,       // 允许删除字符
      interLft: 1,       // 允许间隙
      interIns: 1,       // 间隙插入
    });

    this.loadSearchHistory();
    this.loadPopularFilters();
    // 定期清理缓存
    setInterval(() => this.cleanupCache(), 60000); // 每分钟清理一次
  }

  /**
   * 设置滤镜数据
   */
  setFilters(filters: FilterDefinition[]): void {
    this.filters = filters;
  }

  /**
   * 执行搜索（带缓存）
   */
  search(
    query: string,
    options: SearchOptions = {}
  ): SearchResults {
    const startTime = performance.now();

    if (!query.trim()) {
      return {
        results: [],
        query,
        executionTime: 0
      };
    }

    // 检查缓存
    const cacheKey = this.generateSearchCacheKey(query, options);
    const cached = this.searchCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.SEARCH_CACHE_TTL) {
      console.debug(`[FilterSearchService] Cache hit for query: ${query}`);
      return {
        results: cached.results,
        query,
        executionTime: performance.now() - startTime
      };
    }

    const {
      fuzzy: _fuzzy = true,
      maxResults = 50,
      includeDescription = true,
      caseSensitive = false
    } = options;

    let results: SearchResultWithHighlight[] = [];

    // 准备搜索文本数组（名称 + 描述）
    const haystack: string[] = [];
    const filterMap: {[key: number]: FilterDefinition} = {};

    this.filters.forEach((filter, index) => {
      haystack.push(filter.name);
      filterMap[index] = filter;

      if (includeDescription && filter.description) {
        const descIndex = haystack.length;
        haystack.push(filter.description);
        filterMap[descIndex] = filter;
      }
    });

    // 执行模糊搜索（使用实例方法，返回值可能是数组或其它类型）
    const raw = this.fuzzy.search(haystack, query);
    const idxs: number[] = Array.isArray(raw) ? (raw as unknown as number[]) : [];

    // 提取唯一的结果（使用 Set 优化查找）
    const seenFilters = new Set<string>();
    const rankedResults: { filter: FilterDefinition; score: number }[] = [];

    idxs.forEach((idx: number, i: number) => {
      const filter = filterMap[idx];
      if (filter && !seenFilters.has(filter.id)) {
        seenFilters.add(filter.id);

        // 计算分数（位置越靠前，分数越高）
        const score = (idxs.length - i) * 10;
        rankedResults.push({ filter, score });
      }
    });

    // 按分数排序
    rankedResults.sort((a, b) => b.score - a.score);

    // 限制结果数量
    results = rankedResults
      .slice(0, maxResults)
      .map(({ filter }) => ({
        ...filter,
        highlightText: this.highlightMatch(filter.name, query, caseSensitive),
        matchRanges: this.findMatchRanges(filter.name, query, caseSensitive)
      }));

    // 缓存结果
    this.cacheSearchResult(cacheKey, results);

    // 记录搜索历史
    this.addToSearchHistory(query);

    const executionTime = performance.now() - startTime;

    return {
      results,
      query,
      executionTime
    };
  }

  /**
   * 生成搜索缓存键
   */
  private generateSearchCacheKey(query: string, options: SearchOptions): string {
    const opts = `${options.fuzzy}|${options.maxResults}|${options.includeDescription}|${options.caseSensitive}`;
    return `${query.toLowerCase()}|${opts}`;
  }

  /**
   * 缓存搜索结果
   */
  private cacheSearchResult(key: string, results: SearchResultWithHighlight[]): void {
    if (this.searchCache.size >= this.MAX_SEARCH_CACHE_SIZE) {
      // 删除最旧的缓存项
      const oldestKey = Array.from(this.searchCache.entries())
        .sort((a, b) => a[1].timestamp - b[1].timestamp)[0][0];
      this.searchCache.delete(oldestKey);
    }
    this.searchCache.set(key, { results, timestamp: Date.now() });
  }

  /**
   * 清理过期缓存
   */
  private cleanupCache(): void {
    const now = Date.now();
    for (const [key, value] of this.searchCache.entries()) {
      if (now - value.timestamp > this.SEARCH_CACHE_TTL) {
        this.searchCache.delete(key);
      }
    }
  }

  /**
   * 清除所有缓存
   */
  public clearCache(): void {
    this.searchCache.clear();
    console.debug('[FilterSearchService] Search cache cleared');
  }

  /**
   * 按分类筛选
   */
  filterByCategory(
    category: FilterCategory | 'all'
  ): FilterDefinition[] {
    if (category === 'all') {
      return this.filters;
    }

    return this.filters.filter(f => f.category === category);
  }

  /**
   * 按滤镜类型筛选
   */
  filterByType(
    filterType: string
  ): FilterDefinition[] {
    return this.filters.filter(f => f.filterType === filterType);
  }

  /**
   * 按使用频率排序
   */
  sortByPopularity(): FilterDefinition[] {
    const filtersWithPopularity = this.filters.map(filter => ({
      filter,
      popularity: this.popularFilters.get(filter.id) || 0
    }));

    return filtersWithPopularity
      .sort((a, b) => b.popularity - a.popularity)
      .map(({ filter }) => filter);
  }

  /**
   * 获取热门滤镜
   */
  getPopularFilters(limit: number = 10): PopularFilter[] {
    const entries = Object.keys(this.popularFilters).map(key => ({
      filterId: key,
      popularity: this.popularFilters.get(key) || 0
    }));

    const allFilters = entries
      .map(entry => ({
        filter: this.filters.find(f => f.id === entry.filterId),
        popularity: entry.popularity
      }))
      .filter(item => item.filter !== undefined) as PopularFilter[];

    return allFilters
      .sort((a, b) => b.popularity - a.popularity)
      .slice(0, limit);
  }

  /**
   * 记录滤镜使用
   */
  recordFilterUsage(filterId: string): void {
    const current = this.popularFilters.get(filterId) || 0;
    this.popularFilters.set(filterId, current + 1);
    this.savePopularFilters();
  }

  /**
   * 获取搜索历史
   */
  getSearchHistory(): SearchHistoryItem[] {
    return this.searchHistory;
  }

  /**
   * 添加到搜索历史
   */
  private addToSearchHistory(query: string): void {
    // 移除已存在的相同查询
    this.searchHistory = this.searchHistory.filter(
      item => item.query !== query
    );

    // 添加到开头
    this.searchHistory.unshift({
      query,
      timestamp: Date.now()
    });

    // 限制历史记录数量
    if (this.searchHistory.length > this.maxHistorySize) {
      this.searchHistory = this.searchHistory.slice(0, this.maxHistorySize);
    }

    this.saveSearchHistory();
  }

  /**
   * 清除搜索历史
   */
  clearSearchHistory(): void {
    this.searchHistory = [];
    this.saveSearchHistory();
  }

  /**
   * 高亮匹配文本
   */
  private highlightMatch(
    text: string,
    query: string,
    caseSensitive: boolean
  ): string {
    const ranges = this.findMatchRanges(text, query, caseSensitive);

    if (ranges.length === 0) {
      return text;
    }

    // 按位置排序
    ranges.sort((a, b) => a.start - b.start);

    // 合并重叠的范围
    const mergedRanges: MatchRange[] = [];
    let current = ranges[0];

    for (let i = 1; i < ranges.length; i++) {
      if (ranges[i].start <= current.end) {
        current = {
          start: current.start,
          end: Math.max(current.end, ranges[i].end)
        };
      } else {
        mergedRanges.push(current);
        current = ranges[i];
      }
    }
    mergedRanges.push(current);

    // 构建高亮文本
    let result = '';
    let lastIndex = 0;

    mergedRanges.forEach(range => {
      result += text.slice(lastIndex, range.start);
      result += `<mark>${text.slice(range.start, range.end)}</mark>`;
      lastIndex = range.end;
    });

    result += text.slice(lastIndex);

    return result;
  }

  /**
   * 查找匹配范围
   */
  private findMatchRanges(
    text: string,
    query: string,
    caseSensitive: boolean
  ): MatchRange[] {
    const ranges: MatchRange[] = [];

    if (!query) {
      return ranges;
    }

    const searchText = caseSensitive ? text : text.toLowerCase();
    const searchQuery = caseSensitive ? query : query.toLowerCase();

    let index = searchText.indexOf(searchQuery);

    while (index !== -1) {
      ranges.push({
        start: index,
        end: index + searchQuery.length
      });

      index = searchText.indexOf(searchQuery, index + 1);
    }

    return ranges;
  }

  /**
   * 加载搜索历史
   */
  private loadSearchHistory(): void {
    try {
      const stored = localStorage.getItem('filter-search-history');
      if (stored) {
        this.searchHistory = JSON.parse(stored);
      }
    } catch (error) {
      console.error('Failed to load search history:', error);
    }
  }

  /**
   * 保存搜索历史
   */
  private saveSearchHistory(): void {
    try {
      localStorage.setItem(
        'filter-search-history',
        JSON.stringify(this.searchHistory)
      );
    } catch (error) {
      console.error('Failed to save search history:', error);
    }
  }

  /**
   * 加载热门滤镜
   */
  private loadPopularFilters(): void {
    try {
      const stored = localStorage.getItem('filter-popular-filters');
      if (stored) {
        const data = JSON.parse(stored);
        this.popularFilters = data;
      }
    } catch (error) {
      console.error('Failed to load popular filters:', error);
    }
  }

  /**
   * 保存热门滤镜
   */
  private savePopularFilters(): void {
    try {
      localStorage.setItem(
        'filter-popular-filters',
        JSON.stringify(this.popularFilters)
      );
    } catch (error) {
      console.error('Failed to save popular filters:', error);
    }
  }

  /**
   * 获取搜索建议
   */
  getSuggestions(query: string, limit: number = 5): string[] {
    if (!query.trim()) {
      return [];
    }

    const results = this.search(query, { maxResults: limit * 2, fuzzy: false });

    // 提取名称作为建议
    const suggestions = results.results.map(r => r.name);

    // 从历史记录中查找匹配
    const historySuggestions = this.searchHistory
      .filter(item => item.query.toLowerCase().indexOf(query.toLowerCase()) !== -1)
      .slice(0, limit)
      .map(item => item.query);

    // 合并并去重
    const combined = [...historySuggestions, ...suggestions];
    const unique = combined.filter((value, index, self) => self.indexOf(value) === index);

    return unique.slice(0, limit);
  }
}

// 导出单例
export const filterSearchService = new FilterSearchService();
