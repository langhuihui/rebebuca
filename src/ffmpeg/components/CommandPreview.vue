<template>
  <div class="command-preview">
    <div class="section-header">
      <h3>命令行预览</h3>
      <n-space :size="8">
        <n-tooltip trigger="hover">
          <template #trigger>
            <n-button size="small" circle @click="handleCopy">
              <n-icon><CopyIcon /></n-icon>
            </n-button>
          </template>
          复制命令
        </n-tooltip>
        <n-tooltip trigger="hover">
          <template #trigger>
            <n-button size="small" circle @click="handleRefresh">
              <n-icon><RefreshIcon /></n-icon>
            </n-button>
          </template>
          刷新
        </n-tooltip>
      </n-space>
    </div>

    <!-- 命令行显示 -->
    <div class="command-display">
      <n-scrollbar style="max-height: 120px">
        <n-code
          v-if="store.commandPreview"
          :code="store.commandPreview"
          language="bash"
          word-wrap
        />
        <n-empty
          v-else
          description="添加输入文件后显示命令行"
          size="small"
        />
      </n-scrollbar>
    </div>

    <!-- 验证状态 -->
    <div class="validation-status" v-if="showValidationStatus">
      <n-space align="center" :size="4">
        <n-icon
          :size="16"
          :color="isValid ? '#18a058' : '#d03050'"
        >
          <CheckIcon v-if="isValid" />
          <WarningIcon v-else />
        </n-icon>
        <span :class="{ 'valid': isValid, 'invalid': !isValid }" style="font-size: 12px;">
          {{ isValid ? '配置有效' : '配置无效' }}
        </span>
      </n-space>
    </div>

    <!-- 警告信息 -->
    <n-alert
      v-if="hasWarnings"
      type="warning"
      title="警告"
      size="small"
      style="margin-top: 8px"
    >
      <ul style="font-size: 12px; margin: 0; padding-left: 16px;">
        <li v-for="(warning, index) in store.validationResult.warnings" :key="index">
          {{ warning.message }}
        </li>
      </ul>
    </n-alert>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import {
  NSpace,
  NButton,
  NIcon,
  NScrollbar,
  NCode,
  NEmpty,
  NAlert,
  NTooltip,
  useMessage
} from 'naive-ui';
import {
  Copy as CopyIcon,
  Refresh as RefreshIcon,
  CheckmarkCircle as CheckIcon,
  Warning as WarningIcon
} from '@vicons/ionicons5';
import { useFFmpegParamsStore } from '../stores/ffmpegParams';

const store = useFFmpegParamsStore();
const message = useMessage();

// 是否显示验证状态
const showValidationStatus = computed(() => {
  return store.inputFiles.length > 0;
});

// 是否有效
const isValid = computed(() => store.validationResult.valid);

// 是否有警告
const hasWarnings = computed(() => store.validationResult.warnings.length > 0);

// 处理复制
const handleCopy = async () => {
  if (!store.commandPreview) {
    message.warning('没有可复制的命令行');
    return;
  }

  try {
    await navigator.clipboard.writeText(store.commandPreview);
    message.success('命令行已复制到剪贴板');
  } catch (error) {
    message.error('复制失败');
  }
};

// 处理刷新
const handleRefresh = () => {
  store.updateCommandPreview();
  message.info('命令行已刷新');
};
</script>

<style scoped>
.command-preview {
  padding: 12px;
  background-color: var(--n-color-embedded);
  border-radius: 6px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.section-header h3 {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  color: #333;
}

.command-display {
  background-color: #1e1e1e;
  border-radius: 4px;
  padding: 8px;
  min-height: 60px;
}

.validation-status {
  margin-top: 8px;
  padding: 4px 8px;
  border-radius: 4px;
  display: flex;
  align-items: center;
}

.validation-status .valid {
  color: #18a058;
  font-weight: 500;
}

.validation-status .invalid {
  color: #d03050;
  font-weight: 500;
}

ul {
  margin: 0;
  padding-left: 16px;
}
</style>
