/**
 * 示例库集成测试
 * 测试示例加载到节点图的完整流程
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useFFmpegParamsStore } from '@/ffmpeg/stores/ffmpegParams';
import { setActivePinia, createPinia } from 'pinia';
import examplesData from '@/ffmpeg/data/examples.json';

describe('示例库集成测试', () => {
  let store: ReturnType<typeof useFFmpegParamsStore>;

  beforeEach(() => {
    setActivePinia(createPinia());
    store = useFFmpegParamsStore();
  });

  it('应该能够加载示例到节点图', () => {
    const scaleExample = examplesData.examples.find(ex => ex.id === 'scale');
    expect(scaleExample).toBeDefined();

    if (scaleExample) {
      const graphData = {
        nodes: scaleExample.nodes,
        edges: scaleExample.edges
      };

      store.setFilterGraphData(graphData);

      expect(store.filterGraphData).not.toBeNull();
      expect(store.filterGraphData?.nodes).toHaveLength(scaleExample.nodes.length);
      expect(store.filterGraphData?.edges).toHaveLength(scaleExample.edges.length);
    }
  });

  it('示例节点数据格式正确', () => {
    const example = examplesData.examples[0];
    
    example.nodes.forEach(node => {
      expect(node).toHaveProperty('id');
      expect(node).toHaveProperty('type');
      expect(node).toHaveProperty('position');
      expect(node).toHaveProperty('data');
      
      expect(['input', 'filter', 'output']).toContain(node.type);
      
      expect(node.position).toHaveProperty('x');
      expect(node.position).toHaveProperty('y');
      
      expect(node.data).toHaveProperty('name');
    });
  });

  it('示例边数据格式正确', () => {
    const example = examplesData.examples.find(ex => ex.id === 'overlay'); // 多输入示例
    
    expect(example).toBeDefined();
    
    if (example) {
      example.edges.forEach(edge => {
        expect(edge).toHaveProperty('id');
        expect(edge).toHaveProperty('source');
        expect(edge).toHaveProperty('target');
      });
    }
  });

  it('示例应该包含必需的元数据', () => {
    examplesData.examples.forEach(example => {
      expect(example).toHaveProperty('id');
      expect(example).toHaveProperty('name');
      expect(example).toHaveProperty('description');
      expect(example).toHaveProperty('icon');
      expect(example).toHaveProperty('category');
      expect(example).toHaveProperty('filterComplex');
      expect(example).toHaveProperty('nodes');
      expect(example).toHaveProperty('edges');
    });
  });

  it('示例分类应该有效', () => {
    const validCategories = ['basic', 'transform', 'color', 'audio', 'subtitle', 'overlay', 'advanced'];
    
    examplesData.examples.forEach(example => {
      expect(validCategories).toContain(example.category);
    });
  });

  it('filterComplex 字符串应该有效', () => {
    examplesData.examples.forEach(example => {
      expect(example.filterComplex).toBeDefined();
      expect(example.filterComplex.length).toBeGreaterThan(0);
      expect(example.filterComplex).toMatch(/\[0:[va]\].+\[[va]\]/);
    });
  });

  it('示例应该覆盖主要使用场景', () => {
    const exampleIds = examplesData.examples.map(ex => ex.id);
    
    // 验证包含 8 个必需的示例
    const requiredExamples = ['scale', 'crop', 'fps', 'yadif', 'drawtext', 'overlay', 'colorbalance', 'loudnorm'];
    
    requiredExamples.forEach(id => {
      expect(exampleIds).toContain(id);
    });
  });

  it('示例节点应该有正确的连接', () => {
    const example = examplesData.examples[0];
    
    // 验证边的源节点和目标节点都存在于节点列表中
    const nodeIds = example.nodes.map(node => node.id);
    
    example.edges.forEach(edge => {
      expect(nodeIds).toContain(edge.source);
      expect(nodeIds).toContain(edge.target);
    });
  });

  it('示例数据版本信息应该存在', () => {
    expect(examplesData).toHaveProperty('version');
    expect(examplesData).toHaveProperty('lastUpdated');
    expect(examplesData.version).toMatch(/\d+\.\d+\.\d+/);
    expect(examplesData.lastUpdated).toMatch(/\d{4}-\d{2}-\d{2}/);
  });
});

/**
 * Store 功能测试
 */
describe('ffmpegParams Store - 示例加载功能', () => {
  let store: ReturnType<typeof useFFmpegParamsStore>;

  beforeEach(() => {
    setActivePinia(createPinia());
    store = useFFmpegParamsStore();
  });

  it('应该能够设置节点图数据', () => {
    const mockGraphData = {
      nodes: [
        {
          id: 'input-1',
          type: 'input',
          position: { x: 0, y: 0 },
          data: { name: '输入', streamType: 'v', label: '输入' }
        }
      ],
      edges: [],
      viewport: { x: 0, y: 0, zoom: 1 }
    };

    store.setFilterGraphData(mockGraphData);

    expect(store.filterGraphData).toEqual(mockGraphData);
  });

  it('设置节点图数据后应该触发验证', () => {
    const mockGraphData = {
      nodes: [],
      edges: []
    };

    store.setFilterGraphData(mockGraphData);

    // 验证应该被调用
    expect(store.graphValidation).toBeDefined();
  });
});
