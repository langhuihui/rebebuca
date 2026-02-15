/**
 * CommandBuilder 服务
 * 生成 FFmpeg 命令行
 */

import type { FFmpegPreset } from '../types/preset';
import { validationService, type ValidationResult } from './validationService';
import {
  escapePathForCommand,
  generateOutputPath,
  parseTime
} from '../utils';

export class CommandBuilder {
  /**
   * 构建完整的 FFmpeg 命令
   */
  async build(
    preset: FFmpegPreset,
    inputFile: string,
    outputFile?: string
  ): Promise<string> {
    // 如果是完全自定义命令，直接返回
    if (preset.custom.fullCustom) {
      return preset.custom.fullCustom;
    }

    const commandParts: string[] = ['ffmpeg'];

    // 添加输入前的参数
    if (preset.custom.preParams) {
      commandParts.push(preset.custom.preParams);
    }

    // 添加解码器参数
    this.addDecoderArgs(commandParts, preset);

    // 添加剪辑参数（输入前）
    this.addTrimmingArgs(commandParts, preset, true);

    // 添加输入文件
    commandParts.push('-i', escapePathForCommand(inputFile));

    // 添加字幕输入（如果是外部字幕）
    if (preset.filters.subtitle?.enabled && preset.filters.subtitle.source === 'external') {
      const subtitleFile = escapePathForCommand(preset.filters.subtitle.file!);
      commandParts.push('-i', subtitleFile);
    }

    // 添加视频编码参数
    this.addVideoArgs(commandParts, preset);

    // 添加音频编码参数
    this.addAudioArgs(commandParts, preset);

    // 添加视频滤镜
    this.addVideoFilters(commandParts, preset);

    // 添加音频滤镜
    if (preset.custom.audioFilter) {
      commandParts.push('-af', preset.custom.audioFilter);
    }

    // 添加元数据
    this.addMetadataArgs(commandParts, preset);

    // 添加流映射
    this.addStreamMapArgs(commandParts, preset);

    // 添加输出后的参数
    if (preset.custom.postParams) {
      commandParts.push(preset.custom.postParams);
    }

    // 生成输出文件路径
    const outputPath = outputFile || generateOutputPath(inputFile, preset);
    commandParts.push(escapePathForCommand(outputPath));

    return commandParts.join(' ');
  }

  /**
   * 批量构建命令
   */
  async buildBatch(
    preset: FFmpegPreset,
    inputFiles: string[],
    _outputDir?: string
  ): Promise<string[]> {
    const commands: string[] = [];

    for (const inputFile of inputFiles) {
      const command = await this.build(preset, inputFile);
      commands.push(command);
    }

    return commands;
  }

  /**
   * 验证命令
   */
  validateCommand(preset: FFmpegPreset): ValidationResult {
    return validationService.validatePreset(preset);
  }

  /**
   * 添加解码器参数
   */
  private addDecoderArgs(commandParts: string[], preset: FFmpegPreset): void {
    const decoder = preset.decoder;

    if (decoder.decoder && decoder.decoder !== 'auto') {
      commandParts.push(`-c:v ${decoder.decoder}`);
    }

    if (decoder.hwaccel && decoder.hwaccel !== 'auto') {
      commandParts.push(`-hwaccel ${decoder.hwaccel}`);

      if (decoder.hwaccelDevice) {
        commandParts.push(`-hwaccel_device ${decoder.hwaccelDevice}`);
      }
    }
  }

  /**
   * 添加视频编码参数
   */
  private addVideoArgs(commandParts: string[], preset: FFmpegPreset): void {
    const video = preset.video;

    if (!video.enabled) {
      // 如果不处理视频，使用 copy 模式
      commandParts.push('-c:v copy');
      return;
    }

    // 视频编码器
    if (video.encoder === 'copy') {
      commandParts.push('-c:v copy');
      return;
    }

    commandParts.push(`-c:v ${video.encoder}`);

    // 编码预设
    if (video.preset) {
      commandParts.push(`-preset ${video.preset}`);
    }

    // 配置文件
    if (video.profile) {
      commandParts.push(`-profile:v ${video.profile}`);
    }

    // 级别
    if (video.level) {
      commandParts.push(`-level ${video.level}`);
    }

    // 调整参数
    if (video.tune) {
      commandParts.push(`-tune ${video.tune}`);
    }

    // 二遍编码
    if (video.passMode === 1) {
      commandParts.push('-pass 1');
      commandParts.push('-f null');
      commandParts.push('-an'); // 首遍不编码音频
    } else if (video.passMode === 2) {
      commandParts.push('-pass 2');
    }

    // 质量控制
    this.addQualityArgs(commandParts, preset);

    // 像素格式（色彩管理）
    if (preset.filters.colorManagement?.enabled) {
      const color = preset.filters.colorManagement;
      commandParts.push(`-pix_fmt ${color.pixelFormat}`);
      commandParts.push(`-colorspace ${color.colorSpace}`);
      commandParts.push(`-color_trc ${color.transfer}`);
      commandParts.push(`-color_primaries ${color.primaries}`);
      if (color.range) {
        commandParts.push(`-color_range ${color.range}`);
      }
    } else {
      // 默认像素格式
      commandParts.push('-pix_fmt yuv420p');
    }

    // 自定义视频参数
    if (preset.custom.videoParams) {
      commandParts.push(preset.custom.videoParams);
    }
  }

  /**
   * 添加质量控制参数
   */
  private addQualityArgs(commandParts: string[], preset: FFmpegPreset): void {
    const quality = preset.quality;

    switch (quality.controlMode) {
      case 'CRF':
        commandParts.push(`-${quality.paramName} ${quality.value}`);
        break;

      case 'VBR':
        commandParts.push(`-${quality.paramName} ${quality.value}`);
        commandParts.push(`-b:v ${quality.bitrate.base}`);
        break;

      case 'VBR_HQ':
        commandParts.push(`-${quality.paramName} ${quality.value}`);
        commandParts.push(`-b:v ${quality.bitrate.base}`);
        if (quality.bitrate.min) {
          commandParts.push(`-minrate ${quality.bitrate.min}`);
        }
        if (quality.bitrate.max) {
          commandParts.push(`-maxrate ${quality.bitrate.max}`);
        }
        if (quality.bitrate.bufferSize) {
          commandParts.push(`-bufsize ${quality.bitrate.bufferSize}`);
        }
        break;

      case 'CQP':
        commandParts.push(`-${quality.paramName} ${quality.value}`);
        break;

      case 'CBR':
        commandParts.push(`-${quality.paramName} ${quality.value}`);
        commandParts.push(`-b:v ${quality.bitrate.base}`);
        if (quality.bitrate.min) {
          commandParts.push(`-minrate ${quality.bitrate.min}`);
        }
        if (quality.bitrate.max) {
          commandParts.push(`-maxrate ${quality.bitrate.max}`);
        }
        if (quality.bitrate.bufferSize) {
          commandParts.push(`-bufsize ${quality.bitrate.bufferSize}`);
        }
        break;
    }
  }

  /**
   * 添加音频编码参数
   */
  private addAudioArgs(commandParts: string[], preset: FFmpegPreset): void {
    const audio = preset.audio;

    if (!audio.enabled) {
      // 如果不处理音频，使用 copy 模式或忽略
      if (preset.streamControl.keepOtherAudioStreams) {
        // 保留音频流
      } else {
        commandParts.push('-an'); // 不包含音频
      }
      return;
    }

    // 音频编码器
    if (audio.encoder === 'copy') {
      commandParts.push('-c:a copy');
      return;
    }

    commandParts.push(`-c:a ${audio.encoder}`);

    // 比特率
    if (audio.bitrate) {
      commandParts.push(`-b:a ${audio.bitrate}`);
    }

    // 声道数
    if (audio.channels) {
      commandParts.push(`-ac ${audio.channels}`);
    }

    // 采样率
    if (audio.sampleRate) {
      commandParts.push(`-ar ${audio.sampleRate}`);
    }

    // 自定义音频参数
    if (preset.custom.audioParams) {
      commandParts.push(preset.custom.audioParams);
    }
  }

  /**
   * 添加视频滤镜
   */
  private addVideoFilters(commandParts: string[], preset: FFmpegPreset): void {
    const filters = preset.filters;
    const filterParts: string[] = [];

    // 自定义滤镜优先
    if (preset.custom.videoFilter) {
      commandParts.push('-vf', preset.custom.videoFilter);
      return;
    }

    // 裁剪滤镜
    if (filters.crop?.enabled) {
      filterParts.push(
        `crop=${filters.crop.width}:${filters.crop.height}:${filters.crop.x}:${filters.crop.y}`
      );
    }

    // 缩放滤镜
    if (filters.scale?.enabled) {
      const { width, height, keepAspect, algorithm } = filters.scale;
      if (keepAspect) {
        filterParts.push(`scale=${width}:${height}:force_original_aspect_ratio=decrease`);
      } else {
        filterParts.push(`scale=${width}:${height}`);
      }
      if (algorithm) {
        filterParts.push(`:flags=${algorithm}`);
      }
    }

    // 帧率滤镜
    if (filters.framerate?.enabled) {
      filterParts.push(`fps=${filters.framerate.fps}`);
    }

    // 去隔行滤镜
    if (filters.deinterlace?.enabled) {
      const modes = ['yadif', 'bwdif', 'yadif=1'];
      filterParts.push(modes[filters.deinterlace.mode] || 'yadif');
    }

    // 降噪滤镜
    if (filters.denoise?.enabled) {
      const { mode, strength } = filters.denoise;
      if (mode === 'nlmeans') {
        filterParts.push(`nlmeans=s=${strength}`);
      } else if (mode === 'hqdn3d') {
        // HQDN3D 参数: spatial:chroma:temporal
        const spatial = strength;
        const chroma = parseFloat(strength) * 0.8;
        const temporal = parseFloat(strength) * 1.2;
        filterParts.push(`hqdn3d=${spatial}:${chroma}:${temporal}`);
      }
    }

    // 锐化滤镜
    if (filters.sharpen?.enabled) {
      const { strength } = filters.sharpen;
      const luma = parseFloat(strength);
      const chroma = luma * 0.5;
      filterParts.push(`unsharp=luma=${luma}:luma_radius=5:chroma=${chroma}:chroma_radius=5`);
    }

    // 字幕烧录
    if (filters.subtitle?.enabled) {
      if (filters.subtitle.source === 'embedded') {
        // 内置字幕需要添加 stream 映射
        const styling = filters.subtitle.styling?.forceStyle || '';
        const stylingParam = styling ? `:force_style='${styling}'` : '';
        filterParts.push(`subtitles=v:${filters.subtitle.streamIndex}${stylingParam}`);
      } else if (filters.subtitle.source === 'external' && filters.subtitle.file) {
        const styling = filters.subtitle.styling?.forceStyle || '';
        const file = this.escapePathForFilter(filters.subtitle.file);
        const stylingParam = styling ? `:force_style='${styling}'` : '';
        filterParts.push(`subtitles=${file}${stylingParam}`);
      }
    }

    // 旋转/翻转
    if (filters.transform?.enabled) {
      const { rotation, flipH, flipV } = filters.transform;
      const transformParts: string[] = [];

      if (rotation !== '0') {
        // transpose 参数: 0=90°时钟, 1=90°逆时针, 2=180°, 3=270°
        const transposeValue = rotation === '90' ? 1 : rotation === '180' ? '1,transpose=1' : rotation === '270' ? 0 : 0;
        transformParts.push(`transpose=${transposeValue}`);
      }
      if (flipH) {
        transformParts.push('hflip');
      }
      if (flipV) {
        transformParts.push('vflip');
      }

      if (transformParts.length > 0) {
        filterParts.push(transformParts.join(','));
      }
    }

    // 插帧滤镜（扩展功能）
    const interframe = (filters as any).interframe;
    if (interframe?.enabled && interframe.targetFps) {
      // 使用 minterpolate 滤镜进行插帧
      // 参数: fps=目标帧率:mi_mode=mcblend_extrafast:me_mode=bidirpel:vsbmc=1
      filterParts.push(
        `minterpolate=fps=${interframe.targetFps}:mi_mode=mcblend:me_mode=bidirpel:vsbmc=1`
      );
    }

    // 组合所有滤镜
    if (filterParts.length > 0) {
      commandParts.push('-vf', filterParts.join(','));
    }
  }

  /**
   * 转义滤镜路径
   */
  private escapePathForFilter(path: string): string {
    // 对于滤镜中的路径，需要特殊处理转义
    // Windows 路径需要将反斜杠替换为正斜杠
    return path.replace(/\\/g, '/');
  }

  /**
   * 添加剪辑参数
   */
  private addTrimmingArgs(commandParts: string[], preset: FFmpegPreset, isInput: boolean): void {
    const trimming = preset.trimming;

    if (!trimming.enabled) {
      return;
    }

    const startTime = parseTime(trimming.startTime);
    const endTime = parseTime(trimming.endTime);

    if (isInput) {
      // 输入参数：-ss 放在 -i 之前
      if (startTime > 0) {
        commandParts.push(`-ss ${startTime}`);
      }
      if (endTime > 0) {
        const duration = endTime - startTime;
        commandParts.push(`-t ${duration}`);
      }
    } else {
      // 输出参数：-to 放在 -i 之后
      if (endTime > 0) {
        commandParts.push(`-to ${endTime}`);
      }
    }
  }

  /**
   * 添加元数据参数
   */
  private addMetadataArgs(commandParts: string[], preset: FFmpegPreset): void {
    const metadata = preset.metadata;

    if (!metadata) {
      return;
    }

    if (metadata.title) {
      commandParts.push(`-metadata title="${metadata.title}"`);
    }
    if (metadata.artist) {
      commandParts.push(`-metadata artist="${metadata.artist}"`);
    }
    if (metadata.album) {
      commandParts.push(`-metadata album="${metadata.album}"`);
    }
    if (metadata.year) {
      commandParts.push(`-metadata year="${metadata.year}"`);
    }
    if (metadata.comment) {
      commandParts.push(`-metadata comment="${metadata.comment}"`);
    }
  }

  /**
   * 添加流映射参数
   */
  private addStreamMapArgs(commandParts: string[], preset: FFmpegPreset): void {
    const streamControl = preset.streamControl;

    if (streamControl.mapAll) {
      // 映射所有流
      commandParts.push('-map 0');
      return;
    }

    // 默认行为：映射第一个视频流和第一个音频流
    commandParts.push('-map 0:v:0');
    if (preset.audio.enabled && preset.audio.encoder !== 'copy') {
      commandParts.push('-map 0:a:0');
    }

    // 保留字幕流
    if (streamControl.keepSubtitleStreams) {
      commandParts.push('-map 0:s?');
    }

    // 保留附件流
    if (streamControl.keepAttachmentStreams) {
      commandParts.push('-map 0:d?');
    }
  }

  /**
   * 生成输出文件路径
   */
  generateOutputPath(inputFile: string, preset: FFmpegPreset, outputFile?: string): string {
    return generateOutputPath(inputFile, preset, outputFile);
  }
}

// 导出单例
export const commandBuilder = new CommandBuilder();
