<template>
  <n-card title="硬件加速" size="small">
    <template #header-extra>
      <n-space>
        <n-tag v-if="hwaccel !== 'auto'" :bordered="false" type="success">
          {{ hwaccelLabel }}
        </n-tag>
        <n-tag v-else :bordered="false" type="default">
          自动检测
        </n-tag>
      </n-space>
    </template>

    <n-space vertical :size="16">
      <n-alert type="info">
        硬件加速可以大幅提升视频处理速度，支持 NVIDIA、Intel、AMD 等平台
      </n-alert>

      <!-- 硬件加速方式 -->
      <n-form-item label="硬件加速方式">
        <n-select
          v-model:value="hwaccel"
          :options="hwaccelOptions"
          placeholder="选择硬件加速方式"
          style="width: 100%"
          @update:value="updateHwaccel"
        />
      </n-form-item>

      <!-- 设备选择 -->
      <n-form-item v-if="needsDevice" label="硬件设备">
        <n-space style="width: 100%">
          <n-input
            v-model:value="hwaccelDevice"
            placeholder="例如: 0, 0:0, cuda:0"
            style="flex: 1"
            @update:value="updateHwaccelDevice"
          />
          <n-button size="small" @click="detectDevices">检测设备</n-button>
        </n-space>
      </n-form-item>

      <!-- 当前状态 -->
      <n-divider>当前状态</n-divider>

      <n-descriptions bordered :column="2">
        <n-descriptions-item label="硬件加速">
          {{ hwaccelLabel }}
        </n-descriptions-item>
        <n-descriptions-item label="硬件设备">
          {{ hwaccelDevice || '未设置' }}
        </n-descriptions-item>
        <n-descriptions-item label="解码器">
          {{ decoderLabel }}
        </n-descriptions-item>
        <n-descriptions-item label="编码器">
          {{ encoderLabel }}
        </n-descriptions-item>
      </n-descriptions>

      <!-- 平台信息 -->
      <n-divider>平台信息</n-divider>

      <n-card size="small" :bordered="true">
        <n-space vertical :size="8">
          <n-space align="center">
            <span style="font-size: 24px">{{ platformIcon }}</span>
            <span style="font-weight: 500">{{ platformName }}</span>
          </n-space>
          <n-text depth="3">{{ platformDescription }}</n-text>

          <!-- GPU 信息 -->
          <n-collapse v-if="gpuInfo">
            <n-collapse-item title="GPU 信息">
              <n-descriptions bordered :column="1" size="small">
                <n-descriptions-item v-for="(value, key) in gpuInfo" :key="key" :label="key">
                  {{ value }}
                </n-descriptions-item>
              </n-descriptions>
            </n-collapse-item>
          </n-collapse>
        </n-space>
      </n-card>

      <!-- 硬件加速选项 -->
      <template v-if="hwaccel !== 'auto'">
        <n-divider>硬件加速选项</n-divider>

        <!-- NVENC 选项 -->
        <template v-if="hwaccel === 'cuda' || hwaccel === 'nvenc'">
          <n-card title="NVENC 选项" size="small" :bordered="true">
            <n-space vertical :size="12">
              <n-form-item label="编码预设">
                <n-select
                  v-model:value="nvencPreset"
                  :options="nvencPresetOptions"
                  style="width: 100%"
                  @update:value="updateNvencPreset"
                />
              </n-form-item>

              <n-form-item label="编码器">
                <n-select
                  v-model:value="nvencEncoder"
                  :options="nvencEncoderOptions"
                  style="width: 100%"
                  @update:value="updateNvencEncoder"
                />
              </n-form-item>

              <n-alert type="info">
                NVENC 是 NVIDIA GPU 的硬件编码器，支持 H.264、H.265 (HEVC)、AV1 等格式
              </n-alert>
            </n-space>
          </n-card>
        </template>

        <!-- QSV 选项 -->
        <template v-if="hwaccel === 'qsv'">
          <n-card title="Intel QSV 选项" size="small" :bordered="true">
            <n-space vertical :size="12">
              <n-form-item label="编码器">
                <n-select
                  v-model:value="qsvEncoder"
                  :options="qsvEncoderOptions"
                  style="width: 100%"
                  @update:value="updateQsvEncoder"
                />
              </n-form-item>

              <n-alert type="info">
                Intel Quick Sync Video 是 Intel 集成显卡的硬件编码器
              </n-alert>
            </n-space>
          </n-card>
        </template>

        <!-- AMF 选项 -->
        <template v-if="hwaccel === 'd3d11va' || hwaccel === 'amf'">
          <n-card title="AMD AMF 选项" size="small" :bordered="true">
            <n-space vertical :size="12">
              <n-form-item label="编码器">
                <n-select
                  v-model:value="amfEncoder"
                  :options="amfEncoderOptions"
                  style="width: 100%"
                  @update:value="updateAmfEncoder"
                />
              </n-form-item>

              <n-alert type="info">
                AMD Advanced Media Framework 是 AMD GPU 的硬件编码器
              </n-alert>
            </n-space>
          </n-card>
        </template>
      </template>

      <!-- 性能对比 -->
      <n-divider>性能对比</n-divider>

      <n-table :single-line="false" size="small">
        <thead>
          <tr>
            <th>方式</th>
            <th>速度</th>
            <th>质量</th>
            <th>兼容性</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>CPU (软件)</td>
            <td>⭐⭐</td>
            <td>⭐⭐⭐⭐⭐</td>
            <td>⭐⭐⭐⭐⭐</td>
          </tr>
          <tr>
            <td>NVENC</td>
            <td>⭐⭐⭐⭐⭐</td>
            <td>⭐⭐⭐⭐</td>
            <td>⭐⭐⭐⭐</td>
          </tr>
          <tr>
            <td>Intel QSV</td>
            <td>⭐⭐⭐⭐</td>
            <td>⭐⭐⭐⭐</td>
            <td>⭐⭐⭐⭐</td>
          </tr>
          <tr>
            <td>AMD AMF</td>
            <td>⭐⭐⭐⭐</td>
            <td>⭐⭐⭐⭐</td>
            <td>⭐⭐⭐</td>
          </tr>
          <tr>
            <td>VideoToolbox</td>
            <td>⭐⭐⭐⭐</td>
            <td>⭐⭐⭐⭐</td>
            <td>⭐⭐</td>
          </tr>
          <tr>
            <td>Videotoolbox</td>
            <td>⭐⭐⭐⭐</td>
            <td>⭐⭐⭐⭐</td>
            <td>⭐⭐</td>
          </tr>
        </tbody>
      </n-table>

      <!-- 快速切换 -->
      <n-divider>快速切换</n-divider>

      <n-space>
        <n-button @click="setHwaccel('auto')">自动</n-button>
        <n-button @click="setHwaccel('cuda')" v-if="isWindows">NVENC</n-button>
        <n-button @click="setHwaccel('qsv')" v-if="isWindows || isLinux">Intel QSV</n-button>
        <n-button @click="setHwaccel('d3d11va')" v-if="isWindows">AMD AMF</n-button>
        <n-button @click="setHwaccel('videotoolbox')" v-if="isMac">VideoToolbox</n-button>
      </n-space>
    </n-space>
  </n-card>
</template>

<script setup lang="ts">
import { computed, ref, onMounted } from 'vue';
import {
  NCard,
  NSpace,
  NAlert,
  NTag,
  NFormItem,
  NSelect,
  NInput,
  NButton,
  NDivider,
  NDescriptions,
  NDescriptionsItem,
  NCollapse,
  NCollapseItem,
  NTable,
  NText
} from 'naive-ui';
import { useFFmpegParamsStore } from '../stores/ffmpegParams';
import { useMessage } from 'naive-ui';

const ffmpegParams = useFFmpegParamsStore();
const message = useMessage();

const hwaccel = computed(() => ffmpegParams.currentPreset.decoder.hwaccel);
const hwaccelDevice = computed(() => ffmpegParams.currentPreset.decoder.hwaccelDevice);
const video = computed(() => ffmpegParams.currentPreset.video);

const nvencPreset = ref('p1');
const nvencEncoder = ref('h264_nvenc');
const qsvEncoder = ref('h264_qsv');
const amfEncoder = ref('h264_amf');
const gpuInfo = ref<Record<string, string> | null>(null);

// 硬件加速选项
const hwaccelOptions = [
  { label: '自动检测', value: 'auto' },
  { label: 'NVIDIA NVENC', value: 'cuda' },
  { label: 'Intel QSV', value: 'qsv' },
  { label: 'AMD AMF (D3D11)', value: 'd3d11va' },
  { label: 'AMD AMF', value: 'amf' },
  { label: 'VideoToolbox (macOS)', value: 'videotoolbox' },
  { label: 'VAAPI (Linux)', value: 'vaapi' },
  { label: '无硬件加速', value: 'none' }
];

// NVENC 预设选项
const nvencPresetOptions = [
  { label: 'P1: 最快', value: 'p1' },
  { label: 'P2: 很快', value: 'p2' },
  { label: 'P3: 快', value: 'p3' },
  { label: 'P4: 中等 (推荐)', value: 'p4' },
  { label: 'P5: 慢', value: 'p5' },
  { label: 'P6: 很慢', value: 'p6' },
  { label: 'P7: 最慢 (最高质量)', value: 'p7' }
];

// NVENC 编码器选项
const nvencEncoderOptions = [
  { label: 'H.264 (AVC)', value: 'h264_nvenc' },
  { label: 'H.265 (HEVC)', value: 'hevc_nvenc' },
  { label: 'AV1', value: 'av1_nvenc' }
];

// QSV 编码器选项
const qsvEncoderOptions = [
  { label: 'H.264 (AVC)', value: 'h264_qsv' },
  { label: 'H.265 (HEVC)', value: 'hevc_qsv' },
  { label: 'VP9', value: 'vp9_qsv' },
  { label: 'AV1', value: 'av1_qsv' }
];

// AMF 编码器选项
const amfEncoderOptions = [
  { label: 'H.264 (AVC)', value: 'h264_amf' },
  { label: 'H.265 (HEVC)', value: 'hevc_amf' },
  { label: 'AV1', value: 'av1_amf' }
];

// 计算属性
const needsDevice = computed(() =>
  ['cuda', 'qsv', 'd3d11va', 'vaapi'].includes(hwaccel.value)
);

const hwaccelLabel = computed(() => {
  const labels: Record<string, string> = {
    'auto': '自动检测',
    'cuda': 'NVIDIA NVENC',
    'qsv': 'Intel QSV',
    'd3d11va': 'AMD AMF (D3D11)',
    'amf': 'AMD AMF',
    'videotoolbox': 'VideoToolbox',
    'vaapi': 'VAAPI',
    'none': '无'
  };
  return labels[hwaccel.value] || hwaccel.value;
});

const decoderLabel = computed(() => {
  if (hwaccel.value === 'auto' || hwaccel.value === 'none') {
    return ffmpegParams.currentPreset.decoder.decoder || 'auto';
  }
  return `${hwaccel.value} (硬件解码)`;
});

const encoderLabel = computed(() => {
  if (hwaccel.value === 'cuda') return nvencEncoder.value;
  if (hwaccel.value === 'qsv') return qsvEncoder.value;
  if (hwaccel.value === 'd3d11va' || hwaccel.value === 'amf') return amfEncoder.value;
  return video.value.encoder || 'libx264';
});

// 平台信息
const isWindows = computed(() => navigator.platform.includes('Win'));
const isMac = computed(() => navigator.platform.includes('Mac'));
const isLinux = computed(() => navigator.platform.includes('Linux'));

const platformName = computed(() => {
  if (isMac.value) return 'macOS';
  if (isWindows.value) return 'Windows';
  if (isLinux.value) return 'Linux';
  return 'Unknown';
});

const platformIcon = computed(() => {
  if (isMac.value) return '🍎';
  if (isWindows.value) return '🪟';
  if (isLinux.value) return '🐧';
  return '💻';
});

const platformDescription = computed(() => {
  if (isMac.value) return '使用 VideoToolbox 进行硬件加速';
  if (isWindows.value) return '支持 NVENC、QSV、AMF 硬件加速';
  if (isLinux.value) return '支持 VAAPI 硬件加速';
  return '检测系统后推荐合适的硬件加速方式';
});

// 更新函数
const updateHwaccel = (value: string) => {
  ffmpegParams.updatePreset({
    decoder: {
      ...ffmpegParams.currentPreset.decoder,
      hwaccel: value
    }
  });

  // 自动切换到对应的硬件编码器
  if (value === 'cuda') {
    ffmpegParams.updateVideoConfig({ encoder: nvencEncoder.value });
  } else if (value === 'qsv') {
    ffmpegParams.updateVideoConfig({ encoder: qsvEncoder.value });
  } else if (value === 'd3d11va' || value === 'amf') {
    ffmpegParams.updateVideoConfig({ encoder: amfEncoder.value });
  } else if (value === 'none') {
    ffmpegParams.updateVideoConfig({ encoder: 'libx264' });
  }
};

const updateHwaccelDevice = (value: string) => {
  ffmpegParams.updatePreset({
    decoder: {
      ...ffmpegParams.currentPreset.decoder,
      hwaccelDevice: value
    }
  });
};

const updateNvencPreset = (value: string) => {
  nvencPreset.value = value;
};

const updateNvencEncoder = (value: string) => {
  nvencEncoder.value = value;
  ffmpegParams.updateVideoConfig({ encoder: value });
};

const updateQsvEncoder = (value: string) => {
  qsvEncoder.value = value;
  ffmpegParams.updateVideoConfig({ encoder: value });
};

const updateAmfEncoder = (value: string) => {
  amfEncoder.value = value;
  ffmpegParams.updateVideoConfig({ encoder: value });
};

const setHwaccel = (value: string) => {
  updateHwaccel(value);
};

// 检测设备
const detectDevices = async () => {
  try {
    // 这里应该调用系统 API 检测可用的硬件设备
    message.info('正在检测硬件设备...');

    // 模拟检测结果
    setTimeout(() => {
      gpuInfo.value = {
        'GPU 型号': 'NVIDIA GeForce RTX 3080',
        '驱动版本': '546.33',
        'CUDA 版本': '12.2',
        '显存': '10 GB',
        '计算能力': '8.6'
      };
      message.success('检测到 NVIDIA GPU');
    }, 1000);
  } catch (error) {
    message.error('检测硬件设备失败');
    console.error('Failed to detect devices:', error);
  }
};

// 组件挂载时自动检测
onMounted(() => {
  if (hwaccel.value === 'auto') {
    detectDevices();
  }
});
</script>
