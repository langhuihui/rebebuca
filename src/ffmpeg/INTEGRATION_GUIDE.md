# 集成指南

本指南帮助您将 FFmpeg 模块集成到 Rebebuca 主应用中。

## 1. 在路由中注册页面

### 方式 A: 使用组件作为页面

```typescript
// src/router/index.ts
import { FFmpegEncoderPage } from '@/ffmpeg/components';

const routes = [
  {
    path: '/ffmpeg',
    name: 'FFmpegEncoder',
    component: FFmpegEncoderPage,
    meta: {
      title: 'FFmpeg 视频编码器',
      icon: 'videocam'
    }
  }
];
```

### 方式 B: 使用组件作为子页面

```vue
<!-- src/pages/FFmpegPage.vue -->
<template>
  <div class="page">
    <FFmpegConfigPanel />
  </div>
</template>

<script setup lang="ts">
import { FFmpegConfigPanel } from '@/ffmpeg';
</script>
```

## 2. 在侧边栏添加入口

```vue
<!-- src/components/Sidebar.vue -->
<n-menu :options="menuOptions" />

<script setup lang="ts">
import { Videocam as VideoIcon } from '@vicons/ionicons5';

const menuOptions = [
  {
    label: '视频编码',
    key: 'ffmpeg',
    icon: () => h(VideoIcon)
  },
  // ... 其他菜单项
];
</script>
```

## 3. 初始化 Store (可选)

如果需要在应用启动时预加载 FFmpeg 数据:

```typescript
// src/main.ts
import { createApp } from 'vue';
import { createPinia } from 'pinia';
import { useFFmpegParamsStore } from '@/ffmpeg';

const app = createApp(App);
const pinia = createPinia();

app.use(pinia);

// 初始化 FFmpeg Store
const ffmpegStore = useFFmpegParamsStore();
ffmpegStore.initialize();

app.mount('#app');
```

## 4. 添加国际化支持

```typescript
// src/locales/zh-CN.ts
export default {
  ffmpeg: {
    title: 'FFmpeg 视频编码器',
    subtitle: '快速生成 FFmpeg 命令行并进行视频转码',
    // ... 其他翻译
  }
};

// src/locales/en.ts
export default {
  ffmpeg: {
    title: 'FFmpeg Video Encoder',
    subtitle: 'Generate FFmpeg commands and transcode videos',
    // ... other translations
  }
};
```

## 5. 执行实际的 FFmpeg 命令

### 使用 Tauri (桌面应用)

```typescript
import { Command } from '@tauri-apps/plugin-shell';

async function executeFFmpegCommand(command: string): Promise<void> {
  try {
    const result = await Command.create('ffmpeg', command.split(' ').slice(1)).execute();
    console.log('Exit code:', result.code);
    console.log('Stdout:', result.stdout);
    console.log('Stderr:', result.stderr);
  } catch (error) {
    console.error('Failed to execute FFmpeg:', error);
  }
}

// 使用示例
const command = store.commandPreview;
await executeFFmpegCommand(command);
```

### 使用 API (Web 应用)

```typescript
async function executeFFmpegCommand(command: string): Promise<void> {
  try {
    const response = await fetch('/api/ffmpeg/execute', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ command })
    });

    const result = await response.json();
    console.log('Result:', result);
  } catch (error) {
    console.error('Failed to execute FFmpeg:', error);
  }
}
```

## 6. 添加进度显示 (阶段 2 集成)

```vue
<template>
  <FFmpegConfigPanel />

  <!-- 进度显示组件 (阶段 2) -->
  <FFmpegProgressPanel v-if="isEncoding" :progress="progress" />
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { FFmpegConfigPanel } from '@/ffmpeg';
import { executeFFmpegCommand } from './api/ffmpeg';

const isEncoding = ref(false);
const progress = ref({});

const handleStartEncoding = async () => {
  isEncoding.value = true;
  await executeFFmpegCommand(store.commandPreview, (progressData) => {
    progress.value = progressData;
  });
  isEncoding.value = false;
};
</script>
```

## 7. 配置文件位置存储

```typescript
// 保存输出目录到设置
import { useSettingsStore } from '@/stores/settings';

const settingsStore = useSettingsStore();

// 保存用户选择的输出目录
function saveOutputDirectory(path: string) {
  settingsStore.updateSettings({
    ffmpeg: {
      lastOutputDir: path
    }
  });
}

// 加载上次使用的输出目录
function loadOutputDirectory(): string {
  return settingsStore.settings.ffmpeg?.lastOutputDir || '';
}
```

## 8. 添加快捷键支持

```typescript
// src/composables/useFFmpegShortcuts.ts
import { useHotkeys } from '@vueuse/core';

export function useFFmpegShortcuts() {
  const { store } = useFFmpegParamsStore();

  // Ctrl/Cmd + N: 新建任务
  useHotkeys('ctrl+n, cmd+n', (e) => {
    e.preventDefault();
    // 添加文件逻辑
  });

  // Ctrl/Cmd + Enter: 开始转码
  useHotkeys('ctrl+enter, cmd+enter', (e) => {
    e.preventDefault();
    // 开始转码逻辑
  });

  // Ctrl/Cmd + S: 保存预设
  useHotkeys('ctrl+s, cmd+s', (e) => {
    e.preventDefault();
    // 保存预设逻辑
  });
}
```

## 9. 集成到任务系统

```typescript
// 创建 FFmpeg 转码任务
import { useTasksStore } from '@/stores/tasks';

const tasksStore = useTasksStore();

async function createFFmpegTask() {
  const task = {
    id: `ffmpeg-${Date.now()}`,
    type: 'ffmpeg',
    name: `转码: ${store.inputFiles[0].name}`,
    command: store.commandPreview,
    status: 'pending',
    progress: 0,
    createdAt: Date.now()
  };

  tasksStore.addTask(task);
  await tasksStore.startTask(task.id);
}
```

## 10. 日志记录

```typescript
import { useLogger } from '@/composables/useLogger';

const logger = useLogger('ffmpeg');

// 记录转码操作
logger.info('开始转码', {
  inputFile: store.inputFiles[0].path,
  outputFile: store.outputFile,
  preset: store.selectedPresetId
});

// 记录错误
logger.error('转码失败', {
  command: store.commandPreview,
  error: error.message
});
```

## 完整集成示例

```vue
<!-- src/pages/FFmpegPage.vue -->
<template>
  <div class="ffmpeg-page">
    <n-page-header
      :title="t('ffmpeg.title')"
      :subtitle="t('ffmpeg.subtitle')"
      @back="handleBack"
    >
      <template #extra>
        <n-space>
          <n-button @click="handleLoadExample">
            {{ t('ffmpeg.loadExample') }}
          </n-button>
          <n-button
            type="primary"
            @click="handleStartEncoding"
            :loading="isEncoding"
            :disabled="!canStartEncoding"
          >
            {{ t('ffmpeg.startEncoding') }}
          </n-button>
        </n-space>
      </template>
    </n-page-header>

    <n-card :bordered="false" style="margin-top: 24px">
      <FFmpegConfigPanel ref="configPanelRef" />
    </n-card>

    <!-- 进度面板 -->
    <FFmpegProgressPanel
      v-if="isEncoding"
      :progress="encodingProgress"
      @cancel="handleCancelEncoding"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import {
  NPageHeader,
  NCard,
  NSpace,
  NButton,
  useMessage
} from 'naive-ui';
import { FFmpegConfigPanel } from '@/ffmpeg';
import { useFFmpegParamsStore } from '@/ffmpeg/stores/ffmpegParams';
import { executeFFmpegCommand } from '@/api/ffmpeg';
import { useTasksStore } from '@/stores/tasks';
import { useFFmpegShortcuts } from '@/composables/useFFmpegShortcuts';
import { useLogger } from '@/composables/useLogger';

const router = useRouter();
const { t } = useI18n();
const message = useMessage();
const logger = useLogger('ffmpeg');
const tasksStore = useTasksStore();

const store = useFFmpegParamsStore();
const configPanelRef = ref<InstanceType<typeof FFmpegConfigPanel>>();
const isEncoding = ref(false);
const encodingProgress = ref({});

const canStartEncoding = computed(() => store.canStartEncoding);

// 初始化
onMounted(async () => {
  await store.initialize();
  useFFmpegShortcuts();
});

// 返回
const handleBack = () => {
  router.back();
};

// 加载示例
const handleLoadExample = async () => {
  store.addInputFile({
    name: 'example_video.mp4',
    path: '/path/to/example_video.mp4',
    size: 1024 * 1024 * 500,
    type: 'video'
  });

  message.success(t('ffmpeg.exampleLoaded'));
};

// 开始转码
const handleStartEncoding = async () => {
  try {
    isEncoding.value = true;

    logger.info('开始转码', {
      command: store.commandPreview,
      files: store.inputFiles.length
    });

    // 创建任务
    const taskId = `ffmpeg-${Date.now()}`;
    tasksStore.addTask({
      id: taskId,
      type: 'ffmpeg',
      name: `转码: ${store.inputFiles[0].name}`,
      command: store.commandPreview,
      status: 'running'
    });

    // 执行命令
    await executeFFmpegCommand(store.commandPreview, (progress) => {
      encodingProgress.value = progress;
      tasksStore.updateTask(taskId, { progress: progress.progress });
    });

    message.success(t('ffmpeg.encodingComplete'));
    tasksStore.updateTask(taskId, { status: 'completed' });
  } catch (error) {
    logger.error('转码失败', { error: error.message });
    message.error(t('ffmpeg.encodingFailed'));
  } finally {
    isEncoding.value = false;
  }
};

// 取消转码
const handleCancelEncoding = () => {
  isEncoding.value = false;
  message.info(t('ffmpeg.encodingCancelled'));
};
</script>
```

## 注意事项

1. **文件路径处理**: 在桌面应用中使用 Tauri 的路径 API,在 Web 应用中使用相对路径或通过 API 处理
2. **性能考虑**: 批量处理时限制并发数量,避免系统过载
3. **错误处理**: 捕获所有可能的错误并提供友好的错误提示
4. **进度反馈**: 在长时间操作时提供进度反馈
5. **日志记录**: 记录重要的操作和错误信息,便于排查问题
6. **国际化**: 所有用户可见的文本都应支持国际化
7. **响应式设计**: 确保在不同屏幕尺寸下都能良好显示

## 下一步

- 集成阶段 2 的进度解析器
- 添加实际的 FFmpeg 执行逻辑
- 实现预设导入/导出功能
- 添加批量任务队列管理
