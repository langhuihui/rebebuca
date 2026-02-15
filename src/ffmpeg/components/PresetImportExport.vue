<template>
  <div class="preset-import-export">
    <!-- 预设导入导出对话框 -->
    <n-modal
      v-model:show="showImportModal"
      preset="card"
      title="导入预设"
      style="width: 600px"
    >
      <n-steps :current="importStep" style="margin-bottom: 24px">
        <n-step title="选择文件" />
        <n-step title="预览" />
        <n-step title="导入" />
      </n-steps>

      <!-- 步骤 1: 选择文件 -->
      <div v-if="importStep === 1">
        <n-upload
          ref="uploadRef"
          directory-dnd
          :max="10"
          :default-file-list="uploadFileList"
          @update:file-list="handleUploadFileList"
          @change="handleFileChange"
        >
          <n-upload-dragger>
            <div style="margin-bottom: 12px">
              <n-icon size="48" :depth="3">
                <cloud-upload-icon />
              </n-icon>
            </div>
            <n-text style="font-size: 16px">
              点击或者拖动文件到该区域来上传
            </n-text>
            <n-p depth="3" style="margin: 8px 0 0 0">
              支持 .json 和 .3fui 格式的预设文件，最多上传 10 个文件
            </n-p>
          </n-upload-dragger>
        </n-upload>

        <n-alert type="info" title="提示" style="margin-top: 16px">
          3FUI 格式是 FFmpegFreeUI 使用的预设格式，可以直接导入使用。
        </n-alert>
      </div>

      <!-- 步骤 2: 预览 -->
      <div v-if="importStep === 2 && previewData.length > 0">
        <n-scrollbar style="max-height: 300px">
          <n-list hoverable clickable>
            <n-list-item v-for="(item, index) in previewData" :key="index">
              <template #prefix>
                <n-icon size="24" color="#3B82F6">
                  <document-icon />
                </n-icon>
              </template>
              <n-thing>
                <template #header>{{ item.name }}</template>
                <template #description>
                  <n-space>
                    <n-tag size="small">{{ item.type }}</n-tag>
                    <n-tag size="small">{{ item.size }}</n-tag>
                  </n-space>
                </template>
                <template #footer v-if="item.presetName">
                  <n-text depth="3">预设名称: {{ item.presetName }}</n-text>
                </template>
              </n-thing>
            </n-list-item>
          </n-list>
        </n-scrollbar>
      </div>

      <!-- 步骤 3: 导入中 -->
      <div v-if="importStep === 3">
        <n-space vertical align="center">
          <n-spin size="large">
            <template #description>
              正在导入预设...
            </template>
          </n-spin>
          <n-progress
            type="line"
            :percentage="importProgress"
            :show-indicator="false"
          />
        </n-space>
      </div>

      <template #footer>
        <n-space justify="end">
          <n-button @click="showImportModal = false">取消</n-button>
          <n-button
            v-if="importStep > 1"
            @click="importStep--"
          >
            上一步
          </n-button>
          <n-button
            v-if="importStep === 1"
            type="primary"
            :disabled="uploadFileList.length === 0"
            @click="handlePreviewImport"
          >
            下一步
          </n-button>
          <n-button
            v-if="importStep === 2"
            type="primary"
            @click="handleConfirmImport"
          >
            开始导入
          </n-button>
        </n-space>
      </template>
    </n-modal>

    <!-- 导出对话框 -->
    <n-modal
      v-model:show="showExportModal"
      preset="card"
      title="导出预设"
      style="width: 500px"
    >
      <n-form ref="exportFormRef" :model="exportForm" label-placement="left" label-width="80">
        <n-form-item label="导出格式" required>
          <n-radio-group v-model:value="exportForm.format">
            <n-radio-button value="json">JSON</n-radio-button>
            <n-radio-button value="3fui">3FUI</n-radio-button>
          </n-radio-group>
        </n-form-item>

        <n-form-item label="选择预设">
          <n-checkbox-group v-model:value="exportForm.selectedIds">
            <n-space vertical>
              <n-checkbox
                v-for="preset in exportablePresets"
                :key="preset.id"
                :value="preset.id"
                :label="preset.name"
              />
            </n-space>
          </n-checkbox-group>
        </n-form-item>

        <n-form-item label="批量操作">
          <n-space>
            <n-button size="small" @click="selectAllPresets">
              全选
            </n-button>
            <n-button size="small" @click="deselectAllPresets">
              清空
            </n-button>
          </n-space>
        </n-form-item>
      </n-form>

      <template #footer>
        <n-space justify="end">
          <n-button @click="showExportModal = false">取消</n-button>
          <n-button
            type="primary"
            :disabled="exportForm.selectedIds.length === 0"
            @click="handleExport"
          >
            导出
          </n-button>
        </n-space>
      </template>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import {
  NModal,
  NSteps,
  NStep,
  NUpload,
  NUploadDragger,
  NIcon,
  NText,
  NP,
  NAlert,
  NScrollbar,
  NList,
  NListItem,
  NThing,
  NSpace,
  NTag,
  NSpin,
  NProgress,
  NButton,
  NForm,
  NFormItem,
  NRadioGroup,
  NRadioButton,
  NCheckboxGroup,
  NCheckbox,
  useMessage
} from 'naive-ui';
import {
  CloudUpload as CloudUploadIcon,
  Document as DocumentIcon
} from '@vicons/ionicons5';
import { usePresetsStore } from '../stores/presetsStore';
import type { UploadFileInfo } from 'naive-ui';
import type { ExportFormat } from '../stores/presetsStore';
import { downloadFile } from '../../utils/download';

// Props
interface Props {
  showImport?: boolean;
  showExport?: boolean;
}

const props = defineProps<Props>();

// Emits
const emit = defineEmits<{
  'update:showImport': [value: boolean];
  'update:showExport': [value: boolean];
  'import-complete': [];
}>();

// Stores
const presetsStore = usePresetsStore();
const message = useMessage();

// State
const showImportModal = computed({
  get: () => props.showImport || false,
  set: (val) => emit('update:showImport', val)
});

const showExportModal = computed({
  get: () => props.showExport || false,
  set: (val) => emit('update:showExport', val)
});

const importStep = ref(1);
const uploadFileList = ref<UploadFileInfo[]>([]);
const previewData = ref<any[]>([]);
const importProgress = ref(0);

const exportFormRef = ref();
const exportForm = ref({
  format: 'json' as ExportFormat,
  selectedIds: [] as string[]
});

// Computed
const exportablePresets = computed(() => {
  // 排除内置预设
  return presetsStore.allPresets.filter(p => !p.id.startsWith('builtin-'));
});

// Methods
function handleUploadFileList(fileList: UploadFileInfo[]) {
  uploadFileList.value = fileList;
}

async function handleFileChange(options: { fileList: UploadFileInfo[] }) {
  const fileList = options.fileList;
  uploadFileList.value = fileList;
}

async function handlePreviewImport() {
  if (uploadFileList.value.length === 0) {
    message.warning('请选择要导入的文件');
    return;
  }

  previewData.value = [];

  for (const fileInfo of uploadFileList.value) {
    try {
      const file = fileInfo.file;
      if (!file) continue;

      const text = await file.text();

      // 尝试解析为 JSON
      let parsedData: any;
      try {
        parsedData = JSON.parse(text);

        // 检查是否为 3FUI 格式
        if (parsedData.preset && parsedData.preset.presetName) {
          previewData.value.push({
            name: file.name,
            type: '3FUI',
            size: formatFileSize(file.size),
            presetName: parsedData.preset.presetName,
            data: parsedData
          });
        }
        // 检查是否为 Rebebuca JSON 格式
        else if (parsedData.name && parsedData.preset) {
          previewData.value.push({
            name: file.name,
            type: 'JSON',
            size: formatFileSize(file.size),
            presetName: parsedData.name,
            data: parsedData
          });
        }
      } catch (parseError) {
        // 尝试解析为自定义格式
        previewData.value.push({
          name: file.name,
          type: 'Custom',
          size: formatFileSize(file.size),
          presetName: 'Unknown',
          data: text
        });
      }
    } catch (error) {
      console.error(`Failed to parse ${fileInfo.name}:`, error);
      message.error(`解析文件 ${fileInfo.name} 失败`);
    }
  }

  importStep.value = 2;
}

async function handleConfirmImport() {
  if (previewData.value.length === 0) {
    message.warning('没有可导入的预设');
    return;
  }

  importStep.value = 3;
  importProgress.value = 0;

  const totalFiles = previewData.value.length;
  let successCount = 0;

  for (let i = 0; i < totalFiles; i++) {
    const item = previewData.value[i];

    try {
      if (item.type === '3FUI') {
        // 创建 File 对象
        const blob = new Blob([JSON.stringify(item.data)], { type: 'application/json' });
        const file = new File([blob], item.name);

        await presetsStore.importFrom3FUI(file);
        successCount++;
      } else if (item.type === 'JSON') {
        // JSON 格式直接保存
        const metadata: any = {
          id: `imported-${Date.now()}-${i}`,
          name: item.data.name,
          description: item.data.description,
          version: item.data.version || '1.0.0',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          tags: item.data.tags || ['imported', 'json']
        };

        const importedPreset = {
          ...metadata,
          preset: item.data.preset
        };

        // 添加到导入的预设列表
        (presetsStore as any).importedPresets.push(importedPreset);
        await (presetsStore as any).saveImportedPresetsToStorage();
        successCount++;
      }
    } catch (error) {
      console.error(`Failed to import ${item.name}:`, error);
    }

    importProgress.value = ((i + 1) / totalFiles) * 100;
  }

  // 延迟关闭对话框，显示结果
  setTimeout(() => {
    showImportModal.value = false;
    importStep.value = 1;
    uploadFileList.value = [];
    previewData.value = [];
    importProgress.value = 0;

    if (successCount > 0) {
      message.success(`成功导入 ${successCount} 个预设`);
    } else {
      message.error('导入失败');
    }

    emit('import-complete');
  }, 500);
}

async function handleExport() {
  if (exportForm.value.selectedIds.length === 0) {
    message.warning('请选择要导出的预设');
    return;
  }

  try {
    const format = exportForm.value.format;
    const ids = exportForm.value.selectedIds;

    if (ids.length === 1) {
      // 单个导出
      const presetId = ids[0];
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
    } else {
      // 批量导出
      const exportedFiles = await presetsStore.batchExport(ids, format);

      if (exportedFiles.size > 0) {
        // 逐个下载文件
        for (const [filename, content] of exportedFiles.entries()) {
          downloadFile(content, filename);
        }
        message.success(`成功导出 ${exportedFiles.size} 个预设`);
      } else {
        message.error('导出失败');
      }
    }

    showExportModal.value = false;
    exportForm.value = {
      format: 'json',
      selectedIds: []
    };
  } catch (error) {
    console.error('Export failed:', error);
    message.error('导出失败');
  }
}

function selectAllPresets() {
  exportForm.value.selectedIds = exportablePresets.value.map(p => p.id);
}

function deselectAllPresets() {
  exportForm.value.selectedIds = [];
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

// Watchers
watch(() => props.showImport, (newVal) => {
  if (newVal) {
    importStep.value = 1;
    uploadFileList.value = [];
    previewData.value = [];
  }
});

watch(() => props.showExport, (newVal) => {
  if (newVal) {
    exportForm.value = {
      format: 'json',
      selectedIds: []
    };
  }
});
</script>

<style scoped>
.preset-import-export {
  /* 组件样式 */
}
</style>
