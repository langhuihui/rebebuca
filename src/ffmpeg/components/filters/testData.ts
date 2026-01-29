/**
 * NodePropertyPanel 组件测试示例数据
 *
 * 用于演示增强后的参数编辑面板功能，包括:
 * - 多种参数类型支持
 * - 参数验证
 * - 参数分组
 * - 参数预设
 */

import type { FilterNode } from '@/ffmpeg/types/preset';

/**
 * 创建测试节点示例
 */
export function createTestNode(): FilterNode {
  return {
    id: 'test-filter-node',
    type: 'filter',
    position: { x: 100, y: 100 },
    data: {
      name: 'scale',
      label: '缩放滤镜',
      description: '调整视频分辨率，支持多种缩放算法',
      icon: '📐',
      enabled: true,
      filterId: 'scale',
      filterType: 'video',
      params: {
        width: '1920',
        height: '1080',
        flags: 'bicubic',
        force_original_aspect_ratio: 'decrease',
        interl: 0,
        force_divisible_by: 2
      },
      paramDefinitions: [
        {
          name: 'width',
          label: '宽度',
          type: 'size',
          default: '1920',
          required: true,
          group: 'basic',
          description: '目标宽度，支持像素值或表达式（如 -2 表示自动保持宽高比，iw 表示输入宽度）',
          unit: 'px'
        },
        {
          name: 'height',
          label: '高度',
          type: 'size',
          default: '1080',
          required: true,
          group: 'basic',
          description: '目标高度，支持像素值或表达式（如 -2 表示自动保持宽高比，ih 表示输入高度）',
          unit: 'px'
        },
        {
          name: 'flags',
          label: '缩放算法',
          type: 'select',
          default: 'bicubic',
          required: false,
          group: 'advanced',
          description: '选择缩放算法',
          options: [
            { label: '双三次插值 (推荐)', value: 'bicubic', description: '质量较好，速度适中' },
            { label: '双线性插值', value: 'bilinear', description: '速度快，质量一般' },
            { label: 'Lanczos', value: 'lanczos', description: '质量最好，速度较慢' },
            { label: '双线性快速', value: 'fast_bilinear', description: '最快，质量较低' },
            { label: '双三次快速', value: 'fast_bicubic', description: '速度较快' }
          ]
        },
        {
          name: 'force_original_aspect_ratio',
          label: '保持宽高比',
          type: 'select',
          default: null,
          required: false,
          group: 'advanced',
          description: '强制保持原始宽高比',
          options: [
            { label: '不强制', value: null },
            { label: '减小尺寸', value: 'decrease', description: '在需要减小尺寸时保持比例' },
            { label: '增大尺寸', value: 'increase', description: '在需要增大尺寸时保持比例' }
          ]
        },
        {
          name: 'interl',
          label: '隔行处理',
          type: 'boolean',
          default: false,
          required: false,
          group: 'advanced',
          description: '是否对隔行视频进行处理'
        },
        {
          name: 'force_divisible_by',
          label: '整除约束',
          type: 'int',
          default: 1,
          required: false,
          group: 'quality',
          min: 1,
          max: 16,
          description: '强制尺寸可被该值整除（如某些编码器要求宽度为 2 的倍数）'
        }
      ]
    }
  };
}

/**
 * 创建带有多种参数类型的测试节点
 */
export function createMultiTypeTestNode(): FilterNode {
  return {
    id: 'test-multitype-node',
    type: 'filter',
    position: { x: 100, y: 100 },
    data: {
      name: 'drawtext',
      label: '绘制文字',
      description: '在视频上绘制文字水印或字幕',
      icon: '📝',
      enabled: true,
      filterId: 'drawtext',
      filterType: 'video',
      params: {
        text: 'Hello World',
        fontfile: '/path/to/font.ttf',
        fontsize: 24,
        fontcolor: '#FFFFFF',
        x: 100,
        y: 50,
        alpha: 1.0,
        shadowcolor: '#000000',
        shadowx: 2,
        shadowy: 2,
        enable: 'between(t,0,5)'
      },
      paramDefinitions: [
        {
          name: 'text',
          label: '文字内容',
          type: 'textarea',
          default: '',
          required: true,
          group: 'basic',
          description: '要显示的文字内容'
        },
        {
          name: 'fontfile',
          label: '字体文件',
          type: 'string',
          default: '',
          required: false,
          group: 'basic',
          description: '字体文件路径'
        },
        {
          name: 'fontsize',
          label: '字体大小',
          type: 'int',
          default: 24,
          required: false,
          group: 'basic',
          min: 8,
          max: 256,
          unit: 'px',
          description: '字体大小'
        },
        {
          name: 'fontcolor',
          label: '字体颜色',
          type: 'color',
          default: '#FFFFFF',
          required: false,
          group: 'style',
          description: '字体颜色（支持 #RRGGBB 格式）'
        },
        {
          name: 'alpha',
          label: '透明度',
          type: 'range',
          default: 1.0,
          required: false,
          group: 'style',
          min: 0,
          max: 1,
          step: 0.1,
          description: '文字透明度'
        },
        {
          name: 'x',
          label: 'X 坐标',
          type: 'number',
          default: 0,
          required: false,
          group: 'position',
          min: 0,
          max: 8192,
          description: '文字 X 坐标'
        },
        {
          name: 'y',
          label: 'Y 坐标',
          type: 'number',
          default: 0,
          required: false,
          group: 'position',
          min: 0,
          max: 8192,
          description: '文字 Y 坐标'
        },
        {
          name: 'shadowcolor',
          label: '阴影颜色',
          type: 'color',
          default: '#000000',
          required: false,
          group: 'effect',
          description: '阴影颜色'
        },
        {
          name: 'shadowx',
          label: '阴影 X 偏移',
          type: 'int',
          default: 0,
          required: false,
          group: 'effect',
          min: -10,
          max: 10,
          description: '阴影 X 方向偏移'
        },
        {
          name: 'shadowy',
          label: '阴影 Y 偏移',
          type: 'int',
          default: 0,
          required: false,
          group: 'effect',
          min: -10,
          max: 10,
          description: '阴影 Y 方向偏移'
        },
        {
          name: 'enable',
          label: '启用表达式',
          type: 'string',
          default: '',
          required: false,
          group: 'advanced',
          description: '启用文字的表达式条件（如 between(t,0,5) 表示 0-5 秒显示）'
        }
      ]
    }
  };
}

/**
 * 创建带有时间参数的测试节点
 */
export function createTimeTestNode(): FilterNode {
  return {
    id: 'test-time-node',
    type: 'filter',
    position: { x: 100, y: 100 },
    data: {
      name: 'trim',
      label: '裁剪时间',
      description: '裁剪视频的起始和结束时间',
      icon: '✂️',
      enabled: true,
      filterId: 'trim',
      filterType: 'video',
      params: {
        start: '00:00:01.000',
        end: '00:00:10.000',
        duration: '9s'
      },
      paramDefinitions: [
        {
          name: 'start',
          label: '开始时间',
          type: 'time',
          default: '00:00:00.000',
          required: false,
          group: 'basic',
          description: '裁剪的开始时间（支持 HH:MM:SS.mmm、Ns、Nframe 格式）'
        },
        {
          name: 'end',
          label: '结束时间',
          type: 'time',
          default: '00:00:00.000',
          required: false,
          group: 'basic',
          description: '裁剪的结束时间'
        },
        {
          name: 'duration',
          label: '持续时间',
          type: 'time',
          default: '0',
          required: false,
          group: 'basic',
          description: '裁剪的持续时间'
        }
      ]
    }
  };
}

/**
 * 创建带有坐标点参数的测试节点
 */
export function createPointTestNode(): FilterNode {
  return {
    id: 'test-point-node',
    type: 'filter',
    position: { x: 100, y: 100 },
    data: {
      name: 'crop',
      label: '裁剪',
      description: '裁剪视频画面',
      icon: '✂️',
      enabled: true,
      filterId: 'crop',
      filterType: 'video',
      params: {
        w: '1920',
        h: '1080',
        x: 0,
        y: 0
      },
      paramDefinitions: [
        {
          name: 'w',
          label: '宽度',
          type: 'size',
          default: 'iw',
          required: true,
          group: 'basic',
          description: '裁剪宽度，iw 表示输入宽度'
        },
        {
          name: 'h',
          label: '高度',
          type: 'size',
          default: 'ih',
          required: true,
          group: 'basic',
          description: '裁剪高度，ih 表示输入高度'
        },
        {
          name: 'x',
          label: 'X 坐标',
          type: 'number',
          default: 0,
          required: false,
          group: 'basic',
          min: 0,
          max: 8192,
          description: '裁剪起点的 X 坐标'
        },
        {
          name: 'y',
          label: 'Y 坐标',
          type: 'number',
          default: 0,
          required: false,
          group: 'basic',
          min: 0,
          max: 8192,
          description: '裁剪起点的 Y 坐标'
        }
      ]
    }
  };
}

/**
 * 导出所有测试节点
 */
export const testNodes = {
  basic: createTestNode(),
  multiType: createMultiTypeTestNode(),
  time: createTimeTestNode(),
  point: createPointTestNode()
};
