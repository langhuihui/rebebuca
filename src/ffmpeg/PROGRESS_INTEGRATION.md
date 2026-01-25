# FFmpeg 进度解析器 - 集成指南

## 概述

FFmpeg 进度解析器是阶段 2 的核心功能，提供实时进度监控、性能信息显示、剩余时间估算等功能。

## 核心组件

### 1. ProgressParser 服务

**文件**: `src/ffmpeg/services/progressParser.ts`

**功能**:
- 解析 FFmpeg 输出中的进度信息
- 提取 Duration、frame、fps、q、size、time、bitrate、speed 等数据
- 计算进度百分比
- 估算剩余时间和文件大小

**正则表达式**:
```typescript
// Duration 匹配
DURATION_REGEX = /Duration:\s+(\d{2}):(\d{2}):(\d{2})\.(\d{2})/i

// 完整进度行匹配
PROGRESS_REGEX = /frame=\s*(\d+)\s+fps=\s*([\d.]+)\s+q=\s*([\d.-]+)\s+size=\s*(\d+)\s*([KMG]iB)\s+time=\s*(\d{2}):(\d{2}):(\d{2})\.(\d{2})\s+bitrate=\s*([\d.]+)(?:kbits\/s)?\s+speed=\s*([\d.]+)x/i

// 错误匹配
ERROR_PATTERNS = [
  /error\s+:/i,
  /conversion\s+failed/i,
  /encoder\s+error/i,
  // ...
]
```

**使用示例**:
```typescript
import { progressParser } from '@/ffmpeg/services/progressParser';

const line = 'frame=  100 fps= 30 q=23.0 size=    1024KiB time=00:00:03.33 bitrate=2500kbits/s speed=1.5x';
const progress = progressParser.parseLine(line);

console.log(progress);
// {
//   frame: 100,
//   fps: 30.0,
//   q: 23.0,
//   size: 1024,
//   sizeUnit: 'KiB',
//   time: '00:00:03.33',
//   timeSeconds: 3.33,
//   bitrate: 2500.0,
//   speed: 1.5,
//   progress: 11.1, // 假设 duration 为 30 秒
//   status: 'encoding'
// }
```

### 2. Progress Store

**文件**: `src/ffmpeg/stores/progressStore.ts`

**功能**:
- 管理所有任务的进度状态
- 实时更新进度数据
- 提供格式化辅助函数
- 支持多任务同时监控

**状态管理**:
```typescript
interface TaskProgress {
  taskId: string;           // 任务 ID
  tabId: string;           // 终端 Tab ID
  fileName: string;         // 文件名
  progress: FFmpegProgress; // 进度数据
  startTime: number;       // 开始时间
  lastUpdateTime: number;   // 最后更新时间
  isFinished: boolean;     // 是否完成
  errorCount: number;      // 错误计数
}
```

**主要方法**:
```typescript
// 创建任务
createTask(taskId: string, tabId: string, fileName: string): void

// 更新任务进度
updateTask(taskId: string, line: string): void

// 完成任务
finishTask(taskId: string, exitCode?: number): void

// 格式化剩余时间
formatRemainingTime(task: TaskProgress): string

// 格式化进度
formatProgress(task: TaskProgress): string

// 格式化文件大小
formatFileSize(sizeBytes?: number): string
```

**使用示例**:
```typescript
import { useFFmpegProgressStore } from '@/ffmpeg/stores/progressStore';

const progressStore = useFFmpegProgressStore();

// 创建任务
progressStore.createTask('task-1', 'tab-1', 'video.mp4');

// 更新进度（从终端输出中调用）
progressStore.updateTask('task-1', 'frame=100 fps=30 q=23.0...');

// 获取任务
const task = progressStore.getTask('task-1');

// 格式化显示
const remainingTime = progressStore.formatRemainingTime(task);
const progressText = progressStore.formatProgress(task);
```

### 3. UI 组件

#### ProgressMonitor
**文件**: `src/ffmpeg/components/ProgressMonitor.vue`

**功能**:
- 主进度监控面板
- 集成所有子组件
- 显示批量任务列表

**Props**:
```typescript
interface Props {
  taskId?: string; // 任务 ID（可选，不传则显示活动任务）
}
```

**使用示例**:
```vue
<template>
  <ProgressMonitor :taskId="taskId" />
</template>
```

#### FFmpegProgress
**文件**: `src/ffmpeg/components/FFmpegProgress.vue`

**功能**:
- 显示进度条
- 显示当前时间和总时长

**Props**:
```typescript
interface Props {
  progress: FFmpegProgress;
}
```

#### PerformanceInfo
**文件**: `src/ffmpeg/components/PerformanceInfo.vue`

**功能**:
- 显示性能信息网格
- 帧、FPS、Q、大小、码率、速度

**Props**:
```typescript
interface Props {
  progress: FFmpegProgress;
}
```

#### ErrorLog
**文件**: `src/ffmpeg/components/ErrorLog.vue`

**功能**:
- 显示错误信息
- 支持展开/收起
- 支持复制错误信息

**Props**:
```typescript
interface Props {
  progress: FFmpegProgress;
}
```

## Terminal Store 集成

### 标记 FFmpeg 任务

在创建终端任务时，添加 `isFFmpegTask` 标记:

```typescript
import { useTerminalStore } from '@/stores/terminal';

const terminalStore = useTerminalStore();

const tab = await terminalStore.executeTask({
  command: 'ffmpeg',
  args: ['-i', 'input.mp4', 'output.mp4'],
  cwd: '/path/to/directory',
  label: 'FFmpeg 转码',
  
  // 重要：标记为 FFmpeg 任务
  isFFmpegTask: true,
  ffmpegFileName: 'input.mp4',
});

// 启动任务
await terminalStore.startTask(tab.id);
```

### 自动进度解析

Terminal Store 会自动:
1. 检测 FFmpeg 任务（通过 `isFFmpegTask` 标记）
2. 在任务启动时初始化进度追踪
3. 实时解析 FFmpeg 输出
4. 更新 Progress Store
5. 在任务完成时结束进度追踪

### 访问进度数据

```typescript
import { useFFmpegProgressStore } from '@/ffmpeg/stores/progressStore';

const progressStore = useFFmpegProgressStore();

// 获取所有任务
const taskList = progressStore.taskList;

// 获取当前活动任务
const activeTask = progressStore.activeTask;

// 通过 tabId 获取任务
const task = progressStore.getTaskByTabId('tab-id');

// 获取运行中的任务数量
const runningCount = progressStore.runningTasksCount;
```

## 完整使用示例

### 示例 1: 基本 FFmpeg 转码

```typescript
import { useTerminalStore } from '@/stores/terminal';
import { useFFmpegProgressStore } from '@/ffmpeg/stores/progressStore';

const terminalStore = useTerminalStore();
const progressStore = useFFmpegProgressStore();

// 1. 创建 FFmpeg 任务
const tab = await terminalStore.executeTask({
  command: 'ffmpeg',
  args: [
    '-i', 'input.mp4',
    '-c:v', 'libx264',
    '-crf', '23',
    '-preset', 'medium',
    '-c:a', 'aac',
    '-b:a', '192k',
    'output.mp4'
  ],
  cwd: '/path/to/videos',
  label: '视频转码',
  isFFmpegTask: true,
  ffmpegFileName: 'input.mp4',
});

// 2. 启动任务
await terminalStore.startTask(tab.id);

// 3. 监听进度（在组件中）
const progress = computed(() => {
  const task = progressStore.getTaskByTabId(tab.id);
  return task?.progress;
});

// 4. 显示进度
// <ProgressMonitor :taskId="tab.ffmpegTaskId" />
```

### 示例 2: 批量转码

```typescript
const files = ['video1.mp4', 'video2.mp4', 'video3.mp4'];
const taskIds: string[] = [];

for (const file of files) {
  const tab = await terminalStore.executeTask({
    command: 'ffmpeg',
    args: ['-i', file, '-c:v', 'libx264', `output_${file}`],
    cwd: '/path/to/videos',
    label: `转码 ${file}`,
    isFFmpegTask: true,
    ffmpegFileName: file,
  });
  
  await terminalStore.startTask(tab.id);
  taskIds.push(tab.ffmpegTaskId);
}

// 显示所有任务的进度
// <ProgressMonitor /> - 会自动显示所有任务
```

### 示例 3: 自定义进度显示

```vue
<template>
  <div class="custom-progress">
    <!-- 进度条 -->
    <div class="progress-bar">
      <div class="progress-fill" :style="{ width: progressPercent }"></div>
    </div>
    
    <!-- 信息 -->
    <div class="info">
      <span>{{ frame }} 帧</span>
      <span>{{ fps }} FPS</span>
      <span>{{ speed }}x</span>
      <span>{{ remainingTime }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useFFmpegProgressStore } from '@/ffmpeg/stores/progressStore';

const progressStore = useFFmpegProgressStore();
const props = defineProps<{ taskId: string }>();

const task = computed(() => progressStore.getTask(props.taskId));
const progress = computed(() => task.value?.progress);

const progressPercent = computed(() => {
  const p = progress.value?.progress;
  return p !== undefined ? `${p}%` : '0%';
});

const frame = computed(() => progress.value?.frame ?? '-');
const fps = computed(() => progress.value?.fps?.toFixed(1) ?? '-');
const speed = computed(() => progress.value?.speed?.toFixed(1) ?? '-');

const remainingTime = computed(() => {
  if (!task.value) return '-';
  return progressStore.formatRemainingTime(task.value);
});
</script>
```

## 正则表达式说明

### Duration 匹配
```
Duration:\s+(\d{2}):(\d{2}):(\d{2})\.(\d{2})
```
提取视频总时长，格式为 `HH:MM:SS.mm`

### 完整进度行匹配
```
frame=\s*(\d+)\s+fps=\s*([\d.]+)\s+q=\s*([\d.-]+)\s+size=\s*(\d+)\s*([KMG]iB)\s+time=\s*(\d{2}):(\d{2}):(\d{2})\.(\d{2})\s+bitrate=\s*([\d.]+)(?:kbits\/s)?\s+speed=\s*([\d.]+)x
```
提取所有进度信息：
- `frame`: 当前帧数
- `fps`: 帧率
- `q`: 量化参数
- `size`: 当前文件大小
- `sizeUnit`: 大小单位 (KiB, MiB, GiB)
- `time`: 当前时间
- `bitrate`: 当前比特率
- `speed`: 处理速度

### 错误匹配
```
/error\s+:/i
/conversion\s+failed/i
/encoder\s+error/i
/no\s+such\s+file/i
```
识别 FFmpeg 错误输出

## 性能优化

1. **缓存机制**: ProgressParser 内部维护状态，避免重复解析
2. **批量更新**: Progress Store 支持批量更新进度数据
3. **延迟清理**: 自动清理已完成的任务
4. **响应式**: 使用 Vue 3 Composition API 优化性能

## 测试

参考 `src/ffmpeg/examples/FFmpegProgressExample.vue` 查看完整示例。

## 故障排查

### 进度不更新
- 检查是否设置了 `isFFmpegTask: true`
- 检查 FFmpeg 输出格式是否正确
- 检查终端输出是否被正确捕获

### 错误未识别
- 检查错误模式是否匹配
- 查看控制台日志了解详细错误信息

### 性能问题
- 减少更新频率
- 使用批量更新
- 清理已完成的任务

## 相关文档

- [FFmpeg PRD](../../.vibe/docs/FFmpeg_PRD.md)
- [模块详细设计](../../.vibe/docs/模块详细设计.md)
- [阶段 1 实现](../IMPLEMENTATION_SUMMARY.md)
