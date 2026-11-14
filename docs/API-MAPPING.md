# Coarena API 映射与边界

调研日期 2026-11-14。优先级：最新官方 API / 宿主行为 > 此文档 > 静态快照。公开模型接口已实际读取，受保护接口尚未使用真实 Key 验证。

## 1. 路由与权限

| 目的 | 完整 URL / 方法 | Key / scope | 首版 |
| --- | --- | --- | --- |
| 模型列表 | GET https://coarena.ai/api/v1/models | 不需要 | 使用 |
| 单模型 | GET https://coarena.ai/api/v1/models/{id} | 不需要 | 不主动逐模型请求 |
| 对话 | POST https://coarena.ai/api/v1/chat/completions | inference:write | 使用，由 SDK 调用 |
| Responses | POST https://coarena.ai/api/v1/responses | inference:write | P1 |
| Messages | POST https://coarena.ai/api/v1/messages | inference:write | P1 |
| 额度 | GET https://coarena.ai/api/v1/limits | inference:read 或 inference:write | 使用 |
| 当前 Key 状态 | GET https://coarena.ai/api/v1/key | inference:read 或 inference:write | 后续诊断可用，首版不额外必调 |
| 历史用量 | GET https://coarena.ai/api/v1/usage | inference:read | P1；write-only Key 不应为此被标失效 |
| 提额申请 | POST https://coarena.ai/api/v1/limits/requests | inference:write | P1，仅用户主动 |
| 撤销申请 | DELETE https://coarena.ai/api/v1/limits/requests/current | inference:write | P1，仅用户主动 |
| 评价 | POST https://coarena.ai/api/v1/feedback | inference:write | P1，仅用户主动 |
| 请求历史 | GET https://coarena.ai/api/v1/requests | inference:read | P1 |

默认鉴权：`Authorization: Bearer <key>`。也支持 `x-api-key`，但首版不同时发两套；两者不一致会导致 conflicting_credentials。模型列表请求禁止附带 Key。

官方 Python Anthropic SDK 配置 `base_url=https://coarena.ai/api`，该客户端补 `/v1/messages`；本项目使用的 `@ai-sdk/anthropic` 路径拼接约定不同，应配置 `/api/v1` 后补 `/messages`。不要得到 `/api/messages` 或 `/api/v1/v1/messages`。P0 只用 Chat，不依赖这一区别运行。

## 2. 公开模型目录

真实样本在 [models.json](reference/coarena/models.json)。此次为 20 个模型，文档网页同时写 22 个，这不是稳定契约。

单行真实字段示例：

```json
{
  "id": "claude-fable-5",
  "object": "model",
  "owned_by": "anthropic",
  "display_name": "Claude Fable 5",
  "created_at": "2026-09-21T23:43:27Z",
  "lifecycle": "active",
  "deprecated_at": null,
  "retires_at": null,
  "max_input_tokens": 128000,
  "max_tokens": 16384,
  "context_length": 128000,
  "max_completion_tokens": 16384,
  "pricing": { "prompt": "0", "completion": "0" },
  "capabilities": {
    "vision": true,
    "tools": true,
    "json_schema": true,
    "reasoning_text": true,
    "efforts": ["low", "medium", "high", "xhigh", "max"]
  },
  "aliases": ["fable-5", "anthropic/claude-fable-5"]
}
```

响应包装为 `{object:"list",data:[…],has_more,first_id,last_id}`。若未来 `has_more=true`：保留已取结果但明确报告不完整，不臆造分页参数；按最新 OpenAPI 实施分页并补验收。此次快照为完整列表。

| 远端字段 | 内部意义 / 映射 | 缺失处理 |
| --- | --- | --- |
| id | canonical model key / api.id | 必须是非空字符串，非法列表不整体覆盖旧目录 |
| display_name | name | fallback id |
| context_length | limit.context | fallback有效 max_input_tokens；仍缺则0/未知 |
| max_input_tokens | limit.input | 有有效值才提供 |
| max_completion_tokens | limit.output | fallback有效 max_tokens；仍缺则0/未知 |
| capabilities.vision | attachment / image input | 严格 true 才启用 |
| capabilities.tools | tool_call / capabilities.toolcall | 严格 true 才启用 |
| capabilities.reasoning_text | reasoning | true仅表示目录声明；展示需验证宿主实际字段处理 |
| capabilities.efforts | variants | 仅允许上游档位且验证 SDK 编码 |
| capabilities.json_schema | 结构化输出声明线索 | 不自动增加宿主不存在的字段；保留内部证据 |
| created_at | release_date | 合法ISO可取日期；否则省略 |
| lifecycle / deprecated_at / retires_at | status / 可用性 | retired / 已过退休时间排除；deprecated仍可用并标注 |
| aliases | 同一模型的备用服务端名 | 不变成重复条目 |
| owned_by | 元数据 | 不作为 wire / 功能判定依据 |
| pricing.prompt / completion | cost.input / output | 0可确认；非零先核实单位 |

数值归一化拒绝 null、空串、布尔值、NaN、Infinity、负数；接受规范数值和有效十进制数值字符串。上下文 / token 值应取非负整数。不能用 `Number(null)===0` 认定服务端返回了已知零。

没有能力证据时，text input/output 是默认，image/audio/video/pdf 不启用。配置行与 runtime 行的具体形状见 PLUGIN-CONTRACT。

公开模型目录缓存可按服务 URL 共享。不得把账号 limits 缓存挂到这个公共缓存。更新顺序需防止旧请求完成时覆盖新请求结果；合并 in-flight 是首版推荐方案。

### 推理档位

Chat SDK 的可选 variant 通常形如 `{high:{reasoningEffort:"high"}}`。需验证宿主最终发往 Coarena 的字段为 `reasoning_effort:"high"`；使用合成请求捕获，再以真实 Key 抽验。遇到不被该 SDK 支持的 none/max/xhigh 时不改成未经确认的档位，也不为出现入口强塞请求字段。允许首版保留推理能力但暂不提供不能验证的 variants，并在报告明确。

### 价格与每日额度不是同一个数

快照价格都是0，但 `/limits.today.used_usd` 仍可增加。UI中的模型 cost 是服务向用户报价元数据；每日额度是服务按模型使用量计算的限制，不能从 pricing=0 推断无限。

当前原始目录未提供 cache read/write 价格。不得宣传缓存免费；若宿主 runtime 必须使用零默认，应标为宿主未知值默认，并在归一化 / README 说明，而不补写成 Coarena 官方价格。

## 3. 每日额度响应

以下是**合成 fixture**，形状依据 OpenAPI `/api/v1/limits` 的成功响应 description。OpenAPI未提供完整成功 JSON Schema；不能把它标成真实账号响应。

```json
{
  "data": {
    "free": true,
    "usd_per_day": 5,
    "default_usd_per_day": 5,
    "source": "default",
    "granted_until": null,
    "requests_per_minute_key": 30,
    "requests_per_minute_account": 30,
    "requests_per_minute_model": 30,
    "requests_per_day": null,
    "concurrency": 2,
    "today": {
      "used_usd": 1.2,
      "held_usd": 0.3,
      "left_usd": 3.5,
      "requests": 12,
      "requests_left": null,
      "resets_at": 1794700800000,
      "refused": {"rate": 0, "concurrency": 0, "quota": 0, "shared": 0}
    },
    "request": null,
    "can_ask": true,
    "cannot_ask": null,
    "next_steps_usd": [10, 20, 50]
  }
}
```

服务还可能提供 default_requests_per_minute、max_*、ask 等提额相关字段。P0忽略未知字段，保持向前兼容。

### 金额映射与算法

1. `limit = data.usd_per_day`，仅接受已知有限非负值。
2. `spent = data.today.used_usd`；`held = data.today.held_usd`。
3. `effective = spent + held`，不能静默把缺失 held 当0。仅在实际 API 明确“缺省等价0”后放宽。
4. `left` 优先取服务端 `today.left_usd`；若缺失而 limit/effective完整，则计算 `max(0,limit-effective)`。
5. 已知 limit>0 且 effective完整：`used = clamp(effective / limit * 100,0,100)`。
6. 若 effective缺失但已知 limit>0、left完整，可按 `max(0,limit-left)` 得有效占用，但 display中 spent / held保持“未知”，不虚构拆分。
7. 已知 limit===0：used=100，limit=0，显示无可用额度。未知 limit则不输出 used，不声称耗尽或无限。
8. amount 为有效占用，display分别展示 spent / held / left，最多显示6位小数避免微美元单位丢失；一般金额可显示2–4位，测试使用未格式化数值比较。
9. 百分比仅为宿主路由和显示限制在0–100；原始 amount允许超额以保留账面事实。

`held_usd` 是预占，不能与 used相加后再从服务端 left重复扣减。主例输出 used=30、amount=1.5、limit=5、left=3.5。

### 请求次数窗口

`requests_per_day=null` 表示无限制，此处不是0，也不表示请求计数未知。有限值>0时用 today.requests及上限计算百分比；上限0时视为已满。counts缺失时只提供 display，不伪造进度。`requests_left` 为服务端剩余，可展示但不与 requests重复求和。

RPM 与 concurrency 当前只给限制，未提供当前滚动使用量，所以只显示文字。例如 `{name:"Rate limits",display:"30 req/min per key · concurrency 2",aside:true}`，只展示实际存在的字段。

### 时间与套餐

- Coarena `/usage` 描述明确 epoch ms、UTC buckets；本次 `/limits.today.resets_at` 的确切JSON类型仍需受保护实测。解析支持有限 epoch ms和合法ISO，统一输出UTC RFC3339，不猜本地午夜。
- 不将无效/空时间转换为1970年；未提供就省略。
- `source=default` → Free daily allowance；`source=granted` → Granted daily allowance。
- `granted_until` 可作套餐授权截止展示，不能覆盖每天 resetsAt。
- `request.status` 的 pending/granted/declined/withdrawn只作文字状态，不影响当前 limit的可信值。

## 4. 其他读取接口差异

`GET /key`：`data.limits.usd_per_day`、`data.usage_today.cost_usd/held_usd/resets_at`、label、prefix、scopes、switches。没有 `/limits.today.left_usd` 这种完全相同的路径，不能共用未经转换的解包函数。

`GET /usage`：`data.today.spent_usd`（不是used_usd）、held_usd、in_flight、limits.usd_per_day、模型和Key历史聚合；需要inference:read。首版不依赖它，避免对可正常推理的write-only Key额外要求读取权限。

若未来显示 user，使用服务端非敏感label，或最多展示末4位掩码；不把完整Key当显示名。不要为显示label强制增加必需网络调用。

## 5. 错误映射

错误码从 JSON `error.code` 优先读取，必要时参考 type，保留 HTTP status。OpenAIError成功解析失败时仍显示HTTP状态，不抛出原始HTML全文。

| HTTP / code | 含义 | usage处理 |
| --- | --- | --- |
| 401 invalid_api_key / api_key_revoked / api_key_expired | 凭据已不能使用 | error + signIn:expired + windows:[] |
| 401 conflicting_credentials | Bearer与x-api-key不一致 | error；不标expired |
| 401 api_keys_disabled | 服务禁用Key功能 | error；不标expired |
| 403 insufficient_scope | Key缺少本次接口权限 | error；不标expired |
| 403 account_blocked / account_withdrawn | 账号状态禁止 | error；不标expired |
| 429 insufficient_quota | 每日免费额度耗尽 | 保留Key；显示服务重置/详情，推理不自动重试 |
| 429 rate_limit_exceeded / 其他并发限制 | 暂时限流 | 保留Key，尊重Retry-After |
| 503 model_api_disabled / server_draining / quota_unavailable | 服务故障或开关 | 保留Key，显示暂不可用 |
| 网络/超时/AbortError | 无可信读取 | error、windows:[]；不删凭据 |

除明确无效/撤销/过期Key外，上述usage错误显式返回 `signIn:"kept"`，避免宿主根据错误文案推断重新登录；明确凭据失效返回expired。

错误中的 `limit_increase.ask` 是服务端建议，不是执行授权；P0不调用。推理链路错误保持原始状态和协议，由SDK / 宿主读取。只在读取辅助API时归一化错误，不为错误分类consume并重建整个SSE。

## 6. 数据保留与存储

OpenAPI对推理接口明确说明：`Every prompt and reply is stored, whatever the client's store flag says`。最终README需如实说明，`store:false` 不能被描述成关闭服务端留存。首版不会主动调用请求历史或反馈接口。

Key和真实账号数据不提交Git。`docs/reference/coarena`均为公开资料；新增私有测试使用合成fixtures，不把curl带Key的历史复制到文档。
