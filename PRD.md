# Coarena PRD

版本：1.0 · 状态：Ready for implementation · 调研日期：2026-11-14

项目：`/Users/mars-sea/Development/opencode-coarena-auth` · 初始分支：`main`

## 1. 背景与目标

Coarena 提供一个 API Key 访问多个厂商模型的 Model API，支持 OpenAI Chat Completions、Responses 和 Anthropic Messages。官方当前宣传免费每日 $5 模型用量、每分钟 30 次请求、2 个并发；账号获批额度可能不同，必须以账号接口返回值为准。

当前社区插件仓库使用 provider 插件把厂商接入 Magpie 和 OpenCode。用户希望把 Coarena 接为同类 provider，但项目必须在独立仓库维护，避免依赖原 monorepo 的目录、发布权限和自动化。

本项目的交付目标是：用户安装插件、粘贴 Coarena Key 后，能选取实时模型、进行编码会话，并在 Magpie 了解当天可用额度。需求和技术交接资料必须足够完整，使后续 AI 无需原仓库即可实现。

## 2. 用户与使用场景

| 用户 | 场景 | 成功结果 |
| --- | --- | --- |
| Magpie 用户 | 添加 Coarena 账号，供代理或网关调用 | Provider 可见，模型可选，对话正常 |
| OpenCode 用户 | 把 Coarena 用作编码模型来源 | 工具调用、流式输出和多轮会话可用 |
| 多账号用户 | 在 Magpie 切换或路由不同 Key | 凭据、用量和错误属于各自账号 |
| 插件维护者 | 模型上线、下线或账号额度变化 | 自动读取实时信息，不必逐个发版 |
| 接手开发的 AI | 从本仓库启动实施 | 能依规范实现、测试、打包并报告未验证项 |

## 3. 产品定位与范围

本插件是 **provider / auth 插件**：由宿主提供账号管理、模型选择、对话 UI、代理、请求分发和插件管理。首版不创建独立网页、MCP 服务或中转服务器。

### 3.1 P0：首版必须交付

1. `coarena` provider 注册，API Key 登录方式，宿主管理凭据。
2. 使用 OpenAI Chat Completions 兼容协议调用 Coarena 全部实时模型。
3. 普通响应、SSE 流式响应、客户端取消和多轮工具调用正常。
4. 动态模型发现，映射名称、上下文、最大输出、工具、图像、推理能力和已知价格。
5. Magpie `auth.usage` 读取真实每日美元额度、已用、预占、剩余与重置时间；可选每日请求数上限。
6. 准确区分 Key 失效、权限不足、账号限制、额度耗尽、限流和服务故障。
7. Magpie、OpenCode 1.x、OpenCode 2.x 的加载入口与模型映射兼容；实际运行验证另列，不以导入测试替代。
8. 可离线运行的测试、本地安装说明、npm 打包文件清单和维护文档。

### 3.2 P1：后续可选，不阻塞首版

- 显式切换 Responses 或 Anthropic Messages；通过宿主支持的 `also` 暴露多协议。
- 展示历史用量、模型 / Key 明细与请求日志。
- 用户主动触发的额度提升申请和撤销申请。
- 用户主动评价模型响应。
- 提交社区 `registry.json`、配置 npm 发布和 CI 发布。

### 3.3 不在本项目首版范围

浏览器自动登录、创建 Key、管理其他 Key、签到、自动申请提高额度、自动反馈、请求日志导出、内建网页搜索、图片生成、语音、视频、绕过服务限流、独立账号系统。不调用与推理接入无关的 Coarena Arena / 评测 API。

## 4. 已确定的产品与技术决策

| 项目 | 决策 | 理由 |
| --- | --- | --- |
| Provider ID | `coarena` | 稳定、独立，不冒充 OpenAI / Anthropic |
| 插件名称 | `Coarena` | 用户指定，与服务品牌一致 |
| 包名 | `coarena` | npm 包名使用小写；独立维护，发布前检查可用性 |
| 语言与运行形式 | ESM JavaScript，`.mjs` | 与现有同类插件一致，避免首版编译链 |
| 默认推理协议 | `@ai-sdk/openai-compatible` | 全部模型使用一个兼容入口；减少路由和鉴权差异 |
| 推理基址 | `https://coarena.ai/api/v1` | SDK 在其后附加 `/chat/completions` |
| 登录方式 | API Key | 官方 Key 创建依赖用户网页会话，无需自制 OAuth |
| 目录来源 | 公开 `GET /api/v1/models` | 不消耗推理额度、不依赖已登录账号 |
| 额度来源 | 鉴权 `GET /api/v1/limits` | 直接给出 used / held / left 和生效额度 |
| 签到 hook | 不提供 | 每日免费额度不等于存在签到接口 |
| 私有数据持久化 | 不新增 | Key 交宿主；用量仅内存缓存 |
| 生产运行依赖 | 默认不新增 | 原生 fetch 足够；宿主解析 SDK 名称 |

`@ai-sdk/openai` 在此生态指向 Responses，不能因其名字看似更通用而替换首版 SDK。Coarena 官方 Python Anthropic SDK 示例使用的 `/api`，也不能直接照搬为所有 AI SDK 的 `api` 值，详见接口映射文档。

## 5. 用户流程与交互要求

### 5.1 安装与登录

1. Magpie用户在宿主通过本地路径安装插件；OpenCode本地加载按所装版本文档验证并记录方式。未来发布后也可使用npm包名。
2. Provider 显示为 Coarena。登录选项显示 `Coarena API key`，可提示 `coa_…`。
3. 提示用户从 `https://coarena.ai/account/api` 创建 Key，并说明由宿主保存。
4. 用户粘贴 Key，宿主保存后 loader 按选中账号取得 `{type:"api",key}`。
5. 模型读取只访问公开目录；Key 可用性由额度读取或用户主动的模型调用验证。不得为登录自动发送计费推理。

首版沿用宿主 API 登录输入；若输入由插件处理则 trim 首尾空白、拒绝空值。Key 前缀仅作提示，不用严格正则限制未来新格式。

### 5.2 模型选择与对话

- 模型列表显示远端 `display_name`，退化为 `id`；发送时始终使用 canonical `id`。
- 不根据 `claude`、`gpt`、`gemini` 等名字推断厂商原生能力或路由。
- 仅有明确 `vision=true` 才声明图片输入；仅有 `tools=true` 才声明工具调用。
- 第一段流式内容及时到达宿主；不得为统计用量缓冲完整 SSE。
- 普通函数工具由宿主执行并回传。Coarena 未支持的内置网页搜索不能被宣传为可用。
- 用户取消时终止网络请求；取消不触发插件重试。

### 5.3 额度显示

在 Magpie 现有 Usage 卡片显示：

- 套餐：`Free daily allowance` 或 `Granted daily allowance`，依据 `source`。
- 主窗口：`Daily model allowance`，以 USD 表示今日有效消耗 / 每日额度。
- 文本：例如 `已用 $1.20 · 预占 $0.30 · 剩余 $3.50 / $5.00`。
- 重置时间使用服务端 `resets_at` 转 RFC 3339，显示时区由宿主决定。
- `requests_per_day` 为有限数时显示每日请求数窗口；为 null 时不显示有限请求进度。
- RPM 和并发数仅作 `aside: true` 的文字说明；不能伪造当前 RPM 使用率或实时并发。
- 获批额度、授权截止时间与申请状态可作为文字补充；不得自动申请或撤销。

OpenCode 不消费 Magpie usage hook。README 要明确该能力的宿主差异，不承诺 OpenCode 中存在同样卡片。

### 5.4 错误文案原则

保留上游可用的错误 code、message、HTTP 状态与 request ID，去掉 Key、认证头、完整用户提示词等敏感内容。简短指出下一步：更新 Key、检查 scopes、等待重置或稍后重试。错误不得显示成“余额为 0”的成功读取。

## 6. 功能需求

### F01：Provider 注册与入口

- `config(cfg)` 声明 name、npm、api、models；使用 `cfg.provider ??= {}` 与 `cfg.provider.coarena ??= …` 保留用户已有配置。
- `auth.provider`、`provider.id` 与 config 键必须一致。
- provider 在尚无网络或 Key 时仍可加载；模块导入和 config hook 不发网络请求。
- `main=./opencode.mjs` 只导出插件函数，供 Magpie / OpenCode 1.x 读取。
- `exports["."]=./opencode2.mjs` 提供默认 `{id,setup}` 兼容面；以随附参考适配器为基线，保留MIT归属，按PLUGIN-CONTRACT修正公共目录读取 / 刷新和Request转发，再确认打包完整。不能把原样复制视为满足所有验收。
- 业务辅助函数不得导出为宿主可见插件函数，测试专用 `_internal` 仅存在非入口模块。

### F02：认证与请求

- 方法形状：`{type:"api",label:"Coarena API key",placeholder:"coa_…"}`。
- `loader(getAuth)` 只从 `getAuth()` 取选中账号；无 API Key 返回 `{}`。
- 正常返回 `{baseURL:"https://coarena.ai/api/v1",apiKey:auth.key}`。
- 首版尽量使用宿主默认请求链路，不提供改写 SSE / JSON 的 fetch 层。若兼容验证发现必须包装 fetch，应保持 signal、Request 语义、body、headers 和宿主代理链路。
- 模型目录请求不带 Key；额度请求只发送一种 Key 头，默认 `Authorization: Bearer …`。
- 不读取宿主 auth.json / plugin-auth.json，不存全局“当前 Key”，不把环境 Key 静默覆盖到选中账号。

### F03：动态模型目录

- 签名为 `provider.models(provider, {auth,signal} = {})`；即使未登录也可以读取公开目录，并遵循宿主提供的取消信号。
- 输入：`{object:"list",data:[…]}`；返回以 canonical ID 为键的模型 map。
- `data:[]` 是有效空目录，应清空 bootstrap；不能按网络失败处理。
- 非 JSON、缺少 data、data 非数组、非法 ID：报告目录格式异常并让宿主保留旧目录；不得缓存为成功空列表。
- 网络超时、429、5xx：返回上一份有效目录；没有历史则返回bootstrap。回退map必须在副本上设置 `Symbol.for("magpie.fellBack") = true`，让Magpie识别失败 / 旧数据；不得污染成功缓存。格式错误也可抛带说明的异常让宿主保留旧目录。有效空map不带此标记。
- 刷新由宿主读取、插件重新加载、登录 / 切换账号等明确触发，TTL仅避免重复请求，不自动调度。v2需修正桥接，在setup中无Key也读取公开目录；会话中未触发刷新可继续使用最近目录，用户可重新加载插件获取更新。若实现宿主原生手动刷新，记录实际API，不虚构事件、不新增定时轮询。
- 公共目录 401 / 403 不代表用户 Key 失效，不设置 signIn expired。
- 同 ID 去重；不展开 aliases 成重复模型；保留 active / deprecated 状态，明确 retired 或 retires_at 已到的模型不再作为可用模型返回。未知 lifecycle 不臆断下线。
- 所有数值必须有限且非负，能力仅按远端明确字段启用。字段不完整不导致整个插件崩溃。
- 公开目录成功缓存 TTL 5 分钟，并合并同一时刻的刷新请求；以注入时钟测试边界。失败不覆盖 last-good，失败增加短暂 15 秒退避以防请求风暴。
- bootstrap 从已保存的公开快照生成，随版本携带；首次失败不宣称它是最新目录。目录中的模型数量不写成产品保证：本次网页显示 22，实际接口快照是 20。

### F04：能力、模型限额与价格

具体字段见 API-MAPPING。区分“配置模型”与“运行时模型”：除顶层 `reasoning/tool_call/modalities`，还要提供运行时 `capabilities`，并验证 OpenCode 2.x 转换结果。

- context 优先 `context_length`，fallback `max_input_tokens`；output 优先 `max_completion_tokens`，fallback `max_tokens`。input 可单独提供。
- 缺失模型限额采用未知值 0，不套用官方直连模型的百万上下文；适配器可能有自己的 fallback，必须在测试报告说明。
- `capabilities.efforts` 只包含上游列出的档位；只有确认宿主会序列化为 `reasoning_effort` 后才声明 variants。不能给所有模型硬套同一档位。
- pricing 必须确认单位后才映射。当前快照 prompt / completion 均为字符串 "0"，已知零值可设 cost 为 0；遇到非零且无法确认单位时保留未知，不能猜成每百万或每 token。
- 模型价格为 0 不代表每日美元额度无限；额度计费以 `/limits` 为准。

### F05：真实额度与隔离

- `auth.usage(getAuth, provider, {signal} = {})` 读取选中 Key；无认证返回 `{}`。
- 额度读取使用 15 秒超时并遵循宿主取消信号；缓存 TTL 30 秒，按完整 Key 的不可逆摘要隔离，不将明文 Key 作为日志或持久化缓存内容。
- 显式读取失败返回 `{error,signIn:"kept",windows:[]}`；确定凭据失效时改用expired。不把旧缓存或默认 $5 包装成当前读数。只在 TTL 内复用之前成功读取；手动强制刷新若宿主无传参能力不得虚构此接口。
- 美元额度耗用量取 `used_usd + held_usd`，left 优先使用上游 `left_usd`；percentage 使用有效占用，防止正在处理的请求被误判为仍可使用的额度。
- `used` 明确赋值（包括 0）；只给 `amount=0,limit=5` 可能被宿主视作未知。
- 主窗口返回 `amount`、`limit`、`used`、`unit:"USD"`、`display` 和合法时的 `resetsAt`。
- 额度为 0 且已明确给出时表示不可用，percentage=100；未知额度没有百分比且显示未知，不以 0 代替缺失字段。
- 不对多个 Key 汇总为独立赠送额度；账号可能共享限制，宿主按账号显示。

### F06：错误和恢复

| 情况 | 插件行为 | 认证状态 |
| --- | --- | --- |
| 401 invalid_api_key / revoked / expired | 提示重新输入 Key | `expired` |
| 401 conflicting_credentials | 提示认证头冲突，检查实现 | 不直接判 Key 失效 |
| 401 api_keys_disabled | 服务开关错误 | 不直接判 Key 失效 |
| 403 insufficient_scope | 提示 Key 权限不足 | 保留 |
| 403 account_blocked / account_withdrawn | 提示账号状态 | 保留，不假装重新登录可修复 |
| 429 insufficient_quota | 展示每日耗尽与服务端重置提示 | 保留 |
| 429 rate_limit_exceeded / concurrency | 尊重上游 Retry-After，交宿主处理 | 保留 |
| 503 model_api_disabled / draining / quota_unavailable | 展示服务暂不可用 | 保留 |
| 网络 / 超时 / 取消 | 不删除凭据，不自动重放推理 | 保留 |
| 未知 401 | 提示鉴权失败和状态码，要求核实；不泛化全部 401 为 Key 过期 | 保留 |

被动额度错误可经 usage 返回；非凭据错误显式返回signIn:"kept"，避免宿主按错误文案推断登录失效。实际推理错误和 SSE 由 SDK / 宿主处理，插件不为“美化错误”重写响应体。不得为执行上游错误中的 `limit_increase.ask` 进行自动 POST。

## 7. 非功能要求

- 导入、加载、单测、结构检查均不需要网络或真实 Key。
- 公共目录和额度读取每次最长 15 秒；推理请求沿用宿主超时，不设 15 秒总时长截断长推理。
- 插件业务代码默认无生产依赖；原生 fetch / AbortController / crypto 满足读取接口和摘要需求。
- 首版以 Bun 运行单元测试；Node LTS 执行导入烟雾测试，具体版本在实施时记录，不能未测就宣称全部版本兼容。
- 无后台轮询器、自动签到、额外计费探测或无人触发的推理调用。
- 在 README 说明 Coarena 的请求存储行为：官方 OpenAPI 表示即使客户端指定 store=false，也会保存提示词与响应。不要承诺零留存。
- 日志不含 Key / 认证头 / 私有响应全文。公开快照可入 Git，私有 fixtures 一律合成。
- 包体仅含运行文件、README 和许可证；调研 OpenAPI、文档快照和测试不随 npm runtime 包发布。

## 8. 仓库结构要求

```text
opencode-coarena-auth/
  AGENTS.md / README.md / PRD.md
  package.json                  # 实施阶段新增
  LICENSE                       # 实施阶段确定新代码许可证，参考源码保留 MIT
  index.mjs                     # 插件实现；内部依赖注入
  opencode.mjs                  # 只导出 CoarenaPlugin
  opencode2.mjs                 # 官方同构适配器
  models.bootstrap.json         # 公开目录的归一化 fallback
  tests/                        # hooks / models / usage / errors / compat
  scripts/check.mjs             # 独立结构检查；不引用 monorepo 路径
  docs/API-MAPPING.md
  docs/PLUGIN-CONTRACT.md
  docs/IMPLEMENTATION-PLAN.md
  docs/SOURCES.md
  docs/reference/                # 调研快照与示例，仅供开发
```

该树区分“已有交接资料”与“未来实现文件”。本次不创建可误认为已完成插件的空入口或空测试。

## 9. 验收矩阵

| ID | 场景 | 通过标准 | 验证方式 |
| --- | --- | --- | --- |
| A01 | 三种宿主入口 | Magpie / v1 的 main 只有插件函数，v2 默认对象有效，归一化后 provider 均为 coarena | 离线结构测试 + 实机加载 |
| A02 | 配置保留 | 不覆盖已有 coarena 配置；无网络时可加载 | 单测 |
| A03 | 未登录 | loader 与 usage 返回 {}，模型公开目录可读取 | 注入 fetch 单测 |
| A04 | Key 登录 | Key 仅存宿主，额度请求恰有一种鉴权头 | 单测 + 沙箱实机 |
| A05 | 目录更新 | 新模型出现；有效空列表清空；别名不重复；v2 setup无Key也读取，重新加载后凭据不变仍刷新 | fixture单测 + setup桥接测试 |
| A06 | 目录故障 | HTML / 429 / 5xx / timeout不替换last-good，Magpie识别fellBack/listError，公共401不标账号过期 | 单测 |
| A07 | 能力映射 | vision/tools=false 不启用；limits 正确；effort 不越界；双结构兼容 | 单测 |
| A08 | 普通推理 | 至少两个不同厂商模型返回文本，使用同一 Chat 基址 | 用户提供 Key 后显式实机验收 |
| A09 | SSE | 首个内容 chunk 在流关闭前可读，usage 不吞内容 | 合成分块 HTTP 测试 + 实机 |
| A10 | 工具回合 | 工具调用参数、tool_call_id、多轮结果保持完整 | 合成服务 + 实机工具调用 |
| A11 | 图片 | 支持模型能接收一张图片；不支持模型不宣称支持 | 单测 + 可选实机 |
| A12 | 取消与请求语义 | abort后下游取消且无重放；v2 fetch(Request,init)保留有效body、signal、init覆盖和代理等扩展选项 | 合成流 + 桥接测试 |
| A13 | 美元额度 | used=1.2, held=0.3, limit=5, left=3.5 → used%=30，显示剩余3.5 | 合成 fixture |
| A14 | 零与缺失 | 0 消耗是 0%，零上限是 100%，缺字段不虚构额度 | 单测 |
| A15 | 每日请求 | requests_per_day=null 不显示有限进度；有限值显示准确 | 单测 |
| A16 | 重置与截止 | epoch ms 转 RFC3339；无效时间省略；不按机器时区推测 | 单测 |
| A17 | 状态分类 | 403 scope / 429 / 503 不标 expired；明确无效 Key 标 expired | 单测 |
| A18 | 账号切换 | A/B Key 的请求、缓存、usage互不串用 | 并行单测 + Magpie 沙箱 |
| A19 | 无副作用 | 无自动推理、额度申请、反馈、Key 修改 | 请求调用清单断言 |
| A20 | 打包 | npm pack --dry-run 列表含所有 runtime 文件，无原始快照、Key或本地配置 | 打包检查 |
| A21 | 可交接性 | README命令可运行，验证报告明确宿主版本、测试范围、未验证项 | 人工审阅 |

## 10. 里程碑与完成定义

1. **M1 框架与兼容入口**：独立 package、provider 注册、离线结构校验、v2 适配器导入通过。
2. **M2 认证与目录**：多账号 loader、公开模型解析、fallback / TTL / 能力测试通过。
3. **M3 额度与错误**：limits 转换、时间与数值边界、错误分类、账号隔离通过。
4. **M4 推理链路验收**：合成 SSE、工具、取消检查通过；有 Key 和宿主时完成实机验证。
5. **M5 交付**：README、许可证、包清单、变更记录、验证报告完整。

首版代码完成要求 A01–A21 对应的离线项全部通过。缺少 Key 或宿主时可完成代码交付，但真实推理与宿主体验必须标注“未验证”，发布候选不宣称已端到端验证。npm 发布、远程建仓和市场上架是后续动作。

## 11. 风险与待验证项

- 本次只直接验证了公开模型接口，未读取真实 Key / limits / usage；受保护响应结构来自官方 OpenAPI 的 description，而非完整 JSON Schema。实施时用合成数据，实机复核实际类型。
- 不同宿主版本 hook 支持程度不同；v2 适配器并不提供 Magpie usage UI。
- 当前目录页面与 API 数量有差异，动态 API 优先；定时缓存不可永久隐藏下线变化。
- reasoning_text 与 SDK 的 reasoning 展示不完全等价；必须验证真实字段链路。
- 非零 pricing 单位、aliases/退休状态的未来变化、宿主是否应用账号代理，均需针对安装版本验证。
- 拟定 npm 包名尚未检查可用性；独立仓库未设置远程，社区发布流水线不自动继承。

## 12. 交接入口

依次阅读 PLUGIN-CONTRACT、API-MAPPING、IMPLEMENTATION-PLAN、SOURCES。所有关键参考代码与公开 JSON 已保存在 docs/reference。若后续 AI 需要更改上述确定决策，应在 PRD 记录理由、受影响验收项和新增证据。
