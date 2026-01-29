<template>
  <n-card title="视频滤镜" size="small">
    <template #header-extra>
      <n-space>
        <n-button
          v-if="hasEnabledFilters"
          size="small"
          type="warning"
          @click="resetAllFilters"
        >
          重置所有
        </n-button>
      </n-space>
    </template>

    <n-tabs type="line" animated>
      <!-- 基础滤镜 -->
      <n-tab-pane name="basic" tab="基础滤镜">
        <BasicFiltersPanel
          :filters="currentPreset.filters"
          @update:filters="updateFilters"
        />
      </n-tab-pane>

      <!-- 高级滤镜 -->
      <n-tab-pane name="advanced" tab="高级滤镜">
        <AdvancedFiltersPanel
          :filters="currentPreset.filters"
          @update:filters="updateFilters"
        />
      </n-tab-pane>

      <!-- 字幕滤镜 -->
      <n-tab-pane name="subtitle" tab="字幕">
        <SubtitleFilterPanel
          :subtitle="currentPreset.filters.subtitle"
          @update:subtitle="updateSubtitle"
        />
      </n-tab-pane>

      <!-- 色彩管理 -->
      <n-tab-pane name="color" tab="色彩管理">
        <ColorManagementPanel
          :color="currentPreset.filters.colorManagement"
          @update:color="updateColorManagement"
        />
      </n-tab-pane>

      <!-- 滤镜链编辑器 -->
      <n-tab-pane name="chain" tab="滤镜链">
        <n-tabs
          type="segment"
          size="small"
          :value="editorMode"
          @update:value="handleEditorModeChange"
          class="editor-mode-tabs"
        >
          <n-tab-pane name="list" tab="列表视图">
            <FilterChainEditor
              :filters="currentPreset.filters"
              :custom-filter="currentPreset.custom.videoFilter"
              @update:custom-filter="updateCustomFilter"
            />
          </n-tab-pane>

          <n-tab-pane name="graph" tab="节点图视图">
            <FilterGraphEditor />
          </n-tab-pane>
        </n-tabs>
      </n-tab-pane>
    </n-tabs>
  </n-card>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { NCard, NTabs, NTabPane, NSpace, NButton, useMessage } from 'naive-ui';
import { useFFmpegParamsStore } from '../../stores/ffmpegParams';
import type { Filters, SubtitleFilter, ColorManagement } from '../../types/preset';
import BasicFiltersPanel from './BasicFiltersPanel.vue';
import AdvancedFiltersPanel from './AdvancedFiltersPanel.vue';
import SubtitleFilterPanel from './SubtitleFilterPanel.vue';
import ColorManagementPanel from './ColorManagementPanel.vue';
import FilterChainEditor from './FilterChainEditor.vue';
import FilterGraphEditor from './FilterGraphEditor.vue';

const ffmpegParams = useFFmpegParamsStore();
const message = useMessage();

// 编辑器模式：list | graph
const editorMode = ref<'list' | 'graph'>(ffmpegParams.editorMode);

// 监听 store 中的 editorMode 变化
watch(
  () => ffmpegParams.editorMode,
  (mode) => {
    editorMode.value = mode;
  }
);

const currentPreset = computed(() => ffmpegParams.currentPreset);

const hasEnabledFilters = computed(() => {
  const f = currentPreset.value.filters;
  return (
    f.crop?.enabled ||
    f.scale?.enabled ||
    f.framerate?.enabled ||
    f.deinterlace?.enabled ||
    f.denoise?.enabled ||
    f.sharpen?.enabled ||
    f.subtitle?.enabled ||
    f.transform?.enabled ||
    f.colorManagement?.enabled
  );
});

const updateFilters = (filters: Partial<Filters>) => {
  ffmpegParams.updateFiltersConfig(filters);
};

const updateSubtitle = (subtitle: SubtitleFilter | undefined) => {
  ffmpegParams.updateFiltersConfig({ subtitle });
};

const updateColorManagement = (color: ColorManagement | undefined) => {
  ffmpegParams.updateFiltersConfig({ colorManagement: color });
};

const updateCustomFilter = (filter: string) => {
  ffmpegParams.updatePreset({
    custom: {
      ...currentPreset.value.custom,
      videoFilter: filter
    }
  });
};

const resetAllFilters = () => {
  ffmpegParams.updateFiltersConfig({
    crop: undefined,
    scale: undefined,
    framerate: undefined,
    deinterlace: undefined,
    denoise: undefined,
    sharpen: undefined,
    subtitle: undefined,
    transform: undefined,
    colorManagement: undefined
  });
  ffmpegParams.updatePreset({
    custom: {
      ...currentPreset.value.custom,
      videoFilter: ''
    }
  });
};

/**
 * 处理编辑器模式切换
 * 在列表视图和节点图视图之间切换时同步数据
 */
const handleEditorModeChange = async (mode: 'list' | 'graph') => {
  // 如果从列表视图切换到节点图视图，先从 preset 同步到图
  if (mode === 'graph' && editorMode.value === 'list') {
    try {
      await ffmpegParams.syncPresetToGraph();
      message.success('已切换到节点图视图');
    } catch (error) {
      console.error('Failed to sync preset to graph:', error);
      message.error('同步到节点图失败');
      return;
    }
  }
  // 如果从节点图视图切换到列表视图，先从图同步到 preset
  else if (mode === 'list' && editorMode.value === 'graph') {
    try {
      await ffmpegParams.syncGraphToPreset();
      message.success('已切换到列表视图');
    } catch (error) {
      console.error('Failed to sync graph to preset:', error);
      message.error('同步到列表视图失败');
      return;
    }
  }

  // 更新 store 中的 editorMode
  ffmpegParams.setEditorMode(mode);
  editorMode.value = mode;
};
</script>

<style scoped>
.editor-mode-tabs {
  margin-top: -8px;
}
</style>
