# GitHub OAuth 本地开发配置

## 问题

在本地开发时，GitHub OAuth 登录会报错：
```
The redirect_uri is not associated with this application.
```

这是因为 GitHub OAuth 应用只配置了生产环境的重定向 URI，没有配置本地开发环境的 URI。

## 解决方案

### 方法 1: 在 GitHub 应用中添加本地重定向 URI（推荐）

1. **访问 GitHub 开发者设置**
   - 打开 https://github.com/settings/developers
   - 点击你的 OAuth App

2. **添加授权回调 URL**
   - 找到 "Authorization callback URL" 字段
   - 添加本地开发的重定向 URI：
     ```
     http://localhost:8788/api/auth/github/callback
     ```
   - 如果有多个端口，可以添加多个：
     ```
     http://localhost:8788/api/auth/github/callback
     http://localhost:3000/api/auth/github/callback
     http://127.0.0.1:8788/api/auth/github/callback
     ```

3. **保存更改**
   - 点击 "Update application"
   - 等待几秒钟让更改生效

4. **测试登录**
   - 重新启动开发服务器
   - 尝试 GitHub 登录

### 方法 2: 使用环境变量配置（如果需要）

如果需要为不同环境使用不同的 GitHub OAuth 应用，可以：

1. **创建开发环境的 GitHub OAuth App**
   - 在 GitHub 创建一个新的 OAuth App（仅用于开发）
   - 设置回调 URL 为 `http://localhost:8788/api/auth/github/callback`

2. **配置环境变量**
   - 在 `.dev.vars` 文件中使用开发环境的 Client ID 和 Secret
   - 生产环境使用生产环境的配置

## 当前配置

在 `.dev.vars`（已 gitignore，勿提交）中配置 GitHub OAuth：

```bash
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
```

生产环境请通过 Cloudflare Secrets 注入，参见 `server/wrangler.jsonc` 注释。

## 验证配置

1. **检查重定向 URI 格式**
   - 本地开发: `http://localhost:8788/api/auth/github/callback`
   - 生产环境: `https://your-domain.com/api/auth/github/callback`

2. **测试 OAuth 流程**
   ```bash
   # 启动开发服务器
   pnpm run dev:remote:fast
   
   # 访问登录页面
   # 点击 GitHub 登录
   # 应该能正常跳转和回调
   ```

## 常见问题

### Q: 添加了 URI 但还是报错？

A: 
- 确保 URI 完全匹配（包括协议、端口、路径）
- 等待几分钟让 GitHub 的更改生效
- 清除浏览器缓存和 cookies
- 检查是否有拼写错误

### Q: 可以使用通配符吗？

A: GitHub 不支持通配符，需要明确列出每个 URI。

### Q: 需要为每个开发者配置不同的 URI 吗？

A: 不需要，所有开发者可以共享同一个 OAuth App，只要回调 URI 在允许列表中即可。

## Google OAuth 配置

Google OAuth 也需要类似的配置：

1. 访问 https://console.cloud.google.com/apis/credentials
2. 编辑你的 OAuth 2.0 客户端
3. 在 "已授权的重定向 URI" 中添加：
   ```
   http://localhost:8788/api/auth/google/callback
   ```

## 快速检查清单

- [ ] GitHub OAuth App 中已添加 `http://localhost:8788/api/auth/github/callback`
- [ ] Google OAuth 中已添加 `http://localhost:8788/api/auth/google/callback`
- [ ] 已保存更改并等待生效
- [ ] 开发服务器使用正确的端口（8788）
- [ ] `.dev.vars` 文件配置正确
