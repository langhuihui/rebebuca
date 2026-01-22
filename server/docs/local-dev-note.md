# 本地开发说明

## 关于数据库连接

`wrangler pages dev` 在开发模式下**默认使用本地数据库**，而不是远程数据库。这是 Cloudflare 的设计，用于：

1. **更快的开发体验** - 本地数据库响应更快
2. **数据隔离** - 不会影响生产数据
3. **离线开发** - 可以在没有网络连接时开发

## 使用本地数据库进行测试

### 1. 同步远程数据到本地（可选）

如果需要使用真实数据测试：

```bash
# 导出远程数据库
pnpm wrangler d1 export rebebuca --remote --output=backup.sql

# 导入到本地数据库（需要先创建本地数据库）
# 注意：wrangler pages dev 会自动创建本地数据库
```

### 2. 启动开发服务器

```bash
# 构建并启动
pnpm run dev:remote

# 或快速启动（已构建）
pnpm run dev:remote:fast
```

### 3. 测试功能

- 访问 `http://localhost:8788`
- 测试页面功能
- 数据库操作会使用本地数据库

## 使用远程数据库

如果需要真正使用远程数据库，可以：

### 方法 1: 使用 Cloudflare Dashboard

直接在 Cloudflare Dashboard 中测试部署的应用。

### 方法 2: 部署到预览环境

```bash
pnpm run deploy:pages
```

然后访问预览 URL。

### 方法 3: 使用 Wrangler D1 命令直接操作

```bash
# 查询远程数据库
pnpm wrangler d1 execute rebebuca --remote --command="SELECT * FROM users;"
```

## 推荐工作流程

1. **开发阶段**: 使用本地数据库 (`pnpm run dev:remote`)
   - 快速迭代
   - 不影响生产数据
   - 可以随意测试

2. **功能测试**: 部署到预览环境
   - 使用真实远程数据库
   - 完整测试所有功能

3. **生产部署**: 部署到生产环境
   - 最终验证
   - 正式发布

## 当前配置

`wrangler.jsonc` 中已配置数据库：

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

`wrangler pages dev` 会自动：
- 创建本地数据库副本
- 使用相同的数据库结构
- 提供相同的开发体验

## 注意事项

- 本地数据库的数据不会自动同步到远程
- 本地数据库的修改不会影响远程数据库
- 如果需要真实数据，需要手动同步或使用预览环境
