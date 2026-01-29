/**
 * GraphConverter 服务单元测试
 */

import { describe, it, expect } from 'vitest';
import { GraphConverter } from './graphConverter';
import type { FFmpegPreset, FilterGraphData, FilterDefinition } from '../types/preset';

// 模拟滤镜库数据
const mockFilterLibrary: FilterDefinition[] = [
  {
    id: 'scale',
    name: '缩放',
    category: 'transform',
    description: '调整视频分辨率',
    icon: '📐',
    filterType: 'video',
    inputPorts: ['v'],
    outputPorts: ['v'],
    params: [
      {
        name: 'width',
        label: '宽度',
        type: 'string',
        default: '1920',
        required: true
      },
      {
        name: 'height',
        label: '高度',
        type: 'string',
        default: '1080',
        required: true
      },
      {
        name: 'flags',
        label: '缩放算法',
        type: 'select',
        default: 'bicubic',
        required: false,
        options: [
          { label: '双三次插值', value: 'bicubic' },
          { label: '双线性插值', value: 'bilinear' }
        ]
      }
    ]
  },
  {
    id: 'crop',
    name: '裁剪',
    category: 'basic',
    description: '裁剪视频画面',
    icon: '✂️',
    filterType: 'video',
    inputPorts: ['v'],
    outputPorts: ['v'],
    params: [
      {
        name: 'w',
        label: '宽度',
        type: 'string',
        default: 'iw',
        required: true
      },
      {
        name: 'h',
        label: '高度',
        type: 'string',
        default: 'ih',
        required: true
      },
      {
        name: 'x',
        label: 'X 坐标',
        type: 'string',
        default: '0',
        required: false
      },
      {
        name: 'y',
        label: 'Y 坐标',
        type: 'string',
        default: '0',
        required: false
      }
    ]
  },
  {
    id: 'fps',
    name: '帧率',
    category: 'basic',
    description: '设置输出视频帧率',
    icon: '🔄',
    filterType: 'video',
    inputPorts: ['v'],
    outputPorts: ['v'],
    params: [
      {
        name: 'fps',
        label: '目标帧率',
        type: 'string',
        default: '30',
        required: true
      },
      {
        name: 'round',
        label: '舍入方式',
        type: 'select',
        default: 'near',
        required: false,
        options: [
          { label: '就近舍入', value: 'near' },
          { label: '向下舍入', value: 'down' }
        ]
      }
    ]
  }
];

describe('GraphConverter', () => {
  const converter = new GraphConverter();

  describe('presetToGraph', () => {
    it('应该将包含视频滤镜的 preset 转换为节点图', () => {
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
        filters: {
          scale: {
            enabled: true,
            width: '1920',
            height: '1080',
            keepAspect: true,
            algorithm: 'bicubic'
          },
          fps: {
            enabled: true,
            fps: '30',
            mode: 0
          }
        },
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

      const graphData = converter.presetToGraph(preset, mockFilterLibrary);

      expect(graphData.nodes).toBeDefined();
      expect(graphData.nodes.length).toBeGreaterThan(0);
      expect(graphData.edges).toBeDefined();

      // 验证输入节点存在
      const videoInputNode = graphData.nodes.find(n => n.id === 'input-video');
      expect(videoInputNode).toBeDefined();
      expect(videoInputNode?.type).toBe('input');
      expect(videoInputNode?.data.streamType).toBe('v');

      // 验证滤镜节点存在
      const scaleNode = graphData.nodes.find(n => n.data.filterId === 'scale');
      expect(scaleNode).toBeDefined();
      expect(scaleNode?.type).toBe('filter');
      expect(scaleNode?.data.enabled).toBe(true);
      expect(scaleNode?.data.params?.width).toBe('1920');
      expect(scaleNode?.data.params?.height).toBe('1080');

      const fpsNode = graphData.nodes.find(n => n.data.filterId === 'fps');
      expect(fpsNode).toBeDefined();
      expect(fpsNode?.type).toBe('filter');
      expect(fpsNode?.data.enabled).toBe(true);
    });

    it('应该正确处理未启用任何滤镜的 preset', () => {
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

      const graphData = converter.presetToGraph(preset, mockFilterLibrary);

      expect(graphData.nodes).toBeDefined();
      // 应该只包含输入节点
      const filterNodes = graphData.nodes.filter(n => n.type === 'filter');
      expect(filterNodes.length).toBe(0);
    });
  });

  describe('validateGraph', () => {
    it('应该验证有效的节点图', () => {
      const graphData: FilterGraphData = {
        nodes: [
          {
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
          },
          {
            id: 'filter-scale-1',
            type: 'filter',
            position: { x: 300, y: 0 },
            data: {
              name: '缩放',
              label: '缩放',
              description: '调整视频分辨率',
              icon: '📐',
              enabled: true,
              filterId: 'scale',
              filterType: 'video',
              params: {
                width: '1920',
                height: '1080',
                flags: 'bicubic'
              },
              paramDefinitions: mockFilterLibrary[0].params
            }
          }
        ],
        edges: [
          {
            id: 'edge-1',
            source: 'input-video',
            target: 'filter-scale-1',
            sourceHandle: 'v',
            targetHandle: 'v',
            animated: true
          }
        ]
      };

      const result = converter.validateGraph(graphData, mockFilterLibrary);

      expect(result.valid).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    it('应该检测到循环依赖', () => {
      const graphData: FilterGraphData = {
        nodes: [
          {
            id: 'node-1',
            type: 'filter',
            position: { x: 0, y: 0 },
            data: {
              name: '节点1',
              label: '节点1',
              icon: '📦',
              enabled: true,
              filterId: 'scale',
              filterType: 'video',
              params: { width: '1920', height: '1080' },
              paramDefinitions: mockFilterLibrary[0].params
            }
          },
          {
            id: 'node-2',
            type: 'filter',
            position: { x: 300, y: 0 },
            data: {
              name: '节点2',
              label: '节点2',
              icon: '📦',
              enabled: true,
              filterId: 'fps',
              filterType: 'video',
              params: { fps: '30' },
              paramDefinitions: mockFilterLibrary[2].params
            }
          }
        ],
        edges: [
          {
            id: 'edge-1',
            source: 'node-1',
            target: 'node-2',
            animated: true
          },
          {
            id: 'edge-2',
            source: 'node-2',
            target: 'node-1',
            animated: true
          }
        ]
      };

      const result = converter.validateGraph(graphData, mockFilterLibrary);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].type).toBe('cycle');
    });

    it('应该检测到未连接的孤立节点', () => {
      const graphData: FilterGraphData = {
        nodes: [
          {
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
          },
          {
            id: 'filter-scale-1',
            type: 'filter',
            position: { x: 300, y: 0 },
            data: {
              name: '缩放',
              label: '缩放',
              description: '调整视频分辨率',
              icon: '📐',
              enabled: true,
              filterId: 'scale',
              filterType: 'video',
              params: { width: '1920', height: '1080' },
              paramDefinitions: mockFilterLibrary[0].params
            }
          }
        ],
        edges: [
          {
            id: 'edge-1',
            source: 'input-video',
            target: 'filter-scale-1',
            animated: true
          }
        ]
      };

      // 添加一个未连接的节点
      graphData.nodes.push({
        id: 'filter-crop-1',
        type: 'filter',
        position: { x: 600, y: 0 },
        data: {
          name: '裁剪',
          label: '裁剪',
          description: '裁剪视频画面',
          icon: '✂️',
          enabled: true,
          filterId: 'crop',
          filterType: 'video',
          params: { w: '1920', h: '1080' },
          paramDefinitions: mockFilterLibrary[1].params
        }
      });

      const result = converter.validateGraph(graphData, mockFilterLibrary);

      expect(result.warnings.length).toBeGreaterThan(0);
      const orphanWarning = result.warnings.find(w => w.type === 'orphan_node');
      expect(orphanWarning).toBeDefined();
    });
  });

  describe('graphToFilterChain', () => {
    it('应该生成有效的 filter_complex 字符串', () => {
      const graphData: FilterGraphData = {
        nodes: [
          {
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
          },
          {
            id: 'filter-scale-1',
            type: 'filter',
            position: { x: 300, y: 0 },
            data: {
              name: '缩放',
              label: '缩放',
              description: '调整视频分辨率',
              icon: '📐',
              enabled: true,
              filterId: 'scale',
              filterType: 'video',
              params: { width: '1920', height: '1080', flags: 'bicubic' },
              paramDefinitions: mockFilterLibrary[0].params
            }
          }
        ],
        edges: [
          {
            id: 'edge-1',
            source: 'input-video',
            target: 'filter-scale-1',
            animated: true
          }
        ]
      };

      const result = converter.graphToFilterChain(graphData, mockFilterLibrary);

      expect(result.success).toBe(true);
      expect(result.filterComplex).toBeDefined();
      expect(result.filterComplex).toContain('scale');
      expect(result.filterComplex).toContain('width=1920');
      expect(result.filterComplex).toContain('height=1080');
      expect(result.streamMaps).toBeDefined();
      expect(result.streamMaps!.length).toBeGreaterThan(0);
    });
  });

  describe('autoLayout', () => {
    it('应该对节点图进行分层布局', () => {
      const graphData: FilterGraphData = {
        nodes: [
          {
            id: 'node-1',
            type: 'filter',
            position: { x: 0, y: 0 },
            data: {
              name: '节点1',
              label: '节点1',
              icon: '📦',
              enabled: true,
              filterId: 'scale',
              filterType: 'video',
              params: { width: '1920', height: '1080' },
              paramDefinitions: mockFilterLibrary[0].params
            }
          },
          {
            id: 'node-2',
            type: 'filter',
            position: { x: 0, y: 0 },
            data: {
              name: '节点2',
              label: '节点2',
              icon: '📦',
              enabled: true,
              filterId: 'fps',
              filterType: 'video',
              params: { fps: '30' },
              paramDefinitions: mockFilterLibrary[2].params
            }
          },
          {
            id: 'node-3',
            type: 'filter',
            position: { x: 0, y: 0 },
            data: {
              name: '节点3',
              label: '节点3',
              icon: '📦',
              enabled: true,
              filterId: 'crop',
              filterType: 'video',
              params: { w: '1920', h: '1080' },
              paramDefinitions: mockFilterLibrary[1].params
            }
          }
        ],
        edges: [
          {
            id: 'edge-1',
            source: 'node-1',
            target: 'node-2',
            animated: true
          },
          {
            id: 'edge-2',
            source: 'node-2',
            target: 'node-3',
            animated: true
          }
        ]
      };

      const result = converter.autoLayout(graphData, 'hierarchical');

      expect(result.nodes).toBeDefined();
      expect(result.nodes.length).toBe(3);

      // 验证节点按层级排列
      const node1Y = result.nodes.find(n => n.id === 'node-1')?.position.y || 0;
      const node2Y = result.nodes.find(n => n.id === 'node-2')?.position.y || 0;
      const node3Y = result.nodes.find(n => n.id === 'node-3')?.position.y || 0;

      expect(node1Y).toBeLessThan(node2Y);
      expect(node2Y).toBeLessThan(node3Y);
    });

    it('应该对节点图进行圆形布局', () => {
      const graphData: FilterGraphData = {
        nodes: [
          {
            id: 'node-1',
            type: 'filter',
            position: { x: 0, y: 0 },
            data: {
              name: '节点1',
              label: '节点1',
              icon: '📦',
              enabled: true,
              filterId: 'scale',
              filterType: 'video',
              params: { width: '1920', height: '1080' },
              paramDefinitions: mockFilterLibrary[0].params
            }
          },
          {
            id: 'node-2',
            type: 'filter',
            position: { x: 0, y: 0 },
            data: {
              name: '节点2',
              label: '节点2',
              icon: '📦',
              enabled: true,
              filterId: 'fps',
              filterType: 'video',
              params: { fps: '30' },
              paramDefinitions: mockFilterLibrary[2].params
            }
          }
        ],
        edges: []
      };

      const result = converter.autoLayout(graphData, 'circular');

      expect(result.nodes).toBeDefined();
      expect(result.nodes.length).toBe(2);

      // 验证节点被放置在圆形上
      const node1 = result.nodes.find(n => n.id === 'node-1');
      const node2 = result.nodes.find(n => n.id === 'node-2');

      expect(node1).toBeDefined();
      expect(node2).toBeDefined();
      expect(node1?.position.x).not.toBe(node2?.position.x);
      expect(node1?.position.y).not.toBe(node2?.position.y);
    });
  });
});
