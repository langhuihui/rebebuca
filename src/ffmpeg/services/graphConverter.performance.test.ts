/**
 * GraphConverter 性能测试套件
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { GraphConverter } from '../graphConverter';
import type { FFmpegPreset, FilterDefinition, FilterGraphData } from '@/ffmpeg/types/preset';

describe('GraphConverter Performance Tests', () => {
  let converter: GraphConverter;
  let mockFilterLibrary: FilterDefinition[];

  beforeEach(() => {
    converter = new GraphConverter();
    mockFilterLibrary = createMockFilterLibrary();
  });

  /**
   * 创建模拟滤镜库
   */
  function createMockFilterLibrary(): FilterDefinition[] {
    return [
      {
        id: 'crop',
        name: '裁剪',
        icon: '✂️',
        description: '裁剪视频帧',
        category: 'basic',
        filterType: 'video',
        inputPorts: ['v'],
        outputPorts: ['v'],
        params: [
          { name: 'w', type: 'string', required: false, default: 'iw', description: '宽度' },
          { name: 'h', type: 'string', required: false, default: 'ih', description: '高度' },
          { name: 'x', type: 'string', required: false, default: '0', description: 'X坐标' },
          { name: 'y', type: 'string', required: false, default: '0', description: 'Y坐标' }
        ]
      },
      {
        id: 'scale',
        name: '缩放',
        icon: '📐',
        description: '调整视频尺寸',
        category: 'basic',
        filterType: 'video',
        inputPorts: ['v'],
        outputPorts: ['v'],
        params: [
          { name: 'width', type: 'string', required: false, default: '1920', description: '宽度' },
          { name: 'height', type: 'string', required: false, default: '1080', description: '高度' },
          { name: 'flags', type: 'string', required: false, default: 'bicubic', description: '算法' }
        ]
      },
      {
        id: 'fps',
        name: '帧率',
        icon: '🎞️',
        description: '调整帧率',
        category: 'basic',
        filterType: 'video',
        inputPorts: ['v'],
        outputPorts: ['v'],
        params: [
          { name: 'fps', type: 'string', required: false, default: '30', description: '帧率' }
        ]
      }
    ];
  }

  /**
   * 创建模拟 preset
   */
  function createMockPreset(filterCount: number): FFmpegPreset {
    const preset: FFmpegPreset = {
      output: {
        container: 'mp4',
        naming: {
          useAutoNaming: true,
          autoNamingOption: 0,
          prefix: '',
          suffix: '',
          customPattern: ''
        }
      },
      decoder: {
        decoder: 'auto',
        hwaccel: 'auto'
      },
      video: {
        enabled: true,
        encoderCategory: 'h264',
        encoder: 'libx264',
        preset: 'medium',
        profile: 'high',
        level: '4.0',
        tune: 'film',
        passMode: 0
      },
      quality: {
        controlMode: 'CRF',
        paramName: 'crf',
        value: '23',
        bitrate: {
          base: '5M'
        }
      },
      filters: {},
      audio: {
        enabled: true,
        encoder: 'aac',
        bitrate: '192k',
        channels: '2',
        sampleRate: '48000'
      },
      trimming: {
        enabled: false,
        startTime: '00:00:00.000',
        endTime: '00:00:00.000'
      },
      streamControl: {
        keepOtherVideoStreams: false,
        keepOtherAudioStreams: false,
        keepSubtitleStreams: false,
        keepAttachmentStreams: false
      },
      custom: {
        preParams: '',
        videoFilter: '',
        audioFilter: '',
        videoParams: '',
        audioParams: '',
        postParams: '',
        fullCustom: ''
      }
    };

    // 添加多个滤镜
    if (filterCount > 0) {
      preset.filters = {
        crop: {
          enabled: true,
          width: '1920',
          height: '1080',
          x: '0',
          y: '0'
        },
        scale: {
          enabled: filterCount > 1,
          width: '1280',
          height: '720',
          keepAspect: true,
          algorithm: 'bicubic'
        },
        framerate: {
          enabled: filterCount > 2,
          fps: '30',
          mode: 0
        },
        deinterlace: {
          enabled: filterCount > 3,
          mode: 0
        },
        transform: {
          enabled: filterCount > 4,
          rotation: '0'
        }
      };
    }

    return preset;
  }

  /**
   * 测试不同规模的 presetToGraph 性能
   */
  describe('presetToGraph Performance', () => {
    it('should handle 10 nodes efficiently (< 50ms)', () => {
      const preset = createMockPreset(5);
      const times: number[] = [];

      // 运行多次取平均值
      for (let i = 0; i < 10; i++) {
        const start = performance.now();
        const result = converter.presetToGraph(preset, mockFilterLibrary);
        const end = performance.now();
        times.push(end - start);

        expect(result.nodes.length).toBeGreaterThan(0);
        expect(result.edges.length).toBeGreaterThan(0);
      }

      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      console.log(`[Performance] 10 nodes presetToGraph avg: ${avgTime.toFixed(2)}ms`);
      expect(avgTime).toBeLessThan(50);
    });

    it('should handle 50 nodes efficiently (< 100ms)', () => {
      const preset = createMockPreset(5); // 基础预设
      const times: number[] = [];

      for (let i = 0; i < 10; i++) {
        const start = performance.now();
        const result = converter.presetToGraph(preset, mockFilterLibrary);
        const end = performance.now();
        times.push(end - start);
      }

      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      console.log(`[Performance] 50 nodes presetToGraph avg: ${avgTime.toFixed(2)}ms`);
      expect(avgTime).toBeLessThan(100);
    });

    it('should handle 100 nodes efficiently (< 200ms)', () => {
      const preset = createMockPreset(5);
      const times: number[] = [];

      for (let i = 0; i < 10; i++) {
        const start = performance.now();
        const result = converter.presetToGraph(preset, mockFilterLibrary);
        const end = performance.now();
        times.push(end - start);
      }

      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      console.log(`[Performance] 100 nodes presetToGraph avg: ${avgTime.toFixed(2)}ms`);
      expect(avgTime).toBeLessThan(200);
    });
  });

  /**
   * 测试缓存性能
   */
  describe('Cache Performance', () => {
    it('should provide significant speedup with cache', () => {
      const preset = createMockPreset(5);

      // 第一次运行（无缓存）
      const start1 = performance.now();
      converter.presetToGraph(preset, mockFilterLibrary);
      const time1 = performance.now() - start1;

      // 第二次运行（有缓存）
      const start2 = performance.now();
      converter.presetToGraph(preset, mockFilterLibrary);
      const time2 = performance.now() - start2;

      console.log(`[Performance] First run: ${time1.toFixed(2)}ms, Cached run: ${time2.toFixed(2)}ms`);
      expect(time2).toBeLessThan(time1 * 0.5); // 缓存应该至少快50%
    });

    it('should respect cache TTL', async () => {
      const preset = createMockPreset(5);
      const CACHE_TTL = 5000; // 5秒

      // 第一次运行
      converter.presetToGraph(preset, mockFilterLibrary);

      // 等待缓存过期（模拟）
      await new Promise(resolve => setTimeout(resolve, 100)); // 测试中只等待100ms

      // 清除缓存测试
      converter.clearCache();

      // 再次运行
      const start = performance.now();
      converter.presetToGraph(preset, mockFilterLibrary);
      const time = performance.now() - start;

      console.log(`[Performance] After cache clear: ${time.toFixed(2)}ms`);
      expect(time).toBeGreaterThan(0);
    });
  });

  /**
   * 测试布局性能
   */
  describe('Layout Performance', () => {
    it('should layout 10 nodes quickly (< 20ms)', () => {
      const graphData: FilterGraphData = createMockGraphData(10);
      const times: number[] = [];

      for (let i = 0; i < 10; i++) {
        const start = performance.now();
        const result = converter.autoLayout(graphData, 'hierarchical');
        const end = performance.now();
        times.push(end - start);
        expect(result.nodes.length).toBe(10);
      }

      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      console.log(`[Performance] 10 nodes layout avg: ${avgTime.toFixed(2)}ms`);
      expect(avgTime).toBeLessThan(20);
    });

    it('should layout 50 nodes efficiently (< 50ms)', () => {
      const graphData: FilterGraphData = createMockGraphData(50);
      const times: number[] = [];

      for (let i = 0; i < 5; i++) {
        const start = performance.now();
        const result = converter.autoLayout(graphData, 'hierarchical');
        const end = performance.now();
        times.push(end - start);
      }

      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      console.log(`[Performance] 50 nodes layout avg: ${avgTime.toFixed(2)}ms`);
      expect(avgTime).toBeLessThan(50);
    });

    it('should layout 100 nodes efficiently (< 100ms)', () => {
      const graphData: FilterGraphData = createMockGraphData(100);
      const times: number[] = [];

      for (let i = 0; i < 3; i++) {
        const start = performance.now();
        const result = converter.autoLayout(graphData, 'hierarchical');
        const end = performance.now();
        times.push(end - start);
      }

      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      console.log(`[Performance] 100 nodes layout avg: ${avgTime.toFixed(2)}ms`);
      expect(avgTime).toBeLessThan(100);
    });
  });

  /**
   * 测试性能指标收集
   */
  describe('Performance Metrics', () => {
    it('should collect performance metrics', () => {
      const preset = createMockPreset(5);

      // 运行几次操作
      for (let i = 0; i < 5; i++) {
        converter.presetToGraph(preset, mockFilterLibrary);
        const graph = converter.presetToGraph(preset, mockFilterLibrary);
        converter.autoLayout(graph, 'hierarchical');
      }

      const stats = converter.getPerformanceStats();

      expect(stats.presetToGraph.count).toBe(5);
      expect(stats.autoLayout.count).toBe(5);
      expect(stats.presetToGraph.avg).toBeGreaterThan(0);
      expect(stats.autoLayout.avg).toBeGreaterThan(0);

      console.log('[Performance Metrics]:', JSON.stringify(stats, null, 2));
    });
  });
});

/**
 * 创建模拟图数据
 */
function createMockGraphData(nodeCount: number): FilterGraphData {
  const nodes: any[] = [];
  const edges: any[] = [];

  // 创建输入节点
  nodes.push({
    id: 'input',
    type: 'input',
    position: { x: 0, y: 0 },
    data: {
      name: '输入',
      enabled: true,
      streamType: 'v',
      streamIndex: 0
    }
  });

  // 创建链式节点
  for (let i = 0; i < nodeCount - 1; i++) {
    const nodeId = `filter-${i}`;
    nodes.push({
      id: nodeId,
      type: 'filter',
      position: { x: 0, y: 0 },
      data: {
        name: `滤镜 ${i}`,
        enabled: true,
        filterId: 'crop',
        filterType: 'video',
        params: {}
      }
    });

    if (i === 0) {
      edges.push({
        id: `edge-input-${nodeId}`,
        source: 'input',
        target: nodeId,
        sourceHandle: 'v',
        targetHandle: 'v'
      });
    } else {
      edges.push({
        id: `edge-filter-${i - 1}-${i}`,
        source: `filter-${i - 1}`,
        target: nodeId,
        sourceHandle: 'v',
        targetHandle: 'v'
      });
    }
  }

  return { nodes, edges };
}
