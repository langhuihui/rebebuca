<!--
 Rebebuca
 Copyright (C) 2025 rebebuca contributors
 
 This program is free software: you can redistribute it and/or modify
 it under the terms of the GNU General Public License as published by
 the Free Software Foundation, either version 3 of the License, or
 (at your option) any later version.
 
 This program is distributed in the hope that it will be useful,
 but WITHOUT ANY WARRANTY; without even the implied warranty of
 MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 GNU General Public License for more details.
 
 You should have received a copy of the GNU General Public License
 along with this program.  If not, see <https://www.gnu.org/licenses/>.
-->

<template>
  <div class="command-icon-settings">
    <!-- Data Table -->
    <div class="table-container">
      <n-data-table
        :columns="columns"
        :data="tableData"
        :bordered="false"
        size="small"
        :row-class-name="rowClassName"
        :max-height="tableMaxHeight"
        class="command-icon-table"
      />
    </div>

    <!-- Add new mapping -->
    <div class="add-mapping">
      <n-input
        v-model:value="newCommand"
        size="small"
        :placeholder="t('settings.commandPlaceholder')"
        style="flex: 1;"
        @keyup.enter="addMapping"
      />
      <IconPicker
        v-model:model-value="newIconName"
        :show="showNewIconPicker"
        @update:show="showNewIconPicker = $event"
      >
        <n-button size="small" quaternary class="icon-button">
          <template #icon>
            <n-icon size="18">
              <component :is="getIcon(newIconName)" />
            </n-icon>
          </template>
        </n-button>
      </IconPicker>
      <n-button
        size="small"
        type="primary"
        :disabled="!newCommand.trim()"
        @click="addMapping"
      >
        {{ t('common.add') }}
      </n-button>
    </div>

    <div class="help-text">
      {{ t('settings.commandIconHelp') }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, h } from 'vue';
import { NButton, NIcon, NInput, NDataTable, NTag, type DataTableColumns } from 'naive-ui';
import { useI18n } from 'vue-i18n';
import IconPicker from './IconPicker.vue';
import { svgIcons, defaultCommandIcons } from '../utils/icons';

const { t } = useI18n();

interface Props {
  modelValue: Record<string, string>;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: Record<string, string>): void;
}>();

const newCommand = ref('');
const newIconName = ref('task');
const showNewIconPicker = ref(false);
const editingCommand = ref<string | null>(null);

// 使用 CSS calc 计算表格最大高度
// 视口高度减去标题栏、状态栏、设置面板padding、输入框区域等
const tableMaxHeight = computed(() => {
  // 增加减去的值，让表格高度更短一些
  return 'calc(100vh - 250px)';
});

const getIcon = (iconName: string) => {
  return svgIcons[iconName as keyof typeof svgIcons] || svgIcons.task;
};

interface TableRow {
  command: string;
  iconName: string;
  isDefault: boolean;
  isCustomized: boolean; // 用户自定义覆盖了默认配置
}

const tableData = computed<TableRow[]>(() => {
  const result: TableRow[] = [];
  const customCommands = new Set(Object.keys(props.modelValue));
  
  // 先添加默认配置
  for (const [command, iconName] of Object.entries(defaultCommandIcons)) {
    const isCustomized = customCommands.has(command);
    result.push({
      command,
      iconName: isCustomized ? props.modelValue[command] : iconName,
      isDefault: true,
      isCustomized,
    });
  }
  
  // 再添加用户自定义的（排除已覆盖默认的）
  for (const [command, iconName] of Object.entries(props.modelValue)) {
    if (!defaultCommandIcons[command]) {
      result.push({
        command,
        iconName,
        isDefault: false,
        isCustomized: false,
      });
    }
  }
  
  // 按命令名排序
  return result.sort((a, b) => a.command.localeCompare(b.command));
});

const rowClassName = (row: TableRow) => {
  if (row.isCustomized) return 'row-customized';
  if (!row.isDefault) return 'row-custom';
  return '';
};

const columns = computed<DataTableColumns<TableRow>>(() => [
  {
    title: t('settings.icon'),
    key: 'iconName',
    width: 80,
    align: 'center',
    render(row) {
      return h(
        IconPicker,
        {
          modelValue: row.iconName,
          show: editingCommand.value === row.command,
          'onUpdate:modelValue': (value: string) => updateIcon(row.command, value, row.isDefault),
          'onUpdate:show': (value: boolean) => {
            editingCommand.value = value ? row.command : null;
          },
        },
        {
          default: () =>
            h(
              NButton,
              { size: 'small', quaternary: true, class: 'icon-button' },
              {
                icon: () =>
                  h(NIcon, { size: 18 }, { default: () => h(getIcon(row.iconName)) }),
              }
            ),
        }
      );
    },
  },
  {
    title: t('settings.command'),
    key: 'command',
    ellipsis: {
      tooltip: true,
    },
    render(row) {
      const elements = [h('code', { class: 'command-text' }, row.command)];
      if (!row.isDefault) {
        elements.push(
          h(NTag, { size: 'small', type: 'info', style: 'margin-left: 8px;' }, { default: () => t('settings.custom') })
        );
      } else if (row.isCustomized) {
        elements.push(
          h(NTag, { size: 'small', type: 'warning', style: 'margin-left: 8px;' }, { default: () => t('settings.modified') })
        );
      }
      return h('span', { class: 'command-cell' }, elements);
    },
  },
  {
    title: '',
    key: 'actions',
    width: 60,
    align: 'center',
    render(row) {
      // 默认配置显示重置按钮（如果被修改），自定义配置显示删除按钮
      if (row.isDefault && row.isCustomized) {
        return h(
          NButton,
          {
            size: 'tiny',
            quaternary: true,
            type: 'warning',
            title: t('settings.reset'),
            onClick: () => resetMapping(row.command),
          },
          {
            icon: () => h(NIcon, { size: 14 }, { default: () => h(svgIcons.refresh) }),
          }
        );
      } else if (!row.isDefault) {
        return h(
          NButton,
          {
            size: 'tiny',
            quaternary: true,
            type: 'error',
            onClick: () => removeMapping(row.command),
          },
          {
            icon: () => h(NIcon, { size: 14 }, { default: () => h(svgIcons.close) }),
          }
        );
      }
      return null;
    },
  },
]);

const addMapping = () => {
  const command = newCommand.value.trim();
  if (!command) return;
  
  const updated = { ...props.modelValue, [command]: newIconName.value };
  emit('update:modelValue', updated);
  
  newCommand.value = '';
  newIconName.value = 'task';
};

const updateIcon = (command: string, iconName: string, isDefault: boolean) => {
  // 如果是默认配置且图标没变，不需要保存
  if (isDefault && defaultCommandIcons[command] === iconName) {
    // 如果之前有自定义，现在改回默认，则删除自定义
    if (props.modelValue[command]) {
      const updated = { ...props.modelValue };
      delete updated[command];
      emit('update:modelValue', updated);
    }
  } else {
    const updated = { ...props.modelValue, [command]: iconName };
    emit('update:modelValue', updated);
  }
  editingCommand.value = null;
};

const resetMapping = (command: string) => {
  const updated = { ...props.modelValue };
  delete updated[command];
  emit('update:modelValue', updated);
};

const removeMapping = (command: string) => {
  const updated = { ...props.modelValue };
  delete updated[command];
  emit('update:modelValue', updated);
};
</script>

<style scoped>
.command-icon-settings {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding-top: 12px;
  height: 100%;
  overflow: hidden;
}

.table-container {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.command-icon-table :deep(.n-data-table-th) {
  font-weight: 500;
}

.command-icon-table :deep(.row-custom) {
  background-color: rgba(24, 160, 88, 0.08);
}

.command-icon-table :deep(.row-customized) {
  background-color: rgba(240, 160, 32, 0.08);
}

.command-cell {
  display: flex;
  align-items: center;
}

.command-text {
  font-family: monospace;
  font-size: 13px;
  background-color: var(--n-color-modal);
  padding: 2px 6px;
  border-radius: 4px;
}

.icon-button {
  padding: 4px;
}

.add-mapping {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 0 0 auto;
  flex-wrap: wrap;
}

.help-text {
  font-size: 12px;
  color: var(--n-text-color-3);
  flex: 0 0 auto;
}
</style>
