<template>
  <n-space vertical :size="16">
    <!-- 去隔行滤镜 -->
    <n-collapse :default-expanded-names="deinterlace.enabled ? ['deinterlace'] : []">
      <n-collapse-item title="📺 去隔行" name="deinterlace">
        <template #header-extra>
          <n-switch v-model:value="deinterlace.enabled" size="small" />
        </template>

        <n-space vertical v-if="deinterlace.enabled" :size="12">
          <n-alert type="info" size="small">
            去除视频的隔行扫描，适用于旧视频源
          </n-alert>

          <n-form-item label="去隔行模式">
            <n-select
              v-model:value="deinterlace.mode"
              :options="deinterlaceModes"
              style="width: 100%"
            />
          </n-form-item>

          <n-descriptions bordered size="small" :column="1">
            <n-descriptions-item label="yadif (0)">
              Yet Another Deinterlacing Filter，通用且快速
            </n-descriptions-item>
            <n-descriptions-item label="bwdif (1)">
              Bob Weaver Deinterlacing Filter，质量更高
            </n-descriptions-item>
            <n-descriptions-item label=" Yadif 2x (2)">
              Yadif 的双帧率模式
            </n-descriptions-item>
          </n-descriptions>
        </n-space>
      </n-collapse-item>
    </n-collapse>

    <!-- 降噪滤镜 -->
    <n-collapse :default-expanded-names="denoise.enabled ? ['denoise'] : []">
      <n-collapse-item title="🔇 降噪" name="denoise">
        <template #header-extra>
          <n-switch v-model:value="denoise.enabled" size="small" />
        </template>

        <n-space vertical v-if="denoise.enabled" :size="12">
          <n-alert type="info" size="small">
            减少视频噪点，提高画面质量
          </n-alert>

          <n-form-item label="降噪模式">
            <n-select
              v-model:value="denoise.mode"
              :options="denoiseModes"
              style="width: 100%"
              @update:value="updateDenoiseMode"
            />
          </n-form-item>

          <n-form-item :label="strengthLabel">
            <n-slider
              v-model:value="denoiseStrength"
              :min="1"
              :max="20"
              :step="0.5"
              :marks="{ 5: '弱', 10: '中', 15: '强' }"
              style="width: 100%"
              @update:value="updateDenoiseStrength"
            />
          </n-form-item>

          <n-space>
            <n-button size="small" @click="setDenoiseWeak">弱</n-button>
            <n-button size="small" @click="setDenoiseMedium">中</n-button>
            <n-button size="small" @click="setDenoiseStrong">强</n-button>
          </n-space>
        </n-space>
      </n-collapse-item>
    </n-collapse>

    <!-- 锐化滤镜 -->
    <n-collapse :default-expanded-names="sharpen.enabled ? ['sharpen'] : []">
      <n-collapse-item title="🔍 锐化" name="sharpen">
        <template #header-extra>
          <n-switch v-model:value="sharpen.enabled" size="small" />
        </template>

        <n-space vertical v-if="sharpen.enabled" :size="12">
          <n-alert type="info" size="small">
            增强画面细节，使图像更清晰
          </n-alert>

          <n-form-item label="锐化强度">
            <n-slider
              v-model:value="sharpenStrength"
              :min="0.5"
              :max="5"
              :step="0.1"
              :marks="{ 1: '弱', 2.5: '中', 4: '强' }"
              style="width: 100%"
              @update:value="updateSharpenStrength"
            />
          </n-form-item>

          <n-space>
            <n-button size="small" @click="setSharpenWeak">弱</n-button>
            <n-button size="small" @click="setSharpenMedium">中</n-button>
            <n-button size="small" @click="setSharpenStrong">强</n-button>
          </n-space>
        </n-space>
      </n-collapse-item>
    </n-collapse>

    <!-- 插帧滤镜 -->
    <n-collapse :default-expanded-names="interframe?.enabled ? ['interframe'] : []">
      <n-collapse-item title="⏱️ 插帧" name="interframe">
        <template #header-extra>
          <n-switch
            :value="interframe?.enabled"
            @update:value="toggleInterframe"
            size="small"
          />
        </template>

        <n-space vertical v-if="interframe?.enabled" :size="12">
          <n-alert type="info" size="small">
            增加视频帧率，使画面更流畅（需要更长的处理时间）
          </n-alert>

          <n-form-item label="目标帧率">
            <n-input-number
              v-model:value="interframeTargetFps"
              :min="24"
              :max="120"
              :step="1"
              style="width: 100%"
              @update:value="updateInterframeFps"
            />
          </n-form-item>

          <n-space>
            <n-button size="small" @click="setInterframeFps(60)">60 fps</n-button>
            <n-button size="small" @click="setInterframeFps(120)">120 fps</n-button>
          </n-space>

          <n-alert type="warning" size="small">
            注意：插帧会显著增加处理时间
          </n-alert>
        </n-space>
      </n-collapse-item>
    </n-collapse>
  </n-space>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import {
  NSpace,
  NCollapse,
  NCollapseItem,
  NSwitch,
  NAlert,
  NFormItem,
  NSelect,
  NSlider,
  NButton,
  NDescriptions,
  NDescriptionsItem
} from 'naive-ui';
import type { Filters } from '../../types/preset';

interface Props {
  filters: Filters;
}

interface Emits {
  (e: 'update:filters', filters: Partial<Filters>): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

// 去隔行模式选项
const deinterlaceModes = [
  { label: 'Yadif (推荐)', value: 0 },
  { label: 'Bwdif (高质量)', value: 1 },
  { label: 'Yadif 2x (双帧率)', value: 2 }
];

// 降噪模式选项
const denoiseModes = [
  { label: 'NLMeans (高质量)', value: 'nlmeans' },
  { label: 'HQDN3D (快速)', value: 'hqdn3d' }
];

const deinterlace = computed(() =>
  props.filters.deinterlace || { enabled: false, mode: 0 }
);

const denoise = computed(() =>
  props.filters.denoise || { enabled: false, mode: 'nlmeans', strength: '5' }
);

const sharpen = computed(() =>
  props.filters.sharpen || { enabled: false, strength: '1.5' }
);

// 插帧滤镜（自定义扩展）
const interframe = computed(() =>
  (props.filters as any).interframe || { enabled: false, targetFps: 60 }
);

const denoiseStrength = computed({
  get: () => parseFloat(denoise.value.strength || '5'),
  set: (val: number) => updateDenoiseStrength(val)
});

const sharpenStrength = computed({
  get: () => parseFloat(sharpen.value.strength || '1.5'),
  set: (val: number) => updateSharpenStrength(val)
});

const interframeTargetFps = computed({
  get: () => interframe.value.targetFps || 60,
  set: (val: number) => updateInterframeFps(val)
});

const strengthLabel = computed(() => {
  return denoise.value.mode === 'nlmeans' ? 'NLMeans 强度' : 'HQDN3D 强度';
});

// 更新函数
const updateDenoiseMode = (mode: string) => {
  emit('update:filters', {
    denoise: {
      ...denoise.value,
      mode
    }
  });
};

const updateDenoiseStrength = (strength: number) => {
  emit('update:filters', {
    denoise: {
      ...denoise.value,
      strength: strength.toString()
    }
  });
};

const updateSharpenStrength = (strength: number) => {
  emit('update:filters', {
    sharpen: {
      ...sharpen.value,
      strength: strength.toString()
    }
  });
};

// 插帧相关
const toggleInterframe = (enabled: boolean) => {
  emit('update:filters', {
    interframe: {
      ...interframe.value,
      enabled
    }
  });
};

const updateInterframeFps = (targetFps: number) => {
  emit('update:filters', {
    interframe: {
      ...interframe.value,
      targetFps
    }
  });
};

const setInterframeFps = (fps: number) => {
  emit('update:filters', {
    interframe: {
      ...interframe.value,
      targetFps: fps
    }
  });
};

// 预设按钮
const setDenoiseWeak = () => updateDenoiseStrength(3);
const setDenoiseMedium = () => updateDenoiseStrength(5);
const setDenoiseStrong = () => updateDenoiseStrength(10);

const setSharpenWeak = () => updateSharpenStrength(1);
const setSharpenMedium = () => updateSharpenStrength(1.5);
const setSharpenStrong = () => updateSharpenStrength(2.5);
</script>
