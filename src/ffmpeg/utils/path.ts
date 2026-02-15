/**
 * 路径工具函数
 * 用于 FFmpeg 文件路径的处理
 */

import type { FFmpegPreset } from '../types/preset';

/**
 * 获取文件扩展名
 */
export function getFileExtension(filename: string): string {
  const parts = filename.split('.');
  return parts.length > 1 ? parts.pop()!.toLowerCase() : '';
}

/**
 * 获取文件名（不含扩展名）
 */
export function getFileNameWithoutExtension(filename: string): string {
  const parts = filename.split('.');
  return parts.length > 1 ? parts.slice(0, -1).join('.') : filename;
}

/**
 * 获取文件名（含扩展名）
 */
export function getFileName(path: string): string {
  const parts = path.split(/[/\\]/);
  return parts.pop() || '';
}

/**
 * 获取目录路径
 */
export function getDirectory(path: string): string {
  const parts = path.split(/[/\\]/);
  parts.pop();
  return parts.join('/');
}

/**
 * 判断是否为绝对路径
 */
export function isAbsolutePath(path: string): boolean {
  return /^[A-Za-z]:\//.test(path) || path.startsWith('/');
}

/**
 * 转义路径中的特殊字符（用于命令行）
 */
export function escapePathForCommand(path: string): string {
  // 在命令行中，需要用引号包裹路径
  // 如果路径包含空格或特殊字符
  if (/[\s&|<>()"]/.test(path)) {
    return `"${path.replace(/"/g, '\\"')}"`;
  }
  return path;
}

/**
 * 生成输出文件名
 */
export function generateOutputFilename(
  inputFilename: string,
  preset: FFmpegPreset
): string {
  const baseName = getFileNameWithoutExtension(inputFilename);
  const { prefix, suffix } = preset.output.naming;

  // 如果使用自动命名，应用前缀和后缀
  if (preset.output.naming.useAutoNaming) {
    const parts = [baseName];
    if (prefix) parts.unshift(prefix);
    if (suffix) parts.push(suffix);
    return parts.join('_');
  }

  // 否则使用自定义命名模式
  return preset.output.naming.customPattern || baseName;
}

/**
 * 生成输出文件路径
 */
export function generateOutputPath(
  inputPath: string,
  preset: FFmpegPreset,
  outputFile?: string
): string {
  // 如果指定了输出文件，使用指定的文件
  if (outputFile && isAbsolutePath(outputFile)) {
    return outputFile;
  }

  // 如果预设指定了输出位置，使用预设位置
  if (preset.output.location) {
    const outputDir = preset.output.location;
    const inputFilename = getFileName(inputPath);
    const outputFilename = generateOutputFilename(inputFilename, preset);
    return `${outputDir}/${outputFilename}.${preset.output.container}`;
  }

  // 否则，使用输入文件所在目录
  const inputDir = getDirectory(inputPath);
  const inputFilename = getFileName(inputPath);
  const outputFilename = generateOutputFilename(inputFilename, preset);
  return `${inputDir}/${outputFilename}.${preset.output.container}`;
}

/**
 * 批量生成输出文件路径
 */
export function generateBatchOutputPaths(
  inputPaths: string[],
  preset: FFmpegPreset
): string[] {
  return inputPaths.map(inputPath => generateOutputPath(inputPath, preset));
}

/**
 * 解析文件大小
 */
export function parseFileSize(sizeStr: string): number {
  const match = sizeStr.match(/^(\d+\.?\d*)\s*(KiB|MiB|GiB|KB|MB|GB|B)?$/i);
  if (!match) return 0;

  const value = parseFloat(match[1]);
  const unit = (match[2] || 'B').toUpperCase();

  const multipliers: Record<string, number> = {
    B: 1,
    KB: 1000,
    MB: 1000 * 1000,
    GB: 1000 * 1000 * 1000,
    KIB: 1024,
    MIB: 1024 * 1024,
    GIB: 1024 * 1024 * 1024,
  };

  return value * (multipliers[unit] || 1);
}

/**
 * 格式化文件大小
 */
export function formatFileSize(bytes: number, unit: 'KiB' | 'MiB' | 'GiB' = 'MiB'): string {
  const multipliers = {
    KiB: 1024,
    MiB: 1024 * 1024,
    GiB: 1024 * 1024 * 1024,
  };

  const multiplier = multipliers[unit];
  const value = bytes / multiplier;

  return `${value.toFixed(2)} ${unit}`;
}

/**
 * 解析比特率字符串
 * 例如: 5M -> 5000000, 128k -> 128000
 */
export function parseBitrate(bitrateStr: string): number {
  const match = bitrateStr.match(/^(\d+\.?\d*)\s*(k|M|G)?$/i);
  if (!match) return 0;

  const value = parseFloat(match[1]);
  const unit = (match[2] || '').toUpperCase();

  const multipliers: Record<string, number> = {
    K: 1000,
    M: 1000 * 1000,
    G: 1000 * 1000 * 1000,
  };

  return value * (multipliers[unit] || 1);
}

/**
 * 格式化比特率
 */
export function formatBitrate(bitrate: number, unit: 'k' | 'M' | 'G' = 'M'): string {
  const multipliers = {
    k: 1000,
    M: 1000 * 1000,
    G: 1000 * 1000 * 1000,
  };

  const multiplier = multipliers[unit];
  const value = bitrate / multiplier;

  return `${value.toFixed(0)}${unit}`;
}

/**
 * 验证文件路径
 */
export function validateFilePath(path: string): boolean {
  // 基本验证：不能包含空路径段
  if (path.includes('//') || path.includes('\\\\')) {
    return false;
  }

  // 检查非法字符（Windows）
  if (/["*:<>?|]/.test(path)) {
    return false;
  }

  return true;
}

/**
 * 规范化路径分隔符
 */
export function normalizePath(path: string): string {
  return path.replace(/\\/g, '/');
}

/**
 * 合并路径
 */
export function joinPath(...parts: string[]): string {
  return normalizePath(parts.join('/').replace(/\/+/g, '/'));
}

/**
 * 比较两个路径是否相同
 */
export function isSamePath(path1: string, path2: string): boolean {
  return normalizePath(path1) === normalizePath(path2);
}
