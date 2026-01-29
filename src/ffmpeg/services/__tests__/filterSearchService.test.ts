import { describe, it, expect, beforeEach } from 'vitest';
import { FilterSearchService } from '../filterSearchService';
import type { FilterDefinition, FilterCategory } from '@/ffmpeg/types/preset';

describe('FilterSearchService', () => {
  let service: FilterSearchService;
  let mockFilters: FilterDefinition[];

  beforeEach(() => {
    service = new FilterSearchService();

    mockFilters = [
      {
        id: 'scale',
        name: 'scale',
        category: 'transform' as FilterCategory,
        description: 'Resize the input video',
        icon: '📐',
        filterType: 'video',
        inputPorts: ['v'],
        outputPorts: ['v'],
        params: []
      },
      {
        id: 'crop',
        name: 'crop',
        category: 'basic' as FilterCategory,
        description: 'Crop the input video',
        icon: '✂️',
        filterType: 'video',
        inputPorts: ['v'],
        outputPorts: ['v'],
        params: []
      },
      {
        id: 'fps',
        name: 'fps',
        category: 'basic' as FilterCategory,
        description: 'Change the frame rate',
        icon: '🔄',
        filterType: 'video',
        inputPorts: ['v'],
        outputPorts: ['v'],
        params: []
      },
      {
        id: 'overlay',
        name: 'overlay',
        category: 'overlay' as FilterCategory,
        description: 'Overlay one video on top of another',
        icon: '📑',
        filterType: 'complex',
        inputPorts: ['v', 'v'],
        outputPorts: ['v'],
        params: []
      },
      {
        id: 'volume',
        name: 'volume',
        category: 'audio' as FilterCategory,
        description: 'Adjust the audio volume',
        icon: '🔊',
        filterType: 'audio',
        inputPorts: ['a'],
        outputPorts: ['a'],
        params: []
      }
    ];

    service.setFilters(mockFilters);
  });

  describe('search', () => {
    it('should return empty results for empty query', () => {
      const result = service.search('');
      expect(result.results).toHaveLength(0);
      expect(result.query).toBe('');
    });

    it('should find exact match', () => {
      const result = service.search('scale');
      expect(result.results).toHaveLength(1);
      expect(result.results[0].id).toBe('scale');
    });

    it('should find partial match', () => {
      const result = service.search('sc');
      expect(result.results.length).toBeGreaterThan(0);
      expect(result.results.some(r => r.id === 'scale')).toBe(true);
    });

    it('should search in description', () => {
      const result = service.search('frame');
      expect(result.results).toHaveLength(1);
      expect(result.results[0].id).toBe('fps');
    });

    it('should be case insensitive by default', () => {
      const result1 = service.search('SCALE');
      const result2 = service.search('scale');
      expect(result1.results).toHaveLength(result2.results.length);
    });

    it('should limit max results', () => {
      const result = service.search('v', { maxResults: 2 });
      expect(result.results.length).toBeLessThanOrEqual(2);
    });

    it('should return execution time', () => {
      const result = service.search('scale');
      expect(result.executionTime).toBeGreaterThan(0);
      expect(result.executionTime).toBeLessThan(100); // Should be fast
    });

    it('should highlight matched text', () => {
      const result = service.search('sc');
      const scaleFilter = result.results.find(r => r.id === 'scale');
      expect(scaleFilter?.highlightText).toContain('<mark>');
    });
  });

  describe('filterByCategory', () => {
    it('should return all filters for "all" category', () => {
      const result = service.filterByCategory('all');
      expect(result).toHaveLength(mockFilters.length);
    });

    it('should filter by specific category', () => {
      const result = service.filterByCategory('basic');
      expect(result).toHaveLength(2);
      expect(result.every(f => f.category === 'basic')).toBe(true);
    });
  });

  describe('filterByType', () => {
    it('should filter by filter type', () => {
      const result = service.filterByType('audio');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('volume');
    });
  });

  describe('popular filters', () => {
    it('should record filter usage', () => {
      service.recordFilterUsage('scale');
      service.recordFilterUsage('scale');
      service.recordFilterUsage('crop');

      const popular = service.getPopularFilters(10);
      const scaleFilter = popular.find(p => p.filter.id === 'scale');
      const cropFilter = popular.find(p => p.filter.id === 'crop');

      expect(scaleFilter?.popularity).toBe(2);
      expect(cropFilter?.popularity).toBe(1);
    });

    it('should sort filters by popularity', () => {
      service.recordFilterUsage('scale');
      service.recordFilterUsage('scale');
      service.recordFilterUsage('crop');

      const popular = service.getPopularFilters(10);
      expect(popular[0].filter.id).toBe('scale');
      expect(popular[1].filter.id).toBe('crop');
    });

    it('should limit popular filters count', () => {
      for (let i = 0; i < mockFilters.length; i++) {
        service.recordFilterUsage(mockFilters[i].id);
      }

      const popular = service.getPopularFilters(2);
      expect(popular).toHaveLength(2);
    });
  });

  describe('search history', () => {
    it('should add query to search history', () => {
      service.search('test');
      const history = service.getSearchHistory();
      expect(history.some(h => h.query === 'test')).toBe(true);
    });

    it('should keep only unique queries', () => {
      service.search('test');
      service.search('test');
      const history = service.getSearchHistory();
      const testQueries = history.filter(h => h.query === 'test');
      expect(testQueries).toHaveLength(1);
    });

    it('should limit history size', () => {
      for (let i = 0; i < 30; i++) {
        service.search(`test${i}`);
      }
      const history = service.getSearchHistory();
      expect(history.length).toBeLessThanOrEqual(20);
    });

    it('should clear search history', () => {
      service.search('test');
      service.clearSearchHistory();
      const history = service.getSearchHistory();
      expect(history).toHaveLength(0);
    });
  });

  describe('search suggestions', () => {
    it('should return suggestions based on query', () => {
      const suggestions = service.getSuggestions('sc');
      expect(suggestions.length).toBeGreaterThan(0);
    });

    it('should return empty suggestions for empty query', () => {
      const suggestions = service.getSuggestions('');
      expect(suggestions).toHaveLength(0);
    });

    it('should limit suggestions count', () => {
      const suggestions = service.getSuggestions('v');
      expect(suggestions.length).toBeLessThanOrEqual(5);
    });
  });

  describe('performance', () => {
    it('should search in less than 100ms', () => {
      const result = service.search('video');
      expect(result.executionTime).toBeLessThan(100);
    });

    it('should handle large filter set efficiently', () => {
      // Create a large set of filters
      const largeFilters: FilterDefinition[] = Array.from({ length: 1000 }, (_, i) => ({
        id: `filter${i}`,
        name: `Filter ${i}`,
        category: 'basic' as FilterCategory,
        description: `Description for filter ${i}`,
        icon: '🎬',
        filterType: 'video',
        inputPorts: ['v'],
        outputPorts: ['v'],
        params: []
      }));

      service.setFilters(largeFilters);

      const startTime = performance.now();
      const result = service.search('50');
      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(100);
      expect(result.results.length).toBeGreaterThan(0);
    });
  });
});
