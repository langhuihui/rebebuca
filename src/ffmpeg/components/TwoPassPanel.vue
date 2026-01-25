<template>
  <n-card title="二遍编码" size="small">
    <template #header-extra>
      <n-space>
        <n-tag v-if="video.passMode === 2" :bordered="false" type="success">
          二遍编码
        </n-tag>
        <n-tag v-else-if="video.passMode === 1" :bordered="false" type="warning">
          首遍分析
        </n-tag>
        <n-tag v-else :bordered="false" type="default">
          单次编码
        </n-tag>
      </n-space>
    </template>

    <n-space vertical :size="16">
      <n-alert type="info">
        二遍编码可以提升压缩效率和画质，但会增加编码时间
      </n-alert>

      <!-- 编码方式选择 -->
      <n-form-item label="编码方式">
        <n-radio-group v-model:value="video.passMode" @update:value="updatePassMode">
          <n-space vertical>
            <n-radio :value="0">
              <n-space align="center">
                <span>单次编码</span>
                <n-tag size="tiny" :bordered="false" type="info">快速</n-tag>
              </n-space>
            </n-radio>
            <n-radio :value="2">
              <n-space align="center">
                <span>二遍编码</span>
                <n-tag size="tiny" :bordered="false" type="success">高质量</n-tag>
              </n-space>
            </n-radio>
          </n-space>
        </n-radio-group>
      </n-form-item>

      <!-- 二遍编码说明 -->
      <template v-if="video.passMode === 2">
        <n-divider>二遍编码配置</n-divider>

        <!-- 日志文件 -->
        <n-form-item label="日志文件路径">
          <n-space style="width: 100%">
            <n-input
              v-model:value="passLogFile"
              placeholder="自动生成日志文件名"
              readonly
              style="flex: 1"
            />
            <n-button size="small" @click="browseLogFile">浏览</n-button>
          </n-space>
        </n-form-item>

        <!-- 二遍编码优势 -->
        <n-alert type="success" title="二遍编码优势">
          <ul style="margin: 8px 0; padding-left: 20px">
            <li>更好的比特率控制，更接近目标码率</li>
            <li>更高的压缩效率，相同质量下文件更小</li>
            <li>避免码率尖峰，更适合流媒体传输</li>
          </ul>
        </n-alert>

        <!-- 二遍编码缺点 -->
        <n-alert type="warning" title="注意事项">
          <ul style="margin: 8px 0; padding-left: 20px">
            <li>编码时间约为单次编码的 1.5-2 倍</li>
            <li>需要临时文件存储空间</li>
            <li>不支持某些编码参数（如 CRF）</li>
          </ul>
        </n-alert>

        <!-- 推荐场景 -->
        <n-divider>推荐使用场景</n-divider>

        <n-space vertical :size="8">
          <n-checkbox :checked="recommendedScenes.includes('vbr')" disabled>
            VBR 码率控制模式
          </n-checkbox>
          <n-checkbox :checked="recommendedScenes.includes('streaming')" disabled>
            视频流媒体传输
          </n-checkbox>
          <n-checkbox :checked="recommendedScenes.includes('fileSize')" disabled>
            需要精确控制文件大小
          </n-checkbox>
          <n-checkbox :checked="recommendedScenes.includes('quality')" disabled>
            追求最高压缩质量
          </n-checkbox>
        </n-space>

        <!-- 不推荐场景 -->
        <n-alert type="error" title="不推荐使用场景">
          <ul style="margin: 8px 0; padding-left: 20px">
            <li>CRF 质量模式（二遍编码无效果）</li>
            <li>快速预览/测试编码</li>
            <li>实时编码场景</li>
          </ul>
        </n-alert>

        <!-- 编码预设建议 -->
        <n-divider>编码预设建议</n-divider>

        <n-form-item label="编码预设">
          <n-select
            :value="video.preset"
            :options="presetRecommendations"
            @update:value="updatePreset"
            style="width: 100%"
          />
        </n-form-item>

        <n-text depth="3" style="font-size: 12px">
          二遍编码时，建议使用 slow 或更慢的预设以获得更好的压缩效率
        </n-text>
      </template>

      <!-- 单次编码说明 -->
      <template v-else>
        <n-divider>单次编码</n-divider>

        <n-alert type="info">
          单次编码速度快，适合快速预览、测试编码和 CRF 质量模式
        </n-alert>

        <n-space vertical :size="8">
          <n-text strong>优点：</n-text>
          <ul style="margin: 0 0 8px 20px">
            <li>编码速度快</li>
            <li>不需要临时文件</li>
            <li>支持 CRF 质量模式</li>
          </ul>

          <n-text strong>适用场景：</n-text>
          <ul style="margin: 0 0 8px 20px">
            <li>CRF 质量模式</li>
            <li>快速预览/测试</li>
            <li>实时编码</li>
          </ul>
        </n-space>
      </template>

      <!-- 质量控制提醒 -->
      <n-divider v-if="video.passMode === 2">质量控制提醒</n-divider>

      <n-alert
        v-if="video.passMode === 2 && quality.controlMode === 'CRF'"
        type="error"
        title="CRF 模式不适合二遍编码"
      >
        CRF 是恒定质量模式，二遍编码不会带来质量提升。建议切换到 VBR 模式。
        <template #action>
          <n-button size="small" type="primary" @click="switchToVBR">
            切换到 VBR
          </n-button>
        </template>
      </n-alert>

      <n-alert
        v-if="video.passMode === 2 && quality.controlMode !== 'CRF'"
        type="success"
        title="适合二遍编码"
      >
        当前质量控制模式适合二遍编码
      </n-alert>
    </n-space>
  </n-card>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import {
  NCard,
  NSpace,
  NAlert,
  NTag,
  NFormItem,
  NRadioGroup,
  NRadio,
  NCheckbox,
  NDivider,
  NInput,
  NButton,
  NSelect,
  NText
} from 'naive-ui';
import { useFFmpegParamsStore } from '../stores/ffmpegParams';
import type { Quality } from '../types/preset';
import { open, save } from '@tauri-apps/plugin-dialog';

const ffmpegParams = useFFmpegParamsStore();

const video = computed(() => ffmpegParams.currentPreset.video);
const quality = computed(() => ffmpegParams.currentPreset.quality);

const passLogFile = ref('');

// 推荐场景
const recommendedScenes = ['vbr', 'streaming', 'fileSize', 'quality'];

// 编码预设建议
const presetRecommendations = [
  { label: 'medium (平衡)', value: 'medium' },
  { label: 'slow (高质量)', value: 'slow' },
  { label: 'slower (更高质量)', value: 'slower' },
  { label: 'veryslow (最高质量)', value: 'veryslow' }
];

// 生成日志文件路径
const generateLogFile = () => {
  const timestamp = Date.now();
  return `ffmpeg2pass-${timestamp}.log`;
};

// 初始化日志文件路径
passLogFile.value = generateLogFile();

// 更新编码方式
const updatePassMode = (mode: number) => {
  ffmpegParams.updateVideoConfig({ passMode: mode });

  // 如果切换到二遍编码，更新日志文件
  if (mode === 2 && !video.value.passLogFile) {
    ffmpegParams.updateVideoConfig({
      passMode: 2,
      passLogFile: generateLogFile()
    });
  }
};

// 更新编码预设
const updatePreset = (preset: string) => {
  ffmpegParams.updateVideoConfig({ preset });
};

// 浏览日志文件
const browseLogFile = async () => {
  try {
    const selected = await save({
      filters: [
        {
          name: '日志文件',
          extensions: ['log']
        }
      ],
      defaultPath: passLogFile.value
    });

    if (selected && typeof selected === 'string') {
      passLogFile.value = selected;
      ffmpegParams.updateVideoConfig({
        passMode: 2,
        passLogFile: selected
      });
    }
  } catch (error) {
    console.error('Failed to save log file:', error);
  }
};

// 切换到 VBR 模式
const switchToVBR = () => {
  ffmpegParams.updateQualityConfig({
    controlMode: 'VBR',
    paramName: 'b',
    value: '0',
    bitrate: {
      ...quality.value.bitrate,
      base: '5M',
      min: '4M',
      max: '6M',
      bufferSize: '10M'
    }
  });
};
</script>
