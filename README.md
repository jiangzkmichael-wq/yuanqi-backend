# 腾讯元器小程序后台

基于 Vercel Functions、Node.js 和 Supabase PostgreSQL。

## API

### 校验额度

```http
GET /api/check-quota?open_id=USER_OPEN_ID
```

响应：

```json
{
  "can_answer": true,
  "remaining": 10
}
```

不存在的用户会自动创建。有效会员不受剩余次数限制。

### 扣减额度

```http
POST /api/deduct-quota
Content-Type: application/json

{
  "open_id": "USER_OPEN_ID"
}
```

有效会员不会扣减次数。非会员额度耗尽时返回 HTTP `409`：

```json
{
  "success": false,
  "remaining": 0
}
```

### 创建订单

```http
POST /api/create-order
Content-Type: application/json

{
  "open_id": "USER_OPEN_ID",
  "plan_type": "month"
}
```

金额单位为分：月卡 `990`、季卡 `2990`、年卡 `9900`。

### 微信支付回调

当前使用临时 mock 签名：

```http
POST /api/pay-callback
Content-Type: application/json
X-Wechat-Mock-Signature: YOUR_CALLBACK_SECRET

{
  "order_no": "YQ..."
}
```

同一订单的重复回调不会重复延长会员。上线真实支付前，必须将
`lib/wechat-pay.js` 替换为微信支付 API v3 的证书和签名验证。

## Supabase 初始化

1. 打开 Supabase 项目的 SQL Editor。
2. 执行 [`supabase/schema.sql`](supabase/schema.sql)。
3. 在 Project Settings 的 API 页面复制项目 URL 和 anon key。

SQL 中使用 PostgreSQL 函数完成原子扣减和幂等支付，避免并发请求造成
重复扣次数或重复增加会员期限。

## 环境变量

在 Vercel 项目中配置：

```text
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-supabase-anon-key
WECHAT_PAY_CALLBACK_SECRET=replace-with-a-long-random-string
```

前两个变量用于连接 Supabase。第三个变量只用于当前 mock 支付回调保护。

## 本地运行

```powershell
npm install
Copy-Item .env.example .env.local
npm run dev
```

## 部署

将项目推送到 GitHub 后，在 Vercel 导入仓库并填写环境变量即可。也可以：

```powershell
npm run deploy
```

## 安全说明

- `open_id` 必须由可信的腾讯元器调用链提供，不能直接相信普通客户端传值。
- 当前支付签名只是 mock，不能直接用于真实微信支付。
- Supabase anon key 不是高权限密钥，但本项目的数据库 RPC 被授权给 `anon`
  角色，因此不要在前端代码中直接暴露项目连接信息。
