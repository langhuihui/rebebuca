# FFmpeg 模块快速参考

## 快速开始

```vue
<template>
  <FFmpegConfigPanel />
</template>

<script setup lang="ts">
import { FFmpegConfigPanel } from '@/ffmpeg';
</script>
```

## 常用 API

### Store

```typescript
import { useFFmpegParamsStore } from '@/ffmpeg';

const store = useFFmpegParamsStore();

// 初始化
await store.initialize();

// 应用预设
store.applyPreset('builtin-1080p-h264');

// 添加文件
store.addInputFile({ name, path, size, type });

// 更新配置
store.updateVideoConfig({ encoder: 'libx265' });
store.updateAudioConfig({ bitrate: '256k' });

// 保存预设
await store.savePreset('My Preset');
```

### CommandBuilder

```typescript
import { commandBuilder } from '@/ffmpeg';

// 生成命令
const command = await commandBuilder.build(preset, inputFile, outputFile);

// 批量生成
const commands = await commandBuilder.buildBatch(preset, inputFiles);

// 验证
const result = commandBuilder.validateCommand(preset);
```

### ValidationService

```typescript
import { validationService } from '@/ffmpeg';

// 完整验证
const result = validationService.validatePreset(preset);

// 快速验证
const result = validationService.quickValidate(preset);
```

### EncoderDatabase

```typescript
import { encoderDatabase } from '@/ffmpeg';

// 获取编码器
const videoEncoders = encoderDatabase.getVideoEncoders();
const audioEncoders = encoderDatabase.getAudioEncoders();

// 获取容器支持的编码器
const supported = encoderDatabase.getSupportedVideoEncoders('mp4');
```

## 内置预设

| ID | 名称 | 用途 |
|---|---|---|
| builtin-1080p-h264 | 1080p H.264 (推荐) | 通用 1080p 编码 |
| builtin-720p-h264 | 720p H.264 (移动端) | 移动设备优化 |
| builtin-4k-h265 | 4K H.265 (高清) | 高质量 4K 编码 |
| builtin-fast-compress | 快速压缩 (H.264) | 快速编码 |
| builtin-high-quality | 高质量压制 (H.265) | 专业压制 |

## 支持的编码器

### 视频编码器
- **H.264**: libx264
- **H.265**: libx265
- **VP9**: libvpx-vp9
- **AV1**: libaom-av1
- **MPEG-4**: mpeg4
- **ProRes**: prores_ks
- **Copy**: 直接复制

### 音频编码器
- **AAC**: aac
- **Opus**: libopus
- **MP3**: libmp3lame
- **FLAC**: flac
- **Vorbis**: libvorbis
- **AC3**: ac3
- **Copy**: 直接复制

## 支持的容器

- MP4 (最常用)
- MKV (支持多种编码)
- AVI (经典格式)
- MOV (QuickTime)
- WebM (Web 优化)
- FLV (Flash Video)

## 质量控制模式

| 模式 | 说明 | 适用场景 |
|---|---|---|
| CRF | 恒定质量 | 大多数场景 |
| VBR | 动态码率 | 需要控制文件大小 |
| VBR_HQ | 高质量 VBR | 专业压制 |
| CBR | 恒定码率 | 流媒体 |
| CQP | 恒定量化 | 特殊需求 |

## CRF 值参考 (H.264)

| 值 | 质量 | 文件大小 | 用途 |
|---|---|---|---|
| 18-23 | 高质量 | 大 | 归档/专业 |
| 23-28 | 中等质量 | 中 | 通用/共享 |
| 28-34 | 低质量 | 小 | 快速预览 |

## 文件结构

```
src/ffmpeg/
├── types/              # 类型定义
├── utils/              # 工具函数
├── data/               # 数据文件
├── services/           # 核心服务
├── stores/             # 状态管理
└── components/         # UI 组件
```

## 常用命令示例

### 基本 H.264 编码
```bash
ffmpeg -i input.mp4 -c:v libx264 -preset medium -crf 23 -c:a aac -b:a 192k output.mp4
```

### H.265 高质量编码
```bash
ffmpeg -i input.mp4 -c:v libx265 -preset medium -crf 20 -c:a aac -b:a 256k output.mp4
```

### Copy 模式
```bash
ffmpeg -i input.mp4 -c:v copy -c:a copy output.mp4
```

### 缩放到 720p
```bash
ffmpeg -i input.mp4 -vf scale=-1:720 -c:v libx264 -crf 24 output.mp4
```

### 剪辑视频
```bash
ffmpeg -i input.mp4 -ss 00:00:10 -t 00:01:00 -c:v libx264 -crf 23 output.mp4
```

## 故障排除

### 问题: CRF 值超出范围
**错误**: CRF 值必须在 0 到 51 之间
**解决**: 调整 CRF 值到有效范围

### 问题: 编码器不支持容器
**错误**: 编码器 libx265 不支持容器 mp4
**解决**:
1. 切换到支持的容器 (如 MKV)
2. 或切换到支持的编码器 (如 libx264)

### 问题: 文件路径包含特殊字符
**错误**: 命令执行失败
**解决**: 使用 `escapePathForCommand()` 转义路径

## 进阶用法

### 自定义滤镜
```typescript
store.updateFiltersConfig({
  scale: { enabled: true, width: '1920', height: '1080', keepAspect: true },
  crop: { enabled: true, width: '1920', height: '1080', x: '0', y: '0' }
});
```

### 二遍编码
```typescript
store.updateVideoConfig({ passMode: 2 });
store.updateQualityConfig({
  controlMode: 'VBR_HQ',
  value: '20',
  bitrate: { base: '8M', min: '4M', max: '12M' }
});
```

### 剪辑区间
```typescript
store.updateTrimmingConfig({
  enabled: true,
  startTime: '00:00:10.000',
  endTime: '00:01:00.000'
});
```

## 相关文档

- [完整文档](./README.md)
- [集成指南](./INTEGRATION_GUIDE.md)
- [实现摘要](./IMPLEMENTATION_SUMMARY.md)
- [PRD](../../../.vibe/docs/FFmpeg_PRD.md)
- [模块详细设计](../../../.vibe/docs/模块详细设计.md)

## 支持

- 问题反馈: GitHub Issues
- 功能建议: GitHub Discussions
- 文档贡献: Pull Requests

---

**版本**: v0.1.0
**更新时间**: 2026-01-25
