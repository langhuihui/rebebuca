/**
 * FFmpeg 参数状态管理
 * 使用 Pinia 管理 FFmpeg 预设配置
 */

import { defineStore } from 'pinia';
import type {
  FFmpegPreset,
  PresetMetadata,
  FilterGraphData,
  FilterDefinition,
  FilterNode,
  FilterEdge,
  GraphValidationError,
  GraphValidationWarning,
  EditorMode,
  LayoutMode,
  FilterCategory,
  FilterChainGenerationResult
} from '../types/preset';
import { validationService } from '../services/validationService';
import presetsData from '../data/presets.json';
import { getHistoryService, type HistoryEntry } from '../services/historyService';

/**
 * 输入文件信息
 */
export interface InputFile {
  name: string;
  path: string;
  size: number;
  type: 'video' | 'audio' | 'image' | 'unknown';
}

export const useFFmpegParamsStore = defineStore('ffmpegParams', {
  state: () => ({
    // ==================== 基础状态 ====================

    // 当前预设配置
    currentPreset: createDefaultPreset(),

    // 内置预设
    builtinPresets: [] as Array<PresetMetadata & { preset: FFmpegPreset }>,

    // 自定义预设
    customPresets: [] as Array<PresetMetadata & { preset: FFmpegPreset }>,

    // 当前选中的预设 ID
    selectedPresetId: '',

    // 输入文件列表
    inputFiles: [] as InputFile[],

    // 输出文件
    outputFile: '',

    // 生成的命令行
    commandPreview: '',

    // 验证结果
    validationResult: validationService.quickValidate(createDefaultPreset()),

    // 加载状态
    loading: false,

    // 错误信息
    error: null as string | null,

    // ==================== 可视化编辑状态 ====================

    // 编辑器模式
    editorMode: 'list' as EditorMode,

    // 节点图数据
    filterGraphData: null as FilterGraphData | null,

    // 滤镜库
    filterLibrary: [] as FilterDefinition[],

    // 图编辑器状态
    graphEditorState: {
      selectedNodeId: null as string | null,
      selectedEdgeId: null as string | null,
      viewport: { x: 0, y: 0, zoom: 1 },
      autoLayout: true,
      snapToGrid: false,
      showMiniMap: true,
      gridSpacing: 20
    },

    // 滤镜库状态
    filterLibraryState: {
      searchQuery: '',
      selectedCategory: 'all' as FilterCategory | 'all',
      loading: false,
      error: null as string | null
    },

    // 节点图验证结果
    graphValidation: {
      valid: true,
      errors: [] as GraphValidationError[],
      warnings: [] as GraphValidationWarning[]
    },

    // ==================== 历史记录状态 ====================

    // 历史记录服务实例
    historyService: getHistoryService(),

    // 历史记录相关状态
    canUndo: false,
    canRedo: false,
    undoHistory: [] as Array<{ id: string; description: string; timestamp: number }>,
    redoHistory: [] as Array<{ id: string; description: string; timestamp: number }>
  }),

  getters: {
    /**
     * 获取所有预设（内置 + 自定义）
     */
    allPresets(state): Array<PresetMetadata & { preset: FFmpegPreset }> {
      return [...state.builtinPresets, ...state.customPresets];
    },

    /**
     * 获取当前选中的预设
     */
    selectedPreset(state): (PresetMetadata & { preset: FFmpegPreset }) | undefined {
      return [...state.builtinPresets, ...state.customPresets].find((p: PresetMetadata & { preset: FFmpegPreset }) => p.id === state.selectedPresetId);
    },

    /**
     * 是否有输入文件
     */
    hasInputFiles(state): boolean {
      return state.inputFiles.length > 0;
    },

    /**
     * 是否为批量模式
     */
    isBatchMode(state): boolean {
      return state.inputFiles.length > 1;
    },

    /**
     * 预设是否有效
     */
    isValidPreset(state): boolean {
      return state.validationResult.valid;
    },

    /**
     * 是否可以开始转码
     */
    canStartEncoding(state): boolean {
      return (
        state.validationResult.valid &&
        state.inputFiles.length > 0 &&
        !state.loading
      );
    },

    // ==================== 可视化编辑 getters ====================

    /**
     * 是否为节点图编辑模式
     */
    isGraphMode(state): boolean {
      return state.editorMode === 'graph';
    },

    /**
     * 选中的节点
     */
    selectedNode(state): FilterNode | undefined {
      return state.filterGraphData?.nodes.find(n => n.id === state.graphEditorState.selectedNodeId);
    },

    /**
     * 选中的边
     */
    selectedEdge(state): FilterEdge | undefined {
      return state.filterGraphData?.edges.find(e => e.id === state.graphEditorState.selectedEdgeId);
    },

    /**
     * 筛选后的滤镜列表
     */
    filteredFilters(state): FilterDefinition[] {
      let filters = state.filterLibrary;

      // 分类筛选
      if (state.filterLibraryState.selectedCategory !== 'all') {
        filters = filters.filter(f => f.category === state.filterLibraryState.selectedCategory);
      }

      // 搜索筛选
      if (state.filterLibraryState.searchQuery) {
        const query = state.filterLibraryState.searchQuery.toLowerCase();
        filters = filters.filter(f =>
          f.name.toLowerCase().includes(query) ||
          f.description.toLowerCase().includes(query)
        );
      }

      return filters;
    },

    /**
     * 滤镜库分类列表
     */
    filterCategories(state): FilterCategory[] {
      return Array.from(new Set(state.filterLibrary.map(f => f.category)));
    },

    // ==================== 历史记录 getters ====================

    /**
     * 获取当前撤销栈大小
     */
    undoStackSize(state): number {
      return state.undoHistory.length;
    },

    /**
     * 获取当前重做栈大小
     */
    redoStackSize(state): number {
      return state.redoHistory.length;
    },

    /**
     * 获取最近一次撤销操作描述
     */
    lastUndoDescription(state): string | null {
      if (state.undoHistory.length > 0) {
        return state.undoHistory[state.undoHistory.length - 1].description;
      }
      return null;
    },

    /**
     * 获取最近一次重做操作描述
     */
    lastRedoDescription(state): string | null {
      if (state.redoHistory.length > 0) {
        return state.redoHistory[state.redoHistory.length - 1].description;
      }
      return null;
    }
  },

  actions: {
    /**
     * 初始化 store
     */
    async initialize() {
      this.loading = true;
      try {
        // 加载内置预设（补充元数据以符合 PresetMetadata）
        this.builtinPresets = (presetsData.builtin as Array<PresetMetadata & { preset: FFmpegPreset }>).map((p) => ({
          ...p,
          version: p.version ?? '1.0.0',
          createdAt: p.createdAt ?? Date.now(),
          updatedAt: p.updatedAt ?? Date.now()
        }));

        // 加载本地存储的自定义预设
        await this.loadCustomPresetsFromStorage();

        // 默认选中第一个内置预设
        if (this.builtinPresets.length > 0) {
          this.applyPreset(this.builtinPresets[0].id);
        }

        this.error = null;
      } catch (error) {
        console.error('Failed to initialize FFmpeg params store:', error);
        this.error = 'Failed to initialize FFmpeg parameters';
      } finally {
        this.loading = false;
      }
    },

    /**
     * 应用预设
     */
    applyPreset(presetId: string) {
      const preset = this.allPresets.find(p => p.id === presetId);
      if (preset) {
        this.selectedPresetId = presetId;
        this.currentPreset = JSON.parse(JSON.stringify(preset.preset));
        this.validateCurrentPreset();
        this.updateCommandPreview();
      }
    },

    /**
     * 更新预设配置
     */
    updatePreset(partialPreset: Partial<FFmpegPreset>) {
      this.currentPreset = { ...this.currentPreset, ...partialPreset };
      this.validateCurrentPreset();
      this.updateCommandPreview();
    },

    /**
     * 更新视频配置
     */
    updateVideoConfig(video: Partial<FFmpegPreset['video']>) {
      this.currentPreset.video = { ...this.currentPreset.video, ...video };
      this.validateCurrentPreset();
      this.updateCommandPreview();
    },

    /**
     * 更新音频配置
     */
    updateAudioConfig(audio: Partial<FFmpegPreset['audio']>) {
      this.currentPreset.audio = { ...this.currentPreset.audio, ...audio };
      this.validateCurrentPreset();
      this.updateCommandPreview();
    },

    /**
     * 更新质量控制
     */
    updateQualityConfig(quality: Partial<FFmpegPreset['quality']>) {
      this.currentPreset.quality = { ...this.currentPreset.quality, ...quality };
      this.validateCurrentPreset();
      this.updateCommandPreview();
    },

    /**
     * 更新滤镜配置
     */
    updateFiltersConfig(filters: Partial<FFmpegPreset['filters']>) {
      this.currentPreset.filters = { ...this.currentPreset.filters, ...filters };
      this.validateCurrentPreset();
      this.updateCommandPreview();
    },

    /**
     * 更新输出配置
     */
    updateOutputConfig(output: Partial<FFmpegPreset['output']>) {
      this.currentPreset.output = { ...this.currentPreset.output, ...output };
      this.validateCurrentPreset();
      this.updateCommandPreview();
    },

    /**
     * 更新剪辑配置
     */
    updateTrimmingConfig(trimming: Partial<FFmpegPreset['trimming']>) {
      this.currentPreset.trimming = { ...this.currentPreset.trimming, ...trimming };
      this.validateCurrentPreset();
      this.updateCommandPreview();
    },

    /**
     * 添加输入文件
     */
    addInputFile(file: InputFile) {
      this.inputFiles.push(file);
      this.updateCommandPreview();
    },

    /**
     * 批量添加输入文件
     */
    addInputFiles(files: InputFile[]) {
      this.inputFiles.push(...files);
      this.updateCommandPreview();
    },

    /**
     * 移除输入文件
     */
    removeInputFile(index: number) {
      this.inputFiles.splice(index, 1);
      this.updateCommandPreview();
    },

    /**
     * 清空输入文件列表
     */
    clearInputFiles() {
      this.inputFiles = [];
      this.updateCommandPreview();
    },

    /**
     * 保存预设为自定义预设
     */
    async savePreset(name: string, description?: string) {
      const metadata: PresetMetadata = {
        id: `custom-${Date.now()}`,
        name,
        description: description || '',
        version: '1.0.0',
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      const customPreset = {
        ...metadata,
        preset: JSON.parse(JSON.stringify(this.currentPreset))
      };

      this.customPresets.push(customPreset);
      await this.saveCustomPresetsToStorage();

      return metadata.id;
    },

    /**
     * 删除自定义预设
     */
    async deleteCustomPreset(presetId: string) {
      const index = this.customPresets.findIndex(p => p.id === presetId);
      if (index !== -1) {
        this.customPresets.splice(index, 1);
        await this.saveCustomPresetsToStorage();

        // 如果删除的是当前选中的预设，切换到默认预设
        if (this.selectedPresetId === presetId) {
          if (this.builtinPresets.length > 0) {
            this.applyPreset(this.builtinPresets[0].id);
          }
        }
      }
    },

    /**
     * 验证当前预设
     */
    validateCurrentPreset() {
      this.validationResult = validationService.quickValidate(this.currentPreset);
    },

    /**
     * 更新命令预览
     */
    async updateCommandPreview() {
      if (this.inputFiles.length === 0) {
        this.commandPreview = '';
        return;
      }

      const { commandBuilder } = await import('../services/commandBuilder');

      try {
        const firstInputFile = this.inputFiles[0];
        this.commandPreview = await commandBuilder.build(
          this.currentPreset,
          firstInputFile.path,
          this.outputFile
        );
      } catch (error) {
        console.error('Failed to generate command preview:', error);
        this.commandPreview = 'Error generating command';
      }
    },

    /**
     * 重置为默认预设
     */
    resetToDefault() {
      this.currentPreset = createDefaultPreset();
      this.validateCurrentPreset();
      this.updateCommandPreview();
    },

    /**
     * 从本地存储加载自定义预设
     */
    async loadCustomPresetsFromStorage() {
      try {
        const stored = localStorage.getItem('rebebuca-ffmpeg-presets');
        if (stored) {
          this.customPresets = JSON.parse(stored);
        }
      } catch (error) {
        console.error('Failed to load custom presets:', error);
      }
    },

    /**
     * 保存自定义预设到本地存储
     */
    async saveCustomPresetsToStorage() {
      try {
        localStorage.setItem(
          'rebebuca-ffmpeg-presets',
          JSON.stringify(this.customPresets)
        );
      } catch (error) {
        console.error('Failed to save custom presets:', error);
      }
    },

    // ==================== 可视化编辑 actions ====================

    /**
     * 从当前 preset 同步到节点图
     */
    async syncPresetToGraph() {
      const { graphConverter } = await import('../services/graphConverter');
      this.filterGraphData = graphConverter.presetToGraph(this.currentPreset, this.filterLibrary);
      this.editorMode = 'graph';
    },

    /**
     * 从节点图同步到当前 preset
     */
    async syncGraphToPreset() {
      if (!this.filterGraphData) return;

      const { graphConverter } = await import('../services/graphConverter');
      const newPreset = graphConverter.graphToPreset(this.filterGraphData, this.filterLibrary);
      this.currentPreset = newPreset;
      this.validateCurrentPreset();
      this.updateCommandPreview();
    },

    /**
     * 添加节点到图
     */
    addFilterNode(filterId: string, position?: { x: number; y: number }) {
      const filterDef = this.filterLibrary.find(f => f.id === filterId);
      if (!filterDef) return;

      // 保存前置状态
      const previousGraphData = this.filterGraphData
        ? JSON.parse(JSON.stringify(this.filterGraphData))
        : { nodes: [], edges: [] };

      const newNode: FilterNode = {
        id: `filter-${Date.now()}`,
        type: 'filter',
        position: position || { x: 0, y: 0 },
        data: {
          name: filterDef.name,
          label: filterDef.name,
          description: filterDef.description,
          icon: filterDef.icon,
          filterId: filterDef.id,
          filterType: filterDef.filterType,
          params: this.getDefaultParams(filterDef),
          paramDefinitions: filterDef.params,
          enabled: true
        }
      };

      if (!this.filterGraphData) {
        this.filterGraphData = { nodes: [], edges: [] };
      }
      this.filterGraphData.nodes.push(newNode);

      // 记录历史
      this.recordAddNode(
        previousGraphData,
        JSON.parse(JSON.stringify(this.filterGraphData)),
        newNode.id,
        newNode.data.name
      );
    },

    /**
     * 删除节点
     */
    removeFilterNode(nodeId: string) {
      if (!this.filterGraphData) return;

      // 保存前置状态
      const previousGraphData = JSON.parse(JSON.stringify(this.filterGraphData));

      // 获取要删除的节点信息
      const nodeToDelete = this.filterGraphData.nodes.find(n => n.id === nodeId);
      if (!nodeToDelete) return;

      // 获取要删除的相关连线
      const relatedEdgeIds = this.filterGraphData.edges
        .filter(e => e.source === nodeId || e.target === nodeId)
        .map(e => e.id);

      // 删除节点
      this.filterGraphData.nodes = this.filterGraphData.nodes.filter(n => n.id !== nodeId);

      // 删除相关连线
      this.filterGraphData.edges = this.filterGraphData.edges.filter(
        e => e.source !== nodeId && e.target !== nodeId
      );

      // 清除选中状态
      if (this.graphEditorState.selectedNodeId === nodeId) {
        this.graphEditorState.selectedNodeId = null;
      }

      // 记录历史
      this.recordRemoveNode(
        previousGraphData,
        JSON.parse(JSON.stringify(this.filterGraphData)),
        nodeId,
        nodeToDelete.data.name,
        relatedEdgeIds
      );
    },

    /**
     * 更新节点参数
     */
    updateFilterNodeParams(nodeId: string, params: Record<string, any>) {
      if (!this.filterGraphData) return;

      const node = this.filterGraphData.nodes.find(n => n.id === nodeId);
      if (!node) return;

      // 保存前置状态
      const previousGraphData = JSON.parse(JSON.stringify(this.filterGraphData));

      const oldParams = { ...node.data.params };

      // 更新参数
      node.data.params = { ...node.data.params, ...params };

      // 记录历史
      this.recordUpdateParams(
        previousGraphData,
        JSON.parse(JSON.stringify(this.filterGraphData)),
        nodeId,
        node.data.name,
        oldParams,
        params
      );
    },

    /**
     * 切换节点启用状态
     */
    toggleFilterNodeEnabled(nodeId: string) {
      if (!this.filterGraphData) return;

      const node = this.filterGraphData.nodes.find(n => n.id === nodeId);
      if (!node) return;

      // 保存前置状态
      const previousGraphData = JSON.parse(JSON.stringify(this.filterGraphData));

      const wasEnabled = node.data.enabled;

      // 切换状态
      node.data.enabled = !node.data.enabled;

      // 记录历史
      this.recordToggleEnabled(
        previousGraphData,
        JSON.parse(JSON.stringify(this.filterGraphData)),
        nodeId,
        node.data.name,
        wasEnabled
      );
    },

    /**
     * 连接节点
     */
    connectNodes(
      sourceId: string,
      targetId: string,
      sourceHandle?: string,
      targetHandle?: string
    ) {
      if (!this.filterGraphData) return;

      // 检查是否已存在连接
      const exists = this.filterGraphData.edges.some(
        e => e.source === sourceId && e.target === targetId
      );
      if (exists) return;

      // 保存前置状态
      const previousGraphData = JSON.parse(JSON.stringify(this.filterGraphData));

      const edgeId = `edge-${Date.now()}`;

      this.filterGraphData.edges.push({
        id: edgeId,
        source: sourceId,
        target: targetId,
        sourceHandle,
        targetHandle,
        animated: true
      });

      // 记录历史
      this.recordConnectNodes(
        previousGraphData,
        JSON.parse(JSON.stringify(this.filterGraphData)),
        edgeId,
        sourceId,
        targetId
      );
    },

    /**
     * 断开节点连接
     */
    disconnectNodes(edgeId: string) {
      if (!this.filterGraphData) return;

      // 保存前置状态
      const previousGraphData = JSON.parse(JSON.stringify(this.filterGraphData));

      // 获取要删除的边信息
      const edgeToDelete = this.filterGraphData.edges.find(e => e.id === edgeId);
      if (!edgeToDelete) return;

      const sourceId = edgeToDelete.source;
      const targetId = edgeToDelete.target;

      this.filterGraphData.edges = this.filterGraphData.edges.filter(e => e.id !== edgeId);

      // 清除选中状态
      if (this.graphEditorState.selectedEdgeId === edgeId) {
        this.graphEditorState.selectedEdgeId = null;
      }

      // 记录历史
      this.recordDisconnectNodes(
        previousGraphData,
        JSON.parse(JSON.stringify(this.filterGraphData)),
        edgeId,
        sourceId,
        targetId
      );
    },

    /**
     * 设置节点图数据
     */
    setFilterGraphData(graphData: FilterGraphData) {
      this.filterGraphData = graphData;
    },

    /**
     * 更新节点位置
     */
    updateFilterNodePosition(nodeId: string, position: { x: number; y: number }) {
      if (!this.filterGraphData) return;

      const node = this.filterGraphData.nodes.find(n => n.id === nodeId);
      if (!node) return;

      const oldPosition = { ...node.position };

      // 只有当位置真正改变时才记录
      if (oldPosition.x === position.x && oldPosition.y === position.y) {
        return;
      }

      // 保存前置状态
      const previousGraphData = JSON.parse(JSON.stringify(this.filterGraphData));

      // 更新位置
      node.position = position;

      // 记录历史
      this.recordMoveNode(
        previousGraphData,
        JSON.parse(JSON.stringify(this.filterGraphData)),
        nodeId,
        node.data.name,
        oldPosition,
        position
      );
    },

    /**
     * 选中节点
     */
    selectFilterNode(nodeId: string | null) {
      this.graphEditorState.selectedNodeId = nodeId;
      this.graphEditorState.selectedEdgeId = null;
    },

    /**
     * 选中边
     */
    selectFilterEdge(edgeId: string | null) {
      this.graphEditorState.selectedEdgeId = edgeId;
      this.graphEditorState.selectedNodeId = null;
    },

    /**
     * 切换到节点图视图
     */
    switchToFilterGraphView() {
      this.editorMode = 'graph';
    },

    /**
     * 切换到列表视图
     */
    switchToListView() {
      this.editorMode = 'list';
    },

    /**
     * 自动布局
     */
    async autoLayout(layoutMode: LayoutMode = 'hierarchical') {
      if (!this.filterGraphData) return;

      // 保存前置状态
      const previousGraphData = JSON.parse(JSON.stringify(this.filterGraphData));

      const { graphConverter } = await import('../services/graphConverter');
      this.filterGraphData = graphConverter.autoLayout(this.filterGraphData, layoutMode);

      // 记录历史
      this.recordAutoLayout(
        previousGraphData,
        JSON.parse(JSON.stringify(this.filterGraphData)),
        layoutMode
      );
    },

    /**
     * 验证节点图
     */
    async validateGraph() {
      if (!this.filterGraphData) return;

      const { graphConverter } = await import('../services/graphConverter');
      this.graphValidation = graphConverter.validateGraph(this.filterGraphData, this.filterLibrary);
    },

    /**
     * 生成滤镜链
     */
    async generateFilterChain(): Promise<FilterChainGenerationResult> {
      if (!this.filterGraphData) {
        return {
          success: false,
          errors: ['节点图数据为空']
        };
      }

      const { graphConverter } = await import('../services/graphConverter');
      return graphConverter.graphToFilterChain(this.filterGraphData, this.filterLibrary);
    },

    /**
     * 设置编辑器模式
     */
    setEditorMode(mode: EditorMode) {
      this.editorMode = mode;
    },

    /**
     * 更新视口
     */
    updateViewport(viewport: { x: number; y: number; zoom: number }) {
      this.graphEditorState.viewport = viewport;
    },

    /**
     * 更新滤镜库搜索
     */
    updateFilterSearch(query: string) {
      this.filterLibraryState.searchQuery = query;
    },

    /**
     * 更新滤镜库分类筛选
     */
    updateFilterCategory(category: FilterCategory | 'all') {
      this.filterLibraryState.selectedCategory = category;
    },

    /**
     * 加载滤镜库
     */
    async loadFilterLibrary() {
      const { FilterLibraryLoader } = await import('../services/filterLibraryLoader');
      const loader = new FilterLibraryLoader();

      this.filterLibraryState.loading = true;
      this.filterLibraryState.error = null;

      try {
        this.filterLibrary = await loader.loadFromJson('/src/ffmpeg/data/filters.json');
      } catch (error) {
        this.filterLibraryState.error = error instanceof Error ? error.message : '加载滤镜库失败';
      } finally {
        this.filterLibraryState.loading = false;
      }
    },

    /**
     * 获取滤镜的默认参数
     */
    getDefaultParams(filterDef: FilterDefinition): Record<string, any> {
      const params: Record<string, any> = {};
      for (const paramDef of filterDef.params) {
        params[paramDef.name] = paramDef.default;
      }
      return params;
    },

    // ==================== 历史记录 actions ====================

    /**
     * 初始化历史记录
     */
    initHistory() {
      if (this.filterGraphData) {
        this.historyService.setInitialSnapshot(this.filterGraphData);
      }
      this.updateHistoryState();
    },

    /**
     * 更新历史记录状态
     */
    updateHistoryState() {
      this.canUndo = this.historyService.canUndo();
      this.canRedo = this.historyService.canRedo();
      this.undoHistory = this.historyService.getUndoHistory();
      this.redoHistory = this.historyService.getRedoHistory();
    },

    /**
     * 记录添加节点
     */
    recordAddNode(
      previousGraphData: FilterGraphData,
      currentGraphData: FilterGraphData,
      nodeId: string,
      nodeName: string
    ) {
      this.historyService.recordAddNode(
        previousGraphData,
        currentGraphData,
        nodeId,
        nodeName
      );
      this.updateHistoryState();
    },

    /**
     * 记录删除节点
     */
    recordRemoveNode(
      previousGraphData: FilterGraphData,
      currentGraphData: FilterGraphData,
      nodeId: string,
      nodeName: string,
      relatedEdgeIds: string[]
    ) {
      this.historyService.recordRemoveNode(
        previousGraphData,
        currentGraphData,
        nodeId,
        nodeName,
        relatedEdgeIds
      );
      this.updateHistoryState();
    },

    /**
     * 记录连接节点
     */
    recordConnectNodes(
      previousGraphData: FilterGraphData,
      currentGraphData: FilterGraphData,
      edgeId: string,
      sourceNodeId: string,
      targetNodeId: string
    ) {
      this.historyService.recordConnectNodes(
        previousGraphData,
        currentGraphData,
        edgeId,
        sourceNodeId,
        targetNodeId
      );
      this.updateHistoryState();
    },

    /**
     * 记录断开连接
     */
    recordDisconnectNodes(
      previousGraphData: FilterGraphData,
      currentGraphData: FilterGraphData,
      edgeId: string,
      sourceNodeId: string,
      targetNodeId: string
    ) {
      this.historyService.recordDisconnectNodes(
        previousGraphData,
        currentGraphData,
        edgeId,
        sourceNodeId,
        targetNodeId
      );
      this.updateHistoryState();
    },

    /**
     * 记录移动节点
     */
    recordMoveNode(
      previousGraphData: FilterGraphData,
      currentGraphData: FilterGraphData,
      nodeId: string,
      nodeName: string,
      oldPosition: { x: number; y: number },
      newPosition: { x: number; y: number }
    ) {
      this.historyService.recordMoveNode(
        previousGraphData,
        currentGraphData,
        nodeId,
        nodeName,
        oldPosition,
        newPosition
      );
      this.updateHistoryState();
    },

    /**
     * 记录更新参数
     */
    recordUpdateParams(
      previousGraphData: FilterGraphData,
      currentGraphData: FilterGraphData,
      nodeId: string,
      nodeName: string,
      oldParams: Record<string, any>,
      newParams: Record<string, any>
    ) {
      this.historyService.recordUpdateParams(
        previousGraphData,
        currentGraphData,
        nodeId,
        nodeName,
        oldParams,
        newParams
      );
      this.updateHistoryState();
    },

    /**
     * 记录启用/禁用节点
     */
    recordToggleEnabled(
      previousGraphData: FilterGraphData,
      currentGraphData: FilterGraphData,
      nodeId: string,
      nodeName: string,
      wasEnabled: boolean
    ) {
      this.historyService.recordToggleEnabled(
        previousGraphData,
        currentGraphData,
        nodeId,
        nodeName,
        wasEnabled
      );
      this.updateHistoryState();
    },

    /**
     * 记录自动布局
     */
    recordAutoLayout(
      previousGraphData: FilterGraphData,
      currentGraphData: FilterGraphData,
      layoutMode: string
    ) {
      this.historyService.recordAutoLayout(
        previousGraphData,
        currentGraphData,
        layoutMode
      );
      this.updateHistoryState();
    },

    /**
     * 批量记录操作
     */
    recordBatch(
      description: string,
      previousGraphData: FilterGraphData,
      currentGraphData: FilterGraphData
    ) {
      this.historyService.recordBatch(
        description,
        previousGraphData,
        currentGraphData,
        this.graphEditorState.selectedNodeId,
        this.graphEditorState.selectedNodeId,
        this.graphEditorState.selectedEdgeId,
        this.graphEditorState.selectedEdgeId
      );
      this.updateHistoryState();
    },

    /**
     * 撤销操作
     */
    undo() {
      if (!this.canUndo) {
        console.warn('Cannot undo: no undo history available');
        return;
      }

      const result = this.historyService.undo();

      if (result.success && result.graphData) {
        // 恢复状态
        this.filterGraphData = result.graphData;

        // 恢复选中状态
        if (result.selectedNodeId !== undefined) {
          this.graphEditorState.selectedNodeId = result.selectedNodeId;
        }
        if (result.selectedEdgeId !== undefined) {
          this.graphEditorState.selectedEdgeId = result.selectedEdgeId;
        }

        // 验证节点图
        this.validateGraph();

        // 更新历史记录状态
        this.updateHistoryState();
      }
    },

    /**
     * 重做操作
     */
    redo() {
      if (!this.canRedo) {
        console.warn('Cannot redo: no redo history available');
        return;
      }

      const result = this.historyService.redo();

      if (result.success && result.graphData) {
        // 恢复状态
        this.filterGraphData = result.graphData;

        // 恢复选中状态
        if (result.selectedNodeId !== undefined) {
          this.graphEditorState.selectedNodeId = result.selectedNodeId;
        }
        if (result.selectedEdgeId !== undefined) {
          this.graphEditorState.selectedEdgeId = result.selectedEdgeId;
        }

        // 验证节点图
        this.validateGraph();

        // 更新历史记录状态
        this.updateHistoryState();
      }
    },

    /**
     * 清空历史记录
     */
    clearHistory() {
      this.historyService.clear();
      this.updateHistoryState();
    },

    /**
     * 优化历史记录内存
     */
    optimizeHistoryMemory() {
      this.historyService.optimizeMemory();
      this.updateHistoryState();
    },

    /**
     * 导出历史记录
     */
    exportHistory() {
      return this.historyService.exportHistory();
    },

    /**
     * 导入历史记录
     */
    importHistory(data: { undoStack: HistoryEntry[]; redoStack: HistoryEntry[] }) {
      this.historyService.importHistory(data);
      this.updateHistoryState();
    }
  }
});

/**
 * 创建默认预设
 */
function createDefaultPreset(): FFmpegPreset {
  return {
    output: {
      container: 'mp4',
      naming: {
        useAutoNaming: true,
        autoNamingOption: 0,
        prefix: '',
        suffix: 'encoded',
        customPattern: ''
      },
      location: ''
    },
    decoder: {
      decoder: 'auto',
      hwaccel: 'auto',
      hwaccelDevice: ''
    },
    video: {
      enabled: true,
      encoderCategory: 'h264',
      encoder: 'libx264',
      preset: 'medium',
      profile: 'high',
      level: '4.0',
      tune: '',
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
      keepSubtitleStreams: true,
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
