<template>
  <div class="audio-params-panel">
    <div class="section-header">
      <h3>音频编码</h3>
      <n-switch v-model:value="store.currentPreset.audio.enabled" size="small" />
    </div>

    <n-form
      v-if="store.currentPreset.audio.enabled"
      :label-width="70"
      size="small"
      :model="store.currentPreset.audio"
    >
      <!-- 音频编码器 -->
      <n-form-item label="编码器" :show-feedback="false">
        <n-select
          v-model:value="store.currentPreset.audio.encoder"
          :options="audioEncoderOptions"
          size="small"
          @update:value="handleEncoderChange"
          :disabled="isCopyMode"
        />
      </n-form-item>

      <template v-if="!isCopyMode">
        <!-- 比特率、声道、采样率 - 使用网格布局 -->
        <n-grid :cols="3" :x-gap="8">
          <n-gi>
            <n-form-item label="比特率" :show-feedback="false">
              <n-select
                v-model:value="store.currentPreset.audio.bitrate"
                :options="bitrateOptions"
                size="small"
              />
            </n-form-item>
          </n-gi>
          <n-gi>
            <n-form-item label="声道" :show-feedback="false">
              <n-select
                v-model:value="store.currentPreset.audio.channels"
                :options="channelOptions"
                size="small"
              />
            </n-form-item>
          </n-gi>
          <n-gi>
            <n-form-item label="采样率" :show-feedback="false">
              <n-select
                v-model:value="store.currentPreset.audio.sampleRate"
                :options="sampleRateOptions"
                size="small"
              />
            </n-form-item>
          </n-gi>
        </n-grid>
      </template>
    </n-form>

    <!-- 错误提示 -->
    <n-alert
      v-if="audioErrors.length > 0"
      type="error"
      title="配置错误"
      size="small"
      style="margin-top: 12px"
    >
      <ul style="font-size: 12px; margin: 0; padding-left: 16px;">
        <li v-for="(error, index) in audioErrors" :key="index">
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
  NAlert,
  NGrid,
  NGi,
  useMessage
} from 'naive-ui';
import { useFFmpegParamsStore } from '../stores/ffmpegParams';
import { encoderDatabase } from '../services/encoderDatabase';

const store = useFFmpegParamsStore();
const message = useMessage();

// 是否为 Copy 模式
const isCopyMode = computed(() => store.currentPreset.audio.encoder === 'copy');

// 当前编码器信息
const currentEncoder = computed(() =>
  encoderDatabase.getAudioEncoder(store.currentPreset.audio.encoder)
);

// 音频编码器选项
const audioEncoderOptions = computed(() => {
  const container = store.currentPreset.output.container;
  return encoderDatabase.getSupportedAudioEncoders(container).map(encoder => ({
    label: encoder.name,
    value: encoder.id
  }));
});

// 比特率选项
const bitrateOptions = computed(() => {
  if (isCopyMode.value) return [];

  const encoderBitrates = currentEncoder.value?.bitrates;
  if (encoderBitrates) {
    return encoderBitrates.map(bitrate => ({ label: bitrate, value: bitrate }));
  }

  // 默认比特率选项
  return ['64k', '96k', '128k', '192k', '256k', '320k'].map(bitrate => ({
    label: bitrate,
    value: bitrate
  }));
});

// 声道数选项
const channelOptions = computed(() => {
  if (isCopyMode.value) return [];

  const encoderChannels = currentEncoder.value?.channelCounts;
  if (encoderChannels) {
    return encoderChannels.map(channels => ({
      label: channels === 1 ? '单声道' : channels === 2 ? '立体声' : `${channels} 声道`,
      value: channels.toString()
    }));
  }

  // 默认声道数选项
  return [
    { label: '单声道', value: '1' },
    { label: '立体声', value: '2' },
    { label: '5.1 声道', value: '6' }
  ];
});

// 采样率选项
const sampleRateOptions = computed(() => {
  if (isCopyMode.value) return [];

  const encoderSampleRates = currentEncoder.value?.sampleRates;
  if (encoderSampleRates) {
    return encoderSampleRates.map(rate => ({
      label: `${rate / 1000} kHz`,
      value: rate.toString()
    }));
  }

  // 默认采样率选项
  return [
    { label: '44.1 kHz', value: '44100' },
    { label: '48 kHz', value: '48000' },
    { label: '96 kHz', value: '96000' }
  ];
});

// 音频相关错误
const audioErrors = computed(() =>
  store.validationResult.errors.filter(error =>
    error.field.startsWith('audio')
  )
);

// 处理编码器变化
const handleEncoderChange = (encoderId: string) => {
  const encoder = encoderDatabase.getAudioEncoder(encoderId);
  if (!encoder) return;

  // 应用推荐的设置
  if (encoder.recommendedSettings?.audio) {
    store.updateAudioConfig(encoder.recommendedSettings.audio);
  }

  message.info(`已切换到 ${encoder.name}`);
};
</script>

<style scoped>
.audio-params-panel {
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
