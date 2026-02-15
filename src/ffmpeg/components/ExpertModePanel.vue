<template>
  <div class="expert-mode-panel">
    <n-alert type="warning" :show-icon="false" size="small" style="margin-bottom: 12px; padding: 8px 12px;">
      <template #header>
        <span class="panel-title">专家模式</span>
      </template>
      <span style="font-size: 12px;">显示所有参数配置。不熟悉参数请参考帮助文档或切换到简单模式。</span>
    </n-alert>

    <!-- 标签页 -->
    <n-tabs type="line" size="small" animated>
      <!-- 视频参数 -->
      <n-tab-pane name="video" tab="视频">
        <VideoParamsPanel />
      </n-tab-pane>

      <!-- 音频参数 -->
      <n-tab-pane name="audio" tab="音频">
        <AudioParamsPanel />
      </n-tab-pane>

      <!-- 滤镜 -->
      <n-tab-pane name="filters" tab="滤镜">
        <FilterConfigPanel />
      </n-tab-pane>

      <!-- 剪辑 -->
      <n-tab-pane name="trimming" tab="剪辑">
        <TrimmingPanel />
      </n-tab-pane>

      <!-- 二遍编码 -->
      <n-tab-pane name="twopass" tab="二遍编码">
        <TwoPassPanel />
      </n-tab-pane>

      <!-- 硬件加速 -->
      <n-tab-pane name="hwaccel" tab="硬件加速">
        <HardwareAcceleratorPanel />
      </n-tab-pane>

      <!-- 高级选项 -->
      <n-tab-pane name="advanced" tab="高级选项">
        <AdvancedOptionsPanel />
      </n-tab-pane>
    </n-tabs>

    <!-- 快速参考 - 折叠面板 -->
    <n-collapse style="margin-top: 12px;">
      <n-collapse-item title="📚 快速参考" name="reference">
        <n-space vertical :size="6">
          <div style="font-size: 12px;">
            <strong>CRF 质量参考:</strong> 18-20=高质量, 23=平衡, 26-28=小文件
          </div>
          <div style="font-size: 12px;">
            <strong>编码速度参考:</strong> ultrafast > fast > medium > slow > veryslow
          </div>
          <div style="font-size: 12px;">
            <strong>像素格式参考:</strong> yuv420p=8-bit, yuv420p10le=10-bit
          </div>
          <div style="font-size: 12px; color: #666;">
            更多信息请查看 <a href="#" @click.prevent="openDocs">帮助文档</a>
          </div>
        </n-space>
      </n-collapse-item>
    </n-collapse>
  </div>
</template>

<script setup lang="ts">
import {
  NAlert,
  NTabs,
  NTabPane,
  NSpace,
  NCollapse,
  NCollapseItem
} from 'naive-ui';
import { VideoParamsPanel } from './index';
import { AudioParamsPanel } from './index';
import { FilterConfigPanel } from './filters/index';
import TrimmingPanel from './TrimmingPanel.vue';
import TwoPassPanel from './TwoPassPanel.vue';
import HardwareAcceleratorPanel from './HardwareAcceleratorPanel.vue';
import AdvancedOptionsPanel from './AdvancedOptionsPanel.vue';

// 打开文档
const openDocs = () => {
  // TODO: 打开帮助文档
  console.log('Open documentation');
};
</script>

<style scoped>
.expert-mode-panel {
  padding: 8px;
}

.panel-title {
  font-weight: 600;
  font-size: 14px;
}
</style>
