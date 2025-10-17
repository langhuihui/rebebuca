import { h } from 'vue';
import { NIcon } from 'naive-ui';

// 创建 SVG 图标组件的通用函数
export const createIconComponent = (svgContent: any[]) => {
  return () => h(NIcon, {}, {
    default: () => h('svg', {
      xmlns: 'http://www.w3.org/2000/svg',
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: 'currentColor',
      'stroke-width': '2',
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round'
    }, svgContent)
  });
};

// 常用 SVG 图标定义
export const iconComponents = {
  // 关闭图标 (X)
  close: createIconComponent([
    h('line', { x1: '18', y1: '6', x2: '6', y2: '18' }),
    h('line', { x1: '6', y1: '6', x2: '18', y2: '18' })
  ]),

  // 检查图标 (对勾)
  check: createIconComponent([
    h('polyline', { points: '20 6 9 17 4 12' })
  ]),

  // 播放图标
  play: createIconComponent([
    h('polygon', { points: '5 3 19 12 5 21 5 3' })
  ]),

  // 编辑图标
  edit: createIconComponent([
    h('path', { d: 'M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7' }),
    h('path', { d: 'M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z' })
  ]),

  // 停止图标
  stop: (isRunning: boolean = false) => createIconComponent([
    h('rect', {
      x: '5',
      y: '5',
      width: '16',
      height: '16',
      rx: '1',
      fill: isRunning ? '#ef4444' : '#6b7280'
    })
  ])(),

  // 导出图标
  export: createIconComponent([
    h('path', { d: 'M3 6h18' }),
    h('path', { d: 'M3 12h18' }),
    h('path', { d: 'M3 18h18' }),
    h('path', { d: 'M12 15l3 3 3-3' })
  ]),

  // 清除图标
  clear: createIconComponent([
    h('path', { d: 'M3 6h18' }),
    h('path', { d: 'M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6' }),
    h('path', { d: 'M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2' })
  ]),

  // 文件夹图标
  folder: createIconComponent([
    h('path', { d: 'M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z' })
  ]),

  // 重播/重启图标
  replay: createIconComponent([
    h('path', { d: 'M19.8 16a9 9 0 1 1-7.8-13 9.75 9.75 0 0 1 6.74 2.74L21 8' }),
    h('path', { d: 'M21 3v5h-5' }),
    h('polygon', { points: '16 14 24 18 16 22 16 14', stroke: '#00d084', fill: '#00d084' })
  ]),

  // 文件图标
  file: createIconComponent([
    h('path', { d: 'M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z' })
  ]),

  // 重播历史图标
  replayHistory: createIconComponent([
    h('path', { d: 'M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8' }),
    h('path', { d: 'M3 3v5h5' })
  ]),

  // 删除图标
  delete: createIconComponent([
    h('path', { d: 'M3 6h18' }),
    h('path', { d: 'M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6' }),
    h('path', { d: 'M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2' })
  ]),

  // 太阳图标 (亮色主题)
  sun: createIconComponent([
    h('circle', { cx: '12', cy: '12', r: '5' }),
    h('line', { x1: '12', y1: '1', x2: '12', y2: '3' }),
    h('line', { x1: '12', y1: '21', x2: '12', y2: '23' }),
    h('line', { x1: '4.22', y1: '4.22', x2: '5.64', y2: '5.64' }),
    h('line', { x1: '18.36', y1: '18.36', x2: '19.78', y2: '19.78' }),
    h('line', { x1: '1', y1: '12', x2: '3', y2: '12' }),
    h('line', { x1: '21', y1: '12', x2: '23', y2: '12' }),
    h('line', { x1: '4.22', y1: '19.78', x2: '5.64', y2: '18.36' }),
    h('line', { x1: '18.36', y1: '5.64', x2: '19.78', y2: '4.22' })
  ]),

  // 月亮图标 (暗色主题)
  moon: createIconComponent([
    h('path', { d: 'M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z' })
  ]),

  // 系统图标
  system: createIconComponent([
    h('rect', { x: '2', y: '3', width: '20', height: '14', rx: '2', ry: '2' }),
    h('line', { x1: '8', y1: '21', x2: '16', y2: '21' }),
    h('line', { x1: '12', y1: '17', x2: '12', y2: '21' })
  ]),

  // 侧边栏图标
  sidebar: createIconComponent([
    h('rect', { x: '2', y: '3', width: '20', height: '18', rx: '2', ry: '2', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.5' }),
    h('rect', { x: '2', y: '3', width: '10', height: '18', rx: '2', ry: '2', fill: 'rgba(255,255,255,0.3)' }),
    h('rect', { x: '2', y: '3', width: '10', height: '18', rx: '2', ry: '2', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.5' })
  ]),

  // 历史面板图标
  historyPanel: createIconComponent([
    h('rect', { x: '2', y: '3', width: '20', height: '18', rx: '2', ry: '2', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.5' }),
    h('rect', { x: '12', y: '3', width: '10', height: '18', rx: '2', ry: '2', fill: 'rgba(255,255,255,0.3)' }),
    h('rect', { x: '12', y: '3', width: '10', height: '18', rx: '2', ry: '2', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.5' })
  ]),

  // 新建配置图标
  newConfig: createIconComponent([
    h('circle', { cx: '12', cy: '12', r: '10' }),
    h('line', { x1: '12', y1: '8', x2: '12', y2: '16' }),
    h('line', { x1: '8', y1: '12', x2: '16', y2: '12' })
  ]),

  // 状态指示器图标
  statusIndicator: createIconComponent([
    h('circle', { cx: '12', cy: '12', r: '6' })
  ]),

  // 置顶图标 (实心)
  pin: createIconComponent([
    h('path', { d: 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z', fill: 'currentColor' })
  ]),

  // 置顶图标 (空心)
  pinOutline: createIconComponent([
    h('path', { d: 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z', fill: 'none', stroke: 'currentColor', 'stroke-width': '2' })
  ])
};