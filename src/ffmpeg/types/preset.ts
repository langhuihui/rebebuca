/**
 * FFmpeg 预设数据结构
 * 参考自 FFmpegFreeUI 的预设数据类型.vb
 */

/**
 * 字幕样式配置
 */
export interface SubtitleStyling {
  forceStyle: string;          // 字幕样式字符串
  fontSize?: string;          // 字体大小
  fontName?: string;          // 字体名称
  primaryColor?: string;      // 主颜色
  backColor?: string;         // 背景颜色
  outlineColor?: string;       // 边框颜色
  alignment?: number;         // 对齐方式
}

/**
 * FFmpeg 预设完整数据结构
 */
export interface FFmpegPreset {
  // ==================== 输出配置 ====================
  output: {
    container: string;              // 输出容器 (mp4, mkv, avi, etc.)
    naming: {
      useAutoNaming: boolean;      // 是否使用自动命名
      autoNamingOption: number;     // 自动命名选项
      prefix: string;             // 前缀
      suffix: string;             // 后缀
      customPattern: string;      // 自定义命名模式
    };
    location?: string;              // 输出位置 (默认同输入目录)
  };

  // ==================== 解码参数 ====================
  decoder: {
    decoder: string;              // 解码器 (auto, h264_cuvid, h264_qsv, etc.)
    hwaccel: string;             // 硬件加速 (auto, cuda, qsv, d3d11va, etc.)
    hwaccelDevice?: string;       // 硬件加速设备
  };

  // ==================== 视频编码器 ====================
  video: {
    enabled: boolean;            // 是否处理视频
    encoderCategory: string;      // 编码器类别 (h264, hevc, av1, vp9, etc.)
    encoder: string;            // 具体编码器 (libx264, libx265, etc.)
    preset: string;             // 编码预设 (ultrafast, fast, medium, slow, etc.)
    profile: string;           // 编码配置文件 (baseline, main, high, etc.)
    level: string;             // 编码级别 (3.0, 3.1, 4.0, etc.)
    tune: string;             // 调整参数 (film, animation, grain, etc.)
    passMode: number;          // 编码方式 (0=单次, 1=首次, 2=二次)
    passLogFile?: string;      // 二次编码日志文件
  };

  // ==================== 质量控制 ====================
  quality: {
    controlMode: 'CRF' | 'VBR' | 'VBR_HQ' | 'CQP' | 'CBR';
    paramName: 'crf' | 'cq' | 'qp' | 'global_quality';
    value: string;
    bitrate: {
      base: string;            // 目标比特率 (例如: 5M)
      min?: string;           // 最小比特率
      max?: string;           // 最大比特率
      bufferSize?: string;     // 缓冲区大小 (例如: 10M)
    };
  };

  // ==================== 视频滤镜 ====================
  filters: {
    // 裁剪
    crop?: {
      enabled: boolean;
      width: string;
      height: string;
      x: string;
      y: string;
    };

    // 缩放
    scale?: {
      enabled: boolean;
      width: string;           // 目标宽度 (例如: 1920, iw/2)
      height: string;          // 目标高度 (例如: 1080, ih/2)
      keepAspect: boolean;     // 保持宽高比
      algorithm?: string;      // 缩放算法 (bicubic, lanczos, etc.)
    };

    // 帧率
    framerate?: {
      enabled: boolean;
      fps: string;            // 目标帧率 (例如: 30, 29.97)
      mode?: number;          // 帧率转换模式
    };

    // 去隔行
    deinterlace?: {
      enabled: boolean;
      mode: number;           // 去隔行模式
    };

    // 降噪
    denoise?: {
      enabled: boolean;
      mode: string;          // 降噪模式
      strength: string;       // 降噪强度
    };

    // 锐化
    sharpen?: {
      enabled: boolean;
      strength: string;       // 锐化强度
    };

    // 字幕烧录
    subtitle?: {
      enabled: boolean;
      source: 'embedded' | 'external';
      file?: string;         // 外部字幕文件路径
      streamIndex?: number;   // 内置字幕流索引
      styling?: SubtitleStyling;
    };

    // 色彩管理
    colorManagement?: {
      enabled: boolean;
      pixelFormat: string;    // 像素格式 (yuv420p, yuv422p, etc.)
      colorSpace: string;     // 色彩空间 (bt709, bt2020, etc.)
      transfer: string;       // 传输特性 (bt709, smpte2084, etc.)
      primaries: string;      // 原色 (bt709, bt2020, etc.)
      range?: string;        // 色彩范围 (tv, pc, limited, full)
    };

    // 旋转/翻转
    transform?: {
      enabled: boolean;
      rotation: string;       // 旋转角度 (0, 90, 180, 270)
      flipH?: boolean;        // 水平翻转
      flipV?: boolean;        // 垂直翻转
    };
  };

  // ==================== 音频编码 ====================
  audio: {
    enabled: boolean;            // 是否处理音频
    encoder: string;            // 编码器 (aac, libopus, libmp3lame, etc.)
    bitrate: string;            // 比特率 (192k, 128k, etc.)
    channels: string;           // 声道数 (1, 2, 6, etc.)
    sampleRate: string;         // 采样率 (44100, 48000, etc.)
    codec?: string;            // 强制指定音频编解码器
  };

  // ==================== 剪辑区间 ====================
  trimming: {
    enabled: boolean;
    startTime: string;         // 开始时间 (HH:MM:SS.mmm)
    endTime: string;           // 结束时间 (HH:MM:SS.mmm)
  };

  // ==================== 流控制 ====================
  streamControl: {
    keepOtherVideoStreams: boolean;   // 保留其他视频流
    keepOtherAudioStreams: boolean;   // 保留其他音频流
    keepSubtitleStreams: boolean;     // 保留字幕流
    keepAttachmentStreams: boolean;   // 保留附件流
    mapAll?: boolean;                // 映射所有流
  };

  // ==================== 元数据 ====================
  metadata?: {
    title?: string;
    artist?: string;
    album?: string;
    year?: string;
    comment?: string;
  };

  // ==================== 自定义参数 ====================
  custom: {
    preParams: string;          // 输入前的参数
    videoFilter: string;        // 自定义视频滤镜
    audioFilter: string;        // 自定义音频滤镜
    videoParams: string;        // 自定义视频参数
    audioParams: string;        // 自定义音频参数
    postParams: string;         // 输出后的参数
    fullCustom: string;         // 完全自定义命令行
  };
}

/**
 * 预设元数据
 */
export interface PresetMetadata {
  id: string;
  name: string;
  description?: string;
  version: string;          // 预设格式版本
  createdAt: number;
  updatedAt: number;
  author?: string;
  tags?: string[];
}
