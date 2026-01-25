# FFmpeg 视频编码模块

这是 Rebebuca 项目的 FFmpeg 视频编码模块,提供可视化的 FFmpeg 参数配置和命令行生成功能。

## 功能特性

### ✅ 已完成 (阶段 1)

- ✅ 类型定义系统 (`types/`)
  - 编码器类型定义
  - 预设数据结构
  - 进度数据类型

- ✅ 工具函数 (`utils/`)
  - 时间解析和格式化
  - 路径处理和生成
  - 文件大小和比特率转换

- ✅ 数据文件 (`data/`)
  - 编码器数据库 (encoders.json)
  - 内置预设模板 (presets.json)

- ✅ 核心服务 (`services/`)
  - `commandBuilder` - FFmpeg 命令行生成
  - `validationService` - 参数验证
  - `encoderDatabase` - 编码器信息管理

- ✅ 状态管理 (`stores/`)
  - `ffmpegParams` - Pinia Store 管理预设状态

- ✅ UI 组件 (`components/`)
  - `FFmpegConfigPanel` - 主配置面板
  - `OutputParamsPanel` - 输出配置
  - `VideoParamsPanel` - 视频参数配置
  - `AudioParamsPanel` - 音频参数配置
  - `CommandPreview` - 命令行预览

## 项目结构

```
src/ffmpeg/
├── types/                    # 类型定义
│   ├── encoder.ts            # 编码器类型
│   ├── preset.ts             # 预设类型
│   ├── progress.ts           # 进度类型
│   └── index.ts              # 统一导出
├── utils/                    # 工具函数
│   ├── time.ts               # 时间工具
│   ├── path.ts               # 路径工具
│   └── index.ts              # 统一导出
├── data/                     # 数据文件
│   ├── encoders.json         # 编码器数据库
│   ├── presets.json          # 内置预设
│   └── index.ts              # 统一导出
├── services/                 # 核心服务
│   ├── commandBuilder.ts     # 命令行生成器
│   ├── validationService.ts  # 验证服务
│   ├── encoderDatabase.ts    # 编码器数据库
│   └── index.ts              # 统一导出
├── stores/                   # 状态管理
│   └── ffmpegParams.ts      # 参数 Store
├── components/               # UI 组件
│   ├── FFmpegConfigPanel.vue    # 主面板
│   ├── OutputParamsPanel.vue    # 输出配置
│   ├── VideoParamsPanel.vue     # 视频配置
│   ├── AudioParamsPanel.vue     # 音频配置
│   ├── CommandPreview.vue       # 命令预览
│   ├── FFmpegEncoderPage.vue    # 页面示例
│   └── index.ts                 # 统一导出
└── index.ts                # 模块统一导出
```

## 快速开始

### 1. 在路由中注册页面

```typescript
// router/index.ts
import { FFmpegEncoderPage } from '@/ffmpeg/components';

const routes = [
  {
    path: '/ffmpeg',
    component: FFmpegEncoderPage
  }
];
```

### 2. 在页面中使用组件

```vue
<template>
  <div>
    <FFmpegConfigPanel />
  </div>
</template>

<script setup lang="ts">
import { FFmpegConfigPanel } from '@/ffmpeg';
</script>
```

### 3. 编程式使用

```typescript
import { commandBuilder, useFFmpegParamsStore } from '@/ffmpeg';
import type { FFmpegPreset } from '@/ffmpeg/types';

// 使用 Store
const store = useFFmpegParamsStore();
await store.initialize();

// 应用预设
store.applyPreset('builtin-1080p-h264');

// 添加输入文件
store.addInputFile({
  name: 'video.mp4',
  path: '/path/to/video.mp4',
  size: 1024 * 1024 * 500,
  type: 'video'
});

// 生成命令
const command = await commandBuilder.build(
  store.currentPreset,
  '/path/to/video.mp4',
  '/path/to/output.mp4'
);
console.log(command);
// ffmpeg -i /path/to/video.mp4 -c:v libx264 -preset medium -crf 23 /path/to/output.mp4
```

## API 文档

### commandBuilder

```typescript
// 生成单条命令
const command = await commandBuilder.build(preset, inputFile, outputFile?);

// 批量生成命令
const commands = await commandBuilder.buildBatch(preset, inputFiles, outputDir?);

// 验证命令
const result = commandBuilder.validateCommand(preset);
```

### validationService

```typescript
// 完整验证
const result = validationService.validatePreset(preset);

// 快速验证
const result = validationService.quickValidate(preset);

// 结果结构
interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}
```

### encoderDatabase

```typescript
// 获取视频编码器
const encoders = encoderDatabase.getVideoEncoders();
const encoder = encoderDatabase.getVideoEncoder('libx264');

// 获取音频编码器
const audioEncoders = encoderDatabase.getAudioEncoders();

// 获取容器支持
const supportedVideo = encoderDatabase.getSupportedVideoEncoders('mp4');
const supportedAudio = encoderDatabase.getSupportedAudioEncoders('mp4');
```

### useFFmpegParamsStore

```typescript
const store = useFFmpegParamsStore();

// 初始化
await store.initialize();

// 应用预设
store.applyPreset('builtin-1080p-h264');

// 更新配置
store.updateVideoConfig({ encoder: 'libx265' });
store.updateAudioConfig({ bitrate: '256k' });

// 文件管理
store.addInputFile(file);
store.removeInputFile(0);
store.clearInputFiles();

// 保存预设
const presetId = await store.savePreset('My Preset', 'Description');

// 删除预设
await store.deleteCustomPreset(presetId);
```

## 内置预设

系统提供了 10 个内置预设模板:

1. **1080p H.264 (推荐)** - 通用 1080p 编码
2. **720p H.264 (移动端)** - 适合移动设备和网络传输
3. **4K H.265 (高清)** - 高质量 4K 编码
4. **快速压缩 (H.264)** - 快速编码,适合紧急处理
5. **高质量压制 (H.265)** - 高质量二遍编码
6. **Web 优化 (VP9)** - 适合网页视频
7. **音频提取 (AAC)** - 仅提取音频流
8. **格式转换 (Copy)** - 不重新编码,仅转换容器
9. **批量缩放 (1080p)** - 将视频缩放到 1080p
10. **AV1 新一代编码** - 使用 AV1 编码器

## 开发指南

### 添加新的编码器

1. 在 `data/encoders.json` 中添加编码器配置
2. 确保配置包含所有必需的字段
3. 重新编译项目

### 添加新的预设

1. 在 `data/presets.json` 中添加预设配置
2. 确保 preset 字段包含完整的 FFmpegPreset 结构
3. 设置合适的标签和描述

### 添加新的滤镜

1. 在 `types/preset.ts` 中扩展 Filters 接口
2. 在 `services/commandBuilder.ts` 中实现滤镜参数生成逻辑
3. 在 UI 组件中添加相应的配置界面

## 技术栈

- **Vue 3** - Composition API
- **TypeScript** - 类型安全
- **Pinia** - 状态管理
- **Naive UI** - UI 组件库
- **FFmpeg** - 视频处理

## 后续计划 (阶段 2-5)

- [ ] 阶段 2: 进度解析器
  - 实时进度显示
  - 性能信息显示
  - 剩余时间估算
  - 错误识别

- [ ] 阶段 3: 预设系统
  - 预设管理 UI
  - 3FUI 预设导入/导出
  - 预设模板库
  - 快速向导模式

- [ ] 阶段 4: 高级功能
  - 视频滤镜 UI
  - 色彩管理
  - 剪辑区间
  - 二遍编码

- [ ] 阶段 5: 优化完善
  - 性能优化
  - 简单/专家模式
  - 批量任务队列
  - 错误处理优化

## 贡献指南

欢迎贡献代码、报告问题或提出建议！

## 许可证

GPL-3.0
