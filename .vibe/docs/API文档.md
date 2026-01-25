# Rebebuca FFmpeg 功能 - API 文档

> **版本**: 1.0.0
>
> **最后更新**: 2026-01-25

---

## 目录

- [一、概述](#一概述)
- [二、Store API](#二-store-api)
  - [2.1 useFFmpegParamsStore](#21-useffmpegparamsstore)
  - [2.2 usePresetsStore](#22-usepresetsstore)
  - [2.3 useProgressStore](#23-useprogressstore)
- [三、Service API](#三-service-api)
  - [3.1 CommandBuilder](#31-commandbuilder)
  - [3.2 ProgressParser](#32-progressparser)
  - [3.3 ValidationService](#33-validationservice)
  - [3.4 PresetConverter](#34-presetconverter)
  - [3.5 ErrorHandler](#35-errorhandler)
- [四、Utility API](#四-utility-api)
  - [4.1 TimeUtils](#41-timeutils)
  - [4.2 PathUtils](#42-pathutils)
  - [4.3 CommandCache](#43-commandcache)
- [五、类型定义](#五类型定义)

---

## 一、概述

本文档描述 Rebebuca FFmpeg 模块的核心 API,包括 Store、Service 和 Utility API。

### 技术栈

- **Vue 3**: 前端框架
- **Pinia**: 状态管理
- **TypeScript**: 类型系统

---

## 二、Store API

### 2.1 useFFmpegParamsStore

管理 FFmpeg 参数和输入文件状态。

#### State

```typescript
interface State {
  // 当前预设配置
  currentPreset: FFmpegPreset;

  // 内置预设
  builtinPresets: Array<PresetMetadata & { preset: FFmpegPreset }>;

  // 自定义预设
  customPresets: Array<PresetMetadata & { preset: FFmpegPreset }>;

  // 当前选中的预设 ID
  selectedPresetId: string;

  // 输入文件列表
  inputFiles: InputFile[];

  // 输出文件
  outputFile: string;

  // 生成的命令行
  commandPreview: string;

  // 验证结果
  validationResult: ValidationResult;

  // 加载状态
  loading: boolean;

  // 错误信息
  error: string | null;
}
```

#### Getters

```typescript
// 获取所有预设
allPresets: Array<PresetMetadata & { preset: FFmpegPreset }>

// 获取当前选中的预设
selectedPreset: Array<PresetMetadata & { preset: FFmpegPreset }> | undefined

// 是否有输入文件
hasInputFiles: boolean

// 是否为批量模式
isBatchMode: boolean

// 预设是否有效
isValidPreset: boolean

// 是否可以开始转码
canStartEncoding: boolean
```

#### Actions

```typescript
// 初始化 store
initialize(): Promise<void>

// 应用预设
applyPreset(presetId: string): void

// 更新预设配置
updatePreset(partialPreset: Partial<FFmpegPreset>): void

// 更新视频配置
updateVideoConfig(video: Partial<FFmpegPreset['video']>): void

// 更新音频配置
updateAudioConfig(audio: Partial<FFmpegPreset['audio']>): void

// 更新质量控制
updateQualityConfig(quality: Partial<FFmpegPreset['quality']>): void

// 更新滤镜配置
updateFiltersConfig(filters: Partial<FFmpegPreset['filters']>): void

// 更新输出配置
updateOutputConfig(output: Partial<FFmpegPreset['output']>): void

// 更新剪辑配置
updateTrimmingConfig(trimming: Partial<FFmpegPreset['trimming']>): void

// 添加输入文件
addInputFile(file: InputFile): void

// 批量添加输入文件
addInputFiles(files: InputFile[]): void

// 移除输入文件
removeInputFile(index: number): void

// 清空输入文件列表
clearInputFiles(): void

// 保存预设为自定义预设
savePreset(name: string, description?: string): Promise<string>

// 删除自定义预设
deleteCustomPreset(presetId: string): Promise<void>

// 验证当前预设
validateCurrentPreset(): void

// 更新命令预览
updateCommandPreview(): Promise<void>

// 重置为默认预设
resetToDefault(): void
```

#### 使用示例

```typescript
import { useFFmpegParamsStore } from '@/ffmpeg/stores/ffmpegParams';

const store = useFFmpegParamsStore();

// 初始化
await store.initialize();

// 更新视频配置
store.updateVideoConfig({
  encoder: 'libx265',
  preset: 'medium'
});

// 添加输入文件
store.addInputFile({
  name: 'video.mp4',
  path: '/path/to/video.mp4',
  size: 1024 * 1024 * 500,
  type: 'video'
});

// 保存预设
await store.savePreset('My Preset', 'Description');
```

---

### 2.2 usePresetsStore

管理预设列表和预设导入导出。

#### Actions

```typescript
// 获取所有预设
getAllPresets(): PresetMetadata[]

// 获取预设详情
getPreset(presetId: string): FFmpegPreset | undefined

// 保存预设
savePreset(preset: PresetMetadata & { preset: FFmpegPreset }): Promise<void>

// 删除预设
deletePreset(presetId: string): Promise<void>

// 导入预设
importPresets(file: File): Promise<PresetMetadata[]>

// 导出预设
exportPreset(presetId: string, format: 'json' | '3fui'): Promise<Blob>

// 导入 3FUI 预设
importFrom3FUI(file: File): Promise<PresetMetadata[]>

// 导出为 3FUI 格式
exportTo3FUI(presetId: string): Promise<Blob>
```

---

### 2.3 useProgressStore

管理转码进度和性能信息。

#### State

```typescript
interface State {
  // 进度信息
  progress: FFmpegProgress;

  // 性能信息
  performance: PerformanceInfo;

  // 是否正在运行
  isRunning: boolean;

  // 错误日志
  errorLog: ErrorLogEntry[];

  // 开始时间
  startTime: number | null;

  // 结束时间
  endTime: number | null;
}
```

#### Actions

```typescript
// 开始进度监控
startMonitoring(): void

// 停止进度监控
stopMonitoring(): void

// 更新进度
updateProgress(progress: FFmpegProgress): void

// 重置进度
resetProgress(): void

// 添加错误日志
addErrorLog(error: ErrorLogEntry): void

// 清空错误日志
clearErrorLog(): void
```

---

## 三、Service API

### 3.1 CommandBuilder

构建 FFmpeg 命令行。

#### Methods

```typescript
class CommandBuilder {
  /**
   * 构建完整的 FFmpeg 命令行
   */
  build(
    preset: FFmpegPreset,
    input: string,
    output: string
  ): Promise<string>

  /**
   * 批量构建命令行
   */
  buildBatch(
    preset: FFmpegPreset,
    inputs: string[]
  ): Promise<string[]>

  /**
   * 验证命令
   */
  validateCommand(command: string): ValidationResult

  /**
   * 构建视频参数
   */
  buildVideoArgs(preset: FFmpegPreset): string[]

  /**
   * 构建音频参数
   */
  buildAudioArgs(preset: FFmpegPreset): string[]

  /**
   * 构建滤镜参数
   */
  buildVideoFilters(preset: FFmpegPreset): string[]

  /**
   * 构建质量控制参数
   */
  buildQualityArgs(quality: QualityConfig): string[]

  /**
   * 构建流映射参数
   */
  buildStreamMap(preset: FFmpegPreset): string[]
}
```

#### 使用示例

```typescript
import { commandBuilder } from '@/ffmpeg/services';

const preset = {
  output: { container: 'mp4', ... },
  video: { encoder: 'libx264', ... },
  audio: { encoder: 'aac', ... }
};

const command = await commandBuilder.build(
  preset,
  'input.mp4',
  'output.mp4'
);

console.log(command);
// ffmpeg -i input.mp4 -c:v libx264 -c:a aac output.mp4
```

---

### 3.2 ProgressParser

解析 FFmpeg 进度输出。

#### Methods

```typescript
class ProgressParser {
  /**
   * 解析进度行
   */
  parse(line: string): FFmpegProgress | null

  /**
   * 解析完整输出
   */
  parseFull(output: string): FFmpegProgress

  /**
   * 解析时间字符串
   */
  parseTime(timeStr: string): number

  /**
   * 解析帧率
   */
  parseFps(fpsStr: string): number

  /**
   * 解析比特率
   */
  parseBitrate(bitrateStr: string): number

  /**
   * 估算剩余时间
   */
  estimateRemainingTime(
    progress: FFmpegProgress
  ): number | null
}
```

#### 使用示例

```typescript
import { progressParser } from '@/ffmpeg/services';

const output = 'frame= 324 fps= 30 q=23.0 size= 250MB time=00:15:30.45 bitrate=5200kbits/s speed=1.8x';
const progress = progressParser.parseFull(output);

console.log(progress);
// {
//   frame: 324,
//   fps: 30,
//   q: 23,
//   size: 250 * 1024 * 1024,
//   time: '00:15:30.45',
//   timeSeconds: 930.45,
//   bitrate: 5200,
//   speed: 1.8,
//   progress: 50,
//   remainingTime: 930
// }
```

---

### 3.3 ValidationService

验证 FFmpeg 参数。

#### Methods

```typescript
class ValidationService {
  /**
   * 快速验证
   */
  quickValidate(preset: FFmpegPreset): ValidationResult

  /**
   * 完整验证
   */
  fullValidate(preset: FFmpegPreset): ValidationResult

  /**
   * 验证视频参数
   */
  validateVideoArgs(args: string[]): ValidationResult

  /**
   * 验证音频参数
   */
  validateAudioArgs(args: string[]): ValidationResult

  /**
   * 验证滤镜链
   */
  validateFilterChain(filters: string[]): boolean

  /**
   * 验证 CRF 值
   */
  validateCRF(crf: number): boolean

  /**
   * 验证比特率
   */
  validateBitrate(bitrate: string): boolean

  /**
   * 验证分辨率
   */
  validateResolution(resolution: string): boolean

  /**
   * 验证帧率
   */
  validateFramerate(fps: string): boolean
}
```

---

### 3.4 PresetConverter

预设格式转换 (3FUI <-> Rebebuca)。

#### Methods

```typescript
class PresetConverter {
  /**
   * 从 3FUI 转换到 Rebebuca
   */
  from3FUI(3fuiData: any): FFmpegPreset

  /**
   * 转换到 3FUI
   */
  to3FUI(preset: FFmpegPreset): any

  /**
   * 批量转换
   */
  batchConvertFrom3FUI(3fuiDataArray: any[]): FFmpegPreset[]

  /**
   * 批量转换
   */
  batchConvertTo3FUI(presets: FFmpegPreset[]): any[]

  /**
   * 验证 3FUI 数据
   */
  validate3FUIData(data: any): boolean

  /**
   * 验证 Rebebuca 预设
   */
  validateRebebucaPreset(preset: FFmpegPreset): boolean
}
```

---

### 3.5 ErrorHandler

错误处理和解析。

#### Methods

```typescript
class FFmpegErrorHandler {
  /**
   * 解析错误信息
   */
  parseError(errorOutput: string): ErrorInfo

  /**
   * 批量解析错误
   */
  parseErrors(errorOutputs: string[]): ErrorInfo[]

  /**
   * 格式化错误信息
   */
  formatError(errorInfo: ErrorInfo): string

  /**
   * 获取错误解决方案
   */
  getSuggestion(errorOutput: string): string

  /**
   * 检查错误是否可以恢复
   */
  isRecoverable(errorInfo: ErrorInfo): boolean

  /**
   * 获取恢复建议
   */
  getRecoverySuggestion(errorInfo: ErrorInfo): string
}
```

#### 使用示例

```typescript
import { errorHandler } from '@/ffmpeg/services';

const errorOutput = 'No such file or directory: input.mp4';
const errorInfo = errorHandler.parseError(errorOutput);

console.log(errorInfo);
// {
//   code: 'FILE_NOT_FOUND',
//   message: '输入文件不存在或无法访问',
//   suggestion: '请检查文件路径是否正确,确保文件存在且可读',
//   severity: 'error'
// }

console.log(errorHandler.getSuggestion(errorOutput));
// 请检查文件路径是否正确,确保文件存在且可读
```

---

## 四、Utility API

### 4.1 TimeUtils

时间转换工具。

#### Methods

```typescript
class TimeUtils {
  /**
   * 格式化时间
   */
  formatTime(seconds: number): string

  /**
   * 解析时间字符串
   */
  parseTime(timeStr: string): number

  /**
   * 格式化时长
   */
  formatDuration(seconds: number): string

  /**
   * 计算时间差
   */
  timeDiff(start: number, end: number): number
}
```

#### 使用示例

```typescript
import { TimeUtils } from '@/ffmpeg/utils/time';

// 格式化时间
const formatted = TimeUtils.formatTime(123.45);
// '00:02:03.450'

// 解析时间字符串
const seconds = TimeUtils.parseTime('00:02:03.450');
// 123.45
```

---

### 4.2 PathUtils

路径处理工具。

#### Methods

```typescript
class PathUtils {
  /**
   * 转义路径
   */
  escapePath(path: string): string

  /**
   * 规范化路径
   */
  normalizePath(path: string): string

  /**
   * 获取文件名
   */
  getFileName(path: string): string

  /**
   * 获取扩展名
   */
  getExtension(path: string): string

  /**
   * 获取目录路径
   */
  getDirectoryName(path: string): string

  /**
   * 构建路径
   */
  joinPath(...parts: string[]): string
}
```

#### 使用示例

```typescript
import { PathUtils } from '@/ffmpeg/utils/path';

const fileName = PathUtils.getFileName('/path/to/video.mp4');
// 'video.mp4'

const escaped = PathUtils.escapePath('/path/to/file with spaces.mp4');
// '/path/to/file\ with\ spaces.mp4'
```

---

### 4.3 CommandCache

命令生成缓存。

#### Methods

```typescript
class CommandCache {
  /**
   * 获取缓存的命令
   */
  get(
    preset: any,
    input: string,
    output: string
  ): string | null

  /**
   * 设置缓存
   */
  set(
    preset: any,
    input: string,
    output: string,
    command: string
  ): void

  /**
   * 清空缓存
   */
  clear(): void

  /**
   * 删除过期的缓存
   */
  prune(): void

  /**
   * 获取缓存大小
   */
  size(): number

  /**
   * 获取缓存统计
   */
  getStats(): {
    size: number;
    maxSize: number;
    ttl: number;
  }
}
```

---

## 五、类型定义

### FFmpegPreset

```typescript
interface FFmpegPreset {
  output: OutputConfig;
  decoder: DecoderConfig;
  video: VideoConfig;
  quality: QualityConfig;
  filters: FilterConfig;
  audio: AudioConfig;
  trimming: TrimmingConfig;
  streamControl: StreamControlConfig;
  metadata?: MetadataConfig;
  custom: CustomConfig;
}
```

### FFmpegProgress

```typescript
interface FFmpegProgress {
  frame?: number;
  fps?: number;
  q?: number;
  time?: string;
  duration?: string;
  timeSeconds?: number;
  durationSeconds?: number;
  size?: number;
  sizeBytes?: number;
  bitrate?: number;
  speed?: number;
  progress?: number;
  remainingTime?: number;
  status?: 'analyzing' | 'encoding' | 'muxing' | 'finished' | 'error';
  error?: string;
}
```

### ValidationResult

```typescript
interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

interface ValidationError {
  field: string;
  message: string;
  code: string;
}

interface ValidationWarning {
  field: string;
  message: string;
  code: string;
}
```

### ErrorInfo

```typescript
interface ErrorInfo {
  code: string;
  message: string;
  suggestion: string;
  severity: 'error' | 'warning' | 'info';
}
```

---

**文档结束**

如有问题或建议,请联系技术支持或提交 Issue。
