/**
 * FFmpeg 错误处理服务
 * 提供友好的错误提示和解决方案
 */

export interface ErrorInfo {
  code: string;
  message: string;
  suggestion: string;
  severity: 'error' | 'warning' | 'info';
}

export class FFmpegErrorHandler {
  private errorPatterns: Array<{
    pattern: RegExp;
    handler: (match: RegExpMatchArray) => ErrorInfo;
  }>;

  constructor() {
    this.errorPatterns = this.initializeErrorPatterns();
  }

  /**
   * 初始化错误模式
   */
  private initializeErrorPatterns(): Array<{ pattern: RegExp; handler: (match: RegExpMatchArray) => ErrorInfo }> {
    return [
      // 文件不存在
      {
        pattern: /No such file or directory/,
        handler: (): ErrorInfo => ({
          code: 'FILE_NOT_FOUND',
          message: '输入文件不存在或无法访问',
          suggestion: '请检查文件路径是否正确,确保文件存在且可读',
          severity: 'error'
        })
      },

      // 权限不足
      {
        pattern: /Permission denied/,
        handler: (): ErrorInfo => ({
          code: 'PERMISSION_DENIED',
          message: '文件权限不足',
          suggestion: '请检查文件和目录的访问权限',
          severity: 'error'
        })
      },

      // 磁盘空间不足
      {
        pattern: /No space left on device/,
        handler: (): ErrorInfo => ({
          code: 'NO_SPACE',
          message: '磁盘空间不足',
          suggestion: '请清理磁盘空间后重试',
          severity: 'error'
        })
      },

      // 编码器不支持
      {
        pattern: /Unknown encoder '(\w+)'/,
        handler: (match: RegExpMatchArray): ErrorInfo => ({
          code: 'UNKNOWN_ENCODER',
          message: `不支持的编码器: ${match[1]}`,
          suggestion: '请检查 FFmpeg 是否支持该编码器,或选择其他编码器',
          severity: 'error'
        })
      },

      // 解码器不支持
      {
        pattern: /Unknown decoder '(\w+)'/,
        handler: (match: RegExpMatchArray): ErrorInfo => ({
          code: 'UNKNOWN_DECODER',
          message: `不支持的解码器: ${match[1]}`,
          suggestion: '请检查 FFmpeg 是否支持该解码器,或尝试其他解码器',
          severity: 'error'
        })
      },

      // 像素格式不支持
      {
        pattern: /Specified pixel format (.*) is invalid or unsupported/,
        handler: (match: RegExpMatchArray): ErrorInfo => ({
          code: 'INVALID_PIXEL_FORMAT',
          message: `不支持的像素格式: ${match[1]}`,
          suggestion: '请选择其他像素格式,例如 yuv420p',
          severity: 'error'
        })
      },

      // 色彩空间不支持
      {
        pattern: /Unsupported color space/,
        handler: () => ({
          code: 'UNSUPPORTED_COLOR_SPACE',
          message: '不支持的颜色空间',
          suggestion: '请选择其他颜色空间,例如 bt709',
          severity: 'error'
        })
      },

      // 比特率无效
      {
        pattern: /Error parsing option bitrate/,
        handler: () => ({
          code: 'INVALID_BITRATE',
          message: '比特率格式无效',
          suggestion: '请使用正确的比特率格式,例如: 5M, 5000k',
          severity: 'error'
        })
      },

      // 帧率无效
      {
        pattern: /Error parsing option r/,
        handler: () => ({
          code: 'INVALID_FRAMERATE',
          message: '帧率值无效',
          suggestion: '请使用正确的帧率,例如: 30, 29.97',
          severity: 'error'
        })
      },

      // CRF 值无效
      {
        pattern: /CRF value out of range/,
        handler: () => ({
          code: 'CRF_OUT_OF_RANGE',
          message: 'CRF 值超出范围',
          suggestion: 'CRF 值应在 0-51 之间,推荐范围: 18-28',
          severity: 'error'
        })
      },

      // 分辨率无效
      {
        pattern: /Invalid frame size/,
        handler: () => ({
          code: 'INVALID_RESOLUTION',
          message: '分辨率无效',
          suggestion: '请检查分辨率设置,例如: 1920x1080',
          severity: 'error'
        })
      },

      // 内存不足
      {
        pattern: /Cannot allocate memory/,
        handler: () => ({
          code: 'OUT_OF_MEMORY',
          message: '内存不足',
          suggestion: '请关闭其他程序或增加系统内存后重试',
          severity: 'error'
        })
      },

      // 硬件加速不可用
      {
        pattern: /Hardware acceleration not available/,
        handler: () => ({
          code: 'HWACCEL_NOT_AVAILABLE',
          message: '硬件加速不可用',
          suggestion: '请切换到软件编码器或检查硬件加速驱动',
          severity: 'warning'
        })
      },

      // NVENC 错误
      {
        pattern: /NVENC/,
        handler: () => ({
          code: 'NVENC_ERROR',
          message: 'NVENC 硬件编码错误',
          suggestion: '请检查 NVIDIA 驱动或切换到其他编码器',
          severity: 'error'
        })
      },

      // QSV 错误
      {
        pattern: /QSV/,
        handler: () => ({
          code: 'QSV_ERROR',
          message: 'Intel QSV 硬件编码错误',
          suggestion: '请检查 Intel 驱动或切换到其他编码器',
          severity: 'error'
        })
      },

      // AMF 错误
      {
        pattern: /AMF/,
        handler: () => ({
          code: 'AMF_ERROR',
          message: 'AMD AMF 硬件编码错误',
          suggestion: '请检查 AMD 驱动或切换到其他编码器',
          severity: 'error'
        })
      },

      // 字幕文件不存在
      {
        pattern: /Cannot open subtitle file/,
        handler: () => ({
          code: 'SUBTITLE_FILE_NOT_FOUND',
          message: '字幕文件不存在',
          suggestion: '请检查字幕文件路径是否正确',
          severity: 'error'
        })
      },

      // 默认错误
      {
        pattern: /.*/,
        handler: () => ({
          code: 'UNKNOWN_ERROR',
          message: '未知错误',
          suggestion: '请查看完整错误日志或联系技术支持',
          severity: 'error'
        })
      }
    ];
  }

  /**
   * 解析错误信息
   */
  parseError(errorOutput: string): ErrorInfo {
    for (const { pattern, handler } of this.errorPatterns) {
      const match = errorOutput.match(pattern);
      if (match) {
        return handler(match);
      }
    }

    // 返回默认错误
    return {
      code: 'UNKNOWN_ERROR',
      message: '未知错误',
      suggestion: '请查看完整错误日志或联系技术支持',
      severity: 'error'
    };
  }

  /**
   * 批量解析错误
   */
  parseErrors(errorOutputs: string[]): ErrorInfo[] {
    return errorOutputs.map(output => this.parseError(output));
  }

  /**
   * 格式化错误信息
   */
  formatError(errorInfo: ErrorInfo): string {
    return `[${errorInfo.code}] ${errorInfo.message}`;
  }

  /**
   * 获取错误解决方案
   */
  getSuggestion(errorOutput: string): string {
    const errorInfo = this.parseError(errorOutput);
    return errorInfo.suggestion;
  }

  /**
   * 检查错误是否可以恢复
   */
  isRecoverable(errorInfo: ErrorInfo): boolean {
    const recoverableCodes = [
      'NO_SPACE',
      'OUT_OF_MEMORY',
      'HWACCEL_NOT_AVAILABLE',
      'NVENC_ERROR',
      'QSV_ERROR',
      'AMF_ERROR'
    ];

    return recoverableCodes.includes(errorInfo.code);
  }

  /**
   * 获取恢复建议
   */
  getRecoverySuggestion(errorInfo: ErrorInfo): string {
    if (!this.isRecoverable(errorInfo)) {
      return '此错误无法自动恢复,请根据建议手动修复问题';
    }

    switch (errorInfo.code) {
      case 'NO_SPACE':
        return '清理磁盘空间后重试';
      case 'OUT_OF_MEMORY':
        return '关闭其他程序后重试';
      case 'HWACCEL_NOT_AVAILABLE':
        return '切换到软件编码器';
      case 'NVENC_ERROR':
      case 'QSV_ERROR':
      case 'AMF_ERROR':
        return '切换到软件编码器(libx264)';
      default:
        return '重试操作';
    }
  }
}

// 全局错误处理器实例
export const errorHandler = new FFmpegErrorHandler();

/**
 * 错误类型枚举
 */
export enum ErrorType {
  FILE_ERROR = 'FILE_ERROR',
  PARAM_ERROR = 'PARAM_ERROR',
  CODEC_ERROR = 'CODEC_ERROR',
  SYSTEM_ERROR = 'SYSTEM_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

/**
 * 自定义错误类
 */
export class FFmpegError extends Error {
  public code: string;
  public type: ErrorType;
  public suggestion: string;
  public originalError?: Error;

  constructor(
    code: string,
    message: string,
    type: ErrorType = ErrorType.UNKNOWN_ERROR,
    suggestion: string = '',
    originalError?: Error
  ) {
    super(message);
    this.name = 'FFmpegError';
    this.code = code;
    this.type = type;
    this.suggestion = suggestion;
    this.originalError = originalError;
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      type: this.type,
      suggestion: this.suggestion,
      stack: this.stack
    };
  }
}
