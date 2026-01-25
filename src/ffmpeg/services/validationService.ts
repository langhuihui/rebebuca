/**
 * 验证服务
 * 验证 FFmpeg 预设配置的有效性
 */

import type { FFmpegPreset } from '../types/preset';
import { encoderDatabase } from './encoderDatabase';
import { validateTimeString, validateFilePath, parseBitrate } from '../utils';

/**
 * 验证结果
 */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

/**
 * 验证错误
 */
export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

/**
 * 验证警告
 */
export interface ValidationWarning {
  field: string;
  message: string;
  code: string;
}

export class ValidationService {
  /**
   * 验证完整预设
   */
  validatePreset(preset: FFmpegPreset): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // 验证输出配置
    this.validateOutputConfig(preset, errors, warnings);

    // 验证解码器配置
    this.validateDecoderConfig(preset, errors, warnings);

    // 验证视频配置
    this.validateVideoConfig(preset, errors, warnings);

    // 验证质量控制
    this.validateQualityConfig(preset, errors, warnings);

    // 验证音频配置
    this.validateAudioConfig(preset, errors, warnings);

    // 验证剪辑配置
    this.validateTrimmingConfig(preset, errors, warnings);

    // 验证滤镜配置
    this.validateFiltersConfig(preset, errors, warnings);

    // 验证自定义参数
    this.validateCustomConfig(preset, errors, warnings);

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * 验证输出配置
   */
  private validateOutputConfig(
    preset: FFmpegPreset,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    // 验证容器
    const containers = encoderDatabase.getContainers();
    if (!containers.includes(preset.output.container)) {
      errors.push({
        field: 'output.container',
        message: `不支持的容器格式: ${preset.output.container}`,
        code: 'INVALID_CONTAINER'
      });
    }

    // 验证输出位置
    if (preset.output.location && !validateFilePath(preset.output.location)) {
      errors.push({
        field: 'output.location',
        message: '无效的输出路径',
        code: 'INVALID_OUTPUT_PATH'
      });
    }
  }

  /**
   * 验证解码器配置
   */
  private validateDecoderConfig(
    preset: FFmpegPreset,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    // 解码器配置通常是可选的，一般不验证
  }

  /**
   * 验证视频配置
   */
  private validateVideoConfig(
    preset: FFmpegPreset,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    if (!preset.video.enabled) {
      return;
    }

    // 验证视频编码器
    const videoEncoder = encoderDatabase.getVideoEncoder(preset.video.encoder);
    if (!videoEncoder) {
      errors.push({
        field: 'video.encoder',
        message: `不支持的视频编码器: ${preset.video.encoder}`,
        code: 'INVALID_VIDEO_ENCODER'
      });
      return;
    }

    // 验证预设
    if (videoEncoder.presets && !videoEncoder.presets.includes(preset.video.preset)) {
      errors.push({
        field: 'video.preset',
        message: `编码器 ${preset.video.encoder} 不支持预设: ${preset.video.preset}`,
        code: 'INVALID_VIDEO_PRESET'
      });
    }

    // 验证配置文件
    if (videoEncoder.profiles && preset.video.profile &&
        !videoEncoder.profiles.includes(preset.video.profile)) {
      errors.push({
        field: 'video.profile',
        message: `编码器 ${preset.video.encoder} 不支持配置文件: ${preset.video.profile}`,
        code: 'INVALID_VIDEO_PROFILE'
      });
    }

    // 验证级别
    if (videoEncoder.levels && preset.video.level &&
        !videoEncoder.levels.includes(preset.video.level)) {
      errors.push({
        field: 'video.level',
        message: `编码器 ${preset.video.encoder} 不支持级别: ${preset.video.level}`,
        code: 'INVALID_VIDEO_LEVEL'
      });
    }

    // 验证调整参数
    if (videoEncoder.tunes && preset.video.tune &&
        !videoEncoder.tunes.includes(preset.video.tune)) {
      warnings.push({
        field: 'video.tune',
        message: `编码器 ${preset.video.encoder} 可能不支持调整参数: ${preset.video.tune}`,
        code: 'UNKNOWN_VIDEO_TUNE'
      });
    }

    // 验证编码器是否支持容器
    if (!encoderDatabase.isVideoEncoderSupported(
      preset.video.encoder,
      preset.output.container
    )) {
      errors.push({
        field: 'video.encoder',
        message: `编码器 ${preset.video.encoder} 不支持容器 ${preset.output.container}`,
        code: 'ENCODER_CONTAINER_MISMATCH'
      });
    }
  }

  /**
   * 验证质量控制
   */
  private validateQualityConfig(
    preset: FFmpegPreset,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    if (!preset.video.enabled) {
      return;
    }

    const videoEncoder = encoderDatabase.getVideoEncoder(preset.video.encoder);
    if (!videoEncoder) {
      return;
    }

    // 验证质量控制模式
    if (videoEncoder.qualityModes &&
        !videoEncoder.qualityModes.includes(preset.quality.controlMode)) {
      errors.push({
        field: 'quality.controlMode',
        message: `编码器 ${preset.video.encoder} 不支持质量控制模式: ${preset.quality.controlMode}`,
        code: 'INVALID_QUALITY_MODE'
      });
    }

    // 验证质量值
    const qualityValue = parseFloat(preset.quality.value);
    if (isNaN(qualityValue) || qualityValue < 0) {
      errors.push({
        field: 'quality.value',
        message: '质量值必须是有效的数字且大于等于 0',
        code: 'INVALID_QUALITY_VALUE'
      });
    }

    // CRF 值范围检查
    if (preset.quality.controlMode === 'CRF') {
      if (qualityValue < 0 || qualityValue > 51) {
        errors.push({
          field: 'quality.value',
          message: 'CRF 值必须在 0 到 51 之间',
          code: 'CRF_OUT_OF_RANGE'
        });
      }
    }

    // 验证比特率
    const bitrate = parseBitrate(preset.quality.bitrate.base);
    if (isNaN(bitrate) || bitrate <= 0) {
      errors.push({
        field: 'quality.bitrate.base',
        message: '无效的比特率格式',
        code: 'INVALID_BITRATE'
      });
    }
  }

  /**
   * 验证音频配置
   */
  private validateAudioConfig(
    preset: FFmpegPreset,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    if (!preset.audio.enabled) {
      return;
    }

    // 验证音频编码器
    const audioEncoder = encoderDatabase.getAudioEncoder(preset.audio.encoder);
    if (!audioEncoder) {
      errors.push({
        field: 'audio.encoder',
        message: `不支持的音频编码器: ${preset.audio.encoder}`,
        code: 'INVALID_AUDIO_ENCODER'
      });
      return;
    }

    // 验证比特率
    if (audioEncoder.bitrates && !audioEncoder.bitrates.includes(preset.audio.bitrate)) {
      warnings.push({
        field: 'audio.bitrate',
        message: `编码器 ${preset.audio.encoder} 可能不支持比特率: ${preset.audio.bitrate}`,
        code: 'UNKNOWN_AUDIO_BITRATE'
      });
    }

    // 验证声道数
    const channels = parseInt(preset.audio.channels);
    if (audioEncoder.channelCounts && !audioEncoder.channelCounts.includes(channels)) {
      warnings.push({
        field: 'audio.channels',
        message: `编码器 ${preset.audio.encoder} 可能不支持声道数: ${preset.audio.channels}`,
        code: 'UNKNOWN_AUDIO_CHANNELS'
      });
    }

    // 验证采样率
    const sampleRate = parseInt(preset.audio.sampleRate);
    if (audioEncoder.sampleRates && !audioEncoder.sampleRates.includes(sampleRate)) {
      warnings.push({
        field: 'audio.sampleRate',
        message: `编码器 ${preset.audio.encoder} 可能不支持采样率: ${preset.audio.sampleRate}`,
        code: 'UNKNOWN_AUDIO_SAMPLERATE'
      });
    }

    // 验证编码器是否支持容器
    if (!encoderDatabase.isAudioEncoderSupported(
      preset.audio.encoder,
      preset.output.container
    )) {
      errors.push({
        field: 'audio.encoder',
        message: `音频编码器 ${preset.audio.encoder} 不支持容器 ${preset.output.container}`,
        code: 'AUDIO_ENCODER_CONTAINER_MISMATCH'
      });
    }
  }

  /**
   * 验证剪辑配置
   */
  private validateTrimmingConfig(
    preset: FFmpegPreset,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    if (!preset.trimming.enabled) {
      return;
    }

    // 验证开始时间
    if (!validateTimeString(preset.trimming.startTime)) {
      errors.push({
        field: 'trimming.startTime',
        message: '无效的开始时间格式',
        code: 'INVALID_START_TIME'
      });
    }

    // 验证结束时间
    if (!validateTimeString(preset.trimming.endTime)) {
      errors.push({
        field: 'trimming.endTime',
        message: '无效的结束时间格式',
        code: 'INVALID_END_TIME'
      });
    }
  }

  /**
   * 验证滤镜配置
   */
  private validateFiltersConfig(
    preset: FFmpegPreset,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    const filters = preset.filters;

    // 验证裁剪滤镜
    if (filters.crop?.enabled) {
      if (!filters.crop.width || !filters.crop.height ||
          !filters.crop.x || !filters.crop.y) {
        errors.push({
          field: 'filters.crop',
          message: '裁剪滤镜参数不完整',
          code: 'INCOMPLETE_CROP_PARAMS'
        });
      }
    }

    // 验证缩放滤镜
    if (filters.scale?.enabled) {
      if (!filters.scale.width || !filters.scale.height) {
        errors.push({
          field: 'filters.scale',
          message: '缩放滤镜参数不完整',
          code: 'INCOMPLETE_SCALE_PARAMS'
        });
      }
    }

    // 验证帧率滤镜
    if (filters.framerate?.enabled) {
      const fps = parseFloat(filters.framerate.fps);
      if (isNaN(fps) || fps <= 0) {
        errors.push({
          field: 'filters.framerate.fps',
          message: '无效的帧率值',
          code: 'INVALID_FRAMERATE'
        });
      }
    }

    // 验证字幕滤镜
    if (filters.subtitle?.enabled) {
      if (filters.subtitle.source === 'external' && !filters.subtitle.file) {
        errors.push({
          field: 'filters.subtitle.file',
          message: '外部字幕源需要指定字幕文件路径',
          code: 'MISSING_SUBTITLE_FILE'
        });
      }
    }
  }

  /**
   * 验证自定义配置
   */
  private validateCustomConfig(
    preset: FFmpegPreset,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    // 完全自定义模式下，不做验证
    if (preset.custom.fullCustom) {
      warnings.push({
        field: 'custom.fullCustom',
        message: '使用完全自定义命令行，参数验证已跳过',
        code: 'CUSTOM_COMMAND_SKIP_VALIDATION'
      });
    }
  }

  /**
   * 快速验证（仅检查关键字段）
   */
  quickValidate(preset: FFmpegPreset): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // 基本验证：容器和编码器
    const containers = encoderDatabase.getContainers();
    if (!containers.includes(preset.output.container)) {
      errors.push({
        field: 'output.container',
        message: `不支持的容器格式: ${preset.output.container}`,
        code: 'INVALID_CONTAINER'
      });
    }

    if (preset.video.enabled) {
      const videoEncoder = encoderDatabase.getVideoEncoder(preset.video.encoder);
      if (!videoEncoder) {
        errors.push({
          field: 'video.encoder',
          message: `不支持的视频编码器: ${preset.video.encoder}`,
          code: 'INVALID_VIDEO_ENCODER'
        });
      }
    }

    if (preset.audio.enabled) {
      const audioEncoder = encoderDatabase.getAudioEncoder(preset.audio.encoder);
      if (!audioEncoder) {
        errors.push({
          field: 'audio.encoder',
          message: `不支持的音频编码器: ${preset.audio.encoder}`,
          code: 'INVALID_AUDIO_ENCODER'
        });
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }
}

// 导出单例
export const validationService = new ValidationService();
