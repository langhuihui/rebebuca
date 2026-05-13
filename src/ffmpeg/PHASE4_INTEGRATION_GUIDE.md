# FFmpeg 高级功能 - 阶段 4 集成指南

## 概述

阶段 4 实现了 FFmpeg 的高级功能，包括视频滤镜、色彩管理、剪辑区间、二遍编码和硬件加速支持。

## 新增组件

### 1. 滤镜配置组件

#### FilterConfigPanel
- **路径**: `components/filters/FilterConfigPanel.vue`
- **功能**: 滤镜配置主面板，包含所有滤镜的标签页
- **使用方式**:
```vue
<FilterConfigPanel />
```

#### BasicFiltersPanel
- **路径**: `components/filters/BasicFiltersPanel.vue`
- **功能**: 基础滤镜配置
  - ✂️ 裁剪 (crop)
  - 📐 缩放 (scale)
  - 🔄 帧率 (fps)
  - ↻ 旋转/翻转 (transform)
- **支持的滤镜**:
  - `crop`: 宽度、高度、X、Y 位置
  - `scale`: 宽度、高度、保持宽高比、缩放算法
  - `fps`: 目标帧率
  - `transform`: 旋转角度、水平翻转、垂直翻转

#### AdvancedFiltersPanel
- **路径**: `components/filters/AdvancedFiltersPanel.vue`
- **功能**: 高级滤镜配置
  - 📺 去隔行 (deinterlace)
  - 🔇 降噪 (denoise)
  - 🔍 锐化 (sharpen)
  - ⏱️ 插帧 (interframe)
- **支持的滤镜**:
  - `yadif`: Yet Another Deinterlacing Filter
  - `bwdif`: Bob Weaver Deinterlacing Filter
  - `nlmeans`: NLMeans 降噪（高质量）
  - `hqdn3d`: HQDN3D 降噪（快速）
  - `unsharp`: 锐化滤镜
  - `minterpolate`: 插帧滤镜

#### SubtitleFilterPanel
- **路径**: `components/filters/SubtitleFilterPanel.vue`
- **功能**: 字幕烧录配置
  - 支持内置字幕和外部字幕文件
  - 字幕样式配置（字体、大小、颜色、对齐等）
  - 实时样式预览
- **支持的格式**: SRT, ASS, SSA, VTT

#### ColorManagementPanel
- **路径**: `components/filters/ColorManagementPanel.vue`
- **功能**: 色彩管理配置
  - 像素格式（yuv420p, yuv422p, yuv444p, 10-bit 等）
  - 色彩空间（bt709, bt2020 等）
  - 传输特性（bt709, smpte2084/PQ, arib-std-b67/HLG）
  - 原色（bt709, bt2020, DCI-P3）
  - 色彩范围（tv/limited, pc/full）
- **快速预设**: SDR, HDR10, HLG

#### FilterChainEditor
- **路径**: `components/filters/FilterChainEditor.vue`
- **功能**: 滤镜链编辑器
  - 查看所有已启用的滤镜
  - 拖拽排序滤镜顺序
  - 自定义滤镜输入
  - 滤镜链预览和复制

### 2. 剪辑区间组件

#### TrimmingPanel
- **路径**: `components/TrimmingPanel.vue`
- **功能**: 剪辑区间配置
  - 时间选择器（开始/结束时间）
  - 时长显示和帧数估算
  - 快速设置（首分钟、前30秒、前10秒、前5秒）
  - 自定义秒数设置
  - 时间轴可视化预览
- **时间格式**: HH:MM:SS.mmm

### 3. 二遍编码组件

#### TwoPassPanel
- **路径**: `components/TwoPassPanel.vue`
- **功能**: 二遍编码配置
  - 编码方式选择（单次/二遍）
  - 日志文件路径配置
  - 二遍编码优缺点说明
  - 推荐场景指南
  - 编码预设建议
  - CRF 模式警告和自动切换到 VBR

### 4. 硬件加速组件

#### HardwareAcceleratorPanel
- **路径**: `components/HardwareAcceleratorPanel.vue`
- **功能**: 硬件加速配置
  - 硬件加速方式选择（NVENC, QSV, AMF, VideoToolbox, VAAPI）
  - 硬件设备配置
  - 平台信息显示
  - GPU 信息检测
  - NVENC 选项（预设、编码器）
  - Intel QSV 选项（编码器）
  - AMD AMF 选项（编码器）
  - 性能对比表格
  - 快速切换按钮

## 集成方式

### 1. 在 FFmpegEncoderPage 中集成

```vue
<template>
  <n-space vertical :size="16">
    <!-- 现有的配置面板 -->
    <OutputParamsPanel />
    <VideoParamsPanel />
    <AudioParamsPanel />

    <!-- 阶段 4: 高级功能 -->
    <FilterConfigPanel />
    <TrimmingPanel />
    <TwoPassPanel />
    <HardwareAcceleratorPanel />

    <!-- 命令预览 -->
    <CommandPreview />
  </n-space>
</template>

<script setup lang="ts">
import {
  FilterConfigPanel,
  TrimmingPanel,
  TwoPassPanel,
  HardwareAcceleratorPanel
} from './components';
</script>
```

### 2. 使用 Store 更新滤镜配置

```typescript
import { useFFmpegParamsStore } from './stores/ffmpegParams';

const ffmpegParams = useFFmpegParamsStore();

// 更新滤镜配置
ffmpegParams.updateFiltersConfig({
  crop: {
    enabled: true,
    width: '1920',
    height: '1080',
    x: '0',
    y: '0'
  },
  scale: {
    enabled: true,
    width: '1280',
    height: '-1',
    keepAspect: true,
    algorithm: 'bicubic'
  }
});

// 更新剪辑配置
ffmpegParams.updateTrimmingConfig({
  enabled: true,
  startTime: '00:00:00.000',
  endTime: '00:01:00.000'
});

// 更新视频配置（二遍编码）
ffmpegParams.updateVideoConfig({
  passMode: 2,
  passLogFile: 'ffmpeg2pass.log',
  preset: 'slow'
});

// 更新解码器配置（硬件加速）
ffmpegParams.updatePreset({
  decoder: {
    hwaccel: 'cuda',
    hwaccelDevice: '0'
  }
});
```

## 数据结构

### 滤镜配置 (Filters)

```typescript
interface Filters {
  crop?: {
    enabled: boolean;
    width: string;
    height: string;
    x: string;
    y: string;
  };

  scale?: {
    enabled: boolean;
    width: string;
    height: string;
    keepAspect: boolean;
    algorithm?: string;
  };

  framerate?: {
    enabled: boolean;
    fps: string;
    mode?: number;
  };

  deinterlace?: {
    enabled: boolean;
    mode: number; // 0=yadif, 1=bwdif, 2=yadif 2x
  };

  denoise?: {
    enabled: boolean;
    mode: 'nlmeans' | 'hqdn3d';
    strength: string;
  };

  sharpen?: {
    enabled: boolean;
    strength: string;
  };

  subtitle?: {
    enabled: boolean;
    source: 'embedded' | 'external';
    file?: string;
    streamIndex?: number;
    styling?: SubtitleStyling;
  };

  transform?: {
    enabled: boolean;
    rotation: string; // 0, 90, 180, 270
    flipH?: boolean;
    flipV?: boolean;
  };

  colorManagement?: {
    enabled: boolean;
    pixelFormat: string;
    colorSpace: string;
    transfer: string;
    primaries: string;
    range?: string;
  };

  // 扩展: 插帧滤镜
  interframe?: {
    enabled: boolean;
    targetFps: number;
  };
}
```

## CommandBuilder 更新

### 新增滤镜支持

CommandBuilder 已更新以支持以下新增功能：

1. **插帧滤镜** (minterpolate)
   - 使用 `minterpolate` 滤镜进行帧插值
   - 参数: `fps=目标帧率:mi_mode=mcblend:me_mode=bidirpel:vsbmc=1`

2. **改进的去隔行滤镜**
   - 支持 yadif, bwdif, yadif 2x 模式

3. **改进的降噪滤镜**
   - NLMeans: `nlmeans=s=强度`
   - HQDN3D: `hqdn3d=spatial:chroma:temporal`

4. **改进的字幕滤镜**
   - 正确处理内部和外部字幕
   - 支持字幕样式参数

5. **改进的滤镜路径转义**
   - 新增 `escapePathForFilter` 方法处理滤镜中的路径

## 使用示例

### 示例 1: 基础滤镜链

```typescript
const preset = {
  filters: {
    crop: {
      enabled: true,
      width: '1920',
      height: '1080',
      x: '0',
      y: '80'
    },
    scale: {
      enabled: true,
      width: '1280',
      height: '-1',
      keepAspect: true,
      algorithm: 'bicubic'
    },
    framerate: {
      enabled: true,
      fps: '30'
    }
  }
};

// 生成的命令: -vf crop=1920:1080:0:80,scale=1280:-1:force_original_aspect_ratio=decrease,fps=30
```

### 示例 2: 高级滤镜链

```typescript
const preset = {
  filters: {
    deinterlace: {
      enabled: true,
      mode: 1 // bwdif
    },
    denoise: {
      enabled: true,
      mode: 'nlmeans',
      strength: '5'
    },
    sharpen: {
      enabled: true,
      strength: '1.5'
    },
    interframe: {
      enabled: true,
      targetFps: 60
    }
  }
};

// 生成的命令: -vf bwdif,nlmeans=s=5,unsharp=luma=1.5:luma_radius=5:chroma=0.75:chroma_radius=5,minterpolate=fps=60:mi_mode=mcblend:me_mode=bidirpel:vsbmc=1
```

### 示例 3: 字幕烧录

```typescript
const preset = {
  filters: {
    subtitle: {
      enabled: true,
      source: 'external',
      file: '/path/to/subtitle.srt',
      styling: {
        forceStyle: 'FontName=Microsoft YaHei,FontSize=24,PrimaryColour=&H00FFFFFF,Alignment=2'
      }
    }
  }
};

// 生成的命令: -vf subtitles=/path/to/subtitle.srt:force_style='FontName=Microsoft YaHei,FontSize=24,PrimaryColour=&H00FFFFFF,Alignment=2'
```

### 示例 4: HDR 色彩管理

```typescript
const preset = {
  filters: {
    colorManagement: {
      enabled: true,
      pixelFormat: 'yuv420p10le',
      colorSpace: 'bt2020nc',
      transfer: 'smpte2084',
      primaries: 'bt2020',
      range: 'tv'
    }
  }
};

// 生成的命令: -pix_fmt yuv420p10le -colorspace bt2020nc -color_trc smpte2084 -color_primaries bt2020 -color_range tv
```

### 示例 5: 剪辑区间 + 二遍编码

```typescript
const preset = {
  trimming: {
    enabled: true,
    startTime: '00:00:00.000',
    endTime: '00:01:00.000'
  },
  video: {
    passMode: 2,
    passLogFile: 'ffmpeg2pass.log',
    preset: 'slow'
  },
  quality: {
    controlMode: 'VBR',
    paramName: 'b',
    value: '0',
    bitrate: {
      base: '5M',
      min: '4M',
      max: '6M',
      bufferSize: '10M'
    }
  }
};

// 首遍命令: ffmpeg -ss 0 -t 60 -i input.mp4 -pass 1 -c:v libx264 -preset slow -b:v 5M -minrate 4M -maxrate 6M -bufsize 10M -f null -
// 二遍命令: ffmpeg -ss 0 -t 60 -i input.mp4 -pass 2 -c:v libx264 -preset slow -b:v 5M -minrate 4M -maxrate 6M -bufsize 10M output.mp4
```

### 示例 6: 硬件加速

```typescript
const preset = {
  decoder: {
    hwaccel: 'cuda',
    hwaccelDevice: '0'
  },
  video: {
    encoder: 'h264_nvenc',
    preset: 'p4' // NVENC preset
  }
};

// 生成的命令: ffmpeg -hwaccel cuda -hwaccel_device 0 -i input.mp4 -c:v h264_nvenc -preset p4 output.mp4
```

## 验收标准检查

- ✅ 支持基础滤镜 (裁剪、缩放、翻转、旋转)
- ✅ 支持高级滤镜 (降噪、锐化、插帧、去隔行)
- ✅ 支持字幕烧录
- ✅ 支持色彩管理
- ✅ 支持剪辑区间配置
- ✅ 支持二遍编码
- ✅ 支持硬件加速 (NVENC/QSV/AMF)
- ✅ 滤镜链可视化编辑
- ✅ 与 CommandBuilder 集成

## 注意事项

1. **滤镜顺序**: 滤镜的顺序会影响最终效果，建议先裁剪/缩放，再应用其他滤镜
2. **性能影响**: 复杂的滤镜链会显著增加编码时间
3. **插帧滤镜**: 插帧非常耗时，仅在需要时使用
4. **二遍编码**: 不支持 CRF 模式，会自动切换到 VBR
5. **硬件加速**: 确保系统支持相应的硬件和驱动
6. **字幕路径**: 外部字幕文件路径需要正确转义
7. **色彩管理**: HDR 视频需要正确的色彩空间和传输特性

## 依赖项

- Vue 3
- Naive UI
- Pinia
- vuedraggable (滤镜链排序)
- Node/browser APIs (文件选择)

## 测试建议

1. 单独测试每个滤镜的功能
2. 测试滤镜链的组合效果
3. 测试剪辑区间的准确性
4. 测试二遍编码的质量提升
5. 测试硬件加速的性能提升
6. 测试字幕烧录的样式
7. 测试色彩管理的色彩准确性

## 下一步

- 添加滤镜预览功能（可选）
- 优化滤镜链的性能
- 添加更多滤镜选项
- 支持自定义滤镜预设
- 添加滤镜导入/导出功能
