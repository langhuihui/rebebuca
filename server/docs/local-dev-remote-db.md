# 本地开发连接远程数据库指南

## 概述

在本地开发时，可以使用 Wrangler 连接到 Cloudflare D1 远程数据库进行测试。

## 方法 1: 使用 Wrangler 远程连接（推荐）

### 1. 配置 Wrangler

确保 `wrangler.jsonc` 中已配置数据库：

```jsonc
{
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "rebebuca",
      "database_id": "13888c7f-051a-4900-a58c-dd1104653a3b"
    }
  ]
}
```

### 2. 使用 Wrangler 执行 SQL

```bash
# 执行 SQL 文件
wrangler d1 execute rebebuca --remote --file=migrations/0004_add_user_role_and_status_execute.sql

# 执行单条 SQL 命令
wrangler d1 execute rebebuca --remote --command="SELECT COUNT(*) FROM users;"

# 执行多条 SQL 命令
wrangler d1 execute rebebuca --remote --command="SELECT * FROM users LIMIT 5;"
```

### 3. 导出/导入数据

```bash
# 导出远程数据库
wrangler d1 export rebebuca --remote --output=backup.sql

# 导入到远程数据库
wrangler d1 execute rebebuca --remote --file=backup.sql
```

## 方法 2: 使用 Wrangler Dev 模式（开发服务器）

### 1. 启动开发服务器并连接远程数据库

```bash
# 使用远程数据库运行开发服务器
wrangler pages dev .next --remote

# 或者使用 next-on-pages 的预览模式
pnpm run preview
```

### 2. 配置环境变量

创建 `.dev.vars` 文件（如果使用本地数据库）或使用远程数据库：

```bash
# .dev.vars (仅用于本地数据库)
# 如果使用远程数据库，不需要这个文件
```

## 方法 3: 使用 Wrangler 代理（本地开发）

### 1. 创建开发脚本

在 `package.json` 中添加：

```json
{
  "scripts": {
    "dev:remote": "wrangler pages dev .next --remote --d1=DB=rebebuca",
    "dev:local": "next dev"
  }
}
```

### 2. 运行开发服务器

```bash
# 使用远程数据库
pnpm run dev:remote

# 使用本地数据库（需要先创建）
pnpm run dev:local
```

## 方法 4: 直接使用 Wrangler D1 命令

### 常用命令

```bash
# 查看数据库列表
wrangler d1 list

# 查看数据库信息
wrangler d1 info rebebuca

# 执行 SQL（远程）
wrangler d1 execute rebebuca --remote --command="SELECT * FROM users;"

# 执行 SQL（本地，如果有本地数据库文件）
wrangler d1 execute rebebuca --local --command="SELECT * FROM users;"

# 创建本地数据库副本（用于离线开发）
wrangler d1 execute rebebuca --remote --output=local.db
```

## 注意事项

### ⚠️ 重要提示

1. **数据安全**: 连接到远程数据库时，所有操作都会影响生产数据，请谨慎操作
2. **备份**: 在执行任何修改操作前，先备份数据库
3. **权限**: 确保你的 Wrangler 账户有访问该数据库的权限
4. **认证**: 需要先登录 Wrangler
   ```bash
   wrangler login
   ```

### 最佳实践

1. **开发环境**: 建议创建单独的开发数据库用于本地测试
2. **数据同步**: 定期从生产环境导出数据到开发环境
3. **迁移测试**: 先在开发数据库测试迁移脚本，再应用到生产

## 创建开发数据库

如果需要创建独立的开发数据库：

```bash
# 1. 在 Cloudflare Dashboard 创建新的 D1 数据库
# 或使用 Wrangler（如果支持）
wrangler d1 create rebebuca-dev

# 2. 更新 wrangler.jsonc 添加开发数据库配置
# 3. 执行迁移脚本
wrangler d1 execute rebebuca-dev --remote --file=migrations/0001_init.sql
wrangler d1 execute rebebuca-dev --remote --file=migrations/0002_add_auth_provider.sql
wrangler d1 execute rebebuca-dev --remote --file=migrations/0003_add_invitation_codes.sql
wrangler d1 execute rebebuca-dev --remote --file=migrations/0004_add_user_role_and_status_execute.sql
```

## 故障排除

### 问题 1: 认证失败

```bash
# 重新登录
wrangler login
```

### 问题 2: 数据库不存在

```bash
# 检查数据库列表
wrangler d1 list

# 确认 database_id 是否正确
```

### 问题 3: 权限不足

确保你的 Cloudflare 账户有访问该数据库的权限。

## 快速参考

```bash
# 执行迁移脚本（远程）
wrangler d1 execute rebebuca --remote --file=migrations/0004_add_user_role_and_status_execute.sql

# 查看用户数据
wrangler d1 execute rebebuca --remote --command="SELECT email, role, is_banned FROM users LIMIT 10;"

# 备份数据库
wrangler d1 export rebebuca --remote --output=backup-$(date +%Y%m%d).sql

# 设置超级管理员
wrangler d1 execute rebebuca --remote --command="UPDATE users SET role = 'super_admin' WHERE email = 'admin@example.com';"
```
