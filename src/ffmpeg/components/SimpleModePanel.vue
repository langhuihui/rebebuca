<template>
  <div class="simple-mode-panel">
    <n-alert type="info" :show-icon="false" size="small" style="margin-bottom: 12px; padding: 8px 12px;">
      <template #header>
        <span class="panel-title">简单模式</span>
      </template>
      <span style="font-size: 12px;">只显示常用参数,快速上手。需要更多选项可切换到专家模式。</span>
    </n-alert>

    <!-- 快速场景选择 -->
    <div class="quick-scenarios">
      <n-divider style="margin: 8px 0;">快速场景</n-divider>
      <n-space :size="8">
        <n-button
          v-for="scenario in quickScenarios"
          :key="scenario.id"
          size="small"
          :type="selectedScenario === scenario.id ? 'primary' : 'default'"
          @click="applyScenario(scenario)"
        >
          <template #icon>
            <n-icon size="14">
              <component :is="scenario.icon" />
            </n-icon>
          </template>
          {{ scenario.name }}
        </n-button>
      </n-space>
    </div>

    <n-divider style="margin: 12px 0" />

    <!-- 参数网格布局 -->
    <n-grid :cols="2" :x-gap="16" :y-gap="12">
      <!-- 输出格式 -->
      <n-gi>
        <div class="param-group compact">
          <div class="param-label">
            <n-icon size="14"><FolderOpenIcon /></n-icon>
            <span>输出格式</span>
            <n-tooltip trigger="hover">
              <template #trigger>
                <n-icon size="14" class="help-icon"><HelpCircleIcon /></n-icon>
              </template>
              选择输出视频容器格式
            </n-tooltip>
          </div>
          <n-select
            :value="store.currentPreset.output.container"
            :options="containerOptions"
            size="small"
            @update:value="handleContainerChange"
          />
        </div>
      </n-gi>

      <!-- 音频质量 -->
      <n-gi>
        <div class="param-group compact">
          <div class="param-label">
            <n-icon size="14"><MusicalNotesIcon /></n-icon>
            <span>音频比特率</span>
            <n-tooltip trigger="hover">
              <template #trigger>
                <n-icon size="14" class="help-icon"><HelpCircleIcon /></n-icon>
              </template>
              音频比特率,越高音质越好
            </n-tooltip>
          </div>
          <n-select
            :value="store.currentPreset.audio.bitrate"
            :options="bitrateOptions"
            size="small"
            @update:value="handleBitrateChange"
          />
        </div>
      </n-gi>
    </n-grid>

    <!-- 视频质量 -->
    <div class="param-group compact" style="margin-top: 12px;">
      <div class="param-label">
        <n-icon size="14"><VideocamIcon /></n-icon>
        <span>视频质量 (CRF)</span>
        <n-tooltip trigger="hover">
          <template #trigger>
            <n-icon size="14" class="help-icon"><HelpCircleIcon /></n-icon>
          </template>
          CRF 值越低画质越好,文件越大。推荐范围: 18-28
        </n-tooltip>
        <span class="quality-badge">{{ store.currentPreset.quality.value }}</span>
      </div>
      <n-slider
        :value="parseInt(store.currentPreset.quality.value)"
        :min="18"
        :max="32"
        :step="1"
        :marks="{ 18: '高', 23: '平衡', 28: '小' }"
        style="margin: 4px 0;"
        @update:value="handleQualityChange"
      />
    </div>

    <!-- 输出分辨率 -->
    <div class="param-group compact" style="margin-top: 12px;">
      <div class="param-label">
        <n-icon size="14"><ResizeIcon /></n-icon>
        <span>输出分辨率</span>
        <n-tooltip trigger="hover">
          <template #trigger>
            <n-icon size="14" class="help-icon"><HelpCircleIcon /></n-icon>
          </template>
          选择输出视频的分辨率
        </n-tooltip>
      </div>
      <n-radio-group
        :value="selectedResolution"
        size="small"
        @update:value="handleResolutionChange"
      >
        <n-space :size="8">
          <n-radio
            v-for="res in resolutionOptions"
            :key="res.value"
            :value="res.value"
            :label="res.label"
          />
        </n-space>
      </n-radio-group>
    </div>

    <!-- 使用提示 - 折叠面板 -->
    <n-collapse style="margin-top: 12px;">
      <n-collapse-item title="💡 使用提示" name="tips">
        <ul style="margin: 0; padding-left: 16px; font-size: 12px; color: var(--n-text-color-3);">
          <li>上传视频即可开始转码</li>
          <li>选择"快速压缩"可快速减小文件大小</li>
          <li>需要更多参数配置请切换到专家模式</li>
          <li>命令行预览在下方可见</li>
        </ul>
      </n-collapse-item>
    </n-collapse>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import {
  NAlert,
  NDivider,
  NSpace,
  NButton,
  NIcon,
  NTooltip,
  NSelect,
  NSlider,
  NRadioGroup,
  NRadio,
  NGrid,
  NGi,
  NCollapse,
  NCollapseItem
} from 'naive-ui';
import {
  FolderOpen as FolderOpenIcon,
  Videocam as VideocamIcon,
  Resize as ResizeIcon,
  MusicalNotes as MusicalNotesIcon,
  HelpCircle as HelpCircleIcon,
  RocketOutline as RocketIcon,
  SyncOutline as SyncIcon,
  FlashOutline as FlashIcon,
  CheckmarkCircleOutline as CheckIcon
} from '@vicons/ionicons5';
import { useFFmpegParamsStore } from '../stores/ffmpegParams';

const store = useFFmpegParamsStore();

// 选中的场景
const selectedScenario = ref<string>('default');

// 选中的分辨率
const selectedResolution = computed({
  get: () => {
    const scale = store.currentPreset.filters.scale;
    if (!scale || !scale.enabled) return 'original';
    if (scale.width === '1920' && scale.height === '1080') return '1080p';
    if (scale.width === '1280' && scale.height === '720') return '720p';
    if (scale.width === '3840' && scale.height === '2160') return '4K';
    return 'original';
  },
  set: (value: string) => handleResolutionChange(value)
});

// 快速场景
const quickScenarios = [
  {
    id: 'default',
    name: '保持原画质',
    icon: CheckIcon,
    config: {
      quality: 20,
      resolution: 'original',
      bitrate: '192k'
    }
  },
  {
    id: 'compress',
    name: '快速压缩',
    icon: RocketIcon,
    config: {
      quality: 28,
      resolution: '720p',
      bitrate: '128k'
    }
  },
  {
    id: 'convert',
    name: '格式转换',
    icon: SyncIcon,
    config: {
      quality: 23,
      resolution: 'original',
      bitrate: '192k'
    }
  },
  {
    id: 'highquality',
    name: '高质量',
    icon: FlashIcon,
    config: {
      quality: 18,
      resolution: '1080p',
      bitrate: '320k'
    }
  }
];

// 容器选项
const containerOptions = [
  { label: 'MP4 (推荐)', value: 'mp4' },
  { label: 'MKV', value: 'mkv' },
  { label: 'WebM', value: 'webm' }
];

// 分辨率选项
const resolutionOptions = [
  { label: '保持原分辨率', value: 'original' },
  { label: '4K (3840x2160)', value: '4K' },
  { label: '1080p (1920x1080)', value: '1080p' },
  { label: '720p (1280x720)', value: '720p' },
  { label: '480p (854x480)', value: '480p' }
];

// 比特率选项
const bitrateOptions = [
  { label: '320k (高质量)', value: '320k' },
  { label: '192k (推荐)', value: '192k' },
  { label: '128k (标准)', value: '128k' },
  { label: '96k (省空间)', value: '96k' },
  { label: '64k (低质量)', value: '64k' }
];

// 应用场景
const applyScenario = (scenario: typeof quickScenarios[0]) => {
  selectedScenario.value = scenario.id;

  // 应用配置
  store.updateQualityConfig({
    value: String(scenario.config.quality)
  });

  // 应用分辨率
  handleResolutionChange(scenario.config.resolution);

  // 应用比特率
  store.updateAudioConfig({
    bitrate: scenario.config.bitrate
  });
};

// 处理容器变化
const handleContainerChange = (value: string) => {
  store.updateOutputConfig({
    container: value
  });
};

// 处理质量变化
const handleQualityChange = (value: number) => {
  store.updateQualityConfig({
    value: String(value)
  });
  selectedScenario.value = 'custom';
};

// 处理分辨率变化
const handleResolutionChange = (value: string) => {
  selectedScenario.value = 'custom';

  const scaleConfigs: Record<string, any> = {
    'original': { enabled: false, width: '', height: '', keepAspect: true },
    '4K': { enabled: true, width: '3840', height: '2160', keepAspect: true },
    '1080p': { enabled: true, width: '1920', height: '1080', keepAspect: true },
    '720p': { enabled: true, width: '1280', height: '720', keepAspect: true },
    '480p': { enabled: true, width: '854', height: '480', keepAspect: true }
  };

  store.updateFiltersConfig({
    scale: scaleConfigs[value] || scaleConfigs.original
  });
};

// 处理比特率变化
const handleBitrateChange = (value: string) => {
  store.updateAudioConfig({
    bitrate: value
  });
  selectedScenario.value = 'custom';
};
</script>

<style scoped>
.simple-mode-panel {
  padding: 8px;
}

.panel-title {
  font-weight: 600;
  font-size: 14px;
}

.quick-scenarios {
  margin-bottom: 12px;
}

.param-group {
  margin-bottom: 16px;
}

.param-group.compact {
  margin-bottom: 8px;
}

.param-label {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 6px;
  font-weight: 500;
  font-size: 13px;
}

.help-icon {
  color: #999;
  cursor: help;
}

.help-icon:hover {
  color: #666;
}

.quality-badge {
  margin-left: auto;
  padding: 2px 8px;
  background: #3b82f6;
  color: white;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
}
</style>
