<template>
  <n-space vertical :size="16">
    <n-alert type="info">
      滤镜链编辑器允许您查看和编辑所有启用的滤镜
    </n-alert>

    <!-- 滤镜链预览 -->
    <n-card title="当前滤镜链" size="small" :bordered="true">
      <template #header-extra>
        <n-space>
          <n-tag :bordered="false" type="info">
            {{ filterChain.length }} 个滤镜
          </n-tag>
          <n-button size="small" @click="copyFilterChain">
            复制
          </n-button>
        </n-space>
      </template>

      <n-space vertical :size="8">
        <div v-if="filterChain.length === 0" class="empty-state">
          <n-empty description="没有启用的滤镜">
            <template #icon>
              <span style="font-size: 48px">🔗</span>
            </template>
          </n-empty>
        </div>

        <div v-else class="filter-chain-display">
          <n-code
            :code="filterChainString"
            language="text"
            :word-wrap="true"
          />
        </div>
      </n-space>
    </n-card>

    <!-- 滤镜列表 -->
    <n-card title="已启用的滤镜" size="small" :bordered="true">
      <n-space vertical :size="8">
        <div
          v-for="(element, index) in activeFilters"
          :key="element.id"
          class="filter-item"
          :class="{ disabled: !element.enabled }"
          draggable="true"
          @dragstart="onDragStart($event, index)"
          @dragover.prevent
          @drop="onDrop($event, index)"
        >
          <n-space align="center" justify="space-between" style="width: 100%">
            <n-space align="center">
              <span class="drag-handle">⋮⋮</span>
              <span class="filter-icon">{{ element.icon }}</span>
              <span class="filter-name">{{ element.name }}</span>
            </n-space>
            <n-space align="center">
              <n-tag size="small" :type="element.enabled ? 'success' : 'default'">
                {{ element.enabled ? '启用' : '禁用' }}
              </n-tag>
              <n-button
                size="tiny"
                type="error"
                quaternary
                @click="toggleFilter(element)"
              >
                {{ element.enabled ? '禁用' : '启用' }}
              </n-button>
            </n-space>
          </n-space>

          <!-- 滤镜参数 -->
          <div v-if="element.enabled && element.params" class="filter-params">
            <n-text depth="3" style="font-size: 12px">
              {{ element.params }}
            </n-text>
          </div>
        </div>

        <div v-if="activeFilters.length === 0" class="empty-state">
          <n-empty description="没有启用的滤镜，请从其他标签页添加">
            <template #icon>
              <span style="font-size: 48px">📋</span>
            </template>
          </n-empty>
        </div>
      </n-space>
    </n-card>

    <!-- 自定义滤镜 -->
    <n-card title="自定义滤镜" size="small" :bordered="true">
      <template #header-extra>
        <n-tag :type="hasCustomFilter ? 'warning' : 'default'" :bordered="false">
          {{ hasCustomFilter ? '已覆盖' : '未启用' }}
        </n-tag>
      </template>

      <n-space vertical :size="12">
        <n-alert type="warning" v-if="hasCustomFilter">
          自定义滤镜将覆盖所有其他滤镜设置
        </n-alert>

        <n-form-item label="自定义视频滤镜">
          <n-input
            v-model:value="customFilter"
            type="textarea"
            :autosize="{ minRows: 3, maxRows: 6 }"
            placeholder="例如: scale=1920:1080,crop=1920:800:0:140"
            @update:value="onCustomFilterChange"
          />
        </n-form-item>

        <n-text depth="3" style="font-size: 12px">
          提示：多个滤镜用逗号分隔，例如: scale=1920:1080,fps=30
        </n-text>
      </n-space>
    </n-card>

    <!-- 滤镜参考 -->
    <n-collapse>
      <n-collapse-item title="滤镜参考" name="reference">
        <n-space vertical :size="8">
          <n-text strong>常用滤镜：</n-text>
          <n-code language="text">
scale=1920:1080              # 缩放
crop=1920:800:0:140          # 裁剪
fps=30                       # 设置帧率
yadif                        # 去隔行
nlmeans=s=5                  # 降噪
unsharp=luma=2:luma_radius=5 # 锐化
subtitles=file.srt           # 字幕
          </n-code>

          <n-text strong>滤镜链组合：</n-text>
          <n-code language="text">
crop=1920:1080:0:0,scale=-2:720,fps=30
          </n-code>
        </n-space>
      </n-collapse-item>
    </n-collapse>
  </n-space>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import {
  NSpace,
  NAlert,
  NCard,
  NTag,
  NButton,
  NEmpty,
  NCode,
  NText,
  NFormItem,
  NInput,
  NCollapse,
  NCollapseItem
} from 'naive-ui';
import type { Filters } from '../../types/preset';
import { useMessage } from 'naive-ui';

interface Props {
  filters: Filters;
  customFilter: string;
}

interface Emits {
  (e: 'update:customFilter', filter: string): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();
const message = useMessage();

const activeFilters = ref<ActiveFilter[]>([]);
const customFilter = ref(props.customFilter);
const draggedIndex = ref<number | null>(null);

interface ActiveFilter {
  id: string;
  name: string;
  icon: string;
  enabled: boolean;
  params?: string;
  filterType: keyof Filters;
}

// 根据当前滤镜状态生成活动滤镜列表
const generateActiveFilters = (): ActiveFilter[] => {
  const filters: ActiveFilter[] = [];
  const f = props.filters;

  // 裁剪
  if (f.crop) {
    const params = [];
    if (f.crop.width) params.push(`w:${f.crop.width}`);
    if (f.crop.height) params.push(`h:${f.crop.height}`);
    if (f.crop.x) params.push(`x:${f.crop.x}`);
    if (f.crop.y) params.push(`y:${f.crop.y}`);

    filters.push({
      id: 'crop',
      name: '裁剪',
      icon: '✂️',
      enabled: f.crop.enabled,
      params: params.join(', ') || '未设置参数',
      filterType: 'crop'
    });
  }

  // 缩放
  if (f.scale) {
    const params = [];
    if (f.scale.width) params.push(`w:${f.scale.width}`);
    if (f.scale.height) params.push(`h:${f.scale.height}`);
    if (f.scale.keepAspect) params.push('保持宽高比');
    if (f.scale.algorithm) params.push(`算法:${f.scale.algorithm}`);

    filters.push({
      id: 'scale',
      name: '缩放',
      icon: '📐',
      enabled: f.scale.enabled,
      params: params.join(', ') || '未设置参数',
      filterType: 'scale'
    });
  }

  // 帧率
  if (f.framerate) {
    filters.push({
      id: 'framerate',
      name: '帧率',
      icon: '🔄',
      enabled: f.framerate.enabled,
      params: `fps: ${f.framerate.fps}`,
      filterType: 'framerate'
    });
  }

  // 去隔行
  if (f.deinterlace) {
    const modes = ['yadif', 'bwdif', 'yadif 2x'];
    filters.push({
      id: 'deinterlace',
      name: '去隔行',
      icon: '📺',
      enabled: f.deinterlace.enabled,
      params: `模式: ${modes[f.deinterlace.mode] || 'yadif'}`,
      filterType: 'deinterlace'
    });
  }

  // 降噪
  if (f.denoise) {
    filters.push({
      id: 'denoise',
      name: '降噪',
      icon: '🔇',
      enabled: f.denoise.enabled,
      params: `${f.denoise.mode}, 强度: ${f.denoise.strength}`,
      filterType: 'denoise'
    });
  }

  // 锐化
  if (f.sharpen) {
    filters.push({
      id: 'sharpen',
      name: '锐化',
      icon: '🔍',
      enabled: f.sharpen.enabled,
      params: `强度: ${f.sharpen.strength}`,
      filterType: 'sharpen'
    });
  }

  // 字幕
  if (f.subtitle) {
    const sourceText = f.subtitle.source === 'embedded'
      ? `内置字幕流 ${f.subtitle.streamIndex}`
      : `外部文件: ${f.subtitle.file}`;
    filters.push({
      id: 'subtitle',
      name: '字幕烧录',
      icon: '📝',
      enabled: f.subtitle.enabled,
      params: sourceText,
      filterType: 'subtitle'
    });
  }

  // 旋转/翻转
  if (f.transform) {
    const transforms = [];
    if (f.transform.rotation !== '0') transforms.push(`旋转 ${f.transform.rotation}°`);
    if (f.transform.flipH) transforms.push('水平翻转');
    if (f.transform.flipV) transforms.push('垂直翻转');

    filters.push({
      id: 'transform',
      name: '旋转/翻转',
      icon: '↻',
      enabled: f.transform.enabled,
      params: transforms.join(', ') || '未启用',
      filterType: 'transform'
    });
  }

  return filters;
};

const hasCustomFilter = computed(() => !!customFilter.value);

// 生成滤镜链字符串
const filterChainString = computed(() => {
  if (hasCustomFilter.value) {
    return customFilter.value;
  }

  return activeFilters.value
    .filter(f => f.enabled)
    .map(f => {
      // 这里应该根据实际滤镜生成 FFmpeg 滤镜语法
      // 简化版，实际需要根据 filterType 和参数生成
      return f.name;
    })
    .join(',');
});

const filterChain = computed(() => activeFilters.value.filter(f => f.enabled));

// 初始化
watch(() => props.filters, () => {
  activeFilters.value = generateActiveFilters();
}, { deep: true, immediate: true });

watch(() => props.customFilter, (val) => {
  customFilter.value = val;
});

// 原生拖拽处理
const onDragStart = (event: DragEvent, index: number) => {
  draggedIndex.value = index;
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move';
  }
};

const onDrop = (event: DragEvent, dropIndex: number) => {
  if (draggedIndex.value === null || draggedIndex.value === dropIndex) {
    return;
  }

  // 重新排序数组
  const newFilters = [...activeFilters.value];
  const [removed] = newFilters.splice(draggedIndex.value, 1);
  newFilters.splice(dropIndex, 0, removed);

  activeFilters.value = newFilters;
  draggedIndex.value = null;

  message.info('滤镜顺序已更新（预览）');
};

// 切换滤镜状态
const toggleFilter = (filter: ActiveFilter) => {
  // 这里需要通过 emit 更新对应的滤镜
  // 简化处理
  message.info(`${filter.name} 已${filter.enabled ? '禁用' : '启用'}`);
};

// 自定义滤镜变化
const onCustomFilterChange = (value: string) => {
  customFilter.value = value;
  emit('update:customFilter', value);
};

// 复制滤镜链
const copyFilterChain = () => {
  if (filterChainString.value) {
    navigator.clipboard.writeText(filterChainString.value);
    message.success('滤镜链已复制到剪贴板');
  }
};
</script>

<style scoped>
.empty-state {
  padding: 20px;
  text-align: center;
}

.filter-chain-display {
  background-color: var(--n-color-embedded);
  border-radius: 4px;
  padding: 12px;
  font-family: 'Courier New', monospace;
  font-size: 12px;
  word-break: break-all;
  min-height: 60px;
}

.filter-item {
  background-color: #fafafa;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  padding: 12px;
  margin-bottom: 8px;
  transition: all 0.2s;
}

.filter-item:hover {
  border-color: #3b82f6;
  box-shadow: 0 2px 4px rgba(59, 130, 246, 0.1);
}

.filter-item.disabled {
  opacity: 0.5;
}

.drag-handle {
  cursor: move;
  color: #9ca3af;
  user-select: none;
  padding: 0 8px;
}

.drag-handle:hover {
  color: #3b82f6;
}

.filter-icon {
  font-size: 16px;
  margin-right: 8px;
}

.filter-name {
  font-weight: 500;
}

.filter-params {
  margin-top: 8px;
  padding-left: 32px;
  color: #6b7280;
  font-family: 'Courier New', monospace;
  font-size: 11px;
  background-color: #f3f4f6;
  padding: 4px 8px;
  border-radius: 4px;
}
</style>
