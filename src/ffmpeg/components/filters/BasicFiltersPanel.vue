<template>
  <n-space vertical :size="16">
    <!-- 裁剪滤镜 -->
    <n-collapse :default-expanded-names="crop.enabled ? ['crop'] : []">
      <n-collapse-item title="✂️ 裁剪" name="crop">
        <template #header-extra>
          <n-switch v-model:value="crop.enabled" size="small" />
        </template>

        <n-space vertical v-if="crop.enabled" :size="12">
          <n-alert type="info" size="small">
            裁剪视频到指定尺寸
          </n-alert>

          <n-form-item label="宽度">
            <n-input-number
              v-model:value="cropWidth"
              :min="1"
              :max="4096"
              placeholder="例如: 1920 或 iw-100"
              style="width: 100%"
            />
          </n-form-item>

          <n-form-item label="高度">
            <n-input-number
              v-model:value="cropHeight"
              :min="1"
              :max="4096"
              placeholder="例如: 1080 或 ih-100"
              style="width: 100%"
            />
          </n-form-item>

          <n-form-item label="X 位置">
            <n-input
              v-model:value="crop.x"
              placeholder="例如: 0, (iw-ow)/2"
            />
          </n-form-item>

          <n-form-item label="Y 位置">
            <n-input
              v-model:value="crop.y"
              placeholder="例如: 0, (ih-oh)/2"
            />
          </n-form-item>

          <n-space>
            <n-button size="small" @click="setCropCenter">居中裁剪</n-button>
            <n-button size="small" @click="resetCrop">重置</n-button>
          </n-space>
        </n-space>
      </n-collapse-item>
    </n-collapse>

    <!-- 缩放滤镜 -->
    <n-collapse :default-expanded-names="scale.enabled ? ['scale'] : []">
      <n-collapse-item title="📐 缩放" name="scale">
        <template #header-extra>
          <n-switch v-model:value="scale.enabled" size="small" />
        </template>

        <n-space vertical v-if="scale.enabled" :size="12">
          <n-alert type="info" size="small">
            调整视频分辨率，-1 表示保持宽高比
          </n-alert>

          <n-form-item label="保持宽高比">
            <n-switch v-model:value="scale.keepAspect" />
          </n-form-item>

          <n-grid :cols="2" :x-gap="12">
            <n-gi>
              <n-form-item label="宽度">
                <n-input
                  v-model:value="scale.width"
                  placeholder="例如: 1920, -1, iw/2"
                />
              </n-form-item>
            </n-gi>
            <n-gi>
              <n-form-item label="高度">
                <n-input
                  v-model:value="scale.height"
                  placeholder="例如: 1080, -1, ih/2"
                />
              </n-form-item>
            </n-gi>
          </n-grid>

          <n-form-item label="缩放算法">
            <n-select
              v-model:value="scale.algorithm"
              :options="scaleAlgorithms"
              placeholder="默认算法"
              clearable
            />
          </n-form-item>

          <n-space>
            <n-button size="small" @click="setScale1080p">1080p</n-button>
            <n-button size="small" @click="setScale720p">720p</n-button>
            <n-button size="small" @click="setScale480p">480p</n-button>
            <n-button size="small" @click="resetScale">重置</n-button>
          </n-space>
        </n-space>
      </n-collapse-item>
    </n-collapse>

    <!-- 帧率滤镜 -->
    <n-collapse :default-expanded-names="framerate.enabled ? ['framerate'] : []">
      <n-collapse-item title="🔄 帧率" name="framerate">
        <template #header-extra>
          <n-switch v-model:value="framerate.enabled" size="small" />
        </template>

        <n-space vertical v-if="framerate.enabled" :size="12">
          <n-alert type="info" size="small">
            调整视频帧率
          </n-alert>

          <n-form-item label="目标帧率">
            <n-input-number
              v-model:value="framerateFps"
              :min="1"
              :max="240"
              :precision="2"
              placeholder="例如: 30, 29.97, 60"
              style="width: 100%"
            />
          </n-form-item>

          <n-space>
            <n-button size="small" @click="setFps(24)">24 fps</n-button>
            <n-button size="small" @click="setFps(30)">30 fps</n-button>
            <n-button size="small" @click="setFps(60)">60 fps</n-button>
          </n-space>
        </n-space>
      </n-collapse-item>
    </n-collapse>

    <!-- 旋转/翻转滤镜 -->
    <n-collapse :default-expanded-names="transform.enabled ? ['transform'] : []">
      <n-collapse-item title="↻ 旋转/翻转" name="transform">
        <template #header-extra>
          <n-switch v-model:value="transform.enabled" size="small" />
        </template>

        <n-space vertical v-if="transform.enabled" :size="12">
          <n-form-item label="旋转角度">
            <n-radio-group v-model:value="transform.rotation">
              <n-radio-button value="0">0°</n-radio-button>
              <n-radio-button value="90">90°</n-radio-button>
              <n-radio-button value="180">180°</n-radio-button>
              <n-radio-button value="270">270°</n-radio-button>
            </n-radio-group>
          </n-form-item>

          <n-form-item label="水平翻转">
            <n-switch v-model:value="transform.flipH" />
          </n-form-item>

          <n-form-item label="垂直翻转">
            <n-switch v-model:value="transform.flipV" />
          </n-form-item>
        </n-space>
      </n-collapse-item>
    </n-collapse>
  </n-space>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import {
  NCard,
  NSpace,
  NCollapse,
  NCollapseItem,
  NSwitch,
  NAlert,
  NFormItem,
  NInput,
  NInputNumber,
  NGrid,
  NGi,
  NSelect,
  NButton,
  NRadioGroup,
  NRadioButton
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

// 缩放算法选项
const scaleAlgorithms = [
  { label: 'Bicubic (默认)', value: 'bicubic' },
  { label: 'Bilinear', value: 'bilinear' },
  { label: 'Lanczos (高质量)', value: 'lanczos' },
  { label: 'Spline (高质量)', value: 'spline' },
  { label: 'Neighbor (像素化)', value: 'neighbor' }
];

const crop = computed(() => props.filters.crop || { enabled: false, width: '', height: '', x: '', y: '' });
const scale = computed(() => props.filters.scale || { enabled: false, width: '', height: '', keepAspect: true, algorithm: '' });
const framerate = computed(() => props.filters.framerate || { enabled: false, fps: '', mode: 0 });
const transform = computed(() => props.filters.transform || { enabled: false, rotation: '0', flipH: false, flipV: false });

// 裁剪相关的 computed
const cropWidth = computed({
  get: () => crop.value.width ? parseInt(crop.value.width) : null,
  set: (val) => emitCrop('width', val ? val.toString() : '')
});
const cropHeight = computed({
  get: () => crop.value.height ? parseInt(crop.value.height) : null,
  set: (val) => emitCrop('height', val ? val.toString() : '')
});

const framerateFps = computed({
  get: () => framerate.value.fps ? parseFloat(framerate.value.fps) : null,
  set: (val) => emitFramerate('fps', val ? val.toString() : '')
});

const emitCrop = (key: string, value: string) => {
  emit('update:filters', {
    crop: {
      ...crop.value,
      [key]: value
    }
  });
};

const emitScale = (key: string, value: any) => {
  emit('update:filters', {
    scale: {
      ...scale.value,
      [key]: value
    }
  });
};

const emitFramerate = (key: string, value: any) => {
  emit('update:filters', {
    framerate: {
      ...framerate.value,
      [key]: value
    }
  });
};

const emitTransform = (key: string, value: any) => {
  emit('update:filters', {
    transform: {
      ...transform.value,
      [key]: value
    }
  });
};

// 裁剪功能
const setCropCenter = () => {
  emit('update:filters', {
    crop: {
      ...crop.value,
      x: '(iw-ow)/2',
      y: '(ih-oh)/2'
    }
  });
};

const resetCrop = () => {
  emit('update:filters', {
    crop: {
      enabled: true,
      width: '',
      height: '',
      x: '',
      y: ''
    }
  });
};

// 缩放功能
const setScale1080p = () => {
  emit('update:filters', {
    scale: {
      ...scale.value,
      width: '1920',
      height: scale.value.keepAspect ? '-1' : '1080'
    }
  });
};

const setScale720p = () => {
  emit('update:filters', {
    scale: {
      ...scale.value,
      width: '1280',
      height: scale.value.keepAspect ? '-1' : '720'
    }
  });
};

const setScale480p = () => {
  emit('update:filters', {
    scale: {
      ...scale.value,
      width: '854',
      height: scale.value.keepAspect ? '-1' : '480'
    }
  });
};

const resetScale = () => {
  emit('update:filters', {
    scale: {
      enabled: true,
      width: '',
      height: '',
      keepAspect: true,
      algorithm: ''
    }
  });
};

// 帧率功能
const setFps = (fps: number) => {
  emit('update:filters', {
    framerate: {
      ...framerate.value,
      fps: fps.toString()
    }
  });
};

// 监听属性变化
watch([crop, scale, framerate, transform], (newValues) => {
  // 当 computed 返回的值变化时，触发更新
}, { deep: true });
</script>
