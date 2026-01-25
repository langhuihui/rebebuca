/**
 * 3FUI 预设格式转换器
 * 负责 Rebebuca 预设格式与 FFmpegFreeUI (3FUI) 预设格式之间的互转
 *
 * 参考文档:
 * - FFmpegFreeUI 的预设数据类型.vb (需从原始项目获取)
 * - 字段映射表需根据实际 3FUI 格式进行调整
 */

import type { FFmpegPreset, PackedPreset } from '../types/preset';

/**
 * 3FUI 预设格式
 * 这是根据 FFmpegFreeUI 的 VB.NET 数据结构转换而来的 TypeScript 接口
 */
export interface FFPreset3FUI {
  presetName: string;
  version: string;

  // 输出配置
  outputContainer: string;
  outputLocation: string;

  // 视频编码器
  videoEncoderCategory: string;
  videoEncoder: string;
  videoPreset: string;
  videoProfile: string;
  videoLevel: string;
  videoTune: string;
  videoPassMode: number;

  // 质量控制
  qualityControlMode: string;  // CRF, VBR, CQP, CBR
  qualityValue: string;
  qualityBitrate: string;
  qualityBitrateMin: string;
  qualityBitrateMax: string;
  qualityBufferSize: string;

  // 视频滤镜
  filterCropEnabled: boolean;
  filterCropW: string;
  filterCropH: string;
  filterCropX: string;
  filterCropY: string;

  filterScaleEnabled: boolean;
  filterScaleW: string;
  filterScaleH: string;
  filterScaleKeepAspect: boolean;
  filterScaleAlgorithm: string;

  filterFramerateEnabled: boolean;
  filterFramerateFPS: string;
  filterFramerateMode: number;

  filterDeinterlaceEnabled: boolean;
  filterDeinterlaceMode: number;

  filterDenoiseEnabled: boolean;
  filterDenoiseMode: string;
  filterDenoiseStrength: string;

  filterSharpenEnabled: boolean;
  filterSharpenStrength: string;

  filterSubtitleEnabled: boolean;
  filterSubtitleSource: string;  // embedded, external
  filterSubtitleFile: string;
  filterSubtitleStreamIndex: number;
  filterSubtitleForceStyle: string;

  filterColorManagementEnabled: boolean;
  filterColorManagementPixelFormat: string;
  filterColorManagementColorSpace: string;
  filterColorManagementTransfer: string;
  filterColorManagementPrimaries: string;
  filterColorManagementRange: string;

  filterTransformEnabled: boolean;
  filterTransformRotation: string;
  filterTransformFlipH: boolean;
  filterTransformFlipV: boolean;

  // 音频编码
  audioEnabled: boolean;
  audioEncoder: string;
  audioBitrate: string;
  audioChannels: string;
  audioSampleRate: string;
  audioCodec: string;

  // 剪辑区间
  trimmingEnabled: boolean;
  trimmingStartTime: string;
  trimmingEndTime: string;

  // 流控制
  keepOtherVideoStreams: boolean;
  keepOtherAudioStreams: boolean;
  keepSubtitleStreams: boolean;
  keepAttachmentStreams: boolean;
  mapAll: boolean;

  // 自定义参数
  customPreParams: string;
  customVideoFilter: string;
  customAudioFilter: string;
  customVideoParams: string;
  customAudioParams: string;
  customPostParams: string;
  customFullCustom: string;
}

/**
 * 3FUI 预设文件格式
 */
export interface FFPresetFile3FUI {
  preset: FFPreset3FUI;
  exportDate: string;
  version: string;
  appVersion: string;
}

/**
 * 预设转换结果
 */
export interface ConversionResult {
  presetName: string;
  data: FFmpegPreset;
  warnings: string[];
}

/**
 * 预设转换器类
 */
export class PresetConverter {
  /**
   * 从 3FUI 格式转换为 Rebebuca 格式
   */
  convertFrom3FUI(content: string): ConversionResult | null {
    try {
      let preset3fui: FFPresetFile3FUI;

      // 尝试解析为 JSON
      if (content.trim().startsWith('{')) {
        preset3fui = JSON.parse(content);
      }
      // 尝试解析为 XML (如果 3FUI 使用 XML 格式)
      else if (content.trim().startsWith('<')) {
        preset3fui = this.parseXMLTo3FUI(content);
      }
      // 尝试解析为自定义格式
      else {
        preset3fui = this.parseCustomFormat(content);
      }

      if (!preset3fui || !preset3fui.preset) {
        return null;
      }

      const warnings: string[] = [];
      const preset: FFmpegPreset = this.map3FUIToRebebuca(preset3fui.preset, warnings);

      return {
        presetName: preset3fui.preset.presetName || 'Imported Preset',
        data: preset,
        warnings
      };
    } catch (error) {
      console.error('Failed to convert from 3FUI:', error);
      return null;
    }
  }

  /**
   * 从 Rebebuca 格式转换为 3FUI 格式
   */
  convertTo3FUI(packedPreset: PackedPreset): string {
    const preset: FFPreset3FUI = this.mapRebebucaTo3FUI(packedPreset.preset, packedPreset);

    const presetFile: FFPresetFile3FUI = {
      preset,
      exportDate: new Date().toISOString(),
      version: '1.0',
      appVersion: 'Rebebuca 1.0.0'
    };

    return JSON.stringify(presetFile, null, 2);
  }

  /**
   * 将 3FUI 预设映射为 Rebebuca 预设
   */
  private map3FUIToRebebuca(preset3fui: FFPreset3FUI, warnings: string[]): FFmpegPreset {
    const preset: FFmpegPreset = {
      // 输出配置
      output: {
        container: this.normalizeContainer(preset3fui.outputContainer),
        naming: {
          useAutoNaming: true,
          autoNamingOption: 0,
          prefix: '',
          suffix: 'encoded',
          customPattern: ''
        },
        location: preset3fui.outputLocation
      },

      // 解码参数（3FUI 可能没有这些字段，使用默认值）
      decoder: {
        decoder: 'auto',
        hwaccel: 'auto',
        hwaccelDevice: ''
      },

      // 视频编码器
      video: {
        enabled: true,
        encoderCategory: this.normalizeEncoderCategory(preset3fui.videoEncoderCategory),
        encoder: this.normalizeEncoder(preset3fui.videoEncoder),
        preset: this.normalizePreset(preset3fui.videoPreset),
        profile: this.normalizeProfile(preset3fui.videoProfile),
        level: this.normalizeLevel(preset3fui.videoLevel),
        tune: this.normalizeTune(preset3fui.videoTune),
        passMode: preset3fui.videoPassMode
      },

      // 质量控制
      quality: {
        controlMode: this.normalizeQualityMode(preset3fui.qualityControlMode),
        paramName: this.normalizeQualityParam(preset3fui.qualityControlMode),
        value: preset3fui.qualityValue || '23',
        bitrate: {
          base: preset3fui.qualityBitrate || '5M',
          min: preset3fui.qualityBitrateMin || undefined,
          max: preset3fui.qualityBitrateMax || undefined,
          bufferSize: preset3fui.qualityBufferSize || undefined
        }
      },

      // 视频滤镜
      filters: {
        crop: preset3fui.filterCropEnabled ? {
          enabled: true,
          width: preset3fui.filterCropW || 'iw',
          height: preset3fui.filterCropH || 'ih',
          x: preset3fui.filterCropX || '0',
          y: preset3fui.filterCropY || '0'
        } : undefined,

        scale: preset3fui.filterScaleEnabled ? {
          enabled: true,
          width: preset3fui.filterScaleW || '-1',
          height: preset3fui.filterScaleH || '-1',
          keepAspect: preset3fui.filterScaleKeepAspect,
          algorithm: preset3fui.filterScaleAlgorithm || 'bicubic'
        } : undefined,

        framerate: preset3fui.filterFramerateEnabled ? {
          enabled: true,
          fps: preset3fui.filterFramerateFPS || '30',
          mode: preset3fui.filterFramerateMode
        } : undefined,

        deinterlace: preset3fui.filterDeinterlaceEnabled ? {
          enabled: true,
          mode: preset3fui.filterDeinterlaceMode
        } : undefined,

        denoise: preset3fui.filterDenoiseEnabled ? {
          enabled: true,
          mode: preset3fui.filterDenoiseMode || 'nlmeans',
          strength: preset3fui.filterDenoiseStrength || '5'
        } : undefined,

        sharpen: preset3fui.filterSharpenEnabled ? {
          enabled: true,
          strength: preset3fui.filterSharpenStrength || '1.5'
        } : undefined,

        subtitle: preset3fui.filterSubtitleEnabled ? {
          enabled: true,
          source: preset3fui.filterSubtitleSource as 'embedded' | 'external',
          file: preset3fui.filterSubtitleFile,
          streamIndex: preset3fui.filterSubtitleStreamIndex,
          styling: {
            forceStyle: preset3fui.filterSubtitleForceStyle
          }
        } : undefined,

        colorManagement: preset3fui.filterColorManagementEnabled ? {
          enabled: true,
          pixelFormat: preset3fui.filterColorManagementPixelFormat || 'yuv420p',
          colorSpace: preset3fui.filterColorManagementColorSpace || 'bt709',
          transfer: preset3fui.filterColorManagementTransfer || 'bt709',
          primaries: preset3fui.filterColorManagementPrimaries || 'bt709',
          range: preset3fui.filterColorManagementRange || undefined
        } : undefined,

        transform: preset3fui.filterTransformEnabled ? {
          enabled: true,
          rotation: preset3fui.filterTransformRotation || '0',
          flipH: preset3fui.filterTransformFlipH,
          flipV: preset3fui.filterTransformFlipV
        } : undefined
      },

      // 音频编码
      audio: {
        enabled: preset3fui.audioEnabled,
        encoder: this.normalizeAudioEncoder(preset3fui.audioEncoder),
        bitrate: preset3fui.audioBitrate || '192k',
        channels: preset3fui.audioChannels || '2',
        sampleRate: preset3fui.audioSampleRate || '48000',
        codec: preset3fui.audioCodec || undefined
      },

      // 剪辑区间
      trimming: {
        enabled: preset3fui.trimmingEnabled,
        startTime: preset3fui.trimmingStartTime || '00:00:00.000',
        endTime: preset3fui.trimmingEndTime || '00:00:00.000'
      },

      // 流控制
      streamControl: {
        keepOtherVideoStreams: preset3fui.keepOtherVideoStreams,
        keepOtherAudioStreams: preset3fui.keepOtherAudioStreams,
        keepSubtitleStreams: preset3fui.keepSubtitleStreams,
        keepAttachmentStreams: preset3fui.keepAttachmentStreams,
        mapAll: preset3fui.mapAll
      },

      // 自定义参数
      custom: {
        preParams: preset3fui.customPreParams || '',
        videoFilter: preset3fui.customVideoFilter || '',
        audioFilter: preset3fui.customAudioFilter || '',
        videoParams: preset3fui.customVideoParams || '',
        audioParams: preset3fui.customAudioParams || '',
        postParams: preset3fui.customPostParams || '',
        fullCustom: preset3fui.customFullCustom || ''
      }
    };

    return preset;
  }

  /**
   * 将 Rebebuca 预设映射为 3FUI 预设
   */
  private mapRebebucaTo3FUI(preset: FFmpegPreset, metadata: PackedPreset): FFPreset3FUI {
    return {
      presetName: metadata.name,
      version: '1.0',

      // 输出配置
      outputContainer: preset.output.container,
      outputLocation: preset.output.location || '',

      // 视频编码器
      videoEncoderCategory: preset.video.encoderCategory,
      videoEncoder: preset.video.encoder,
      videoPreset: preset.video.preset,
      videoProfile: preset.video.profile,
      videoLevel: preset.video.level,
      videoTune: preset.video.tune,
      videoPassMode: preset.video.passMode,

      // 质量控制
      qualityControlMode: preset.quality.controlMode,
      qualityValue: preset.quality.value,
      qualityBitrate: preset.quality.bitrate.base,
      qualityBitrateMin: preset.quality.bitrate.min || '',
      qualityBitrateMax: preset.quality.bitrate.max || '',
      qualityBufferSize: preset.quality.bitrate.bufferSize || '',

      // 视频滤镜
      filterCropEnabled: preset.filters.crop?.enabled || false,
      filterCropW: preset.filters.crop?.width || 'iw',
      filterCropH: preset.filters.crop?.height || 'ih',
      filterCropX: preset.filters.crop?.x || '0',
      filterCropY: preset.filters.crop?.y || '0',

      filterScaleEnabled: preset.filters.scale?.enabled || false,
      filterScaleW: preset.filters.scale?.width || '-1',
      filterScaleH: preset.filters.scale?.height || '-1',
      filterScaleKeepAspect: preset.filters.scale?.keepAspect || false,
      filterScaleAlgorithm: preset.filters.scale?.algorithm || 'bicubic',

      filterFramerateEnabled: preset.filters.framerate?.enabled || false,
      filterFramerateFPS: preset.filters.framerate?.fps || '30',
      filterFramerateMode: preset.filters.framerate?.mode || 0,

      filterDeinterlaceEnabled: preset.filters.deinterlace?.enabled || false,
      filterDeinterlaceMode: preset.filters.deinterlace?.mode || 0,

      filterDenoiseEnabled: preset.filters.denoise?.enabled || false,
      filterDenoiseMode: preset.filters.denoise?.mode || 'nlmeans',
      filterDenoiseStrength: preset.filters.denoise?.strength || '5',

      filterSharpenEnabled: preset.filters.sharpen?.enabled || false,
      filterSharpenStrength: preset.filters.sharpen?.strength || '1.5',

      filterSubtitleEnabled: preset.filters.subtitle?.enabled || false,
      filterSubtitleSource: preset.filters.subtitle?.source || 'embedded',
      filterSubtitleFile: preset.filters.subtitle?.file || '',
      filterSubtitleStreamIndex: preset.filters.subtitle?.streamIndex || 0,
      filterSubtitleForceStyle: preset.filters.subtitle?.styling?.forceStyle || '',

      filterColorManagementEnabled: preset.filters.colorManagement?.enabled || false,
      filterColorManagementPixelFormat: preset.filters.colorManagement?.pixelFormat || 'yuv420p',
      filterColorManagementColorSpace: preset.filters.colorManagement?.colorSpace || 'bt709',
      filterColorManagementTransfer: preset.filters.colorManagement?.transfer || 'bt709',
      filterColorManagementPrimaries: preset.filters.colorManagement?.primaries || 'bt709',
      filterColorManagementRange: preset.filters.colorManagement?.range || '',

      filterTransformEnabled: preset.filters.transform?.enabled || false,
      filterTransformRotation: preset.filters.transform?.rotation || '0',
      filterTransformFlipH: preset.filters.transform?.flipH || false,
      filterTransformFlipV: preset.filters.transform?.flipV || false,

      // 音频编码
      audioEnabled: preset.audio.enabled,
      audioEncoder: preset.audio.encoder,
      audioBitrate: preset.audio.bitrate,
      audioChannels: preset.audio.channels,
      audioSampleRate: preset.audio.sampleRate,
      audioCodec: preset.audio.codec || '',

      // 剪辑区间
      trimmingEnabled: preset.trimming.enabled,
      trimmingStartTime: preset.trimming.startTime,
      trimmingEndTime: preset.trimming.endTime,

      // 流控制
      keepOtherVideoStreams: preset.streamControl.keepOtherVideoStreams,
      keepOtherAudioStreams: preset.streamControl.keepOtherAudioStreams,
      keepSubtitleStreams: preset.streamControl.keepSubtitleStreams,
      keepAttachmentStreams: preset.streamControl.keepAttachmentStreams,
      mapAll: preset.streamControl.mapAll || false,

      // 自定义参数
      customPreParams: preset.custom.preParams,
      customVideoFilter: preset.custom.videoFilter,
      customAudioFilter: preset.custom.audioFilter,
      customVideoParams: preset.custom.videoParams,
      customAudioParams: preset.custom.audioParams,
      customPostParams: preset.custom.postParams,
      customFullCustom: preset.custom.fullCustom
    };
  }

  /**
   * 解析 XML 格式的 3FUI 预设
   */
  private parseXMLTo3FUI(content: string): FFPresetFile3FUI {
    // 简化的 XML 解析逻辑
    // 实际实现需要根据 3FUI 的 XML 格式进行调整
    throw new Error('XML format not yet implemented');
  }

  /**
   * 解析自定义格式的 3FUI 预设
   */
  private parseCustomFormat(content: string): FFPresetFile3FUI {
    // 简化的自定义格式解析逻辑
    // 实际实现需要根据 3FUI 的自定义格式进行调整
    const lines = content.split('\n');
    const preset: any = { preset: {} };

    for (const line of lines) {
      const match = line.match(/^(\w+)=(.*)$/);
      if (match) {
        const [, key, value] = match;
        preset.preset[key] = this.parseValue(value);
      }
    }

    return preset as FFPresetFile3FUI;
  }

  /**
   * 解析值
   */
  private parseValue(value: string): any {
    // 布尔值
    if (value.toLowerCase() === 'true') return true;
    if (value.toLowerCase() === 'false') return false;

    // 数字
    const num = Number(value);
    if (!isNaN(num)) return num;

    // 字符串
    return value;
  }

  /**
   * 规范化容器格式
   */
  private normalizeContainer(container: string): string {
    return container.toLowerCase().replace('.', '');
  }

  /**
   * 规范化编码器类别
   */
  private normalizeEncoderCategory(category: string): string {
    return category.toLowerCase();
  }

  /**
   * 规范化编码器
   */
  private normalizeEncoder(encoder: string): string {
    return encoder.toLowerCase();
  }

  /**
   * 规范化编码预设
   */
  private normalizePreset(preset: string): string {
    return preset.toLowerCase();
  }

  /**
   * 规范化 Profile
   */
  private normalizeProfile(profile: string): string {
    return profile.toLowerCase();
  }

  /**
   * 规范化 Level
   */
  private normalizeLevel(level: string): string {
    return level;
  }

  /**
   * 规范化 Tune
   */
  private normalizeTune(tune: string): string {
    return tune.toLowerCase();
  }

  /**
   * 规范化质量控制模式
   */
  private normalizeQualityMode(mode: string): FFmpegPreset['quality']['controlMode'] {
    const normalized = mode.toUpperCase();
    switch (normalized) {
      case 'VBR':
        return 'VBR';
      case 'VBR_HQ':
        return 'VBR_HQ';
      case 'CQP':
        return 'CQP';
      case 'CBR':
        return 'CBR';
      case 'CRF':
      default:
        return 'CRF';
    }
  }

  /**
   * 规范化质量参数名
   */
  private normalizeQualityParam(mode: string): FFmpegPreset['quality']['paramName'] {
    const normalized = this.normalizeQualityMode(mode);
    switch (normalized) {
      case 'VBR':
      case 'VBR_HQ':
        return 'crf';
      case 'CQP':
        return 'cq';
      case 'CBR':
        return 'qp';
      case 'CRF':
      default:
        return 'crf';
    }
  }

  /**
   * 规范化音频编码器
   */
  private normalizeAudioEncoder(encoder: string): string {
    return encoder.toLowerCase();
  }
}

/**
 * 导出单例实例
 */
export const presetConverter = new PresetConverter();
