# Tauri OAuth 登录功能文档

## 概述

已在 Tauri (桌面应用) 中成功实现 GitHub 和 Google 的 OAuth 登录功能，类似 VS Code 的体验。用户可以点击登录按钮，弹出浏览器完成 OAuth 授权，然后自动感知登录状态。

## 架构设计

### 认证流程

```
用户点击 OAuth 登录按钮
    ↓
打开 OAuth 登录对话框
    ↓
选择 GitHub 或 Google 登录
    ↓
请求 Server 获取 OAuth 授权 URL
    ↓
调用 Tauri 命令打开浏览器
    ↓
用户在浏览器中完成 OAuth 授权
    ↓
Server 回调处理，创建/更新用户，生成 JWT
    ↓
前端轮询检查登录状态 (每秒一次)
    ↓
检测到登录成功，更新 UI 状态
    ↓
关闭对话框，显示成功消息
```

## 实现的功能

### 1. Server 端 - Tauri OAuth API

#### GitHub OAuth 端点

**获取 OAuth URL**: `GET /api/auth/tauri/github`
```typescript
// 返回 JSON 格式
{
  url: "https://github.com/login/oauth/authorize?...",
  state: "uuid-string"
}
```

**OAuth 回调**: `GET /api/auth/tauri/github/callback`
```typescript
// 返回 JSON 格式（不重定向）
{
  success: true,
  user: {
    id: "user-id",
    email: "user@example.com",
    displayName: "John Doe",
    avatarUrl: "https://..."
  },
  tokens: {
    accessToken: "jwt-token",
    refreshToken: "refresh-token"
  }
}
```

#### Google OAuth 端点

**获取 OAuth URL**: `GET /api/auth/tauri/google`
```typescript
// 返回 JSON 格式
{
  url: "https://accounts.google.com/o/oauth2/v2/auth?...",
  state: "uuid-string"
}
```

**OAuth 回调**: `GET /api/auth/tauri/google/callback`
```typescript
// 返回 JSON 格式（不重定向）
{
  success: true,
  user: { ... },
  tokens: { ... }
}
```

**关键区别**:
- 与普通 Web OAuth 不同，Tauri OAuth 回调返回 JSON 而不是重定向
- 不使用 httpOnly cookies（因为桌面应用无法直接访问）
- 轮询机制检查登录状态

### 2. Tauri Rust - 打开浏览器命令

**文件**: `src-tauri/src/commands.rs`

```rust
#[tauri::command]
pub fn open_url_in_browser(url: String) -> Result<(), String> {
    // Open URL in default browser
    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .arg(&url)
            .spawn()
            .map_err(|e| format!("Failed to open URL in browser: {}", e))?;
    }

    #[cfg(target_os = "windows")]
    {
        Command::new("cmd")
            .args(["/c", "start", "", &url])
            .spawn()
            .map_err(|e| format!("Failed to open URL in browser: {}", e))?;
    }

    #[cfg(target_os = "linux")]
    {
        Command::new("xdg-open")
            .arg(&url)
            .spawn()
            .map_err(|e| format!("Failed to open URL in browser: {}", e))?;
    }

    Ok(())
}
```

**已注册**: 在 `src-tauri/src/lib.rs` 的 invoke_handler 中添加

### 3. 前端 - OAuth 登录对话框

**文件**: `src/components/OAuthLoginDialog.vue`

**功能**:
- 显示登录选项（GitHub、Google、邮箱）
- 调用 API 获取 OAuth URL
- 打开浏览器进行授权
- 轮询检查登录状态
- 显示加载状态和错误信息
- 支持中英文界面

**核心方法**:
```typescript
async function startOAuthFlow(provider: 'github' | 'google') {
  // 1. 获取 OAuth URL
  const response = await fetch(`${AUTH_SERVER_URL}/api/auth/tauri/${provider}`);
  const data = await response.json(); // { url, state }

  // 2. 保存 state
  sessionStorage.setItem('oauth_state', data.state);

  // 3. 打开浏览器
  await invoke('open_url_in_browser', { url: data.url });

  // 4. 轮询检查登录状态
  await pollForAuthentication(provider);
}

async function pollForAuthentication(provider: 'github' | 'google') {
  const poll = setInterval(async () => {
    // 检查 /api/auth/me
    const response = await fetch(`${AUTH_SERVER_URL}/api/auth/me`);
    if (response.ok) {
      const data = await response.json();
      if (data.user) {
        clearInterval(poll);
        // 登录成功
        emit('login-success');
      }
    }
  }, 1000); // 每秒检查一次
}
```

### 4. 用户菜单集成

**文件**: `src/components/UserMenu.vue`

**更新内容**:
- 未登录时显示 GitHub、Google 和邮箱登录按钮
- GitHub 和 Google 按钮直接触发 OAuth 登录
- 邮箱按钮打开下拉菜单
- 点击任何登录选项打开 OAuthLoginDialog
- 监听登录成功事件，刷新用户状态

```vue
<template>
  <!-- 未登录 -->
  <div v-else class="user-info not-authenticated">
    <n-space :size="8">
      <n-button @click="handleGithubLogin">
        <LogoGithub />
      </n-button>
      <n-button @click="handleGoogleLogin">
        <LogoGoogle />
      </n-button>
      <n-dropdown>
        <n-button>{{ t('auth.login') }}</n-button>
      </n-dropdown>
    </n-space>
  </div>

  <!-- OAuth 登录对话框 -->
  <OAuthLoginDialog
    v-model="showOAuthDialog"
    @login-success="handleOAuthSuccess"
  />
</template>

<script setup>
function handleGithubLogin() {
  showOAuthDialog.value = true;
}

async function handleOAuthSuccess() {
  // 刷新认证状态
  await authStore.initialize();
}
</script>
```

### 5. 国际化支持

**文件**:
- `src/locales/en.ts` - 英文翻译
- `src/locales/zh-CN.ts` - 中文翻译

**新增翻译**:
```typescript
auth: {
  emailLogin: 'Email Login',
  oauth: {
    title: 'Sign in with',
    description: 'Choose your preferred login method',
    github: 'Sign in with GitHub',
    google: 'Sign in with Google',
    email: 'Sign in with Email',
    preparing: 'Preparing login...',
    openingBrowser: 'Opening browser...',
    waitingAuth: 'Waiting for authentication...',
    success: 'Authentication successful!',
    failed: 'Authentication failed',
    timeout: 'Authentication timed out',
    loginSuccess: 'You have successfully logged in!',
  },
}
```

## 使用示例

### 1. 用户登录流程

#### GitHub 登录
```
1. 用户点击 TitleBar 右上角的 GitHub 按钮
2. 打开 OAuth 登录对话框
3. 对话框显示 "Sign in with GitHub" 按钮
4. 用户点击按钮
5. 后台请求 /api/auth/tauri/github 获取授权 URL
6. 自动打开系统默认浏览器，跳转到 GitHub 授权页面
7. 用户在浏览器中授权 Rebebuca 应用
8. GitHub 重定向到 /api/auth/tauri/github/callback
9. Server 处理回调，创建/更新用户，生成 JWT token
10. 前端每秒轮询 /api/auth/me 检查登录状态
11. 检测到登录成功，关闭对话框
12. 更新用户菜单，显示用户头像和信息
13. 显示成功消息 "You have successfully logged in!"
```

#### Google 登录
流程与 GitHub 相同，只是 URL 是 `/api/auth/tauri/google`

### 2. 开发者测试

#### 测试 GitHub 登录
```bash
# 1. 启动 Server
cd server
pnpm dev

# 2. 启动 Tauri 应用
cd ..
pnpm tauri dev

# 3. 点击 GitHub 登录按钮
# 4. 浏览器自动打开，显示 GitHub 授权页面
# 5. 授权后返回应用，看到用户信息
```

#### 测试 Google 登录
与 GitHub 登录相同，点击 Google 按钮即可

### 3. 配置说明

#### Server 环境变量

需要在 `.env` 或 Cloudflare 环境变量中配置：

```env
# GitHub OAuth
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret

# Google OAuth
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

# JWT Secret
JWT_SECRET=your_jwt_secret_key
```

#### GitHub OAuth 配置

1. 访问 https://github.com/settings/developers
2. 创建新的 OAuth App
3. 配置：
   - **Application name**: Rebebuca
   - **Homepage URL**: `https://your-domain.com`
   - **Authorization callback URL**: `https://your-domain.com/api/auth/tauri/github/callback`
   - **Enable Device Flow**: 不需要
4. 获取 `Client ID` 和 `Client Secret`

#### Google OAuth 配置

1. 访问 https://console.cloud.google.com/
2. 创建新项目或选择现有项目
3. 启用 Google+ API
4. 创建 OAuth 2.0 客户端 ID
5. 配置：
   - **Application type**: Web application
   - **Authorized redirect URIs**: `https://your-domain.com/api/auth/tauri/google/callback`
6. 获取 `Client ID` 和 `Client Secret`

## 安全考虑

### 1. CSRF 保护

使用 `state` 参数防止 CSRF 攻击：
- 生成随机 UUID
- 在服务器端存储在 httpOnly cookie 中
- OAuth 回调时验证 state
- Tauri 端存储在 localStorage 中的 cookie（会话级）

### 2. Token 安全

- JWT token 使用 HS256 算法签名
- Token 有效期：
  - Access Token: 15 分钟
  - Refresh Token: 7 天
- Refresh Token 存储在数据库中
- Access Token 存储在 localStorage 中

### 3. 轮询安全

- 轮询间隔：1 秒
- 最大尝试次数：60 秒（1 分钟超时）
- 仅在登录对话框打开时轮询
- 登录成功后立即停止轮询

### 4. 用户隐私

- OAuth 授权仅请求必要的权限：
  - GitHub: `user:email`（用户邮箱）
  - Google: `openid email profile`（基本信息、邮箱、头像）
- 用户可以随时撤销授权

## 故障排查

### 1. 打开浏览器失败

**问题**: 点击登录按钮后浏览器没有打开

**解决方案**:
- 检查 Rust 命令是否正确注册
- 查看开发者控制台是否有错误
- 确认系统默认浏览器设置

### 2. 轮询超时

**问题**: 浏览器授权完成后，应用仍显示"等待认证..."

**解决方案**:
- 检查 Server 是否正常运行
- 确认 `/api/auth/me` 端点可访问
- 查看浏览器控制台网络请求
- 增加 `pollForAuthentication` 中的 `maxAttempts` 值

### 3. OAuth 回调失败

**问题**: 浏览器中授权后显示错误

**解决方案**:
- 检查 Client ID 和 Client Secret 是否正确
- 确认回调 URL 配置正确
- 查看 Server 日志获取详细错误信息
- 检查防火墙是否阻止请求

### 4. 用户信息不更新

**问题**: 登录成功后，用户菜单未更新

**解决方案**:
- 检查 `handleOAuthSuccess` 是否正确调用 `authStore.initialize()`
- 确认 `login-success` 事件正确触发
- 查看控制台是否有错误

## 后续改进建议

### 1. 优化用户体验

- [ ] 添加动画效果，提升交互体验
- [ ] 支持记住登录选项
- [ ] 添加登录历史记录
- [ ] 支持"最近使用"登录方式

### 2. 增强安全性

- [ ] 实现 PKCE (Proof Key for Code Exchange) 增强安全性
- [ ] 添加设备指纹验证
- [ ] 实现登录失败次数限制
- [ ] 添加可疑活动检测

### 3. 功能扩展

- [ ] 支持更多 OAuth 提供商（GitLab、Bitbucket 等）
- [ ] 支持企业级 SSO（SAML）
- [ ] 添加双因素认证（2FA）
- [ ] 支持设备授权管理

### 4. 性能优化

- [ ] 使用 WebSocket 替代轮询
- [ ] 实现本地 token 存储（Tauri 存储）
- [ ] 添加登录状态缓存
- [ ] 优化网络请求

## 文件清单

### Server 端新增文件

```
server/app/api/auth/tauri/
├── github/
│   └── route.ts          # GitHub OAuth URL 端点
├── github/callback/
│   └── route.ts          # GitHub OAuth 回调端点
├── google/
│   └── route.ts          # Google OAuth URL 端点
└── google/callback/
    └── route.ts          # Google OAuth 回调端点
```

### Tauri Rust 更新文件

```
src-tauri/src/
├── commands.rs            # 添加 open_url_in_browser 命令
└── lib.rs                # 注册新命令
```

### 前端新增/更新文件

```
src/
├── components/
│   ├── UserMenu.vue        # 更新，集成 OAuth 登录
│   └── OAuthLoginDialog.vue # 新增，OAuth 登录对话框
└── locales/
    ├── en.ts               # 更新，添加 OAuth 翻译
    └── zh-CN.ts            # 更新，添加 OAuth 翻译
```

## 总结

✅ **Server 端**:
- 添加 Tauri OAuth 端点（GitHub/Google）
- 返回 JSON 格式而非重定向
- 支持轮询检查登录状态

✅ **Tauri Rust**:
- 实现 `open_url_in_browser` 命令
- 跨平台支持（macOS/Windows/Linux）

✅ **前端组件**:
- 创建 `OAuthLoginDialog` 登录对话框
- 集成到 `UserMenu` 用户菜单
- 支持中英文界面
- 实现轮询机制

✅ **用户体验**:
- 类似 VS Code 的 OAuth 登录体验
- 自动打开浏览器完成授权
- 实时更新登录状态
- 清晰的加载和错误提示

Tauri 现在完全支持 GitHub 和 Google 的 OAuth 登录，提供了流畅的用户体验！
