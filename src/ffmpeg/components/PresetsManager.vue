<template>
  <div class="presets-manager">
    <!-- 预设管理面板 -->
    <n-card title="预设管理" :bordered="false" class="manager-card">
      <template #header-extra>
        <n-space>
          <n-button type="primary" size="small" @click="showSaveDialog = true">
            <template #icon>
              <n-icon><save-icon /></n-icon>
            </template>
            保存当前配置
          </n-button>
          <n-dropdown :options="importExportOptions" @select="handleImportExport">
            <n-button size="small">
              <template #icon>
                <n-icon><import-export-icon /></n-icon>
              </template>
              导入/导出
            </n-button>
          </n-dropdown>
        </n-space>
      </template>

      <div class="manager-layout">
        <!-- 左侧：分类和搜索 -->
        <div class="sidebar">
          <!-- 分类选择 -->
          <n-tabs
            v-model:value="activeCategory"
            type="line"
            animated
            class="category-tabs"
          >
            <n-tab-pane name="all" tab="全部">
              <template #tab>
                <n-space align="center">
                  <span>全部</span>
                  <n-tag size="tiny" round>{{ presetCounts.total }}</n-tag>
                </n-space>
              </template>
            </n-tab-pane>
            <n-tab-pane name="builtin" tab="内置">
              <template #tab>
                <n-space align="center">
                  <span>内置</span>
                  <n-tag size="tiny" round>{{ presetCounts.builtin }}</n-tag>
                </n-space>
              </template>
            </n-tab-pane>
            <n-tab-pane name="custom" tab="自定义">
              <template #tab>
                <n-space align="center">
                  <span>自定义</span>
                  <n-tag size="tiny" round>{{ presetCounts.custom }}</n-tag>
                </n-space>
              </template>
            </n-tab-pane>
            <n-tab-pane name="imported" tab="导入的">
              <template #tab>
                <n-space align="center">
                  <span>导入的</span>
                  <n-tag size="tiny" round>{{ presetCounts.imported }}</n-tag>
                </n-space>
              </template>
            </n-tab-pane>
          </n-tabs>

          <!-- 搜索框 -->
          <n-input
            v-model:value="searchQuery"
            placeholder="搜索预设..."
            clearable
            class="search-input"
          >
            <template #prefix>
              <n-icon><search-icon /></n-icon>
            </template>
          </n-input>

          <!-- 标签过滤 -->
          <div v-if="availableTags.length > 0" class="tags-section">
            <div class="section-title">标签过滤</div>
            <n-space wrap>
              <n-tag
                v-for="tag in availableTags"
                :key="tag"
                :type="selectedTags.includes(tag) ? 'primary' : 'default'"
                checkable
                :checked="selectedTags.includes(tag)"
                @update:checked="toggleTag(tag)"
                size="small"
              >
                {{ tag }}
              </n-tag>
            </n-space>
          </div>
        </div>

        <!-- 右侧：预设列表 -->
        <div class="preset-list">
          <n-scrollbar style="max-height: calc(100vh - 300px)">
            <div v-if="filteredPresets.length === 0" class="empty-state">
              <n-empty description="没有找到预设" />
            </div>

            <div v-else class="preset-items">
              <div
                v-for="preset in filteredPresets"
                :key="preset.id"
                class="preset-item"
                :class="{ active: selectedPresetId === preset.id }"
                @click="selectPreset(preset.id)"
              >
                <div class="preset-header">
                  <div class="preset-name">
                    <n-icon v-if="isBuiltin(preset.id)" color="#3B82F6">
                      <star-icon />
                    </n-icon>
                    {{ preset.name }}
                  </div>
                  <n-space>
                    <n-button
                      text
                      size="tiny"
                      @click.stop="applyPreset(preset.id)"
                    >
                      <template #icon>
                        <n-icon><play-icon /></n-icon>
                      </template>
                      应用
                    </n-button>
                    <n-dropdown
                      v-if="!isBuiltin(preset.id)"
                      :options="getPresetMenuOptions(preset)"
                      @select="(key) => handlePresetMenuAction(key, preset.id)"
                    >
                      <n-button text size="tiny">
                        <template #icon>
                          <n-icon><more-icon /></n-icon>
                        </template>
                      </n-button>
                    </n-dropdown>
                  </n-space>
                </div>

                <div v-if="preset.description" class="preset-description">
                  {{ preset.description }}
                </div>

                <div class="preset-meta">
                  <n-space size="small">
                    <n-tag v-if="preset.tags" size="tiny">
                      {{ preset.tags.join(', ') }}
                    </n-tag>
                    <n-text depth="3" class="preset-date">
                      {{ formatDate(preset.updatedAt) }}
                    </n-text>
                  </n-space>
                </div>
              </div>
            </div>
          </n-scrollbar>
        </div>
      </div>
    </n-card>

    <!-- 保存预设对话框 -->
    <n-modal v-model:show="showSaveDialog" preset="card" title="保存预设">
      <n-form ref="saveFormRef" :model="saveForm" label-placement="left">
        <n-form-item label="预设名称" required>
          <n-input v-model:value="saveForm.name" placeholder="输入预设名称" />
        </n-form-item>
        <n-form-item label="描述">
          <n-input
            v-model:value="saveForm.description"
            type="textarea"
            placeholder="输入预设描述"
            :autosize="{ minRows: 2, maxRows: 4 }"
          />
        </n-form-item>
        <n-form-item label="标签">
          <n-dynamic-tags v-model:value="saveForm.tags" />
        </n-form-item>
      </n-form>
      <template #footer>
        <n-space justify="end">
          <n-button @click="showSaveDialog = false">取消</n-button>
          <n-button type="primary" @click="handleSavePreset">保存</n-button>
        </n-space>
      </template>
    </n-modal>

    <!-- 隐藏的文件输入框 -->
    <input
      ref="fileInputRef"
      type="file"
      accept=".json,.3fui"
      multiple
      style="display: none"
      @change="handleFileImport"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, h } from 'vue';
import {
  NCard,
  NSpace,
  NButton,
  NIcon,
  NDropdown,
  NTabs,
  NTabPane,
  NTag,
  NInput,
  NScrollbar,
  NEmpty,
  NModal,
  NForm,
  NFormItem,
  NText,
  useMessage,
  useDialog
} from 'naive-ui';
import {
  Save as SaveIcon,
  Download as ImportExportIcon,
  Search as SearchIcon,
  Star as StarIcon,
  Play as PlayIcon,
  EllipsisHorizontal as MoreIcon,
  Copy as CopyIcon,
  Trash as TrashIcon
} from '@vicons/ionicons5';
import { usePresetsStore } from '../stores/presetsStore';
import type { ExportFormat } from '../stores/presetsStore';
import { downloadFile } from '../../utils/download';

// Props
interface Props {
  onApplyPreset?: (presetId: string) => void;
}

const props = defineProps<Props>();

// Stores
const presetsStore = usePresetsStore();
const message = useMessage();
const dialog = useDialog();

// State
const showSaveDialog = ref(false);
const activeCategory = ref('all');
const searchQuery = ref('');
const selectedTags = ref<string[]>([]);
const fileInputRef = ref<HTMLInputElement | null>(null);
const saveFormRef = ref();
const saveForm = ref({
  name: '',
  description: '',
  tags: [] as string[]
});

// Computed
const filteredPresets = computed(() => {
  let presets: any[] = [];

  // 按分类过滤
  switch (activeCategory.value) {
    case 'builtin':
      presets = [...presetsStore.builtinPresets];
      break;
    case 'custom':
      presets = [...presetsStore.customPresets];
      break;
    case 'imported':
      presets = [...presetsStore.importedPresets];
      break;
    case 'all':
    default:
      presets = presetsStore.allPresets;
      break;
  }

  // 按搜索关键词过滤
  if (searchQuery.value.trim()) {
    const query = searchQuery.value.toLowerCase();
    presets = presets.filter(p =>
      p.name.toLowerCase().includes(query) ||
      (p.description && p.description.toLowerCase().includes(query))
    );
  }

  // 按标签过滤
  if (selectedTags.value.length > 0) {
    presets = presets.filter(p =>
      p.tags && p.tags.some(tag => selectedTags.value.includes(tag))
    );
  }

  return presets;
});

const availableTags = computed(() => presetsStore.availableTags);
const selectedPresetId = computed(() => presetsStore.selectedPresetId);
const presetCounts = computed(() => presetsStore.presetCounts);

const importExportOptions = [
  {
    label: '导入预设',
    key: 'import',
    icon: () => h(NIcon, null, { default: () => h(ImportExportIcon) })
  },
  {
    label: '导出选中预设',
    key: 'export-selected',
    icon: () => h(NIcon, null, { default: () => h(ImportExportIcon) })
  },
  {
    label: '导出所有预设',
    key: 'export-all',
    icon: () => h(NIcon, null, { default: () => h(ImportExportIcon) })
  }
];

// Methods
function isBuiltin(id: string): boolean {
  return id.startsWith('builtin-');
}

function selectPreset(id: string) {
  presetsStore.selectPreset(id);
}

function applyPreset(id: string) {
  if (props.onApplyPreset) {
    props.onApplyPreset(id);
  }
  message.success('已应用预设');
}

function toggleTag(tag: string) {
  const index = selectedTags.value.indexOf(tag);
  if (index === -1) {
    selectedTags.value.push(tag);
  } else {
    selectedTags.value.splice(index, 1);
  }
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString('zh-CN');
}

function getPresetMenuOptions(preset: any) {
  return [
    {
      label: '复制',
      key: 'duplicate',
      icon: () => h(NIcon, null, { default: () => h(CopyIcon) })
    },
    {
      type: 'divider'
    },
    {
      label: '导出 JSON',
      key: 'export-json',
      icon: () => h(NIcon, null, { default: () => h(ImportExportIcon) })
    },
    {
      label: '导出 3FUI',
      key: 'export-3fui',
      icon: () => h(NIcon, null, { default: () => h(ImportExportIcon) })
    },
    {
      type: 'divider'
    },
    {
      label: '删除',
      key: 'delete',
      icon: () => h(NIcon, null, { default: () => h(TrashIcon) })
    }
  ];
}

function handlePresetMenuAction(key: string, presetId: string) {
  switch (key) {
    case 'duplicate':
      handleDuplicatePreset(presetId);
      break;
    case 'export-json':
      handleExportSinglePreset(presetId, 'json');
      break;
    case 'export-3fui':
      handleExportSinglePreset(presetId, '3fui');
      break;
    case 'delete':
      handleDeletePreset(presetId);
      break;
  }
}

async function handleSavePreset() {
  if (!saveForm.value.name.trim()) {
    message.warning('请输入预设名称');
    return;
  }

  try {
    const { ffmpegParams } = await import('../stores/ffmpegParams');
    const presetId = await presetsStore.saveCustomPreset(
      saveForm.value.name,
      ffmpegParams.currentPreset,
      saveForm.value.description,
      saveForm.value.tags
    );

    showSaveDialog.value = false;
    saveForm.value = { name: '', description: '', tags: [] };
    message.success('预设保存成功');
  } catch (error) {
    message.error('保存预设失败');
  }
}

function handleImportExport(key: string) {
  switch (key) {
    case 'import':
      triggerFileImport();
      break;
    case 'export-selected':
      handleExportSelectedPresets();
      break;
    case 'export-all':
      handleExportAllPresets();
      break;
  }
}

function triggerFileImport() {
  fileInputRef.value?.click();
}

async function handleFileImport(event: Event) {
  const target = event.target as HTMLInputElement;
  const files = target.files;

  if (!files || files.length === 0) {
    return;
  }

  try {
    const importedIds: string[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const ids = await presetsStore.importFrom3FUI(file);
      importedIds.push(...ids);
    }

    message.success(`成功导入 ${importedIds.length} 个预设`);
  } catch (error) {
    message.error('导入预设失败');
  } finally {
    // 清空 input
    target.value = '';
  }
}

async function handleExportSinglePreset(presetId: string, format: ExportFormat) {
  try {
    const preset = presetsStore.allPresets.find(p => p.id === presetId);
    if (!preset) {
      message.error('预设不存在');
      return;
    }

    const content = format === '3fui'
      ? presetsStore.exportAs3FUI(presetId)
      : presetsStore.exportAsJSON(presetId);

    const filename = `${preset.name.replace(/[^a-zA-Z0-9_\-]/g, '_')}.${format}`;
    downloadFile(content, filename);
    message.success('导出成功');
  } catch (error) {
    message.error('导出失败');
  }
}

async function handleExportSelectedPresets() {
  if (!selectedPresetId.value) {
    message.warning('请先选择一个预设');
    return;
  }

  // 询问导出格式
  dialog.create({
    title: '选择导出格式',
    content: () =>
      h('div', null, [
        h('p', { style: { marginBottom: '10px' } }, '请选择导出格式'),
        h(
          NSpace,
          { vertical: true },
          {
            default: () => [
              h(
                NButton,
                {
                  block: true,
                  onClick: () => {
                    handleExportSinglePreset(selectedPresetId.value, 'json');
                    dialog.destroyAll();
                  }
                },
                { default: () => 'JSON 格式' }
              ),
              h(
                NButton,
                {
                  block: true,
                  onClick: () => {
                    handleExportSinglePreset(selectedPresetId.value, '3fui');
                    dialog.destroyAll();
                  }
                },
                { default: () => '3FUI 格式' }
              )
            ]
          }
        )
      ]),
    positiveText: '取消'
  });
}

async function handleExportAllPresets() {
  message.info('批量导出功能开发中...');
}

async function handleDuplicatePreset(presetId: string) {
  try {
    const newId = await presetsStore.duplicatePreset(presetId);
    if (newId) {
      message.success('预设已复制');
    } else {
      message.error('复制失败');
    }
  } catch (error) {
    message.error('复制失败');
  }
}

function handleDeletePreset(presetId: string) {
  dialog.warning({
    title: '确认删除',
    content: '确定要删除这个预设吗？',
    positiveText: '删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      const success = await presetsStore.deletePreset(presetId);
      if (success) {
        message.success('预设已删除');
      } else {
        message.error('删除失败');
      }
    }
  });
}

// Initialize
presetsStore.initialize();
</script>

<style scoped>
.presets-manager {
  height: 100%;
}

.manager-card {
  height: 100%;
}

.manager-layout {
  display: flex;
  gap: 16px;
  min-height: 500px;
}

.sidebar {
  width: 250px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.category-tabs {
  flex-shrink: 0;
}

.search-input {
  flex-shrink: 0;
}

.tags-section {
  flex-shrink: 0;
}

.section-title {
  font-size: 12px;
  color: #6B7280;
  margin-bottom: 8px;
}

.preset-list {
  flex: 1;
  min-width: 0;
}

.preset-items {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.preset-item {
  padding: 12px;
  border: 1px solid #E5E7EB;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}

.preset-item:hover {
  border-color: #3B82F6;
  background-color: #F3F4F6;
}

.preset-item.active {
  border-color: #3B82F6;
  background-color: #EBF5FF;
}

.preset-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.preset-name {
  font-weight: 600;
  font-size: 14px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.preset-description {
  font-size: 12px;
  color: #6B7280;
  margin-bottom: 8px;
  line-height: 1.5;
}

.preset-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.preset-date {
  font-size: 11px;
}

.empty-state {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 200px;
}
</style>
