/**
 * 时间工具函数
 * 用于 FFmpeg 时间的解析和格式化
 */

/**
 * 将秒数转换为 HH:MM:SS.mmm 格式
 */
export function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);

  const hh = String(hours).padStart(2, '0');
  const mm = String(minutes).padStart(2, '0');
  const ss = String(secs).padStart(2, '0');
  const mmm = String(ms).padStart(3, '0');

  return `${hh}:${mm}:${ss}.${mmm}`;
}

/**
 * 解析时间字符串为秒数
 * 支持 HH:MM:SS.mmm, HH:MM:SS, MM:SS, SS.mmm, SS 等格式
 */
export function parseTime(timeStr: string): number {
  // 移除所有空白字符
  const cleanStr = timeStr.trim();

  // 如果是纯数字，直接返回
  if (/^\d+\.?\d*$/.test(cleanStr)) {
    return parseFloat(cleanStr);
  }

  const parts = cleanStr.split(':');
  let seconds = 0;

  if (parts.length === 3) {
    // HH:MM:SS.mmm 或 HH:MM:SS
    const hours = parseFloat(parts[0]);
    const minutes = parseFloat(parts[1]);
    const secs = parseFloat(parts[2]);
    seconds = hours * 3600 + minutes * 60 + secs;
  } else if (parts.length === 2) {
    // MM:SS.mmm 或 MM:SS
    const minutes = parseFloat(parts[0]);
    const secs = parseFloat(parts[1]);
    seconds = minutes * 60 + secs;
  } else {
    // 单个值，假设是秒数
    seconds = parseFloat(cleanStr);
  }

  return seconds;
}

/**
 * 验证时间字符串格式
 */
export function validateTimeString(timeStr: string): boolean {
  try {
    const seconds = parseTime(timeStr);
    return !isNaN(seconds) && seconds >= 0;
  } catch {
    return false;
  }
}

/**
 * 计算时长
 */
export function calculateDuration(startTime: string, endTime: string): number {
  const start = parseTime(startTime);
  const end = parseTime(endTime);
  return end - start;
}

/**
 * 格式化时长为易读格式
 */
export function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${Math.round(seconds)}s`;
  } else if (seconds < 3600) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return `${mins}m ${secs}s`;
  } else {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${mins}m`;
  }
}

/**
 * 将毫秒转换为秒
 */
export function msToSeconds(ms: number): number {
  return ms / 1000;
}

/**
 * 将秒转换为毫秒
 */
export function secondsToMs(seconds: number): number {
  return Math.round(seconds * 1000);
}

/**
 * 生成时间戳
 */
export function generateTimestamp(): number {
  return Date.now();
}
