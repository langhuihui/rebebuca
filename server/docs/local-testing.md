# 本地测试指南

## 本地测试页面功能（连接远程数据库）

### 方法 1: 使用 Wrangler Pages Dev（推荐）

这是最简单的方法，可以完整模拟 Cloudflare Pages 环境：

```bash
# 1. 先构建项目
pnpm run build

# 2. 启动开发服务器（连接远程数据库）
pnpm run dev:remote
```

这会：
- 启动本地开发服务器
- 连接到远程 Cloudflare D1 数据库
- 支持所有 Cloudflare 功能（D1、环境变量等）
- 访问地址通常是 `http://localhost:8788`

### 方法 2: 使用 Next.js Dev + Wrangler Proxy

如果需要使用标准的 Next.js dev 模式：

```bash
# 启动 Next.js 开发服务器
pnpm run dev
```

**注意**: 这种方法可能无法直接访问 D1 数据库，因为 `getRequestContext()` 在标准 Next.js dev 模式下不可用。

## 推荐工作流程

### 1. 开发新功能

```bash
# 使用 Wrangler Pages Dev（连接远程数据库）
pnpm run build && pnpm run dev:remote
```

### 2. 测试页面功能

访问以下地址测试：
- 主页: `http://localhost:8788`
- 登录: `http://localhost:8788/login`
- 仪表板: `http://localhost:8788/dashboard`
- 管理员面板: `http://localhost:8788/dashboard/admin` (需要超级管理员权限)

### 3. 查看日志

开发服务器的控制台会显示：
- API 请求日志
- 数据库查询日志
- 错误信息

## 注意事项

### ⚠️ 重要提示

1. **数据安全**: 连接到远程数据库时，所有操作都会影响生产数据
2. **只读测试**: 建议只进行查询操作，避免修改数据
3. **权限**: 确保你的账户有访问数据库的权限

### 测试管理员功能

要测试管理员界面，你需要：

1. **确保数据库中有超级管理员用户**:
   ```bash
   # 检查当前用户角色
   pnpm wrangler d1 execute rebebuca --remote --command="SELECT email, role FROM users;"
   
   # 如果需要，设置超级管理员（谨慎操作！）
   pnpm wrangler d1 execute rebebuca --remote --command="UPDATE users SET role = 'super_admin' WHERE email = 'your-email@example.com';"
   ```

2. **使用超级管理员账户登录**: 使用设置了 `role = 'super_admin'` 的账户登录

3. **访问管理员面板**: 登录后，导航栏会显示 "Admin" 链接

## 故障排除

### 问题 1: 无法连接数据库

**错误**: `Failed to retrieve the Cloudflare request context`

**解决方案**:
- 确保使用 `pnpm run dev:remote` 而不是 `pnpm run dev`
- 确保先运行了 `pnpm run build`

### 问题 2: 权限错误

**错误**: `Forbidden: Super admin access required`

**解决方案**:
- 检查当前登录用户的角色是否为 `super_admin`
- 使用正确的账户登录

### 问题 3: 页面无法加载

**解决方案**:
- 检查控制台错误信息
- 确保所有依赖已安装: `pnpm install`
- 尝试重新构建: `pnpm run build`

## 快速命令参考

```bash
# 构建项目
pnpm run build

# 启动开发服务器（远程数据库）
pnpm run dev:remote

# 查看数据库中的用户
pnpm wrangler d1 execute rebebuca --remote --command="SELECT email, role, is_banned FROM users LIMIT 10;"

# 检查特定用户的角色
pnpm wrangler d1 execute rebebuca --remote --command="SELECT email, role FROM users WHERE email = 'your-email@example.com';"
```

## 开发流程建议

1. **开发阶段**: 使用 `pnpm run dev:remote` 连接远程数据库测试
2. **功能测试**: 在本地测试所有页面功能
3. **数据验证**: 使用 wrangler 命令验证数据库状态
4. **部署**: 测试通过后部署到生产环境
