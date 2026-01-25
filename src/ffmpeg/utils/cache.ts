/**
 * 命令生成缓存工具
 * 用于缓存 FFmpeg 命令生成结果,避免重复计算
 */

interface CacheEntry {
  key: string;
  command: string;
  timestamp: number;
}

export class CommandCache {
  private cache: Map<string, CacheEntry>;
  private maxSize: number;
  private ttl: number; // Time to live in milliseconds

  constructor(maxSize: number = 100, ttl: number = 5 * 60 * 1000) {
    this.cache = new Map();
    this.maxSize = maxSize;
    this.ttl = ttl;
  }

  /**
   * 生成缓存键
   */
  private generateKey(preset: any, input: string, output: string): string {
    const presetStr = JSON.stringify(preset);
    return `${presetStr}|${input}|${output}`;
  }

  /**
   * 获取缓存的命令
   */
  get(preset: any, input: string, output: string): string | null {
    const key = this.generateKey(preset, input, output);
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    // 检查是否过期
    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.command;
  }

  /**
   * 设置缓存
   */
  set(preset: any, input: string, output: string, command: string): void {
    const key = this.generateKey(preset, input, output);
    const entry: CacheEntry = {
      key,
      command,
      timestamp: Date.now()
    };

    // 如果缓存已满,删除最旧的条目
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }

    this.cache.set(key, entry);
  }

  /**
   * 清空缓存
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * 删除过期的缓存
   */
  prune(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.ttl) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * 获取缓存大小
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * 获取缓存统计信息
   */
  getStats(): { size: number; maxSize: number; ttl: number } {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      ttl: this.ttl
    };
  }
}

// 全局缓存实例
export const commandCache = new CommandCache();

/**
 * 防抖函数
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;

  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      func(...args);
    };

    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(later, wait);
  };
}

/**
 * 节流函数
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;

  return function executedFunction(...args: Parameters<T>) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}
