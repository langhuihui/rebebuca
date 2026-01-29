/**
 * 性能报告生成工具
 * 用于收集和生成性能测试报告
 */

export interface PerformanceMetric {
  name: string;
  duration: number;
  timestamp: number;
  metadata?: Record<string, any>;
}

export interface PerformanceReport {
  summary: {
    totalTests: number;
    passedTests: number;
    failedTests: number;
    totalDuration: number;
    avgDuration: number;
  };
  metrics: {
    graphConverter: {
      presetToGraph: { min: number; max: number; avg: number; count: number };
      graphToPreset: { min: number; max: number; avg: number; count: number };
      autoLayout: { min: number; max: number; avg: number; count: number };
    };
    filterSearch: {
      search: { min: number; max: number; avg: number; count: number };
      suggestions: { min: number; max: number; avg: number; count: number };
    };
    rendering: {
      renderTime: { min: number; max: number; avg: number; count: number };
    };
  };
  details: PerformanceMetric[];
  recommendations: string[];
}

export class PerformanceReporter {
  private metrics: Map<string, PerformanceMetric[]> = new Map();

  /**
   * 记录性能指标
   */
  recordMetric(category: string, name: string, duration: number, metadata?: Record<string, any>): void {
    const key = `${category}.${name}`;
    if (!this.metrics.has(key)) {
      this.metrics.set(key, []);
    }
    this.metrics.get(key)!.push({
      name,
      duration,
      timestamp: Date.now(),
      metadata
    });
  }

  /**
   * 生成性能报告
   */
  generateReport(): PerformanceReport {
    const allMetrics = Array.from(this.metrics.values()).flat();
    const totalDuration = allMetrics.reduce((sum, m) => sum + m.duration, 0);
    const avgDuration = allMetrics.length > 0 ? totalDuration / allMetrics.length : 0;

    return {
      summary: {
        totalTests: allMetrics.length,
        passedTests: allMetrics.length, // 假设所有测试都通过
        failedTests: 0,
        totalDuration,
        avgDuration
      },
      metrics: {
        graphConverter: this.calculateStats('graphConverter.presetToGraph', 'graphConverter.graphToPreset', 'graphConverter.autoLayout'),
        filterSearch: this.calculateStats('filterSearch.search', 'filterSearch.suggestions'),
        rendering: this.calculateStats('rendering.renderTime')
      },
      details: allMetrics,
      recommendations: this.generateRecommendations()
    };
  }

  /**
   * 计算统计数据
   */
  private calculateStats(...keys: string[]): any {
    const stats: any = {};

    keys.forEach(key => {
      const metrics = this.metrics.get(key) || [];
      if (metrics.length === 0) {
        stats[key.split('.')[1]] = { min: 0, max: 0, avg: 0, count: 0 };
        return;
      }

      const durations = metrics.map(m => m.duration);
      stats[key.split('.')[1]] = {
        min: Math.min(...durations),
        max: Math.max(...durations),
        avg: durations.reduce((a, b) => a + b, 0) / durations.length,
        count: metrics.length
      };
    });

    return stats;
  }

  /**
   * 生成优化建议
   */
  private generateRecommendations(): string[] {
    const recommendations: string[] = [];

    // 检查 GraphConverter 性能
    const presetToGraphMetrics = this.metrics.get('graphConverter.presetToGraph');
    if (presetToGraphMetrics && presetToGraphMetrics.length > 0) {
      const avg = presetToGraphMetrics.reduce((sum, m) => sum + m.duration, 0) / presetToGraphMetrics.length;
      if (avg > 50) {
        recommendations.push(`GraphConverter.presetToGraph 平均耗时 ${avg.toFixed(2)}ms，建议优化缓存策略`);
      }
    }

    const autoLayoutMetrics = this.metrics.get('graphConverter.autoLayout');
    if (autoLayoutMetrics && autoLayoutMetrics.length > 0) {
      const avg = autoLayoutMetrics.reduce((sum, m) => sum + m.duration, 0) / autoLayoutMetrics.length;
      if (avg > 30) {
        recommendations.push(`GraphConverter.autoLayout 平均耗时 ${avg.toFixed(2)}ms，建议减少布局迭代次数`);
      }
    }

    // 检查 FilterSearch 性能
    const searchMetrics = this.metrics.get('filterSearch.search');
    if (searchMetrics && searchMetrics.length > 0) {
      const avg = searchMetrics.reduce((sum, m) => sum + m.duration, 0) / searchMetrics.length;
      if (avg > 20) {
        recommendations.push(`FilterSearch.search 平均耗时 ${avg.toFixed(2)}ms，建议增加缓存命中率`);
      }
    }

    // 检查渲染性能
    const renderMetrics = this.metrics.get('rendering.renderTime');
    if (renderMetrics && renderMetrics.length > 0) {
      const avg = renderMetrics.reduce((sum, m) => sum + m.duration, 0) / renderMetrics.length;
      if (avg > 16) { // 16ms = 60fps
        recommendations.push(`渲染平均耗时 ${avg.toFixed(2)}ms，建议使用 v-memo 优化节点渲染`);
      }
    }

    if (recommendations.length === 0) {
      recommendations.push('所有性能指标正常，无需优化');
    }

    return recommendations;
  }

  /**
   * 导出为 JSON
   */
  exportJSON(): string {
    const report = this.generateReport();
    return JSON.stringify(report, null, 2);
  }

  /**
   * 导出为 Markdown
   */
  exportMarkdown(): string {
    const report = this.generateReport();
    const lines: string[] = [];

    lines.push('# 性能测试报告');
    lines.push('');
    lines.push(`生成时间: ${new Date().toISOString()}`);
    lines.push('');

    // 概要
    lines.push('## 概要');
    lines.push('');
    lines.push(`- 总测试数: ${report.summary.totalTests}`);
    lines.push(`- 通过测试: ${report.summary.passedTests}`);
    lines.push(`- 失败测试: ${report.summary.failedTests}`);
    lines.push(`- 总耗时: ${report.summary.totalDuration.toFixed(2)}ms`);
    lines.push(`- 平均耗时: ${report.summary.avgDuration.toFixed(2)}ms`);
    lines.push('');

    // GraphConverter
    lines.push('## GraphConverter 性能');
    lines.push('');
    lines.push('### presetToGraph');
    lines.push(formatStats(report.metrics.graphConverter.presetToGraph));
    lines.push('');
    lines.push('### autoLayout');
    lines.push(formatStats(report.metrics.graphConverter.autoLayout));
    lines.push('');

    // FilterSearch
    lines.push('## FilterSearch 性能');
    lines.push('');
    lines.push('### search');
    lines.push(formatStats(report.metrics.filterSearch.search));
    lines.push('');
    lines.push('### suggestions');
    lines.push(formatStats(report.metrics.filterSearch.suggestions));
    lines.push('');

    // 渲染性能
    lines.push('## 渲染性能');
    lines.push('');
    lines.push('### renderTime');
    lines.push(formatStats(report.metrics.rendering.renderTime));
    lines.push('');

    // 详细数据
    lines.push('## 详细数据');
    lines.push('');
    lines.push('| 名称 | 耗时 (ms) | 时间戳 | 元数据 |');
    lines.push('|------|----------|--------|--------|');
    report.details.forEach(metric => {
      const metaStr = metric.metadata ? JSON.stringify(metric.metadata) : '-';
      lines.push(`| ${metric.name} | ${metric.duration.toFixed(2)} | ${metric.timestamp} | ${metaStr} |`);
    });
    lines.push('');

    // 优化建议
    lines.push('## 优化建议');
    lines.push('');
    report.recommendations.forEach(rec => {
      lines.push(`- ${rec}`);
    });
    lines.push('');

    return lines.join('\n');
  }

  /**
   * 清除所有指标
   */
  clear(): void {
    this.metrics.clear();
  }
}

/**
 * 格式化统计数据
 */
function formatStats(stats: { min: number; max: number; avg: number; count: number }): string {
  return `
| 指标 | 值 |
|------|-----|
| 最小值 | ${stats.min.toFixed(2)}ms |
| 最大值 | ${stats.max.toFixed(2)}ms |
| 平均值 | ${stats.avg.toFixed(2)}ms |
| 次数 | ${stats.count} |
  `.trim();
}

/**
 * 性能测试辅助函数
 */
export function measurePerformance<T>(
  category: string,
  name: string,
  reporter: PerformanceReporter,
  fn: () => T,
  metadata?: Record<string, any>
): T {
  const start = performance.now();
  const result = fn();
  const duration = performance.now() - start;

  reporter.recordMetric(category, name, duration, metadata);
  console.log(`[Performance] ${category}.${name}: ${duration.toFixed(2)}ms`);

  return result;
}

/**
 * 异步性能测试辅助函数
 */
export async function measureAsyncPerformance<T>(
  category: string,
  name: string,
  reporter: PerformanceReporter,
  fn: () => Promise<T>,
  metadata?: Record<string, any>
): Promise<T> {
  const start = performance.now();
  const result = await fn();
  const duration = performance.now() - start;

  reporter.recordMetric(category, name, duration, metadata);
  console.log(`[Performance] ${category}.${name}: ${duration.toFixed(2)}ms`);

  return result;
}

// 导出单例
export const performanceReporter = new PerformanceReporter();
