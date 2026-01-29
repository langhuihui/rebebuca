<template>
  <div class="graph-toolbar">
    <!-- 布局控制 -->
    <n-space :size="8" align="center">
      <n-tooltip>
        <template #trigger>
          <n-button
            size="small"
            :type="autoLayout ? 'primary' : 'default'"
            @click="$emit('toggle-auto-layout', !autoLayout)"
          >
            <template #icon>
              <n-icon>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M21 6H3M10 12H3M10 18H3M14 12h7l-3-3m0 6l3-3"/>
                </svg>
              </n-icon>
            </template>
          </n-button>
        </template>
        自动布局
      </n-tooltip>

      <n-tooltip>
        <template #trigger>
          <n-button
            size="small"
            :type="snapToGrid ? 'primary' : 'default'"
            @click="$emit('toggle-snap-to-grid', !snapToGrid)"
          >
            <template #icon>
              <n-icon>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                  <line x1="9" y1="3" x2="9" y2="21"/>
                  <line x1="15" y1="3" x2="15" y2="21"/>
                  <line x1="3" y1="9" x2="21" y2="9"/>
                  <line x1="3" y1="15" x2="21" y2="15"/>
                </svg>
              </n-icon>
            </template>
          </n-button>
        </template>
        网格吸附
      </n-tooltip>

      <n-tooltip>
        <template #trigger>
          <n-button
            size="small"
            :type="showMiniMap ? 'primary' : 'default'"
            @click="$emit('toggle-mini-map', !showMiniMap)"
          >
            <template #icon>
              <n-icon>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="2" y="2" width="20" height="20" rx="2" ry="2"/>
                  <rect x="6" y="6" width="8" height="8" rx="1" ry="1"/>
                  <path d="M14 6l6 0l0 6"/>
                </svg>
              </n-icon>
            </template>
          </n-button>
        </template>
        小地图
      </n-tooltip>
    </n-space>

    <!-- 历史记录控制 -->
    <n-space :size="8" align="center">
      <n-divider vertical />

      <n-tooltip>
        <template #trigger>
          <n-button
            size="small"
            :disabled="!canUndo"
            @click="$emit('undo')"
          >
            <template #icon>
              <n-icon>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M3 7v6h6"/>
                  <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/>
                </svg>
              </n-icon>
            </template>
            撤销
          </n-button>
        </template>
        <span v-if="lastUndoDescription">撤销: {{ lastUndoDescription }}</span>
        <span v-else>撤销 (Ctrl+Z)</span>
      </n-tooltip>

      <n-tooltip>
        <template #trigger>
          <n-button
            size="small"
            :disabled="!canRedo"
            @click="$emit('redo')"
          >
            <template #icon>
              <n-icon>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M21 7v6h-6"/>
                  <path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3 3.7"/>
                </svg>
              </n-icon>
            </template>
            重做
          </n-button>
        </template>
        <span v-if="lastRedoDescription">重做: {{ lastRedoDescription }}</span>
        <span v-else>重做 (Ctrl+Y)</span>
      </n-tooltip>

      <!-- 历史记录计数器 -->
      <n-badge
        :value="undoCount"
        :show="undoCount > 0"
        :max="99"
        :offset="[-5, 5]"
      >
        <n-text depth="3" style="font-size: 11px">
          {{ undoCount }} / {{ undoCount + redoCount }}
        </n-text>
      </n-badge>
    </n-space>

    <!-- 视图控制 -->
    <n-space :size="8" align="center">
      <n-tooltip>
        <template #trigger>
          <n-button size="small" @click="$emit('fit-view')">
            <template #icon>
              <n-icon>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="10"/>
                  <circle cx="12" cy="12" r="6"/>
                  <circle cx="12" cy="12" r="2"/>
                </svg>
              </n-icon>
            </template>
          </n-button>
        </template>
        适配视图
      </n-tooltip>

      <n-tooltip>
        <template #trigger>
          <n-button size="small" @click="$emit('zoom-in')">
            <template #icon>
              <n-icon>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19"/>
                  <line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
              </n-icon>
            </template>
          </n-button>
        </template>
        放大
      </n-tooltip>

      <n-tooltip>
        <template #trigger>
          <n-button size="small" @click="$emit('zoom-out')">
            <template #icon>
              <n-icon>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
              </n-icon>
            </template>
          </n-button>
        </template>
        缩小
      </n-tooltip>

      <n-tooltip>
        <template #trigger>
          <n-button size="small" @click="$emit('reset-view')">
            <template #icon>
              <n-icon>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="23 4 23 10 17 10"/>
                  <polyline points="1 20 1 14 7 14"/>
                  <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
                </svg>
              </n-icon>
            </template>
          </n-button>
        </template>
        重置视图
      </n-tooltip>

      <n-divider vertical />

      <n-dropdown :options="layoutOptions" @select="onLayoutSelect">
        <n-button size="small">
          <template #icon>
            <n-icon>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="20" x2="18" y2="10"/>
                <line x1="12" y1="20" x2="12" y2="4"/>
                <line x1="6" y1="20" x2="6" y2="14"/>
              </svg>
            </n-icon>
          </template>
          布局
        </n-button>
      </n-dropdown>
    </n-space>
  </div>
</template>

<script setup lang="ts">
import { ref, h, computed } from 'vue';
import { NButton, NSpace, NTooltip, NDivider, NDropdown, NBadge, NText, NIcon } from 'naive-ui';
import type { LayoutMode } from '@/ffmpeg/types/preset';
import { useFFmpegParamsStore } from '@/ffmpeg/stores/ffmpegParams';

interface Props {
  autoLayout: boolean;
  snapToGrid: boolean;
  showMiniMap: boolean;
}

defineProps<Props>();
const emit = defineEmits<{
  (e: 'toggle-auto-layout', value: boolean): void;
  (e: 'toggle-snap-to-grid', value: boolean): void;
  (e: 'toggle-mini-map', value: boolean): void;
  (e: 'fit-view'): void;
  (e: 'zoom-in'): void;
  (e: 'zoom-out'): void;
  (e: 'reset-view'): void;
  (e: 'layout', mode: LayoutMode): void;
  (e: 'undo'): void;
  (e: 'redo'): void;
}>();

const store = useFFmpegParamsStore();

// 历史记录状态
const canUndo = computed(() => store.canUndo);
const canRedo = computed(() => store.canRedo);
const undoCount = computed(() => store.undoStackSize);
const redoCount = computed(() => store.redoStackSize ?? 0);
const lastUndoDescription = computed(() => store.lastUndoDescription);
const lastRedoDescription = computed(() => store.lastRedoDescription);

// 布局选项
const layoutOptions = ref([
  {
    label: '层级布局',
    key: 'hierarchical',
    icon: () => h(NIcon, null, {
      default: () => h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, [
        h('path', { d: 'M21 6H3M10 12H3M10 18H3M14 12h7l-3-3m0 6l3-3' })
      ])
    })
  },
  {
    label: '圆形布局',
    key: 'circular',
    icon: () => h(NIcon, null, {
      default: () => h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, [
        h('circle', { cx: '12', cy: '12', r: '9' })
      ])
    })
  },
  {
    label: '手动布局',
    key: 'manual',
    icon: () => h(NIcon, null, {
      default: () => h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, [
        h('path', { d: 'M14 9l6 6-6 6' }),
        h('path', { d: 'M4 4v7a4 4 0 0 0 4 4h12' })
      ])
    })
  }
]);

const onLayoutSelect = (key: string) => {
  emit('layout', key as LayoutMode);
};
</script>

<style scoped>
.graph-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: var(--n-color);
  border-bottom: 1px solid var(--n-border-color);
}

:deep(.n-button__icon) {
  font-size: 16px;
}
</style>
