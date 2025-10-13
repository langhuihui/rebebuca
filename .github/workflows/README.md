# GitHub Actions 工作流说明

## 构建工作流 (build.yml)

这个工作流会自动构建 Tauri 应用程序到 Windows 和 macOS 平台。

### 触发条件

- **推送到 main 分支**: 每次推送代码到 main 分支时自动构建
- **创建版本标签**: 创建 `v*` 格式的标签时（例如 `v1.0.0`）
- **Pull Request**: 当有 PR 提交到 main 分支时
- **手动触发**: 在 GitHub Actions 页面手动运行

### 构建平台

1. **macOS**: 构建 Universal Binary（同时支持 Intel 和 Apple Silicon）
   - 输出格式: `.dmg` 和 `.app`
   
2. **Windows**: 构建 x64 可执行文件
   - 输出格式: `.msi` 和 `.exe` (NSIS安装器)

### 构建产物

构建完成后，产物会自动上传为 GitHub Actions Artifacts：
- `macos-build`: macOS 构建产物
- `windows-build`: Windows 构建产物

你可以在 Actions 页面下载这些产物。

### 发布版本

当你创建一个版本标签时（例如 `v0.1.0`），工作流会：
1. 构建所有平台
2. 自动创建 GitHub Release
3. 将所有构建产物附加到 Release 中

#### 如何发布版本

```bash
# 确保所有更改已提交
git add .
git commit -m "准备发布 v0.1.0"

# 创建并推送标签
git tag v0.1.0
git push origin main
git push origin v0.1.0
```

### 注意事项

- 确保 `package.json` 和 `src-tauri/tauri.conf.json` 中的版本号一致
- macOS 构建需要大约 15-20 分钟
- Windows 构建需要大约 10-15 分钟
- 如果需要签名，需要配置相应的密钥和证书

