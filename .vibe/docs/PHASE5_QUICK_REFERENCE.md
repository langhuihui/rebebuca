# FFmpeg 功能 - 阶段 5 快速参考

## 新增组件

### SimpleModePanel.vue
**位置**: `src/ffmpeg/components/SimpleModePanel.vue`

**功能**:
- 快速场景选择 (4种预设场景)
- 输出格式选择 (MP4, MKV, WebM)
- 视频质量控制 (CRF 滑块 18-32)
- 输出分辨率选择 (5种选项)
- 音频比特率选择 (5种选项)
- 使用提示和快速参考

**使用示例**:
```vue
<template>
  <SimpleModePanel />
</template>

<script setup lang="ts">
import SimpleModePanel from './ffmpeg/components/SimpleModePanel.vue';
</script>
```

---

### ExpertModePanel.vue
**位置**: `src/ffmpeg/components/ExpertModePanel.vue`

**功能**:
- 标签页式布局 (7个标签页)
- 视频参数配置
- 音频参数配置
- 滤镜配置
- 剪辑区间配置
- 二遍编码配置
- 硬件加速配置
- 高级选项配置
- 快速参考信息

**使用示例**:
```vue
<template>
  <ExpertModePanel />
</template>

<script setup lang="ts">
import ExpertModePanel from './ffmpeg/components/ExpertModePanel.vue';
</script>
```

---

### AdvancedOptionsPanel.vue
**位置**: `src/ffmpeg/components/AdvancedOptionsPanel.vue`

**功能**:
- 解码器配置 (解码器、硬件加速、设备)
- 流控制 (视频流、音频流、字幕流、附件流)
- 元数据配置 (标题、艺术家、专辑、年份、注释)
- 自定义参数 (输入前参数、自定义滤镜、自定义参数、输出后参数)

**使用示例**:
```vue
<template>
  <AdvancedOptionsPanel />
</template>

<script setup lang="ts">
import AdvancedOptionsPanel from './ffmpeg/components/AdvancedOptionsPanel.vue';
</script>
```

---

### BatchTaskQueue.vue
**位置**: `src/ffmpeg/components/BatchTaskQueue.vue`

**功能**:
- 任务列表显示
- 任务状态管理 (6种状态)
- 并发控制 (1-5)
- 任务操作 (开始、暂停、继续、重试、删除)
- 实时进度显示
- 统计信息
- 批量操作
- 错误信息显示

**使用示例**:
```vue
<template>
  <BatchTaskQueue />
</template>

<script setup lang="ts">
import BatchTaskQueue from './ffmpeg/components/BatchTaskQueue.vue';
</script>
```

---

## 新增工具类

### CommandCache
**位置**: `src/ffmpeg/utils/cache.ts`

**功能**:
- 命令生成缓存
- TTL 过期机制
- 自动缓存清理
- 缓存统计

**使用示例**:
```typescript
import { commandCache } from './ffmpeg/utils/cache';

// 获取缓存
const cachedCommand = commandCache.get(preset, input, output);

// 设置缓存
commandCache.set(preset, input, output, generatedCommand);

// 清空缓存
commandCache.clear();

// 获取统计
const stats = commandCache.getStats();
console.log(stats);
// { size: 10, maxSize: 100, ttl: 300000 }
```

---

### debounce / throttle
**位置**: `src/ffmpeg/utils/cache.ts`

**功能**:
- 防抖函数
- 节流函数

**使用示例**:
```typescript
import { debounce, throttle } from './ffmpeg/utils/cache';

// 防抖
const debouncedUpdate = debounce(() => {
  updateCommandPreview();
}, 300);

// 节流
const throttledUpdate = throttle(() => {
  updateCommandPreview();
}, 100);
```

---

## 新增服务类

### FFmpegErrorHandler
**位置**: `src/ffmpeg/services/errorHandler.ts`

**功能**:
- 错误模式识别 (20+ 种错误类型)
- 友好的错误信息
- 解决方案建议
- 错误严重程度分类
- 可恢复性判断
- 恢复建议生成

**使用示例**:
```typescript
import { errorHandler } from './ffmpeg/services';

// 解析错误
const errorOutput = 'No such file or directory: input.mp4';
const errorInfo = errorHandler.parseError(errorOutput);

console.log(errorInfo);
// {
//   code: 'FILE_NOT_FOUND',
//   message: '输入文件不存在或无法访问',
//   suggestion: '请检查文件路径是否正确,确保文件存在且可读',
//   severity: 'error'
// }

// 获取建议
const suggestion = errorHandler.getSuggestion(errorOutput);
console.log(suggestion);
// 请检查文件路径是否正确,确保文件存在且可读

// 检查可恢复性
const isRecoverable = errorHandler.isRecoverable(errorInfo);
const recoverySuggestion = errorHandler.getRecoverySuggestion(errorInfo);
console.log(recoverySuggestion);
// 清理磁盘空间后重试
```

---

### FFmpegError
**位置**: `src/ffmpeg/services/errorHandler.ts`

**功能**:
- 自定义错误类
- 错误类型枚举
- 错误信息结构化

**使用示例**:
```typescript
import { FFmpegError, ErrorType } from './ffmpeg/services';

try {
  // ...
} catch (error) {
  throw new FFmpegError(
    'FILE_NOT_FOUND',
    '输入文件不存在',
    ErrorType.FILE_ERROR,
    '请检查文件路径',
    error
  );
}
```

---

## 模式切换

### FFmpegConfigPanel 更新

**新增功能**:
- 模式切换按钮 (简单/专家)
- 批量队列开关
- 用户偏好持久化

**使用示例**:
```vue
<template>
  <FFmpegConfigPanel />
</template>

<script setup lang="ts">
import FFmpegConfigPanel from './ffmpeg/components/FFmpegConfigPanel.vue';
</script>
```

---

## 文档

### 用户使用手册
**位置**: `.vibe/docs/用户使用手册.md`

**内容**:
- 快速入门指南
- 简单模式说明
- 专家模式详细说明
- 批量处理指南
- 预设管理指南
- 常见问题解答
- 参数参考表
- 快捷键列表

---

### API 文档
**位置**: `.vibe/docs/API文档.md`

**内容**:
- Store API 文档
- Service API 文档
- Utility API 文档
- 类型定义文档
- 使用示例

---

### 集成测试指南
**位置**: `.vibe/docs/集成测试指南.md`

**内容**:
- 测试概述
- 单元测试用例
- 集成测试用例
- E2E 测试用例
- 性能测试用例
- 测试报告格式

---

## 快速场景

### SimpleModePanel 场景

1. **保持原画质**
   - CRF: 20
   - 分辨率: 原分辨率
   - 音频: 320k

2. **快速压缩**
   - CRF: 28
   - 分辨率: 720p
   - 音频: 128k

3. **格式转换**
   - CRF: 23
   - 分辨率: 原分辨率
   - 音频: 192k

4. **高质量**
   - CRF: 18
   - 分辨率: 1080p
   - 音频: 320k

---

## 错误类型

### 文件错误
- `FILE_NOT_FOUND`: 输入文件不存在
- `PERMISSION_DENIED`: 权限不足
- `NO_SPACE`: 磁盘空间不足

### 编码器错误
- `UNKNOWN_ENCODER`: 不支持的编码器
- `UNKNOWN_DECODER`: 不支持的解码器

### 参数错误
- `INVALID_PIXEL_FORMAT`: 像素格式无效
- `UNSUPPORTED_COLOR_SPACE`: 颜色空间不支持
- `INVALID_BITRATE`: 比特率格式无效
- `INVALID_FRAMERATE`: 帧率值无效
- `CRF_OUT_OF_RANGE`: CRF 值超出范围
- `INVALID_RESOLUTION`: 分辨率无效

### 系统错误
- `OUT_OF_MEMORY`: 内存不足

### 硬件加速错误
- `HWACCEL_NOT_AVAILABLE`: 硬件加速不可用
- `NVENC_ERROR`: NVENC 错误
- `QSV_ERROR`: Intel QSV 错误
- `AMF_ERROR`: AMD AMF 错误

### 字幕错误
- `SUBTITLE_FILE_NOT_FOUND`: 字幕文件不存在

---

## 性能优化技巧

### 1. 使用缓存
```typescript
// 启用命令生成缓存
import { commandCache } from './ffmpeg/utils/cache';
```

### 2. 使用防抖
```typescript
// 参数变化时防抖
const debouncedUpdate = debounce(() => {
  updateCommandPreview();
}, 300);
```

### 3. 使用节流
```typescript
// 高频更新时节流
const throttledUpdate = throttle(() => {
  updateProgress();
}, 100);
```

### 4. 批量操作
```typescript
// 批量添加文件
store.addInputFiles(files);
```

---

## 常见用法

### 切换模式
```typescript
// 自动持久化到 localStorage
localStorage.getItem('rebebuca-ffmpeg-mode'); // 'simple' | 'expert'
```

### 批量处理
```vue
<template>
  <BatchTaskQueue />
</template>

<script setup lang="ts">
import BatchTaskQueue from './ffmpeg/components/BatchTaskQueue.vue';
</script>
```

### 错误处理
```typescript
try {
  const command = await commandBuilder.build(preset, input, output);
} catch (error) {
  const errorInfo = errorHandler.parseError(error.message);
  console.error(errorInfo.message);
  console.log('建议:', errorInfo.suggestion);
}
```

---

## 导入导出

### 从组件导入
```typescript
import {
  SimpleModePanel,
  ExpertModePanel,
  BatchTaskQueue,
  AdvancedOptionsPanel
} from './ffmpeg/components';

import {
  commandCache,
  debounce,
  throttle
} from './ffmpeg/utils';

import {
  errorHandler,
  FFmpegError,
  ErrorType
} from './ffmpeg/services';
```

---

## 下一步

1. **集成实际的 FFmpeg 执行**
   - 使用 Tauri 的 shell 命令
   - 处理真实的 FFmpeg 输出

2. **完善测试**
   - 运行单元测试
   - 运行集成测试
   - 运行 E2E 测试

3. **性能测试**
   - 在真实环境中测试性能
   - 优化热点代码

4. **文档完善**
   - 根据实际使用情况更新文档
   - 添加更多示例

---

**文档版本**: 1.0.0
**最后更新**: 2026-01-25
