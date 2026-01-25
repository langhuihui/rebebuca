<template>
  <n-space vertical :size="16">
    <n-alert type="info">
      字幕烧录功能会将字幕直接嵌入到视频画面中
    </n-alert>

    <!-- 启用字幕 -->
    <n-form-item label="启用字幕烧录">
      <n-switch v-model:value="enabled" @update:value="toggleEnabled" />
    </n-form-item>

    <template v-if="enabled">
      <!-- 字幕源选择 -->
      <n-form-item label="字幕源">
        <n-radio-group v-model:value="source" @update:value="updateSource">
          <n-radio value="embedded">内置字幕</n-radio>
          <n-radio value="external">外部字幕文件</n-radio>
        </n-radio-group>
      </n-form-item>

      <!-- 内置字幕 -->
      <template v-if="source === 'embedded'">
        <n-form-item label="字幕流索引">
          <n-input-number
            v-model:value="streamIndex"
            :min="0"
            :max="99"
            placeholder="例如: 0"
            style="width: 100%"
            @update:value="updateStreamIndex"
          />
        </n-form-item>
        <n-text depth="3" style="font-size: 12px">
          提示：使用 ffprobe 可以查看视频的字幕流索引
        </n-text>
      </template>

      <!-- 外部字幕 -->
      <template v-if="source === 'external'">
        <n-form-item label="字幕文件">
          <n-space style="width: 100%">
            <n-input
              v-model:value="file"
              placeholder="选择字幕文件路径"
              readonly
              style="flex: 1"
            />
            <n-button @click="selectSubtitleFile">浏览</n-button>
          </n-space>
        </n-form-item>

        <n-text depth="3" style="font-size: 12px">
          支持格式：SRT, ASS, SSA, VTT 等
        </n-text>
      </template>

      <!-- 字幕样式 -->
      <n-divider>字幕样式配置</n-divider>

      <n-form-item label="字体名称">
        <n-select
          v-model:value="fontName"
          :options="fontOptions"
          filterable
          tag
          placeholder="例如: Arial, Microsoft YaHei"
          style="width: 100%"
          @update:value="updateStyling"
        />
      </n-form-item>

      <n-grid :cols="2" :x-gap="12">
        <n-gi>
          <n-form-item label="字体大小">
            <n-input-number
              v-model:value="fontSize"
              :min="8"
              :max="72"
              style="width: 100%"
              @update:value="updateStyling"
            />
          </n-form-item>
        </n-gi>
        <n-gi>
          <n-form-item label="对齐方式">
            <n-select
              v-model:value="alignment"
              :options="alignmentOptions"
              style="width: 100%"
              @update:value="updateStyling"
            />
          </n-form-item>
        </n-gi>
      </n-grid>

      <n-form-item label="主颜色">
        <n-color-picker
          v-model:value="primaryColor"
          :modes="['hex']"
          style="width: 100%"
          @update:value="updateStyling"
        />
      </n-form-item>

      <n-form-item label="边框颜色">
        <n-color-picker
          v-model:value="outlineColor"
          :modes="['hex']"
          style="width: 100%"
          @update:value="updateStyling"
        />
      </n-form-item>

      <n-form-item label="背景颜色">
        <n-color-picker
          v-model:value="backColor"
          :modes="['hex']"
          style="width: 100%"
          @update:value="updateStyling"
        />
      </n-form-item>

      <!-- 预览 -->
      <n-divider>样式预览</n-divider>
      <div
        class="subtitle-preview"
        :style="previewStyle"
      >
        示例字幕文本
      </div>
    </template>
  </n-space>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import {
  NSpace,
  NAlert,
  NFormItem,
  NSwitch,
  NRadioGroup,
  NRadio,
  NInputNumber,
  NInput,
  NButton,
  NText,
  NDivider,
  NGrid,
  NGi,
  NSelect,
  NColorPicker
} from 'naive-ui';
import type { SubtitleFilter, SubtitleStyling } from '../../types/preset';
import { open } from '@tauri-apps/plugin-dialog';

interface Props {
  subtitle?: SubtitleFilter;
}

interface Emits {
  (e: 'update:subtitle', subtitle: SubtitleFilter): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const enabled = computed(() => props.subtitle?.enabled ?? false);
const source = computed(() => props.subtitle?.source ?? 'embedded');
const file = computed(() => props.subtitle?.file ?? '');
const streamIndex = computed(() => props.subtitle?.streamIndex ?? 0);
const styling = computed(() => props.subtitle?.styling ?? {
  forceStyle: '',
  fontSize: '24',
  fontName: 'Arial',
  primaryColor: '&H00FFFFFF',
  outlineColor: '&H00000000',
  backColor: '&H80000000',
  alignment: 2
});

// 样式属性
const fontSize = computed({
  get: () => parseInt(styling.value.fontSize || '24'),
  set: (val) => {
    updateStylingProperty('fontSize', val.toString());
  }
});

const fontName = computed({
  get: () => styling.value.fontName || '',
  set: (val) => {
    updateStylingProperty('fontName', val);
  }
});

const alignment = computed({
  get: () => styling.value.alignment || 2,
  set: (val) => {
    updateStylingProperty('alignment', val);
  }
});

const primaryColor = ref('');
const outlineColor = ref('');
const backColor = ref('');

// 选项
const fontOptions = [
  { label: 'Arial', value: 'Arial' },
  { label: 'Microsoft YaHei', value: 'Microsoft YaHei' },
  { label: 'SimSun', value: 'SimSun' },
  { label: 'SimHei', value: 'SimHei' },
  { label: 'Tahoma', value: 'Tahoma' },
  { label: 'Verdana', value: 'Verdana' }
];

const alignmentOptions = [
  { label: '左下 (1)', value: 1 },
  { label: '中下 (2)', value: 2 },
  { label: '右下 (3)', value: 3 },
  { label: '左中 (4)', value: 4 },
  { label: '中中 (5)', value: 5 },
  { label: '右中 (6)', value: 6 },
  { label: '左上 (7)', value: 7 },
  { label: '中上 (8)', value: 8 },
  { label: '右上 (9)', value: 9 }
];

// 预览样式
const previewStyle = computed(() => {
  return {
    fontFamily: styling.value.fontName || 'Arial',
    fontSize: `${styling.value.fontSize}px`,
    color: assColorToHex(styling.value.primaryColor || '&H00FFFFFF'),
    textShadow: `2px 2px 0 ${assColorToHex(styling.value.outlineColor || '&H00000000')}`,
    backgroundColor: assColorToHex(styling.value.backColor || '&H80000000', true),
    padding: '10px',
    textAlign: ['left', 'center', 'right'][((styling.value.alignment || 2) - 1) % 3] as any,
    borderRadius: '4px'
  };
});

// ASS 颜色格式转 CSS
function assColorToHex(assColor: string, withAlpha = false): string {
  // ASS 颜色格式: &HAABBGGRR (AABBGGRR)
  const match = assColor.match(/&H([0-9A-Fa-f]{2})([0-9A-Fa-f]{2})([0-9A-Fa-f]{2})([0-9A-Fa-f]{2})/);
  if (!match) return '#FFFFFF';

  const a = parseInt(match[1], 16);
  const b = parseInt(match[2], 16);
  const g = parseInt(match[3], 16);
  const r = parseInt(match[4], 16);

  if (withAlpha) {
    return `rgba(${r}, ${g}, ${b}, ${a / 255})`;
  }
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

function hexToAssColor(hex: string, alpha = 0): string {
  // 将 CSS 颜色转换为 ASS 格式
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `&H${alpha.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${r.toString(16).padStart(2, '0')}`;
}

// 更新函数
const toggleEnabled = (val: boolean) => {
  emit('update:subtitle', {
    ...props.subtitle,
    enabled: val,
    source: source.value,
    styling: styling.value
  } as SubtitleFilter);
};

const updateSource = (val: 'embedded' | 'external') => {
  emit('update:subtitle', {
    ...props.subtitle,
    enabled: true,
    source: val,
    styling: styling.value
  } as SubtitleFilter);
};

const updateStreamIndex = (val: number) => {
  emit('update:subtitle', {
    ...props.subtitle,
    enabled: true,
    source: 'embedded',
    streamIndex: val,
    styling: styling.value
  } as SubtitleFilter);
};

const updateStyling = () => {
  emit('update:subtitle', {
    ...props.subtitle,
    enabled: true,
    source: source.value,
    file: file.value,
    streamIndex: streamIndex.value,
    styling: {
      ...styling.value,
      primaryColor: hexToAssColor(primaryColor.value),
      outlineColor: hexToAssColor(outlineColor.value),
      backColor: hexToAssColor(backColor.value, 128)
    }
  } as SubtitleFilter);
};

const updateStylingProperty = (key: keyof SubtitleStyling, value: any) => {
  emit('update:subtitle', {
    ...props.subtitle,
    enabled: true,
    source: source.value,
    file: file.value,
    streamIndex: streamIndex.value,
    styling: {
      ...styling.value,
      [key]: value
    }
  } as SubtitleFilter);
};

const selectSubtitleFile = async () => {
  try {
    const selected = await open({
      multiple: false,
      filters: [
        {
          name: '字幕文件',
          extensions: ['srt', 'ass', 'ssa', 'vtt', 'sub']
        }
      ]
    });

    if (selected && typeof selected === 'string') {
      emit('update:subtitle', {
        ...props.subtitle,
        enabled: true,
        source: 'external',
        file: selected,
        styling: styling.value
      } as SubtitleFilter);
    }
  } catch (error) {
    console.error('Failed to select subtitle file:', error);
  }
};

// 初始化颜色选择器
primaryColor.value = '#FFFFFF';
outlineColor.value = '#000000';
backColor.value = '#000000';
</script>

<style scoped>
.subtitle-preview {
  background-color: #1a1a1a;
  color: #ffffff;
  min-height: 80px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  margin-top: 12px;
}
</style>
