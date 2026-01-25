/**
 * FFmpeg 组件统一导出
 */

export { default as FFmpegConfigPanel } from './FFmpegConfigPanel.vue';
export { default as OutputParamsPanel } from './OutputParamsPanel.vue';
export { default as VideoParamsPanel } from './VideoParamsPanel.vue';
export { default as AudioParamsPanel } from './AudioParamsPanel.vue';
export { default as CommandPreview } from './CommandPreview.vue';
export { default as ProgressMonitor } from './ProgressMonitor.vue';
export { default as FFmpegProgress } from './FFmpegProgress.vue';
export { default as PerformanceInfo } from './PerformanceInfo.vue';
export { default as ErrorLog } from './ErrorLog.vue';
export { default as PresetsManager } from './PresetsManager.vue';
export { default as PresetQuickSelect } from './PresetQuickSelect.vue';
export { default as PresetImportExport } from './PresetImportExport.vue';
export { default as FFmpegEncoderPage } from './FFmpegEncoderPage.vue';

// 阶段 4: 高级功能组件
export { default as FilterConfigPanel } from './filters/FilterConfigPanel.vue';
export { default as BasicFiltersPanel } from './filters/BasicFiltersPanel.vue';
export { default as AdvancedFiltersPanel } from './filters/AdvancedFiltersPanel.vue';
export { default as SubtitleFilterPanel } from './filters/SubtitleFilterPanel.vue';
export { default as ColorManagementPanel } from './filters/ColorManagementPanel.vue';
export { default as FilterChainEditor } from './filters/FilterChainEditor.vue';
export { default as TrimmingPanel } from './TrimmingPanel.vue';
export { default as TwoPassPanel } from './TwoPassPanel.vue';
export { default as HardwareAcceleratorPanel } from './HardwareAcceleratorPanel.vue';

// 阶段 5: 优化完善组件
export { default as SimpleModePanel } from './SimpleModePanel.vue';
export { default as ExpertModePanel } from './ExpertModePanel.vue';
export { default as BatchTaskQueue } from './BatchTaskQueue.vue';
export { default as AdvancedOptionsPanel } from './AdvancedOptionsPanel.vue';
