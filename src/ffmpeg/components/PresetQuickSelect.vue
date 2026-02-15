<template>
  <div class="preset-quick-select">
    <!-- 快速预设选择器 -->
    <n-card title="快速选择" :bordered="false" class="quick-select-card">
      <!-- 分类标签 -->
      <n-tabs v-model:value="activeCategory" type="segment" size="small">
        <n-tab-pane name="recommended" tab="推荐">
          <template #tab>
            <n-space align="center" :size="4">
              <n-icon :size="16"><star-icon /></n-icon>
              <span>推荐</span>
            </n-space>
          </template>
        </n-tab-pane>
        <n-tab-pane name="common" tab="通用" />
        <n-tab-pane name="mobile" tab="移动端" />
        <n-tab-pane name="hd" tab="高清" />
        <n-tab-pane name="fast" tab="快速" />
      </n-tabs>

      <!-- 预设卡片网格 -->
      <n-scrollbar style="max-height: 400px">
        <div class="preset-grid">
          <div
            v-for="preset in filteredPresets"
            :key="preset.id"
            class="preset-card"
            :class="{ active: selectedPresetId === preset.id }"
            @click="applyPreset(preset.id)"
          >
            <div class="preset-icon">
              <component :is="getPresetIcon(preset)" />
            </div>
            <div class="preset-content">
              <div class="preset-name">{{ preset.name }}</div>
              <div class="preset-description">{{ preset.description }}</div>
              <div class="preset-tags">
                <n-tag
                  v-for="tag in preset.tags?.slice(0, 3)"
                  :key="tag"
                  size="tiny"
                  type="info"
                >
                  {{ tag }}
                </n-tag>
              </div>
            </div>
          </div>
        </div>
      </n-scrollbar>
    </n-card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import {
  NCard,
  NTabs,
  NTabPane,
  NSpace,
  NIcon,
  NTag,
  NScrollbar,
  useMessage
} from 'naive-ui';
import {
  Star as StarIcon,
  Videocam as VideoIcon,
  PhonePortrait as MobileIcon,
  Sparkles as HdIcon,
  Flash as FastIcon
} from '@vicons/ionicons5';
import { usePresetsStore } from '../stores/presetsStore';

// Props
interface Props {
  onApplyPreset?: (presetId: string) => void;
}

const props = defineProps<Props>();

// Stores
const presetsStore = usePresetsStore();
const message = useMessage();

// State
const activeCategory = ref('recommended');

// Computed
const selectedPresetId = computed(() => presetsStore.selectedPresetId);

const filteredPresets = computed(() => {
  const allPresets = presetsStore.allPresets;

  switch (activeCategory.value) {
    case 'recommended':
      return allPresets.filter(p => p.tags?.includes('推荐'));
    case 'common':
      return allPresets.filter(p => p.tags?.includes('通用'));
    case 'mobile':
      return allPresets.filter(p => p.tags?.includes('移动端'));
    case 'hd':
      return allPresets.filter(p => p.tags?.includes('高清') || p.tags?.includes('4K'));
    case 'fast':
      return allPresets.filter(p => p.tags?.includes('快速') || p.tags?.includes('压缩'));
    default:
      return allPresets;
  }
});

// Methods
function getPresetIcon(preset: any) {
  if (preset.tags?.includes('移动端')) {
    return MobileIcon;
  } else if (preset.tags?.includes('高清') || preset.tags?.includes('4K')) {
    return HdIcon;
  } else if (preset.tags?.includes('快速') || preset.tags?.includes('压缩')) {
    return FastIcon;
  } else {
    return VideoIcon;
  }
}

function applyPreset(presetId: string) {
  if (props.onApplyPreset) {
    props.onApplyPreset(presetId);
  }
  message.success(`已应用预设: ${presetsStore.allPresets.find(p => p.id === presetId)?.name}`);
}
</script>

<style scoped>
.preset-quick-select {
  height: 100%;
}

.quick-select-card {
  height: 100%;
}

.preset-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 12px;
  padding: 4px;
}

.preset-card {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px;
  border: 1px solid var(--n-border-color);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  background-color: var(--n-card-color);
}

.preset-card:hover {
  border-color: #3B82F6;
  box-shadow: 0 2px 8px rgba(59, 130, 246, 0.1);
  transform: translateY(-2px);
}

.preset-card.active {
  border-color: #3B82F6;
  background-color: #EBF5FF;
}

.preset-icon {
  flex-shrink: 0;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 8px;
  color: white;
  font-size: 20px;
}

.preset-content {
  flex: 1;
  min-width: 0;
}

.preset-name {
  font-weight: 600;
  font-size: 13px;
  color: #1F2937;
  margin-bottom: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.preset-description {
  font-size: 11px;
  color: #6B7280;
  line-height: 1.4;
  margin-bottom: 8px;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.preset-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
</style>
