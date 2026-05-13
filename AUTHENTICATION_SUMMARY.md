# 认证功能实现总结

## 概述

已在 **Website** 与 **Rebebuca Web UI** 两个 Web 端成功实现用户信息获取和登录跳转功能。

## 架构说明

### Server (认证服务器)
- **位置**: `server/`
- **技术栈**: Next.js + Edge Runtime + D1 Database (Cloudflare)
- **功能**:
  - 用户认证 (JWT)
  - 用户信息管理
  - 订阅管理
  - OAuth 支持 (GitHub, Google)
  - Cloudflare Access 集成

### Website (营销网站)
- **位置**: `website/`
- **技术栈**: Vite + Vue 3 + TypeScript + Pinia
- **功能**:
  - 显示用户信息和订阅状态
  - 登录/注册按钮
  - 跳转到认证服务器

### Rebebuca Web UI（本地）
- **位置**: `src/`
- **技术栈**: Vue 3 + TypeScript + Pinia + Naive UI
- **功能**:
  - 用户菜单组件
  - 显示用户头像和信息
  - 订阅状态显示
  - 登录/退出登录

## 实现的功能

### 1. Website 端功能

#### 认证服务 (`website/src/services/authService.ts`)
```typescript
// 主要功能
- getCurrentUser(): 获取当前用户信息
- getSubscription(): 获取用户订阅信息
- isAuthenticated(): 检查登录状态
- openAuthPortal(path): 打开认证服务器页面
```

#### 认证 Store (`website/src/stores/auth.ts`)
```typescript
// 状态管理
- user: 用户信息
- subscription: 订阅信息
- isAuthenticated: 登录状态
- isPro: 是否 Pro 用户
- isEnterprise: 是否企业用户
- planType: 订阅计划类型
```

#### Composable (`website/src/composables/useAuth.ts`)
```typescript
// 方便的 API
- initialize(): 初始化认证
- getCurrentUser(): 获取用户
- redirectToLogin(): 跳转到登录
- redirectToRegister(): 跳转到注册
- refreshSubscription(): 刷新订阅
```

#### Header 组件 (`website/src/components/Header.vue`)
```
功能:
- 显示用户头像和名称
- 显示订阅计划徽章 (Free/Pro/Enterprise)
- 登录/注册按钮 (未登录时)
- Dashboard 和 Refresh 按钮 (已登录时)
```

#### 主页面 (`website/src/views/HomeView.vue`)
```
功能:
- 英雄区域
- 功能介绍
- 用户信息卡片 (已登录时显示)
```

### 2. Rebebuca Web UI 端功能

#### 认证服务更新 (`src/services/authService.ts`)
```typescript
// 更新内容
- 修复 getSubscription() 方法调用正确的 API 端点 (/api/auth/me)
- 支持返回 subscription 数据
```

#### 认证 Store (`src/stores/auth.ts`)
```typescript
// 已有功能
- 用户认证状态管理
- 订阅信息管理
- 登录/注册/退出登录
```

#### Composable (`src/composables/useAuth.ts`)
```typescript
// 新增功能
- initializeAuth(): 初始化认证
- getCurrentUser(): 获取用户
- requireAuth(redirectTo): 检查认证并重定向
- redirectToLogin(): 跳转到登录
- redirectToRegister(): 跳转到注册
```

#### 用户菜单组件 (`src/components/UserMenu.vue`)
```
功能:
- 显示用户头像 (或头像占位符)
- 显示用户名称或邮箱
- 显示订阅计划徽章
- 下拉菜单选项:
  - Account (只读)
  - Email (只读)
  - Subscription (只读)
  - Plan (只读)
  - Dashboard
  - Subscriptions
  - Refresh
  - Logout

未登录时:
- 显示登录按钮
```

#### 国际化支持
- 英文 (`src/locales/en.ts`): 新增 auth 翻译
- 中文 (`src/locales/zh-CN.ts`): 新增 auth 翻译

## 使用示例

### Website 端

#### 获取用户信息
```vue
<script setup lang="ts">
import { onMounted } from 'vue';
import { useAuth } from '@/composables/useAuth';

const {
  user,
  subscription,
  isAuthenticated,
  initialize,
} = useAuth();

onMounted(async () => {
  await initialize();

  if (isAuthenticated.value) {
    console.log('User:', user.value);
    console.log('Subscription:', subscription.value);
  }
});
</script>

<template>
  <div v-if="isAuthenticated">
    <p>Welcome, {{ user.displayName || user.email }}!</p>
    <p>Plan: {{ subscription.planType }}</p>
  </div>
  <div v-else>
    <button @click="redirectToLogin()">Login</button>
  </div>
</template>
```

#### 跳转到登录
```typescript
import { useAuth } from '@/composables/useAuth';

const { redirectToLogin } = useAuth();

// 跳转到登录，登录后返回当前页面
redirectToLogin(window.location.pathname);
```

### Rebebuca Web UI 端

#### 在组件中使用认证
```vue
<script setup lang="ts">
import { onMounted } from 'vue';
import { useAuth } from '@/composables/useAuth';

const {
  user,
  subscription,
  isAuthenticated,
  planType,
  initializeAuth,
  requireAuth,
} = useAuth();

onMounted(async () => {
  await initializeAuth();
});

function handleProtectedAction() {
  // 检查认证，未登录则跳转到登录
  if (requireAuth('/dashboard')) {
    // 用户已登录，执行操作
    console.log('Performing protected action');
  }
}
</script>

<template>
  <div v-if="isAuthenticated">
    <p>User: {{ user.displayName || user.email }}</p>
    <p>Plan: {{ planType }}</p>
  </div>
  <button @click="handleProtectedAction">
    Protected Action
  </button>
</template>
```

## 认证流程

### 1. 用户访问 Website

```
用户访问 website
    ↓
初始化认证 (initialize())
    ↓
检查本地存储的 token
    ↓
调用 /api/auth/me 获取用户信息
    ↓
显示用户信息和订阅状态
```

### 2. 用户点击登录

```
用户点击登录按钮
    ↓
调用 redirectToLogin()
    ↓
打开认证服务器 /login 页面
    ↓
用户完成登录
    ↓
认证服务器设置 cookies
    ↓
返回 website
    ↓
重新获取用户信息
```

### 3. Web UI 中的认证

```
应用启动
    ↓
TitleBar 显示 UserMenu 组件
    ↓
初始化认证 (initializeAuth())
    ↓
检查 localStorage 中的 token
    ↓
调用 /api/auth/me 获取用户信息
    ↓
显示用户菜单或登录按钮
```

## API 端点

### Server 提供的认证 API

| 端点 | 方法 | 描述 |
|------|------|------|
| `/api/auth/me` | GET | 获取当前用户信息和订阅 |
| `/api/auth/login` | POST | 用户名密码登录 |
| `/api/auth/register` | POST | 注册新用户 |
| `/api/auth/logout` | POST | 退出登录 |
| `/api/auth/refresh` | POST | 刷新 access token |
| `/api/auth/github` | GET | GitHub OAuth 登录 |
| `/api/auth/google` | GET | Google OAuth 登录 |
| `/dashboard` | - | 控制台页面 (受保护) |

## 数据存储

### Website
- **localStorage**: 存储 token 和用户信息
- **Keys**:
  - `rebebuca_access_token`
  - `rebebuca_refresh_token`
  - `rebebuca_user`

### Rebebuca Web UI
- **localStorage**: 存储 token 和用户信息
- **Keys**:
  - `rebebuca_access_token`
  - `rebebuca_refresh_token`
  - `rebebuca_user`

### Server
- **D1 Database**: 存储用户数据
- **Tables**:
  - `users`: 用户信息
  - `sessions`: 会话和 refresh token
  - `subscriptions`: 订阅信息
  - `products`: 产品信息

## 安全考虑

1. **Token 存储**: Website 和 Web UI 都使用 localStorage 存储 token (httpOnly cookies 仅在 server 端)
2. **HTTPS**: 生产环境必须使用 HTTPS
3. **Token 刷新**: 自动刷新过期 token
4. **认证检查**: 受保护路由需要认证
5. **环境变量**: 敏感信息通过环境变量配置

## 部署说明

### Server
1. 部署到 Cloudflare Pages
2. 配置环境变量:
   - `JWT_SECRET`: JWT 签名密钥
   - `DB`: D1 Database 绑定

### Website
1. 配置 `.env` 文件:
   ```env
   VITE_AUTH_SERVER_URL=https://your-server.com
   ```
2. 构建并部署:
   ```bash
   pnpm install
   pnpm build
   ```

### Rebebuca Web UI
1. 认证功能已集成
2. 无需额外配置
3. 自动读取用户信息并显示

## 文件清单

### Website 新增文件
```
website/
├── package.json
├── vite.config.ts
├── tsconfig.json
├── tsconfig.node.json
├── index.html
├── .env.example
├── .gitignore
├── README.md
└── src/
    ├── vite-env.d.ts
    ├── main.ts
    ├── App.vue
    ├── router/
    │   └── index.ts
    ├── services/
    │   └── authService.ts
    ├── stores/
    │   └── auth.ts
    ├── composables/
    │   └── useAuth.ts
    ├── types/
    │   └── auth.ts
    ├── components/
    │   ├── Header.vue
    │   └── Footer.vue
    └── views/
        ├── HomeView.vue
        ├── AboutView.vue
        └── PricingView.vue
```

### Rebebuca Web UI 更新文件
```
src/
├── services/
│   └── authService.ts (更新)
├── stores/
│   └── auth.ts (已存在)
├── composables/
│   └── useAuth.ts (更新)
├── components/
│   └── UserMenu.vue (新增)
└── locales/
    ├── en.ts (更新)
    └── zh-CN.ts (更新)
```

## 测试建议

### Website 测试
1. 访问 http://localhost:3001
2. 点击 "Login" 按钮
3. 在认证服务器完成登录
4. 返回 website 查看用户信息
5. 测试订阅状态显示
6. 测试 Dashboard 跳转

### Rebebuca Web UI 测试
1. 启动 Rebebuca（npx）
2. 查看 TitleBar 中的用户菜单
3. 点击登录按钮
4. 在认证服务器完成登录
5. 查看用户信息和订阅状态
6. 测试用户菜单功能

## 后续改进建议

1. **错误处理**: 添加更详细的错误提示
2. **加载状态**: 优化加载时的用户体验
3. **自动刷新**: 定期自动刷新用户信息和订阅
4. **缓存优化**: 改进 token 和用户信息的缓存策略
5. **OAuth 集成**: 在 website 中直接支持 GitHub/Google 登录
6. **多语言支持**: 扩展更多语言翻译

## 总结

已成功在 Website 和 Rebebuca Web UI 两个 Web 端实现完整的认证功能:

✅ **Website**:
- 用户信息获取和显示
- 订阅状态显示
- 登录/注册跳转
- Dashboard 跳转

✅ **Rebebuca Web UI**:
- 用户菜单组件
- 用户头像和信息显示
- 订阅状态徽章
- 登录/退出登录功能
- 下拉菜单操作

两个端都与认证服务器完全集成，提供一致的用户体验。
