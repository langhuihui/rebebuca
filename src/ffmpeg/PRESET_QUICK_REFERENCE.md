# FFmpeg 预设系统 - 快速参考

## Store 快速操作

```typescript
import { usePresetsStore } from '@/ffmpeg/stores';

const presets = usePresetsStore();
```

### 初始化
```typescript
await presets.initialize();
```

### 保存预设
```typescript
const id = await presets.saveCustomPreset(name, preset, description, tags);
```

### 应用预设
```typescript
presets.selectPreset(presetId);
```

### 删除预设
```typescript
await presets.deletePreset(presetId);
```

### 复制预设
```typescript
const newId = await presets.duplicatePreset(presetId);
```

### 搜索预设
```typescript
const results = presets.searchPresets('query');
```

### 过滤预设
```typescript
const filtered = presets.filterByTags(['tag1', 'tag2']);
```

---

## 转换器快速操作

```typescript
import { presetConverter } from '@/ffmpeg/services';
```

### 从 3FUI 转换
```typescript
const result = presetConverter.convertFrom3FUI(fileContent);
if (result) {
  console.log(result.presetName, result.data);
}
```

### 转换为 3FUI
```typescript
const f3uiContent = presetConverter.convertTo3FUI(packedPreset);
```

---

## 导入导出快速操作

```typescript
import { downloadFile } from '@/utils/download';
```

### 导入 3FUI
```typescript
const ids = await presets.importFrom3FUI(file);
```

### 导出 JSON
```typescript
const json = presets.exportAsJSON(presetId);
downloadFile(json, 'preset.json');
```

### 导出 3FUI
```typescript
const f3ui = presets.exportAs3FUI(presetId);
downloadFile(f3ui, 'preset.3fui');
```

---

## 组件快速使用

### PresetsManager
```vue
<PresetsManager :on-apply-preset="handleApply" />
```

### PresetQuickSelect
```vue
<PresetQuickSelect :on-apply-preset="handleApply" />
```

### PresetImportExport
```vue
<PresetImportExport
  v-model:show-import="showImport"
  v-model:show-export="showExport"
  @import-complete="onComplete"
/>
```

---

## 常用代码片段

### 1. 保存当前配置
```typescript
const { ffmpegParams } = await import('@/ffmpeg/stores');
await presets.saveCustomPreset(
  'My Preset',
  ffmpegParams.currentPreset
);
```

### 2. 应用预设到配置
```typescript
const { ffmpegParams } = await import('@/ffmpeg/stores');
presets.selectPreset(presetId);
ffmpegParams.applyPreset(presetId);
```

### 3. 批量导入文件
```typescript
const ids = await presets.batchImportFrom3FUI(files);
```

### 4. 批量导出所有预设
```typescript
const allIds = presets.allPresets.map(p => p.id);
const exported = await presets.batchExport(allIds, 'json');
```

### 5. 获取特定分类的预设
```typescript
presets.updateFilter({ category: 'custom' });
const customPresets = presets.filteredPresets;
```

### 6. 监听预设变化
```typescript
watch(() => presets.selectedPresetId, (newId) => {
  console.log('Preset changed to:', newId);
});
```

---

## 内置预设列表

| ID | 名称 | 描述 | 标签 |
|----|------|------|------|
| builtin-1080p-h264 | 1080p H.264 (推荐) | 通用 1080p 视频编码 | 通用, 推荐, 1080p |
| builtin-720p-h264 | 720p H.264 (移动端) | 适合移动设备和网络传输 | 移动端, 720p |
| builtin-4k-h265 | 4K H.265 (高清) | 高质量 4K 视频编码 | 高清, 4K, 专业 |
| builtin-fast-compress | 快速压缩 (H.264) | 快速编码，适合紧急处理 | 快速, 压缩 |
| builtin-high-quality | 高质量压制 (H.265) | 高质量二遍编码 | 高质量, 专业, 2-pass |
| builtin-web-optimized | Web 优化 (VP9) | 适合网页视频 | Web, VP9 |
| builtin-audio-extract | 音频提取 (AAC) | 仅提取音频流 | 音频 |
| builtin-format-convert | 格式转换 (Copy) | 不重新编码，仅转换容器格式 | 转换, Copy |
| builtin-scale-1080p | 批量缩放 (1080p) | 将视频缩放到 1080p | 缩放, 1080p |
| builtin-av1-next-gen | AV1 新一代编码 | 使用 AV1 编码器，压缩效率最高 | AV1, 新一代 |

---

## 常见标签

- `通用` - 通用场景
- `推荐` - 推荐使用
- `1080p` - 1080p 分辨率
- `移动端` - 适合移动设备
- `720p` - 720p 分辨率
- `高清` - 高质量
- `4K` - 4K 分辨率
- `专业` - 专业用途
- `快速` - 快速处理
- `压缩` - 压缩优化
- `高质量` - 高质量
- `2-pass` - 二遍编码
- `Web` - Web 优化
- `VP9` - VP9 编码
- `音频` - 音频处理
- `转换` - 格式转换
- `Copy` - 不重新编码
- `缩放` - 分辨率调整
- `AV1` - AV1 编码
- `新一代` - 新一代技术

---

## 数据结构速查

### PresetMetadata
```typescript
{
  id: string;
  name: string;
  description?: string;
  version: string;
  createdAt: number;
  updatedAt: number;
  author?: string;
  tags?: string[];
}
```

### FFmpegPreset
```typescript
{
  output: { container, naming, location };
  decoder: { decoder, hwaccel, hwaccelDevice };
  video: { enabled, encoderCategory, encoder, preset, ... };
  quality: { controlMode, paramName, value, bitrate };
  filters: { crop, scale, framerate, ... };
  audio: { enabled, encoder, bitrate, ... };
  trimming: { enabled, startTime, endTime };
  streamControl: { keepOther..., ... };
  custom: { preParams, videoFilter, ... };
}
```

---

## 错误处理

### 捕获错误
```typescript
try {
  await presets.saveCustomPreset(name, preset);
} catch (error) {
  console.error('Error:', error);
  // 显示错误提示
}
```

### 检查结果
```typescript
const result = presetConverter.convertFrom3FUI(content);
if (!result) {
  console.error('Conversion failed');
  return;
}

if (result.warnings.length > 0) {
  console.warn('Warnings:', result.warnings);
}
```

---

## 性能优化

### 1. 使用计算属性
```typescript
// 好的做法
const filteredPresets = computed(() => presets.filteredPresets);

// 避免
const filteredPresets = () => presets.searchPresets(query);
```

### 2. 防抖搜索
```typescript
import { debounce } from 'lodash-es';

const debouncedSearch = debounce((query: string) => {
  presets.updateFilter({ searchQuery: query });
}, 300);
```

### 3. 批量操作
```typescript
// 好的做法
const allIds = presets.allPresets.map(p => p.id);
await presets.batchExport(allIds, 'json');

// 避免
for (const preset of presets.allPresets) {
  await presets.exportAsJSON(preset.id); // 慢
}
```

---

## 调试技巧

### 1. 查看 Store 状态
```typescript
console.log(presets.$state);
```

### 2. 监听变化
```typescript
watch(() => presets.selectedPresetId, (newId) => {
  console.log('Selected:', newId);
});
```

### 3. 导出当前配置
```typescript
console.log(JSON.stringify(presets.selectedPreset, null, 2));
```

### 4. 检查本地存储
```typescript
console.log(localStorage.getItem('rebebuca-ffmpeg-custom-presets'));
console.log(localStorage.getItem('rebebuca-ffmpeg-imported-presets'));
```

---

## 参考文档

- [完整 API 文档](./PRESET_INTEGRATION_GUIDE.md)
- [阶段 3 开发总结](./PHASE3_SUMMARY.md)
- [预设类型定义](./types/preset.ts)
