<template>
  <div class="video-params-panel">
    <div class="section-header">
      <h3>视频编码</h3>
      <n-switch v-model:value="store.currentPreset.video.enabled" size="small" />
    </div>

    <n-form
      v-if="store.currentPreset.video.enabled"
      :label-width="80"
      size="small"
      :model="store.currentPreset.video"
    >
      <!-- 编码器 -->
      <n-form-item label="编码器" :show-feedback="false">
        <n-select
          v-model:value="store.currentPreset.video.encoder"
          :options="videoEncoderOptions"
          size="small"
          @update:value="handleEncoderChange"
          :disabled="isCopyMode"
        />
      </n-form-item>

      <template v-if="!isCopyMode">
        <!-- 编码预设/配置文件/级别 - 使用网格布局 -->
        <n-grid :cols="3" :x-gap="8">
          <n-gi v-if="encoderPresets.length > 0">
            <n-form-item label="编码预设" :show-feedback="false">
              <n-select
                v-model:value="store.currentPreset.video.preset"
                :options="encoderPresetOptions"
                size="small"
              />
            </n-form-item>
          </n-gi>
          <n-gi v-if="encoderProfiles.length > 0">
            <n-form-item label="配置文件" :show-feedback="false">
              <n-select
                v-model:value="store.currentPreset.video.profile"
                :options="encoderProfileOptions"
                size="small"
              />
            </n-form-item>
          </n-gi>
          <n-gi v-if="encoderLevels.length > 0">
            <n-form-item label="级别" :show-feedback="false">
              <n-select
                v-model:value="store.currentPreset.video.level"
                :options="encoderLevelOptions"
                size="small"
              />
            </n-form-item>
          </n-gi>
        </n-grid>

        <!-- 调整参数 -->
        <n-form-item
          v-if="encoderTunes.length > 0"
          label="调整参数"
          :show-feedback="false"
        >
          <n-select
            v-model:value="store.currentPreset.video.tune"
            :options="encoderTuneOptions"
            size="small"
            clearable
          />
        </n-form-item>

        <n-divider style="margin: 12px 0" />

        <!-- 质量控制 -->
        <n-form-item label="质量控制" :show-feedback="false">
          <n-radio-group
            v-model:value="store.currentPreset.quality.controlMode"
            size="small"
            @update:value="handleQualityModeChange"
          >
            <n-radio-button value="CRF">CRF</n-radio-button>
            <n-radio-button value="VBR">VBR</n-radio-button>
            <n-radio-button value="VBR_HQ">VBR_HQ</n-radio-button>
            <n-radio-button value="CBR">CBR</n-radio-button>
          </n-radio-group>
        </n-form-item>

        <!-- 质量值 -->
        <n-form-item
          v-if="store.currentPreset.quality.controlMode !== 'CBR'"
          :label="qualityParamLabel"
          :show-feedback="false"
        >
          <n-space align="center" :size="8">
            <n-slider
              v-model:value="qualityValue"
              :min="0"
              :max="51"
              :step="1"
              style="width: 200px"
            />
            <n-input-number
              v-model:value="qualityValue"
              :min="0"
              :max="51"
              size="small"
              style="width: 70px"
            />
          </n-space>
        </n-form-item>

        <!-- 比特率 -->
        <n-form-item label="目标码率" :show-feedback="false">
          <n-input-group>
            <n-input-number
              v-model:value="bitrateValue"
              :min="0"
              :step="0.1"
              size="small"
              style="width: 100px"
            />
            <n-select
              v-model:value="bitrateUnit"
              :options="bitrateUnitOptions"
              size="small"
              style="width: 70px"
            />
          </n-input-group>
        </n-form-item>

        <!-- 二遍编码 -->
        <n-form-item label="编码方式" :show-feedback="false">
          <n-radio-group
            v-model:value="store.currentPreset.video.passMode"
            size="small"
            :disabled="!supportsPassEncoding"
          >
            <n-radio-button :value="0">单次</n-radio-button>
            <n-radio-button :value="1">二遍</n-radio-button>
            <n-radio-button :value="2">二遍(HQ)</n-radio-button>
          </n-radio-group>
        </n-form-item>
      </template>
    </n-form>

    <!-- 错误提示 -->
    <n-alert
      v-if="videoErrors.length > 0"
      type="error"
      title="配置错误"
      size="small"
      style="margin-top: 12px"
    >
      <ul style="font-size: 12px; margin: 0; padding-left: 16px;">
        <li v-for="(error, index) in videoErrors" :key="index">
          {{ error.message }}
        </li>
      </ul>
    </n-alert>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import {
  NForm,
  NFormItem,
  NSelect,
  NSwitch,
  NDivider,
  NRadioGroup,
  NRadioButton,
  NSlider,
  NInputNumber,
  NInputGroup,
  NAlert,
  NSpace,
  NGrid,
  NGi,
  useMessage
} from 'naive-ui';
import { useFFmpegParamsStore } from '../stores/ffmpegParams';
import { encoderDatabase } from '../services/encoderDatabase';

const store = useFFmpegParamsStore();
const message = useMessage();

// 是否为 Copy 模式
const isCopyMode = computed(() => store.currentPreset.video.encoder === 'copy');

// 当前编码器信息
const currentEncoder = computed(() =>
  encoderDatabase.getVideoEncoder(store.currentPreset.video.encoder)
);

// 是否支持二遍编码
const supportsPassEncoding = computed(() =>
  currentEncoder.value?.supportsPassEncoding ?? false
);

// 视频编码器选项
const videoEncoderOptions = computed(() => {
  const container = store.currentPreset.output.container;
  return encoderDatabase.getSupportedVideoEncoders(container).map(encoder => ({
    label: encoder.name,
    value: encoder.id
  }));
});

// 编码器预设
const encoderPresets = computed(() => currentEncoder.value?.presets || []);
const encoderPresetOptions = computed(() =>
  encoderPresets.value.map(preset => ({ label: preset, value: preset }))
);

// 编码器配置文件
const encoderProfiles = computed(() => currentEncoder.value?.profiles || []);
const encoderProfileOptions = computed(() =>
  encoderProfiles.value.map(profile => ({ label: profile, value: profile }))
);

// 编码器级别
const encoderLevels = computed(() => currentEncoder.value?.levels || []);
const encoderLevelOptions = computed(() =>
  encoderLevels.value.map(level => ({ label: level, value: level }))
);

// 编码器调整参数
const encoderTunes = computed(() => currentEncoder.value?.tunes || []);
const encoderTuneOptions = computed(() =>
  encoderTunes.value.map(tune => ({ label: tune, value: tune }))
);

// 质量控制
const qualityValue = computed({
  get: () => parseFloat(store.currentPreset.quality.value),
  set: (value: number) => {
    store.updateQualityConfig({ value: value.toString() });
  }
});

const qualityParamLabel = computed(() => {
  const paramMap: Record<string, string> = {
    CRF: 'CRF 值',
    VBR: 'Q 值',
    VBR_HQ: 'CRF 值',
    CQP: 'QP 值',
    CBR: 'Q 值'
  };
  return paramMap[store.currentPreset.quality.controlMode] || '质量值';
});

// 比特率
const bitrateValue = computed({
  get: () => {
    const match = store.currentPreset.quality.bitrate.base.match(/^(\d+\.?\d*)/);
    return match ? parseFloat(match[1]) : 5;
  },
  set: (value: number) => {
    store.updateQualityConfig({
      bitrate: {
        ...store.currentPreset.quality.bitrate,
        base: `${value}${store.currentPreset.quality.bitrate.base.slice(-1)}`
      }
    });
  }
});

const bitrateUnit = computed({
  get: () => store.currentPreset.quality.bitrate.base.slice(-1),
  set: (unit: string) => {
    store.updateQualityConfig({
      bitrate: {
        ...store.currentPreset.quality.bitrate,
        base: `${bitrateValue.value}${unit}`
      }
    });
  }
});

const bitrateUnitOptions = [
  { label: 'k', value: 'k' },
  { label: 'M', value: 'M' },
  { label: 'G', value: 'G' }
];

// 视频相关错误
const videoErrors = computed(() =>
  store.validationResult.errors.filter(error =>
    error.field.startsWith('video') || error.field.startsWith('quality')
  )
);

// 处理编码器变化
const handleEncoderChange = (encoderId: string) => {
  const encoder = encoderDatabase.getVideoEncoder(encoderId);
  if (!encoder) return;

  // 更新编码器类别
  store.updateVideoConfig({
    encoder: encoderId,
    encoderCategory: encoder.category
  });

  // 应用推荐的预设设置
  if (encoder.recommendedSettings?.video) {
    store.updateVideoConfig(encoder.recommendedSettings.video);
  }

  // 应用推荐的质量控制设置
  if (encoder.recommendedSettings?.quality) {
    store.updateQualityConfig(encoder.recommendedSettings.quality);
  }

  // 更新质量控制参数名称
  const qualityModes = encoder.qualityModes || ['CRF'];
  const paramMap: Record<string, string> = {
    CRF: 'crf',
    VBR: 'cq',
    VBR_HQ: 'crf',
    CQP: 'qp',
    CBR: 'qp'
  };
  store.updateQualityConfig({
    controlMode: qualityModes[0] as 'CRF' | 'VBR' | 'VBR_HQ' | 'CQP' | 'CBR',
    paramName: (paramMap[qualityModes[0]] || 'crf') as 'crf' | 'cq' | 'qp' | 'global_quality'
  });

  message.info(`已切换到 ${encoder.name}`);
};

// 处理质量控制模式变化
const handleQualityModeChange = (mode: string) => {
  const paramMap: Record<string, string> = {
    CRF: 'crf',
    VBR: 'cq',
    VBR_HQ: 'crf',
    CQP: 'qp',
    CBR: 'qp'
  };

  store.updateQualityConfig({
    controlMode: mode as 'CRF' | 'VBR' | 'VBR_HQ' | 'CQP' | 'CBR',
    paramName: (paramMap[mode] || 'crf') as 'crf' | 'cq' | 'qp' | 'global_quality'
  });
};
</script>

<style scoped>
.video-params-panel {
  padding: 12px;
  background-color: var(--n-color-embedded);
  border-radius: 6px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.section-header h3 {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  color: #333;
}

ul {
  margin: 0;
  padding-left: 16px;
}
</style>
