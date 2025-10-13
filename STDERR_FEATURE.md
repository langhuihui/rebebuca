# Stderr 错误处理功能

## 新增功能

本次更新添加了对进程输出的 stdout 和 stderr 的区分处理功能：

### 1. 输出类型区分
- **stdout**: 正常输出，直接显示在控制台
- **stderr**: 错误输出，带有 `[ERROR]` 前缀显示
- **system**: 系统消息

### 2. 错误标识
- 当进程产生 stderr 输出时，该输出会被标记为 `[ERROR] 错误内容`
- Tab 标签页的状态指示灯会变成红色 🔴
- 错误输出会被完整记录到历史记录中

### 3. 系统通知
- 当收到 stderr 输出时，会自动发送操作系统级别的通知
- 通知标题：`错误: [配置名称]`
- 通知内容：错误消息的前 100 个字符

### 4. 历史记录
- 所有包含 stderr 的运行历史会被标记
- 查看历史时，如果包含错误输出，标签灯也会显示为红色

## 测试方法

### 使用测试脚本
1. 在应用中创建一个新的运行配置
2. 命令设置为：`./test-stderr.sh`
3. 工作目录设置为项目根目录
4. 运行该配置

预期结果：
- 控制台会显示正常输出和带 `[ERROR]` 前缀的错误输出
- Tab 的状态灯会变成红色
- 收到系统通知提示有错误发生

### 使用简单命令测试
创建配置，使用以下命令：
```bash
bash -c 'echo "正常输出"; echo "错误输出" >&2'
```

## 技术实现

### 前端 (Vue)
- 修改 `Tab` 接口，添加 `hasError` 字段
- 更新 `appendOutputToTab` 函数，根据输出类型添加前缀
- 修改 `getTabStatusColor` 函数，优先显示错误状态
- 在 `process-output` 事件监听器中集成系统通知

### 后端 (Rust)
- 已支持 stdout 和 stderr 的独立捕获
- 通过 `OutputType` 枚举区分输出类型
- 分别处理两种输出流并发送对应的事件

### 依赖更新
- 添加了 `@tauri-apps/plugin-notification` npm 包
- 添加了 `tauri-plugin-notification` Rust crate
- 更新了 Tauri capabilities 配置，添加通知权限

## 注意事项

1. **TypeScript 类型错误**: 如果看到类型检查错误，请重启 TypeScript 服务器或 IDE
2. **通知权限**: 首次运行时，macOS 可能会请求通知权限，请允许
3. **错误输出识别**: 使用 `[ERROR]` 前缀在输出中明确标识错误内容

## 安装依赖

如果还没有安装新的依赖，请运行：

```bash
pnpm install
```

## 构建和运行

```bash
# 开发模式
pnpm tauri:dev

# 构建
pnpm tauri build
```

