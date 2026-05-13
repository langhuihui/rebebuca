# OAuth 登录修复说明（历史记录）

## 问题

之前的实现中，点击 GitHub 或 Google 登录按钮也会弹出 OAuth 登录对话框，需要用户再次选择登录方式，这样体验不好。

## 解决方案

### 1. UserMenu 组件更新

**GitHub/Google 按钮**：直接触发 OAuth 登录
- 点击 GitHub 按钮 → 直接打开浏览器进行 GitHub OAuth
- 点击 Google 按钮 → 直接打开浏览器进行 Google OAuth
- 按钮显示 loading 状态
- 轮询检查登录状态

**邮箱登录按钮**：打开登录对话框
- 点击邮箱按钮 → 打开 OAuthLoginDialog
- 对话框中包含邮箱表单和 GitHub/Google 快速登录选项

### 2. 实现细节

#### UserMenu 组件 (`src/components/UserMenu.vue`)

**模板**:
```vue
<!-- 未登录 -->
<div v-else class="user-info not-authenticated">
  <!-- OAuth 登录按钮 - 直接 OAuth -->
  <n-space :size="8">
    <!-- GitHub 按钮 -->
    <n-button
      @click="handleGithubLogin"
      :loading="oauthLoading === 'github'"
    >
      <LogoGithub />
    </n-button>

    <!-- Google 按钮 -->
    <n-button
      @click="handleGoogleLogin"
      :loading="oauthLoading === 'google'"
    >
      <LogoGoogle />
    </n-button>

    <!-- 邮箱登录下拉菜单 -->
    <n-dropdown>
      <n-button>
        <PersonOutline />
        Login
      </n-button>
    </n-dropdown>
  </n-space>
</div>
```

**脚本**:
```typescript
// 直接 OAuth 登录
async function handleGithubLogin() {
  await startOAuthLogin('github');
}

async function handleGoogleLogin() {
  await startOAuthLogin('google');
}

// 开始 OAuth 登录流程
async function startOAuthLogin(provider: 'github' | 'google') {
  oauthLoading.value = provider;

  // 1. 获取 OAuth URL
  const response = await fetch(`${AUTH_SERVER_URL}/api/auth/desktop/${provider}`);

  // 2. 保存 state
  sessionStorage.setItem('oauth_state', data.state);
  sessionStorage.setItem('oauth_provider', provider);

  // 3. 打开浏览器
  await open(data.url);

  // 4. 轮询检查登录状态
  await pollForAuthentication();
}

// 轮询检查登录状态
async function pollForAuthentication() {
  // 每秒检查一次 /api/auth/me
  // 检测到登录成功后，刷新 auth store
  await authStore.initialize();

  // 显示成功消息
  message.success('Successfully logged in!');
}
```

#### OAuthLoginDialog 组件 (`src/components/OAuthLoginDialog.vue`)

**主要功能**:
- 邮箱登录表单（邮箱 + 密码）
- GitHub/Google 快速登录选项（对话框内）
- 打开浏览器进行 OAuth 授权
- 轮询检查登录状态

**使用场景**:
- 用户点击邮箱登录按钮时打开此对话框
- 对话框中可以输入邮箱密码或选择 GitHub/Google 快速登录

## 用户体验流程

### 方式 1：GitHub 登录（直接）
```
1. 用户点击 GitHub 按钮
   ↓
2. 自动打开浏览器，跳转到 GitHub 授权页面
   ↓
3. 用户在浏览器中授权
   ↓
4. 自动轮询检查登录状态
   ↓
5. 登录成功，显示成功消息，更新用户菜单
```

### 方式 2：Google 登录（直接）
```
1. 用户点击 Google 按钮
   ↓
2. 自动打开浏览器，跳转到 Google 授权页面
   ↓
3. 用户在浏览器中授权
   ↓
4. 自动轮询检查登录状态
   ↓
5. 登录成功，显示成功消息，更新用户菜单
```

### 方式 3：邮箱登录（通过对话框）
```
1. 用户点击邮箱登录按钮（图标按钮）
   ↓
2. 打开邮箱登录对话框
   ↓
3. 用户可以：
   a) 输入邮箱密码，点击"登录" → 打开浏览器进行邮箱登录
   b) 点击对话框内的 GitHub/Google 按钮 → 打开浏览器进行 OAuth
   ↓
4. 浏览器中完成授权
   ↓
5. 自动轮询检查登录状态
   ↓
6. 登录成功，关闭对话框，更新用户菜单
```

## 关键改进

### 1. 快速登录
- GitHub/Google 按钮一键打开浏览器进行 OAuth
- 无需额外选择，体验流畅

### 2. 灵活选择
- 邮箱登录仍然通过对话框，支持多种登录方式
- 对话框内也提供 GitHub/Google 快速登录选项

### 3. 清晰的 UI
- GitHub/Google 按钮有明显的图标和颜色
- Loading 状态清晰显示
- 成功消息提示用户

### 4. 状态管理
- 使用 `oauthLoading` 状态跟踪当前正在进行的 OAuth 登录
- 支持同时只有一个 OAuth 流程在进行
- 登录成功后自动清理状态

## 国际化支持

### 英文
```typescript
auth: {
  login: 'Login',
  emailLogin: 'Email',
  emailLoginDescription: 'Enter your email and password to sign in',
  oauth: {
    quickLogin: 'Or use quick login',
    // ... 其他翻译
  },
}
```

### 中文
```typescript
auth: {
  login: '登录',
  emailLogin: '邮箱',
  emailLoginDescription: '输入您的邮箱和密码登录',
  oauth: {
    quickLogin: '或使用快速登录',
    // ... 其他翻译
  },
}
```

## 文件修改清单

### 修改的文件

1. **src/components/UserMenu.vue**
   - 移除登录菜单中的 GitHub/Google 选项
   - 添加独立的 GitHub/Google 登录按钮
   - 实现 `startOAuthLogin` 方法
   - 实现 `pollForAuthentication` 方法
   - 添加 `oauthLoading` 状态
   - 添加 loading 样式

2. **src/components/OAuthLoginDialog.vue**
   - 重写为邮箱登录对话框
   - 添加邮箱登录表单
   - 保留 GitHub/Google 快速登录选项
   - 实现邮箱登录流程
   - 优化样式和用户体验

3. **src/locales/en.ts**
   - 修改 `emailLogin` 为 `Email`
   - 添加 `emailLoginDescription` 字段
   - 添加 `quickLogin` 字段

4. **src/locales/zh-CN.ts**
   - 修改 `emailLogin` 为 `邮箱`
   - 添加 `emailLoginDescription` 字段
   - 添加 `quickLogin` 字段

## 测试建议

### 测试 GitHub 登录
1. 点击 GitHub 登录按钮
2. 确认浏览器自动打开
3. 在浏览器中完成 GitHub 授权
4. 等待应用检测到登录状态
5. 确认用户菜单显示用户信息

### 测试 Google 登录
1. 点击 Google 登录按钮
2. 确认浏览器自动打开
3. 在浏览器中完成 Google 授权
4. 等待应用检测到登录状态
5. 确认用户菜单显示用户信息

### 测试邮箱登录
1. 点击邮箱登录按钮（图标）
2. 输入邮箱和密码
3. 点击"登录"按钮
4. 确认浏览器打开到登录页面
5. 完成登录后返回应用
6. 确认用户菜单显示用户信息

### 测试对话框内 OAuth
1. 点击邮箱登录按钮（图标）
2. 在对话框中点击 GitHub 或 Google 按钮
3. 确认浏览器自动打开
4. 完成授权
5. 确认对话框关闭，用户菜单更新

## 后续优化建议

1. **性能优化**
   - 使用 WebSocket 替代轮询
   - 减少不必要的网络请求

2. **用户体验**
   - 添加动画效果
   - 优化 loading 状态显示
   - 添加更多的错误处理

3. **功能扩展**
   - 支持记住登录方式
   - 支持多设备登录
   - 支持登录历史记录

当前 Web 产品以邮箱登录为主；loopback OAuth 相关路由见 `server/app/api/auth/desktop/`。
