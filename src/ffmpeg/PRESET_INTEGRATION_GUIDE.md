# FFmpeg 预设系统集成指南

## 概述

本文档介绍如何在 Rebebuca 应用中集成和使用 FFmpeg 预设系统（阶段 3）。

---

## 快速开始

### 1. 初始化预设 Store

```typescript
import { usePresetsStore } from '@/ffmpeg/stores';

const presetsStore = usePresetsStore();

// 在应用启动时初始化
await presetsStore.initialize();
```

### 2. 在组件中使用

```vue
<template>
  <div>
    <PresetsManager
      :on-apply-preset="handleApplyPreset"
    />
  </div>
</template>

<script setup lang="ts">
import { PresetsManager } from '@/ffmpeg/components';
import { usePresetsStore } from '@/ffmpeg/stores';

const presetsStore = usePresetsStore();

function handleApplyPreset(presetId: string) {
  presetsStore.selectPreset(presetId);
  // 应用到 FFmpeg 参数
}
</script>
```

---

## API 参考

### PresetsStore

#### 状态 (State)

```typescript
{
  builtinPresets: PackedPreset[];      // 内置预设
  customPresets: PackedPreset[];       // 自定义预设
  importedPresets: PackedPreset[];     // 导入的预设
  selectedPresetId: string;            // 当前选中的预设 ID
  loading: boolean;                    // 加载状态
  error: string | null;                // 错误信息
  filter: PresetFilter;               // 过滤条件
}
```

#### 计算属性 (Getters)

```typescript
// 所有预设
allPresets: PackedPreset[]

// 过滤后的预设
filteredPresets: PackedPreset[]

// 当前选中的预设
selectedPreset: PackedPreset | undefined

// 可用的标签
availableTags: string[]

// 预设数量统计
presetCounts: {
  builtin: number;
  custom: number;
  imported: number;
  total: number;
}
```

#### 方法 (Actions)

##### 初始化

```typescript
async initialize(): Promise<void>
```

**示例**:
```typescript
await presetsStore.initialize();
```

##### 保存预设

```typescript
async saveCustomPreset(
  name: string,
  preset: FFmpegPreset,
  description?: string,
  tags: string[] = []
): Promise<string>
```

**示例**:
```typescript
const { ffmpegParams } = await import('@/ffmpeg/stores');
const presetId = await presetsStore.saveCustomPreset(
  'My Preset',
  ffmpegParams.currentPreset,
  'My custom preset description',
  ['custom', 'test']
);
```

##### 更新预设

```typescript
async updateCustomPreset(
  id: string,
  updates: Partial<PresetMetadata & { preset: FFmpegPreset }>
): Promise<boolean>
```

**示例**:
```typescript
const success = await presetsStore.updateCustomPreset(
  'custom-123',
  {
    name: 'Updated Name',
    description: 'Updated description'
  }
);
```

##### 删除预设

```typescript
async deletePreset(id: string): Promise<boolean>
```

**示例**:
```typescript
const success = await presetsStore.deletePreset('custom-123');
```

##### 复制预设

```typescript
async duplicatePreset(id: string): Promise<string | null>
```

**示例**:
```typescript
const newId = await presetsStore.duplicatePreset('builtin-1080p-h264');
```

##### 应用预设

```typescript
selectPreset(id: string): void
```

**示例**:
```typescript
presetsStore.selectPreset('builtin-1080p-h264');
```

##### 导入 3FUI 格式

```typescript
async importFrom3FUI(file: File): Promise<string[]>
```

**示例**:
```typescript
const fileInput = document.createElement('input');
fileInput.type = 'file';
fileInput.accept = '.3fui';
fileInput.onchange = async (e) => {
  const files = e.target.files;
  if (files) {
    const importedIds = await presetsStore.importFrom3FUI(files[0]);
    console.log('Imported:', importedIds);
  }
};
fileInput.click();
```

##### 批量导入

```typescript
async batchImportFrom3FUI(files: File[]): Promise<string[]>
```

**示例**:
```typescript
const files = Array.from(fileInput.files);
const importedIds = await presetsStore.batchImportFrom3FUI(files);
```

##### 导出 JSON

```typescript
exportAsJSON(id: string): string
```

**示例**:
```typescript
const jsonContent = presetsStore.exportAsJSON('custom-123');
downloadFile(jsonContent, 'preset.json');
```

##### 导出 3FUI

```typescript
exportAs3FUI(id: string): string
```

**示例**:
```typescript
const f3uiContent = presetsStore.exportAs3FUI('custom-123');
downloadFile(f3uiContent, 'preset.3fui');
```

##### 批量导出

```typescript
async batchExport(
  ids: string[],
  format: ExportFormat
): Promise<Map<string, string>>
```

**示例**:
```typescript
const exportedFiles = await presetsStore.batchExport(
  ['custom-1', 'custom-2'],
  'json'
);
for (const [filename, content] of exportedFiles) {
  downloadFile(content, filename);
}
```

##### 搜索预设

```typescript
searchPresets(query: string): PackedPreset[]
```

**示例**:
```typescript
const results = presetsStore.searchPresets('1080p');
```

##### 标签过滤

```typescript
filterByTags(tags: string[]): PackedPreset[]
```

**示例**:
```typescript
const results = presetsStore.filterByTags(['推荐', '通用']);
```

##### 更新过滤条件

```typescript
updateFilter(filter: Partial<PresetFilter>): void
```

**示例**:
```typescript
presetsStore.updateFilter({
  category: 'custom',
  searchQuery: 'test',
  tags: ['tag1', 'tag2']
});
```

##### 重置过滤条件

```typescript
resetFilter(): void
```

**示例**:
```typescript
presetsStore.resetFilter();
```

---

### PresetConverter

#### 转换方法

##### 从 3FUI 转换

```typescript
convertFrom3FUI(content: string): ConversionResult | null
```

**示例**:
```typescript
import { presetConverter } from '@/ffmpeg/services';

const fileContent = await file.text();
const result = presetConverter.convertFrom3FUI(fileContent);

if (result) {
  console.log('Preset Name:', result.presetName);
  console.log('Warnings:', result.warnings);
  console.log('Data:', result.data);
}
```

##### 转换为 3FUI

```typescript
convertTo3FUI(packedPreset: PackedPreset): string
```

**示例**:
```typescript
import { presetConverter } from '@/ffmpeg/services';

const f3uiJson = presetConverter.convertTo3FUI(packedPreset);
downloadFile(f3uiJson, 'preset.3fui');
```

---

### UI 组件

#### PresetsManager

**Props**:
```typescript
interface Props {
  onApplyPreset?: (presetId: string) => void;
}
```

**示例**:
```vue
<template>
  <PresetsManager
    :on-apply-preset="handleApplyPreset"
  />
</template>

<script setup lang="ts">
function handleApplyPreset(presetId: string) {
  console.log('Applied preset:', presetId);
}
</script>
```

#### PresetQuickSelect

**Props**:
```typescript
interface Props {
  onApplyPreset?: (presetId: string) => void;
}
```

**示例**:
```vue
<template>
  <PresetQuickSelect
    :on-apply-preset="handleApplyPreset"
  />
</template>

<script setup lang="ts">
function handleApplyPreset(presetId: string) {
  console.log('Applied preset:', presetId);
}
</script>
```

#### PresetImportExport

**Props**:
```typescript
interface Props {
  showImport?: boolean;
  showExport?: boolean;
}

// Emits
interface Emits {
  'update:showImport': [value: boolean];
  'update:showExport': [value: boolean];
  'import-complete': [];
}
```

**示例**:
```vue
<template>
  <div>
    <n-button @click="showImport = true">导入预设</n-button>
    <n-button @click="showExport = true">导出预设</n-button>

    <PresetImportExport
      v-model:show-import="showImport"
      v-model:show-export="showExport"
      @import-complete="handleImportComplete"
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

const showImport = ref(false);
const showExport = ref(false);

function handleImportComplete() {
  console.log('Import completed');
}
</script>
```

---

## 使用场景

### 场景 1: 保存当前配置为预设

```typescript
import { usePresetsStore } from '@/ffmpeg/stores';
import { useFFmpegParamsStore } from '@/ffmpeg/stores';

const presetsStore = usePresetsStore();
const ffmpegParams = useFFmpegParamsStore();

async function saveCurrentConfig() {
  const presetId = await presetsStore.saveCustomPreset(
    'My Encoding Preset',
    ffmpegParams.currentPreset,
    'Custom preset for my videos',
    ['custom', 'test']
  );

  console.log('Saved preset:', presetId);
}
```

### 场景 2: 应用预设到当前配置

```typescript
import { usePresetsStore } from '@/ffmpeg/stores';
import { useFFmpegParamsStore } from '@/ffmpeg/stores';

const presetsStore = usePresetsStore();
const ffmpegParams = useFFmpegParamsStore();

function applyPreset(presetId: string) {
  presetsStore.selectPreset(presetId);

  const preset = presetsStore.selectedPreset;
  if (preset) {
    ffmpegParams.applyPreset(presetId);
  }
}
```

### 场景 3: 导入 3FUI 预设文件

```typescript
import { usePresetsStore } from '@/ffmpeg/stores';

const presetsStore = usePresetsStore();

async function import3FUIFile(file: File) {
  try {
    const importedIds = await presetsStore.importFrom3FUI(file);
    console.log(`Imported ${importedIds.length} presets`);
  } catch (error) {
    console.error('Import failed:', error);
  }
}
```

### 场景 4: 导出预设为 3FUI 格式

```typescript
import { usePresetsStore } from '@/ffmpeg/stores';
import { downloadFile } from '@/utils/download';

const presetsStore = usePresetsStore();

function exportPresetAs3FUI(presetId: string) {
  const f3uiContent = presetsStore.exportAs3FUI(presetId);
  const preset = presetsStore.allPresets.find(p => p.id === presetId);
  const filename = `${preset?.name || 'preset'}.3fui`;

  downloadFile(f3uiContent, filename);
}
```

### 场景 5: 搜索和过滤预设

```typescript
import { usePresetsStore } from '@/ffmpeg/stores';

const presetsStore = usePresetsStore();

// 按关键词搜索
const results = presetsStore.searchPresets('1080p');

// 按标签过滤
const filtered = presetsStore.filterByTags(['推荐', '移动端']);

// 更新过滤条件
presetsStore.updateFilter({
  category: 'custom',
  searchQuery: 'test',
  tags: ['tag1']
});

// 获取过滤后的预设
const filteredPresets = presetsStore.filteredPresets;
```

---

## 数据类型

### FFmpegPreset
完整的 FFmpeg 预设配置，包含输出、视频、音频、滤镜等所有参数。

### PresetMetadata
预设元数据，包含 ID、名称、描述、版本、创建时间等。

### PackedPreset
组合的预设对象，包含元数据和预设配置。

### PresetFilter
预设过滤条件，包含分类、搜索关键词和标签。

---

## 最佳实践

### 1. 初始化时机
在应用启动时尽早初始化预设 Store，确保预设数据可用。

```typescript
// main.ts
import { createApp } from 'vue';
import { createPinia } from 'pinia';
import { usePresetsStore } from '@/ffmpeg/stores';

const app = createApp(App);
const pinia = createPinia();

app.use(pinia);

// 初始化预设 Store
const presetsStore = usePresetsStore();
await presetsStore.initialize();

app.mount('#app');
```

### 2. 错误处理
始终处理异步操作的错误。

```typescript
try {
  await presetsStore.saveCustomPreset(name, preset);
} catch (error) {
  console.error('Failed to save preset:', error);
  // 显示错误提示
}
```

### 3. 预设验证
在保存预设前验证配置的有效性。

```typescript
import { validationService } from '@/ffmpeg/services';

const validationResult = validationService.quickValidate(preset);
if (!validationResult.valid) {
  console.error('Invalid preset:', validationResult.errors);
  return;
}

await presetsStore.saveCustomPreset(name, preset);
```

### 4. 性能优化
- 使用计算属性而不是方法来获取过滤后的预设
- 批量操作时考虑使用防抖
- 大文件上传时显示进度

---

## 常见问题

### Q: 如何备份我的预设？
A: 使用批量导出功能将所有预设导出为 JSON 或 3FUI 格式。

```typescript
const allIds = presetsStore.allPresets.map(p => p.id);
const exportedFiles = await presetsStore.batchExport(allIds, 'json');
// 保存导出的文件
```

### Q: 如何从 3FUI 迁移预设？
A: 使用 PresetImportExport 组件或直接调用 importFrom3FUI 方法。

```typescript
const file = new File([...], 'preset.3fui');
const ids = await presetsStore.importFrom3FUI(file);
```

### Q: 预设存储在哪里？
A: 预设存储在浏览器的 localStorage 中：
- `rebebuca-ffmpeg-custom-presets` - 自定义预设
- `rebebuca-ffmpeg-imported-presets` - 导入的预设

### Q: 如何删除所有预设？
A: 清空 localStorage 中的预设数据。

```typescript
localStorage.removeItem('rebebuca-ffmpeg-custom-presets');
localStorage.removeItem('rebebuca-ffmpeg-imported-presets');
await presetsStore.initialize();
```

---

## 相关文档

- [阶段 3 开发总结](./PHASE3_SUMMARY.md)
- [预设类型定义](./types/preset.ts)
- [命令生成器](./services/commandBuilder.ts)
- [参数验证](./services/validationService.ts)
