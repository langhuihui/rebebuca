# 节点组件

本目录包含 FFmpeg 可视化编辑器的节点组件。

## 组件列表

### FilterNode
滤镜节点组件,用于表示单个滤镜操作。

**端口类型**:
- 视频端口 (v): 蓝色 (#3b82f6)
- 音频端口 (a): 绿色 (#10b981)

**支持的功能**:
- 多种滤镜类型 (video, audio, merger, complex, splitter)
- 参数预览
- 启用/禁用状态
- 选中状态

### InputNode
输入节点组件,表示视频/音频输入源。

**特点**:
- 只输出端口,无输入端口
- 固定显示流类型和索引
- 固定使用 "📥" 图标

### OutputNode
输出节点组件,表示视频/音频输出目标。

**特点**:
- 只输入端口,无输出端口
- 固定显示流类型
- 固定使用 "📤" 图标

## 使用示例

```vue
<template>
  <VueFlow :node-types="nodeTypes">
    <FilterNode
      id="filter-1"
      :data="{
        name: '缩放',
        icon: '📐',
        enabled: true,
        params: { width: 1920, height: 1080 }
      }"
    />
  </VueFlow>
</template>

<script setup>
import { FilterNode, InputNode, OutputNode } from './nodes';
const nodeTypes = {
  filter: FilterNode,
  input: InputNode,
  output: OutputNode
};
</script>
```

## 端口命名规范

- 输入端口: `in-{portType}-{index}`
  - 例如: `in-v-0`, `in-a-1`

- 输出端口: `out-{portType}-{index}`
  - 例如: `out-v-0`, `out-a-1`

## 注意事项

1. 所有节点组件都使用 `@vue-flow/core` 的 `Handle` 组件创建端口
2. 端口类型必须匹配 (视频连视频,音频连音频)
3. 节点位置由父组件管理,组件本身不处理拖拽逻辑
