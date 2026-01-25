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
        <FilterChainEditor
          :filters="currentPreset.filters"
          :custom-filter="currentPreset.custom.videoFilter"
          @update:custom-filter="updateCustomFilter"
        />
      </n-tab-pane>
    </n-tabs>
  </n-card>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { NCard, NTabs, NTabPane, NSpace, NButton } from 'naive-ui';
import { useFFmpegParamsStore } from '../../stores/ffmpegParams';
import type { Filters, SubtitleFilter, ColorManagement } from '../../types/preset';
import BasicFiltersPanel from './BasicFiltersPanel.vue';
import AdvancedFiltersPanel from './AdvancedFiltersPanel.vue';
import SubtitleFilterPanel from './SubtitleFilterPanel.vue';
import ColorManagementPanel from './ColorManagementPanel.vue';
import FilterChainEditor from './FilterChainEditor.vue';

const ffmpegParams = useFFmpegParamsStore();

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
</script>
