# Local Release

本项目已改为 **Node.js + Nuxt** 架构，**通过 npm 发布**，不再构建 Tauri 桌面应用或 Rust 远程服务器。

## 正式发布（推荐）

使用统一发布脚本，推 tag 后由 GitHub Actions 自动构建并发布到 npm：

```bash
./scripts/release.sh <version>   # 例如 0.5.6
```

会完成：更新 `package.json` 版本、提交、打 tag `vX.Y.Z`、推送；CI 执行 `build:server-app` 后 `pnpm publish`。

## 可选：本地构建 remote-agent

仅当需要单独构建轻量级远程执行器（Rust）时使用：

- **macOS（universal）**: `./scripts/build-macos.sh`
- **Linux（musl）**: 在 `remote-agent/` 下执行 `./build-agents.sh`（需 musl 交叉编译环境）

产物仅用于自用或单独分发，不参与 npm 包内容。

## 历史说明

此前通过 S3/R2 发布 Tauri 桌面应用与 remote-agent-server 的流程已废弃；远程运行现使用同一套 node-server 部署即可。
