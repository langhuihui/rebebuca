<template>
  <div class="ffmpeg-config-panel">
    <n-card title="FFmpeg 视频编码" :bordered="false" size="small">
      <!-- 模式切换 -->
      <div class="mode-switcher">
        <n-radio-group
          v-model:value="currentMode"
          size="small"
          @update:value="handleModeChange"
        >
          <n-radio-button value="simple">
            <template #default>
              <span style="display: flex; align-items: center; gap: 4px;">
                <n-icon size="14"><SparklesIcon /></n-icon>
                简单模式
              </span>
            </template>
          </n-radio-button>
          <n-radio-button value="expert">
            <template #default>
              <span style="display: flex; align-items: center; gap: 4px;">
                <n-icon size="14"><SettingsIcon /></n-icon>
                专家模式
              </span>
            </template>
          </n-radio-button>
        </n-radio-group>

        <n-switch
          v-if="isBatchMode"
          v-model:value="showBatchQueue"
          size="small"
          @update:value="handleBatchQueueToggle"
        >
          <template #checked>
            批量队列
          </template>
          <template #unchecked>
            批量队列
          </template>
        </n-switch>
      </div>

      <n-divider style="margin: 12px 0" />

      <!-- 输入文件区域 -->
      <div class="section">
        <div class="section-header">
          <h3>输入文件</h3>
          <n-space :size="8">
            <n-tooltip trigger="hover">
              <template #trigger>
                <n-button size="small" circle @click="handleAddFiles">
                  <n-icon><AddIcon /></n-icon>
                </n-button>
              </template>
              添加文件
            </n-tooltip>
            <n-tooltip trigger="hover">
              <template #trigger>
                <n-button size="small" circle @click="handleClearFiles" :disabled="!hasInputFiles">
                  <n-icon><TrashIcon /></n-icon>
                </n-button>
              </template>
              清空列表
            </n-tooltip>
          </n-space>
        </div>

        <!-- 文件拖拽区域 -->
        <div
          class="drop-zone"
          :class="{ 'drag-over': isDragOver }"
          @dragover.prevent="isDragOver = true"
          @dragleave="isDragOver = false"
          @drop.prevent="handleDrop"
          v-if="inputFiles.length === 0"
        >
          <n-empty description="拖拽文件到此处或点击添加文件" size="small">
            <template #icon>
              <n-icon :size="48"><FolderIcon /></n-icon>
            </template>
          </n-empty>
        </div>

        <!-- 文件列表 -->
        <div class="file-list" v-else>
          <n-list bordered size="small">
            <n-list-item v-for="(file, index) in inputFiles" :key="index">
              <template #prefix>
                <n-icon size="18" color="#18a058">
                  <VideoIcon />
                </n-icon>
              </template>
              <n-ellipsis :tooltip="{ content: file.path }" style="font-size: 13px;">
                {{ file.name }}
              </n-ellipsis>
              <template #suffix>
                <span class="file-size">{{ formatFileSize(file.size) }}</span>
                <n-tooltip trigger="hover">
                  <template #trigger>
                    <n-button size="tiny" circle text @click="handleRemoveFile(index)">
                      <n-icon size="16"><CloseIcon /></n-icon>
                    </n-button>
                  </template>
                  移除
                </n-tooltip>
              </template>
            </n-list-item>
          </n-list>

          <div class="batch-mode-indicator" v-if="isBatchMode">
            <n-tag type="info" size="small">批量模式: {{ inputFiles.length }} 个文件</n-tag>
          </div>
        </div>

        <!-- 隐藏的文件输入 -->
        <input
          ref="fileInputRef"
          type="file"
          accept="video/*,audio/*"
          multiple
          style="display: none"
          @change="handleFileInputChange"
        />
      </div>

      <n-divider style="margin: 12px 0" />

      <!-- 预设选择区域 (仅在简单模式显示) -->
      <div class="section" v-if="currentMode === 'simple'">
        <div class="section-header compact">
          <h3>预设模板</h3>
        </div>
        <n-select
          v-model:value="selectedPresetId"
          :options="presetOptions"
          placeholder="选择预设模板"
          size="small"
          @update:value="handlePresetChange"
          filterable
        />
      </div>

      <n-divider style="margin: 12px 0" />

      <!-- 简单模式面板 -->
      <SimpleModePanel v-if="currentMode === 'simple'" />

      <n-divider v-if="currentMode === 'simple'" />

      <!-- 专家模式面板 -->
      <ExpertModePanel v-if="currentMode === 'expert'" />

      <n-divider style="margin: 12px 0" />

      <!-- 命令行预览 -->
      <CommandPreview />

      <n-divider style="margin: 12px 0" />

      <!-- 批量任务队列 (批量模式且启用时显示) -->
      <BatchTaskQueue v-if="showBatchQueue && isBatchMode" />

      <!-- 操作按钮 -->
      <div class="action-buttons">
        <n-space justify="center" :size="12">
          <n-button
            type="primary"
            size="small"
            :disabled="!canStartEncoding"
            @click="handleStartEncoding"
          >
            <template #icon>
              <n-icon><PlayIcon /></n-icon>
            </template>
            {{ showBatchQueue && isBatchMode ? '开始批量处理' : '开始转码' }}
          </n-button>
          <n-tooltip trigger="hover">
            <template #trigger>
              <n-button size="small" circle @click="handleSavePreset">
                <n-icon><SaveIcon /></n-icon>
              </n-button>
            </template>
            保存预设
          </n-tooltip>
          <n-tooltip trigger="hover">
            <template #trigger>
              <n-button size="small" circle @click="handleReset">
                <n-icon><RefreshIcon /></n-icon>
              </n-button>
            </template>
            重置
          </n-tooltip>
        </n-space>
      </div>
    </n-card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import {
  NCard,
  NSpace,
  NButton,
  NIcon,
  NEmpty,
  NList,
  NListItem,
  NEllipsis,
  NTag,
  NDivider,
  NSelect,
  NRadioGroup,
  NRadioButton,
  NSwitch,
  NTooltip,
  useMessage,
  useDialog
} from 'naive-ui';
import {
  Add as AddIcon,
  TrashOutline as TrashIcon,
  Folder as FolderIcon,
  Videocam as VideoIcon,
  Close as CloseIcon,
  Play as PlayIcon,
  Save as SaveIcon,
  Refresh as RefreshIcon,
  Sparkles as SparklesIcon,
  Settings as SettingsIcon
} from '@vicons/ionicons5';
import { useFFmpegParamsStore, type InputFile } from '../stores/ffmpegParams';
import OutputParamsPanel from './OutputParamsPanel.vue';
import VideoParamsPanel from './VideoParamsPanel.vue';
import AudioParamsPanel from './AudioParamsPanel.vue';
import CommandPreview from './CommandPreview.vue';
import SimpleModePanel from './SimpleModePanel.vue';
import ExpertModePanel from './ExpertModePanel.vue';
import BatchTaskQueue from './BatchTaskQueue.vue';

const store = useFFmpegParamsStore();
const message = useMessage();
const dialog = useDialog();

// 文件输入引用
const fileInputRef = ref<HTMLInputElement | null>(null);

// 拖拽状态
const isDragOver = ref(false);

// 当前模式
const currentMode = ref<'simple' | 'expert'>('simple');

// 显示批量队列
const showBatchQueue = ref(false);

// 计算属性
const inputFiles = computed(() => store.inputFiles);
const hasInputFiles = computed(() => store.hasInputFiles);
const isBatchMode = computed(() => store.isBatchMode);
const canStartEncoding = computed(() => store.canStartEncoding);
const selectedPresetId = computed({
  get: () => store.selectedPresetId,
  set: (value: string) => {
    store.applyPreset(value);
  }
});

// 监听批量模式,自动切换到批量队列
watch(isBatchMode, (isBatch) => {
  if (isBatch) {
    showBatchQueue.value = true;
  }
});

// 监听模式变化
watch(currentMode, (mode) => {
  // 保存用户偏好
  localStorage.setItem('rebebuca-ffmpeg-mode', mode);
}, { immediate: true });

// 初始化:从本地存储加载模式偏好
const initializeMode = () => {
  const savedMode = localStorage.getItem('rebebuca-ffmpeg-mode');
  if (savedMode === 'simple' || savedMode === 'expert') {
    currentMode.value = savedMode as 'simple' | 'expert';
  }
};

initializeMode();

const presetOptions = computed(() => {
  return store.allPresets.map(preset => ({
    label: preset.name,
    value: preset.id,
    tags: preset.tags || []
  }));
});

// 处理模式切换
const handleModeChange = (mode: 'simple' | 'expert') => {
  currentMode.value = mode;
  message.info(`已切换到${mode === 'simple' ? '简单' : '专家'}模式`);
};

// 处理批量队列切换
const handleBatchQueueToggle = (value: boolean) => {
  showBatchQueue.value = value;
};

// 处理添加文件
const handleAddFiles = () => {
  fileInputRef.value?.click();
};

// 处理文件输入变化
const handleFileInputChange = (event: Event) => {
  const target = event.target as HTMLInputElement;
  const files = target.files;

  if (files && files.length > 0) {
    const inputFiles: InputFile[] = Array.from(files).map(file => ({
      name: file.name,
      path: file.path || URL.createObjectURL(file),
      size: file.size,
      type: file.type.startsWith('video') ? 'video' :
            file.type.startsWith('audio') ? 'audio' :
            'unknown'
    }));

    store.addInputFiles(inputFiles);
    message.success(`已添加 ${inputFiles.length} 个文件`);
  }

  // 清空输入以允许重新选择同一文件
  target.value = '';
};

// 处理拖放
const handleDrop = (event: DragEvent) => {
  isDragOver.value = false;

  const files = event.dataTransfer?.files;
  if (files && files.length > 0) {
    const inputFiles: InputFile[] = Array.from(files).map(file => ({
      name: file.name,
      path: file.path || URL.createObjectURL(file),
      size: file.size,
      type: file.type.startsWith('video') ? 'video' :
            file.type.startsWith('audio') ? 'audio' :
            'unknown'
    }));

    store.addInputFiles(inputFiles);
    message.success(`已添加 ${inputFiles.length} 个文件`);
  }
};

// 处理移除文件
const handleRemoveFile = (index: number) => {
  store.removeInputFile(index);
  message.info('已移除文件');
};

// 处理清空文件
const handleClearFiles = () => {
  dialog.warning({
    title: '确认清空',
    content: '确定要清空所有输入文件吗？',
    positiveText: '确定',
    negativeText: '取消',
    onPositiveClick: () => {
      store.clearInputFiles();
      message.success('已清空文件列表');
    }
  });
};

// 处理预设变化
const handlePresetChange = (presetId: string) => {
  store.applyPreset(presetId);
  message.info('已应用预设');
};

// 处理保存预设
const handleSavePreset = () => {
  dialog.input({
    title: '保存预设',
    placeholder: '请输入预设名称',
    positiveText: '保存',
    negativeText: '取消',
    onPositiveClick: (value: string) => {
      if (value && value.trim()) {
        store.savePreset(value.trim());
        message.success('预设已保存');
      } else {
        message.error('请输入预设名称');
        return false;
      }
    }
  });
};

// 处理重置
const handleReset = () => {
  dialog.warning({
    title: '确认重置',
    content: '确定要重置所有参数为默认值吗？',
    positiveText: '确定',
    negativeText: '取消',
    onPositiveClick: () => {
      store.resetToDefault();
      message.success('已重置参数');
    }
  });
};

// 处理开始转码
const handleStartEncoding = () => {
  if (showBatchQueue.value && isBatchMode) {
    // 批量模式
    message.info('准备批量处理...');
    // TODO: 集成批量任务队列
  } else {
    // 单文件模式
    message.info('准备开始转码...');
    // TODO: 集成实际的转码流程
  }
};

// 格式化文件大小
const formatFileSize = (bytes: number): string => {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(2)} ${units[unitIndex]}`;
};
</script>

<style scoped>
.ffmpeg-config-panel {
  padding: 12px;
}

.section {
  margin-bottom: 12px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.section-header.compact {
  margin-bottom: 8px;
}

.section-header h3 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
}

.drop-zone {
  border: 2px dashed #d9d9d9;
  border-radius: 6px;
  padding: 24px;
  text-align: center;
  transition: all 0.3s;
}

.drop-zone.drag-over {
  border-color: #18a058;
  background-color: rgba(24, 160, 88, 0.05);
}

.file-list {
  margin-top: 8px;
}

.file-size {
  margin-right: 12px;
  color: #666;
  font-size: 12px;
}

.batch-mode-indicator {
  margin-top: 8px;
  text-align: center;
}

.action-buttons {
  margin-top: 16px;
}

.mode-switcher {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}
</style>
