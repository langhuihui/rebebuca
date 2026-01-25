# FFmpeg 进度解析器 - 阶段 2

## 快速开始

### 1. 创建 FFmpeg 任务

```typescript
import { useTerminalStore } from '@/stores/terminal';

const terminalStore = useTerminalStore();

const tab = await terminalStore.executeTask({
  command: 'ffmpeg',
  args: ['-i', 'input.mp4', 'output.mp4'],
  cwd: '/path/to/directory',
  label: '视频转码',
  
  // 关键：标记为 FFmpeg 任务
  isFFmpegTask: true,
  ffmpegFileName: 'input.mp4',
});

await terminalStore.startTask(tab.id);
```

### 2. 显示进度

```vue
<template>
  <ProgressMonitor :taskId="tab.ffmpegTaskId" />
</template>

<script setup lang="ts">
import ProgressMonitor from '@/ffmpeg/components/ProgressMonitor.vue';
</script>
```

## 核心功能

### ✅ 实时进度显示
- 进度条动画
- 百分比显示
- 当前时间和总时长

### ✅ 性能信息
- 帧数 (Frame)
- 帧率 (FPS)
- 量化参数 (Q)
- 文件大小
- 比特率 (Bitrate)
- 处理速度 (Speed)

### ✅ 智能估算
- 剩余时间计算
- 预计完成时间
- 文件大小预估

### ✅ 错误处理
- 自动错误识别
- 错误详情显示
- 一键复制错误

### ✅ 批量支持
- 多任务同时监控
- 任务列表管理
- 任务状态显示

## 组件说明

### ProgressMonitor
主进度监控面板，集成所有子组件功能。

```vue
<ProgressMonitor :taskId="taskId" />
```

### FFmpegProgress
独立的进度条组件。

```vue
<FFmpegProgress :progress="progressData" />
```

### PerformanceInfo
性能信息网格显示。

```vue
<PerformanceInfo :progress="progressData" />
```

### ErrorLog
错误日志显示组件。

```vue
<ErrorLog :progress="progressData" />
```

## 进度数据结构

```typescript
interface FFmpegProgress {
  frame?: number;              // 当前帧数
  fps?: number;               // 帧率
  q?: number;                 // 量化参数
  time?: string;              // 当前时间 (HH:MM:SS.mmm)
  duration?: string;          // 总时长 (HH:MM:SS.mmm)
  timeSeconds?: number;       // 当前时间（秒）
  durationSeconds?: number;   // 总时长（秒）
  size?: number;              // 当前大小
  sizeUnit?: 'KiB' | 'MiB' | 'GiB';
  sizeBytes?: number;         // 大小（字节）
  bitrate?: number;           // 当前比特率 (kbits/s)
  estimatedSize?: number;     // 预估文件大小（字节）
  speed?: number;             // 处理速度（倍数）
  progress?: number;          // 进度百分比 (0-100)
  remainingTime?: number;    // 剩余时间（秒）
  status?: 'analyzing' | 'encoding' | 'muxing' | 'finished' | 'error';
  error?: string;            // 错误信息
}
```

## 使用示例

### 基本用法
```vue
<template>
  <div class="ffmpeg-task">
    <ProgressMonitor :taskId="taskId" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useTerminalStore } from '@/stores/terminal';
import ProgressMonitor from '@/ffmpeg/components/ProgressMonitor.vue';

const terminalStore = useTerminalStore();
const taskId = ref('');

const startFFmpeg = async () => {
  const tab = await terminalStore.executeTask({
    command: 'ffmpeg',
    args: ['-i', 'input.mp4', '-c:v', 'libx264', 'output.mp4'],
    cwd: '/path/to/videos',
    label: '转码任务',
    isFFmpegTask: true,
    ffmpegFileName: 'input.mp4',
  });
  
  await terminalStore.startTask(tab.id);
  taskId.value = tab.ffmpegTaskId || '';
};

onMounted(startFFmpeg);
</script>
```

### 批量任务
```typescript
const files = ['video1.mp4', 'video2.mp4', 'video3.mp4'];

for (const file of files) {
  const tab = await terminalStore.executeTask({
    command: 'ffmpeg',
    args: ['-i', file, `output_${file}`],
    cwd: '/path/to/videos',
    label: `转码 ${file}`,
    isFFmpegTask: true,
    ffmpegFileName: file,
  });
  
  await terminalStore.startTask(tab.id);
}

// 显示所有任务进度
// <ProgressMonitor /> - 不传 taskId 即显示所有任务
```

## 集成到现有组件

```vue
<template>
  <div class="terminal-container">
    <!-- 你的终端组件 -->
    <TerminalView :ptyId="ptyId" />
    
    <!-- FFmpeg 进度监控 -->
    <ProgressMonitor v-if="isFFmpegTask" :taskId="ffmpegTaskId" />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useFFmpegProgressStore } from '@/ffmpeg/stores/progressStore';

const progressStore = useFFmpegProgressStore();

const props = defineProps<{
  ptyId: string;
}>();

// 通过 ptyId 查找对应的 FFmpeg 任务
const task = computed(() => progressStore.getTaskByTabId(props.ptyId));
const isFFmpegTask = computed(() => !!task.value);
const ffmpegTaskId = computed(() => task.value?.taskId || '');
</script>
```

## 测试

运行单元测试：

```bash
npm run test -- src/ffmpeg/services/__tests__/progressParser.spec.ts
```

查看完整示例：

```bash
open src/ffmpeg/examples/FFmpegProgressExample.vue
```

## 文档

- [集成指南](./PROGRESS_INTEGRATION.md) - 详细的集成说明和 API 文档
- [阶段 2 摘要](./PHASE2_SUMMARY.md) - 完整的实现总结
- [FFmpeg PRD](../../.vibe/docs/FFmpeg_PRD.md) - 产品需求文档
- [模块详细设计](../../.vibe/docs/模块详细设计.md) - 技术设计文档

## 故障排查

### 进度不更新
1. 检查是否设置了 `isFFmpegTask: true`
2. 检查 FFmpeg 输出格式
3. 查看控制台日志

### 错误未识别
1. 查看错误日志组件
2. 检查 FFmpeg 错误输出
3. 参考集成指南

### 性能问题
1. 清理已完成任务
2. 减少同时运行的任务数
3. 使用批量更新

## 贡献

欢迎提交 Issue 和 Pull Request！

## 许可证

GNU General Public License v3.0
