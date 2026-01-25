<template>
  <div class="output-params-panel">
    <div class="section-header">
      <h3>输出配置</h3>
    </div>

    <n-form :label-width="100" :model="store.currentPreset.output">
      <n-form-item label="容器格式">
        <n-select
          v-model:value="store.currentPreset.output.container"
          :options="containerOptions"
          @update:value="handleContainerChange"
        />
      </n-form-item>

      <n-form-item label="自动命名">
        <n-switch v-model:value="store.currentPreset.output.naming.useAutoNaming" />
      </n-form-item>

      <template v-if="store.currentPreset.output.naming.useAutoNaming">
        <n-form-item label="前缀">
          <n-input
            v-model:value="store.currentPreset.output.naming.prefix"
            placeholder="例如: converted"
            @update:value="store.updateOutputConfig"
          />
        </n-form-item>

        <n-form-item label="后缀">
          <n-input
            v-model:value="store.currentPreset.output.naming.suffix"
            placeholder="例如: encoded"
            @update:value="store.updateOutputConfig"
          />
        </n-form-item>
      </template>

      <n-form-item label="输出位置">
        <n-space vertical style="width: 100%">
          <n-input
            v-model:value="store.currentPreset.output.location"
            placeholder="留空则使用输入文件所在目录"
            @update:value="store.updateOutputConfig"
          />
          <n-button text @click="handleBrowseOutputDir">
            <template #icon>
              <n-icon><FolderIcon /></n-icon>
            </template>
            浏览目录
          </n-button>
        </n-space>
      </n-form-item>
    </n-form>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import {
  NForm,
  NFormItem,
  NSelect,
  NSwitch,
  NInput,
  NSpace,
  NButton,
  NIcon,
  useMessage
} from 'naive-ui';
import { Folder as FolderIcon } from '@vicons/ionicons5';
import { useFFmpegParamsStore } from '../stores/ffmpegParams';
import { encoderDatabase } from '../services/encoderDatabase';

const store = useFFmpegParamsStore();
const message = useMessage();

// 容器选项
const containerOptions = computed(() => {
  return encoderDatabase.getContainers().map(container => {
    const containerInfo = encoderDatabase.getContainer(container);
    return {
      label: `${containerInfo?.name || container} (${container.toUpperCase()})`,
      value: container
    };
  });
});

// 处理容器变化
const handleContainerChange = (container: string) => {
  // 检查当前视频编码器是否支持新容器
  if (store.currentPreset.video.enabled &&
      store.currentPreset.video.encoder !== 'copy') {
    const videoEncoder = encoderDatabase.getVideoEncoder(
      store.currentPreset.video.encoder
    );
    if (videoEncoder && !encoderDatabase.isVideoEncoderSupported(
      store.currentPreset.video.encoder,
      container
    )) {
      // 切换到支持的视频编码器
      const supportedEncoders = encoderDatabase.getSupportedVideoEncoders(container);
      if (supportedEncoders.length > 0) {
        store.updateVideoConfig({
          encoder: supportedEncoders[0].id,
          encoderCategory: supportedEncoders[0].category
        });
        message.info(`已自动切换视频编码器为 ${supportedEncoders[0].name}`);
      }
    }
  }

  // 检查当前音频编码器是否支持新容器
  if (store.currentPreset.audio.enabled &&
      store.currentPreset.audio.encoder !== 'copy') {
    if (!encoderDatabase.isAudioEncoderSupported(
      store.currentPreset.audio.encoder,
      container
    )) {
      // 切换到支持的音频编码器
      const supportedEncoders = encoderDatabase.getSupportedAudioEncoders(container);
      if (supportedEncoders.length > 0) {
        store.updateAudioConfig({
          encoder: supportedEncoders[0].id
        });
        message.info(`已自动切换音频编码器为 ${supportedEncoders[0].name}`);
      }
    }
  }

  store.updateOutputConfig({ container });
};

// 处理浏览输出目录
const handleBrowseOutputDir = () => {
  // 这里需要实现目录选择功能
  // 可以使用 Tauri 的 dialog API 或其他方式
  message.info('目录选择功能将在后续版本中实现');
};
</script>

<style scoped>
.output-params-panel {
  padding: 16px;
  background-color: var(--n-color-embedded);
  border-radius: 8px;
}

.section-header {
  margin-bottom: 16px;
}

.section-header h3 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: #333;
}
</style>
