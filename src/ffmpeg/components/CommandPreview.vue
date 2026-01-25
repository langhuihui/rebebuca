<template>
  <div class="command-preview">
    <div class="section-header">
      <h3>命令行预览</h3>
      <n-space>
        <n-button size="small" @click="handleCopy">
          <template #icon>
            <n-icon><CopyIcon /></n-icon>
          </template>
          复制
        </n-button>
        <n-button size="small" @click="handleRefresh">
          <template #icon>
            <n-icon><RefreshIcon /></n-icon>
          </template>
          刷新
        </n-button>
      </n-space>
    </div>

    <!-- 命令行显示 -->
    <div class="command-display">
      <n-scrollbar style="max-height: 200px">
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
      <n-space align="center">
        <n-icon
          :size="20"
          :color="isValid ? '#18a058' : '#d03050'"
        >
          <CheckIcon v-if="isValid" />
          <WarningIcon v-else />
        </n-icon>
        <span :class="{ 'valid': isValid, 'invalid': !isValid }">
          {{ isValid ? '配置有效' : '配置无效' }}
        </span>
      </n-space>
    </div>

    <!-- 警告信息 -->
    <n-alert
      v-if="hasWarnings"
      type="warning"
      title="警告"
      style="margin-top: 12px"
    >
      <ul>
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
  padding: 16px;
  background-color: var(--n-color-embedded);
  border-radius: 8px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.section-header h3 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: #333;
}

.command-display {
  background-color: #1e1e1e;
  border-radius: 6px;
  padding: 12px;
  min-height: 80px;
}

.validation-status {
  margin-top: 12px;
  padding: 8px 12px;
  border-radius: 6px;
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
  padding-left: 20px;
}
</style>
