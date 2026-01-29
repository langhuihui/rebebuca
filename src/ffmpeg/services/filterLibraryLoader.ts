/**
 * FFmpeg 滤镜库加载器
 * 负责从 filters.json 加载滤镜定义
 */

import type { FilterDefinition } from '../types/preset';

export interface FilterLibraryLoadOptions {
  /**
   * 滤镜类型筛选
   */
  filterType?: string;

  /**
   * 是否包含描述
   */
  includeDescription?: boolean;

  /**
   * 最大加载数量
   */
  maxCount?: number;
}

export class FilterLibraryLoader {
  private cache: Map<string, FilterDefinition[]> = new Map();
  private loadingPromises: Map<string, Promise<FilterDefinition[]>> = new Map();

  /**
   * 从 JSON 文件加载滤镜库
   */
  async loadFromJson(
    filePath: string,
    options?: FilterLibraryLoadOptions
  ): Promise<FilterDefinition[]> {
    // 检查缓存
    const cacheKey = this.getCacheKey(filePath, options);
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    // 检查是否有正在进行的加载
    if (this.loadingPromises.has(cacheKey)) {
      return this.loadingPromises.get(cacheKey)!;
    }

    // 开始加载
    const loadPromise = this.doLoadFromJson(filePath, options);
    this.loadingPromises.set(cacheKey, loadPromise);

    try {
      const filters = await loadPromise;
      this.cache.set(cacheKey, filters);
      return filters;
    } finally {
      this.loadingPromises.delete(cacheKey);
    }
  }

  /**
   * 实际执行加载
   */
  private async doLoadFromJson(
    filePath: string,
    options?: FilterLibraryLoadOptions
  ): Promise<FilterDefinition[]> {
    try {
      // 动态导入 JSON 文件
      const response = await fetch(filePath);

      if (!response.ok) {
        throw new Error(`Failed to load filters.json: ${response.statusText}`);
      }

      const jsonData = await response.json();

      // 转换为 FilterDefinition 数组
      let filters: FilterDefinition[] = Array.isArray(jsonData)
        ? jsonData
        : this.parseFiltersData(jsonData);

      // 应用筛选
      if (options?.filterType) {
        filters = filters.filter(f => f.type.includes(options.filterType!));
      }

      // 应用数量限制
      if (options?.maxCount) {
        filters = filters.slice(0, options.maxCount);
      }

      return filters;
    } catch (error) {
      console.error('Error loading filter library:', error);
      throw error;
    }
  }

  /**
   * 解析滤镜数据
   * 兼容不同的数据格式
   */
  private parseFiltersData(data: any): FilterDefinition[] {
    // 如果数据本身是数组，直接返回
    if (Array.isArray(data)) {
      return data as FilterDefinition[];
    }

    // 如果数据有 filters 字段
    if (data.filters && Array.isArray(data.filters)) {
      return data.filters as FilterDefinition[];
    }

    // 如果数据是对象，尝试提取所有滤镜定义
    if (typeof data === 'object' && data !== null) {
      return Object.entries(data).map(([name, def]: [string, any]) => ({
        id: def.id || 0,
        meta: def.meta || '',
        name: name,
        type: def.type || 'V->V',
        description: def.description || '',
        params: def.params || []
      }));
    }

    throw new Error('Invalid filters data format');
  }

  /**
   * 生成缓存键
   */
  private getCacheKey(filePath: string, options?: FilterLibraryLoadOptions): string {
    const parts = [filePath];

    if (options?.filterType) {
      parts.push(`type:${options.filterType}`);
    }

    if (options?.maxCount) {
      parts.push(`max:${options.maxCount}`);
    }

    return parts.join('|');
  }

  /**
   * 清除缓存
   */
  clearCache(filePath?: string): void {
    if (filePath) {
      // 清除特定路径的所有缓存
      const keys = Array.from(this.cache.keys()).filter(key => key.startsWith(filePath));
      keys.forEach(key => this.cache.delete(key));
    } else {
      // 清除所有缓存
      this.cache.clear();
    }
  }

  /**
   * 获取缓存大小
   */
  getCacheSize(): number {
    return this.cache.size;
  }

  /**
   * 预热缓存
   */
  async warmCache(filePath: string, options?: FilterLibraryLoadOptions): Promise<void> {
    try {
      await this.loadFromJson(filePath, options);
    } catch (error) {
      console.warn('Failed to warm cache:', error);
    }
  }
}

// 导出单例实例
export const filterLibraryLoader = new FilterLibraryLoader();
