/**
 * ProgressParser 单元测试
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ProgressParser } from '../progressParser';
import type { FFmpegProgress } from '../../types/progress';

describe('ProgressParser', () => {
  let parser: ProgressParser;

  beforeEach(() => {
    parser = new ProgressParser();
  });

  describe('parseLine - Duration 解析', () => {
    it('应该正确解析 Duration 行', () => {
      const line = '  Duration: 00:30:00.00, start: 0.000000, bitrate: 12345 kb/s';
      const result = parser.parseLine(line);

      expect(result).not.toBeNull();
      expect(result?.duration).toBe('00:30:00.00');
      expect(result?.durationSeconds).toBe(1800);
      expect(result?.status).toBe('analyzing');
    });

    it('应该处理不同格式的 Duration', () => {
      const testCases = [
        { line: 'Duration: 01:23:45.67', expectedDuration: '01:23:45.67', expectedSeconds: 5025.67 },
        { line: 'Duration: 00:10:30.00', expectedDuration: '00:10:30.00', expectedSeconds: 630 },
        { line: 'Duration: 02:00:00.00', expectedDuration: '02:00:00.00', expectedSeconds: 7200 },
      ];

      testCases.forEach(({ line, expectedDuration, expectedSeconds }) => {
        const result = parser.parseLine(line);
        expect(result?.duration).toBe(expectedDuration);
        expect(result?.durationSeconds).toBe(expectedSeconds);
      });
    });
  });

  describe('parseLine - 进度解析', () => {
    beforeEach(() => {
      // 设置 duration
      parser.setDuration('00:30:00.00', 1800);
    });

    it('应该正确解析完整进度行', () => {
      const line = 'frame=  100 fps= 30 q=23.0 size=    1024KiB time=00:00:03.33 bitrate=2500kbits/s speed=1.5x';
      const result = parser.parseLine(line);

      expect(result).not.toBeNull();
      expect(result?.frame).toBe(100);
      expect(result?.fps).toBe(30.0);
      expect(result?.q).toBe(23.0);
      expect(result?.size).toBe(1024);
      expect(result?.sizeUnit).toBe('KiB');
      expect(result?.time).toBe('00:00:03.33');
      expect(result?.timeSeconds).toBe(3.33);
      expect(result?.bitrate).toBe(2500);
      expect(result?.speed).toBe(1.5);
      expect(result?.progress).toBeCloseTo(0.185, 2); // 3.33 / 1800 * 100
      expect(result?.status).toBe('encoding');
    });

    it('应该正确解析不带 bitrate 和 speed 的进度行', () => {
      const line = 'frame=  200 fps= 29.97 q=24.0 size=    2048KiB time=00:00:06.67';
      const result = parser.parseLine(line);

      expect(result?.frame).toBe(200);
      expect(result?.fps).toBe(29.97);
      expect(result?.q).toBe(24.0);
      expect(result?.time).toBe('00:00:06.67');
      expect(result?.bitrate).toBeUndefined();
      expect(result?.speed).toBeUndefined();
    });

    it('应该正确计算进度百分比', () => {
      parser.setDuration('01:00:00.00', 3600);
      
      const line = 'frame=  1000 fps= 30 q=23.0 size=    1024KiB time=00:10:00.00 bitrate=2500kbits/s speed=1.5x';
      const result = parser.parseLine(line);

      expect(result?.progress).toBeCloseTo(16.67, 2); // 600 / 3600 * 100
    });

    it('应该计算剩余时间', () => {
      parser.setDuration('00:10:00.00', 600);
      
      const line = 'frame=  100 fps= 30 q=23.0 size=    1024KiB time=00:02:00.00 bitrate=2500kbits/s speed=1.0x';
      const result = parser.parseLine(line);

      expect(result?.remainingTime).toBe(480); // (600 - 120) / 1.0
    });
  });

  describe('parseLine - 错误识别', () => {
    it('应该识别错误行', () => {
      const errorLines = [
        'Error: Invalid argument',
        'Conversion failed!',
        'Encoder error occurred',
        'No such file or directory',
      ];

      errorLines.forEach(line => {
        const result = parser.parseLine(line);
        expect(result?.status).toBe('error');
        expect(result?.error).toBe(line.trim());
      });
    });

    it('应该不识别正常行为中的 error 字符串', () => {
      const line = 'frame=  100 fps= 30 q=23.0 error_resilience=1';
      const result = parser.parseLine(line);

      expect(result?.status).not.toBe('error');
    });
  });

  describe('parseLine - muxing 状态', () => {
    it('应该识别 muxing 状态', () => {
      const line = '[info] muxing output';
      const result = parser.parseLine(line);

      expect(result?.status).toBe('muxing');
    });
  });

  describe('calculateProgress', () => {
    beforeEach(() => {
      parser.setDuration('00:10:00.00', 600);
    });

    it('应该正确计算进度百分比', () => {
      expect(parser.calculateProgress(0)).toBe(0);
      expect(parser.calculateProgress(60)).toBe(10);
      expect(parser.calculateProgress(300)).toBe(50);
      expect(parser.calculateProgress(600)).toBe(100);
    });

    it('应该处理未设置 duration 的情况', () => {
      const emptyParser = new ProgressParser();
      expect(emptyParser.calculateProgress(100)).toBeUndefined();
    });
  });

  describe('calculateRemainingTime', () => {
    beforeEach(() => {
      parser.setDuration('00:10:00.00', 600);
    });

    it('应该正确计算剩余时间', () => {
      expect(parser.calculateRemainingTime(0, 2)).toBe(300); // 600 / 2
      expect(parser.calculateRemainingTime(120, 2)).toBe(240); // (600 - 120) / 2
      expect(parser.calculateRemainingTime(300, 1.5)).toBe(200); // (600 - 300) / 1.5
    });

    it('应该处理未设置 speed 的情况', () => {
      expect(parser.calculateRemainingTime(100)).toBeUndefined();
    });

    it('应该处理 speed 为 0 的情况', () => {
      expect(parser.calculateRemainingTime(100, 0)).toBeUndefined();
    });
  });

  describe('estimateSize', () => {
    it('应该正确估算文件大小', () => {
      const size1 = parser.estimateSize(1024 * 1024, 50); // 50% 完成，当前 1MB
      expect(size1).toBe(2 * 1024 * 1024); // 预估 2MB

      const size2 = parser.estimateSize(5 * 1024 * 1024, 25); // 25% 完成，当前 5MB
      expect(size2).toBe(20 * 1024 * 1024); // 预估 20MB
    });

    it('应该处理 progress 为 0 的情况', () => {
      expect(parser.estimateSize(1024 * 1024, 0)).toBeUndefined();
    });

    it('应该处理 progress 未定义的情况', () => {
      expect(parser.estimateSize(1024 * 1024)).toBeUndefined();
    });
  });

  describe('reset', () => {
    it('应该重置解析器状态', () => {
      parser.setDuration('00:10:00.00', 600);
      parser.parseLine('frame=  100 fps= 30 q=23.0 size=    1024KiB time=00:00:03.33 bitrate=2500kbits/s speed=1.5x');

      expect(parser.getDuration()).toBe(600);

      parser.reset();

      expect(parser.getDuration()).toBeUndefined();
    });
  });

  describe('时间解析', () => {
    it('应该正确解析时间字符串为秒数', () => {
      const testCases = [
        { time: '00:00:00.00', seconds: 0 },
        { time: '00:00:30.00', seconds: 30 },
        { time: '00:01:00.00', seconds: 60 },
        { time: '00:10:00.00', seconds: 600 },
        { time: '01:00:00.00', seconds: 3600 },
        { time: '01:30:45.50', seconds: 5445.5 },
      ];

      testCases.forEach(({ time, seconds }) => {
        const result = parser['parseTimeToSeconds'](time);
        expect(result).toBe(seconds);
      });
    });
  });

  describe('大小解析', () => {
    it('应该正确解析大小字符串为字节数', () => {
      const testCases = [
        { size: 1024, unit: 'KiB', bytes: 1024 * 1024 },
        { size: 5, unit: 'MiB', bytes: 5 * 1024 * 1024 },
        { size: 1, unit: 'GiB', bytes: 1024 * 1024 * 1024 },
      ];

      testCases.forEach(({ size, unit, bytes }) => {
        const result = parser['parseSizeToBytes'](size, unit);
        expect(result).toBe(bytes);
      });
    });
  });

  describe('完整流程', () => {
    it('应该完整解析 FFmpeg 输出流程', () => {
      // 1. 解析 Duration
      const durationLine = '  Duration: 00:30:00.00, start: 0.000000, bitrate: 12345 kb/s';
      let result = parser.parseLine(durationLine);
      expect(result?.duration).toBe('00:30:00.00');
      expect(result?.durationSeconds).toBe(1800);

      // 2. 解析进度
      const progressLine1 = 'frame=  100 fps= 30 q=23.0 size=    1024KiB time=00:00:03.33 bitrate=2500kbits/s speed=1.5x';
      result = parser.parseLine(progressLine1);
      expect(result?.progress).toBeCloseTo(0.185, 2);

      // 3. 继续解析
      const progressLine2 = 'frame=  500 fps= 29.97 q=24.0 size=    5120KiB time=00:00:16.67 bitrate=2500kbits/s speed=1.5x';
      result = parser.parseLine(progressLine2);
      expect(result?.progress).toBeCloseTo(0.926, 2);

      // 4. 50% 进度
      const progressLine3 = 'frame=  900 fps= 30 q=23.0 size=    9216KiB time=00:15:00.00 bitrate=2500kbits/s speed=1.5x';
      result = parser.parseLine(progressLine3);
      expect(result?.progress).toBe(50);

      // 5. 100% 进度
      const progressLine4 = 'frame= 1800 fps= 30 q=23.0 size=    18432KiB time=00:30:00.00 bitrate=2500kbits/s speed=1.5x';
      result = parser.parseLine(progressLine4);
      expect(result?.progress).toBe(100);
    });
  });
});
