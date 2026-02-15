/**
 * 示例库类型定义
 */

/**
 * 示例数据
 */
export interface ExampleData {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: ExampleCategory;
  filterComplex: string;
  nodes: ExampleNode[];
  edges: ExampleEdge[];
}

/**
 * 示例分类
 */
export type ExampleCategory =
  | 'basic'
  | 'transform'
  | 'color'
  | 'audio'
  | 'subtitle'
  | 'overlay'
  | 'advanced';

/**
 * 示例节点
 */
export interface ExampleNode {
  id: string;
  type: 'input' | 'filter' | 'output';
  position: {
    x: number;
    y: number;
  };
  data: {
    name: string;
    streamType?: 'v' | 'a';
    label?: string;
    filterId?: string;
    icon?: string;
    enabled?: boolean;
    params?: Record<string, any>;
  };
}

/**
 * 示例边
 */
export interface ExampleEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
}

/**
 * 示例库数据结构
 */
export interface ExamplesData {
  version: string;
  lastUpdated: string;
  examples: ExampleData[];
}
