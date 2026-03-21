# Local Release

本项目已改为 **Node.js + Nuxt** 架构，**通过 npm 发布**，不再构建 Tauri 桌面应用或 Rust 远程服务器。

## 正式发布（推荐）

使用统一发布脚本，推 tag 后由 GitHub Actions 自动构建并发布到 npm：

```bash
./scripts/release.sh <version>   # 例如 0.5.6
```

会完成：更新 `package.json` 版本、提交、打 tag `vX.Y.Z`、推送；CI 执行 `build:server-app` 后 `pnpm publish`。

## 历史说明

早期曾通过 Tauri 桌面应用与独立 Rust 远程组件分发；当前架构为 **Node + Nuxt + npm**，远程能力由 **node-server**（含 WebSocket、`ssh2` 远程执行等）提供。
