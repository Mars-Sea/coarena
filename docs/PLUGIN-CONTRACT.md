# 插件契约与兼容入口

此文档与 PRD 一起使用。参考源码均已放入 [reference/plugins/river](reference/plugins/river)，不要求访问原 monorepo。

## 1. 最小包结构与元数据

实施时创建以下 package.json；这是**计划示例**，包名可用性与实际版本需要在发布前确认：

```json
{
  "name": "opencode-coarena-auth",
  "version": "0.1.0",
  "description": "Coarena Model API provider for Magpie and OpenCode",
  "type": "module",
  "main": "./opencode.mjs",
  "exports": { ".": "./opencode2.mjs" },
  "files": [
    "index.mjs", "opencode.mjs", "opencode2.mjs",
    "models.bootstrap.json", "README.md", "LICENSE"
  ],
  "scripts": {
    "test": "bun test",
    "check": "bun scripts/check.mjs"
  },
  "keywords": ["opencode", "opencode-plugin", "magpie", "coarena"],
  "license": "MIT"
}
```

按实际拆分添加 runtime 模块到 files；不把 docs/reference 打入 npm。repository 字段在远程地址确定后填写，不复制原项目的 repository.directory。不需要在本仓库创建 packages/coarena 或 workspaces。

## 2. 插件模块与三个 hook

以下是契约说明，省略实现函数，**不能直接作为可运行插件交付**：

```js
// index.mjs
const ID = "coarena"
const BASE = "https://coarena.ai/api/v1"

function createPlugin({ fetchImpl = globalThis.fetch, now = Date.now } = {}) {
  return {
    async config(cfg) {
      cfg.provider ??= {}
      cfg.provider[ID] ??= {
        name: "Coarena",
        npm: "@ai-sdk/openai-compatible",
        api: BASE,
        models: /* config-style bootstrap rows */ {},
      }
    },
    auth: {
      provider: ID,
      methods: [{ type: "api", label: "Coarena API key", placeholder: "coa_…" }],
      async loader(getAuth, provider) {
        const auth = await getAuth()
        if (auth?.type !== "api" || !auth.key) return {}
        return { baseURL: BASE, apiKey: auth.key }
      },
      async usage(getAuth, provider, { signal } = {}) {
        // selected account → GET /limits → normalized Usage
      },
    },
    provider: {
      id: ID,
      async models(provider, { auth, signal } = {}) {
        // public GET /models → runtime-style rows; no key needed
      },
    },
  }
}

export const CoarenaPlugin = async () => createPlugin()
export const _internal = { createPlugin }
```

只有 `opencode.mjs` 作为旧入口：

```js
export { CoarenaPlugin } from "./index.mjs"
```

原因是 Magpie / OpenCode 1.x 将入口中的导出按插件加载，额外辅助函数可能被当作插件执行，非函数导出也可能被拒绝。`_internal` 仅从测试直接 import index.mjs，不从 main 导出。

简单 `type:"api"` 登录由宿主提问并保存 Key，不自行写 auth 文件；无需 OAuth 或 `authorize()`。loader 使用 `getAuth()` 的当前账号，不能缓存一个供所有账号使用的 Key。

## 3. 配置模型与运行时模型必须分开归一化

配置 hook 的 `config.provider.coarena.models[id]`：

```js
{
  id: "claude-fable-5",
  name: "Claude Fable 5",
  provider: {
    npm: "@ai-sdk/openai-compatible",
    api: "https://coarena.ai/api/v1"
  },
  reasoning: true,
  attachment: true,
  tool_call: true,
  modalities: { input: ["text", "image"], output: ["text"] },
  limit: { context: 128000, input: 128000, output: 16384 },
  cost: { input: 0, output: 0 },
  variants: {}
}
```

live hook `provider.models()` 应返回 runtime-style map，不能只把 config rows 原样返回而期待所有宿主正确推断：

```js
{
  "claude-fable-5": {
    id: "claude-fable-5",
    name: "Claude Fable 5",
    api: {
      id: "claude-fable-5",
      url: "https://coarena.ai/api/v1",
      npm: "@ai-sdk/openai-compatible"
    },
    status: "active",
    headers: {},
    options: {},
    limit: { context: 128000, input: 128000, output: 16384 },
    cost: { input: 0, output: 0, cache: { read: 0, write: 0 } },
    capabilities: {
      temperature: false,
      reasoning: true,
      attachment: true,
      toolcall: true,
      input: { text: true, image: true, audio: false, video: false, pdf: false },
      output: { text: true, image: false, audio: false, video: false, pdf: false },
      interleaved: false
    },
    release_date: "2026-09-21",
    variants: {}
  }
}
```

上述数值取自公开样本；零价格和 cache 的处理见 API-MAPPING，示例不能推广为所有模型的固定值。其中cache read/write的0是宿主未知价格默认，不是Coarena官方价格。温度、cache、interleaved 等未获服务端证明的能力保持保守默认，不因模型品牌启用。

建议内部只维护一个 canonical model，再用 `toConfigModel()`、`toRuntimeModel()` 转换。测试分别验证：

- config：`provider.api/npm`、`tool_call`、`modalities`、`cost.cache_read/cache_write`。
- runtime：`api.url/npm/id`、`capabilities.toolcall/input/output`、`cost.cache.read/write`。
- v2：转换后的 `modelID`、`package`、`limit`、`capabilities.tools` 与 `settings.baseURL`。

## 4. Magpie usage hook

准确契约来自保存的 [host.js](reference/magpie/host.js) 中 `usageOf` 与其上方注释（调研快照约 3226–3328 行）：

```js
{
  plan: "Free daily allowance",
  user: "Optional non-secret account label",
  until: "2026-12-01T00:00:00.000Z", // 有明确授权有效期时才填
  balance: "$3.50",                 // 可选顶层字符串，不是数值
  windows: [{
    name: "Daily model allowance",
    used: 30,                       // 百分比，不是 0.30
    amount: 1.5,                    // used_usd + held_usd
    limit: 5,
    unit: "USD",
    span: 86400,
    resetsAt: "2026-11-15T00:00:00.000Z",
    display: "Used $1.20 · Held $0.30 · Left $3.50 / $5.00"
  }]
}
```

此例是合成数据。日重置由服务端返回，不因示例时间推定总在 UTC 零点。

- `used` 是百分比；缺失时意味着未知，不应随手填 0。
- 上游有明确值时显式填 `used:0`，避免零 amount 被视作未读数。
- `amount/limit/unit` 为已消耗的量 / 上限 / 单位，不是剩余 / 上限。
- `aside:true` 将窗口排除出额度路由，适合 RPM、并发和申请状态说明。
- 真正无总额的钱包可提供窗口级数值 `balance`；Coarena 每日额度有总额，应使用 amount/limit，而不伪装为永久预付余额。
- 顶层 `balance` 是可选显示字符串。首版建议只用窗口 display，减少每日额度与钱包概念混淆。
- `signIn` 支持 `expired|kept|renewed`；只有确定凭据失效才返回 expired。非凭据错误明确返回 `signIn:"kept"`，因为宿主在缺少此字段时可能依据错误文案推断需要重新登录。
- 读取失败：`{error:"Coarena …",signIn:"kept",windows:[]}`；已确定无效Key则用expired。不会伪造读取成功。
- 第三个参数 `{signal}` 可不存在，要与 15 秒读取超时组合。宿主取消后不重试。

不要实现顶层 `quota()` 或 `usage()`：实际入口是 `auth.usage()`。宿主对外 `magpie quota --json` 的 `remaining` 是归一化输出，不要求插件重复返回。

## 5. OpenCode 2.x 适配器

[reference/plugins/river/opencode2.mjs](reference/plugins/river/opencode2.mjs) 是原仓库 canonical `scripts/opencode2.mjs` 的逐字副本，导入 `./opencode.mjs` 并读取相邻 package.json。

实施时将它作为仓库根目录适配器的基线，保留MIT归属；不要只摘取default一行。完整复制后还必须针对Coarena调整和测试下述边界，不能原样复制即宣告兼容。它最终导出：

```js
export default { id: pkg.name, setup: (ctx) => setup(ctx) }
```

完整适配过程远多于这一行。它完成auth、provider配置、动态模型、SDK选项 / fetch的桥接；不会暴露Magpie的usage / checkin UI，也不会实现全部会话hook。

### 基线已知限制与必须调整项

1. 参考适配器的refresh在无auth时直接跳过models；Coarena的目录是公共API，必须在setup启动读取时允许无Key调用，不把无凭据当作无目录。保留真实推理仍需Key的边界。
2. 原版只在setup / 凭据切换或改变时刷新；五分钟TTL不会主动触发。首版保证setup、重新加载插件、账号变化时读取最新目录，空列表必须清空旧模型。凭据不变的现有会话不保证后台即时更新，用户可重新加载；若接入宿主原生刷新，需引用实际可用的API，避免reload递归。不增加后台轮询器。
3. `wrapFetch` 的Request分支会`await req.text()`并只传method/headers/body/signal，丢失init扩展选项。调整时保持Request有效属性、body及init覆盖语义，同时透传代理/dispatcher/redirect等选项；不无条件把body变为文本。若环境转发流需要duplex，按所测runtime处理。不要仅修正字符串URL分支。
4. 失败map的 `Symbol.for("magpie.fellBack")` 不会随Object.entries转成模型。桥接应检测它并保留last-good / bootstrap，记录非敏感诊断，不能把失败当成功空表；成功 `{}` 则替换为空。

新增setup(ctx)桥接测试：无凭据公共发现、凭据不变重新加载后模型更新、有效空目录、失败保留目录，以及fetch(Request,init)的body/abort/代理选项传递。文档需要记录相对于canonical的具体补丁理由；本独立包不受monorepo“适配器逐字一致”检查约束。

适配器 `packageOf()` 会为 SDK 声明加 `aisdk:` 与版本标记，例如当前 `@ai-sdk/openai-compatible@2.0.41`。这些是快照实现细节；实现时验证宿主版本，不把 SDK 当作本插件必须安装的运行依赖。

## 6. 多协议扩展规则（P1）

| 协议 | SDK 名称 | SDK 路径基址 | 追加路径 |
| --- | --- | --- | --- |
| Chat Completions | @ai-sdk/openai-compatible | https://coarena.ai/api/v1 | /chat/completions |
| Responses | @ai-sdk/openai | https://coarena.ai/api/v1 | /responses |
| Anthropic Messages（AI SDK） | @ai-sdk/anthropic | https://coarena.ai/api/v1 | /messages |

配置行使用 `provider:{npm,api}`；运行时行使用 `api:{id,npm,url}`。Magpie 也支持模型上的 `also:["@ai-sdk/openai","@ai-sdk/anthropic"]`，但只有验证后才启用；它改变客户端协议是否直接透传，不能仅凭接口存在就添加。

宿主 loader 的 `baseURL` 可能覆盖模型 URL，所以未来混用不同基址需重新检查请求路径。本服务三种 AI SDK 可用相同 `/api/v1`，首版使用 Chat，无需复杂自定义路由。

### 目录回退信号

Magpie宿主以 `Symbol.for("magpie.fellBack")` 识别插件自行返回的旧目录（host.js约2265行）。例如失败时返回：

```js
const result = { ...lastGoodRuntimeModels }
Object.defineProperty(result, Symbol.for("magpie.fellBack"), { value: true })
return result
```

缓存本体不带标记；后续成功返回不能继承它。格式错误可抛异常让宿主保留旧目录，错误不设置expired。HTTP200格式错误也不是成功；有效空目录应返回无标记 `{}`。宿主检查应看到失败的fellBack / listError，而不是“新目录读取成功”。

## 7. 独立结构检查与发布边界

[reference/plugins/check.mjs](reference/plugins/check.mjs) 是检查逻辑的阅读快照，依赖原 monorepo 的 packages 与 registry.mjs，**不可直接复制运行**。本仓库实施时编写最小独立 check：

1. import package.main，只允许插件入口导出。
2. 用 mock client / directory 调用插件，不发网络。
3. 检查 auth.provider / methods / loader、config 中 npm / api、动态 hook 与 provider id 一致。
4. import exports["."]，检查 default.id 与 setup。
5. 检查所有入口与 runtime imports 均在 npm files 中。
6. 检查 config 不覆盖用户数据，bootstrap 可离线读取。

社区 registry、dist 分支、组织 npm OIDC 都不是独立插件运行的前置条件。以后上架时才准备 registry 条目：package、name、providers:["coarena"]、summary:{en,zh}，可选 icon。安装成功不代表已出现在 Magpie Discover 市场。
