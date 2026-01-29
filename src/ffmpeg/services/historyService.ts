/**
 * 历史记录服务
 * 实现节点图编辑的撤销/重做功能
 */

import type { FilterGraphData, FilterNode, FilterEdge } from '../types/preset';

/**
 * 历史操作类型
 */
export type HistoryActionType =
  | 'add_node'           // 添加节点
  | 'remove_node'        // 删除节点
  | 'connect_nodes'      // 连接节点
  | 'disconnect_nodes'   // 断开连接
  | 'move_node'          // 移动节点
  | 'update_params'      // 更新参数
  | 'toggle_enabled'      // 启用/禁用节点
  | 'auto_layout'        // 自动布局
  | 'batch';              // 批量操作

/**
 * 历史记录条目
 */
export interface HistoryEntry {
  id: string;                    // 唯一标识
  type: HistoryActionType;       // 操作类型
  timestamp: number;             // 时间戳
  description: string;           // 操作描述（用于 UI 显示）

  // 前置状态（用于撤销）
  previousState: {
    graphData: FilterGraphData;
    selectedNodeId?: string | null;
    selectedEdgeId?: string | null;
  };

  // 后置状态（用于重做）
  nextState: {
    graphData: FilterGraphData;
    selectedNodeId?: string | null;
    selectedEdgeId?: string | null;
  };

  // 操作详情（可选，用于调试或高级功能）
  details?: {
    nodeId?: string;
    edgeId?: string;
    oldParams?: Record<string, any>;
    newParams?: Record<string, any>;
    oldPosition?: { x: number; y: number };
    newPosition?: { x: number; y: number };
  };
}

/**
 * 历史记录服务配置
 */
interface HistoryServiceConfig {
  maxHistorySize?: number;        // 最大历史记录数量
  enableAutoSave?: boolean;       // 是否自动保存
  saveInterval?: number;          // 自动保存间隔（毫秒）
}

/**
 * 历史记录服务类
 */
export class HistoryService {
  private undoStack: HistoryEntry[] = [];
  private redoStack: HistoryEntry[] = [];
  private config: Required<HistoryServiceConfig>;
  private currentSnapshot?: FilterGraphData;

  constructor(config: HistoryServiceConfig = {}) {
    this.config = {
      maxHistorySize: config.maxHistorySize ?? 100,
      enableAutoSave: config.enableAutoSave ?? false,
      saveInterval: config.saveInterval ?? 1000
    };
  }

  /**
   * 开始一个新操作（保存当前状态为前置状态）
   */
  beginAction(type: HistoryActionType, description: string): string {
    const actionId = `action-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    return actionId;
  }

  /**
   * 结束操作并保存历史记录
   */
  endAction(
    actionId: string,
    type: HistoryActionType,
    description: string,
    previousGraphData: FilterGraphData,
    currentGraphData: FilterGraphData,
    previousSelectedNodeId: string | null = null,
    currentSelectedNodeId: string | null = null,
    previousSelectedEdgeId: string | null = null,
    currentSelectedEdgeId: string | null = null,
    details?: HistoryEntry['details']
  ): void {
    // 清空重做栈
    this.redoStack = [];

    // 创建历史记录
    const entry: HistoryEntry = {
      id: actionId,
      type,
      timestamp: Date.now(),
      description,
      previousState: {
        graphData: JSON.parse(JSON.stringify(previousGraphData)),
        selectedNodeId: previousSelectedNodeId,
        selectedEdgeId: previousSelectedEdgeId
      },
      nextState: {
        graphData: JSON.parse(JSON.stringify(currentGraphData)),
        selectedNodeId: currentSelectedNodeId,
        selectedEdgeId: currentSelectedEdgeId
      },
      details
    };

    // 添加到撤销栈
    this.undoStack.push(entry);

    // 限制历史记录数量
    if (this.undoStack.length > this.config.maxHistorySize) {
      this.undoStack.shift();
    }

    // 更新当前快照
    this.currentSnapshot = JSON.parse(JSON.stringify(currentGraphData));
  }

  /**
   * 记录添加节点操作
   */
  recordAddNode(
    previousGraphData: FilterGraphData,
    currentGraphData: FilterGraphData,
    nodeId: string,
    nodeName: string
  ): void {
    const actionId = this.beginAction('add_node', `添加节点: ${nodeName}`);

    this.endAction(
      actionId,
      'add_node',
      `添加节点: ${nodeName}`,
      previousGraphData,
      currentGraphData,
      null,
      nodeId,
      null,
      null,
      { nodeId }
    );
  }

  /**
   * 记录删除节点操作
   */
  recordRemoveNode(
    previousGraphData: FilterGraphData,
    currentGraphData: FilterGraphData,
    nodeId: string,
    nodeName: string,
    relatedEdgeIds: string[]
  ): void {
    const actionId = this.beginAction('remove_node', `删除节点: ${nodeName}`);

    this.endAction(
      actionId,
      'remove_node',
      `删除节点: ${nodeName}`,
      previousGraphData,
      currentGraphData,
      nodeId,
      null,
      relatedEdgeIds[0] || null,
      null,
      { nodeId }
    );
  }

  /**
   * 记录连接节点操作
   */
  recordConnectNodes(
    previousGraphData: FilterGraphData,
    currentGraphData: FilterGraphData,
    edgeId: string,
    sourceNodeId: string,
    targetNodeId: string
  ): void {
    const actionId = this.beginAction('connect_nodes', `连接节点`);

    this.endAction(
      actionId,
      'connect_nodes',
      `连接节点`,
      previousGraphData,
      currentGraphData,
      targetNodeId,
      targetNodeId,
      null,
      edgeId,
      { edgeId }
    );
  }

  /**
   * 记录断开连接操作
   */
  recordDisconnectNodes(
    previousGraphData: FilterGraphData,
    currentGraphData: FilterGraphData,
    edgeId: string,
    sourceNodeId: string,
    targetNodeId: string
  ): void {
    const actionId = this.beginAction('disconnect_nodes', `断开连接`);

    this.endAction(
      actionId,
      'disconnect_nodes',
      `断开连接`,
      previousGraphData,
      currentGraphData,
      targetNodeId,
      targetNodeId,
      edgeId,
      null,
      { edgeId }
    );
  }

  /**
   * 记录移动节点操作
   */
  recordMoveNode(
    previousGraphData: FilterGraphData,
    currentGraphData: FilterGraphData,
    nodeId: string,
    nodeName: string,
    oldPosition: { x: number; y: number },
    newPosition: { x: number; y: number }
  ): void {
    const actionId = this.beginAction('move_node', `移动节点: ${nodeName}`);

    this.endAction(
      actionId,
      'move_node',
      `移动节点: ${nodeName}`,
      previousGraphData,
      currentGraphData,
      nodeId,
      nodeId,
      null,
      null,
      {
        nodeId,
        oldPosition,
        newPosition
      }
    );
  }

  /**
   * 记录更新参数操作
   */
  recordUpdateParams(
    previousGraphData: FilterGraphData,
    currentGraphData: FilterGraphData,
    nodeId: string,
    nodeName: string,
    oldParams: Record<string, any>,
    newParams: Record<string, any>
  ): void {
    const actionId = this.beginAction('update_params', `更新参数: ${nodeName}`);

    this.endAction(
      actionId,
      'update_params',
      `更新参数: ${nodeName}`,
      previousGraphData,
      currentGraphData,
      nodeId,
      nodeId,
      null,
      null,
      {
        nodeId,
        oldParams,
        newParams
      }
    );
  }

  /**
   * 记录启用/禁用节点操作
   */
  recordToggleEnabled(
    previousGraphData: FilterGraphData,
    currentGraphData: FilterGraphData,
    nodeId: string,
    nodeName: string,
    wasEnabled: boolean
  ): void {
    const actionId = this.beginAction('toggle_enabled', `${wasEnabled ? '禁用' : '启用'}节点: ${nodeName}`);

    this.endAction(
      actionId,
      'toggle_enabled',
      `${wasEnabled ? '禁用' : '启用'}节点: ${nodeName}`,
      previousGraphData,
      currentGraphData,
      nodeId,
      nodeId,
      null,
      null,
      { nodeId }
    );
  }

  /**
   * 记录自动布局操作
   */
  recordAutoLayout(
    previousGraphData: FilterGraphData,
    currentGraphData: FilterGraphData,
    layoutMode: string
  ): void {
    const actionId = this.beginAction('auto_layout', `自动布局: ${layoutMode}`);

    this.endAction(
      actionId,
      'auto_layout',
      `自动布局: ${layoutMode}`,
      previousGraphData,
      currentGraphData,
      null,
      null,
      null,
      null
    );
  }

  /**
   * 批量记录多个操作
   */
  recordBatch(
    description: string,
    previousGraphData: FilterGraphData,
    currentGraphData: FilterGraphData,
    previousSelectedNodeId: string | null = null,
    currentSelectedNodeId: string | null = null,
    previousSelectedEdgeId: string | null = null,
    currentSelectedEdgeId: string | null = null
  ): void {
    const actionId = this.beginAction('batch', description);

    this.endAction(
      actionId,
      'batch',
      description,
      previousGraphData,
      currentGraphData,
      previousSelectedNodeId,
      currentSelectedNodeId,
      previousSelectedEdgeId,
      currentSelectedEdgeId
    );
  }

  /**
   * 撤销操作
   */
  undo(): {
    success: boolean;
    graphData?: FilterGraphData;
    selectedNodeId?: string | null;
    selectedEdgeId?: string | null;
    description?: string;
  } {
    if (!this.canUndo()) {
      return { success: false };
    }

    const entry = this.undoStack.pop()!;

    // 将当前状态移到重做栈
    this.redoStack.push(entry);

    // 返回前置状态
    return {
      success: true,
      graphData: entry.previousState.graphData,
      selectedNodeId: entry.previousState.selectedNodeId,
      selectedEdgeId: entry.previousState.selectedEdgeId,
      description: entry.description
    };
  }

  /**
   * 重做操作
   */
  redo(): {
    success: boolean;
    graphData?: FilterGraphData;
    selectedNodeId?: string | null;
    selectedEdgeId?: string | null;
    description?: string;
  } {
    if (!this.canRedo()) {
      return { success: false };
    }

    const entry = this.redoStack.pop()!;

    // 将重做的操作移回撤销栈
    this.undoStack.push(entry);

    // 返回后置状态
    return {
      success: true,
      graphData: entry.nextState.graphData,
      selectedNodeId: entry.nextState.selectedNodeId,
      selectedEdgeId: entry.nextState.selectedEdgeId,
      description: entry.description
    };
  }

  /**
   * 是否可以撤销
   */
  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  /**
   * 是否可以重做
   */
  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  /**
   * 获取撤销栈大小
   */
  getUndoStackSize(): number {
    return this.undoStack.length;
  }

  /**
   * 获取重做栈大小
   */
  getRedoStackSize(): number {
    return this.redoStack.length;
  }

  /**
   * 获取撤销历史列表（用于显示历史记录面板）
   */
  getUndoHistory(): Array<{ id: string; description: string; timestamp: number }> {
    return this.undoStack.map(entry => ({
      id: entry.id,
      description: entry.description,
      timestamp: entry.timestamp
    })).reverse(); // 最新的在前
  }

  /**
   * 获取重做历史列表
   */
  getRedoHistory(): Array<{ id: string; description: string; timestamp: number }> {
    return this.redoStack.map(entry => ({
      id: entry.id,
      description: entry.description,
      timestamp: entry.timestamp
    }));
  }

  /**
   * 清空历史记录
   */
  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
    this.currentSnapshot = undefined;
  }

  /**
   * 设置初始快照（用于加载节点图时）
   */
  setInitialSnapshot(graphData: FilterGraphData): void {
    this.currentSnapshot = JSON.parse(JSON.stringify(graphData));
    this.clear();
  }

  /**
   * 获取当前快照
   */
  getCurrentSnapshot(): FilterGraphData | undefined {
    return this.currentSnapshot;
  }

  /**
   * 优化内存：清理旧的历史记录
   */
  optimizeMemory(maxUndoSize?: number, maxRedoSize?: number): void {
    const targetUndoSize = maxUndoSize ?? Math.floor(this.config.maxHistorySize / 2);
    const targetRedoSize = maxRedoSize ?? Math.floor(this.config.maxHistorySize / 4);

    // 清理撤销栈
    while (this.undoStack.length > targetUndoSize) {
      this.undoStack.shift();
    }

    // 清理重做栈
    while (this.redoStack.length > targetRedoSize) {
      this.redoStack.shift();
    }
  }

  /**
   * 导出历史记录（用于调试或导出功能）
   */
  exportHistory(): {
    undoStack: HistoryEntry[];
    redoStack: HistoryEntry[];
    timestamp: number;
  } {
    return {
      undoStack: JSON.parse(JSON.stringify(this.undoStack)),
      redoStack: JSON.parse(JSON.stringify(this.redoStack)),
      timestamp: Date.now()
    };
  }

  /**
   * 导入历史记录（用于恢复功能）
   */
  importHistory(data: {
    undoStack: HistoryEntry[];
    redoStack: HistoryEntry[];
  }): void {
    this.undoStack = JSON.parse(JSON.stringify(data.undoStack));
    this.redoStack = JSON.parse(JSON.stringify(data.redoStack));
  }

  /**
   * 获取历史记录统计信息
   */
  getStats(): {
    undoCount: number;
    redoCount: number;
    totalCount: number;
    oldestEntry?: HistoryEntry;
    newestEntry?: HistoryEntry;
    memoryUsageEstimate: number;  // 估算的内存使用（字节）
  } {
    const totalCount = this.undoStack.length + this.redoStack.length;

    // 估算内存使用（JSON 字符串长度）
    const memoryUsageEstimate =
      JSON.stringify(this.undoStack).length +
      JSON.stringify(this.redoStack).length;

    return {
      undoCount: this.undoStack.length,
      redoCount: this.redoStack.length,
      totalCount,
      oldestEntry: this.undoStack[0],
      newestEntry: this.undoStack[this.undoStack.length - 1],
      memoryUsageEstimate
    };
  }
}

// 创建全局单例实例
let historyServiceInstance: HistoryService | null = null;

/**
 * 获取历史记录服务单例
 */
export function getHistoryService(): HistoryService {
  if (!historyServiceInstance) {
    historyServiceInstance = new HistoryService();
  }
  return historyServiceInstance;
}

/**
 * 重置历史记录服务（用于测试或重新初始化）
 */
export function resetHistoryService(config?: HistoryServiceConfig): HistoryService {
  historyServiceInstance = new HistoryService(config);
  return historyServiceInstance;
}
