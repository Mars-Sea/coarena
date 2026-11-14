# 实施验证报告

验证日期：2026-11-14。插件：**Coarena**，本次工作树版本：`coarena@0.1.1`；npm 可信发布结果单独记录于分发记录。

**结论：P0 的 M1–M5 实现与对应离线项已完成；真实 Coarena 账号和 Magpie / OpenCode 宿主端到端验收未验证。** GitHub / npm / Magpie 分发进度单独记录于 [DISTRIBUTION.md](DISTRIBUTION.md)。没有读取真实 Coarena Key，也没有发送真实推理、额度申请或反馈请求。

## 环境

| 项目 | 本次版本 / 状态 |
| --- | --- |
| OS | macOS 27.2.1，arm64 |
| Bun | 1.4.4 (`38afee6c8`) |
| Node | v24.22.3 |
| npm | 12.2.2 |
| 声明的 Node 最低版本 | 22；本地 Node 24.22.3，GitHub CI 已通过 Node 22 / 24 |
| 测试 SDK | `@ai-sdk/openai-compatible@2.0.41`，仅开发依赖 |
| SDK 子依赖 | `@ai-sdk/provider@3.0.8`、`@ai-sdk/provider-utils@4.0.23`；精确树见 package-lock.json |
| Magpie CLI / App | CLI 不在 PATH；未启动 App，版本未知 |
| OpenCode 1.x / 2.x | CLI 不在 PATH，版本未知 |
| 真实 Coarena Key | 未提供、未使用 |

## 命令与结果

以下均从独立仓库执行，不依赖原 monorepo：

| 命令 / 检查 | 结果 | 实际覆盖 |
| --- | --- | --- |
| `bun test` | **77 pass，0 fail，6 个测试文件** | 本插件单测、中英文卡片、setup 桥接、真实 SDK 到本地合成 HTTP，以及发布事件 / tag / 锁文件边界 |
| `bun run check` | 通过，12 个打包文件 | 双入口、单函数 main、provider / auth / usage 契约、内嵌官网图标、离线 config、相对 import 与生产依赖检查 |
| `npm run check:node` | 通过 | Node 双入口和 config；Request stream、credentials、init 覆盖、URL 重映射、已消费 body 替换、代理选项与取消 |
| `npm pack --dry-run --json` | 通过，12 个文件 | 最终 npm 清单含 SVG 与语言模块；无 docs/reference、测试、node_modules、.env、凭据或宿主配置 |
| `npm run check:package` | 通过，12 个文件 | 持久化的实际打包 / 解包脚本；临时目录无 node_modules，禁用网络仍可加载双入口、模型、图标、中英文切换 |
| 公开 npm tarball 下载验证 | 通过 | 实际 `coarena@0.1.0` 的哈希、源码版本、12 文件、双入口、图标与语言一致，详见 DISTRIBUTION.md |
| GitHub CI Node 22 / 24 | 通过 | 发布源码 `4c9d7eb` 的两个 Linux job 均成功 |
| `node scripts/check-release.mjs` | 通过，手动演练模式 | 稳定版本、仓库元数据、锁文件一致性；无发布动作 |
| actionlint 1.7.12 | 通过 | validate.yml 与 publish.yml 的静态语法 / 表达式检查 |
| `git diff --check` | 通过 | 已跟踪文档无空白错误 |
| 归档 SHA-256 校验 | 15 个文件全部一致 | docs/reference 内容未被修改 |
| `npm audit --omit=dev --json` | 0 个生产依赖审计项 | 包无生产依赖 |
| `npm audit --json` | 2 个 low | 开发 SDK 及其 provider-utils 的同一传递问题，见下文 |

默认测试由 `bunfig.toml` 限定到 `tests/`，不会运行参考 River 插件测试。网络守卫只允许本地合成服务的 `http://127.0.0.1`；其他网络请求拒绝。单元测试使用注入的 fetch / clock，受保护接口数据为合成 fixture，不读取环境 Key、宿主 auth 文件或其他项目。

为匹配完整参考桥接，本次精确锁定 SDK `2.0.41`。其 `provider-utils@4.0.23` 命中低等级资源消耗公告 [GHSA-866g-f22w-33x8](https://github.com/advisories/GHSA-866g-f22w-33x8)，npm 同时将 SDK 列为传递影响项，共 2 个 low。没有为消除此结果而改变参考 SDK 版本；该开发依赖不进入插件 tarball，实际宿主自行安装的 SDK 及其依赖版本仍须在实机环境确认。

## 验收矩阵

“离线通过”只表示本列证据，不表示真实服务或宿主通过。

| PRD 项 | 离线证据 | 真实服务 / 宿主状态 |
| --- | --- | --- |
| A01 入口 | Bun / Node main 仅导出 CoarenaPlugin；v2 默认对象、setup 与注册转换通过 | 三种宿主均未实机加载 |
| A02 配置保留 | config 不联网，保留已有 coarena 对象 | 离线通过 |
| A03 未登录 | loader / usage 返回 `{}`；无 Key 的 v2 setup 仍发现公共模型 | 公共 GET 已复核，宿主未验证 |
| A04 Key 登录 | loader 取选中账号；limits 恰有一种 Bearer 鉴权 | 真实登录 / Key scopes 未验证 |
| A05 目录更新 | TTL 边界、有效空表、别名去重、未登录 setup、凭据不变重新加载均通过 | 宿主刷新行为未验证 |
| A06 故障回退 | HTTP / HTML / 非法结构 / 超时保留 last-good；回退副本带 fellBack，成功为空不带；公共 401 不标凭据过期 | Magpie 实际 listError 展示未验证 |
| A07 能力 | canonical 到 config / runtime / v2 三种形状；false、缺失、未知限额、零价格、退休状态均通过 | 真实宿主合并与努力程度变体未验证 |
| A08 普通推理 | 真实 SDK 连接本地合成 Chat 服务，普通文本 / reasoning_content 解析通过 | 至少两家厂商模型未验证 |
| A09 SSE | 服务端保留连接，首块已可读；随后分块 / DONE / usage 不吞文本 | 真实 Coarena SSE 未验证 |
| A10 工具 | 实际 SDK 处理参数分片、call ID、第二轮 assistant / tool 消息 | 真实模型工具回合未验证 |
| A11 图片 | capability 映射与 SDK 将合成字节序列化为 image_url 通过 | 图片识别未验证；合成字节不证明可解码图片 |
| A12 取消 / 请求 | 合成 SSE 下游观察连接关闭、单请求无重放；Bun / Node Request body、覆盖、signal、代理透传通过 | 真实宿主代理 / 取消未验证 |
| A13 美元额度 | fixture 的 used1.2 + held0.3 = amount1.5、used30%、left3.5 | 真实 limits 未验证 |
| A14 零 / 缺失 | 显式零、零上限、未知金额 / held、微美元、超额 amount 通过 | 受保护字段语义待实测 |
| A15 每日请求 | 有限 / null / 零 / 缺失测试通过；RPM / 并发是 aside | 真实请求次数未验证 |
| A16 时间 | epoch ms / ISO 转 UTC；空值 / 非法日期不推定为零 | 真实 resets_at 类型未验证 |
| A17 错误 | 明确无效 / 撤销 / 过期 401 才 expired；403 / 429 / 503 保留凭据；安全信息和脱敏通过 | 真实错误码 / 响应结构未验证 |
| A18 账号 | 两 Key 并发、缓存隔离、同 Key 合并与独立取消；相同 connection ID 下 Key 变化不发布旧模型 | 宿主两账号切换未验证 |
| A19 无副作用 | 辅助请求仅 models / limits；无登录时不取额度；无自动推理 / 提额 / 反馈 / Key 写入 | 真实服务未执行这些动作 |
| A20 打包 | 12 文件清单与无 node_modules 的解包导入通过 | 实际分发状态见 DISTRIBUTION.md；不将打包成功当作发布成功 |
| A21 可交接 | README、LICENSE、CHANGELOG、来源差异与本报告已交付 | 本地宿主安装示例基于官方文档，尚未实机执行 |

## 兼容桥接的来源与修改

源自 `magpie-community/plugins` 提交 `67532718612ec086606e0830b7a848b892aef672`，归档于 `docs/reference/plugins/river/opencode2.mjs`，与该提交 canonical `scripts/opencode2.mjs` 相同。根适配器保留完整基线和 MIT 版权，未读取或修改旁边的 plugins 仓库。

本次修改的目的与验证：

1. 公共目录不受登录限制；setup 等待首次发现，重建插件时凭据不变也发现目录。
2. 有效 `{}` 清空旧模型；抛错 / null / fellBack 保留上次目录或 bootstrap。
3. 以完整凭据指纹校验异步结果，SDK loader 持有本次选定账号快照；卸载中止辅助读取并禁止晚到结果发布。
4. 保持 Request 流，先应用标准 init 覆盖再改 URL；已消费原 body 可被替换体覆盖。URL 重映射后不把同一替代流重复交给 fetch，兼容 Bun 与 Node；init 代理 / dispatcher 等扩展选项继续传递。等待 loader 后检查取消状态。

未知 token 限额在业务层用 0 表示；v2 参考桥接的 context128000 / output8192 是客户端默认，不作官方能力承诺。非零价格单位未知时不推算；runtime cache read/write 的 0 来自宿主默认。`efforts` 仅作元数据，`variants:{}`。实际 SDK 测试可证明 `providerOptions.coarena.reasoningEffort` 序列化为 `reasoning_effort`，尚不能证明宿主变体映射，所以没有启用强度选项。

Bun 1.4.4 构造 Request 时将 `credentials:"omit"` 读回为 `include`，Node 24.22.3 则保留 `omit`。测试分别验证 Bun 下原属性不被转发改变，以及 Node 下完整标准语义，未把此结果当作真实宿主网络配置验收。

独立只读审查发现的 3 个边界问题均已修正并覆盖回归：零上限不可从 left0 推断未知 amount；URL 重映射时 init.body 须先覆盖原 body；错误 JSON 为 null 仍保留 HTTP / request ID / Retry-After。当时 63 项测试在修正后通过；图标与语言支持后为 68 项，新增发布边界后为 77 项通过。

## 插件名称

用户指定名称为 **Coarena**。`package.json` 的 `magpie.name`、提供商显示名和 README 标题统一使用 Coarena；npm 包名、锁文件和 v2 插件 ID 使用小写 `coarena`。结构检查核对包元数据与显示名；既有桥接测试核对新的 v2 ID。2026-11-14 查询官方 npm registry，`coarena` 返回 E404；这不是名称预留，最终发布结果见分发记录。

## 图标与卡片语言补充验证

- `assets/coarena.svg` 与官网公开 SVG 下载内容逐字节一致；`package.json` 的 `magpie.icon`（插件列表 / 详情）及 `auth.icon`（提供商）编码内容与本地资源一致，在禁用网络的结构检查中加载，并核对 `ownIcon` 的长度上限。
- 卡片默认简体中文；`english_usage` 开关通过 `input.magpie.option("coarena", "english_usage")` 读取，登录标签与开关标签使用宿主原生多语言字段。未将未提供 locale 的额度接口描述为自动跟随语言。
- 新增 5 项测试覆盖中文完整卡片、英文与中文的额度数值一致性、未知与零值、切换语言时复用缓存与返回值隔离、同一在途成功 / 错误读取向两种语言分别渲染、宿主开关动态读取与旧宿主默认中文。
- HTTP 错误码、安全服务消息及请求 ID 保留；插件建议与网络 / 取消 / 超时提示随卡片语言显示。缓存仍按 Key 隔离，30 秒 TTL 不变。
- 2026-11-14 用户截图中，插件详情头部显示默认拼图，其他页面显示官网图标。对照当日 Magpie `market.go` 的 `InstalledIcon` / `ownIcon` 和 `plugins.js` 的 `installedRow` / `detail`，定位为此前缺少 `package.json.magpie.icon`；详情页不读取 `auth.icon`。已补齐同一 SVG data URI，离线结构和独立打包检查覆盖该字段；尚未取得修复后的宿主截图。
- 更新后独立打包 12 文件，解包环境无 node_modules 且禁止网络，验证双入口、官网 SVG、默认中文及英文开关。实际 Magpie 图标、明暗主题、开关和卡片 UI 渲染仍未实机验收。

## 公开资料复核与仍待验收项

2026-11-14 仅执行公开读取：`GET https://coarena.ai/api/v1/models` 为 HTTP 200，20 模型，`has_more:false`；`GET https://coarena.ai/api/openapi.json` 为 HTTP 200，版本 `2026-11-02`。bootstrap 从归档公开响应生成，标注来源与版权，不授予 Coarena 数据 MIT 许可。

复核 OpenCode [v2](https://opencode.ai/docs/plugins/) / [v1](https://opencode.ai/v1/docs/plugins/) 官方安装文档，确认复数 `plugins` / 单数 `plugin` 及本地目录 / JS 文件差异。README 按版本更新。没有用文档阅读替代实际加载。

后续在独立宿主配置中，按 [IMPLEMENTATION-PLAN.md](IMPLEMENTATION-PLAN.md) 执行真实登录、无 Key 目录发现、两个不同厂商模型、SSE、工具、可用图片、取消和两账号额度比对。还需确认真实 limits 的缺省字段与 reset 类型、SDK 的 reasoning 返回编码、主机代理与宿主 SDK 安装版本。本次没有开启受保护接口或真实推理的测试入口，默认测试始终离线。
