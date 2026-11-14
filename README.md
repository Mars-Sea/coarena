# Coarena Provider 插件

为 **Magpie、OpenCode 1.x 和 OpenCode 2.x** 接入 Coarena Model API 的独立项目。

当前阶段：**需求与开发交接已准备，尚未实现插件**。本仓库包含完整中文 PRD、接口映射、兼容性约束、实施顺序、验收清单，以及可离线阅读的官方接口与现有插件快照。其他 AI 不需要访问原插件仓库即可开始开发。

- [PRD.md](PRD.md)：产品目标、首版范围、行为规范、异常处理与验收标准。
- [docs/PLUGIN-CONTRACT.md](docs/PLUGIN-CONTRACT.md)：Magpie / OpenCode hooks、双入口与模型结构。
- [docs/API-MAPPING.md](docs/API-MAPPING.md)：Coarena API 与插件字段映射、额度计算、错误分类。
- [docs/IMPLEMENTATION-PLAN.md](docs/IMPLEMENTATION-PLAN.md)：任务拆分、测试清单、打包与本地验收步骤。
- [docs/SOURCES.md](docs/SOURCES.md)：资料来源、版本、已验证与待验证边界。
- [docs/HANDOFF-VALIDATION.md](docs/HANDOFF-VALIDATION.md)：本次需求交接的检查结果与验证边界。
- [AGENTS.md](AGENTS.md)：交给开发 AI 的工作约束。
- [docs/reference/](docs/reference/)：官方公开接口快照、River 参考实现和 OpenCode 2.x 适配器。

## 交给其他 AI 的启动指令

将以下内容直接交给开发 AI：

```text
在当前仓库实现 Coarena Provider 插件。先完整阅读 AGENTS.md、PRD.md、
docs/PLUGIN-CONTRACT.md、docs/API-MAPPING.md、docs/IMPLEMENTATION-PLAN.md
及 docs/SOURCES.md，再按里程碑实施 P0。

以 docs/reference/plugins/river 的实际插件结构为兼容性参考；公共模型接口
的响应样本在 docs/reference/coarena/models.json；OpenAPI 在同目录 openapi.json。

目标是 API Key 登录、Chat Completions 普通与流式调用、动态模型目录、
工具与图像能力映射、Magpie 每日额度显示，以及 Magpie / OpenCode 1.x / 2.x 入口兼容。
不实现 P1，不发布 npm，不提交远程变更，不读取用户已有凭据。

所有默认测试都必须离线。受保护 API 用合成 fixture 验证。
没有 COARENA_API_KEY 或没有宿主 CLI 时，将实机验收写为未验证并给出复现步骤，
不能把 mock 测试通过表述为真实模型调用通过。

依照验收矩阵交付代码、测试、README 和验证报告；如果最新资料与快照冲突，
以最新官方 API 与实际宿主行为为准，在文档记录差异与证据。
```

## 首版决策

Provider ID 为 `coarena`；显示名为 `Coarena`；拟用包名为 `opencode-coarena-auth`（尚未验证 npm 名称是否可用）。默认使用 `@ai-sdk/openai-compatible`，基址 `https://coarena.ai/api/v1`。Coarena 文档说明所有模型均支持 OpenAI 与 Anthropic 兼容接口，因此首版无需按模型厂商切换协议。

本项目位于 `/Users/mars-sea/Development/opencode-coarena-auth`，独立于原参考仓库 `/Users/mars-sea/Development/plugins`，初始分支为 `main`。此处尚未设置 Git 远程地址，也尚无 npm 包或插件安装产物。
