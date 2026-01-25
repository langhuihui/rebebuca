/**
 * CommandBuilder 单元测试
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { commandBuilder } from '../commandBuilder';
import type { FFmpegPreset } from '../../types/preset';

describe('CommandBuilder', () => {
  let defaultPreset: FFmpegPreset;

  beforeEach(() => {
    // 创建默认预设
    defaultPreset = {
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
  });

  describe('build', () => {
    it('应该生成基本的 H.264 编码命令', async () => {
      const command = await commandBuilder.build(
        defaultPreset,
        '/path/to/input.mp4'
      );

      expect(command).toContain('ffmpeg');
      expect(command).toContain('-i /path/to/input.mp4');
      expect(command).toContain('-c:v libx264');
      expect(command).toContain('-preset medium');
      expect(command).toContain('-crf 23');
      expect(command).toContain('-c:a aac');
      expect(command).toContain('-b:a 192k');
      expect(command).toContain('-ac 2');
      expect(command).toContain('-ar 48000');
    });

    it('应该支持自定义输出文件路径', async () => {
      const command = await commandBuilder.build(
        defaultPreset,
        '/path/to/input.mp4',
        '/path/to/output.mp4'
      );

      expect(command).toContain('/path/to/output.mp4');
    });

    it('应该支持 H.265 编码', async () => {
      defaultPreset.video.encoderCategory = 'hevc';
      defaultPreset.video.encoder = 'libx265';
      defaultPreset.video.profile = 'main';
      defaultPreset.video.level = '5.0';

      const command = await commandBuilder.build(
        defaultPreset,
        '/path/to/input.mp4'
      );

      expect(command).toContain('-c:v libx265');
      expect(command).toContain('-profile:v main');
      expect(command).toContain('-level 5.0');
    });

    it('应该支持 Copy 模式', async () => {
      defaultPreset.video.encoder = 'copy';
      defaultPreset.audio.encoder = 'copy';

      const command = await commandBuilder.build(
        defaultPreset,
        '/path/to/input.mp4'
      );

      expect(command).toContain('-c:v copy');
      expect(command).toContain('-c:a copy');
      expect(command).not.toContain('-crf');
    });

    it('应该支持 Scale 滤镜', async () => {
      defaultPreset.filters.scale = {
        enabled: true,
        width: '1280',
        height: '720',
        keepAspect: true,
        algorithm: 'bicubic'
      };

      const command = await commandBuilder.build(
        defaultPreset,
        '/path/to/input.mp4'
      );

      expect(command).toContain('-vf');
      expect(command).toContain('scale=1280:720');
    });

    it('应该支持 Crop 滤镜', async () => {
      defaultPreset.filters.crop = {
        enabled: true,
        width: '1920',
        height: '1080',
        x: '0',
        y: '0'
      };

      const command = await commandBuilder.build(
        defaultPreset,
        '/path/to/input.mp4'
      );

      expect(command).toContain('-vf');
      expect(command).toContain('crop=1920:1080:0:0');
    });

    it('应该支持 FPS 滤镜', async () => {
      defaultPreset.filters.framerate = {
        enabled: true,
        fps: '30',
        mode: 0
      };

      const command = await commandBuilder.build(
        defaultPreset,
        '/path/to/input.mp4'
      );

      expect(command).toContain('-vf');
      expect(command).toContain('fps=30');
    });

    it('应该支持剪辑区间', async () => {
      defaultPreset.trimming.enabled = true;
      defaultPreset.trimming.startTime = '00:00:10.000';
      defaultPreset.trimming.endTime = '00:01:00.000';

      const command = await commandBuilder.build(
        defaultPreset,
        '/path/to/input.mp4'
      );

      expect(command).toContain('-ss 10');
      expect(command).toContain('-t 50');
    });

    it('应该支持 VBR 质量控制', async () => {
      defaultPreset.quality.controlMode = 'VBR';
      defaultPreset.quality.value = '25';
      defaultPreset.quality.bitrate = {
        base: '5M',
        min: '3M',
        max: '8M',
        bufferSize: '16M'
      };

      const command = await commandBuilder.build(
        defaultPreset,
        '/path/to/input.mp4'
      );

      expect(command).toContain('-cq 25');
      expect(command).toContain('-b:v 5M');
      expect(command).toContain('-minrate 3M');
      expect(command).toContain('-maxrate 8M');
      expect(command).toContain('-bufsize 16M');
    });

    it('应该支持自定义命令', async () => {
      defaultPreset.custom.fullCustom = 'ffmpeg -i input.mp4 -c:v libx264 -preset fast output.mp4';

      const command = await commandBuilder.build(
        defaultPreset,
        '/path/to/input.mp4'
      );

      expect(command).toBe(defaultPreset.custom.fullCustom);
    });

    it('应该正确转义包含空格的文件路径', async () => {
      const command = await commandBuilder.build(
        defaultPreset,
        '/path/to/my video file.mp4'
      );

      expect(command).toContain('"/path/to/my video file.mp4"');
    });
  });

  describe('buildBatch', () => {
    it('应该批量生成命令', async () => {
      const inputFiles = [
        '/path/to/video1.mp4',
        '/path/to/video2.mp4',
        '/path/to/video3.mp4'
      ];

      const commands = await commandBuilder.buildBatch(
        defaultPreset,
        inputFiles
      );

      expect(commands).toHaveLength(3);
      expect(commands[0]).toContain('/path/to/video1.mp4');
      expect(commands[1]).toContain('/path/to/video2.mp4');
      expect(commands[2]).toContain('/path/to/video3.mp4');
    });
  });

  describe('validateCommand', () => {
    it('应该验证有效的预设', () => {
      const result = commandBuilder.validateCommand(defaultPreset);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('应该检测无效的容器', () => {
      defaultPreset.output.container = 'invalid';

      const result = commandBuilder.validateCommand(defaultPreset);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'INVALID_CONTAINER')).toBe(true);
    });

    it('应该检测无效的编码器', () => {
      defaultPreset.video.encoder = 'invalid_encoder';

      const result = commandBuilder.validateCommand(defaultPreset);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'INVALID_VIDEO_ENCODER')).toBe(true);
    });

    it('应该检测 CRF 超出范围', () => {
      defaultPreset.quality.value = '60';

      const result = commandBuilder.validateCommand(defaultPreset);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'CRF_OUT_OF_RANGE')).toBe(true);
    });
  });
});
