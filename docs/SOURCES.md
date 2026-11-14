# 来源、版本与验证边界

调研日期：2026-11-14。此仓库独立于原monorepo，所需核心公开资料已归档到docs/reference。来源文件可能随时间变化，实施时应复核最新官方定义。

## 官方Coarena资料

| 来源 | 本地快照 | 用途 |
| --- | --- | --- |
| https://coarena.ai/docs | [docs-extracted.txt](reference/coarena/docs-extracted.txt) | Model API入门、免费额度、接口与SDK配置；网页文本提取，非原HTML |
| https://coarena.ai/for-agents.md | [for-agents.md](reference/coarena/for-agents.md) | 代理调用说明、Chat/Responses/Messages、Codex网页搜索限制 |
| https://coarena.ai/api/openapi.json | [openapi.json](reference/coarena/openapi.json) | OpenAPI 3.1.0，标题CoArena API，版本2026-11-02；鉴权、路由、scopes、错误与字段 |
| https://coarena.ai/api/v1/models | [models.json](reference/coarena/models.json) | 真实公开响应，共20模型；能力、限额、别名与零价格 |
| https://coarena.ai/account/api | 未保存账号页 | 用户创建Key的入口；不依赖浏览器自动化 |
| https://coarena.ai/llms.txt | 未保存 | 官方AI资料索引 |

公开页面与公开GET直接访问成功。`/limits`、`/key`、`/usage` 的200响应在当前OpenAPI中主要写在`responses.default.description`，并非可直接生成强类型客户端的完整JSON Schema。文档中的账号金额例子均为合成数据。

本仓库未使用真实Coarena Key，未验证受保护接口、推理内容、实际SSE、额度重置时间类型或提额流程。以上接口描述只表示官方契约，不表示已做账户实测。

## 社区插件参考

原仓库：https://github.com/magpie-community/plugins

本次参考固定提交：`67532718612ec086606e0830b7a848b892aef672`。

本机检出路径为`/Users/mars-sea/Development/plugins`，当前本地主分支已fast-forward至该提交；新仓库运行不依赖该路径。原仓库的origin fork落后upstream，本次没有推送fork或删除远程分支。

已复制的文件与原路径：

| 本地快照 | 原仓库路径 |
| --- | --- |
| [river/index.mjs](reference/plugins/river/index.mjs) | packages/river/index.mjs |
| [river/opencode.mjs](reference/plugins/river/opencode.mjs) | packages/river/opencode.mjs |
| [river/opencode2.mjs](reference/plugins/river/opencode2.mjs) | packages/river/opencode2.mjs；与scripts/opencode2.mjs canonical adapter相同 |
| [river/package.json](reference/plugins/river/package.json) | packages/river/package.json |
| [river/index.test.mjs](reference/plugins/river/index.test.mjs) | packages/river/index.test.mjs |
| [river/README.md](reference/plugins/river/README.md) | packages/river/README.md |
| [check.mjs](reference/plugins/check.mjs) | scripts/check.mjs，阅读用，依赖monorepo文件不能在本仓库直接运行 |
| [LICENSE](reference/plugins/LICENSE) | LICENSE，MIT，2026 magpie-community contributors |

可复核原始URL格式：`https://raw.githubusercontent.com/magpie-community/plugins/67532718612ec086606e0830b7a848b892aef672/<原仓库路径>`。

River是API Key与简单provider最接近的完整工程样本；不是Coarena实现。其余额响应、错误字段、厂商模型和默认值不能套用Coarena。River README中的相对链接仍按原仓库语境理解，不保证在快照目录可跳转。

另调研了Factory / Open Design的多SDK路由、Cloudflare Workers AI的用量、Gumloop等简单认证方式，以及根README的包规范。它们提供辅助对照，关键首版实现不依赖这些未归档目录。

独立包不要求使用`@magpie-community` scope；原仓库registry、dist分支和组织发布workflow是市场分发机制，不是插件运行契约。

## Magpie宿主契约

原仓库：https://github.com/yetone/magpie

固定版本：`f1f34d624f473a1e3ab45d56c2464f7527fac565`。本次下载的两个文件已与该提交原始内容逐字节比对一致。

| 本地快照 | 原路径 | 用途 |
| --- | --- | --- |
| [provider-plugins.md](reference/magpie/provider-plugins.md) | docs/subsystems/provider-plugins.md | 插件安装、发现、auth、provider、config与多协议说明 |
| [host.js](reference/magpie/host.js) | internal/plugin/host.js | auth.usage调用与归一化，约3226–3328行；运行时模型归一化和provider加载 |
| [LICENSE](reference/magpie/LICENSE) | LICENSE | MIT，2026 yetone |

逐行源码优先于本项目的简化说明。尤其注意：host对usage错误可能推断登录失效；非凭据错误宜明确返回`signIn:"kept"`，避免文案触发误判。host允许超额百分比大于100；本插件首版选择把对外进度clamp在0–100，同时保留原始amount，该选择属于本插件产品决策。

文档 https://usemagpie.ai/docs/plugins 也用于安装方式交叉确认。Magpie / OpenCode CLI本次环境未安装，因此没有实机加载验证。OpenCode 2.x适配器是当前社区插件采用的桥接源码快照，不构成未来所有宿主版本的兼容保证。

## 归档完整性

[reference/SHA256SUMS](reference/SHA256SUMS) 记录每个归档文件的SHA-256，相对于docs/reference目录，不包括自身。它证明此交接版本的内容一致，不证明第三方服务器以后仍返回相同内容。

实施者可用Python hashlib或sha256sum复核。Coarena快照保留官方原内容 / 提取文本，未混入真实Key或私有账号响应。

## 许可与复用

- 社区插件源码保留其MIT许可证和归属。
- Magpie源码与文档保留其MIT许可证和归属。
- Coarena公开资料版权归原权利方；本仓库不另行授予MIT许可，不暗示已获得品牌或分发授权。公开API响应仅用于字段参考。
- 新实现与完整桥接使用根 [LICENSE](../LICENSE) 的 MIT 许可，package.json 与之保持一致；Coarena 元数据明确排除在该授权之外。

## 后续必须明确报告的验证空白

1. 实际Key scopes和真实limits响应；重置时间、缺失字段语义。
2. 所选SDK的reasoning_effort、图片、工具与SSE编码。
3. Magpie / OpenCode具体版本的加载、代理、模型合并与多账号隔离。
4. 非零价格单位、未知capabilities和未来模型分页。
5. npm包名可用性、远程仓库地址、是否上架社区市场。

这些空白不阻止从需求进入离线开发，但在获得证据前不能写成“已验证”。实施后的覆盖结果以 [VALIDATION.md](VALIDATION.md) 为准；SDK 的本地序列化已测不代表真实服务或宿主路径已测。

## 2026-11-14 实施复核与调整

- 重新公开 GET `https://coarena.ai/api/v1/models`，HTTP 200，20 条模型，`has_more:false`；重新 GET OpenAPI，HTTP 200，`info.version:2026-11-02`。未读取受保护接口，既有 `docs/reference` 快照保持不变。
- 读取 [OpenCode v2 Plugins](https://opencode.ai/docs/plugins/)：当前配置键为 `plugins`，接受本地目录，单文件路径会跳过；相对路径基于配置文件。读取 [OpenCode v1 Plugins](https://opencode.ai/v1/docs/plugins/)：npm 配置键为 `plugin`，可从 `.opencode/plugins/` 加载本地 `.js` / `.ts`。影响：交接文件中统一使用单数的示例仅适用于 v1，README 和实施计划已按版本修正；未改变插件 P0 范围。页面未给固定宿主版本，本次无真实 CLI。
- OpenCode 2 桥接继续以归档的完整 MIT 版本为基线：补上无 Key 的公共目录发现、启动等待首次发现、有效空目录替换、回退标记保留、凭据指纹与卸载取消；Request 分支改为流式转发并保留 init / 代理选项，避免 `req.text()` 缓冲。SDK package 标记保留快照版本 `2.0.41`；限额未知时的 128000 / 8192 仅为桥接默认。
- 使用开发依赖 `@ai-sdk/openai-compatible@2.0.41` 与本地合成 HTTP 验证 Chat、SSE、工具、多轮、图片、取消和错误；不解析或改写推理 SSE。宿主变体序列化仍缺证据，所以 `efforts` 仅作元数据，`variants:{}`。
- Bun 1.4.4 的 `new Request(url,{credentials:"omit"})` 返回 `credentials:"include"`，Node 24.22.3 则返回 `omit`。Bun 测试核对转发保持原 Request 的实际属性；Node 检查额外断言 `omit`、stream、init 覆盖与取消。此差异不被宣称为宿主代理兼容证明。

## 2026-11-14 图标与语言补充

- 从官网首页确认图标链接，公开 GET `https://coarena.ai/icon.svg?icon.0lfastlo0uy2w.svg`，原始字节保存为 `assets/coarena.svg`。通过 `auth.icon` 以内嵌 data URI 提交，保持导入与显示无需联网；官网标识仍归原权利方，不纳入插件 MIT 授权。
- 重新读取 `https://raw.githubusercontent.com/yetone/magpie/master/internal/plugin/host.js`，与归档固定版本逐字节一致，SHA-256 为 `1d5ad0d2ff9c23739e79239d915e6f5921134cae170a451b8c8a820d6ec31589`。`iconOf` 接受 `auth.icon` 的图片 data URI；`methods` 支持 `labels`，`optionsOf` 支持开关的多语言标签；`usageOf` 仅传 `{signal}`，只复制卡片字符串，未传界面语言、未读取卡片多语言映射。
- 影响与调整：新增 `english_usage` 开关（默认关闭），卡片默认简体中文、可切英文；不声称自动跟随宿主语言。成功读取缓存独立于展示语言，切换时重新渲染，不额外读取接口；错误码及安全服务消息保留原文。此变更补充显示行为，不扩展推理协议或受保护操作范围。真实 Magpie 图标与开关渲染仍未验收。

## 2026-11-14 插件详情图标修正

- 用户截图显示插件详情头部采用默认拼图，但提供商等页面显示图标。公开读取 [Magpie market.go](https://github.com/yetone/magpie/blob/master/internal/plugin/market.go) 与 [plugins.js](https://github.com/yetone/magpie/blob/master/internal/gui/assets/plugins.js)：`InstalledIcon` 从安装目录的 `package.json.magpie.icon` 读取；`ownIcon` 接受 https 或图片 data URI，长度不超过 `3 << 19`；`installedRow` 为详情传入 `e.icon`，`detail` 只从 `l.icon || l.npm?.icon` 取图，不从提供商回退，缺省绘制拼图。
- 影响与调整：先前仅设置 `auth.icon` 无法覆盖插件详情；补上 `magpie.icon` 的相同内嵌 SVG，并以结构检查保证包元数据、认证 hook 与官网资源一致。不修改宿主或其他仓库；不依赖远程图片。源码用于核对行为，未复制进本仓库运行入口。
