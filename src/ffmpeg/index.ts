/**
 * FFmpeg 模块统一导出
 */

// 类型
export * from './types';

// 服务
export { commandBuilder } from './services/commandBuilder';
export { validationService } from './services/validationService';
export { encoderDatabase } from './services/encoderDatabase';
export { progressParser, ProgressParser } from './services/progressParser';

// Store
export { useFFmpegParamsStore } from './stores/ffmpegParams';
export { useFFmpegProgressStore } from './stores/progressStore';
export type { InputFile } from './stores/ffmpegParams';
export type { TaskProgress } from './stores/progressStore';

// 工具函数
export * from './utils';

// 组件
export { default as FFmpegConfigPanel } from './components/FFmpegConfigPanel.vue';
export { default as OutputParamsPanel } from './components/OutputParamsPanel.vue';
export { default as VideoParamsPanel } from './components/VideoParamsPanel.vue';
export { default as AudioParamsPanel } from './components/AudioParamsPanel.vue';
export { default as CommandPreview } from './components/CommandPreview.vue';
export { default as ProgressMonitor } from './components/ProgressMonitor.vue';
export { default as FFmpegProgress } from './components/FFmpegProgress.vue';
export { default as PerformanceInfo } from './components/PerformanceInfo.vue';
export { default as ErrorLog } from './components/ErrorLog.vue';
