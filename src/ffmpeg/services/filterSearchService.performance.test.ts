/**
 * FilterSearchService 性能测试套件
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { filterSearchService } from '../filterSearchService';
import type { FilterDefinition } from '@/ffmpeg/types/preset';

describe('FilterSearchService Performance Tests', () => {
  let mockFilters: FilterDefinition[];

  beforeEach(() => {
    filterSearchService.clearCache();
    mockFilters = createMockFilters(100); // 创建100个滤镜
    filterSearchService.setFilters(mockFilters);
  });

  /**
   * 创建模拟滤镜数据
   */
  function createMockFilters(count: number): FilterDefinition[] {
    const categories = ['basic', 'transform', 'color', 'audio', 'subtitle', 'overlay', 'advanced'];
    const filterTypes = ['video', 'audio', 'complex', 'generator', 'splitter', 'merger'];

    return Array.from({ length: count }, (_, i) => ({
      id: `filter-${i}`,
      name: `Filter ${i} 测试`,
      icon: '🎬',
      description: `这是滤镜 ${i} 的描述文本，用于测试搜索性能`,
      category: categories[i % categories.length] as any,
      filterType: filterTypes[i % filterTypes.length] as any,
      inputPorts: ['v'],
      outputPorts: ['v'],
      params: []
    }));
  }

  /**
   * 测试搜索性能
   */
  describe('Search Performance', () => {
    it('should search 100 filters quickly (< 50ms)', () => {
      const times: number[] = [];
      const queries = ['filter', '测试', 'video', 'audio'];

      queries.forEach(query => {
        const start = performance.now();
        const result = filterSearchService.search(query, {
          fuzzy: true,
          maxResults: 50,
          includeDescription: true
        });
        const time = performance.now() - start;
        times.push(time);

        expect(result.results.length).toBeGreaterThan(0);
        expect(result.executionTime).toBeLessThan(50);
      });

      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      console.log(`[Performance] Search avg: ${avgTime.toFixed(2)}ms`);
      expect(avgTime).toBeLessThan(50);
    });

    it('should handle 1000 filters efficiently (< 100ms)', () => {
      const largeFilters = createMockFilters(1000);
      filterSearchService.setFilters(largeFilters);

      const times: number[] = [];
      const queries = ['filter', '测试', 'video'];

      queries.forEach(query => {
        const start = performance.now();
        const result = filterSearchService.search(query, {
          fuzzy: true,
          maxResults: 50
        });
        const time = performance.now() - start;
        times.push(time);
      });

      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      console.log(`[Performance] 1000 filters search avg: ${avgTime.toFixed(2)}ms`);
      expect(avgTime).toBeLessThan(100);
    });

    it('should handle fuzzy search efficiently', () => {
      const times: number[] = [];
      const fuzzyQueries = ['fltr', 'tes', 'vido']; // 故意拼写错误

      fuzzyQueries.forEach(query => {
        const start = performance.now();
        const result = filterSearchService.search(query, { fuzzy: true });
        const time = performance.now() - start;
        times.push(time);

        expect(result.results.length).toBeGreaterThan(0);
      });

      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      console.log(`[Performance] Fuzzy search avg: ${avgTime.toFixed(2)}ms`);
      expect(avgTime).toBeLessThan(50);
    });
  });

  /**
   * 测试缓存性能
   */
  describe('Cache Performance', () => {
    it('should provide significant speedup with cache', () => {
      const query = 'filter';

      // 第一次搜索（无缓存）
      const start1 = performance.now();
      const result1 = filterSearchService.search(query);
      const time1 = performance.now() - start1;

      // 第二次搜索（有缓存）
      const start2 = performance.now();
      const result2 = filterSearchService.search(query);
      const time2 = performance.now() - start2;

      console.log(`[Performance] First search: ${time1.toFixed(2)}ms, Cached search: ${time2.toFixed(2)}ms`);

      expect(result1.results).toEqual(result2.results);
      expect(time2).toBeLessThan(time1 * 0.5); // 缓存应该至少快50%
    });

    it('should cache multiple queries', () => {
      const queries = ['filter', '测试', 'video', 'audio', 'transform'];

      // 预热缓存
      queries.forEach(q => filterSearchService.search(q));

      // 测试缓存命中率
      const times: number[] = [];
      queries.forEach(query => {
        const start = performance.now();
        filterSearchService.search(query);
        times.push(performance.now() - start);
      });

      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      console.log(`[Performance] Cached queries avg: ${avgTime.toFixed(2)}ms`);
      expect(avgTime).toBeLessThan(5); // 缓存查询应该非常快
    });

    it('should respect cache size limit', () => {
      // 创建大量查询超过缓存限制
      for (let i = 0; i < 100; i++) {
        filterSearchService.search(`query-${i}`);
      }

      const start = performance.now();
      filterSearchService.search('query-0'); // 第一个查询应该已被清除
      const time = performance.now() - start;

      console.log(`[Performance] After cache limit: ${time.toFixed(2)}ms`);
      // 即使缓存已满，也应该有合理的性能
      expect(time).toBeLessThan(100);
    });
  });

  /**
   * 测试节流性能
   */
  describe('Throttling Performance', () => {
    it('should handle rapid searches efficiently', () => {
      const times: number[] = [];

      // 模拟快速连续搜索
      for (let i = 0; i < 10; i++) {
        const start = performance.now();
        filterSearchService.search(`filter-${i % 5}`);
        times.push(performance.now() - start);
      }

      const totalTime = times.reduce((a, b) => a + b, 0);
      const avgTime = totalTime / times.length;

      console.log(`[Performance] Rapid searches total: ${totalTime.toFixed(2)}ms, avg: ${avgTime.toFixed(2)}ms`);
      expect(totalTime).toBeLessThan(500); // 10次搜索应该在500ms内完成
    });
  });

  /**
   * 测试建议生成性能
   */
  describe('Suggestions Performance', () => {
    it('should generate suggestions quickly (< 10ms)', () => {
      const times: number[] = [];
      const queries = ['f', 'fi', 'fil', 'filt'];

      queries.forEach(query => {
        const start = performance.now();
        const suggestions = filterSearchService.getSuggestions(query, 5);
        const time = performance.now() - start;
        times.push(time);

        expect(suggestions.length).toBeLessThanOrEqual(5);
      });

      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      console.log(`[Performance] Suggestions avg: ${avgTime.toFixed(2)}ms`);
      expect(avgTime).toBeLessThan(10);
    });

    it('should generate suggestions from history', () => {
      // 添加搜索历史
      for (let i = 0; i < 5; i++) {
        filterSearchService.search(`query-${i}`);
      }

      const start = performance.now();
      const suggestions = filterSearchService.getSuggestions('q', 5);
      const time = performance.now() - start;

      console.log(`[Performance] History suggestions: ${time.toFixed(2)}ms`);
      expect(time).toBeLessThan(10);
      expect(suggestions.length).toBeGreaterThan(0);
    });
  });

  /**
   * 测试分类筛选性能
   */
  describe('Filter Performance', () => {
    it('should filter by category quickly (< 10ms)', () => {
      const categories = ['basic', 'transform', 'color', 'audio'];
      const times: number[] = [];

      categories.forEach(category => {
        const start = performance.now();
        const result = filterSearchService.filterByCategory(category as any);
        const time = performance.now() - start;
        times.push(time);

        expect(result.length).toBeGreaterThan(0);
      });

      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      console.log(`[Performance] Category filter avg: ${avgTime.toFixed(2)}ms`);
      expect(avgTime).toBeLessThan(10);
    });

    it('should sort by popularity quickly (< 20ms)', () => {
      // 记录一些使用频率
      for (let i = 0; i < 10; i++) {
        filterSearchService.recordFilterUsage(`filter-${i}`);
      }

      const start = performance.now();
      const sorted = filterSearchService.sortByPopularity();
      const time = performance.now() - start;

      console.log(`[Performance] Popularity sort: ${time.toFixed(2)}ms`);
      expect(time).toBeLessThan(20);
      expect(sorted.length).toBe(mockFilters.length);
    });
  });

  /**
   * 测试高亮生成性能
   */
  describe('Highlight Performance', () => {
    it('should generate highlights quickly', () => {
      const query = 'filter 测试';
      const times: number[] = [];

      for (let i = 0; i < 10; i++) {
        const start = performance.now();
        const result = filterSearchService.search(query, {
          fuzzy: true,
          includeDescription: true
        });
        const time = performance.now() - start;
        times.push(time);

        // 检查高亮文本
        expect(result.results[0]?.highlightText).toContain('<mark>');
      }

      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      console.log(`[Performance] Highlight generation avg: ${avgTime.toFixed(2)}ms`);
      expect(avgTime).toBeLessThan(50);
    });
  });

  /**
   * 测试内存使用（间接）
   */
  describe('Memory Efficiency', () => {
    it('should not leak memory with cache', () => {
      // 多次搜索后清除缓存
      for (let i = 0; i < 50; i++) {
        filterSearchService.search(`query-${i}`);
      }

      const start = performance.now();
      filterSearchService.clearCache();
      const time = performance.now() - start;

      console.log(`[Performance] Cache clear time: ${time.toFixed(2)}ms`);
      expect(time).toBeLessThan(10);
    });

    it('should manage history size efficiently', () => {
      // 添加超过限制的历史记录
      for (let i = 0; i < 100; i++) {
        filterSearchService.search(`query-${i}`);
      }

      const history = filterSearchService.getSearchHistory();
      console.log(`[Performance] History size after 100 searches: ${history.length}`);
      // 历史记录应该被限制
      expect(history.length).toBeLessThanOrEqual(20);
    });
  });
});
