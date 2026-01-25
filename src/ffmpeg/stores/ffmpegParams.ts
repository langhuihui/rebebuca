/**
 * FFmpeg 参数状态管理
 * 使用 Pinia 管理 FFmpeg 预设配置
 */

import { defineStore } from 'pinia';
import type { FFmpegPreset, PresetMetadata } from '../types/preset';
import { validationService } from '../services/validationService';
import presetsData from '../data/presets.json';

/**
 * 输入文件信息
 */
export interface InputFile {
  name: string;
  path: string;
  size: number;
  type: 'video' | 'audio' | 'image' | 'unknown';
}

export const useFFmpegParamsStore = defineStore('ffmpegParams', {
  state: () => ({
    // 当前预设配置
    currentPreset: createDefaultPreset(),

    // 内置预设
    builtinPresets: [] as Array<PresetMetadata & { preset: FFmpegPreset }>,

    // 自定义预设
    customPresets: [] as Array<PresetMetadata & { preset: FFmpegPreset }>,

    // 当前选中的预设 ID
    selectedPresetId: '',

    // 输入文件列表
    inputFiles: [] as InputFile[],

    // 输出文件
    outputFile: '',

    // 生成的命令行
    commandPreview: '',

    // 验证结果
    validationResult: validationService.quickValidate(createDefaultPreset()),

    // 加载状态
    loading: false,

    // 错误信息
    error: null as string | null
  }),

  getters: {
    /**
     * 获取所有预设（内置 + 自定义）
     */
    allPresets(state): Array<PresetMetadata & { preset: FFmpegPreset }> {
      return [...state.builtinPresets, ...state.customPresets];
    },

    /**
     * 获取当前选中的预设
     */
    selectedPreset(state): Array<PresetMetadata & { preset: FFmpegPreset }> | undefined {
      return state.allPresets.find(p => p.id === state.selectedPresetId);
    },

    /**
     * 是否有输入文件
     */
    hasInputFiles(state): boolean {
      return state.inputFiles.length > 0;
    },

    /**
     * 是否为批量模式
     */
    isBatchMode(state): boolean {
      return state.inputFiles.length > 1;
    },

    /**
     * 预设是否有效
     */
    isValidPreset(state): boolean {
      return state.validationResult.valid;
    },

    /**
     * 是否可以开始转码
     */
    canStartEncoding(state): boolean {
      return (
        state.isValidPreset &&
        state.inputFiles.length > 0 &&
        !state.loading
      );
    }
  },

  actions: {
    /**
     * 初始化 store
     */
    async initialize() {
      this.loading = true;
      try {
        // 加载内置预设
        this.builtinPresets = presetsData.builtin;

        // 加载本地存储的自定义预设
        await this.loadCustomPresetsFromStorage();

        // 默认选中第一个内置预设
        if (this.builtinPresets.length > 0) {
          this.applyPreset(this.builtinPresets[0].id);
        }

        this.error = null;
      } catch (error) {
        console.error('Failed to initialize FFmpeg params store:', error);
        this.error = 'Failed to initialize FFmpeg parameters';
      } finally {
        this.loading = false;
      }
    },

    /**
     * 应用预设
     */
    applyPreset(presetId: string) {
      const preset = this.allPresets.find(p => p.id === presetId);
      if (preset) {
        this.selectedPresetId = presetId;
        this.currentPreset = JSON.parse(JSON.stringify(preset.preset));
        this.validateCurrentPreset();
        this.updateCommandPreview();
      }
    },

    /**
     * 更新预设配置
     */
    updatePreset(partialPreset: Partial<FFmpegPreset>) {
      this.currentPreset = { ...this.currentPreset, ...partialPreset };
      this.validateCurrentPreset();
      this.updateCommandPreview();
    },

    /**
     * 更新视频配置
     */
    updateVideoConfig(video: Partial<FFmpegPreset['video']>) {
      this.currentPreset.video = { ...this.currentPreset.video, ...video };
      this.validateCurrentPreset();
      this.updateCommandPreview();
    },

    /**
     * 更新音频配置
     */
    updateAudioConfig(audio: Partial<FFmpegPreset['audio']>) {
      this.currentPreset.audio = { ...this.currentPreset.audio, ...audio };
      this.validateCurrentPreset();
      this.updateCommandPreview();
    },

    /**
     * 更新质量控制
     */
    updateQualityConfig(quality: Partial<FFmpegPreset['quality']>) {
      this.currentPreset.quality = { ...this.currentPreset.quality, ...quality };
      this.validateCurrentPreset();
      this.updateCommandPreview();
    },

    /**
     * 更新滤镜配置
     */
    updateFiltersConfig(filters: Partial<FFmpegPreset['filters']>) {
      this.currentPreset.filters = { ...this.currentPreset.filters, ...filters };
      this.validateCurrentPreset();
      this.updateCommandPreview();
    },

    /**
     * 更新输出配置
     */
    updateOutputConfig(output: Partial<FFmpegPreset['output']>) {
      this.currentPreset.output = { ...this.currentPreset.output, ...output };
      this.validateCurrentPreset();
      this.updateCommandPreview();
    },

    /**
     * 更新剪辑配置
     */
    updateTrimmingConfig(trimming: Partial<FFmpegPreset['trimming']>) {
      this.currentPreset.trimming = { ...this.currentPreset.trimming, ...trimming };
      this.validateCurrentPreset();
      this.updateCommandPreview();
    },

    /**
     * 添加输入文件
     */
    addInputFile(file: InputFile) {
      this.inputFiles.push(file);
      this.updateCommandPreview();
    },

    /**
     * 批量添加输入文件
     */
    addInputFiles(files: InputFile[]) {
      this.inputFiles.push(...files);
      this.updateCommandPreview();
    },

    /**
     * 移除输入文件
     */
    removeInputFile(index: number) {
      this.inputFiles.splice(index, 1);
      this.updateCommandPreview();
    },

    /**
     * 清空输入文件列表
     */
    clearInputFiles() {
      this.inputFiles = [];
      this.updateCommandPreview();
    },

    /**
     * 保存预设为自定义预设
     */
    async savePreset(name: string, description?: string) {
      const metadata: PresetMetadata = {
        id: `custom-${Date.now()}`,
        name,
        description: description || '',
        version: '1.0.0',
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      const customPreset = {
        ...metadata,
        preset: JSON.parse(JSON.stringify(this.currentPreset))
      };

      this.customPresets.push(customPreset);
      await this.saveCustomPresetsToStorage();

      return metadata.id;
    },

    /**
     * 删除自定义预设
     */
    async deleteCustomPreset(presetId: string) {
      const index = this.customPresets.findIndex(p => p.id === presetId);
      if (index !== -1) {
        this.customPresets.splice(index, 1);
        await this.saveCustomPresetsToStorage();

        // 如果删除的是当前选中的预设，切换到默认预设
        if (this.selectedPresetId === presetId) {
          if (this.builtinPresets.length > 0) {
            this.applyPreset(this.builtinPresets[0].id);
          }
        }
      }
    },

    /**
     * 验证当前预设
     */
    validateCurrentPreset() {
      this.validationResult = validationService.quickValidate(this.currentPreset);
    },

    /**
     * 更新命令预览
     */
    async updateCommandPreview() {
      if (this.inputFiles.length === 0) {
        this.commandPreview = '';
        return;
      }

      const { commandBuilder } = await import('../services/commandBuilder');

      try {
        const firstInputFile = this.inputFiles[0];
        this.commandPreview = await commandBuilder.build(
          this.currentPreset,
          firstInputFile.path,
          this.outputFile
        );
      } catch (error) {
        console.error('Failed to generate command preview:', error);
        this.commandPreview = 'Error generating command';
      }
    },

    /**
     * 重置为默认预设
     */
    resetToDefault() {
      this.currentPreset = createDefaultPreset();
      this.validateCurrentPreset();
      this.updateCommandPreview();
    },

    /**
     * 从本地存储加载自定义预设
     */
    async loadCustomPresetsFromStorage() {
      try {
        const stored = localStorage.getItem('rebebuca-ffmpeg-presets');
        if (stored) {
          this.customPresets = JSON.parse(stored);
        }
      } catch (error) {
        console.error('Failed to load custom presets:', error);
      }
    },

    /**
     * 保存自定义预设到本地存储
     */
    async saveCustomPresetsToStorage() {
      try {
        localStorage.setItem(
          'rebebuca-ffmpeg-presets',
          JSON.stringify(this.customPresets)
        );
      } catch (error) {
        console.error('Failed to save custom presets:', error);
      }
    }
  }
});

/**
 * 创建默认预设
 */
function createDefaultPreset(): FFmpegPreset {
  return {
    output: {
      container: 'mp4',
      naming: {
        useAutoNaming: true,
        autoNamingOption: 0,
        prefix: '',
        suffix: 'encoded',
        customPattern: ''
      },
      location: ''
    },
    decoder: {
      decoder: 'auto',
      hwaccel: 'auto',
      hwaccelDevice: ''
    },
    video: {
      enabled: true,
      encoderCategory: 'h264',
      encoder: 'libx264',
      preset: 'medium',
      profile: 'high',
      level: '4.0',
      tune: '',
      passMode: 0
    },
    quality: {
      controlMode: 'CRF',
      paramName: 'crf',
      value: '23',
      bitrate: {
        base: '5M'
      }
    },
    filters: {},
    audio: {
      enabled: true,
      encoder: 'aac',
      bitrate: '192k',
      channels: '2',
      sampleRate: '48000'
    },
    trimming: {
      enabled: false,
      startTime: '00:00:00.000',
      endTime: '00:00:00.000'
    },
    streamControl: {
      keepOtherVideoStreams: false,
      keepOtherAudioStreams: false,
      keepSubtitleStreams: true,
      keepAttachmentStreams: false
    },
    custom: {
      preParams: '',
      videoFilter: '',
      audioFilter: '',
      videoParams: '',
      audioParams: '',
      postParams: '',
      fullCustom: ''
    }
  };
}
