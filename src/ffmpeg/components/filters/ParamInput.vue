<template>
  <div class="param-input-wrapper">
    <!-- 参数标签 -->
    <div class="param-label">
      <n-text style="font-size: 12px">
        {{ paramDef.label }}
        <span v-if="paramDef.required" class="required-mark">*</span>
      </n-text>

      <!-- Tooltip 提示 -->
      <n-tooltip v-if="paramDef.description" trigger="hover" placement="top">
        <template #trigger>
          <span class="info-icon">ℹ️</span>
        </template>
        <div class="tooltip-content">
          <div>{{ paramDef.description }}</div>
          <div v-if="paramDef.min !== undefined || paramDef.max !== undefined" class="range-hint">
            <n-text depth="3" style="font-size: 11px">
              范围: {{ paramDef.min ?? '-' }} ~ {{ paramDef.max ?? '-' }}
            </n-text>
          </div>
        </div>
      </n-tooltip>
    </div>

    <!-- 参数输入控件 -->
    <div class="param-input" :class="{ 'has-error': error }">
      <!-- 数字输入 -->
      <n-input-number
        v-if="paramDef.type === 'number'"
        :value="value"
        size="small"
        :min="paramDef.min"
        :max="paramDef.max"
        :step="paramDef.step || 1"
        :precision="paramDef.precision"
        placeholder="请输入数字"
        @update:value="onUpdate"
      />

      <!-- 整数输入 (int) -->
      <n-input-number
        v-else-if="paramDef.type === 'int'"
        :value="value"
        size="small"
        :min="paramDef.min"
        :max="paramDef.max"
        :step="1"
        :precision="0"
        placeholder="请输入整数"
        @update:value="onUpdate"
      />

      <!-- 浮点数输入 (double, float) -->
      <n-input-number
        v-else-if="paramDef.type === 'double' || paramDef.type === 'float'"
        :value="value"
        size="small"
        :min="paramDef.min"
        :max="paramDef.max"
        :step="0.01"
        :precision="2"
        placeholder="请输入浮点数"
        @update:value="onUpdate"
      />

      <!-- 字符串输入 -->
      <n-input
        v-else-if="paramDef.type === 'string'"
        :value="value"
        size="small"
        :placeholder="paramDef.desc || '请输入文本'"
        clearable
        @update:value="onUpdate"
      />

      <!-- 布尔值 -->
      <n-switch
        v-else-if="paramDef.type === 'boolean'"
        :value="value"
        size="small"
        @update:value="onUpdate"
      />

      <!-- 选择器 -->
      <n-select
        v-else-if="paramDef.type === 'select'"
        :value="value"
        size="small"
        :options="selectOptions"
        placeholder="请选择"
        clearable
        @update:value="onUpdate"
      />

      <!-- 颜色选择器 -->
      <div v-else-if="paramDef.type === 'color'" class="color-input">
        <n-input
          :value="value"
          size="small"
          placeholder="#RRGGBB"
          clearable
          @update:value="onUpdate"
        >
          <template #prefix>
            <span
              class="color-preview"
              :style="{ backgroundColor: value }"
            />
          </template>
        </n-input>
        <input
          type="color"
          :value="normalizeColor(value)"
          class="color-picker"
          @input="onColorPickerChange"
        />
      </div>

      <!-- 字体选择器 -->
      <n-select
        v-else-if="paramDef.type === 'font'"
        :value="value"
        size="small"
        :options="fontOptions"
        filterable
        tag
        placeholder="请选择字体"
        clearable
        @update:value="onUpdate"
      />

      <!-- 尺寸输入 (分辨率) -->
      <n-input
        v-else-if="paramDef.type === 'size'"
        :value="value"
        size="small"
        placeholder="如: 1920, -2, iw"
        clearable
        @update:value="onUpdate"
      >
        <template #suffix>
          <n-button text size="tiny" @click="onQuickSize('iw')">
            iw
          </n-button>
          <n-button text size="tiny" @click="onQuickSize('ih')">
            ih
          </n-button>
          <n-button text size="tiny" @click="onQuickSize('-2')">
            -2
          </n-button>
        </template>
      </n-input>

      <!-- 时间输入 -->
      <n-input
        v-else-if="paramDef.type === 'time'"
        :value="value"
        size="small"
        placeholder="如: 00:00:05.000, 5s, 150frame"
        clearable
        @update:value="onUpdate"
      >
        <template #suffix>
          <n-button text size="tiny" @click="onQuickTime('0')">
            0
          </n-button>
          <n-button text size="tiny" @click="onQuickTime('5s')">
            5s
          </n-button>
          <n-button text size="tiny" @click="onQuickTime('00:00:01.000')">
            1s
          </n-button>
        </template>
      </n-input>

      <!-- 范围滑块 -->
      <div v-else-if="paramDef.type === 'range'" class="range-input">
        <n-slider
          :value="value"
          :min="paramDef.min ?? 0"
          :max="paramDef.max ?? 100"
          :step="paramDef.step || 1"
          @update:value="onUpdate"
        />
        <n-input-number
          :value="value"
          size="tiny"
          :min="paramDef.min"
          :max="paramDef.max"
          :step="paramDef.step || 1"
          style="width: 80px; margin-left: 8px"
          @update:value="onUpdate"
        />
      </div>

      <!-- 坐标点输入 -->
      <div v-else-if="paramDef.type === 'point'" class="point-input">
        <n-input-number
          :value="pointValue.x"
          size="tiny"
          placeholder="X"
          style="flex: 1"
          @update:value="onUpdatePoint('x', $event)"
        />
        <span style="padding: 0 4px">,</span>
        <n-input-number
          :value="pointValue.y"
          size="tiny"
          placeholder="Y"
          style="flex: 1"
          @update:value="onUpdatePoint('y', $event)"
        />
      </div>

      <!-- 多行文本 (textarea) -->
      <n-input
        v-else-if="paramDef.type === 'textarea'"
        :value="value"
        type="textarea"
        size="small"
        :rows="3"
        placeholder="请输入多行文本"
        @update:value="onUpdate"
      />

      <!-- 默认输入 -->
      <n-input
        v-else
        :value="value"
        size="small"
        placeholder="请输入"
        clearable
        @update:value="onUpdate"
      />
    </div>

    <!-- 参数错误提示 -->
    <div v-if="error" class="param-error">
      <n-text type="error" style="font-size: 11px">
        {{ error.message }}
      </n-text>
    </div>

    <!-- 单位提示 -->
    <div v-if="paramDef.unit" class="param-unit">
      <n-text depth="3" style="font-size: 11px">
        单位: {{ paramDef.unit }}
      </n-text>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import {
  NInput,
  NInputNumber,
  NSelect,
  NSwitch,
  NSlider,
  NTooltip,
  NText,
  NButton
} from 'naive-ui';
import type { FilterParamDefinition } from '@/ffmpeg/types/preset';

interface Props {
  paramDef: FilterParamDefinition;
  value: any;
  error?: { paramName: string; message: string } | undefined;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  (e: 'update:value', value: any): void;
}>();

// 选择器选项
const selectOptions = computed(() => {
  if (!props.paramDef.options) return [];

  return props.paramDef.options.map(opt => ({
    label: opt.label || opt.desc || opt.value,
    value: opt.value
  }));
});

// 字体选项
const fontOptions = computed(() => {
  const commonFonts = [
    { label: 'Arial', value: 'Arial' },
    { label: 'Times New Roman', value: 'Times New Roman' },
    { label: 'Courier New', value: 'Courier New' },
    { label: 'Verdana', value: 'Verdana' },
    { label: 'Georgia', value: 'Georgia' },
    { label: 'Palatino', value: 'Palatino' },
    { label: 'Garamond', value: 'Garamond' },
    { label: 'Bookman', value: 'Bookman' },
    { label: 'Avant Garde', value: 'Avant Garde' },
    { label: 'Comic Sans MS', value: 'Comic Sans MS' }
  ];

  return commonFonts;
});

// 坐标点解析
const pointValue = computed(() => {
  if (typeof props.value === 'string') {
    const parts = props.value.split(':');
    return {
      x: parseInt(parts[0]) || 0,
      y: parseInt(parts[1]) || 0
    };
  }
  return props.value || { x: 0, y: 0 };
});

// 规范化颜色值
const normalizeColor = (color: string): string => {
  if (!color) return '#000000';

  // 转换 #RRGGBB 或 0xRRGGBB 格式
  if (color.startsWith('0x')) {
    return '#' + color.slice(2);
  }
  if (color.startsWith('#')) {
    return color;
  }

  // 转换 R,G,B 格式
  const rgbMatch = color.match(/^(\d{1,3}),(\d{1,3}),(\d{1,3})$/);
  if (rgbMatch) {
    const r = parseInt(rgbMatch[1]).toString(16).padStart(2, '0');
    const g = parseInt(rgbMatch[2]).toString(16).padStart(2, '0');
    const b = parseInt(rgbMatch[3]).toString(16).padStart(2, '0');
    return `#${r}${g}${b}`;
  }

  return '#000000';
};

// 更新值
const onUpdate = (value: any) => {
  emit('update:value', value);
};

// 颜色选择器变化
const onColorPickerChange = (event: Event) => {
  const target = event.target as HTMLInputElement;
  emit('update:value', target.value.toUpperCase());
};

// 快速设置尺寸
const onQuickSize = (size: string) => {
  emit('update:value', size);
};

// 快速设置时间
const onQuickTime = (time: string) => {
  emit('update:value', time);
};

// 更新坐标点
const onUpdatePoint = (axis: 'x' | 'y', value: number | null) => {
  const v = value ?? 0;
  const newValue = { ...pointValue.value, [axis]: v };
  emit('update:value', `${newValue.x}:${newValue.y}`);
};
</script>

<style scoped>
.param-input-wrapper {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.param-label {
  display: flex;
  align-items: center;
  gap: 4px;
}

.required-mark {
  color: var(--n-error-color);
  font-weight: bold;
}

.info-icon {
  font-size: 12px;
  cursor: help;
  opacity: 0.6;
  transition: opacity 0.2s;
}

.info-icon:hover {
  opacity: 1;
}

.tooltip-content {
  max-width: 280px;
}

.range-hint {
  margin-top: 4px;
}

.param-input {
  width: 100%;
  transition: all 0.2s;
}

.param-input.has-error {
  border: 1px solid var(--n-error-color);
  border-radius: 4px;
}

.param-error {
  margin-top: 2px;
}

.param-unit {
  margin-top: 2px;
}

/* 颜色选择器 */
.color-input {
  display: flex;
  gap: 8px;
  align-items: center;
}

.color-preview {
  display: inline-block;
  width: 16px;
  height: 16px;
  border-radius: 2px;
  border: 1px solid var(--n-border-color);
  background-color: #000;
}

.color-picker {
  width: 32px;
  height: 24px;
  padding: 0;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

/* 范围输入 */
.range-input {
  display: flex;
  align-items: center;
}

/* 坐标点输入 */
.point-input {
  display: flex;
  align-items: center;
}
</style>
