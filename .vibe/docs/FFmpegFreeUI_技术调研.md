# FFmpegFreeUI 技术调研报告

> **调研目标**: 评估 FFmpegFreeUI 项目与 Rebebuca 的技术兼容性及融合可行性
>
> **调研日期**: 2026-01-24
>
> **调研人**: 技术骨干

---

## 一、项目概述

### 1.1 FFmpegFreeUI 简介

FFmpegFreeUI (简称 3FUI) 是一个基于 Windows 的 FFmpeg 专业交互外壳，具有以下特点：

- **定位**: 面向压片党和专业工作者的视频转码工具
- **核心理念**: 纯净、自由、无内置预设、完全参数透明
- **用户群体**: 愿意折腾、追求质量、强迫症、专业工作者

### 1.2 Rebebuca 简介

Rebebuca 是一个现代化的运行配置管理工具，具有以下特点：

- **定位**: 帮助开发者快速管理和执行各种命令与脚本的桌面应用
- **核心理念**: 简化命令执行、配置管理、多标签页运行
- **用户群体**: 开发者、需要频繁执行命令的技术人员

---

## 二、技术栈对比分析

### 2.1 FFmpegFreeUI 技术栈

| 类别 | 技术选型 | 版本 | 说明 |
|------|---------|------|------|
| **开发语言** | VB.NET | - | 传统的 .NET 语言 |
| **运行时** | .NET 10 | 10.0 | 最新的 .NET 运行时 |
| **UI框架** | WinForms | - | 经典的 Windows 窗体框架 |
| **UI库** | SunnyUI | 3.7.2 | 第三方美化 UI 库 |
| **架构模式** | - | - | 传统的单体应用架构 |
| **依赖管理** | NuGet | - | .NET 包管理器 |
| **发布方式** | ReadyToRun / SelfContained / SingleFile | - | 三种打包模式 |

### 2.2 Rebebuca 技术栈

| 类别 | 技术选型 | 版本 | 说明 |
|------|---------|------|------|
| **开发语言** | TypeScript | 5.6 | 现代 JavaScript 超集 |
| **前端框架** | Vue 3 | 3.5 | 渐进式 JavaScript 框架 |
| **UI组件库** | Naive UI | 2.43 | 现代 Vue 3 组件库 |
| **状态管理** | Pinia | 3.0 | Vue 生态的状态管理方案 |
| **构建工具** | Vite | 7.2 | 下一代前端构建工具 |
| **桌面框架** | Node.js | 2.x | 基于 Rust 的轻量级框架 |
| **后端语言** | Rust | - | 系统级编程语言 |
| **架构模式** | 前后端分离 | - | 现代化 SPA 架构 |

### 2.3 技术兼容性评估

| 维度 | 评分 | 说明 |
|------|------|------|
| **语言兼容性** | ❌ 极低 | VB.NET vs TypeScript，完全不同的语言生态 |
| **框架兼容性** | ❌ 极低 | WinForms vs Vue 3，架构理念完全不同 |
| **运行时兼容性** | ❌ 极低 | .NET 10 vs Web + Rust，依赖体系完全独立 |
| **依赖复用** | ❌ 极低 | NuGet vs npm + Cargo，包管理器不互通 |
| **团队技能复用** | ⚠️ 中 | 都需要学习对方的技术栈 |

---

## 三、代码结构分析

### 3.1 FFmpegFreeUI 代码结构

```
FFmpegFreeUI/
├── 编码任务/                 # 核心业务逻辑
│   ├── 编码任务.vb          # 任务执行、进度监控、状态管理
│   ├── 预设管理.vb         # 预设数据管理、命令行生成 (119KB)
│   ├── 预设数据类型.vb      # 数据结构定义
│   └── 视频编码器数据库.vb  # 编码器参数数据库
├── 界面/                   # UI 表单
│   ├── 界面_常规流程参数_V2.Designer.vb  # 参数面板设计器 (452KB)
│   ├── 界面_常规流程参数_V2.vb          # 参数面板逻辑 (59KB)
│   ├── 界面_设置.vb                   # 设置界面
│   └── Form1.vb                       # 主窗体
├── 界面控制/               # 界面控制逻辑
│   ├── 界面控制.vb
│   └── 界面控制_编码队列.vb
├── 模块/                   # 全局模块
│   ├── Module1.vb           # 工具函数、API 调用
│   └── Module3_多语言.vb   # 多语言支持
├── 网络功能/               # 网络相关功能
│   ├── 检查更新.vb
│   ├── 端口监听.vb
│   └── GitAPI.vb
├── 其他功能/               # 辅助功能
│   ├── 插件管理.vb
│   ├── 性能统计.vb
│   └── 启动参数响应.vb
└── Resources/              # 资源文件
    ├── 语言_en.json
    └── 语言_zh.json
```

### 3.2 核心代码示例

#### 编码任务执行逻辑

```vb
Public Sub 开始()
    状态 = 编码状态.正在处理
    ' 1. 生成 AviSynth/VapourSynth 脚本（如需要）
    If 预设数据.视频参数_视频帧服务器_使用AviSynth Then
        ' ... 脚本生成逻辑
    End If

    ' 2. 计算输出路径
    输出文件 = 计算输出位置(输入文件, 预设数据.输出容器, 预设数据, 自定义输出位置)

    ' 3. 生成 FFmpeg 命令行
    命令行 = 预设管理.将预设数据转换为命令行(预设数据, 输入文件, 输出文件)

    ' 4. 创建并启动 FFmpeg 进程
    FFmpegProcess = New Process()
    FFmpegProcess.StartInfo.FileName = "ffmpeg"
    FFmpegProcess.StartInfo.Arguments = 命令行
    FFmpegProcess.StartInfo.RedirectStandardOutput = True
    FFmpegProcess.StartInfo.RedirectStandardError = True
    FFmpegProcess.Start()
    FFmpegProcess.BeginOutputReadLine()
    FFmpegProcess.BeginErrorReadLine()

    ' 5. 设置系统状态（阻止休眠）
    设定系统状态()
End Sub
```

#### 进度解析逻辑

```vb
Public Sub FFmpegOutputHandler(sender As Object, e As DataReceivedEventArgs)
    If e.Data Is Nothing Then Exit Sub

    ' 解析进度信息
    If e.Data.Contains("="c) Then
        在实时输出中提取数据(e.Data)  ' 提取 frame/fps/q/size/time/bitrate/speed
        处理捕获的数据并添加到刷新队列()
    End If

    ' 错误检测
    If 错误输出匹配字符串列表.Any(Function(keyword) e.Data.Contains(keyword)) Then
        错误列表.Add(e.Data)
    End If
End Sub
```

#### 命令行生成示例

```vb
Shared Function 将预设数据转换为命令行(...) As String
    Dim arg As String = "-hide_banner -nostdin "

    ' 解码参数
    If a.解码参数_解码器 <> "" Then arg &= $"-hwaccel {a.解码参数_解码器} "

    ' 输入文件
    arg &= $"-i ""{输入文件}"" "

    ' 视频编码器
    If a.视频参数_编码器_具体编码 <> "" Then
        视频参数 &= $"-c:v {a.视频参数_编码器_具体编码} "
    End If

    ' 质量控制
    If a.视频参数_质量控制_参数名 = "crf" Then
        视频参数 &= $"-crf {a.视频参数_质量控制_值} "
    End If

    ' 视频滤镜
    If 视频滤镜参数集.Count > 0 Then
        视频参数 &= $"-vf {String.Join(",", 视频滤镜参数集)} "
    End If

    Return arg & 视频参数 & 音频参数 & ... & $"""{输出文件}"""
End Function
```

### 3.3 Rebebuca 代码结构

```
rebebuca/
├── src/
│   ├── stores/              # Pinia 状态管理
│   │   ├── taskManager.ts   # 任务管理核心 (81KB)
│   │   ├── runConfig.ts     # 运行配置 (26KB)
│   │   ├── terminal.ts      # 终端状态 (34KB)
│   │   └── settings.ts     # 设置管理
│   ├── components/          # Vue 组件
│   │   ├── TaskSidebar.vue  # 任务侧边栏 (61KB)
│   │   ├── ConsoleArea.vue  # 控制台区域 (38KB)
│   │   └── TerminalView.vue # 终端视图 (45KB)
│   ├── services/           # 业务服务
│   │   └── authService.ts
│   ├── composables/         # Vue 组合式函数
│   ├── adapters/           # 适配器层
│   │   ├── node.js.ts       # Node.js 适配器
│   │   ├── server.ts       # 服务器适配器
│   │   └── mock.ts        # Mock 适配器
│   └── main.ts
├── src-node.js/             # Rust 后端
│   └── src/
│       └── main.rs
└── package.json
```

### 3.4 Rebebuca 核心代码示例

#### 任务执行逻辑 (TypeScript)

```typescript
// stores/taskManager.ts
const executeTask = async (task: Task) => {
  // 1. 创建新标签页
  const tab = createTab(task);

  // 2. 执行命令（通过 Node.js 调用系统命令）
  const process = await invoke('spawn_command', {
    command: task.command,
    args: task.args,
    cwd: task.workingDirectory
  });

  // 3. 监听输出
  process.onData((data: string) => {
    updateTabOutput(tab.id, data);
    parseProgress(data);
  });

  // 4. 管理状态
  tab.status = 'running';
};
```

---

## 四、核心功能模块分析

### 4.1 FFmpegFreeUI 核心功能

#### 4.1.1 预设系统

**设计特点**:
- 基于 JSON 文件的预设存储
- 超过 180 个参数项的完整配置
- 支持预设导入/导出
- 每个任务独立保存快照

**数据结构** (预设数据类型.vb):
```vb
Public Class 预设数据类型
    ' 输出容器和命名
    Public Property 输出容器 As String = ""
    Public Property 输出命名_使用自动命名 As Boolean = False

    ' 解码参数
    Public Property 解码参数_解码器 As String = ""
    Public Property 解码参数_指定硬件的参数名 As String = ""

    ' 视频编码器 (40+ 编码器)
    Public Property 视频参数_编码器_类别 As String = ""
    Public Property 视频参数_编码器_具体编码 As String = ""
    Public Property 视频参数_编码器_编码预设 As String = ""

    ' 质量控制 (CRF/VBR/VBR HQ/CQP/CBR)
    Public Property 视频参数_比特率_控制方式 As String = ""
    Public Property 视频参数_质量控制_参数名 As String = ""
    Public Property 视频参数_质量控制_值 As String = ""

    ' 视频滤镜 (裁剪/缩放/插帧/超分/烧字幕/色彩管理/降噪/锐化等)
    Public Property 视频参数_分辨率 As String = ""
    Public Property 视频参数_烧录字幕_滤镜选择 As String = ""
    Public Property 视频参数_色彩管理_像素格式 As String = ""

    ' 音频编码器 (20+ 编码器)
    Public Property 音频参数_编码器_具体编码 As String = ""
    Public Property 音频参数_比特率 As String = ""

    ' 剪辑区间
    Public Property 剪辑区间_入点 As String = ""
    Public Property 剪辑区间_出点 As String = ""

    ' 流控制
    Public Property 流控制_启用保留其他视频流 As Boolean = False

    ' ... 更多参数
End Class
```

#### 4.1.2 任务队列管理

**核心特性**:
- 基于 List(Of 单片任务) 的内存队列
- 支持多任务并发（可配置并发数）
- 支持任务暂停/恢复/停止
- 实时进度显示和预测

**队列管理逻辑**:
```vb
Public Class 单片任务
    Public Property 状态 As 编码状态
    Public Property FFmpegProcess As Process
    Public Property 任务耗时计时器 As Stopwatch

    Public Sub 开始()
        ' 启动 FFmpeg 进程
        ' 监听输出
        ' 更新状态
    End Sub

    Public Sub 暂停()
        NtSuspendProcess(FFmpegProcess.Handle)
    End Sub

    Public Sub 恢复()
        NtResumeProcess(FFmpegProcess.Handle)
    End Sub
End Class
```

#### 4.1.3 进度解析与实时显示

**解析方式**:
- 使用正则表达式解析 FFmpeg 输出
- 提取: frame、fps、q、size、time、bitrate、speed
- 计算进度百分比和剩余时间

**关键正则表达式**:
```vb
Public Shared ReadOnly DurationPattern As New Regex("Duration:\s*(\d+:\d{2}:\d{2}\.\d{2})")
Public Shared ReadOnly FramePattern As New Regex("frame=\s*(?<value>\d+)")
Public Shared ReadOnly FpsPattern As New Regex("fps=\s*(?<value>\d+)")
Public Shared ReadOnly QPattern As New Regex("q=\s*(?<value>[\d\.]+)")
Public Shared ReadOnly SizePattern As New Regex("size=\s*(?<value>\d+)\s*(?<unit>[KMG]iB)")
Public Shared ReadOnly TimePattern As New Regex("time=\s*(?<value>\d+:\d{2}:\d{2}\.\d{2})")
Public Shared ReadOnly BitratePattern As New Regex("bitrate=\s*(?<value>[\d\.]+)\s*kbits/s")
Public Shared ReadOnly SpeedPattern As New Regex("speed=\s*(?<value>[\d\.eE\+\-]+)\s*x")
```

#### 4.1.4 插件系统

**设计理念**:
- 反射 + 特性 + 动态调用
- 不需要引用主程序
- 支持添加自定义界面和任务

**插件接口**:
```vb
' 添加 WinForm 界面
Public Shared Property HostCall_AddCustomWinformPanel As Action(Of String, Control)

' 添加 WPF 界面
Public Shared Property HostCall_AddCustomWpfPanel As Action(Of String, UIElement)

' 使用命令行添加任务
Public Shared Property HostCall_AddMissionToQueueWithArgs As Action(Of String, String, String, String)

' 使用预设文件添加任务
Public Shared Property HostCall_AddMissionToQueueWith3fuiFile As Action(Of String, String, String, String)
```

### 4.2 Rebebuca 核心功能

#### 4.2.1 配置管理

**设计特点**:
- 基于 Pinia 的响应式状态管理
- 支持命令行、工作目录、环境变量
- 配置持久化到本地存储

#### 4.2.2 终端集成

**核心特性**:
- 基于 xterm.js 的 Web 终端
- 支持多标签页同时运行
- 实时输出和进度显示
- 支持选择外部系统终端

#### 4.2.3 适配器架构

**设计理念**:
- 统一接口，多种后端
- 支持 Mock/Server/Node.js 三种模式
- 便于测试和切换环境

---

## 五、融合可行性评估

### 5.1 技术兼容性分析

#### ❌ 直接集成方案（不推荐）

| 方案 | 难度 | 风险 | 说明 |
|------|------|------|------|
| **直接移植代码** | 🔴 极高 | 极高 | VB.NET 代码无法直接移植到 TypeScript/Vue 生态 |
| **嵌入运行** | 🔴 高 | 高 | 需要在 Node.js 中嵌入 .NET 运行时，架构复杂 |
| **进程通信** | 🟡 中 | 中 | 通过 IPC 通信，但需要重构大量代码 |

#### ⚠️ 功能借鉴方案（推荐）

| 方案 | 难度 | 风险 | 说明 |
|------|------|------|------|
| **参数生成逻辑** | 🟢 低 | 低 | 提取 FFmpeg 参数生成算法，用 TypeScript 重写 |
| **进度解析器** | 🟢 低 | 低 | 重用正则表达式逻辑 |
| **预设数据结构** | 🟢 低 | 低 | 参考预设数据类型，设计适合的 JSON Schema |
| **UI布局参考** | 🟡 中 | 低 | 仅参考布局设计，不复制代码 |

### 5.2 具体功能融合建议

#### 5.2.1 FFmpeg 参数生成器（推荐融合）

**FFmpegFreeUI 的优势**:
- 涵盖 40+ 视频编码器、20+ 音频编码器
- 完整的视频参数覆盖（分辨率、帧率、滤镜、色彩管理等）
- 智能的命令行生成逻辑

**融合方案**:

```typescript
// stores/ffmpegParams.ts (新建)
interface FFmpegPreset {
  // 基础配置
  outputContainer: string;
  outputNaming: {
    useAutoNaming: boolean;
    autoNamingOption: number;
    prefix: string;
    suffix: string;
  };

  // 解码参数
  decoder: {
    decoder: string;
    hwaccel: string;
    hwaccelDevice: string;
  };

  // 视频编码器
  video: {
    encoderCategory: string;
    encoder: string;
    preset: string;
    profile: string;
    tune: string;
  };

  // 质量控制
  quality: {
    controlMode: 'CRF' | 'VBR' | 'VBR_HQ' | 'CQP' | 'CBR';
    paramName: 'crf' | 'cq' | 'qp' | 'global_quality';
    value: string;
    bitrate: {
      base: string;
      min: string;
      max: string;
      bufferSize: string;
    };
  };

  // 视频滤镜
  filters: {
    resolution: string;
    crop: string;
    framerate: string;
    deinterlace: number;
    denoise: {
      mode: string;
      params: string[];
    };
    subtitle: {
      enable: boolean;
      source: 'embedded' | 'external';
      file: string;
      styling: SubtitleStyling;
    };
    colorManagement: {
      pixelFormat: string;
      colorSpace: string;
      transfer: string;
      primaries: string;
    };
  };

  // 音频编码
  audio: {
    encoder: string;
    bitrate: string;
    channels: string;
    sampleRate: string;
  };

  // 剪辑区间
  trimming: {
    enabled: boolean;
    startTime: string;
    endTime: string;
  };

  // 自定义参数
  custom: {
    videoFilter: string;
    audioFilter: string;
    videoParams: string;
    audioParams: string;
    preParams: string;
    postParams: string;
    fullCustom: string;
  };
}

// 参数生成函数
export const generateFFmpegCommand = (
  preset: FFmpegPreset,
  inputFile: string,
  outputFile: string
): string => {
  const args: string[] = [];

  // 1. 基础参数
  args.push('-hide_banner', '-nostdin');

  // 2. 解码参数
  if (preset.decoder.decoder) {
    args.push('-hwaccel', preset.decoder.decoder);
  }

  // 3. 输入文件
  args.push('-i', `"${inputFile}"`);

  // 4. 视频编码器
  if (preset.video.encoder) {
    args.push('-c:v', preset.video.encoder);
  }

  // 5. 质量控制
  if (preset.quality.controlMode === 'CRF') {
    args.push('-crf', preset.quality.value);
  } else if (preset.quality.controlMode === 'VBR') {
    args.push('-rc', 'vbr');
    if (preset.quality.bitrate.base) {
      args.push('-b:v', preset.quality.bitrate.base);
    }
  }

  // 6. 视频滤镜
  const filters: string[] = [];
  if (preset.filters.resolution) {
    filters.push(`scale=${preset.filters.resolution}`);
  }
  if (preset.filters.crop) {
    filters.push(`crop=${preset.filters.crop}`);
  }
  if (preset.filters.subtitle.enable) {
    filters.push(`subtitles=${preset.filters.subtitle.file}`);
  }
  if (filters.length > 0) {
    args.push('-vf', filters.join(','));
  }

  // 7. 音频编码
  if (preset.audio.encoder) {
    args.push('-c:a', preset.audio.encoder);
  }

  // 8. 输出文件
  args.push(`"${outputFile}"`);

  return args.join(' ');
};
```

**实施步骤**:
1. 定义 TypeScript 接口，参考预设数据类型.vb
2. 提取命令行生成逻辑，用 TypeScript 重写
3. 创建 Vue 组件用于参数配置
4. 集成到 Rebebuca 的任务系统中

#### 5.2.2 进度解析器（推荐融合）

**FFmpegFreeUI 的优势**:
- 完善的正则表达式
- 实时数据提取
- 进度百分比和剩余时间计算

**融合方案**:

```typescript
// utils/ffmpegProgressParser.ts (新建)
export interface FFmpegProgress {
  frame?: number;
  fps?: number;
  q?: number;
  size?: number;
  sizeUnit?: string;
  time?: string; // HH:MM:SS.mmm
  bitrate?: number;
  speed?: number;
  progress?: number; // 0-100
  estimatedSize?: number;
  remainingTime?: number; // seconds
}

const PATTERNS = {
  duration: /Duration:\s*(\d+:\d{2}:\d{2}\.\d{2})/,
  frame: /frame=\s*(\d+)/,
  fps: /fps=\s*(\d+)/,
  q: /q=\s*([\d\.]+)/,
  size: /size=\s*(\d+)\s*([KMG]iB)/,
  time: /time=\s*(\d+:\d{2}:\d{2}\.\d{2})/,
  bitrate: /bitrate:\s*([\d\.]+)\s*kbits\/s/,
  speed: /speed=\s*([\d\.eE\+\-]+)\s*x/
};

export const parseFFmpegProgress = (
  line: string,
  duration: number | null = null
): FFmpegProgress | null => {
  const progress: FFmpegProgress = {};

  // 提取各字段
  const frameMatch = line.match(PATTERNS.frame);
  if (frameMatch) progress.frame = parseInt(frameMatch[1]);

  const fpsMatch = line.match(PATTERNS.fps);
  if (fpsMatch) progress.fps = parseInt(fpsMatch[1]);

  const qMatch = line.match(PATTERNS.q);
  if (qMatch) progress.q = parseFloat(qMatch[1]);

  const sizeMatch = line.match(PATTERNS.size);
  if (sizeMatch) {
    progress.size = parseInt(sizeMatch[1]);
    progress.sizeUnit = sizeMatch[2];
  }

  const timeMatch = line.match(PATTERNS.time);
  if (timeMatch) {
    progress.time = timeMatch[1];

    // 计算进度百分比
    if (duration !== null) {
      const currentTime = parseTimeString(timeMatch[1]);
      progress.progress = Math.min((currentTime / duration) * 100, 100);
    }
  }

  const bitrateMatch = line.match(PATTERNS.bitrate);
  if (bitrateMatch) progress.bitrate = parseFloat(bitrateMatch[1]);

  const speedMatch = line.match(PATTERNS.speed);
  if (speedMatch) progress.speed = parseFloat(speedMatch[1]);

  // 计算剩余时间和预估大小
  if (duration !== null && progress.speed && progress.time) {
    const currentTime = parseTimeString(progress.time);
    const remainingSeconds = (duration - currentTime) / progress.speed;
    progress.remainingTime = remainingSeconds;

    if (progress.size) {
      const sizeInKB = convertSizeToKB(progress.size, progress.sizeUnit || 'KiB');
      progress.estimatedSize = sizeInKB / (progress.progress || 1) / 100;
    }
  }

  return Object.keys(progress).length > 0 ? progress : null;
};

// 工具函数
const parseTimeString = (timeStr: string): number => {
  const [hours, minutes, seconds] = timeStr.split(':').map(parseFloat);
  return hours * 3600 + minutes * 60 + seconds;
};

const convertSizeToKB = (value: number, unit: string): number => {
  switch (unit.toUpperCase()) {
    case 'KIB': return value;
    case 'MIB': return value * 1024;
    case 'GIB': return value * 1024 * 1024;
    default: return value;
  }
};
```

**实施步骤**:
1. 提取正则表达式和解析逻辑
2. 创建 TypeScript 工具函数
3. 集成到 Rebebuca 的终端输出处理中
4. 添加进度条显示组件

#### 5.2.3 预设系统（可选融合）

**FFmpegFreeUI 的优势**:
- 完整的预设结构
- 丰富的参数选项
- 支持导入导出

**融合方案**:

```typescript
// stores/ffmpegPresets.ts (新建)
import { defineStore } from 'pinia';
import { FFmpegPreset } from './ffmpegParams';

export const useFFmpegPresetsStore = defineStore('ffmpegPresets', {
  state: () => ({
    presets: [] as FFmpegPreset[],
    currentPreset: null as FFmpegPreset | null,
  }),

  actions: {
    // 从文件加载预设
    async loadPreset(filePath: string): Promise<FFmpegPreset> {
      const content = await readFile(filePath, { encoding: 'utf-8' });
      return JSON.parse(content);
    },

    // 保存预设到文件
    async savePreset(preset: FFmpegPreset, filePath: string): Promise<void> {
      const content = JSON.stringify(preset, null, 2);
      await writeFile(filePath, content, { encoding: 'utf-8' });
    },

    // 从 3FUI 预设文件导入
    async importFrom3FUI(filePath: string): Promise<FFmpegPreset> {
      const content = await readFile(filePath, { encoding: 'utf-8' });
      const oldPreset = JSON.parse(content);

      // 映射字段名（从 PascalCase 到 camelCase）
      return {
        outputContainer: oldPreset.输出容器,
        video: {
          encoderCategory: oldPreset.视频参数_编码器_类别,
          encoder: oldPreset.视频参数_编码器_具体编码,
          // ... 更多映射
        },
        // ...
      };
    },

    // 导出到 3FUI 格式
    async exportTo3FUI(preset: FFmpegPreset, filePath: string): Promise<void> {
      const oldPreset = {
        输出容器: preset.outputContainer,
        视频参数_编码器_类别: preset.video.encoderCategory,
        视频参数_编码器_具体编码: preset.video.encoder,
        // ... 更多映射
      };

      const content = JSON.stringify(oldPreset, null, 2);
      await writeFile(filePath, content, { encoding: 'utf-8' });
    },
  },
});
```

**实施步骤**:
1. 定义新的预设存储结构
2. 实现预设的导入导出功能
3. 支持与 3FUI 格式的互转
4. 创建预设管理 UI 组件

---

## 六、风险评估

### 6.1 技术风险

| 风险项 | 等级 | 影响 | 缓解措施 |
|--------|------|------|---------|
| **VB.NET 代码无法直接复用** | 🔴 高 | 需要重写所有业务逻辑 | 采用功能借鉴而非代码移植 |
| **FFmpeg 参数复杂性** | 🟡 中 | 参数众多，容易遗漏 | 参考 3FUI 的完整参数列表，逐步实现 |
| **UI 重构工作量大** | 🟡 中 | 需要重新设计界面 | 参考布局，简化参数展示方式 |
| **进程控制差异** | 🟡 中 | Windows API vs Node.js | 使用 Node.js 的进程管理 API |
| **插件系统不兼容** | 🟢 低 | 插件架构完全不同 | 设计新的插件系统，不考虑兼容 |

### 6.2 业务风险

| 风险项 | 等级 | 影响 | 缓解措施 |
|--------|------|------|---------|
| **用户习惯差异** | 🟡 中 | 3FUI 用户可能不适应 | 提供两种模式：简单模式和专家模式 |
| **功能缺失风险** | 🟡 中 | 可能无法覆盖所有 3FUI 功能 | 分阶段实现，优先核心功能 |
| **维护成本增加** | 🟢 低 | 需要维护两套代码 | 模块化设计，降低耦合度 |

### 6.3 法律风险

| 风险项 | 等级 | 影响 | 缓解措施 |
|--------|------|------|---------|
| **许可证冲突** | 🟢 低 | 3FUI 是 MIT，Rebebuca 是 GPL-3.0 | MIT 许可证代码可以集成到 GPL-3.0 项目 |
| **第三方库依赖** | 🟢 低 | SunnyUI 是 GPL-3.0 | 不直接使用 SunnyUI，仅参考设计 |

---

## 七、融合方案建议

### 7.1 方案 A：渐进式功能融合（推荐）

**目标**: 将 FFmpegFreeUI 的核心功能逐步集成到 Rebebuca

**阶段 1: 参数生成器 (2-3 周)**
- 创建 FFmpeg 参数生成模块
- 实现基础的视频/音频编码参数
- 提供命令行预览功能

**阶段 2: 进度解析器 (1 周)**
- 集成 FFmpeg 进度解析器
- 实现实时进度显示
- 添加剩余时间和预估大小计算

**阶段 3: 预设系统 (1-2 周)**
- 实现预设管理功能
- 支持导入导出 3FUI 预设
- 提供预设模板库

**阶段 4: 高级功能 (2-3 周)**
- 视频滤镜支持（裁剪、缩放、烧字幕等）
- 色彩管理
- 剪辑区间

**阶段 5: 优化完善 (1-2 周)**
- 性能优化
- 用户体验优化
- 文档和教程

**总工期**: 7-11 周

**优点**:
- 风险可控，分阶段实施
- 可以在每个阶段验证功能
- 不影响现有 Rebebuca 功能

**缺点**:
- 需要较长时间完成
- 功能可能不如 3FUI 完善

### 7.2 方案 B：独立插件方案

**目标**: 在 Rebebuca 中开发 FFmpeg 专用插件

**技术方案**:
```typescript
// plugins/ffmpeg-tool.ts
export const FFmpegTool = {
  id: 'ffmpeg',
  name: 'FFmpeg Encoder',
  icon: 'video',
  version: '1.0.0',

  // 配置面板
  configPanel: defineAsyncComponent(() => import('./FFmpegConfigPanel.vue')),

  // 执行任务
  async execute(config: FFmpegConfig) {
    const command = generateFFmpegCommand(config);
    return await spawnCommand(command);
  },

  // 解析进度
  parseProgress(line: string) {
    return parseFFmpegProgress(line);
  },

  // 支持的预设格式
  presetFormats: ['3fui', 'json'],

  // 导入预设
  async importPreset(file: File): Promise<FFmpegPreset> {
    const content = await file.text();
    if (file.name.endsWith('.3fui')) {
      return parse3FUIPreset(content);
    }
    return JSON.parse(content);
  },
};
```

**优点**:
- 模块化，不影响主程序
- 可以独立开发和测试
- 用户可选是否安装

**缺点**:
- 与 Rebebuca 主功能集成度低
- 需要设计插件 API

### 7.3 方案 C：独立应用方案

**目标**: 基于 Rebebuca 架构开发独立的 FFmpeg 转码工具

**技术方案**:
- 复用 Rebebuca 的基础架构（Node.js + Vue 3）
- 借鉴 FFmpegFreeUI 的功能设计
- 开发全新的 UI 和交互

**优点**:
- 可以完全按照 FFmpeg 需求设计
- 不受 Rebebuca 现有架构限制
- 可以作为独立项目发布

**缺点**:
- 开发成本最高
- 需要独立维护

---

## 八、关键代码示例

### 8.1 FFmpeg 参数生成核心逻辑

```typescript
// 参考自 FFmpegFreeUI/编码任务/预设管理.vb
export const buildVideoFilters = (preset: FFmpegPreset): string[] => {
  const filters: string[] = [];

  // 1. 逐行/隔行转换
  if (preset.filters.deinterlace !== 0) {
    const deinterlaceModes = {
      1: 'yadif=0:-1:0',   // 自动
      2: 'yadif=0:0:0',     // 顶部
      3: 'yadif=0:1:0',     // 底部
      4: 'tinterlace=4',       // TFF
      5: 'tinterlace=6',       // BFF
      6: 'fieldmatch,yadif=deint=interlaced,decimate', // IVTC
      7: 'yadif=1',          // 帧加倍
    };
    filters.push(deinterlaceModes[preset.filters.deinterlace]);
  }

  // 2. 分辨率和裁剪
  if (preset.filters.crop) {
    filters.push(`crop=${preset.filters.crop}`);
  }
  if (preset.filters.resolution) {
    filters.push(`scale=${preset.filters.resolution}`);
  }

  // 3. 帧率
  if (preset.filters.framerate) {
    filters.push(`fps=${preset.filters.framerate}`);
  }

  // 4. 烧字幕
  if (preset.filters.subtitle.enable) {
    if (preset.filters.subtitle.source === 'external') {
      filters.push(`subtitles='${escapePath(preset.filters.subtitle.file)}'`);
    } else {
      filters.push(`subtitles=${preset.filters.subtitle.streamIndex}`);
    }
  }

  // 5. 色彩管理
  if (preset.filters.colorManagement.pixelFormat) {
    filters.push(`format=${preset.filters.colorManagement.pixelFormat}`);
  }
  if (preset.filters.colorManagement.colorSpace) {
    filters.push(`colormatrix=${preset.filters.colorManagement.colorSpace}`);
  }

  return filters;
};
```

### 8.2 进度解析核心逻辑

```typescript
// 参考自 FFmpegFreeUI/编码任务/编码任务.vb
export const extractProgressInfo = (line: string): FFmpegProgress => {
  const info: FFmpegProgress = {};

  const frameMatch = line.match(/frame=\s*(\d+)/);
  if (frameMatch) info.frame = parseInt(frameMatch[1]);

  const fpsMatch = line.match(/fps=\s*(\d+)/);
  if (fpsMatch) info.fps = parseInt(fpsMatch[1]);

  const qMatch = line.match(/q=\s*([\d\.]+)/);
  if (qMatch) info.q = parseFloat(qMatch[1]);

  const sizeMatch = line.match(/size=\s*(\d+)\s*([KMG]iB)/);
  if (sizeMatch) {
    info.size = parseInt(sizeMatch[1]);
    info.sizeUnit = sizeMatch[2];
  }

  const timeMatch = line.match(/time=\s*(\d+:\d{2}:\d{2}\.\d{2})/);
  if (timeMatch) {
    info.time = timeMatch[1];
  }

  const bitrateMatch = line.match(/bitrate:\s*([\d\.]+)\s*kbits\/s/);
  if (bitrateMatch) info.bitrate = parseFloat(bitrateMatch[1]);

  const speedMatch = line.match(/speed=\s*([\d\.eE\+\-]+)\s*x/);
  if (speedMatch) info.speed = parseFloat(speedMatch[1]);

  return info;
};

export const calculateProgress = (
  currentTime: string,
  duration: string | null
): number => {
  if (!duration) return 0;

  const currentSeconds = timeToSeconds(currentTime);
  const durationSeconds = timeToSeconds(duration);

  return Math.min((currentSeconds / durationSeconds) * 100, 100);
};

const timeToSeconds = (timeStr: string): number => {
  const [hours, minutes, seconds] = timeStr.split(':').map(parseFloat);
  return hours * 3600 + minutes * 60 + seconds;
};
```

---

## 九、总结与建议

### 9.1 技术调研结论

1. **技术栈差异极大**: FFmpegFreeUI (VB.NET + WinForms) 与 Rebebuca (Vue 3 + Node.js) 属于完全不同的技术生态，直接移植代码不可行。

2. **功能借鉴价值高**: FFmpegFreeUI 在 FFmpeg 参数生成、进度解析、预设管理等方面有丰富的经验，值得借鉴。

3. **融合可行性**: 采用"功能借鉴 + 重新实现"的方案，可以逐步将 FFmpegFreeUI 的核心功能集成到 Rebebuca。

### 9.2 推荐方案

**推荐方案 A: 渐进式功能融合**

**理由**:
- 风险可控，可以分阶段实施
- 不会影响 Rebebuca 现有功能
- 可以根据用户反馈调整开发优先级
- 技术团队可以逐步学习和适应 FFmpeg 相关知识

### 9.3 实施建议

1. **先做 MVP**: 实现基础的视频转码功能，验证技术可行性
2. **参考 3FUI 设计**: 在参数布局、交互方式上参考 3FUI
3. **保持简洁**: 不需要一开始就实现 3FUI 的所有功能
4. **逐步完善**: 根据用户需求逐步添加高级功能
5. **文档完善**: 提供详细的 FFmpeg 参数说明，帮助用户理解

### 9.4 下一步行动

1. **技术评审**: 组织团队评审本调研报告，确认技术方案
2. **原型设计**: 设计 FFmpeg 参数配置界面的原型
3. **开发计划**: 制定详细的开发计划和里程碑
4. **风险预案**: 制定风险应对预案

---

## 附录 A: FFmpegFreeUI 核心文件清单

| 文件路径 | 大小 | 功能说明 |
|---------|------|---------|
| `编码任务/预设管理.vb` | 119KB | 预设管理和命令行生成核心 |
| `编码任务/编码任务.vb` | 39KB | 任务执行和进度监控 |
| `编码任务/预设数据类型.vb` | 11KB | 预设数据结构定义 |
| `界面/界面_常规流程参数_V2.vb` | 59KB | 参数面板逻辑 |
| `界面/界面_常规流程参数_V2.Designer.vb` | 452KB | 参数界面设计 |
| `模块/Module1.vb` | 22KB | 全局工具函数 |

## 附录 B: Rebebuca 核心文件清单

| 文件路径 | 大小 | 功能说明 |
|---------|------|---------|
| `stores/taskManager.ts` | 81KB | 任务管理核心 |
| `stores/terminal.ts` | 34KB | 终端状态管理 |
| `components/TaskSidebar.vue` | 61KB | 任务侧边栏 |
| `components/TerminalView.vue` | 45KB | 终端视图组件 |
| `components/ConsoleArea.vue` | 38KB | 控制台区域 |

---

**调研完成日期**: 2026-01-24
**文档版本**: 1.0
**审核状态**: 待审核
