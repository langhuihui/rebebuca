<template>
  <div class="advanced-options-panel">
    <!-- 解码器配置 -->
    <div class="option-group">
      <div class="option-header">
        <h4>解码器配置</h4>
        <n-tooltip trigger="hover">
          <template #trigger>
            <n-icon size="16" class="help-icon"><HelpCircleIcon /></n-icon>
          </template>
          选择视频解码器和硬件加速方式
        </n-tooltip>
      </div>

      <div class="option-row">
        <span class="option-label">解码器</span>
        <n-select
          :value="store.currentPreset.decoder.decoder"
          :options="decoderOptions"
          @update:value="handleDecoderChange"
          style="width: 200px;"
        />
      </div>

      <div class="option-row">
        <span class="option-label">硬件加速</span>
        <n-select
          :value="store.currentPreset.decoder.hwaccel"
          :options="hwaccelOptions"
          @update:value="handleHwaccelChange"
          style="width: 200px;"
        />
      </div>

      <div class="option-row" v-if="store.currentPreset.decoder.hwaccel !== 'auto'">
        <span class="option-label">设备</span>
        <n-input
          :value="store.currentPreset.decoder.hwaccelDevice || ''"
          placeholder="例如: 0 或 cuda:0"
          @update:value="handleHwaccelDeviceChange"
          style="width: 200px;"
        />
      </div>
    </div>

    <n-divider />

    <!-- 流控制 -->
    <div class="option-group">
      <div class="option-header">
        <h4>流控制</h4>
        <n-tooltip trigger="hover">
          <template #trigger>
            <n-icon size="16" class="help-icon"><HelpCircleIcon /></n-icon>
          </template>
          控制要保留的流
        </n-tooltip>
      </div>

      <n-space vertical :size="12">
        <n-checkbox
          :checked="store.currentPreset.streamControl.keepOtherVideoStreams"
          @update:checked="handleKeepOtherVideoStreamsChange"
        >
          保留其他视频流
        </n-checkbox>

        <n-checkbox
          :checked="store.currentPreset.streamControl.keepOtherAudioStreams"
          @update:checked="handleKeepOtherAudioStreamsChange"
        >
          保留其他音频流
        </n-checkbox>

        <n-checkbox
          :checked="store.currentPreset.streamControl.keepSubtitleStreams"
          @update:checked="handleKeepSubtitleStreamsChange"
        >
          保留字幕流
        </n-checkbox>

        <n-checkbox
          :checked="store.currentPreset.streamControl.keepAttachmentStreams"
          @update:checked="handleKeepAttachmentStreamsChange"
        >
          保留附件流
        </n-checkbox>
      </n-space>
    </div>

    <n-divider />

    <!-- 元数据 -->
    <div class="option-group">
      <div class="option-header">
        <h4>元数据</h4>
        <n-tooltip trigger="hover">
          <template #trigger>
            <n-icon size="16" class="help-icon"><HelpCircleIcon /></n-icon>
          </template>
          设置输出文件的元数据信息
        </n-tooltip>
      </div>

      <n-space vertical :size="12">
        <div class="option-row">
          <span class="option-label">标题</span>
          <n-input
            :value="store.currentPreset.metadata?.title || ''"
            placeholder="视频标题"
            @update:value="handleMetadataChange('title', $event)"
          />
        </div>

        <div class="option-row">
          <span class="option-label">艺术家</span>
          <n-input
            :value="store.currentPreset.metadata?.artist || ''"
            placeholder="艺术家"
            @update:value="handleMetadataChange('artist', $event)"
          />
        </div>

        <div class="option-row">
          <span class="option-label">专辑</span>
          <n-input
            :value="store.currentPreset.metadata?.album || ''"
            placeholder="专辑"
            @update:value="handleMetadataChange('album', $event)"
          />
        </div>

        <div class="option-row">
          <span class="option-label">年份</span>
          <n-input
            :value="store.currentPreset.metadata?.year || ''"
            placeholder="2024"
            @update:value="handleMetadataChange('year', $event)"
          />
        </div>

        <div class="option-row">
          <span class="option-label">注释</span>
          <n-input
            :value="store.currentPreset.metadata?.comment || ''"
            placeholder="注释"
            @update:value="handleMetadataChange('comment', $event)"
          />
        </div>
      </n-space>
    </div>

    <n-divider />

    <!-- 自定义参数 -->
    <div class="option-group">
      <div class="option-header">
        <h4>自定义参数</h4>
        <n-tooltip trigger="hover">
          <template #trigger>
            <n-icon size="16" class="help-icon"><HelpCircleIcon /></n-icon>
          </template>
          直接输入自定义 FFmpeg 参数
        </n-tooltip>
      </div>

      <n-space vertical :size="12">
        <div>
          <div class="option-label" style="margin-bottom: 8px;">输入前参数</div>
          <n-input
            type="textarea"
            :value="store.currentPreset.custom.preParams"
            placeholder="-ss 00:00:10"
            :rows="2"
            @update:value="handleCustomChange('preParams', $event)"
          />
        </div>

        <div>
          <div class="option-label" style="margin-bottom: 8px;">自定义视频滤镜</div>
          <n-input
            type="textarea"
            :value="store.currentPreset.custom.videoFilter"
            placeholder="crop=1920:1080:0:0,scale=1280:-1"
            :rows="2"
            @update:value="handleCustomChange('videoFilter', $event)"
          />
        </div>

        <div>
          <div class="option-label" style="margin-bottom: 8px;">自定义音频滤镜</div>
          <n-input
            type="textarea"
            :value="store.currentPreset.custom.audioFilter"
            placeholder="volume=0.5"
            :rows="2"
            @update:value="handleCustomChange('audioFilter', $event)"
          />
        </div>

        <div>
          <div class="option-label" style="margin-bottom: 8px;">自定义视频参数</div>
          <n-input
            type="textarea"
            :value="store.currentPreset.custom.videoParams"
            placeholder="-x264-params crf=23:me=hex:subme=7"
            :rows="2"
            @update:value="handleCustomChange('videoParams', $event)"
          />
        </div>

        <div>
          <div class="option-label" style="margin-bottom: 8px;">自定义音频参数</div>
          <n-input
            type="textarea"
            :value="store.currentPreset.custom.audioParams"
            placeholder="-ar 44100 -ac 2"
            :rows="2"
            @update:value="handleCustomChange('audioParams', $event)"
          />
        </div>

        <div>
          <div class="option-label" style="margin-bottom: 8px;">输出后参数</div>
          <n-input
            type="textarea"
            :value="store.currentPreset.custom.postParams"
            placeholder="-movflags +faststart"
            :rows="2"
            @update:value="handleCustomChange('postParams', $event)"
          />
        </div>
      </n-space>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  NDivider,
  NSpace,
  NCheckbox,
  NSelect,
  NInput,
  NTooltip,
  NIcon
} from 'naive-ui';
import { HelpCircle as HelpCircleIcon } from '@vicons/ionicons5';
import { useFFmpegParamsStore } from '../stores/ffmpegParams';

const store = useFFmpegParamsStore();

// 解码器选项
const decoderOptions = [
  { label: '自动', value: 'auto' },
  { label: 'H.264 (h264_cuvid)', value: 'h264_cuvid' },
  { label: 'H.264 (h264_qsv)', value: 'h264_qsv' },
  { label: 'H.264 (h264_mmal)', value: 'h264_mmal' },
  { label: 'HEVC (hevc_cuvid)', value: 'hevc_cuvid' },
  { label: 'HEVC (hevc_qsv)', value: 'hevc_qsv' }
];

// 硬件加速选项
const hwaccelOptions = [
  { label: '自动', value: 'auto' },
  { label: 'NVIDIA CUDA', value: 'cuda' },
  { label: 'Intel QSV', value: 'qsv' },
  { label: 'D3D11VA', value: 'd3d11va' },
  { label: 'DXVA2', value: 'dxva2' },
  { label: 'VAAPI', value: 'vaapi' },
  { label: 'VideoToolbox', value: 'videotoolbox' }
];

// 处理解码器变化
const handleDecoderChange = (value: string) => {
  store.updatePreset({
    decoder: {
      ...store.currentPreset.decoder,
      decoder: value
    }
  });
};

// 处理硬件加速变化
const handleHwaccelChange = (value: string) => {
  store.updatePreset({
    decoder: {
      ...store.currentPreset.decoder,
      hwaccel: value
    }
  });
};

// 处理设备变化
const handleHwaccelDeviceChange = (value: string) => {
  store.updatePreset({
    decoder: {
      ...store.currentPreset.decoder,
      hwaccelDevice: value
    }
  });
};

// 处理流控制变化
const handleKeepOtherVideoStreamsChange = (value: boolean) => {
  store.updatePreset({
    streamControl: {
      ...store.currentPreset.streamControl,
      keepOtherVideoStreams: value
    }
  });
};

const handleKeepOtherAudioStreamsChange = (value: boolean) => {
  store.updatePreset({
    streamControl: {
      ...store.currentPreset.streamControl,
      keepOtherAudioStreams: value
    }
  });
};

const handleKeepSubtitleStreamsChange = (value: boolean) => {
  store.updatePreset({
    streamControl: {
      ...store.currentPreset.streamControl,
      keepSubtitleStreams: value
    }
  });
};

const handleKeepAttachmentStreamsChange = (value: boolean) => {
  store.updatePreset({
    streamControl: {
      ...store.currentPreset.streamControl,
      keepAttachmentStreams: value
    }
  });
};

// 处理元数据变化
const handleMetadataChange = (key: string, value: string) => {
  store.updatePreset({
    metadata: {
      ...store.currentPreset.metadata,
      [key]: value
    }
  });
};

// 处理自定义参数变化
const handleCustomChange = (key: string, value: string) => {
  store.updatePreset({
    custom: {
      ...store.currentPreset.custom,
      [key]: value
    }
  });
};
</script>

<style scoped>
.advanced-options-panel {
  padding: 16px;
}

.option-group {
  margin-bottom: 24px;
}

.option-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
}

.option-header h4 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
}

.help-icon {
  color: #999;
  cursor: help;
}

.help-icon:hover {
  color: #666;
}

.option-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.option-label {
  font-size: 13px;
  color: #666;
  font-weight: 500;
}
</style>
