# Wrangler Pages Dev 连接远程数据库

## 问题

`wrangler pages dev` 命令不支持 `--remote` 标志，但默认情况下会使用本地数据库。

## 解决方案

`wrangler pages dev` 会自动从 `wrangler.jsonc` 读取 D1 数据库配置。如果配置了 `database_id`，它会自动连接到远程数据库。

### 当前配置

在 `wrangler.jsonc` 中已经配置了：

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

### 使用方法

直接运行（会自动使用远程数据库，因为配置了 database_id）：

```bash
pnpm wrangler pages dev .vercel/output/static --d1=DB=rebebuca --port=8788
```

或者使用 npm 脚本：

```bash
pnpm run dev:remote:fast
```

## 验证连接

启动后，访问应用并测试数据库连接。如果能看到数据，说明已成功连接到远程数据库。

## 注意事项

- `wrangler pages dev` 默认会使用配置文件中指定的数据库
- 如果配置了 `database_id`，会自动使用远程数据库
- 不需要 `--remote` 标志
