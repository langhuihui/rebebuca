# 数据库操作命令参考

## 快速参考

### 执行迁移脚本

```bash
# 方法 1: 使用 npm 脚本
pnpm run db:migrate

# 方法 2: 直接使用 wrangler
pnpm wrangler d1 execute rebebuca --remote --file=migrations/0004_add_user_role_and_status_execute.sql
```

### 执行 SQL 查询

```bash
# 查看所有用户
pnpm wrangler d1 execute rebebuca --remote --command="SELECT email, role, is_banned FROM users LIMIT 10;"

# 查看用户统计
pnpm wrangler d1 execute rebebuca --remote --command="SELECT COUNT(*) as total, COUNT(CASE WHEN role = 'super_admin' THEN 1 END) as admins FROM users;"

# 设置超级管理员
pnpm wrangler d1 execute rebebuca --remote --command="UPDATE users SET role = 'super_admin' WHERE email = 'your-email@example.com';"
```

### 备份数据库

```bash
# 使用脚本
pnpm run db:export

# 或直接命令
pnpm wrangler d1 export rebebuca --remote --output=backup.sql
```

### 查看数据库信息

```bash
# 列出所有数据库
pnpm wrangler d1 list

# 查看特定数据库信息
pnpm wrangler d1 info rebebuca
```

## 常见问题

### 问题 1: "Unknown argument: remote"

**原因**: 可能是命令格式问题或 Wrangler 版本问题

**解决方案**:
1. 确保使用 `pnpm wrangler` 而不是直接 `wrangler`
2. 确保 `--remote` 标志在数据库名称之后
3. 检查 Wrangler 版本: `pnpm wrangler --version`

**正确格式**:
```bash
pnpm wrangler d1 execute <database-name> --remote --file=<file>
pnpm wrangler d1 execute <database-name> --remote --command="<sql>"
```

### 问题 2: 认证失败

```bash
# 重新登录
pnpm wrangler login
```

### 问题 3: 数据库不存在

```bash
# 检查数据库列表
pnpm wrangler d1 list

# 确认 wrangler.jsonc 中的 database_name 和 database_id 是否正确
```

## 命令格式说明

### 基本格式

```bash
pnpm wrangler d1 execute <database> [options]
```

### 必需参数

- `<database>`: 数据库名称（在 wrangler.jsonc 中定义的 `database_name`）

### 必需选项（二选一）

- `--command "<sql>"`: 执行 SQL 命令
- `--file <path>`: 执行 SQL 文件

### 重要标志

- `--remote`: 连接到远程数据库（生产环境）
- `--local`: 连接到本地数据库（开发环境）
- `--preview`: 连接到预览数据库

### 示例

```bash
# ✅ 正确 - 远程执行文件
pnpm wrangler d1 execute rebebuca --remote --file=migrations/0004.sql

# ✅ 正确 - 远程执行命令
pnpm wrangler d1 execute rebebuca --remote --command="SELECT * FROM users;"

# ❌ 错误 - 标志位置不对
pnpm wrangler d1 execute --remote rebebuca --file=migrations/0004.sql

# ❌ 错误 - 缺少数据库名称
pnpm wrangler d1 execute --remote --file=migrations/0004.sql
```

## 迁移脚本执行步骤

### 1. 备份数据库（重要！）

```bash
pnpm run db:export
```

### 2. 检查当前表结构

```bash
pnpm wrangler d1 execute rebebuca --remote --command="PRAGMA table_info(users);"
```

### 3. 执行迁移

```bash
pnpm run db:migrate
```

### 4. 验证迁移

```bash
pnpm wrangler d1 execute rebebuca --remote --command="SELECT COUNT(*) as total, COUNT(CASE WHEN role = 'user' THEN 1 END) as users, COUNT(CASE WHEN role = 'super_admin' THEN 1 END) as admins FROM users;"
```

## 本地开发连接远程数据库

### 使用开发服务器

```bash
# 启动开发服务器（连接远程数据库）
pnpm run dev:remote
```

### 直接执行 SQL

```bash
# 执行查询
pnpm wrangler d1 execute rebebuca --remote --command="SELECT * FROM users LIMIT 5;"

# 执行更新
pnpm wrangler d1 execute rebebuca --remote --command="UPDATE users SET role = 'user' WHERE role IS NULL;"
```

## 安全提示

⚠️ **重要**: 使用 `--remote` 标志会直接操作生产数据库！

1. **始终先备份**: `pnpm run db:export`
2. **测试查询**: 先用 `SELECT` 查询验证
3. **小批量操作**: 避免一次性修改大量数据
4. **验证结果**: 执行后立即验证数据
