<template>
  <div class="node-property-panel">
    <div v-if="!node" class="empty-state">
      <n-empty description="未选择节点" size="small" />
    </div>

    <div v-else class="panel-content">
      <!-- 节点标题 -->
      <div class="panel-header">
        <n-space align="center" :size="8">
          <span class="node-icon">{{ node.data.icon }}</span>
          <n-text strong>{{ node.data.name }}</n-text>
        </n-space>
        <n-button
          text
          type="error"
          size="tiny"
          @click="onRemove"
        >
          <template #icon>
            <span>🗑️</span>
          </template>
        </n-button>
      </div>

      <!-- 节点描述 -->
      <div v-if="node.data.description" class="panel-section">
        <n-text depth="3" style="font-size: 12px">
          {{ node.data.description }}
        </n-text>
      </div>

      <!-- 启用/禁用开关 -->
      <div class="panel-section">
        <n-space align="center" justify="space-between">
          <n-text style="font-size: 13px">启用节点</n-text>
          <n-switch
            :value="node.data.enabled"
            size="small"
            @update:value="onToggleEnabled"
          />
        </n-space>
      </div>

      <n-divider style="margin: 8px 0;" />

      <!-- 参数预设 -->
      <div v-if="hasParams" class="panel-section">
        <div class="section-header">
          <n-text strong style="font-size: 13px">参数预设</n-text>
          <n-dropdown
            :options="presetOptions"
            trigger="click"
            placement="bottom-start"
            @select="onApplyPreset"
          >
            <n-button size="tiny" quaternary>
              <template #icon>
                <span>⚡</span>
              </template>
              应用预设
            </n-button>
          </n-dropdown>
        </div>

        <!-- 保存为预设 -->
        <div v-if="showSavePreset" class="save-preset-form">
          <n-input
            v-model:value="newPresetName"
            size="tiny"
            placeholder="预设名称"
            @keydown.enter="onSavePreset"
          />
          <n-space :size="4" style="margin-top: 4px">
            <n-button size="tiny" type="primary" @click="onSavePreset">
              保存
            </n-button>
            <n-button size="tiny" @click="showSavePreset = false">
              取消
            </n-button>
          </n-space>
        </div>
        <n-button v-else size="tiny" quaternary @click="showSavePreset = true">
          <template #icon>
            <span>💾</span>
          </template>
          保存当前参数
        </n-button>
      </div>

      <n-divider v-if="hasParams" style="margin: 8px 0;" />

      <!-- 参数编辑 -->
      <div v-if="hasParams" class="panel-section">
        <div class="section-header">
          <n-text strong style="font-size: 13px">参数配置</n-text>
          <n-button
            v-if="hasChanges"
            size="tiny"
            quaternary
            type="info"
            @click="onResetParams"
          >
            <template #icon>
              <span>↩️</span>
            </template>
            重置参数
          </n-button>
        </div>

        <!-- 分组显示 -->
        <div v-if="paramGroups.length > 1" class="param-groups">
          <div
            v-for="group in paramGroups"
            :key="group.name"
            class="param-group"
          >
            <div
              class="group-header"
              @click="toggleGroup(group.name)"
            >
              <n-text strong style="font-size: 12px">
                {{ group.label }}
              </n-text>
              <span class="group-toggle">
                {{ expandedGroups.has(group.name) ? '▼' : '▶' }}
              </span>
            </div>

            <div v-show="expandedGroups.has(group.name)" class="group-content">
              <div class="params-list">
                <div
                  v-for="paramDef in group.params"
                  :key="paramDef.name"
                  class="param-item"
                >
                  <ParamInput
                    :param-def="paramDef"
                    :value="getParamValue(paramDef.name)"
                    :error="getParamError(paramDef.name)"
                    @update:value="onParamChange(paramDef.name, $event)"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 无分组显示 -->
        <div v-else class="params-list">
          <div
            v-for="paramDef in paramDefinitions"
            :key="paramDef.name"
            class="param-item"
          >
            <ParamInput
              :param-def="paramDef"
              :value="getParamValue(paramDef.name)"
              :error="getParamError(paramDef.name)"
              @update:value="onParamChange(paramDef.name, $event)"
            />
          </div>
        </div>

        <!-- 验证错误汇总 -->
        <div v-if="validationErrors.length > 0" class="validation-summary">
          <n-alert
            type="error"
            :bordered="false"
            size="small"
            closable
            @close="clearErrors"
          >
            <template #header>
              参数验证错误
            </template>
            <div v-for="error in validationErrors" :key="error.paramName">
              <n-text>{{ error.message }}</n-text>
            </div>
          </n-alert>
        </div>
      </div>

      <!-- 无参数提示 -->
      <div v-else class="panel-section">
        <n-empty description="该滤镜无参数" size="small" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import {
  NEmpty,
  NSpace,
  NText,
  NButton,
  NSwitch,
  NDivider,
  NInput,
  NSelect,
  NDropdown,
  NAlert
} from 'naive-ui';
import type { FilterNode, FilterParamDefinition } from '@/ffmpeg/types/preset';
import ParamInput from './ParamInput.vue';

interface Props {
  node: FilterNode | null;
  readonly?: boolean;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  (e: 'update:params', nodeId: string, params: Record<string, any>): void;
  (e: 'update:enabled', nodeId: string, enabled: boolean): void;
  (e: 'remove', nodeId: string): void;
}>();

// 参数预设管理
const showSavePreset = ref(false);
const newPresetName = ref('');
const expandedGroups = ref<Set<string>>(new Set());
const validationErrors = ref<Array<{ paramName: string; message: string }>>([]);

// 默认参数缓存
const defaultParams = ref<Record<string, any>>({});

// 计算属性
const paramDefinitions = computed(() => {
  return props.node?.data.paramDefinitions || [];
});

const hasParams = computed(() => {
  return paramDefinitions.value.length > 0;
});

const hasChanges = computed(() => {
  if (!props.node) return false;

  const currentParams = props.node.data.params || {};
  return Object.keys(currentParams).some(key => {
    return currentParams[key] !== defaultParams.value[key];
  });
});

// 参数分组
const paramGroups = computed(() => {
  const groups = new Map<string, FilterParamDefinition[]>();

  paramDefinitions.value.forEach(param => {
    const groupName = param.group || 'basic';
    if (!groups.has(groupName)) {
      groups.set(groupName, []);
    }
    groups.get(groupName)!.push(param);
  });

  return Array.from(groups.entries()).map(([name, params]) => ({
    name,
    label: getGroupLabel(name),
    params
  }));
});

// 预设选项
const presetOptions = computed(() => {
  const presets = getNodePresets();
  return [
    {
      label: '默认参数',
      key: 'default'
    },
    { type: 'divider', key: 'd1' },
    ...presets.map(preset => ({
      label: preset.name,
      key: preset.id
    }))
  ];
});

// 获取分组标签
const getGroupLabel = (groupName: string): string => {
  const labels: Record<string, string> = {
    basic: '基础参数',
    advanced: '高级参数',
    quality: '质量参数',
    output: '输出参数'
  };
  return labels[groupName] || groupName;
};

// 获取参数值
const getParamValue = (paramName: string) => {
  const params = props.node?.data.params || {};
  return params[paramName] !== undefined ? params[paramName] : '';
};

// 获取参数错误
const getParamError = (paramName: string) => {
  return validationErrors.value.find(e => e.paramName === paramName);
};

// 验证参数
const validateParam = (paramDef: FilterParamDefinition, value: any): string | null => {
  // 必填验证
  if (paramDef.required && (value === undefined || value === null || value === '')) {
    return '此参数为必填项';
  }

  // 范围验证
  if (paramDef.type === 'number' || paramDef.type === 'range') {
    const numValue = Number(value);
    if (!isNaN(numValue)) {
      if (paramDef.min !== undefined && numValue < paramDef.min) {
        return `值不能小于 ${paramDef.min}`;
      }
      if (paramDef.max !== undefined && numValue > paramDef.max) {
        return `值不能大于 ${paramDef.max}`;
      }
    }
  }

  // 尺寸格式验证
  if (paramDef.type === 'size') {
    const sizeValue = String(value).trim();
    if (sizeValue && !isValidSizeExpression(sizeValue)) {
      return '无效的尺寸表达式 (支持: 数字, -2, -1, iw, ih)';
    }
  }

  // 时间格式验证
  if (paramDef.type === 'time') {
    const timeValue = String(value).trim();
    if (timeValue && !isValidTimeExpression(timeValue)) {
      return '无效的时间格式 (支持: HH:MM:SS.mmm, Ns, Nframe)';
    }
  }

  // 颜色格式验证
  if (paramDef.type === 'color') {
    const colorValue = String(value).trim();
    if (colorValue && !isValidColorExpression(colorValue)) {
      return '无效的颜色值 (支持: #RRGGBB, 0xRRGGBB, R,G,B)';
    }
  }

  return null;
};

// 验证所有参数
const validateAllParams = () => {
  validationErrors.value = [];
  const params = props.node?.data.params || {};

  paramDefinitions.value.forEach(paramDef => {
    const value = params[paramDef.name];
    const error = validateParam(paramDef, value);
    if (error) {
      validationErrors.value.push({
        paramName: paramDef.name,
        message: `${paramDef.label}: ${error}`
      });
    }
  });
};

// 尺寸表达式验证
const isValidSizeExpression = (value: string): boolean => {
  // 支持纯数字、-2、-1、iw、ih、iw:ih等
  const patterns = [
    /^\d+$/, // 纯数字
    /^-2$/,  // -2
    /^-1$/,  // -1
    /^iw$/,  // iw
    /^ih$/,  // ih
    /^iw:[\d\-]+$/, // iw:数字
    /^ih:[\d\-]+$/, // ih:数字
    /^[\d\-]+:[\d\-]+$/ // 数字:数字
  ];

  return patterns.some(pattern => pattern.test(value.trim()));
};

// 时间表达式验证
const isValidTimeExpression = (value: string): boolean => {
  // 支持 HH:MM:SS.mmm、Ns、Nframe
  const patterns = [
    /^\d{2}:\d{2}:\d{2}(\.\d{1,3})?$/, // HH:MM:SS.mmm
    /^\d+(\.\d+)?s$/, // Ns (秒)
    /^\d+frame$/, // Nframe (帧)
    /^\d+$/ // 纯数字 (帧)
  ];

  return patterns.some(pattern => pattern.test(value.trim()));
};

// 颜色表达式验证
const isValidColorExpression = (value: string): boolean => {
  // 支持 #RRGGBB、0xRRGGBB、R,G,B、R:G:B
  const patterns = [
    /^#[0-9A-Fa-f]{6}$/, // #RRGGBB
    /^0x[0-9A-Fa-f]{6}$/, // 0xRRGGBB
    /^\d{1,3},\d{1,3},\d{1,3}$/, // R,G,B
    /^\d{1,3}:\d{1,3}:\d{1,3}$/ // R:G:B
  ];

  return patterns.some(pattern => pattern.test(value.trim()));
};

// 获取节点预设
const getNodePresets = () => {
  const filterId = props.node?.data.filterId;
  if (!filterId) return [];

  const stored = localStorage.getItem(`filter-presets-${filterId}`);
  return stored ? JSON.parse(stored) : [];
};

// 应用预设
const onApplyPreset = (presetKey: string) => {
  if (!props.node) return;

  let targetParams: Record<string, any> = {};

  if (presetKey === 'default') {
    // 应用默认参数
    paramDefinitions.value.forEach(paramDef => {
      targetParams[paramDef.name] = paramDef.default;
    });
  } else {
    // 应用保存的预设
    const presets = getNodePresets();
    const preset = presets.find((p: any) => p.id === presetKey);
    if (preset) {
      targetParams = preset.params;
    }
  }

  if (Object.keys(targetParams).length > 0) {
    emit('update:params', props.node.id, targetParams);
    validateAllParams();
  }
};

// 保存预设
const onSavePreset = () => {
  if (!props.node || !newPresetName.value.trim()) return;

  const filterId = props.node.data.filterId;
  const params = props.node.data.params || {};
  const presets = getNodePresets();

  const newPreset = {
    id: `preset-${Date.now()}`,
    name: newPresetName.value.trim(),
    params: { ...params },
    createdAt: new Date().toISOString()
  };

  presets.push(newPreset);
  localStorage.setItem(`filter-presets-${filterId}`, JSON.stringify(presets));

  newPresetName.value = '';
  showSavePreset.value = false;
};

// 重置参数
const onResetParams = () => {
  if (!props.node) return;

  const params: Record<string, any> = {};
  paramDefinitions.value.forEach(paramDef => {
    params[paramDef.name] = paramDef.default;
  });

  emit('update:params', props.node.id, params);
  validateAllParams();
};

// 清除错误
const clearErrors = () => {
  validationErrors.value = [];
};

// 切换分组展开状态
const toggleGroup = (groupName: string) => {
  if (expandedGroups.value.has(groupName)) {
    expandedGroups.value.delete(groupName);
  } else {
    expandedGroups.value.add(groupName);
  }
};

// 参数变化处理
const onParamChange = (paramName: string, value: any) => {
  if (!props.node) return;

  const params = { ...(props.node.data.params || {}) };
  params[paramName] = value;

  emit('update:params', props.node.id, params);

  // 实时验证
  setTimeout(() => {
    validateAllParams();
  }, 100);
};

const onToggleEnabled = (enabled: boolean) => {
  if (!props.node) return;

  emit('update:enabled', props.node.id, enabled);
};

const onRemove = () => {
  if (!props.node) return;

  emit('remove', props.node.id);
};

// 监听节点变化
watch(() => props.node, (newNode) => {
  if (newNode) {
    // 缓存默认参数
    defaultParams.value = {};
    paramDefinitions.value.forEach(paramDef => {
      defaultParams.value[paramDef.name] = paramDef.default;
    });

    // 默认展开所有分组
    if (paramGroups.value.length > 1) {
      expandedGroups.value = new Set(paramGroups.value.map(g => g.name));
    }

    // 初始验证
    validateAllParams();
  } else {
    validationErrors.value = [];
    defaultParams.value = {};
  }
}, { immediate: true });
</script>

<style scoped>
.node-property-panel {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--n-color);
}

.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  padding: 20px;
}

.panel-content {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow-y: auto;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  border-bottom: 1px solid var(--n-border-color);
}

.node-icon {
  font-size: 18px;
}

.panel-section {
  padding: 12px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.save-preset-form {
  margin-top: 8px;
  padding: 8px;
  background: var(--n-color-embedded);
  border-radius: 4px;
}

/* 参数分组 */
.param-groups {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.param-group {
  border: 1px solid var(--n-border-color);
  border-radius: 6px;
  overflow: hidden;
}

.group-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 12px;
  background: var(--n-color-embedded);
  cursor: pointer;
  user-select: none;
  transition: background 0.2s;
}

.group-header:hover {
  background: var(--n-color-embedded-modal);
}

.group-toggle {
  font-size: 10px;
  color: var(--n-text-color-3);
  transition: transform 0.2s;
}

.group-content {
  padding: 12px;
}

/* 参数列表 */
.params-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.param-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

/* 验证错误 */
.validation-summary {
  margin-top: 16px;
}

.validation-summary :deep(.n-alert) {
  padding: 8px 12px;
}

.validation-summary :deep(.n-alert-body) {
  gap: 4px;
}
</style>
