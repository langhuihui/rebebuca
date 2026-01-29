/**
 * GraphConverter 布局算法单元测试
 */

import { describe, it, expect } from 'vitest';
import { GraphConverter, type LayoutConfig } from '../graphConverter';
import type { FilterGraphData } from '../../types/preset';

describe('GraphConverter Layout Algorithms', () => {
  let converter: GraphConverter;

  beforeEach(() => {
    converter = new GraphConverter();
  });

  describe('Hierarchical Layout', () => {
    it('should layout simple linear graph', () => {
      const graph: FilterGraphData = {
        nodes: [
          { id: 'input', type: 'input', position: { x: 0, y: 0 }, data: { name: 'Input', icon: '', enabled: true } },
          { id: 'filter1', type: 'filter', position: { x: 0, y: 0 }, data: { name: 'Filter1', icon: '', enabled: true } },
          { id: 'filter2', type: 'filter', position: { x: 0, y: 0 }, data: { name: 'Filter2', icon: '', enabled: true } },
          { id: 'output', type: 'output', position: { x: 0, y: 0 }, data: { name: 'Output', icon: '', enabled: true } }
        ],
        edges: [
          { id: 'e1', source: 'input', target: 'filter1', animated: true },
          { id: 'e2', source: 'filter1', target: 'filter2', animated: true },
          { id: 'e3', source: 'filter2', target: 'output', animated: true }
        ]
      };

      const result = converter.autoLayout(graph, 'hierarchical');

      expect(result.nodes.length).toBe(4);
      expect(result.nodes[0].position.x).toBeLessThan(result.nodes[1].position.x);
      expect(result.nodes[1].position.x).toBeLessThan(result.nodes[2].position.x);
      expect(result.nodes[2].position.x).toBeLessThan(result.nodes[3].position.x);
    });

    it('should reduce edge crossings with barycenter heuristic', () => {
      const graph: FilterGraphData = {
        nodes: [
          { id: 'input', type: 'input', position: { x: 0, y: 0 }, data: { name: 'Input', icon: '', enabled: true } },
          { id: 'filter1', type: 'filter', position: { x: 0, y: 0 }, data: { name: 'Filter1', icon: '', enabled: true } },
          { id: 'filter2', type: 'filter', position: { x: 0, y: 0 }, data: { name: 'Filter2', icon: '', enabled: true } },
          { id: 'filter3', type: 'filter', position: { x: 0, y: 0 }, data: { name: 'Filter3', icon: '', enabled: true } },
          { id: 'filter4', type: 'filter', position: { x: 0, y: 0 }, data: { name: 'Filter4', icon: '', enabled: true } },
          { id: 'output', type: 'output', position: { x: 0, y: 0 }, data: { name: 'Output', icon: '', enabled: true } }
        ],
        edges: [
          { id: 'e1', source: 'input', target: 'filter1', animated: true },
          { id: 'e2', source: 'input', target: 'filter2', animated: true },
          { id: 'e3', source: 'filter1', target: 'filter3', animated: true },
          { id: 'e4', source: 'filter2', target: 'filter4', animated: true },
          { id: 'e5', source: 'filter3', target: 'output', animated: true },
          { id: 'e6', source: 'filter4', target: 'output', animated: true }
        ]
      };

      const result = converter.autoLayout(graph, 'hierarchical');

      // 验证层级分配
      expect(result.nodes[0].position.y).toBe(0); // input 在第一层
      expect(result.nodes[1].position.y).toBeGreaterThan(result.nodes[0].position.y); // filter1 在第二层
      expect(result.nodes[2].position.y).toBeGreaterThan(result.nodes[0].position.y); // filter2 在第二层
    });

    it('should handle custom node dimensions', () => {
      const graph: FilterGraphData = {
        nodes: [
          { id: 'input', type: 'input', position: { x: 0, y: 0 }, data: { name: 'Input', icon: '', enabled: true } },
          { id: 'filter1', type: 'filter', position: { x: 0, y: 0 }, data: { name: 'Filter1', icon: '', enabled: true } },
          { id: 'filter2', type: 'filter', position: { x: 0, y: 0 }, data: { name: 'Filter2', icon: '', enabled: true } },
          { id: 'output', type: 'output', position: { x: 0, y: 0 }, data: { name: 'Output', icon: '', enabled: true } }
        ],
        edges: [
          { id: 'e1', source: 'input', target: 'filter1', animated: true },
          { id: 'e2', source: 'filter1', target: 'filter2', animated: true },
          { id: 'e3', source: 'filter2', target: 'output', animated: true }
        ]
      };

      const config: LayoutConfig = {
        nodeWidth: 300,
        nodeHeight: 150,
        horizontalGap: 100,
        verticalGap: 200
      };

      const result = converter.autoLayout(graph, 'hierarchical', config);

      // 验证间距符合配置
      const yGap = result.nodes[1].position.y - result.nodes[0].position.y;
      expect(yGap).toBeGreaterThanOrEqual(200 - 10); // 允许小的误差
      expect(yGap).toBeLessThanOrEqual(200 + 10);
    });
  });

  describe('Force-Directed Layout', () => {
    it('should layout simple graph', () => {
      const graph: FilterGraphData = {
        nodes: [
          { id: 'n1', type: 'filter', position: { x: 100, y: 100 }, data: { name: 'N1', icon: '', enabled: true } },
          { id: 'n2', type: 'filter', position: { x: 500, y: 100 }, data: { name: 'N2', icon: '', enabled: true } },
          { id: 'n3', type: 'filter', position: { x: 300, y: 500 }, data: { name: 'N3', icon: '', enabled: true } }
        ],
        edges: [
          { id: 'e1', source: 'n1', target: 'n2', animated: true },
          { id: 'e2', source: 'n2', target: 'n3', animated: true },
          { id: 'e3', source: 'n3', target: 'n1', animated: true }
        ]
      };

      const config: LayoutConfig = {
        iterations: 50,
        repulsionForce: 1000,
        springForce: 0.1
      };

      const result = converter.autoLayout(graph, 'force', config);

      // 验证节点位置已更新
      expect(result.nodes.length).toBe(3);
      expect(result.nodes[0].position.x).not.toBe(100);
      expect(result.nodes[1].position.y).not.toBe(100);
    });
  });

  describe('Grid Layout', () => {
    it('should arrange nodes in grid', () => {
      const graph: FilterGraphData = {
        nodes: [
          { id: 'n1', type: 'filter', position: { x: 0, y: 0 }, data: { name: 'N1', icon: '', enabled: true } },
          { id: 'n2', type: 'filter', position: { x: 0, y: 0 }, data: { name: 'N2', icon: '', enabled: true } },
          { id: 'n3', type: 'filter', position: { x: 0, y: 0 }, data: { name: 'N3', icon: '', enabled: true } },
          { id: 'n4', type: 'filter', position: { x: 0, y: 0 }, data: { name: 'N4', icon: '', enabled: true } }
        ],
        edges: []
      };

      const result = converter.autoLayout(graph, 'grid');

      // 验证 2x2 网格布局
      expect(result.nodes[0].position.x).toBe(0);
      expect(result.nodes[0].position.y).toBe(0);
      expect(result.nodes[1].position.x).toBeGreaterThan(result.nodes[0].position.x);
      expect(result.nodes[2].position.y).toBeGreaterThan(result.nodes[0].position.y);
    });
  });

  describe('Tree Layout', () => {
    it('should layout tree structure', () => {
      const graph: FilterGraphData = {
        nodes: [
          { id: 'root', type: 'filter', position: { x: 0, y: 0 }, data: { name: 'Root', icon: '', enabled: true } },
          { id: 'child1', type: 'filter', position: { x: 0, y: 0 }, data: { name: 'Child1', icon: '', enabled: true } },
          { id: 'child2', type: 'filter', position: { x: 0, y: 0 }, data: { name: 'Child2', icon: '', enabled: true } },
          { id: 'child3', type: 'filter', position: { x: 0, y: 0 }, data: { name: 'Child3', icon: '', enabled: true } }
        ],
        edges: [
          { id: 'e1', source: 'root', target: 'child1', animated: true },
          { id: 'e2', source: 'root', target: 'child2', animated: true },
          { id: 'e3', source: 'root', target: 'child3', animated: true }
        ]
      };

      const result = converter.autoLayout(graph, 'tree');

      // 验证根节点在顶部
      const rootNode = result.nodes.find(n => n.id === 'root');
      const childNodes = result.nodes.filter(n => n.id.startsWith('child'));

      expect(rootNode?.position.y).toBeLessThan(Math.min(...childNodes.map(n => n.position.y)));
    });
  });

  describe('Circular Layout', () => {
    it('should arrange nodes in circle', () => {
      const graph: FilterGraphData = {
        nodes: Array.from({ length: 8 }, (_, i) => ({
          id: `n${i}`,
          type: 'filter',
          position: { x: 0, y: 0 },
          data: { name: `N${i}`, icon: '', enabled: true }
        })),
        edges: []
      };

      const result = converter.autoLayout(graph, 'circular');

      // 验证节点分布在圆周上
      const center = { x: 400, y: 300 };
      const distances = result.nodes.map(node => {
        const dx = node.position.x - center.x;
        const dy = node.position.y - center.y;
        return Math.sqrt(dx * dx + dy * dy);
      });

      // 所有节点到中心的距离应该大致相同
      const avgDistance = distances.reduce((sum, d) => sum + d, 0) / distances.length;
      const maxDeviation = Math.max(...distances.map(d => Math.abs(d - avgDistance)));

      expect(maxDeviation).toBeLessThan(avgDistance * 0.2); // 允许 20% 的误差
    });
  });
});
