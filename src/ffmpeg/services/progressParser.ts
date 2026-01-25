/**
 * FFmpeg 进度解析服务
 * 参考 FFmpegFreeUI 编码任务.vb 的正则表达式逻辑
 */

import type { FFmpegProgress } from '../types/progress';

/**
 * 进度解析状态
 */
interface ParserState {
  duration?: string;
  durationSeconds?: number;
  lastTime?: number;
}

/**
 * FFmpeg 进度解析器
 */
export class ProgressParser {
  private state: ParserState = {};

  // 正则表达式模式
  private readonly DURATION_REGEX = /Duration:\s+(\d{2}):(\d{2}):(\d{2})\.(\d{2})/i;
  private readonly PROGRESS_REGEX = /frame=\s*(\d+)\s+fps=\s*([\d.]+)\s+q=\s*([\d.-]+)\s+size=\s*(\d+)\s*([KMG]iB)\s+time=\s*(\d{2}):(\d{2}):(\d{2})\.(\d{2})\s+bitrate=\s*([\d.]+)(?:kbits\/s)?\s+speed=\s*([\d.]+)x/i;
  private readonly SIMPLE_PROGRESS_REGEX = /frame=\s*(\d+)\s+fps=\s*([\d.]+)\s+q=\s*([\d.-]+)\s+size=\s*(\d+)\s*([KMG]iB)\s+time=\s*(\d{2}):(\d{2}):(\d{2})\.(\d{2})/i;
  private readonly BITRATE_SPEED_REGEX = /bitrate=\s*([\d.]+)kbits\/s\s+speed=\s*([\d.]+)x/i;

  // 错误模式
  private readonly ERROR_PATTERNS = [
    /error\s+:/i,
    /conversion\s+failed/i,
    /encoder\s+error/i,
    /no\s+such\s+file/i,
    /invalid\s+argument/i,
    /permission\s+denied/i,
  ];

  constructor() {
    this.state = {};
  }

  /**
   * 解析单行输出
   * @param line FFmpeg 输出行
   * @returns 解析后的进度数据，如果没有匹配则返回 null
   */
  parseLine(line: string): FFmpegProgress | null {
    if (!line || line.trim() === '') {
      return null;
    }

    // 检查错误
    if (this.isError(line)) {
      return {
        status: 'error',
        error: line.trim(),
      };
    }

    // 解析 Duration
    const durationMatch = line.match(this.DURATION_REGEX);
    if (durationMatch) {
      const duration = `${durationMatch[1]}:${durationMatch[2]}:${durationMatch[3]}.${durationMatch[4]}`;
      const durationSeconds = this.parseTimeToSeconds(duration);
      
      this.state.duration = duration;
      this.state.durationSeconds = durationSeconds;

      return {
        duration,
        durationSeconds,
        status: 'analyzing',
      };
    }

    // 解析完整进度行
    const progressMatch = line.match(this.PROGRESS_REGEX);
    if (progressMatch) {
      const progress = this.parseProgressLine(progressMatch);
      return {
        ...progress,
        status: 'encoding',
      };
    }

    // 解析简单进度行（没有 bitrate 和 speed）
    const simpleMatch = line.match(this.SIMPLE_PROGRESS_REGEX);
    if (simpleMatch) {
      const progress = this.parseProgressLine(simpleMatch);
      return {
        ...progress,
        status: 'encoding',
      };
    }

    // 检查 muxing 状态
    if (line.toLowerCase().includes('muxing')) {
      return {
        status: 'muxing',
      };
    }

    return null;
  }

  /**
   * 解析进度行
   * @param match 正则表达式匹配结果
   * @returns 进度数据
   */
  private parseProgressLine(match: RegExpMatchArray): Partial<FFmpegProgress> {
    const frame = parseInt(match[1], 10);
    const fps = parseFloat(match[2]);
    const q = parseFloat(match[3]);
    const size = parseInt(match[4], 10);
    const sizeUnit = match[5] as 'KiB' | 'MiB' | 'GiB';
    const time = `${match[6]}:${match[7]}:${match[8]}.${match[9]}`;
    const timeSeconds = this.parseTimeToSeconds(time);
    const bitrate = match[10] ? parseFloat(match[10]) : undefined;
    const speed = match[11] ? parseFloat(match[11]) : undefined;

    // 计算大小（字节）
    const sizeBytes = this.parseSizeToBytes(size, sizeUnit);

    // 计算进度百分比
    const progress = this.calculateProgress(timeSeconds);

    // 计算剩余时间
    const remainingTime = this.calculateRemainingTime(timeSeconds, speed);

    return {
      frame,
      fps,
      q,
      size,
      sizeUnit,
      sizeBytes,
      time,
      timeSeconds,
      bitrate,
      speed,
      progress,
      remainingTime,
    };
  }

  /**
   * 提取进度信息
   * @param line FFmpeg 输出行
   * @returns 进度信息
   */
  parseProgress(line: string): FFmpegProgress | null {
    return this.parseLine(line);
  }

  /**
   * 计算进度百分比
   * @param timeSeconds 当前时间（秒）
   * @returns 进度百分比 (0-100)
   */
  calculateProgress(timeSeconds: number): number | undefined {
    if (!this.state.durationSeconds || this.state.durationSeconds === 0) {
      return undefined;
    }

    const progress = (timeSeconds / this.state.durationSeconds) * 100;
    return Math.min(100, Math.max(0, progress));
  }

  /**
   * 计算剩余时间
   * @param timeSeconds 当前时间（秒）
   * @param speed 处理速度（倍数）
   * @returns 剩余时间（秒）
   */
  calculateRemainingTime(timeSeconds: number, speed?: number): number | undefined {
    if (!this.state.durationSeconds || !speed || speed === 0) {
      return undefined;
    }

    const remaining = this.state.durationSeconds - timeSeconds;
    const remainingSeconds = remaining / speed;
    
    return Math.max(0, remainingSeconds);
  }

  /**
   * 预估文件大小
   * @param currentSizeBytes 当前文件大小（字节）
   * @param progress 进度百分比
   * @returns 预估文件大小（字节）
   */
  estimateSize(currentSizeBytes: number, progress?: number): number | undefined {
    if (!progress || progress === 0) {
      return undefined;
    }

    return Math.round((currentSizeBytes / progress) * 100);
  }

  /**
   * 解析时间字符串为秒数
   * @param time 时间字符串 (HH:MM:SS.mmm)
   * @returns 秒数
   */
  private parseTimeToSeconds(time: string): number {
    const match = time.match(/(\d{2}):(\d{2}):(\d{2})\.(\d{2})/);
    if (!match) {
      return 0;
    }

    const hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    const seconds = parseInt(match[3], 10);
    const centiseconds = parseInt(match[4], 10);

    return hours * 3600 + minutes * 60 + seconds + centiseconds / 100;
  }

  /**
   * 解析大小字符串为字节数
   * @param size 大小数值
   * @param unit 单位 (KiB, MiB, GiB)
   * @returns 字节数
   */
  private parseSizeToBytes(size: number, unit: string): number {
    const multiplier: Record<string, number> = {
      'KiB': 1024,
      'MiB': 1024 * 1024,
      'GiB': 1024 * 1024 * 1024,
    };

    return Math.round(size * (multiplier[unit] || 1));
  }

  /**
   * 检查是否为错误行
   * @param line 输出行
   * @returns 是否为错误
   */
  private isError(line: string): boolean {
    return this.ERROR_PATTERNS.some(pattern => pattern.test(line));
  }

  /**
   * 重置解析器状态
   */
  reset(): void {
    this.state = {};
  }

  /**
   * 获取当前状态
   * @returns 解析器状态
   */
  getState(): ParserState {
    return { ...this.state };
  }

  /**
   * 设置时长
   * @param duration 时长字符串
   * @param durationSeconds 时长秒数
   */
  setDuration(duration: string, durationSeconds: number): void {
    this.state.duration = duration;
    this.state.durationSeconds = durationSeconds;
  }

  /**
   * 获取时长
   * @returns 时长（秒）
   */
  getDuration(): number | undefined {
    return this.state.durationSeconds;
  }
}

// 导出单例实例
export const progressParser = new ProgressParser();
