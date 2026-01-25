/**
 * FFmpeg 进度数据类型
 */

/**
 * FFmpeg 进度信息
 */
export interface FFmpegProgress {
  // 基础信息
  frame?: number;             // 当前帧数
  fps?: number;              // 帧率
  q?: number;               // 量化参数

  // 时间信息
  time?: string;             // 当前时间 (HH:MM:SS.mmm)
  duration?: string;         // 总时长 (HH:MM:SS.mmm)
  timeSeconds?: number;      // 当前时间 (秒)
  durationSeconds?: number;  // 总时长 (秒)

  // 大小信息
  size?: number;            // 当前大小
  sizeUnit?: 'KiB' | 'MiB' | 'GiB';
  sizeBytes?: number;       // 大小 (字节)

  // 比特率
  bitrate?: number;         // 当前比特率 (kbits/s)
  estimatedSize?: number;   // 预估文件大小 (字节)

  // 速度
  speed?: number;           // 处理速度 (倍数)

  // 进度
  progress?: number;        // 进度百分比 (0-100)

  // 剩余时间
  remainingTime?: number;   // 剩余时间 (秒)

  // 状态
  status?: 'analyzing' | 'encoding' | 'muxing' | 'finished' | 'error';

  // 错误信息
  error?: string;
}

/**
 * 进度事件类型
 */
export type FFmpegProgressEvent =
  | { type: 'progress'; data: FFmpegProgress }
  | { type: 'duration'; duration: string; durationSeconds: number }
  | { type: 'complete'; exitCode: number }
  | { type: 'error'; error: string }
  | { type: 'warning'; warning: string };
