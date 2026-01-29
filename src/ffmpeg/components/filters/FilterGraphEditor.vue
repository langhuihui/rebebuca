<template>
  <div class="filter-graph-editor">
    <!-- 工具栏 -->
    <GraphToolbar
      :auto-layout="store.graphEditorState.autoLayout"
      :snap-to-grid="store.graphEditorState.snapToGrid"
      :show-mini-map="store.graphEditorState.showMiniMap"
      @layout="onLayout"
      @toggle-auto-layout="toggleAutoLayout"
      @toggle-snap-to-grid="toggleSnapToGrid"
      @toggle-mini-map="toggleMiniMap"
      @fit-view="onFitView"
      @zoom-in="onZoomIn"
      @zoom-out="onZoomOut"
      @reset-view="onResetView"
      @undo="onUndo"
      @redo="onRedo"
    />

    <div class="editor-container">
      <!-- 左侧：滤镜库面板 + 示例库面板 (Tab 切换) -->
      <div class="left-panel">
        <!-- Tab 切换 -->
        <div class="panel-tabs">
          <n-button
            text
            :type="leftPanelTab === 'library' ? 'primary' : 'default'"
            size="small"
            @click="leftPanelTab = 'library'"
          >
            <n-icon size="16" style="margin-right: 4px;">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
                <line x1="8" y1="21" x2="16" y2="21"/>
                <line x1="12" y1="17" x2="12" y2="21"/>
              </svg>
            </n-icon>
            滤镜库
          </n-button>
          <n-button
            text
            :type="leftPanelTab === 'examples' ? 'primary' : 'default'"
            size="small"
            @click="leftPanelTab = 'examples'"
          >
            <n-icon size="16" style="margin-right: 4px;">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
              </svg>
            </n-icon>
            示例库
          </n-button>
        </div>

        <!-- 滤镜库面板 -->
        <FilterLibraryPanel
          v-show="leftPanelTab === 'library'"
          :filters="filteredFilters"
          :loading="store.filterLibraryState.loading"
          :error="store.filterLibraryState.error"
          @add-filter="onAddFilter"
          @search="store.updateFilterSearch"
          @filter-by-category="store.updateFilterCategory"
        />

        <!-- 示例库面板 -->
        <ExampleLibrary
          v-show="leftPanelTab === 'examples'"
          :examples="examples"
          @select="onLoadExample"
        />
      </div>

      <!-- 中间：图编辑画布 -->
      <div class="canvas-wrapper">
        <VueFlow
          v-model:nodes="nodes"
          v-model:edges="edges"
          :min-zoom="0.25"
          :max-zoom="2"
          :default-zoom="store.graphEditorState.viewport.zoom"
          :default-position="[
            store.graphEditorState.viewport.x,
            store.graphEditorState.viewport.y
          ]"
          :node-types="nodeTypes"
          :edge-types="edgeTypes"
          :fit-view-on-init="false"
          :snap-to-grid="store.graphEditorState.snapToGrid"
          :snap-grid="[20, 20]"
          @connect="onConnect"
          @node-click="onNodeClick"
          @edge-click="onEdgeClick"
          @pane-click="onPaneClick"
          @node-drag-stop="onNodeDragStop"
          @move-end="onViewportChange"
          @zoom="onViewportChange"
          @delete="onDelete"
        >
          <Background />
          <Controls />
          <MiniMap v-if="store.graphEditorState.showMiniMap" />
        </VueFlow>

        <!-- 画布提示 -->
        <div v-if="nodes.length === 0" class="canvas-hint">
          <n-empty description="从左侧拖拽滤镜到画布开始编辑">
            <template #icon>
              <n-icon size="48" color="var(--n-text-color-3)">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
                  <line x1="8" y1="21" x2="16" y2="21"/>
                  <line x1="12" y1="17" x2="12" y2="21"/>
                </svg>
              </n-icon>
            </template>
          </n-empty>
        </div>

        <!-- 快捷键提示 -->
        <div class="shortcuts-hint">
          <n-text depth="3" style="font-size: 12px">
            Delete/Backspace: 删除选中 | Ctrl+Z: 撤销 | Ctrl+Y: 重做
          </n-text>
        </div>
      </div>

      <!-- 右侧：节点属性面板 -->
      <NodePropertyPanel
        v-if="selectedNode"
        class="property-panel"
        :node="selectedNode"
        @update:params="onUpdateNodeParams"
        @update:enabled="onToggleNodeEnabled"
        @remove="onRemoveNode"
      />

      <!-- 验证结果提示 -->
      <div v-if="!store.graphValidation.valid" class="validation-errors">
        <n-alert
          v-for="error in store.graphValidation.errors"
          :key="error.nodeId"
          type="error"
          :bordered="false"
          size="small"
        >
          {{ error.message }}
        </n-alert>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, onMounted, onUnmounted, shallowRef, markRaw } from 'vue';
import { VueFlow } from '@vue-flow/core';
import { Background } from '@vue-flow/background';
import { Controls } from '@vue-flow/controls';
import { MiniMap } from '@vue-flow/minimap';
import type { Node, Edge, Connection } from '@vue-flow/core';
import '@vue-flow/core/dist/style.css';
import '@vue-flow/core/dist/theme-default.css';
import { useFFmpegParamsStore } from '@/ffmpeg/stores/ffmpegParams';
import GraphToolbar from './GraphToolbar.vue';
import FilterLibraryPanel from './FilterLibraryPanel.vue';
import NodePropertyPanel from './NodePropertyPanel.vue';
import ExampleLibrary from './ExampleLibrary.vue';
import { InputNode, FilterNode, OutputNode } from '../nodes';
import { NEmpty, NText, NAlert, NButton, NIcon, useMessage } from 'naive-ui';
import type { FilterDefinition, FilterGraphData } from '@/ffmpeg/types/preset';
import { LayoutMode } from '@/ffmpeg/types/preset';
import { useHistoryShortcuts } from '@/ffmpeg/composables/useHistoryShortcuts';
import { examplesData } from '@/ffmpeg/data';

const message = useMessage();
const store = useFFmpegParamsStore();

// 使用撤销/重做快捷键
const { undo, redo } = useHistoryShortcuts();

// 节点类型注册 (使用 shallowRef 和 markRaw 避免深度响应式)
const nodeTypes = shallowRef(markRaw({
  input: InputNode,
  filter: FilterNode,
  output: OutputNode
}));

// 边类型注册 (使用 markRaw)
const edgeTypes = shallowRef(markRaw({}));

// 响应式数据
const nodes = ref<Node[]>([]);
const edges = ref<Edge[]>([]);
const leftPanelTab = ref<'library' | 'examples'>('library');
const examples = markRaw(examplesData.examples);

// 计算属性
const filteredFilters = computed(() => store.filteredFilters);
const selectedNode = computed(() => store.selectedNode);

// 性能优化: 使用防抖同步到 store
let syncTimeout: number | null = null;
const debouncedSync = () => {
  if (syncTimeout !== null) {
    clearTimeout(syncTimeout);
  }
  syncTimeout = setTimeout(() => {
    if (store.filterGraphData) {
      store.setFilterGraphData({
        nodes: nodes.value as any[],
        edges: edges.value as any[],
        viewport: {
          x: store.graphEditorState.viewport.x,
          y: store.filterGraphData.viewport?.y || 0,
          zoom: store.graphEditorState.viewport.zoom
        }
      });
      store.validateGraph();
    }
  }, 100); // 100ms 防抖
};

// 同步 store 数据到本地
watch(() => store.filterGraphData, (graphData) => {
  if (graphData) {
    nodes.value = graphData.nodes as Node[];
    edges.value = graphData.edges as Edge[];
  } else {
    nodes.value = [];
    edges.value = [];
  }
}, { immediate: true, deep: true });

// 监听本地变化同步到 store (使用防抖优化)
watch([nodes, edges], () => {
  debouncedSync();
}, { deep: true });

// 生命周期
onMounted(async () => {
  await store.loadFilterLibrary();
  setupKeyboardShortcuts();
});

onUnmounted(() => {
  removeKeyboardShortcuts();
  if (syncTimeout !== null) {
    clearTimeout(syncTimeout);
  }
});

// ========== 事件处理 ==========

/**
 * 连接节点
 */
const onConnect = (connection: Connection) => {
  store.connectNodes(
    connection.source!,
    connection.target!,
    connection.sourceHandle,
    connection.targetHandle
  );
};

/**
 * 点击节点
 */
const onNodeClick = (_event: any, node: Node) => {
  store.selectFilterNode(node.id);
};

/**
 * 点击边
 */
const onEdgeClick = (_event: any, edge: Edge) => {
  store.selectFilterEdge(edge.id);
};

/**
 * 点击画布空白处
 */
const onPaneClick = () => {
  store.selectFilterNode(null);
  store.selectFilterEdge(null);
};

/**
 * 节点拖拽结束
 */
const onNodeDragStop = (_event: any, node: Node) => {
  if (!node?.id || !node?.position) return;
  store.updateFilterNodePosition(node.id, node.position);
};

/**
 * 视口变化
 */
const onViewportChange = (event: any) => {
  // Vue Flow 可能传递不同格式的参数，需要安全处理
  const transform = event?.transform || event;
  if (!transform) return;

  store.updateViewport({
    x: transform.x ?? 0,
    y: transform.y ?? 0,
    zoom: transform.k ?? transform.zoom ?? 1
  });
};

/**
 * 删除操作
 */
const onDelete = () => {
  if (store.graphEditorState.selectedNodeId) {
    store.removeFilterNode(store.graphEditorState.selectedNodeId);
    message.success('节点已删除');
  } else if (store.graphEditorState.selectedEdgeId) {
    store.disconnectNodes(store.graphEditorState.selectedEdgeId);
    message.success('连线已删除');
  }
};

/**
 * 添加滤镜
 */
const onAddFilter = (filter: FilterDefinition) => {
  store.addFilterNode(filter.id);
  message.success(`已添加滤镜: ${filter.name}`);
};

/**
 * 更新节点参数
 */
const onUpdateNodeParams = (nodeId: string, params: Record<string, any>) => {
  store.updateFilterNodeParams(nodeId, params);
};

/**
 * 切换节点启用状态
 */
const onToggleNodeEnabled = (nodeId: string, enabled: boolean) => {
  store.toggleFilterNodeEnabled(nodeId);
};

/**
 * 删除节点
 */
const onRemoveNode = (nodeId: string) => {
  store.removeFilterNode(nodeId);
  message.success('节点已删除');
};

/**
 * 加载示例
 */
const onLoadExample = (example: any) => {
  const exampleData: FilterGraphData = {
    nodes: example.nodes || [],
    edges: example.edges || []
  };
  store.setFilterGraphData(exampleData);
  message.success('示例已加载');
};

// ========== 工具栏操作 ==========

/**
 * 自动布局
 */
const onLayout = (mode: LayoutMode) => {
  store.autoLayout(mode);
  message.success(`已应用${mode}布局`);
};

/**
 * 切换自动布局
 */
const toggleAutoLayout = (value: boolean) => {
  store.graphEditorState.autoLayout = value;
  if (value) {
    store.autoLayout('hierarchical');
    message.success('已启用自动布局');
  } else {
    message.info('已禁用自动布局');
  }
};

/**
 * 切换网格吸附
 */
const toggleSnapToGrid = (value: boolean) => {
  store.graphEditorState.snapToGrid = value;
  message.info(value ? '已启用网格吸附' : '已禁用网格吸附');
};

/**
 * 切换小地图
 */
const toggleMiniMap = (value: boolean) => {
  store.graphEditorState.showMiniMap = value;
  message.info(value ? '已显示小地图' : '已隐藏小地图');
};

/**
 * 适配视图
 */
const onFitView = () => {
  // TODO: 调用 @xyflow 的 fitView 方法
  message.info('视图已适配');
};

/**
 * 放大
 */
const onZoomIn = () => {
  // TODO: 实现放大逻辑
  message.info('已放大');
};

/**
 * 缩小
 */
const onZoomOut = () => {
  // TODO: 实现缩小逻辑
  message.info('已缩小');
};

/**
 * 重置视图
 */
const onResetView = () => {
  store.updateViewport({ x: 0, y: 0, zoom: 1 });
  message.info('视图已重置');
};

/**
 * 撤销操作
 */
const onUndo = () => {
  if (store.canUndo) {
    store.undo();
    message.info('已撤销');
  }
};

/**
 * 重做操作
 */
const onRedo = () => {
  if (store.canRedo) {
    store.redo();
    message.info('已重做');
  }
};

// ========== 快捷键支持 ==========

const setupKeyboardShortcuts = () => {
  document.addEventListener('keydown', handleKeydown);
};

const removeKeyboardShortcuts = () => {
  document.removeEventListener('keydown', handleKeydown);
};

const handleKeydown = (event: KeyboardEvent) => {
  // Delete/Backspace: 删除选中
  if ((event.key === 'Delete' || event.key === 'Backspace') && !event.metaKey && !event.ctrlKey) {
    const activeElement = document.activeElement;
    const isInputActive = activeElement instanceof HTMLInputElement ||
                         activeElement instanceof HTMLTextAreaElement ||
                         activeElement?.hasAttribute('contenteditable');

    if (!isInputActive) {
      event.preventDefault();
      onDelete();
    }
  }

  // Ctrl+Z: 撤销 (预留接口)
  if (event.ctrlKey && event.key === 'z' && !event.metaKey) {
    event.preventDefault();
    message.info('撤销功能 (预留接口)');
  }
};
</script>

<style scoped>
.filter-graph-editor {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  background-color: var(--n-color);
}

.editor-container {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.left-panel {
  width: 280px;
  border-right: 1px solid var(--n-border-color);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
}

.panel-tabs {
  display: flex;
  gap: 8px;
  padding: 12px 12px 8px 12px;
  border-bottom: 1px solid var(--n-border-color);
}

.canvas-wrapper {
  flex: 1;
  position: relative;
  overflow: hidden;
}

.canvas-hint {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  text-align: center;
  z-index: 1;
  pointer-events: none;
}

.shortcuts-hint {
  position: absolute;
  bottom: 12px;
  right: 12px;
  z-index: 1;
  background-color: var(--n-color-embedded);
  padding: 8px 12px;
  border-radius: 4px;
  border: 1px solid var(--n-border-color);
}

.property-panel {
  width: 320px;
  border-left: 1px solid var(--n-border-color);
  overflow-y: auto;
  flex-shrink: 0;
}

.validation-errors {
  position: absolute;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  max-width: 600px;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* VueFlow 样式覆盖 */
:deep(.vue-flow) {
  background-color: var(--n-color-embedded);
}

:deep(.vue-flow__background) {
  background-color: var(--n-color-embedded);
}

:deep(.vue-flow__minimap) {
  background-color: var(--n-color);
  border: 1px solid var(--n-border-color);
}

:deep(.vue-flow__minimap-mask) {
  fill: var(--n-primary-color);
  opacity: 0.2;
}

:deep(.vue-flow__controls) {
  background-color: var(--n-color);
  border: 1px solid var(--n-border-color);
}

:deep(.vue-flow__controls-button) {
  background-color: var(--n-color-embedded);
  border-bottom: 1px solid var(--n-border-color);
  color: var(--n-text-color);
}

:deep(.vue-flow__controls-button:hover) {
  background-color: var(--n-primary-color-hover);
}

:deep(.vue-flow__edge-path) {
  stroke: var(--n-text-color-3);
  stroke-width: 2;
}

:deep(.vue-flow__edge.selected .vue-flow__edge-path) {
  stroke: var(--n-primary-color);
  stroke-width: 3;
}

:deep(.vue-flow__edge.animated .vue-flow__edge-path) {
  stroke-dasharray: 5;
  animation: dashdraw 0.5s linear infinite;
}

@keyframes dashdraw {
  from {
    stroke-dashoffset: 10;
  }
  to {
    stroke-dashoffset: 0;
  }
}

/* 全局覆盖 vue-flow 默认节点样式，移除白色背景 */
:deep(.vue-flow__node-input),
:deep(.vue-flow__node-filter),
:deep(.vue-flow__node-output),
:deep(.vue-flow__node) {
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
  padding: 0 !important;
}

:deep(.vue-flow__node-input.selected),
:deep(.vue-flow__node-filter.selected),
:deep(.vue-flow__node-output.selected),
:deep(.vue-flow__node.selected) {
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
}
</style>
