# Version Release Manager Skill

这个 skill 提供了完整的版本发布管理功能，可以自动化处理版本号更新、Git 标签创建和发布流程。

## 功能特性

- **语义化版本管理**: 支持 major.minor.patch 版本格式
- **多文件版本同步**: 自动更新 package.json、tauri.conf.json、Cargo.toml 等文件
- **Git 集成**: 自动提交、创建标签、推送到远程仓库
- **发布前检查**: 验证 Git 状态、版本格式、标签冲突等
- **交互式发布**: 提供版本建议和交互式选择
- **重新发布支持**: 支持热修复和重新发布现有版本

## 使用方式

### 1. 通过 AI 助手使用

直接向 AI 助手描述你的需求：

```
发布版本 0.5.0
```

```
升级补丁版本并发布
```

```
我想发布一个新版本，当前版本应该升级到什么？
```

### 2. 直接使用脚本

#### 查看当前版本
```bash
.codebuddy/skills/version-release-manager/scripts/release_workflow.sh current
```

#### 查看版本建议
```bash
.codebuddy/skills/version-release-manager/scripts/release_workflow.sh suggest
```

#### 发布新版本
```bash
.codebuddy/skills/version-release-manager/scripts/release_workflow.sh release 0.5.0
```

#### 交互式发布
```bash
.codebuddy/skills/version-release-manager/scripts/release_workflow.sh interactive
```

#### 重新发布当前版本
```bash
.codebuddy/skills/version-release-manager/scripts/release_workflow.sh republish
```

### 3. 使用 Python 工具

#### 获取版本信息
```bash
python3 .codebuddy/skills/version-release-manager/scripts/version_manager.py current
```

#### 验证版本格式
```bash
python3 .codebuddy/skills/version-release-manager/scripts/version_manager.py validate 1.2.3
```

#### 版本递增
```bash
python3 .codebuddy/skills/version-release-manager/scripts/version_manager.py increment 0.4.4 patch
```

## 支持的项目类型

这个 skill 专门为 Tauri + Vue.js 项目设计，支持以下文件的版本同步：

- `package.json` - Node.js 项目配置
- `src-tauri/tauri.conf.json` - Tauri 应用配置  
- `src-tauri/Cargo.toml` - Rust 项目配置
- `src-tauri/Cargo.lock` - Rust 依赖锁定文件

## 发布流程

1. **预检查**: 验证 Git 状态和版本格式
2. **文件更新**: 同步更新所有版本文件
3. **依赖更新**: 更新 Cargo.lock 文件
4. **Git 操作**: 提交更改并创建标签
5. **推送发布**: 推送到远程仓库触发 CI/CD

## 安全特性

- 发布前检查未提交的更改
- 防止重复标签创建
- 版本格式验证
- 回滚支持

## 集成说明

这个 skill 与项目现有的发布脚本兼容：
- `scripts/release.sh` - 原有发布脚本
- `scripts/republish.sh` - 原有重发布脚本

AI 助手会根据情况选择使用 skill 提供的增强功能或现有脚本。