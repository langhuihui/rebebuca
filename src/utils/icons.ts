import { h } from 'vue';
import { NIcon } from 'naive-ui';

/**
 * 默认的命令图标映射
 * 键是命令前缀，值是图标名称
 */
export const defaultCommandIcons: Record<string, string> = {
  'npm': 'npm',
  'pnpm': 'pnpm',
  'yarn': 'yarn',
  'go': 'go',
  'cargo': 'cargo',
  'rustc': 'cargo',
  'python': 'python',
  'python3': 'python',
  'pip': 'python',
  'pip3': 'python',
  'docker': 'docker',
  'docker-compose': 'docker',
  'git': 'git',
  'make': 'make',
  'gradle': 'gradle',
  './gradlew': 'gradle',
  'mvn': 'maven',
  './mvnw': 'maven',
  'sh': 'shell',
  'bash': 'shell',
  'zsh': 'shell',
  'ffmpeg': 'ffmpeg',
  'ffplay': 'ffmpeg',
  'ffprobe': 'ffmpeg',
  'node': 'nodejs',
  'nodejs': 'nodejs',
  'java': 'java',
  'javac': 'java',
  'ruby': 'ruby',
  'gem': 'ruby',
  'bundle': 'ruby',
  'php': 'php',
  'composer': 'php',
  'swift': 'swift',
  'swiftc': 'swift',
  'kotlin': 'kotlin',
  'kotlinc': 'kotlin',
  'gcc': 'cpp',
  'g++': 'cpp',
  'clang': 'cpp',
  'clang++': 'cpp',
  'cmake': 'cpp',
  // AI Tools
  'claude': 'ai',
  'codex': 'ai',
  'gemini': 'ai',
  'opencode': 'ai',
  'codebuddy': 'ai',
  'qoder': 'ai',
  'copilot': 'ai',
  'droid': 'ai',
  'auggie': 'ai',
  'cursor-agent': 'ai',
  'crush': 'ai',
};

/**
 * 根据命令获取对应的图标名称
 */
export const getCommandIconName = (command: string, customIcons?: Record<string, string>): string => {
  const cmd = command.toLowerCase().trim();

  // 合并自定义图标配置（优先级更高）
  const allIcons = { ...defaultCommandIcons, ...customIcons };

  // 按命令长度降序排序，确保更具体的匹配优先
  const sortedPatterns = Object.keys(allIcons).sort((a, b) => b.length - a.length);

  for (const pattern of sortedPatterns) {
    const lowerPattern = pattern.toLowerCase();
    if (cmd === lowerPattern || cmd.startsWith(lowerPattern + ' ')) {
      return allIcons[pattern];
    }
  }

  // 默认返回 task 图标
  return 'task';
};

// 创建纯 SVG 图标组件的函数（不包含 NIcon 包裹）
export const createSvgIcon = (svgContent: any[]) => {
  return () => h('svg', {
    xmlns: 'http://www.w3.org/2000/svg',
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    'stroke-width': '2',
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    width: '1em',
    height: '1em',
  }, svgContent);
};

// 创建带 NIcon 包裹的图标组件（用于直接使用，不再嵌套 n-icon）
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

  // 停止图标 (带颜色参数)
  stop: (isRunning: boolean = false) => {
    return createIconComponent([
      h('rect', {
        x: '5',
        y: '5',
        width: '16',
        height: '16',
        rx: '1',
        fill: isRunning ? '#ef4444' : '#6b7280'
      })
    ])();
  },

  // 滚动到底部图标
  scrollToBottom: createIconComponent([
    h('path', { d: 'M12 5v14' }),
    h('polyline', { points: '19 12 12 19 5 12' })
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
  ]),

  // 终端图标
  terminal: createIconComponent([
    h('polyline', { points: '4 17 10 11 4 5' }),
    h('line', { x1: '12', y1: '19', x2: '20', y2: '19' })
  ]),

  // 运行中图标 (旋转的圆环)
  running: createIconComponent([
    h('circle', { cx: '12', cy: '12', r: '10', fill: 'none', stroke: '#00d084', 'stroke-width': '2', 'stroke-dasharray': '31.4 31.4', 'stroke-linecap': 'round' }),
    h('animateTransform', { attributeName: 'transform', type: 'rotate', from: '0 12 12', to: '360 12 12', dur: '1s', repeatCount: 'indefinite' })
  ]),

  // 成功图标 (绿色对勾)
  success: createIconComponent([
    h('circle', { cx: '12', cy: '12', r: '10', fill: '#52c41a', stroke: 'none' }),
    h('polyline', { points: '8 12 11 15 16 9', stroke: '#ffffff', fill: 'none', 'stroke-width': '2' })
  ]),

  // 错误图标 (红色叉)
  error: createIconComponent([
    h('circle', { cx: '12', cy: '12', r: '10', fill: '#ff4d4f', stroke: 'none' }),
    h('line', { x1: '8', y1: '8', x2: '16', y2: '16', stroke: '#ffffff', 'stroke-width': '2' }),
    h('line', { x1: '16', y1: '8', x2: '8', y2: '16', stroke: '#ffffff', 'stroke-width': '2' })
  ]),

  // 任务图标
  task: createIconComponent([
    h('path', { d: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2' }),
    h('rect', { x: '9', y: '3', width: '6', height: '4', rx: '1' }),
    h('path', { d: 'M9 12l2 2 4-4' })
  ]),

  // 刷新图标
  refresh: createIconComponent([
    h('path', { d: 'M21.5 2v6h-6' }),
    h('path', { d: 'M2.5 22v-6h6' }),
    h('path', { d: 'M2 11.5a10 10 0 0 1 18.8-4.3' }),
    h('path', { d: 'M22 12.5a10 10 0 0 1-18.8 4.3' })
  ]),

  // 文件夹打开图标
  folderOpen: createIconComponent([
    h('path', { d: 'M6 14l1.45-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.55 6a2 2 0 0 1-1.94 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9L12 6h7a2 2 0 0 1 2 2v2' })
  ]),

  // 导入图标 (向上箭头/上传)
  import: createIconComponent([
    h('path', { d: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4' }),
    h('polyline', { points: '17 8 12 3 7 8' }),
    h('line', { x1: '12', y1: '3', x2: '12', y2: '15' })
  ]),

  // 导出图标 (向下箭头/下载)
  export: createIconComponent([
    h('path', { d: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4' }),
    h('polyline', { points: '7 10 12 15 17 10' }),
    h('line', { x1: '12', y1: '15', x2: '12', y2: '3' })
  ]),

  // 设置图标
  settings: createIconComponent([
    h('circle', { cx: '12', cy: '12', r: '3' }),
    h('path', { d: 'M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z' })
  ]),

  // 加号图标
  plus: createIconComponent([
    h('line', { x1: '12', y1: '5', x2: '12', y2: '19' }),
    h('line', { x1: '5', y1: '12', x2: '19', y2: '12' })
  ]),

  // 添加图标 (圆圈加号)
  add: createIconComponent([
    h('circle', { cx: '12', cy: '12', r: '10' }),
    h('line', { x1: '12', y1: '8', x2: '12', y2: '16' }),
    h('line', { x1: '8', y1: '12', x2: '16', y2: '12' })
  ]),

  // 信息图标
  info: createIconComponent([
    h('circle', { cx: '12', cy: '12', r: '10' }),
    h('line', { x1: '12', y1: '16', x2: '12', y2: '12' }),
    h('line', { x1: '12', y1: '8', x2: '12.01', y2: '8' })
  ]),

  // 加载中图标 (旋转)
  loading: createIconComponent([
    h('circle', { cx: '12', cy: '12', r: '10', fill: 'none', stroke: 'currentColor', 'stroke-width': '2', 'stroke-dasharray': '31.4 31.4', 'stroke-linecap': 'round' }),
    h('animateTransform', { attributeName: 'transform', type: 'rotate', from: '0 12 12', to: '360 12 12', dur: '1s', repeatCount: 'indefinite' })
  ]),

  // 向下展开箭头
  chevronDown: createIconComponent([
    h('polyline', { points: '6 9 12 15 18 9' })
  ]),

  // 向右展开箭头
  chevronRight: createIconComponent([
    h('polyline', { points: '9 18 15 12 9 6' })
  ]),

  // VSCode 图标
  vscode: createIconComponent([
    h('path', { d: 'M17.583 3.894c.583-.308 1.292-.308 1.875 0l2.25 1.188c.583.308.917.923.917 1.577v10.682c0 .654-.334 1.269-.917 1.577l-2.25 1.188c-.583.308-1.292.308-1.875 0L15 18.694 9.75 21.5c-.292.154-.625.231-.958.231s-.667-.077-.958-.231l-2.25-1.188c-.584-.308-.917-.923-.917-1.577V8.053c0-.654.333-1.269.917-1.577l2.25-1.188c.583-.308 1.291-.308 1.875 0L12 6.694l5.583-2.8z', fill: 'none' }),
    h('path', { d: 'M9 16l-4-4 4-4', 'stroke-width': '2' }),
    h('path', { d: 'M15 8l4 4-4 4', 'stroke-width': '2' })
  ]),

  // npm 图标
  npm: createIconComponent([
    h('rect', { x: '2', y: '8', width: '20', height: '8', rx: '1' }),
    h('path', { d: 'M6 11v2' }),
    h('path', { d: 'M10 11v2' }),
    h('path', { d: 'M14 11v2' }),
    h('path', { d: 'M18 11v2' })
  ]),

  // 构建图标
  build: createIconComponent([
    h('path', { d: 'M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z' })
  ]),

  // 测试图标
  test: createIconComponent([
    h('path', { d: 'M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z' }),
    h('polyline', { points: '14 2 14 8 20 8' }),
    h('path', { d: 'M9 15l2 2 4-4' })
  ]),

  // 清理图标
  clean: createIconComponent([
    h('path', { d: 'M3 6h18' }),
    h('path', { d: 'M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6' }),
    h('path', { d: 'M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2' }),
    h('line', { x1: '10', y1: '11', x2: '10', y2: '17' }),
    h('line', { x1: '14', y1: '11', x2: '14', y2: '17' })
  ]),

  // 升级图标 (向上箭头 + 圆圈)
  upgrade: createIconComponent([
    h('circle', { cx: '12', cy: '12', r: '10' }),
    h('polyline', { points: '16 12 12 8 8 12' }),
    h('line', { x1: '12', y1: '16', x2: '12', y2: '8' })
  ]),

  // 下载图标
  download: createIconComponent([
    h('path', { d: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4' }),
    h('polyline', { points: '7 10 12 15 17 10' }),
    h('line', { x1: '12', y1: '15', x2: '12', y2: '3' })
  ]),

  // 机器人图标
  robot: createIconComponent([
    h('rect', { x: '3', y: '11', width: '18', height: '10', rx: '2' }),
    h('circle', { cx: '12', cy: '5', r: '2' }),
    h('path', { d: 'M12 7v4' }),
    h('line', { x1: '8', y1: '16', x2: '8', y2: '16' }),
    h('line', { x1: '16', y1: '16', x2: '16', y2: '16' }),
    h('circle', { cx: '8', cy: '16', r: '1', fill: 'currentColor' }),
    h('circle', { cx: '16', cy: '16', r: '1', fill: 'currentColor' })
  ]),

  // 发送图标
  send: createIconComponent([
    h('line', { x1: '22', y1: '2', x2: '11', y2: '13' }),
    h('polygon', { points: '22 2 15 22 11 13 2 9 22 2' })
  ]),

  // 警告图标
  warning: createIconComponent([
    h('path', { d: 'M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z' }),
    h('line', { x1: '12', y1: '9', x2: '12', y2: '13' }),
    h('line', { x1: '12', y1: '17', x2: '12.01', y2: '17' })
  ]),

  // 用户图标
  user: createIconComponent([
    h('path', { d: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2' }),
    h('circle', { cx: '12', cy: '7', r: '4' })
  ]),

  // 时钟图标
  clock: createIconComponent([
    h('circle', { cx: '12', cy: '12', r: '10' }),
    h('polyline', { points: '12 6 12 12 16 14' })
  ])
};

// 纯 SVG 图标（用于在 n-icon 内部使用，避免双重嵌套）
export const svgIcons = {
  refresh: createSvgIcon([
    h('path', { d: 'M21.5 2v6h-6' }),
    h('path', { d: 'M2.5 22v-6h6' }),
    h('path', { d: 'M2 11.5a10 10 0 0 1 18.8-4.3' }),
    h('path', { d: 'M22 12.5a10 10 0 0 1-18.8 4.3' })
  ]),

  folderOpen: createSvgIcon([
    h('path', { d: 'M6 14l1.45-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.55 6a2 2 0 0 1-1.94 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9L12 6h7a2 2 0 0 1 2 2v2' })
  ]),

  folderPlus: createSvgIcon([
    h('path', { d: 'M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2z' }),
    h('line', { x1: '12', y1: '10', x2: '12', y2: '16' }),
    h('line', { x1: '9', y1: '13', x2: '15', y2: '13' })
  ]),

  plus: createSvgIcon([
    h('line', { x1: '12', y1: '5', x2: '12', y2: '19' }),
    h('line', { x1: '5', y1: '12', x2: '19', y2: '12' })
  ]),

  task: createSvgIcon([
    h('path', { d: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2' }),
    h('rect', { x: '9', y: '3', width: '6', height: '4', rx: '1' }),
    h('path', { d: 'M9 12l2 2 4-4' })
  ]),

  folder: createSvgIcon([
    h('path', { d: 'M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z' })
  ]),

  chevronDown: createSvgIcon([
    h('polyline', { points: '6 9 12 15 18 9' })
  ]),

  chevronRight: createSvgIcon([
    h('polyline', { points: '9 18 15 12 9 6' })
  ]),

  play: createSvgIcon([
    h('polygon', { points: '5 3 19 12 5 21 5 3' })
  ]),

  close: createSvgIcon([
    h('line', { x1: '18', y1: '6', x2: '6', y2: '18' }),
    h('line', { x1: '6', y1: '6', x2: '18', y2: '18' })
  ]),

  edit: createSvgIcon([
    h('path', { d: 'M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7' }),
    h('path', { d: 'M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z' })
  ]),

  star: createSvgIcon([
    h('polygon', { points: '12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2', fill: 'none' })
  ]),

  starFilled: createSvgIcon([
    h('polygon', { points: '12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2', fill: 'currentColor' })
  ]),

  vscode: createSvgIcon([
    h('path', { d: 'M17.583 3.894c.583-.308 1.292-.308 1.875 0l2.25 1.188c.583.308.917.923.917 1.577v10.682c0 .654-.334 1.269-.917 1.577l-2.25 1.188c-.583.308-1.292.308-1.875 0L15 18.694 9.75 21.5c-.292.154-.625.231-.958.231s-.667-.077-.958-.231l-2.25-1.188c-.584-.308-.917-.923-.917-1.577V8.053c0-.654.333-1.269.917-1.577l2.25-1.188c.583-.308 1.291-.308 1.875 0L12 6.694l5.583-2.8z', fill: 'none' }),
    h('path', { d: 'M9 16l-4-4 4-4', 'stroke-width': '2' }),
    h('path', { d: 'M15 8l4 4-4 4', 'stroke-width': '2' })
  ]),

  npm: createSvgIcon([
    h('rect', { x: '2', y: '8', width: '20', height: '8', rx: '1' }),
    h('path', { d: 'M6 11v2' }),
    h('path', { d: 'M10 11v2' }),
    h('path', { d: 'M14 11v2' }),
    h('path', { d: 'M18 11v2' })
  ]),

  build: createSvgIcon([
    h('path', { d: 'M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z' })
  ]),

  test: createSvgIcon([
    h('path', { d: 'M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z' }),
    h('polyline', { points: '14 2 14 8 20 8' }),
    h('path', { d: 'M9 15l2 2 4-4' })
  ]),

  clean: createSvgIcon([
    h('path', { d: 'M3 6h18' }),
    h('path', { d: 'M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6' }),
    h('path', { d: 'M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2' }),
    h('line', { x1: '10', y1: '11', x2: '10', y2: '17' }),
    h('line', { x1: '14', y1: '11', x2: '14', y2: '17' })
  ]),

  settings: createSvgIcon([
    h('circle', { cx: '12', cy: '12', r: '3' }),
    h('path', { d: 'M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z' })
  ]),

  import: createSvgIcon([
    h('path', { d: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4' }),
    h('polyline', { points: '7 10 12 15 17 10' }),
    h('line', { x1: '12', y1: '15', x2: '12', y2: '3' })
  ]),

  export: createSvgIcon([
    h('path', { d: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4' }),
    h('polyline', { points: '17 8 12 3 7 8' }),
    h('line', { x1: '12', y1: '3', x2: '12', y2: '15' })
  ]),

  copy: createSvgIcon([
    h('rect', { x: '9', y: '9', width: '13', height: '13', rx: '2', ry: '2' }),
    h('path', { d: 'M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1' })
  ]),

  // Go 语言图标
  go: createSvgIcon([
    h('path', { d: 'M3 12h4l2-4 3 8 2-4h7', fill: 'none', stroke: '#00ADD8', 'stroke-width': '2' }),
  ]),

  // Rust/Cargo 图标
  cargo: createSvgIcon([
    h('circle', { cx: '12', cy: '12', r: '9', fill: 'none', stroke: '#DEA584', 'stroke-width': '2' }),
    h('path', { d: 'M12 7v10M7 12h10', stroke: '#DEA584', 'stroke-width': '2' }),
  ]),

  // Python 图标
  python: createSvgIcon([
    h('path', { d: 'M12 3c-1.5 0-3 .5-3 2v2h6v1H7c-2 0-3 1.5-3 3.5S5 15 7 15h2v-2c0-1 1-2 2-2h4c1 0 2-1 2-2V5c0-1.5-1.5-2-3-2h-2z', fill: '#3776AB' }),
    h('path', { d: 'M12 21c1.5 0 3-.5 3-2v-2h-6v-1h8c2 0 3-1.5 3-3.5S19 9 17 9h-2v2c0 1-1 2-2 2H9c-1 0-2 1-2 2v4c0 1.5 1.5 2 3 2h2z', fill: '#FFD43B' }),
  ]),

  // Docker 图标
  docker: createSvgIcon([
    h('path', { d: 'M4 11h3v3H4zM8 11h3v3H8zM12 11h3v3h-3zM8 7h3v3H8zM12 7h3v3h-3zM16 11h3v3h-3z', fill: '#2496ED', stroke: '#2496ED' }),
    h('path', { d: 'M21 12c-.5-1-1.5-1.5-3-1.5-.3 0-.5 0-.8.1-.3-1.5-1.5-2.5-3-2.5-1 0-2 .5-2.5 1.5-.5-1-1.5-1.5-2.7-1.5-2 0-3.5 1.5-3.5 3.5 0 .3 0 .7.1 1H3c-1 0-2 1-2 2v2c0 1 1 2 2 2h16c2 0 4-2 4-4 0-1.5-1-2.5-2-3z', fill: 'none', stroke: '#2496ED', 'stroke-width': '1.5' }),
  ]),

  // Git 图标
  git: createSvgIcon([
    h('circle', { cx: '12', cy: '12', r: '3', fill: '#F05032' }),
    h('circle', { cx: '6', cy: '6', r: '2', fill: '#F05032' }),
    h('circle', { cx: '18', cy: '18', r: '2', fill: '#F05032' }),
    h('path', { d: 'M8 8l2 2M14 14l2 2', stroke: '#F05032', 'stroke-width': '2' }),
  ]),

  // Yarn 图标
  yarn: createSvgIcon([
    h('circle', { cx: '12', cy: '12', r: '10', fill: 'none', stroke: '#2C8EBB', 'stroke-width': '2' }),
    h('path', { d: 'M12 6c-1 2-2 3-2 5 0 1 1 2 2 2s2-1 2-2c0-2-1-3-2-5zM8 14c1 1 2 2 4 2s3-1 4-2', fill: 'none', stroke: '#2C8EBB', 'stroke-width': '1.5' }),
  ]),

  // pnpm 图标
  pnpm: createSvgIcon([
    h('rect', { x: '3', y: '3', width: '5', height: '5', fill: '#F9AD00' }),
    h('rect', { x: '10', y: '3', width: '5', height: '5', fill: '#F9AD00' }),
    h('rect', { x: '10', y: '10', width: '5', height: '5', fill: '#F9AD00' }),
    h('rect', { x: '10', y: '17', width: '5', height: '5', fill: '#4a4a4a' }),
  ]),

  // Make 图标
  make: createSvgIcon([
    h('path', { d: 'M4 4h16v16H4z', fill: 'none', stroke: 'currentColor', 'stroke-width': '2' }),
    h('path', { d: 'M8 8l4 4-4 4M12 16h4', stroke: 'currentColor', 'stroke-width': '2' }),
  ]),

  // Shell/Bash 图标
  shell: createSvgIcon([
    h('rect', { x: '3', y: '4', width: '18', height: '16', rx: '2', fill: 'none', stroke: 'currentColor', 'stroke-width': '2' }),
    h('path', { d: 'M7 9l3 3-3 3M12 15h5', stroke: 'currentColor', 'stroke-width': '2' }),
  ]),

  // Gradle 图标
  gradle: createSvgIcon([
    h('path', { d: 'M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5', fill: 'none', stroke: '#02303A', 'stroke-width': '2' }),
  ]),

  // Maven 图标
  maven: createSvgIcon([
    h('path', { d: 'M3 6l9-4 9 4v12l-9 4-9-4z', fill: 'none', stroke: '#C71A36', 'stroke-width': '2' }),
    h('path', { d: 'M3 6l9 4 9-4M12 22V10', fill: 'none', stroke: '#C71A36', 'stroke-width': '2' }),
  ]),

  // AI/Magic 图标 (sparkles/闪光)
  ai: createSvgIcon([
    // 大星星
    h('path', { d: 'M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z', fill: '#8B5CF6', stroke: '#8B5CF6', 'stroke-width': '1' }),
    // 小星星右上
    h('path', { d: 'M19 2l.75 2.25L22 5l-2.25.75L19 8l-.75-2.25L16 5l2.25-.75L19 2z', fill: '#A78BFA', stroke: 'none' }),
    // 小星星左下
    h('path', { d: 'M6 14l.75 2.25L9 17l-2.25.75L6 20l-.75-2.25L3 17l2.25-.75L6 14z', fill: '#A78BFA', stroke: 'none' }),
  ]),

  // FFmpeg 图标 (视频/音频处理)
  ffmpeg: createSvgIcon([
    h('rect', { x: '2', y: '4', width: '20', height: '16', rx: '2', fill: 'none', stroke: '#5CB85C', 'stroke-width': '2' }),
    h('polygon', { points: '10 8 16 12 10 16 10 8', fill: '#5CB85C', stroke: 'none' }),
  ]),

  // Node.js 图标
  nodejs: createSvgIcon([
    h('path', { d: 'M12 2l8.5 5v10L12 22l-8.5-5V7L12 2z', fill: 'none', stroke: '#68A063', 'stroke-width': '2' }),
    h('path', { d: 'M12 7v10', stroke: '#68A063', 'stroke-width': '2' }),
  ]),

  // Java 图标
  java: createSvgIcon([
    h('path', { d: 'M8 6c2-2 6-2 8 0s2 6 0 8-6 2-8 0', fill: 'none', stroke: '#E76F00', 'stroke-width': '2' }),
    h('path', { d: 'M8 14c-2 2-2 4 0 6 4 1 8-1 8-4', fill: 'none', stroke: '#5382A1', 'stroke-width': '2' }),
  ]),

  // Ruby 图标
  ruby: createSvgIcon([
    h('polygon', { points: '12 2 20 8 16 22 8 22 4 8 12 2', fill: 'none', stroke: '#CC342D', 'stroke-width': '2' }),
    h('polygon', { points: '12 6 16 8 14 16 10 16 8 8 12 6', fill: '#CC342D', stroke: 'none' }),
  ]),

  // PHP 图标
  php: createSvgIcon([
    h('ellipse', { cx: '12', cy: '12', rx: '10', ry: '6', fill: 'none', stroke: '#777BB4', 'stroke-width': '2' }),
    h('path', { d: 'M8 10v4M8 12h2c1 0 2-.5 2-1.5S11 9 10 9H8', stroke: '#777BB4', 'stroke-width': '1.5', fill: 'none' }),
  ]),

  // Swift 图标
  swift: createSvgIcon([
    h('path', { d: 'M20 6c-4 8-12 12-16 10 6-2 10-6 10-6s-6 4-12 2c8-4 14-10 14-10s2 8-4 14c4-2 8-10 8-10z', fill: '#F05138', stroke: 'none' }),
  ]),

  // Kotlin 图标
  kotlin: createSvgIcon([
    h('polygon', { points: '3 3 12 3 3 12 3 3', fill: '#7F52FF' }),
    h('polygon', { points: '3 21 12 12 21 21 3 21', fill: '#7F52FF' }),
    h('polygon', { points: '12 3 21 3 12 12 3 21 3 12 12 3', fill: '#C711E1' }),
  ]),

  // C/C++ 图标
  cpp: createSvgIcon([
    h('path', { d: 'M18 12c0 3.3-2.7 6-6 6s-6-2.7-6-6 2.7-6 6-6c1.7 0 3.2.7 4.3 1.8', fill: 'none', stroke: '#00599C', 'stroke-width': '2' }),
    h('path', { d: 'M16 10h4M18 8v4', stroke: '#00599C', 'stroke-width': '1.5' }),
    h('path', { d: 'M20 10h2M21 9v2', stroke: '#00599C', 'stroke-width': '1' }),
  ]),

  // 停止图标
  stop: createSvgIcon([
    h('rect', { x: '6', y: '6', width: '12', height: '12', rx: '1', fill: 'currentColor' }),
  ]),

  // 警告图标
  warning: createSvgIcon([
    h('path', { d: 'M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z' }),
    h('line', { x1: '12', y1: '9', x2: '12', y2: '13' }),
    h('line', { x1: '12', y1: '17', x2: '12.01', y2: '17' })
  ]),

  // 外部链接/在文件管理器中打开
  externalLink: createSvgIcon([
    h('path', { d: 'M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6' }),
    h('polyline', { points: '15 3 21 3 21 9' }),
    h('line', { x1: '10', y1: '14', x2: '21', y2: '3' })
  ]),

  // 网络/端口图标
  network: createSvgIcon([
    h('rect', { x: '16', y: '16', width: '6', height: '6', rx: '1' }),
    h('rect', { x: '2', y: '16', width: '6', height: '6', rx: '1' }),
    h('rect', { x: '9', y: '2', width: '6', height: '6', rx: '1' }),
    h('path', { d: 'M5 16v-3a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v3' }),
    h('line', { x1: '12', y1: '12', x2: '12', y2: '8' })
  ]),

  // 通知图标（铃铛）
  notifications: createSvgIcon([
    h('path', { d: 'M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9' }),
    h('path', { d: 'M13.73 21a2 2 0 0 1-3.46 0' })
  ]),

  // 搜索图标
  search: createSvgIcon([
    h('circle', { cx: '11', cy: '11', r: '8' }),
    h('line', { x1: '21', y1: '21', x2: '16.65', y2: '16.65' })
  ]),

  // 网格图标（命令广场）
  grid: createSvgIcon([
    h('rect', { x: '3', y: '3', width: '7', height: '7' }),
    h('rect', { x: '14', y: '3', width: '7', height: '7' }),
    h('rect', { x: '14', y: '14', width: '7', height: '7' }),
    h('rect', { x: '3', y: '14', width: '7', height: '7' })
  ]),

  // 时钟图标（按时间排序）
  clock: createSvgIcon([
    h('circle', { cx: '12', cy: '12', r: '10' }),
    h('polyline', { points: '12 6 12 12 16 14' })
  ]),

  // 图表图标（按频率排序）
  chart: createSvgIcon([
    h('line', { x1: '18', y1: '20', x2: '18', y2: '10' }),
    h('line', { x1: '12', y1: '20', x2: '12', y2: '4' }),
    h('line', { x1: '6', y1: '20', x2: '6', y2: '14' })
  ]),

  // 列表图标
  list: createSvgIcon([
    h('line', { x1: '8', y1: '6', x2: '21', y2: '6' }),
    h('line', { x1: '8', y1: '12', x2: '21', y2: '12' }),
    h('line', { x1: '8', y1: '18', x2: '21', y2: '18' }),
    h('line', { x1: '3', y1: '6', x2: '3.01', y2: '6' }),
    h('line', { x1: '3', y1: '12', x2: '3.01', y2: '12' }),
    h('line', { x1: '3', y1: '18', x2: '3.01', y2: '18' })
  ]),

  // 文件图标
  file: createSvgIcon([
    h('path', { d: 'M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z' }),
    h('polyline', { points: '13 2 13 9 20 9' })
  ]),

  // Info icon
  info: createSvgIcon([
    h('circle', { cx: '12', cy: '12', r: '10' }),
    h('line', { x1: '12', y1: '16', x2: '12', y2: '12' }),
    h('line', { x1: '12', y1: '8', x2: '12.01', y2: '8' })
  ]),

  // Server icon
  server: createSvgIcon([
    h('rect', { x: '2', y: '3', width: '20', height: '4', rx: '1' }),
    h('rect', { x: '2', y: '7', width: '20', height: '4', rx: '1' }),
    h('rect', { x: '2', y: '11', width: '20', height: '4', rx: '1' }),
    h('rect', { x: '2', y: '15', width: '20', height: '4', rx: '1' }),
    h('rect', { x: '2', y: '19', width: '20', height: '4', rx: '1' }),
    h('line', { x1: '6', y1: '5', x2: '6.01', y2: '5' }),
    h('line', { x1: '6', y1: '9', x2: '6.01', y2: '9' }),
    h('line', { x1: '6', y1: '13', x2: '6.01', y2: '13' }),
    h('line', { x1: '6', y1: '17', x2: '6.01', y2: '17' }),
    h('line', { x1: '6', y1: '21', x2: '6.01', y2: '21' })
  ]),

  // Expand icon (arrows pointing out)
  expand: createSvgIcon([
    h('polyline', { points: '15 3 21 3 21 9' }),
    h('polyline', { points: '9 21 3 21 3 15' }),
    h('line', { x1: '21', y1: '3', x2: '14', y2: '10' }),
    h('line', { x1: '3', y1: '21', x2: '10', y2: '14' })
  ]),

  // Collapse icon (arrows pointing in)
  collapse: createSvgIcon([
    h('polyline', { points: '9 3 3 3 3 9' }),
    h('polyline', { points: '15 21 21 21 21 15' }),
    h('line', { x1: '3', y1: '3', x2: '10', y2: '10' }),
    h('line', { x1: '21', y1: '21', x2: '14', y2: '14' })
  ]),

  // Layout icon (sidebar layout - left outline, right filled, right is larger)
  layout: createSvgIcon([
    h('rect', { x: '2', y: '3', width: '20', height: '18', rx: '2', ry: '2', fill: 'none', stroke: 'currentColor', 'stroke-width': '2' }),
    h('rect', { x: '2', y: '3', width: '8', height: '18', rx: '1', ry: '1', fill: 'none', stroke: 'currentColor', 'stroke-width': '2' }),
    h('rect', { x: '10', y: '3', width: '12', height: '18', rx: '1', ry: '1', fill: 'currentColor' }),
  ]),

  // Layout outline icon (both sides outline)
  layoutOutline: createSvgIcon([
    h('rect', { x: '2', y: '3', width: '20', height: '18', rx: '2', ry: '2', fill: 'none', stroke: 'currentColor', 'stroke-width': '2' }),
    h('rect', { x: '2', y: '3', width: '10', height: '18', rx: '2', ry: '2', fill: 'none', stroke: 'currentColor', 'stroke-width': '2' }),
  ]),

  // 太阳图标 (亮色主题)
  sun: createSvgIcon([
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
  moon: createSvgIcon([
    h('path', { d: 'M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z' })
  ]),

  // 机器人图标
  robot: createSvgIcon([
    h('rect', { x: '3', y: '11', width: '18', height: '10', rx: '2' }),
    h('circle', { cx: '12', cy: '5', r: '2' }),
    h('path', { d: 'M12 7v4' }),
    h('circle', { cx: '8', cy: '16', r: '1', fill: 'currentColor' }),
    h('circle', { cx: '16', cy: '16', r: '1', fill: 'currentColor' })
  ]),
};