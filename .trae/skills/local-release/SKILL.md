---
name: local release
description: 本地构建并发布 Rebebuca 应用到 S3 存储
---

# Local Release

本地构建并发布 Rebebuca 应用到 S3 存储。

## 使用场景

当需要在本地构建 macOS/Linux 版本并发布到 S3 存储时使用此 skill。

## 版本管理策略

- **统一版本号**: macOS 桌面、Windows 桌面、Linux 远程服务器使用相同版本号（如 0.5.3）
- **分批发布**: 可以先发布代码和某平台的构建产物，后续补上其他平台的产物
- **智能检测**: 版本检查会同时检测版本号和当前平台的下载产物是否存在
- **简化格式**: `releases.json` 保持简单格式 `{ latest, releases }`

## 发布范围

- **macOS**: 完整的桌面应用（universal binary）
- **Windows**: 完整的桌面应用（通过 GitHub Actions）
- **Linux**: 仅 remote-agent-server（不包含桌面应用）

## 发布流程

请按以下步骤执行本地发布：

### 1. 确认版本号

首先检查当前版本号，询问用户是否需要更新版本：
- 读取 `package.json` 中的 `version` 字段获取当前版本
- 询问用户新版本号（如 0.5.3）

### 2. 更新版本号（如需要）

如果用户指定了新版本，需要同步更新以下文件中的版本号：
- `package.json` - `"version": "x.x.x"`
- `src-tauri/tauri.conf.json` - `"version": "x.x.x"`
- `src-tauri/Cargo.toml` - `version = "x.x.x"`

### 3. 选择平台

询问用户要构建哪个平台：
- macOS: `./scripts/build-macos.sh`（桌面应用）
- Linux: `./scripts/build-linux.sh`（仅远程服务器）

### 4. macOS 构建步骤

```bash
cd /Users/dexter/project/rebebuca/remote-agent
cargo build --release --target x86_64-apple-darwin --bin rebebuca-remote-agent
cargo build --release --target aarch64-apple-darwin --bin rebebuca-remote-agent
```

创建 universal binary：
```bash
mkdir -p target/universal-apple-darwin/release
lipo -create \
  target/x86_64-apple-darwin/release/rebebuca-remote-agent \
  target/aarch64-apple-darwin/release/rebebuca-remote-agent \
  -output target/universal-apple-darwin/release/rebebuca-remote-agent
```

复制到 src-tauri/build：
```bash
mkdir -p ../src-tauri/build
cp target/x86_64-apple-darwin/release/rebebuca-remote-agent ../src-tauri/build/rebebuca-remote-agent-x86_64-apple-darwin
cp target/aarch64-apple-darwin/release/rebebuca-remote-agent ../src-tauri/build/rebebuca-remote-agent-aarch64-apple-darwin
```

构建 Tauri 应用：
```bash
cd /Users/dexter/project/rebebuca
pnpm install
pnpm tauri build --target universal-apple-darwin
```

### 5. Linux 构建步骤

```bash
cd /Users/dexter/project/rebebuca/remote-agent-server
cargo build --release --target x86_64-unknown-linux-gnu --bin rebebuca-remote-server
```

打包（包含前端静态资源）：
```bash
cd /Users/dexter/project/rebebuca
pnpm install
pnpm build:server
mkdir -p package/rebebuca-remote-server
cp remote-agent-server/target/x86_64-unknown-linux-gnu/release/rebebuca-remote-server package/rebebuca-remote-server/
cp -r dist package/rebebuca-remote-server/
cd package
tar -czvf rebebuca-remote-server-linux-x86_64.tar.gz rebebuca-remote-server
```

### 6. 复制到 S3 挂载目录

**macOS:**
构建产物位于：`src-tauri/target/universal-apple-darwin/release/bundle/`

```bash
VERSION="v0.5.3"  # 使用实际版本号，带 v 前缀
VERSION_NUM="${VERSION#v}"
S3_PATH="/Users/dexter/Library/CloudStorage/S3-S3/monibuca/rb"

# 创建版本目录
mkdir -p "${S3_PATH}/${VERSION}/macos"

# 复制 DMG 到版本根目录
cp "src-tauri/target/universal-apple-darwin/release/bundle/dmg/Rebebuca_${VERSION_NUM}_universal.dmg" "${S3_PATH}/${VERSION}/"

# 复制自动更新包到 macos 子目录
cp src-tauri/target/universal-apple-darwin/release/bundle/macos/Rebebuca.app.tar.gz "${S3_PATH}/${VERSION}/macos/"
cp src-tauri/target/universal-apple-darwin/release/bundle/macos/Rebebuca.app.tar.gz.sig "${S3_PATH}/${VERSION}/macos/"

# 复制 remote-agent 二进制文件到版本根目录
cp remote-agent/target/x86_64-apple-darwin/release/rebebuca-remote-agent "${S3_PATH}/${VERSION}/rebebuca-remote-agent-x86_64-apple-darwin"
cp remote-agent/target/aarch64-apple-darwin/release/rebebuca-remote-agent "${S3_PATH}/${VERSION}/rebebuca-remote-agent-aarch64-apple-darwin"
```

**Linux:**
构建产物位于：`package/rebebuca-remote-server-linux-x86_64.tar.gz` 或 `package/rebebuca-remote-server-linux-aarch64.tar.gz`

```bash
VERSION="v0.5.3"  # 使用实际版本号，带 v 前缀
S3_PATH="/Users/dexter/Library/CloudStorage/S3-S3/monibuca/rb"

# 创建版本目录
mkdir -p "${S3_PATH}/${VERSION}/remote-agent-server"

# 上传 remote-agent-server 包（支持多个架构）
cp package/rebebuca-remote-server-linux-x86_64.tar.gz "${S3_PATH}/${VERSION}/remote-agent-server/" 2>/dev/null || true
cp package/rebebuca-remote-server-linux-aarch64.tar.gz "${S3_PATH}/${VERSION}/remote-agent-server/" 2>/dev/null || true

# 上传 remote-agent 二进制文件到版本根目录（如果有 Linux 版本）
cp remote-agent/target/x86_64-unknown-linux-gnu/release/rebebuca-remote-agent "${S3_PATH}/${VERSION}/rebebuca-remote-agent-x86_64-unknown-linux-gnu" 2>/dev/null || true
```

### 7. 更新 releases.json

```bash
VERSION="v0.5.3"  # 使用实际版本号，带 v 前缀
VERSION_NUM="${VERSION#v}"
DATE=$(date +%Y-%m-%d)
S3_PATH="/Users/dexter/Library/CloudStorage/S3-S3/monibuca/rb"

# 获取最近的提交日志作为 release notes
cd /Users/dexter/project/rebebuca
PREV_TAG=$(git describe --tags --abbrev=0 HEAD^ 2>/dev/null || echo "")
if [ -n "$PREV_TAG" ]; then
  NOTES=$(git log ${PREV_TAG}..HEAD --pretty=format:'- %s' | head -20)
else
  NOTES=$(git log --pretty=format:'- %s' --reverse | head -20)
fi

# 下载现有的 releases.json 或创建新的
RELEASES_FILE="${S3_PATH}/releases.json"
if [ ! -f "$RELEASES_FILE" ] || ! jq empty "$RELEASES_FILE" 2>/dev/null; then
  echo '{"latest":"","releases":[]}' > "$RELEASES_FILE"
fi

# 更新 releases.json
jq --arg version "$VERSION_NUM" \
   --arg date "$DATE" \
   --arg body "$NOTES" \
   '{
     latest: $version,
     releases: ([{version: $version, date: $date, body: $body}] + [.releases[] | select(.version != $version)]) | .[0:20]
   }' "$RELEASES_FILE" > /tmp/releases-new.json

mv /tmp/releases-new.json "$RELEASES_FILE"

echo "Updated releases.json:"
cat "$RELEASES_FILE"
```

### 8. 更新 latest.json

```bash
VERSION="v0.5.3"  # 使用实际版本号，带 v 前缀
VERSION_NUM="${VERSION#v}"
S3_PATH="/Users/dexter/Library/CloudStorage/S3-S3/monibuca/rb"

# 读取签名
MAC_SIG=$(cat src-tauri/target/universal-apple-darwin/release/bundle/macos/Rebebuca.app.tar.gz.sig 2>/dev/null || echo "")

# 生成 latest.json（只包含 macOS 和 Windows）
cat > "${S3_PATH}/latest.json" << EOF
{
  "version": "${VERSION_NUM}",
  "notes": "See release notes",
  "pub_date": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "platforms": {
    "darwin-aarch64": {
      "signature": "${MAC_SIG}",
      "url": "https://download.m7s.live/rb/${VERSION}/macos/Rebebuca.app.tar.gz"
    },
    "darwin-x86_64": {
      "signature": "${MAC_SIG}",
      "url": "https://download.m7s.live/rb/${VERSION}/macos/Rebebuca.app.tar.gz"
    },
    "windows-x86_64": {
      "signature": "",
      "url": "https://download.m7s.live/rb/${VERSION}/rebebuca.msi"
    }
  }
}
EOF

echo "Generated latest.json:"
cat "${S3_PATH}/latest.json"
```

### 9. 创建 Git Tag（可选）

```bash
VERSION="v0.5.3"  # 使用实际版本号，带 v 前缀
cd /Users/dexter/project/rebebuca
git add -A
git commit -m "Release ${VERSION}"
git tag -a "${VERSION}" -m "Release ${VERSION}"
git push origin main --tags
```

## Windows 发布

Windows 版本通过 GitHub Actions 自动构建。推送 tag 即可触发：

```bash
VERSION="v0.5.3"
git tag -a "win-${VERSION}" -m "Release Windows ${VERSION}"
git push origin "win-${VERSION}"
```

Windows 构建后会自动：
1. 构建 Windows 版本
2. 上传构建产物到 R2
3. 更新 releases.json（添加 Windows 签名到 latest.json）
4. 创建 Windows tag

注意：Windows 构建完成后，需要在 S3 上手动补上 Windows 的签名到 `latest.json`，或者让 GitHub Actions 自动处理。

## 文件结构

发布后 S3 目录结构：
```
/monibuca/rb/
├── latest.json               # Tauri 自动更新配置（仅 macOS 和 Windows）
├── releases.json             # 统一的版本历史
├── v0.5.3/                   # 版本目录
│   ├── Rebebuca_0.5.3_universal.dmg          # macOS DMG 安装包
│   ├── rebebuca.msi                          # Windows MSI 安装包
│   ├── rebebuca-remote-agent-aarch64-apple-darwin    # macOS ARM64 remote agent
│   ├── rebebuca-remote-agent-x86_64-apple-darwin     # macOS x64 remote agent
│   ├── rebebuca-remote-agent-x86_64-unknown-linux-gnu # Linux x64 remote agent
│   ├── macos/                               # macOS 自动更新包
│   │   ├── Rebebuca.app.tar.gz
│   │   └── Rebebuca.app.tar.gz.sig
│   └── remote-agent-server/                 # Linux 远程服务器
│       ├── rebebuca-remote-server-linux-x86_64.tar.gz
│       └── rebebuca-remote-server-linux-aarch64.tar.gz
└── v0.5.2/                   # 之前的版本...
```

**说明**：
- `latest.json`: 只包含 macOS 和 Windows 的桌面应用配置
- `releases.json`: 包含所有版本的记录（统一格式）
- DMG 和 Windows MSI 直接放在版本根目录
- remote-agent 二进制文件直接放在版本根目录
- remote-agent-server 打包文件放在 `remote-agent-server/` 子目录

### latest.json 格式
```json
{
  "version": "0.5.3",
  "notes": "See release notes",
  "pub_date": "2024-01-15T10:00:00Z",
  "platforms": {
    "darwin-aarch64": { "signature": "...", "url": "https://download.m7s.live/rb/v0.5.3/macos/Rebebuca.app.tar.gz" },
    "darwin-x86_64": { "signature": "...", "url": "https://download.m7s.live/rb/v0.5.3/macos/Rebebuca.app.tar.gz" },
    "windows-x86_64": { "signature": "...", "url": "https://download.m7s.live/rb/v0.5.3/rebebuca.msi" }
  }
}
```

### releases.json 格式
```json
{
  "latest": "0.5.3",
  "releases": [
    { "version": "0.5.3", "date": "2024-01-15", "body": "- Feature A
- Fix B" }
  ]
}
```

## TAURI_SIGNING_PRIVATE_KEY

dW50cnVzdGVkIGNvbW1lbnQ6IHJzaWduIGVuY3J5cHRlZCBzZWNyZXQga2V5ClJXUlRZMEl5VDBiYmFGMkF4SG40WnovMHJrV3FoZFg2dFJQcWxueXlnMjV5dHRrUTdLSUFBQkFBQUFBQUFBQUFBQUlBQUFBQUl6UVJBTEllcnBsbytWSm9RZnVYOHUrM2tLbzFpb24zcktlbnZQZ2FiSE1mTEVkYjAzUEQvWTZJRitWSHJGRXZzSjJqZTk5M1g4VUNvQThPUkNybXVMV1RIQjFsT2pPemR4UEJMSkhBNG5ndWdrRkMrV0xySmdZMjBGM1QvZWQ4WjZPTUdXUWtPamM9Cg==