/**
 * 编码器类型定义
 */

import type { FFmpegPreset } from './preset';

/**
 * 编码器类别
 */
export type EncoderCategory =
  | 'h264'
  | 'hevc'
  | 'av1'
  | 'vp9'
  | 'mpeg2'
  | 'mpeg4'
  | 'prores'
  | 'dnxhd'
  | 'ffv1'
  | 'copy';

/**
 * 编码器信息
 */
export interface EncoderInfo {
  id: string;                // 编码器 ID
  category: EncoderCategory;   // 类别
  name: string;              // 显示名称
  ffmpegName: string;        // FFmpeg 编码器名称
  description?: string;       // 描述

  // 支持的预设
  presets?: string[];         // 例如: ['ultrafast', 'fast', 'medium', 'slow', 'veryslow']

  // 支持的配置文件
  profiles?: string[];        // 例如: ['baseline', 'main', 'high', 'high10']

  // 支持的级别
  levels?: string[];          // 例如: ['3.0', '3.1', '4.0', '4.1', '4.2']

  // 支持的调整参数
  tunes?: string[];           // 例如: ['film', 'animation', 'grain', 'stillimage']

  // 质量控制方式
  qualityModes?: ('CRF' | 'VBR' | 'VBR_HQ' | 'CQP' | 'CBR')[];

  // 硬件加速支持
  hwaccel?: string[];         // 支持的硬件加速

  // 是否支持二遍编码
  supportsPassEncoding?: boolean;

  // 是否支持色彩管理
  supportsColorManagement?: boolean;

  // 推荐预设配置
  recommendedSettings?: Partial<FFmpegPreset>;
}

/**
 * 音频编码器类别
 */
export type AudioEncoderCategory =
  | 'aac'
  | 'opus'
  | 'mp3'
  | 'flac'
  | 'vorbis'
  | 'ac3'
  | 'eac3'
  | 'dts'
  | 'copy';

/**
 * 音频编码器信息
 */
export interface AudioEncoderInfo {
  id: string;
  category: AudioEncoderCategory;
  name: string;
  ffmpegName: string;
  description?: string;

  // 支持的比特率
  bitrates?: string[];       // 例如: ['64k', '128k', '192k', '256k', '320k']

  // 支持的声道数
  channelCounts?: number[];   // 例如: [1, 2, 6]

  // 支持的采样率
  sampleRates?: number[];      // 例如: [44100, 48000, 96000]

  // 是否支持 VBR
  supportsVBR?: boolean;

  // 推荐预设配置
  recommendedSettings?: Partial<FFmpegPreset>;
}
