/**
 * HistoryService 单元测试
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { HistoryService, getHistoryService, resetHistoryService } from '../historyService';
import type { FilterGraphData, FilterNode } from '../../types/preset';

describe('HistoryService', () => {
  let historyService: HistoryService;
  let testGraphData: FilterGraphData;

  beforeEach(() => {
    // 重置服务
    historyService = new HistoryService({ maxHistorySize: 10 });

    // 创建测试用的节点图数据
    testGraphData = {
      nodes: [
        {
          id: 'node-1',
          type: 'filter',
          position: { x: 0, y: 0 },
          data: {
            name: 'Test Filter 1',
            label: 'Test Filter 1',
            icon: '🔧',
            enabled: true,
            params: { width: '1920', height: '1080' }
          }
        }
      ],
      edges: []
    };
  });

  describe('基本操作', () => {
    it('应该能够记录和执行撤销操作', () => {
      const previousData = JSON.parse(JSON.stringify(testGraphData));

      // 修改数据
      testGraphData.nodes.push({
        id: 'node-2',
        type: 'filter',
        position: { x: 100, y: 100 },
        data: {
          name: 'Test Filter 2',
          label: 'Test Filter 2',
          icon: '🔧',
          enabled: true,
          params: {}
        }
      });

      // 记录操作
      historyService.recordAddNode(
        previousData,
        testGraphData,
        'node-2',
        'Test Filter 2'
      );

      // 验证可以撤销
      expect(historyService.canUndo()).toBe(true);

      // 执行撤销
      const undoResult = historyService.undo();
      expect(undoResult.success).toBe(true);
      expect(undoResult.graphData?.nodes.length).toBe(1);
      expect(undoResult.graphData?.nodes[0].id).toBe('node-1');
    });

    it('应该能够记录和执行重做操作', () => {
      const previousData = JSON.parse(JSON.stringify(testGraphData));

      // 添加节点
      testGraphData.nodes.push({
        id: 'node-2',
        type: 'filter',
        position: { x: 100, y: 100 },
        data: {
          name: 'Test Filter 2',
          label: 'Test Filter 2',
          icon: '🔧',
          enabled: true,
          params: {}
        }
      });

      // 记录操作
      historyService.recordAddNode(
        previousData,
        testGraphData,
        'node-2',
        'Test Filter 2'
      );

      // 撤销
      historyService.undo();

      // 验证可以重做
      expect(historyService.canRedo()).toBe(true);

      // 执行重做
      const redoResult = historyService.redo();
      expect(redoResult.success).toBe(true);
      expect(redoResult.graphData?.nodes.length).toBe(2);
      expect(redoResult.graphData?.nodes[1].id).toBe('node-2');
    });

    it('应该在无法撤销时返回失败', () => {
      const result = historyService.undo();
      expect(result.success).toBe(false);
    });

    it('应该在无法重做时返回失败', () => {
      const result = historyService.redo();
      expect(result.success).toBe(false);
    });
  });

  describe('栈管理', () => {
    it('应该限制历史记录数量', () => {
      // 添加超过 maxHistorySize 的操作
      for (let i = 0; i < 15; i++) {
        const previousData = JSON.parse(JSON.stringify(testGraphData));
        testGraphData.nodes.push({
          id: `node-${i + 2}`,
          type: 'filter',
          position: { x: i * 100, y: 0 },
          data: {
            name: `Filter ${i + 2}`,
            label: `Filter ${i + 2}`,
            icon: '🔧',
            enabled: true,
            params: {}
          }
        });

        historyService.recordAddNode(
          previousData,
          testGraphData,
          `node-${i + 2}`,
          `Filter ${i + 2}`
        );
      }

      // 验证栈大小被限制
      expect(historyService.getUndoStackSize()).toBe(10);
    });

    it('应该在执行新操作时清空重做栈', () => {
      // 添加第一个操作
      const previousData1 = JSON.parse(JSON.stringify(testGraphData));
      testGraphData.nodes.push({
        id: 'node-2',
        type: 'filter',
        position: { x: 100, y: 0 },
        data: {
          name: 'Filter 2',
          label: 'Filter 2',
          icon: '🔧',
          enabled: true,
          params: {}
        }
      });
      historyService.recordAddNode(previousData1, testGraphData, 'node-2', 'Filter 2');

      // 撤销
      historyService.undo();

      // 验证有重做历史
      expect(historyService.canRedo()).toBe(true);

      // 添加新操作
      const previousData2 = JSON.parse(JSON.stringify(testGraphData));
      testGraphData.nodes.push({
        id: 'node-3',
        type: 'filter',
        position: { x: 200, y: 0 },
        data: {
          name: 'Filter 3',
          label: 'Filter 3',
          icon: '🔧',
          enabled: true,
          params: {}
        }
      });
      historyService.recordAddNode(previousData2, testGraphData, 'node-3', 'Filter 3');

      // 验证重做栈被清空
      expect(historyService.canRedo()).toBe(false);
    });

    it('应该正确计算栈大小', () => {
      expect(historyService.getUndoStackSize()).toBe(0);
      expect(historyService.getRedoStackSize()).toBe(0);

      const previousData = JSON.parse(JSON.stringify(testGraphData));
      testGraphData.nodes.push({
        id: 'node-2',
        type: 'filter',
        position: { x: 100, y: 0 },
        data: {
          name: 'Filter 2',
          label: 'Filter 2',
          icon: '🔧',
          enabled: true,
          params: {}
        }
      });
      historyService.recordAddNode(previousData, testGraphData, 'node-2', 'Filter 2');

      expect(historyService.getUndoStackSize()).toBe(1);

      historyService.undo();
      expect(historyService.getUndoStackSize()).toBe(0);
      expect(historyService.getRedoStackSize()).toBe(1);
    });
  });

  describe('历史记录管理', () => {
    it('应该能够获取撤销历史列表', () => {
      const previousData = JSON.parse(JSON.stringify(testGraphData));
      testGraphData.nodes.push({
        id: 'node-2',
        type: 'filter',
        position: { x: 100, y: 0 },
        data: {
          name: 'Filter 2',
          label: 'Filter 2',
          icon: '🔧',
          enabled: true,
          params: {}
        }
      });
      historyService.recordAddNode(previousData, testGraphData, 'node-2', 'Filter 2');

      const undoHistory = historyService.getUndoHistory();
      expect(undoHistory.length).toBe(1);
      expect(undoHistory[0].description).toBe('添加节点: Filter 2');
    });

    it('应该能够获取重做历史列表', () => {
      const previousData = JSON.parse(JSON.stringify(testGraphData));
      testGraphData.nodes.push({
        id: 'node-2',
        type: 'filter',
        position: { x: 100, y: 0 },
        data: {
          name: 'Filter 2',
          label: 'Filter 2',
          icon: '🔧',
          enabled: true,
          params: {}
        }
      });
      historyService.recordAddNode(previousData, testGraphData, 'node-2', 'Filter 2');

      historyService.undo();

      const redoHistory = historyService.getRedoHistory();
      expect(redoHistory.length).toBe(1);
      expect(redoHistory[0].description).toBe('添加节点: Filter 2');
    });

    it('应该能够清空历史记录', () => {
      const previousData = JSON.parse(JSON.stringify(testGraphData));
      testGraphData.nodes.push({
        id: 'node-2',
        type: 'filter',
        position: { x: 100, y: 0 },
        data: {
          name: 'Filter 2',
          label: 'Filter 2',
          icon: '🔧',
          enabled: true,
          params: {}
        }
      });
      historyService.recordAddNode(previousData, testGraphData, 'node-2', 'Filter 2');

      expect(historyService.canUndo()).toBe(true);

      historyService.clear();

      expect(historyService.canUndo()).toBe(false);
      expect(historyService.canRedo()).toBe(false);
    });

    it('应该能够优化内存', () => {
      // 添加多个操作
      for (let i = 0; i < 8; i++) {
        const previousData = JSON.parse(JSON.stringify(testGraphData));
        testGraphData.nodes.push({
          id: `node-${i + 2}`,
          type: 'filter',
          position: { x: i * 100, y: 0 },
          data: {
            name: `Filter ${i + 2}`,
            label: `Filter ${i + 2}`,
            icon: '🔧',
            enabled: true,
            params: {}
          }
        });
        historyService.recordAddNode(
          previousData,
          testGraphData,
          `node-${i + 2}`,
          `Filter ${i + 2}`
        );
      }

      // 执行一些撤销
      historyService.undo();
      historyService.undo();

      // 优化内存
      historyService.optimizeMemory(3, 2);

      // 验证栈大小
      expect(historyService.getUndoStackSize()).toBeLessThanOrEqual(3);
      expect(historyService.getRedoStackSize()).toBeLessThanOrEqual(2);
    });
  });

  describe('统计信息', () => {
    it('应该正确返回统计信息', () => {
      const previousData = JSON.parse(JSON.stringify(testGraphData));
      testGraphData.nodes.push({
        id: 'node-2',
        type: 'filter',
        position: { x: 100, y: 0 },
        data: {
          name: 'Filter 2',
          label: 'Filter 2',
          icon: '🔧',
          enabled: true,
          params: {}
        }
      });
      historyService.recordAddNode(previousData, testGraphData, 'node-2', 'Filter 2');

      const stats = historyService.getStats();

      expect(stats.undoCount).toBe(1);
      expect(stats.redoCount).toBe(0);
      expect(stats.totalCount).toBe(1);
      expect(stats.newestEntry).toBeDefined();
      expect(stats.memoryUsageEstimate).toBeGreaterThan(0);
    });
  });

  describe('导入/导出', () => {
    it('应该能够导出历史记录', () => {
      const previousData = JSON.parse(JSON.stringify(testGraphData));
      testGraphData.nodes.push({
        id: 'node-2',
        type: 'filter',
        position: { x: 100, y: 0 },
        data: {
          name: 'Filter 2',
          label: 'Filter 2',
          icon: '🔧',
          enabled: true,
          params: {}
        }
      });
      historyService.recordAddNode(previousData, testGraphData, 'node-2', 'Filter 2');

      const exported = historyService.exportHistory();

      expect(exported.undoStack.length).toBe(1);
      expect(exported.redoStack.length).toBe(0);
      expect(exported.timestamp).toBeDefined();
    });

    it('应该能够导入历史记录', () => {
      const previousData = JSON.parse(JSON.stringify(testGraphData));
      testGraphData.nodes.push({
        id: 'node-2',
        type: 'filter',
        position: { x: 100, y: 0 },
        data: {
          name: 'Filter 2',
          label: 'Filter 2',
          icon: '🔧',
          enabled: true,
          params: {}
        }
      });
      historyService.recordAddNode(previousData, testGraphData, 'node-2', 'Filter 2');

      const exported = historyService.exportHistory();

      // 创建新服务并导入
      const newService = new HistoryService();
      newService.importHistory(exported);

      expect(newService.canUndo()).toBe(true);
      expect(newService.getUndoStackSize()).toBe(1);
    });
  });

  describe('单例模式', () => {
    it('应该返回相同的实例', () => {
      const instance1 = getHistoryService();
      const instance2 = getHistoryService();

      expect(instance1).toBe(instance2);
    });

    it('应该能够重置服务', () => {
      const instance1 = getHistoryService();

      const previousData = JSON.parse(JSON.stringify(testGraphData));
      testGraphData.nodes.push({
        id: 'node-2',
        type: 'filter',
        position: { x: 100, y: 0 },
        data: {
          name: 'Filter 2',
          label: 'Filter 2',
          icon: '🔧',
          enabled: true,
          params: {}
        }
      });
      instance1.recordAddNode(previousData, testGraphData, 'node-2', 'Filter 2');

      expect(instance1.canUndo()).toBe(true);

      // 重置服务
      const instance2 = resetHistoryService();

      expect(instance2.canUndo()).toBe(false);
      expect(instance2).not.toBe(instance1);
    });
  });
});
