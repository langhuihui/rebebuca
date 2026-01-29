/**
 * GraphConverter 服务
 * 负责节点图与 FFmpegPreset 之间的双向转换
 */

import type {
  FilterGraphData,
  FilterNode,
  FilterEdge,
  FFmpegPreset,
  FilterDefinition,
  GraphValidationResult,
  GraphValidationError,
  GraphValidationWarning,
  FilterChainGenerationResult,
  LayoutMode
} from '../types/preset';

/**
 * 布局配置接口
 */
export interface LayoutConfig {
  nodeWidth?: number;
  nodeHeight?: number;
  horizontalGap?: number;
  verticalGap?: number;
  direction?: 'horizontal' | 'vertical';
  animationDuration?: number; // 毫秒
  iterations?: number; // 力导向布局迭代次数
  repulsionForce?: number; // 斥力系数
  springForce?: number; // 弹力系数
  damping?: number; // 阻尼系数
}

/**
 * 节点图转换服务
 * 负责节点图与 FFmpegPreset 之间的双向转换
 */
export class GraphConverter {
  // 布局配置
  private defaultConfig: Required<LayoutConfig> = {
    nodeWidth: 200,
    nodeHeight: 100,
    horizontalGap: 50,
    verticalGap: 100,
    direction: 'horizontal',
    animationDuration: 300,
    iterations: 100,
    repulsionForce: 500,
    springForce: 0.05,
    damping: 0.9
  };

  // 性能缓存
  private presetCache = new Map<string, { graph: FilterGraphData; timestamp: number }>();
  private layoutCache = new Map<string, { positions: Map<string, { x: number; y: number }>; timestamp: number }>();
  private readonly CACHE_TTL = 5000; // 缓存5秒
  private readonly MAX_CACHE_SIZE = 100; // 最大缓存数量

  // 性能监控
  private performanceMetrics = {
    presetToGraph: [] as number[],
    graphToPreset: [] as number[],
    autoLayout: [] as number[],
    topologicalSort: [] as number[]
  };
  private readonly MAX_METRICS_COUNT = 100; // 保留最近100条性能数据

  /**
   * 从 preset 生成节点图数据
   * @param preset FFmpeg 预设
   * @param filterLibrary 滤镜库定义
   * @returns 节点图数据
   */
  presetToGraph(
    preset: FFmpegPreset,
    filterLibrary: FilterDefinition[]
  ): FilterGraphData {
    const startTime = performance.now();

    // 生成缓存键（基于 preset 的关键部分）
    const cacheKey = this.generatePresetCacheKey(preset);

    // 检查缓存
    const cached = this.presetCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      console.debug(`[GraphConverter] Cache hit for preset: ${cacheKey}`);
      return cached.graph;
    }

    // 1. 创建基础节点图结构（输入节点 + 输出节点）
    const baseGraph = this.createBaseGraph(preset, filterLibrary);

    // 2. 从 preset.filters 中提取启用的滤镜，创建滤镜节点
    const filterNodes = this.createFilterNodesFromPreset(preset.filters, filterLibrary);

    // 3. 根据滤镜链顺序连接节点
    const edges = this.connectFilterNodes(filterNodes, baseGraph);

    // 4. 组合所有节点和边
    const allNodes = [...baseGraph.nodes, ...filterNodes];

    // 5. 自动布局
    const layoutedGraph = this.autoLayout(
      { nodes: allNodes, edges },
      'hierarchical'
    );

    // 缓存结果
    this.cachePresetResult(cacheKey, layoutedGraph);

    // 记录性能指标
    const executionTime = performance.now() - startTime;
    this.recordPerformance('presetToGraph', executionTime);
    console.debug(`[GraphConverter] presetToGraph took ${executionTime.toFixed(2)}ms`);

    return layoutedGraph;
  }

  /**
   * 从节点图数据生成 preset
   * @param graphData 节点图数据
   * @param filterLibrary 滤镜库定义
   * @returns FFmpeg 预设
   */
  graphToPreset(
    graphData: FilterGraphData,
    filterLibrary: FilterDefinition[]
  ): FFmpegPreset {
    // 1. 验证节点图
    const validation = this.validateGraph(graphData, filterLibrary);
    if (!validation.valid) {
      throw new Error('Invalid graph: ' + validation.errors.map(e => e.message).join(', '));
    }

    // 2. 拓扑排序获取滤镜链顺序
    const sortedNodes = this.topologicalSort(graphData);

    // 3. 提取启用的滤镜节点
    const activeFilters = sortedNodes.filter(
      node => node.type === 'filter' && node.data.enabled
    );

    // 4. 转换为 preset.filters 结构
    const preset = this.createDefaultPreset();
    preset.filters = this.convertGraphNodesToFilters(activeFilters, filterLibrary);

    // 5. 生成 filter_complex 字符串存储到 custom.videoFilter（备用）
    const filterChainResult = this.graphToFilterChain(graphData, filterLibrary);
    if (filterChainResult.filterComplex) {
      preset.custom.videoFilter = filterChainResult.filterComplex;
    }

    return preset;
  }

  /**
   * 从节点图生成 FFmpeg 滤镜链
   * @param graphData 节点图数据
   * @param filterLibrary 滤镜库定义
   * @returns 滤镜链生成结果
   */
  graphToFilterChain(
    graphData: FilterGraphData,
    filterLibrary: FilterDefinition[]
  ): FilterChainGenerationResult {
    const { nodes, edges } = graphData;

    // 1. 拓扑排序
    const sortedNodes = this.topologicalSort(graphData);

    // 2. 分配标签索引
    const labelMap = this.assignLabels(nodes, edges, filterLibrary);

    // 3. 生成滤镜链字符串
    const filterParts: string[] = [];

    for (const node of sortedNodes) {
      if (node.type === 'filter' && node.data.enabled) {
        const filterStr = this.generateFilterString(node, labelMap, edges, filterLibrary);
        if (filterStr) {
          filterParts.push(filterStr);
        }
      }
    }

    // 4. 组合为完整的 filter_complex
    const filterComplex = filterParts.join(';');

    // 5. 生成流映射
    const streamMaps = this.generateStreamMapsFromGraph(nodes, labelMap);

    return {
      success: true,
      filterComplex,
      streamMaps
    };
  }

  /**
   * 验证节点图的有效性
   * @param graphData 节点图数据
   * @param filterLibrary 滤镜库定义
   * @returns 验证结果
   */
  validateGraph(
    graphData: FilterGraphData,
    filterLibrary: FilterDefinition[]
  ): GraphValidationResult {
    const errors: GraphValidationError[] = [];
    const warnings: GraphValidationWarning[] = [];

    const { nodes, edges } = graphData;

    // 1. 检测循环依赖
    const cycles = this.detectCycles(nodes, edges);
    if (cycles.length > 0) {
      errors.push({
        type: 'cycle',
        nodeId: cycles[0],
        message: `检测到循环依赖: ${cycles.join(' → ')}`,
        details: { cycle: cycles }
      });
    }

    // 2. 检查端口类型匹配
    const portMismatches = this.checkPortTypes(nodes, edges, filterLibrary);
    errors.push(...portMismatches);

    // 3. 检查必需参数
    const missingParams = this.checkRequiredParams(nodes, filterLibrary);
    errors.push(...missingParams);

    // 4. 检查孤立节点
    const orphanNodes = this.findOrphanNodes(nodes, edges);
    warnings.push(...orphanNodes);

    // 5. 检查禁用节点
    const disabledNodes = nodes.filter(n => n.type === 'filter' && !n.data.enabled);
    if (disabledNodes.length > 0) {
      disabledNodes.forEach(node => {
        warnings.push({
          type: 'disabled_node',
          nodeId: node.id,
          message: `节点 ${node.data.name} 已禁用`
        });
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * 自动布局节点图
   * @param graphData 节点图数据
   * @param layoutMode 布局模式
   * @param config 布局配置
   * @returns 布局后的节点图数据
   */
  autoLayout(
    graphData: FilterGraphData,
    layoutMode: LayoutMode = 'hierarchical',
    config?: LayoutConfig
  ): FilterGraphData {
    const startTime = performance.now();

    // 生成布局缓存键
    const layoutKey = this.generateLayoutCacheKey(graphData, layoutMode, config);

    // 检查布局缓存
    const cachedLayout = this.layoutCache.get(layoutKey);
    if (cachedLayout && Date.now() - cachedLayout.timestamp < this.CACHE_TTL) {
      console.debug(`[GraphConverter] Layout cache hit for mode: ${layoutMode}`);
      const positions = cachedLayout.positions;
      const positionedNodes = graphData.nodes.map(node => ({
        ...node,
        position: positions.get(node.id) || node.position
      }));
      return { ...graphData, nodes: positionedNodes };
    }

    const mergedConfig = { ...this.defaultConfig, ...config };

    let result: FilterGraphData;
    switch (layoutMode) {
      case 'hierarchical':
        result = this.layoutHierarchical(graphData, mergedConfig);
        break;
      case 'force':
        result = this.layoutForceDirected(graphData, mergedConfig);
        break;
      case 'grid':
        result = this.layoutGrid(graphData, mergedConfig);
        break;
      case 'tree':
        result = this.layoutTree(graphData, mergedConfig);
        break;
      case 'circular':
        result = this.layoutCircular(graphData, mergedConfig);
        break;
      case 'auto':
      default:
        result = this.layoutHierarchical(graphData, mergedConfig);
    }

    // 缓存布局结果
    const positionMap = new Map(
      result.nodes.map(node => [node.id, node.position])
    );
    this.cacheLayoutResult(layoutKey, positionMap);

    // 记录性能指标
    const executionTime = performance.now() - startTime;
    this.recordPerformance('autoLayout', executionTime);
    console.debug(`[GraphConverter] autoLayout (${layoutMode}) took ${executionTime.toFixed(2)}ms`);

    return result;
  }

  /**
   * 从预设创建基础节点图结构
   * @param preset FFmpeg 预设
   * @param filterLibrary 滤镜库定义
   * @returns 基础节点图数据
   */
  createBaseGraph(
    preset: FFmpegPreset,
    filterLibrary: FilterDefinition[]
  ): FilterGraphData {
    // filterLibrary 参数保留用于未来扩展
    void filterLibrary;

    const nodes: FilterNode[] = [];
    const edges: FilterEdge[] = [];

    // 创建视频输入节点
    if (preset.video.enabled) {
      nodes.push({
        id: 'input-video',
        type: 'input',
        position: { x: 0, y: 0 },
        data: {
          name: '视频输入',
          label: '视频输入',
          description: '输入视频流',
          icon: '📹',
          enabled: true,
          streamType: 'v',
          streamIndex: 0
        }
      });
    }

    // 创建音频输入节点
    if (preset.audio.enabled) {
      nodes.push({
        id: 'input-audio',
        type: 'input',
        position: { x: 0, y: 150 },
        data: {
          name: '音频输入',
          label: '音频输入',
          description: '输入音频流',
          icon: '🎵',
          enabled: true,
          streamType: 'a',
          streamIndex: 0
        }
      });
    }

    return { nodes, edges };
  }

  /**
   * 同步 preset 到节点图（增量更新）
   * @param currentGraph 当前节点图
   * @param preset 新的 preset
   * @param filterLibrary 滤镜库定义
   * @returns 更新后的节点图
   */
  syncPresetToGraph(
    currentGraph: FilterGraphData,
    preset: FFmpegPreset,
    filterLibrary: FilterDefinition[]
  ): FilterGraphData {
    // currentGraph 参数保留用于未来增量更新实现
    void currentGraph;
    // 简单实现：重新生成节点图
    return this.presetToGraph(preset, filterLibrary);
  }

  // ==================== 性能监控和缓存方法 ====================

  /**
   * 生成 preset 缓存键
   */
  private generatePresetCacheKey(preset: FFmpegPreset): string {
    // 只使用预设的关键部分生成缓存键
    const keyParts = [
      preset.video.encoder,
      preset.audio.encoder,
      JSON.stringify(preset.filters || {}),
      preset.custom.videoFilter
    ];
    return keyParts.join('|');
  }

  /**
   * 生成布局缓存键
   */
  private generateLayoutCacheKey(
    graphData: FilterGraphData,
    layoutMode: LayoutMode,
    config?: LayoutConfig
  ): string {
    const nodeIds = graphData.nodes.map(n => n.id).sort().join(',');
    const edgeIds = graphData.edges.map(e => `${e.source}-${e.target}`).sort().join(',');
    const configStr = JSON.stringify(config || this.defaultConfig);
    return `${layoutMode}|${nodeIds}|${edgeIds}|${configStr}`;
  }

  /**
   * 缓存 preset 转换结果
   */
  private cachePresetResult(key: string, graph: FilterGraphData): void {
    // 检查缓存大小限制
    if (this.presetCache.size >= this.MAX_CACHE_SIZE) {
      // 删除最旧的缓存项
      const oldestKey = Array.from(this.presetCache.entries())
        .sort((a, b) => a[1].timestamp - b[1].timestamp)[0][0];
      this.presetCache.delete(oldestKey);
    }
    this.presetCache.set(key, { graph, timestamp: Date.now() });
  }

  /**
   * 缓存布局结果
   */
  private cacheLayoutResult(
    key: string,
    positions: Map<string, { x: number; y: number }>
  ): void {
    if (this.layoutCache.size >= this.MAX_CACHE_SIZE) {
      const oldestKey = Array.from(this.layoutCache.entries())
        .sort((a, b) => a[1].timestamp - b[1].timestamp)[0][0];
      this.layoutCache.delete(oldestKey);
    }
    this.layoutCache.set(key, { positions, timestamp: Date.now() });
  }

  /**
   * 记录性能指标
   */
  private recordPerformance(method: keyof typeof this.performanceMetrics, time: number): void {
    const metrics = this.performanceMetrics[method];
    metrics.push(time);
    if (metrics.length > this.MAX_METRICS_COUNT) {
      metrics.shift();
    }
  }

  /**
   * 获取性能统计
   */
  public getPerformanceStats(): {
    [K in keyof typeof this.performanceMetrics]: {
      avg: number;
      min: number;
      max: number;
      count: number;
    };
  } {
    const stats = {} as any;
    for (const [key, values] of Object.entries(this.performanceMetrics)) {
      if (values.length === 0) {
        stats[key] = { avg: 0, min: 0, max: 0, count: 0 };
      } else {
        stats[key] = {
          avg: values.reduce((a, b) => a + b, 0) / values.length,
          min: Math.min(...values),
          max: Math.max(...values),
          count: values.length
        };
      }
    }
    return stats;
  }

  /**
   * 清除所有缓存
   */
  public clearCache(): void {
    this.presetCache.clear();
    this.layoutCache.clear();
    console.debug('[GraphConverter] All caches cleared');
  }

  // ==================== 私有辅助方法 ====================

  /**
   * 从 preset.filters 创建滤镜节点
   */
  private createFilterNodesFromPreset(
    filters: FFmpegPreset['filters'],
    filterLibrary: FilterDefinition[]
  ): FilterNode[] {
    const nodes: FilterNode[] = [];
    let nodeIndex = 0;

    // 处理裁剪滤镜
    if (filters.crop?.enabled) {
      const filterDef = filterLibrary.find(f => f.id === 'crop');
      if (filterDef) {
        nodes.push({
          id: `filter-crop-${Date.now()}`,
          type: 'filter',
          position: { x: 0, y: 0 },
          data: {
            name: filterDef.name,
            label: filterDef.name,
            description: filterDef.description,
            icon: filterDef.icon,
            enabled: true,
            filterId: filterDef.id,
            filterType: filterDef.filterType,
            params: {
              w: filters.crop.width,
              h: filters.crop.height,
              x: filters.crop.x,
              y: filters.crop.y
            },
            paramDefinitions: filterDef.params
          }
        });
      }
    }

    // 处理缩放滤镜
    if (filters.scale?.enabled) {
      const filterDef = filterLibrary.find(f => f.id === 'scale');
      if (filterDef) {
        nodes.push({
          id: `filter-scale-${Date.now()}-${nodeIndex++}`,
          type: 'filter',
          position: { x: 0, y: 0 },
          data: {
            name: filterDef.name,
            label: filterDef.name,
            description: filterDef.description,
            icon: filterDef.icon,
            enabled: true,
            filterId: filterDef.id,
            filterType: filterDef.filterType,
            params: {
              width: filters.scale.width,
              height: filters.scale.height,
              flags: filters.scale.algorithm || 'bicubic'
            },
            paramDefinitions: filterDef.params
          }
        });
      }
    }

    // 处理帧率滤镜
    if (filters.framerate?.enabled) {
      const filterDef = filterLibrary.find(f => f.id === 'fps');
      if (filterDef) {
        nodes.push({
          id: `filter-fps-${Date.now()}-${nodeIndex++}`,
          type: 'filter',
          position: { x: 0, y: 0 },
          data: {
            name: filterDef.name,
            label: filterDef.name,
            description: filterDef.description,
            icon: filterDef.icon,
            enabled: true,
            filterId: filterDef.id,
            filterType: filterDef.filterType,
            params: {
              fps: filters.framerate.fps,
              round: 'near'
            },
            paramDefinitions: filterDef.params
          }
        });
      }
    }

    // 处理去隔行滤镜
    if (filters.deinterlace?.enabled) {
      const filterDef = filterLibrary.find(f => f.id === 'yadif');
      if (filterDef) {
        nodes.push({
          id: `filter-deinterlace-${Date.now()}-${nodeIndex++}`,
          type: 'filter',
          position: { x: 0, y: 0 },
          data: {
            name: filterDef.name,
            label: filterDef.name,
            description: filterDef.description,
            icon: filterDef.icon,
            enabled: true,
            filterId: filterDef.id,
            filterType: filterDef.filterType,
            params: {
              mode: filters.deinterlace.mode
            },
            paramDefinitions: filterDef.params
          }
        });
      }
    }

    // 处理旋转/翻转滤镜
    if (filters.transform?.enabled) {
      const filterDef = filterLibrary.find(f => f.id === 'rotate');
      if (filterDef) {
        nodes.push({
          id: `filter-transform-${Date.now()}-${nodeIndex++}`,
          type: 'filter',
          position: { x: 0, y: 0 },
          data: {
            name: filterDef.name,
            label: filterDef.name,
            description: filterDef.description,
            icon: filterDef.icon,
            enabled: true,
            filterId: filterDef.id,
            filterType: filterDef.filterType,
            params: {
              angle: filters.transform.rotation || '0'
            },
            paramDefinitions: filterDef.params
          }
        });
      }
    }

    return nodes;
  }

  /**
   * 连接滤镜节点
   */
  private connectFilterNodes(
    filterNodes: FilterNode[],
    baseGraph: FilterGraphData
  ): FilterEdge[] {
    const edges: FilterEdge[] = [];
    const videoInputNode = baseGraph.nodes.find(n => n.id === 'input-video');
    const audioInputNode = baseGraph.nodes.find(n => n.id === 'input-audio');

    // 按顺序连接视频滤镜
    const videoFilters = filterNodes.filter(
      n => n.data.filterType === 'video' || n.data.filterType === 'complex'
    );

    if (videoInputNode && videoFilters.length > 0) {
      let previousNodeId = videoInputNode.id;
      for (const filter of videoFilters) {
        edges.push({
          id: `edge-${Date.now()}-${Math.random()}`,
          source: previousNodeId,
          target: filter.id,
          sourceHandle: 'v',
          targetHandle: 'v',
          animated: true
        });
        previousNodeId = filter.id;
      }
    }

    // 按顺序连接音频滤镜
    const audioFilters = filterNodes.filter(n => n.data.filterType === 'audio');
    if (audioInputNode && audioFilters.length > 0) {
      let previousNodeId = audioInputNode.id;
      for (const filter of audioFilters) {
        edges.push({
          id: `edge-${Date.now()}-${Math.random()}`,
          source: previousNodeId,
          target: filter.id,
          sourceHandle: 'a',
          targetHandle: 'a',
          animated: true
        });
        previousNodeId = filter.id;
      }
    }

    return edges;
  }

  /**
   * 创建默认 preset
   */
  private createDefaultPreset(): FFmpegPreset {
    return {
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
  }

  /**
   * 将图节点转换为 preset.filters
   */
  private convertGraphNodesToFilters(
    activeFilters: FilterNode[],
    filterLibrary: FilterDefinition[]
  ): FFmpegPreset['filters'] {
    // filterLibrary 参数保留用于未来扩展（如参数验证）
    void filterLibrary;

    const filters: FFmpegPreset['filters'] = {};

    for (const node of activeFilters) {
      const filterId = node.data.filterId;
      const params = node.data.params || {};

      switch (filterId) {
        case 'crop':
          filters.crop = {
            enabled: true,
            width: params.w || 'iw',
            height: params.h || 'ih',
            x: params.x || '0',
            y: params.y || '0'
          };
          break;

        case 'scale':
          filters.scale = {
            enabled: true,
            width: params.width || '1920',
            height: params.height || '1080',
            keepAspect: true,
            algorithm: params.flags
          };
          break;

        case 'fps':
          filters.framerate = {
            enabled: true,
            fps: params.fps || '30',
            mode: 0
          };
          break;

        case 'yadif':
          filters.deinterlace = {
            enabled: true,
            mode: params.mode || 0
          };
          break;

        case 'rotate':
          filters.transform = {
            enabled: true,
            rotation: params.angle || '0'
          };
          break;
      }
    }

    return filters;
  }

  /**
   * 拓扑排序（Kahn 算法）
   */
  private topologicalSort(graphData: FilterGraphData): FilterNode[] {
    const { nodes, edges } = graphData;
    const inDegree = new Map<string, number>();
    const queue: FilterNode[] = [];
    const result: FilterNode[] = [];

    // 初始化入度
    nodes.forEach(node => {
      inDegree.set(node.id, 0);
    });

    // 计算入度
    edges.forEach(edge => {
      const degree = inDegree.get(edge.target) || 0;
      inDegree.set(edge.target, degree + 1);
    });

    // 找到入度为 0 的节点
    nodes.forEach(node => {
      if (inDegree.get(node.id) === 0) {
        queue.push(node);
      }
    });

    // Kahn 算法
    while (queue.length > 0) {
      const node = queue.shift()!;
      result.push(node);

      // 减少邻居的入度
      const outgoingEdges = edges.filter(e => e.source === node.id);
      for (const edge of outgoingEdges) {
        const degree = inDegree.get(edge.target)! - 1;
        inDegree.set(edge.target, degree);

        if (degree === 0) {
          const neighbor = nodes.find(n => n.id === edge.target);
          if (neighbor) {
            queue.push(neighbor);
          }
        }
      }
    }

    return result;
  }

  /**
   * 为节点分配 FFmpeg 标签
   */
  private assignLabels(
    nodes: FilterNode[],
    edges: FilterEdge[],
    filterLibrary: FilterDefinition[]
  ): Map<string, string> {
    const labelMap: Map<string, string> = new Map();
    let videoLabelIndex = 0;
    let audioLabelIndex = 0;

    // 输入节点使用标准标签
    nodes.forEach(node => {
      if (node.type === 'input') {
        if (node.data.streamType === 'v') {
          labelMap.set(node.id, `[0:v]`);
        } else if (node.data.streamType === 'a') {
          labelMap.set(node.id, `[0:a]`);
        }
      }
    });

    // 拓扑排序
    const sortedNodes = this.topologicalSort({ nodes, edges });

    // 为每个滤镜节点分配输出标签
    for (const node of sortedNodes) {
      if (node.type === 'filter') {
        const filterDef = filterLibrary.find(f => f.id === node.data.filterId);
        if (!filterDef) continue;

        // 根据输出端口类型分配标签
        for (let i = 0; i < filterDef.outputPorts.length; i++) {
          const portType = filterDef.outputPorts[i];
          let label = '';

          if (portType === 'v') {
            label = `[v${videoLabelIndex++}]`;
          } else if (portType === 'a') {
            label = `[a${audioLabelIndex++}]`;
          }

          labelMap.set(`${node.id}:${i}`, label);
        }
      }
    }

    return labelMap;
  }

  /**
   * 生成单个滤镜字符串
   */
  private generateFilterString(
    node: FilterNode,
    labelMap: Map<string, string>,
    edges: FilterEdge[],
    filterLibrary: FilterDefinition[]
  ): string {
    const filterDef = filterLibrary.find(f => f.id === node.data.filterId);
    if (!filterDef) return '';

    // 1. 获取输入标签
    const inputLabels: string[] = [];
    const incomingEdges = edges.filter(e => e.target === node.id);

    for (const edge of incomingEdges) {
      const sourceLabel = labelMap.get(edge.source);
      if (sourceLabel) {
        inputLabels.push(sourceLabel);
      }
    }

    // 2. 生成参数字符串
    const params = node.data.params || {};
    const paramParts: string[] = [];

    for (const paramDef of filterDef.params) {
      const value = params[paramDef.name];
      if (value !== undefined && value !== null && value !== '') {
        paramParts.push(`${paramDef.name}=${this.formatParamValue(value)}`);
      }
    }

    const paramString = paramParts.length > 0 ? paramParts.join(':') : '';

    // 3. 获取输出标签
    const outputLabels: string[] = [];
    for (let i = 0; i < filterDef.outputPorts.length; i++) {
      const outputLabel = labelMap.get(`${node.id}:${i}`);
      if (outputLabel) {
        outputLabels.push(outputLabel);
      }
    }

    // 4. 组合为完整滤镜字符串
    let filterString = '';

    // 添加输入标签
    if (inputLabels.length > 0) {
      filterString += inputLabels.join('');
    }

    // 添加滤镜名和参数
    filterString += filterDef.id;
    if (paramString) {
      filterString += `=${paramString}`;
    }

    // 添加输出标签
    if (outputLabels.length > 0) {
      filterString += outputLabels.join('');
    }

    return filterString;
  }

  /**
   * 格式化参数值
   */
  private formatParamValue(value: any): string {
    if (typeof value === 'string') {
      return value;
    } else if (typeof value === 'number') {
      return value.toString();
    } else if (typeof value === 'boolean') {
      return value ? '1' : '0';
    }
    return String(value);
  }

  /**
   * 从节点图生成流映射
   */
  private generateStreamMapsFromGraph(
    nodes: FilterNode[],
    labelMap: Map<string, string>
  ): string[] {
    const maps: string[] = [];

    // 找到最后一个视频和音频滤镜节点
    const videoFilters = nodes.filter(
      n => n.type === 'filter' && n.data.filterType === 'video' && n.data.enabled
    );
    const audioFilters = nodes.filter(
      n => n.type === 'filter' && n.data.filterType === 'audio' && n.data.enabled
    );

    // 添加视频流映射
    if (videoFilters.length > 0) {
      const lastVideoFilter = videoFilters[videoFilters.length - 1];
      const videoLabel = labelMap.get(`${lastVideoFilter.id}:0`);
      if (videoLabel) {
        maps.push(`-map ${videoLabel}`);
      }
    } else {
      // 没有视频滤镜，使用原始输入
      maps.push(`-map 0:v`);
    }

    // 添加音频流映射
    if (audioFilters.length > 0) {
      const lastAudioFilter = audioFilters[audioFilters.length - 1];
      const audioLabel = labelMap.get(`${lastAudioFilter.id}:0`);
      if (audioLabel) {
        maps.push(`-map ${audioLabel}`);
      }
    } else {
      // 没有音频滤镜，使用原始输入
      maps.push(`-map 0:a`);
    }

    return maps;
  }

  /**
   * 检测循环依赖（DFS）
   */
  private detectCycles(
    nodes: FilterNode[],
    edges: FilterEdge[]
  ): string[] {
    const visited: Set<string> = new Set();
    const recursionStack: Set<string> = new Set();
    const path: string[] = [];

    const adjacencyList: Map<string, string[]> = new Map();
    nodes.forEach(node => {
      adjacencyList.set(node.id, []);
    });

    edges.forEach(edge => {
      const neighbors = adjacencyList.get(edge.source) || [];
      neighbors.push(edge.target);
      adjacencyList.set(edge.source, neighbors);
    });

    const dfs = (nodeId: string): boolean | string[] => {
      visited.add(nodeId);
      recursionStack.add(nodeId);
      path.push(nodeId);

      const neighbors = adjacencyList.get(nodeId) || [];
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          const result = dfs(neighbor);
          if (result) return result;
      } else if (recursionStack.has(neighbor)) {
        // 找到循环
        const cycleStart = path.indexOf(neighbor);
        return path.slice(cycleStart) as string[];
        }
      }

      recursionStack.delete(nodeId);
      path.pop();
      return false;
    };

    for (const node of nodes) {
      if (!visited.has(node.id)) {
        const cycle = dfs(node.id);
        if (Array.isArray(cycle)) return cycle;
      }
    }

    return [];
  }

  /**
   * 检查端口类型匹配
   */
  private checkPortTypes(
    nodes: FilterNode[],
    edges: FilterEdge[],
    filterLibrary: FilterDefinition[]
  ): GraphValidationError[] {
    const errors: GraphValidationError[] = [];

    for (const edge of edges) {
      const sourceNode = nodes.find(n => n.id === edge.source);
      const targetNode = nodes.find(n => n.id === edge.target);

      if (!sourceNode || !targetNode) continue;

      // 获取源端口类型
      let sourcePortType: 'v' | 'a' | null = null;
      if (sourceNode.type === 'input') {
        sourcePortType = sourceNode.data.streamType || null;
      } else if (sourceNode.type === 'filter') {
        const sourceFilterDef = filterLibrary.find(f => f.id === sourceNode.data.filterId);
        const sourcePortIndex = parseInt(edge.sourceHandle?.split(':')[1] || '0') || 0;
        sourcePortType = sourceFilterDef?.outputPorts[sourcePortIndex] || null;
      }

      // 获取目标端口类型
      let targetPortType: 'v' | 'a' | null = null;
      if (targetNode.type === 'output') {
        targetPortType = sourcePortType; // 输出节点接受任何类型
      } else if (targetNode.type === 'filter') {
        const targetFilterDef = filterLibrary.find(f => f.id === targetNode.data.filterId);
        const targetPortIndex = parseInt(edge.targetHandle?.split(':')[1] || '0') || 0;
        targetPortType = targetFilterDef?.inputPorts[targetPortIndex] || null;
      }

      // 检查类型匹配
      if (sourcePortType && targetPortType && sourcePortType !== targetPortType) {
        errors.push({
          type: 'port_mismatch',
          nodeId: edge.source,
          message: `端口类型不匹配: ${sourcePortType} -> ${targetPortType}`,
          details: { edge, sourcePortType, targetPortType }
        });
      }
    }

    return errors;
  }

  /**
   * 检查必需参数
   */
  private checkRequiredParams(
    nodes: FilterNode[],
    filterLibrary: FilterDefinition[]
  ): GraphValidationError[] {
    const errors: GraphValidationError[] = [];

    for (const node of nodes) {
      if (node.type !== 'filter') continue;

      const filterDef = filterLibrary.find(f => f.id === node.data.filterId);
      if (!filterDef) continue;

      const params = node.data.params || {};

      for (const paramDef of filterDef.params) {
        if (paramDef.required) {
          const value = params[paramDef.name];
          if (value === undefined || value === null || value === '') {
            errors.push({
              type: 'missing_param',
              nodeId: node.id,
              message: `缺少必需参数: ${paramDef.name}`,
              details: { paramName: paramDef.name }
            });
          }
        }
      }
    }

    return errors;
  }

  /**
   * 查找孤立节点
   */
  private findOrphanNodes(
    nodes: FilterNode[],
    edges: FilterEdge[]
  ): GraphValidationWarning[] {
    const warnings: GraphValidationWarning[] = [];

    const connectedNodeIds = new Set<string>();

    edges.forEach(edge => {
      connectedNodeIds.add(edge.source);
      connectedNodeIds.add(edge.target);
    });

    nodes.forEach(node => {
      if (node.type === 'filter' && !connectedNodeIds.has(node.id)) {
        warnings.push({
          type: 'orphan_node',
          nodeId: node.id,
          message: `节点 ${node.data.name} 未连接`,
          details: { nodeId: node.id }
        });
      }
    });

    return warnings;
  }

  /**
   * 分层布局算法实现（优化版 - 使用 Barycenter heuristic）
   */
  private layoutHierarchical(
    graphData: FilterGraphData,
    config: Required<LayoutConfig>
  ): FilterGraphData {
    const { nodes, edges } = graphData;

    // 1. 拓扑排序（确定节点层级）
    const levels = this.assignLevels(nodes, edges);

    // 2. 同级节点排序（多次迭代减少交叉边）
    const orderedNodes = this.orderNodesByLevelOptimized(
      nodes,
      levels,
      edges,
      config
    );

    // 3. 计算节点位置
    const positionedNodes = this.calculateNodePositionsOptimized(
      orderedNodes,
      levels,
      config
    );

    return {
      ...graphData,
      nodes: positionedNodes
    };
  }

  /**
   * 圆形布局算法
   */
  private layoutCircular(
    graphData: FilterGraphData,
    config: Required<LayoutConfig>
  ): FilterGraphData {
    const { nodes } = graphData;
    const centerX = 800 / 2;
    const centerY = 600 / 2;
    const radius = Math.min(nodes.length * 60, Math.min(centerX, centerY) - 100);

    const positionedNodes = nodes.map((node, index) => {
      const angle = (2 * Math.PI * index) / nodes.length;
      return {
        ...node,
        position: {
          x: centerX + radius * Math.cos(angle),
          y: centerY + radius * Math.sin(angle)
        }
      };
    });

    return {
      ...graphData,
      nodes: positionedNodes
    };
  }

  /**
   * 力导向布局算法
   */
  private layoutForceDirected(
    graphData: FilterGraphData,
    config: Required<LayoutConfig>
  ): FilterGraphData {
    const { nodes, edges } = graphData;

    // 创建节点位置的副本
    const positions = new Map<string, { x: number; y: number; vx: number; vy: number }>();

    // 初始化位置（如果节点位置为 0, 则随机放置）
    nodes.forEach(node => {
      positions.set(node.id, {
        x: node.position.x || Math.random() * 800,
        y: node.position.y || Math.random() * 600,
        vx: 0,
        vy: 0
      });
    });

    // 构建邻接表
    const adjacency = new Map<string, string[]>();
    nodes.forEach(node => {
      adjacency.set(node.id, []);
    });
    edges.forEach(edge => {
      const neighbors = adjacency.get(edge.source) || [];
      neighbors.push(edge.target);
      adjacency.set(edge.source, neighbors);

      const reverseNeighbors = adjacency.get(edge.target) || [];
      reverseNeighbors.push(edge.source);
      adjacency.set(edge.target, reverseNeighbors);
    });

    // 迭代计算
    for (let iter = 0; iter < config.iterations; iter++) {
      // 1. 计算斥力（节点之间互相排斥）
      positions.forEach((pos1, id1) => {
        pos1.fx = 0;
        pos1.fy = 0;

        positions.forEach((pos2, id2) => {
          if (id1 === id2) return;

          const dx = pos1.x - pos2.x;
          const dy = pos1.y - pos2.y;
          const distSq = dx * dx + dy * dy;
          const dist = Math.sqrt(distSq) || 1;

          const force = config.repulsionForce / distSq;
          pos1.fx += (dx / dist) * force;
          pos1.fy += (dy / dist) * force;
        });
      });

      // 2. 计算弹力（相连的节点互相吸引）
      edges.forEach(edge => {
        const pos1 = positions.get(edge.source);
        const pos2 = positions.get(edge.target);
        if (!pos1 || !pos2) return;

        const dx = pos2.x - pos1.x;
        const dy = pos2.y - pos1.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;

        const idealLength = config.horizontalGap + config.nodeWidth;
        const force = (dist - idealLength) * config.springForce;

        pos1.fx += (dx / dist) * force;
        pos1.fy += (dy / dist) * force;
        pos2.fx -= (dx / dist) * force;
        pos2.fy -= (dy / dist) * force;
      });

      // 3. 更新位置
      positions.forEach(pos => {
        // 应用阻尼
        pos.vx = (pos.vx + pos.fx) * config.damping;
        pos.vy = (pos.vy + pos.fy) * config.damping;

        // 限制最大速度
        const maxVelocity = 10;
        const speed = Math.sqrt(pos.vx * pos.vx + pos.vy * pos.vy);
        if (speed > maxVelocity) {
          pos.vx = (pos.vx / speed) * maxVelocity;
          pos.vy = (pos.vy / speed) * maxVelocity;
        }

        pos.x += pos.vx;
        pos.y += pos.vy;

        // 边界约束
        pos.x = Math.max(50, Math.min(800 - 50, pos.x));
        pos.y = Math.max(50, Math.min(600 - 50, pos.y));
      });
    }

    // 更新节点位置
    const positionedNodes = nodes.map(node => {
      const pos = positions.get(node.id);
      return {
        ...node,
        position: {
          x: pos?.x || node.position.x,
          y: pos?.y || node.position.y
        }
      };
    });

    return {
      ...graphData,
      nodes: positionedNodes
    };
  }

  /**
   * 网格布局算法
   */
  private layoutGrid(
    graphData: FilterGraphData,
    config: Required<LayoutConfig>
  ): FilterGraphData {
    const { nodes } = graphData;

    const columns = Math.ceil(Math.sqrt(nodes.length));
    const positionedNodes = nodes.map((node, index) => {
      const col = index % columns;
      const row = Math.floor(index / columns);

      return {
        ...node,
        position: {
          x: col * (config.nodeWidth + config.horizontalGap),
          y: row * (config.nodeHeight + config.verticalGap)
        }
      };
    });

    return {
      ...graphData,
      nodes: positionedNodes
    };
  }

  /**
   * 树形布局算法
   */
  private layoutTree(
    graphData: FilterGraphData,
    config: Required<LayoutConfig>
  ): FilterGraphData {
    const { nodes, edges } = graphData;

    // 找到根节点（没有入边或入边最少的节点）
    const inDegree = new Map<string, number>();
    nodes.forEach(node => {
      inDegree.set(node.id, 0);
    });
    edges.forEach(edge => {
      const degree = inDegree.get(edge.target) || 0;
      inDegree.set(edge.target, degree + 1);
    });

    // 选择根节点
    let rootId = nodes[0]?.id;
    let minDegree = Infinity;
    nodes.forEach(node => {
      const degree = inDegree.get(node.id) || 0;
      if (degree < minDegree) {
        minDegree = degree;
        rootId = node.id;
      }
    });

    // 构建树结构
    const children = new Map<string, string[]>();
    nodes.forEach(node => {
      children.set(node.id, []);
    });
    edges.forEach(edge => {
      const childList = children.get(edge.source) || [];
      childList.push(edge.target);
      children.set(edge.source, childList);
    });

    // 递归计算子树宽度
    const subtreeWidths = new Map<string, number>();

    function calculateSubtreeWidth(nodeId: string): number {
      const childList = children.get(nodeId) || [];
      if (childList.length === 0) {
        subtreeWidths.set(nodeId, config.nodeWidth);
        return config.nodeWidth;
      }

      let totalWidth = 0;
      childList.forEach(childId => {
        totalWidth += calculateSubtreeWidth(childId);
      });
      totalWidth += (childList.length - 1) * config.horizontalGap;

      subtreeWidths.set(nodeId, Math.max(config.nodeWidth, totalWidth));
      return subtreeWidths.get(nodeId)!;
    }

    calculateSubtreeWidth(rootId!);

    // 递归布局
    const positions = new Map<string, { x: number; y: number }>();

    function layoutNode(nodeId: string, x: number, y: number) {
      positions.set(nodeId, { x, y });

      const childList = children.get(nodeId) || [];
      if (childList.length === 0) return;

      let startX = x - subtreeWidths.get(nodeId)! / 2;
      childList.forEach(childId => {
        const childWidth = subtreeWidths.get(childId)!;
        const childX = startX + childWidth / 2;
        const childY = y + config.nodeHeight + config.verticalGap;
        layoutNode(childId, childX, childY);
        startX += childWidth + config.horizontalGap;
      });
    }

    layoutNode(rootId!, 400, 50);

    // 更新节点位置
    const positionedNodes = nodes.map(node => {
      const pos = positions.get(node.id);
      return {
        ...node,
        position: {
          x: pos?.x || node.position.x,
          y: pos?.y || node.position.y
        }
      };
    });

    return {
      ...graphData,
      nodes: positionedNodes
    };
  }

  /**
   * 分配节点层级
   */
  private assignLevels(
    nodes: FilterNode[],
    edges: FilterEdge[]
  ): Map<string, number> {
    const levels = new Map<string, number>();
    const inDegree = new Map<string, number>();
    const queue: string[] = [];

    // 初始化入度
    nodes.forEach(node => {
      inDegree.set(node.id, 0);
      if (node.type === 'input') {
        levels.set(node.id, 0);
        queue.push(node.id);
      }
    });

    // 计算入度
    edges.forEach(edge => {
      const degree = inDegree.get(edge.target) || 0;
      inDegree.set(edge.target, degree + 1);
    });

    // BFS 分配层级
    while (queue.length > 0) {
      const nodeId = queue.shift()!;
      const currentLevel = levels.get(nodeId) || 0;

      // 找到所有出边
      const outgoingEdges = edges.filter(e => e.source === nodeId);
      for (const edge of outgoingEdges) {
        const newLevel = currentLevel + 1;
        const existingLevel = levels.get(edge.target);

        // 取最大层级
        if (existingLevel === undefined || newLevel > existingLevel) {
          levels.set(edge.target, newLevel);
        }

        // 更新入度
        const degree = inDegree.get(edge.target)! - 1;
        inDegree.set(edge.target, degree);

        // 入度为 0 时加入队列
        if (degree === 0) {
          queue.push(edge.target);
        }
      }
    }

    return levels;
  }

  /**
   * 按层级排序节点（优化版 - 多次迭代）
   */
  private orderNodesByLevelOptimized(
    nodes: FilterNode[],
    levels: Map<string, number>,
    edges: FilterEdge[],
    config: Required<LayoutConfig>
  ): FilterNode[] {
    // 将节点按层级分组
    const levelGroups = new Map<number, FilterNode[]>();
    nodes.forEach(node => {
      const level = levels.get(node.id) || 0;
      if (!levelGroups.has(level)) {
        levelGroups.set(level, []);
      }
      levelGroups.get(level)!.push(node);
    });

    // 对每层节点进行多次迭代排序（使用 barycenter heuristic 和 median heuristic）
    const sortedNodes: FilterNode[] = [];
    const maxLevel = Math.max(...Array.from(levels.values()));

    for (let level = 0; level <= maxLevel; level++) {
      let group = levelGroups.get(level) || [];

      // 多次迭代减少交叉边
      const iterations = Math.min(10, Math.ceil(maxLevel / 2));
      for (let iter = 0; iter < iterations; iter++) {
        // 奇数迭代使用重心法
        if (iter % 2 === 0) {
          group = this.sortLevelNodesBarycenter(group, edges, level, levels);
        }
        // 偶数迭代使用中位数法
        else {
          group = this.sortLevelNodesMedian(group, edges, level, levels);
        }
      }

      sortedNodes.push(...group);
    }

    return sortedNodes;
  }

  /**
   * 对单层节点排序（重心法 Barycenter Heuristic）
   */
  private sortLevelNodesBarycenter(
    nodes: FilterNode[],
    edges: FilterEdge[],
    currentLevel: number,
    levels: Map<string, number>
  ): FilterNode[] {
    // 计算每个节点的重心
    const barycenters = new Map<string, number>();
    const levelNodes = nodes.filter(n => levels.get(n.id) === currentLevel - 1);

    nodes.forEach(node => {
      let sum = 0;
      let count = 0;

      // 找到所有指向上层的边
      const incomingEdges = edges.filter(e =>
        e.target === node.id &&
        levels.get(e.source) === currentLevel - 1
      );

      if (incomingEdges.length === 0) {
        barycenters.set(node.id, -1); // 没有入边的节点排在前面
      } else {
        incomingEdges.forEach(edge => {
          const sourceNodeIndex = levelNodes.findIndex(n => n.id === edge.source);
          if (sourceNodeIndex !== -1) {
            sum += sourceNodeIndex;
            count++;
          }
        });
        barycenters.set(node.id, count > 0 ? sum / count : -1);
      }
    });

    // 按重心排序
    return nodes.slice().sort((a, b) => {
      const centerA = barycenters.get(a.id) ?? -1;
      const centerB = barycenters.get(b.id) ?? -1;
      return centerA - centerB;
    });
  }

  /**
   * 对单层节点排序（中位数法 Median Heuristic）
   */
  private sortLevelNodesMedian(
    nodes: FilterNode[],
    edges: FilterEdge[],
    currentLevel: number,
    levels: Map<string, number>
  ): FilterNode[] {
    // 计算每个节点的中位数
    const medians = new Map<string, number>();
    const levelNodes = nodes.filter(n => levels.get(n.id) === currentLevel - 1);

    nodes.forEach(node => {
      // 找到所有指向上层的边
      const incomingEdges = edges.filter(e =>
        e.target === node.id &&
        levels.get(e.source) === currentLevel - 1
      );

      if (incomingEdges.length === 0) {
        medians.set(node.id, -1); // 没有入边的节点排在前面
      } else {
        const positions: number[] = [];
        incomingEdges.forEach(edge => {
          const sourceNodeIndex = levelNodes.findIndex(n => n.id === edge.source);
          if (sourceNodeIndex !== -1) {
            positions.push(sourceNodeIndex);
          }
        });
        positions.sort((a, b) => a - b);

        // 计算中位数
        const mid = Math.floor(positions.length / 2);
        medians.set(node.id, positions.length % 2 === 0
          ? (positions[mid - 1] + positions[mid]) / 2
          : positions[mid]);
      }
    });

    // 按中位数排序
    return nodes.slice().sort((a, b) => {
      const medianA = medians.get(a.id) ?? -1;
      const medianB = medians.get(b.id) ?? -1;
      return medianA - medianB;
    });
  }

  /**
   * 计算节点位置（优化版 - 减少重复计算）
   */
  private calculateNodePositionsOptimized(
    nodes: FilterNode[],
    levels: Map<string, number>,
    config: Required<LayoutConfig>
  ): FilterNode[] {
    // 按层级分组节点
    const levelGroups = new Map<number, FilterNode[]>();
    nodes.forEach(node => {
      const level = levels.get(node.id) || 0;
      if (!levelGroups.has(level)) {
        levelGroups.set(level, []);
      }
      levelGroups.get(level)!.push(node);
    });

    // 预计算每层的 X 坐标
    const levelXPositions = new Map<number, number[]>();
    levelGroups.forEach((group, level) => {
      const totalWidth = group.length * config.nodeWidth + (group.length - 1) * config.horizontalGap;
      const startX = -(totalWidth / 2) + config.nodeWidth / 2;
      const xPositions = group.map((_, idx) => startX + idx * (config.nodeWidth + config.horizontalGap));
      levelXPositions.set(level, xPositions);
    });

    // 计算位置（使用 Map 提高查找效率）
    const updatedNodes: FilterNode[] = [];
    const nodeIndexInLevelCache = new Map<string, number>();

    levelGroups.forEach((group, level) => {
      const xPositions = levelXPositions.get(level) || [];
      const y = level * (config.nodeHeight + config.verticalGap);

      group.forEach((node, idx) => {
        nodeIndexInLevelCache.set(node.id, idx);

        let x: number, yPosition: number;
        if (config.direction === 'vertical') {
          x = level * (config.nodeWidth + config.verticalGap);
          yPosition = xPositions[idx] || 0;
        } else {
          x = xPositions[idx] || 0;
          yPosition = y;
        }

        updatedNodes.push({
          ...node,
          position: { x, y: yPosition }
        });
      });
    });

    return updatedNodes;
  }
}

// 导出单例实例
export const graphConverter = new GraphConverter();

// 导出所有类型
export type {
  FilterGraphData,
  FilterNode,
  FilterEdge,
  FilterDefinition,
  GraphValidationResult,
  GraphValidationError,
  GraphValidationWarning,
  FilterChainGenerationResult,
  LayoutMode
};
