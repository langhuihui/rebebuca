/**
 * 预设转换器单元测试
 */

import { describe, it, expect } from 'vitest';
import { presetConverter } from '../presetConverter';
import type { FFmpegPreset, PackedPreset } from '../../types/preset';

describe('PresetConverter', () => {
  describe('convertFrom3FUI', () => {
    it('应该正确转换 3FUI JSON 格式', () => {
      const preset3fui = {
        preset: {
          presetName: 'Test Preset',
          version: '1.0',
          outputContainer: 'mp4',
          outputLocation: '',
          videoEncoderCategory: 'h264',
          videoEncoder: 'libx264',
          videoPreset: 'medium',
          videoProfile: 'high',
          videoLevel: '4.0',
          videoTune: '',
          videoPassMode: 0,
          qualityControlMode: 'CRF',
          qualityValue: '23',
          qualityBitrate: '5M',
          qualityBitrateMin: '',
          qualityBitrateMax: '',
          qualityBufferSize: '',
          filterCropEnabled: false,
          filterCropW: 'iw',
          filterCropH: 'ih',
          filterCropX: '0',
          filterCropY: '0',
          filterScaleEnabled: false,
          filterScaleW: '-1',
          filterScaleH: '-1',
          filterScaleKeepAspect: false,
          filterScaleAlgorithm: 'bicubic',
          filterFramerateEnabled: false,
          filterFramerateFPS: '30',
          filterFramerateMode: 0,
          filterDeinterlaceEnabled: false,
          filterDeinterlaceMode: 0,
          filterDenoiseEnabled: false,
          filterDenoiseMode: 'nlmeans',
          filterDenoiseStrength: '5',
          filterSharpenEnabled: false,
          filterSharpenStrength: '1.5',
          filterSubtitleEnabled: false,
          filterSubtitleSource: 'embedded',
          filterSubtitleFile: '',
          filterSubtitleStreamIndex: 0,
          filterSubtitleForceStyle: '',
          filterColorManagementEnabled: false,
          filterColorManagementPixelFormat: 'yuv420p',
          filterColorManagementColorSpace: 'bt709',
          filterColorManagementTransfer: 'bt709',
          filterColorManagementPrimaries: 'bt709',
          filterColorManagementRange: '',
          filterTransformEnabled: false,
          filterTransformRotation: '0',
          filterTransformFlipH: false,
          filterTransformFlipV: false,
          audioEnabled: true,
          audioEncoder: 'aac',
          audioBitrate: '192k',
          audioChannels: '2',
          audioSampleRate: '48000',
          audioCodec: '',
          trimmingEnabled: false,
          trimmingStartTime: '00:00:00.000',
          trimmingEndTime: '00:00:00.000',
          keepOtherVideoStreams: false,
          keepOtherAudioStreams: false,
          keepSubtitleStreams: true,
          keepAttachmentStreams: false,
          mapAll: false,
          customPreParams: '',
          customVideoFilter: '',
          customAudioFilter: '',
          customVideoParams: '',
          customAudioParams: '',
          customPostParams: '',
          customFullCustom: ''
        },
        exportDate: new Date().toISOString(),
        version: '1.0',
        appVersion: 'Rebebuca 1.0.0'
      };

      const result = presetConverter.convertFrom3FUI(JSON.stringify(preset3fui));

      expect(result).not.toBeNull();
      expect(result?.presetName).toBe('Test Preset');
      expect(result?.data.output.container).toBe('mp4');
      expect(result?.data.video.encoder).toBe('libx264');
      expect(result?.data.quality.controlMode).toBe('CRF');
      expect(result?.data.quality.value).toBe('23');
    });

    it('应该正确处理启用的滤镜', () => {
      const preset3fui = {
        preset: {
          presetName: 'Test with Filters',
          version: '1.0',
          outputContainer: 'mp4',
          outputLocation: '',
          videoEncoderCategory: 'h264',
          videoEncoder: 'libx264',
          videoPreset: 'medium',
          videoProfile: 'high',
          videoLevel: '4.0',
          videoTune: '',
          videoPassMode: 0,
          qualityControlMode: 'CRF',
          qualityValue: '23',
          qualityBitrate: '5M',
          qualityBitrateMin: '',
          qualityBitrateMax: '',
          qualityBufferSize: '',
          filterCropEnabled: true,
          filterCropW: '1920',
          filterCropH: '1080',
          filterCropX: '0',
          filterCropY: '0',
          filterScaleEnabled: true,
          filterScaleW: '1280',
          filterScaleH: '720',
          filterScaleKeepAspect: true,
          filterScaleAlgorithm: 'lanczos',
          filterFramerateEnabled: true,
          filterFramerateFPS: '30',
          filterFramerateMode: 0,
          filterDeinterlaceEnabled: false,
          filterDeinterlaceMode: 0,
          filterDenoiseEnabled: true,
          filterDenoiseMode: 'nlmeans',
          filterDenoiseStrength: '5',
          filterSharpenEnabled: true,
          filterSharpenStrength: '1.5',
          filterSubtitleEnabled: false,
          filterSubtitleSource: 'embedded',
          filterSubtitleFile: '',
          filterSubtitleStreamIndex: 0,
          filterSubtitleForceStyle: '',
          filterColorManagementEnabled: false,
          filterColorManagementPixelFormat: 'yuv420p',
          filterColorManagementColorSpace: 'bt709',
          filterColorManagementTransfer: 'bt709',
          filterColorManagementPrimaries: 'bt709',
          filterColorManagementRange: '',
          filterTransformEnabled: false,
          filterTransformRotation: '0',
          filterTransformFlipH: false,
          filterTransformFlipV: false,
          audioEnabled: true,
          audioEncoder: 'aac',
          audioBitrate: '192k',
          audioChannels: '2',
          audioSampleRate: '48000',
          audioCodec: '',
          trimmingEnabled: false,
          trimmingStartTime: '00:00:00.000',
          trimmingEndTime: '00:00:00.000',
          keepOtherVideoStreams: false,
          keepOtherAudioStreams: false,
          keepSubtitleStreams: true,
          keepAttachmentStreams: false,
          mapAll: false,
          customPreParams: '',
          customVideoFilter: '',
          customAudioFilter: '',
          customVideoParams: '',
          customAudioParams: '',
          customPostParams: '',
          customFullCustom: ''
        },
        exportDate: new Date().toISOString(),
        version: '1.0',
        appVersion: 'Rebebuca 1.0.0'
      };

      const result = presetConverter.convertFrom3FUI(JSON.stringify(preset3fui));

      expect(result).not.toBeNull();
      expect(result?.data.filters.crop).toBeDefined();
      expect(result?.data.filters.crop?.enabled).toBe(true);
      expect(result?.data.filters.crop?.width).toBe('1920');
      expect(result?.data.filters.crop?.height).toBe('1080');

      expect(result?.data.filters.scale).toBeDefined();
      expect(result?.data.filters.scale?.enabled).toBe(true);
      expect(result?.data.filters.scale?.width).toBe('1280');
      expect(result?.data.filters.scale?.height).toBe('720');
      expect(result?.data.filters.scale?.keepAspect).toBe(true);

      expect(result?.data.filters.framerate).toBeDefined();
      expect(result?.data.filters.framerate?.enabled).toBe(true);
      expect(result?.data.filters.framerate?.fps).toBe('30');

      expect(result?.data.filters.denoise).toBeDefined();
      expect(result?.data.filters.denoise?.enabled).toBe(true);
      expect(result?.data.filters.denoise?.strength).toBe('5');

      expect(result?.data.filters.sharpen).toBeDefined();
      expect(result?.data.filters.sharpen?.enabled).toBe(true);
      expect(result?.data.filters.sharpen?.strength).toBe('1.5');
    });

    it('应该处理无效的 JSON', () => {
      const result = presetConverter.convertFrom3FUI('invalid json');
      expect(result).toBeNull();
    });

    it('应该处理空的字符串', () => {
      const result = presetConverter.convertFrom3FUI('');
      expect(result).toBeNull();
    });
  });

  describe('convertTo3FUI', () => {
    it('应该正确转换为 3FUI 格式', () => {
      const preset: FFmpegPreset = {
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

      const packedPreset: PackedPreset = {
        id: 'test-123',
        name: 'Test Preset',
        description: 'Test Description',
        version: '1.0.0',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        tags: ['test'],
        preset
      };

      const result = presetConverter.convertTo3FUI(packedPreset);
      const parsed = JSON.parse(result);

      expect(parsed.preset).toBeDefined();
      expect(parsed.preset.presetName).toBe('Test Preset');
      expect(parsed.preset.outputContainer).toBe('mp4');
      expect(parsed.preset.videoEncoder).toBe('libx264');
      expect(parsed.preset.qualityControlMode).toBe('CRF');
      expect(parsed.preset.audioEncoder).toBe('aac');
    });

    it('应该正确转换滤镜', () => {
      const preset: FFmpegPreset = {
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
        filters: {
          crop: {
            enabled: true,
            width: '1920',
            height: '1080',
            x: '0',
            y: '0'
          },
          scale: {
            enabled: true,
            width: '1280',
            height: '720',
            keepAspect: true,
            algorithm: 'lanczos'
          },
          framerate: {
            enabled: true,
            fps: '30',
            mode: 0
          }
        },
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

      const packedPreset: PackedPreset = {
        id: 'test-123',
        name: 'Test with Filters',
        description: 'Test Description',
        version: '1.0.0',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        tags: ['test'],
        preset
      };

      const result = presetConverter.convertTo3FUI(packedPreset);
      const parsed = JSON.parse(result);

      expect(parsed.preset.filterCropEnabled).toBe(true);
      expect(parsed.preset.filterCropW).toBe('1920');
      expect(parsed.preset.filterCropH).toBe('1080');

      expect(parsed.preset.filterScaleEnabled).toBe(true);
      expect(parsed.preset.filterScaleW).toBe('1280');
      expect(parsed.preset.filterScaleH).toBe('720');
      expect(parsed.preset.filterScaleKeepAspect).toBe(true);

      expect(parsed.preset.filterFramerateEnabled).toBe(true);
      expect(parsed.preset.filterFramerateFPS).toBe('30');
    });
  });

  describe('双向转换测试', () => {
    it('应该能够正确进行双向转换', () => {
      // 原始预设
      const originalPreset: FFmpegPreset = {
        output: {
          container: 'mkv',
          naming: {
            useAutoNaming: true,
            autoNamingOption: 0,
            prefix: '',
            suffix: 'hq',
            customPattern: ''
          },
          location: '/output'
        },
        decoder: {
          decoder: 'auto',
          hwaccel: 'cuda',
          hwaccelDevice: '0'
        },
        video: {
          enabled: true,
          encoderCategory: 'hevc',
          encoder: 'libx265',
          preset: 'slow',
          profile: 'main',
          level: '5.0',
          tune: 'film',
          passMode: 2
        },
        quality: {
          controlMode: 'VBR_HQ',
          paramName: 'crf',
          value: '18',
          bitrate: {
            base: '8M',
            min: '4M',
            max: '12M',
            bufferSize: '16M'
          }
        },
        filters: {},
        audio: {
          enabled: true,
          encoder: 'aac',
          bitrate: '256k',
          channels: '6',
          sampleRate: '48000'
        },
        trimming: {
          enabled: true,
          startTime: '00:01:00.000',
          endTime: '00:05:00.000'
        },
        streamControl: {
          keepOtherVideoStreams: false,
          keepOtherAudioStreams: false,
          keepSubtitleStreams: true,
          keepAttachmentStreams: false
        },
        custom: {
          preParams: '-threads 8',
          videoFilter: '',
          audioFilter: '',
          videoParams: '-x265-params crf=18',
          audioParams: '',
          postParams: '-movflags +faststart',
          fullCustom: ''
        }
      };

      const packedPreset: PackedPreset = {
        id: 'test-bidirectional',
        name: 'Bidirectional Test',
        description: 'Test bidirectional conversion',
        version: '1.0.0',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        tags: ['test', 'bidirectional'],
        preset: originalPreset
      };

      // 转换为 3FUI
      const f3uiJson = presetConverter.convertTo3FUI(packedPreset);

      // 从 3FUI 转换回来
      const result = presetConverter.convertFrom3FUI(f3uiJson);

      expect(result).not.toBeNull();
      expect(result?.data.output.container).toBe(originalPreset.output.container);
      expect(result?.data.video.encoder).toBe(originalPreset.video.encoder);
      expect(result?.data.video.preset).toBe(originalPreset.video.preset);
      expect(result?.data.quality.controlMode).toBe(originalPreset.quality.controlMode);
      expect(result?.data.quality.value).toBe(originalPreset.quality.value);
    });
  });
});
