<template>
  <n-space vertical :size="16">
    <n-alert type="info">
      色彩管理用于控制视频的色彩空间、像素格式等参数
    </n-alert>

    <!-- 启用色彩管理 -->
    <n-form-item label="启用色彩管理">
      <n-switch v-model:value="enabled" @update:value="toggleEnabled" />
    </n-form-item>

    <template v-if="enabled">
      <!-- 像素格式 -->
      <n-collapse :default-expanded-names="['pixel']">
        <n-collapse-item title="像素格式" name="pixel">
          <template #header-extra>
            <n-tag :bordered="false" type="info" size="small">
              {{ pixelFormat }}
            </n-tag>
          </template>

          <n-space vertical :size="8">
            <n-text depth="3">
              选择输出视频的像素格式
            </n-text>

            <n-select
              v-model:value="pixelFormat"
              :options="pixelFormatOptions"
              placeholder="选择像素格式"
              style="width: 100%"
              @update:value="updatePixelFormat"
            />

            <n-descriptions bordered size="small" :column="1">
              <n-descriptions-item label="yuv420p">
                8位 4:2:0 采样，兼容性最好（推荐）
              </n-descriptions-item>
              <n-descriptions-item label="yuv422p">
                8位 4:2:2 采样，色彩更精细
              </n-descriptions-item>
              <n-descriptions-item label="yuv444p">
                8位 4:4:4 采样，无损色彩
              </n-descriptions-item>
              <n-descriptions-item label="yuv420p10le">
                10位 4:2:0 采样，HDR 支持
              </n-descriptions-item>
            </n-descriptions>
          </n-space>
        </n-collapse-item>
      </n-collapse>

      <!-- 色彩空间 -->
      <n-collapse :default-expanded-names="['colorspace']">
        <n-collapse-item title="色彩空间" name="colorspace">
          <template #header-extra>
            <n-tag :bordered="false" type="info" size="small">
              {{ colorSpace }}
            </n-tag>
          </template>

          <n-space vertical :size="8">
            <n-text depth="3">
              选择输出的色彩空间
            </n-text>

            <n-select
              v-model:value="colorSpace"
              :options="colorSpaceOptions"
              placeholder="选择色彩空间"
              style="width: 100%"
              @update:value="updateColorSpace"
            />

            <n-descriptions bordered size="small" :column="1">
              <n-descriptions-item label="bt709">
                Rec.709，HD 视频标准（推荐）
              </n-descriptions-item>
              <n-descriptions-item label="bt601">
                Rec.601，SD 视频标准
              </n-descriptions-item>
              <n-descriptions-item label="bt2020">
                Rec.2020，UHD/HDR 标准
              </n-descriptions-item>
              <n-descriptions-item label="smpte170m">
                SMPTE 170M，NTSC 标准
              </n-descriptions-item>
            </n-descriptions>
          </n-space>
        </n-collapse-item>
      </n-collapse>

      <!-- 传输特性 -->
      <n-collapse :default-expanded-names="['transfer']">
        <n-collapse-item title="传输特性" name="transfer">
          <template #header-extra>
            <n-tag :bordered="false" type="info" size="small">
              {{ transfer }}
            </n-tag>
          </template>

          <n-space vertical :size="8">
            <n-text depth="3">
              选择伽马曲线和传输特性
            </n-text>

            <n-select
              v-model:value="transfer"
              :options="transferOptions"
              placeholder="选择传输特性"
              style="width: 100%"
              @update:value="updateTransfer"
            />

            <n-descriptions bordered size="small" :column="1">
              <n-descriptions-item label="bt709">
                Rec.709，SDR 标准（推荐）
              </n-descriptions-item>
              <n-descriptions-item label="bt601">
                Rec.601，SD 视频
              </n-descriptions-item>
              <n-descriptions-item label="smpte2084">
                SMPTE ST 2084，PQ HDR
              </n-descriptions-item>
              <n-descriptions-item label="arib-std-b67">
                ARIB STD-B67，HLG HDR
              </n-descriptions-item>
            </n-descriptions>
          </n-space>
        </n-collapse-item>
      </n-collapse>

      <!-- 原色 -->
      <n-collapse :default-expanded-names="['primaries']">
        <n-collapse-item title="原色" name="primaries">
          <template #header-extra>
            <n-tag :bordered="false" type="info" size="small">
              {{ primaries }}
            </n-tag>
          </template>

          <n-space vertical :size="8">
            <n-text depth="3">
              选择色彩原色标准
            </n-text>

            <n-select
              v-model:value="primaries"
              :options="primariesOptions"
              placeholder="选择原色"
              style="width: 100%"
              @update:value="updatePrimaries"
            />

            <n-descriptions bordered size="small" :column="1">
              <n-descriptions-item label="bt709">
                Rec.709，HD 标准（推荐）
              </n-descriptions-item>
              <n-descriptions-item label="bt2020">
                Rec.2020，UHD 广色域
              </n-descriptions-item>
              <n-descriptions-item label="smpte431">
                SMPTE 431，DCI-P3 色域
              </n-descriptions-item>
              <n-descriptions-item label="smpte432">
                SMPTE 432，DCI-P3 D65
              </n-descriptions-item>
            </n-descriptions>
          </n-space>
        </n-collapse-item>
      </n-collapse>

      <!-- 色彩范围 -->
      <n-collapse :default-expanded-names="['range']">
        <n-collapse-item title="色彩范围" name="range">
          <template #header-extra>
            <n-tag :bordered="false" type="info" size="small">
              {{ range || '未设置' }}
            </n-tag>
          </template>

          <n-space vertical :size="8">
            <n-text depth="3">
              选择色彩范围
            </n-text>

            <n-select
              v-model:value="range"
              :options="rangeOptions"
              placeholder="选择色彩范围"
              style="width: 100%"
              clearable
              @update:value="updateRange"
            />

            <n-descriptions bordered size="small" :column="1">
              <n-descriptions-item label="tv / limited">
                电视范围 (16-235)，推荐用于视频
              </n-descriptions-item>
              <n-descriptions-item label="pc / full">
                全范围 (0-255)，推荐用于电脑显示
              </n-descriptions-item>
            </n-descriptions>
          </n-space>
        </n-collapse-item>
      </n-collapse>

      <!-- 快速预设 -->
      <n-divider>快速预设</n-divider>

      <n-space>
        <n-button size="small" @click="setPreset('sdr')">SDR 视频</n-button>
        <n-button size="small" @click="setPreset('hdr10')">HDR10</n-button>
        <n-button size="small" @click="setPreset('hlg')">HLG</n-button>
        <n-button size="small" @click="resetToDefault">重置默认</n-button>
      </n-space>
    </template>
  </n-space>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import {
  NSpace,
  NAlert,
  NFormItem,
  NSwitch,
  NCollapse,
  NCollapseItem,
  NTag,
  NText,
  NSelect,
  NDescriptions,
  NDescriptionsItem,
  NDivider,
  NButton
} from 'naive-ui';
import type { ColorManagement } from '../../types/preset';

interface Props {
  color?: ColorManagement;
}

interface Emits {
  (e: 'update:color', color: ColorManagement): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const enabled = computed(() => props.color?.enabled ?? false);
const pixelFormat = computed(() => props.color?.pixelFormat ?? 'yuv420p');
const colorSpace = computed(() => props.color?.colorSpace ?? 'bt709');
const transfer = computed(() => props.color?.transfer ?? 'bt709');
const primaries = computed(() => props.color?.primaries ?? 'bt709');
const range = computed(() => props.color?.range ?? '');

// 选项
const pixelFormatOptions = [
  { label: 'yuv420p (8-bit, 推荐)', value: 'yuv420p' },
  { label: 'yuv422p (8-bit)', value: 'yuv422p' },
  { label: 'yuv444p (8-bit)', value: 'yuv444p' },
  { label: 'yuv420p10le (10-bit)', value: 'yuv420p10le' },
  { label: 'yuv422p10le (10-bit)', value: 'yuv422p10le' },
  { label: 'yuv444p10le (10-bit)', value: 'yuv444p10le' },
  { label: 'yuv420p12le (12-bit)', value: 'yuv420p12le' },
  { label: 'yuv422p12le (12-bit)', value: 'yuv422p12le' },
  { label: 'yuv444p12le (12-bit)', value: 'yuv444p12le' }
];

const colorSpaceOptions = [
  { label: 'bt709 (HD, 推荐)', value: 'bt709' },
  { label: 'bt601 (SD)', value: 'bt601' },
  { label: 'bt2020 (UHD)', value: 'bt2020' },
  { label: 'smpte170m (NTSC)', value: 'smpte170m' },
  { label: 'smpte240m', value: 'smpte240m' }
];

const transferOptions = [
  { label: 'bt709 (SDR, 推荐)', value: 'bt709' },
  { label: 'bt601', value: 'bt601' },
  { label: 'smpte2084 (HDR10 PQ)', value: 'smpte2084' },
  { label: 'arib-std-b67 (HLG)', value: 'arib-std-b67' },
  { label: 'linear', value: 'linear' },
  { label: 'log', value: 'log' },
  { label: 'log_sqrt', value: 'log_sqrt' },
  { label: 'iec61966-2-4', value: 'iec61966-2-4' }
];

const primariesOptions = [
  { label: 'bt709 (HD, 推荐)', value: 'bt709' },
  { label: 'bt2020 (UHD 广色域)', value: 'bt2020' },
  { label: 'smpte431 (DCI-P3)', value: 'smpte431' },
  { label: 'smpte432 (DCI-P3 D65)', value: 'smpte432' },
  { label: 'smpte170m (NTSC)', value: 'smpte170m' },
  { label: 'smpte240m', value: 'smpte240m' },
  { label: 'film', value: 'film' }
];

const rangeOptions = [
  { label: 'tv / limited', value: 'tv' },
  { label: 'pc / full', value: 'pc' }
];

// 更新函数
const toggleEnabled = (val: boolean) => {
  emit('update:color', {
    ...props.color,
    enabled: val,
    pixelFormat: pixelFormat.value,
    colorSpace: colorSpace.value,
    transfer: transfer.value,
    primaries: primaries.value
  } as ColorManagement);
};

const updatePixelFormat = (val: string) => {
  emit('update:color', {
    ...props.color,
    enabled: true,
    pixelFormat: val
  } as ColorManagement);
};

const updateColorSpace = (val: string) => {
  emit('update:color', {
    ...props.color,
    enabled: true,
    colorSpace: val
  } as ColorManagement);
};

const updateTransfer = (val: string) => {
  emit('update:color', {
    ...props.color,
    enabled: true,
    transfer: val
  } as ColorManagement);
};

const updatePrimaries = (val: string) => {
  emit('update:color', {
    ...props.color,
    enabled: true,
    primaries: val
  } as ColorManagement);
};

const updateRange = (val: string | null) => {
  emit('update:color', {
    ...props.color,
    enabled: true,
    range: val ?? undefined
  } as ColorManagement);
};

// 快速预设
const setPreset = (preset: 'sdr' | 'hdr10' | 'hlg') => {
  const presets = {
    sdr: {
      enabled: true,
      pixelFormat: 'yuv420p',
      colorSpace: 'bt709',
      transfer: 'bt709',
      primaries: 'bt709',
      range: 'tv'
    },
    hdr10: {
      enabled: true,
      pixelFormat: 'yuv420p10le',
      colorSpace: 'bt2020nc',
      transfer: 'smpte2084',
      primaries: 'bt2020',
      range: 'tv'
    },
    hlg: {
      enabled: true,
      pixelFormat: 'yuv420p10le',
      colorSpace: 'bt2020nc',
      transfer: 'arib-std-b67',
      primaries: 'bt2020',
      range: 'tv'
    }
  };

  emit('update:color', presets[preset] as ColorManagement);
};

const resetToDefault = () => {
  setPreset('sdr');
};
</script>
