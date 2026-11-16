# 变更记录

## 0.1.2 — 2026-11-16

- 按新免费资格提供原生 free 徽标及“只选免费”；更新 18 模型离线目录。
- 区分免费每日额度与 credits 钱包，按账号隔离缓存，增加付费错误提示。

## 0.1.1 — 2026-11-14

- 新增 GitHub Actions npm Trusted Publishing：稳定版 Release 自动发布，手动触发仅验证与 dry-run；无长期 npm Token，发布生成 provenance。
- 发布前核对事件 SHA、main 历史、版本 / tag / 锁文件一致性及 npm 版本不存在；验证与发布使用同一提交，GitHub `npm` 环境限制为 `v*` 标签。
- 增加发布边界回归与公开 tarball / provenance 元数据核验脚本，以及维护者发布文档。既有提供商、模型及额度行为不变。

## 0.1.0 — 2026-11-14

首次实现 Coarena 的 P0：

- 插件名称为 **Coarena**，通过 `magpie.name` 声明；npm 包名及 v2 插件 ID 为 `coarena`。
- 独立 ESM 包，Magpie / OpenCode 1.x 的单函数 main 与 OpenCode 2.x 的默认 setup 入口；无生产依赖。
- 宿主 API Key 登录；公开动态模型目录、双模型结构、保守能力与价格映射、本地 bootstrap、TTL、回退和取消。
- Magpie `auth.usage` 每日 USD / 请求次数、预占金额、按 Key 隔离的缓存，以及明确错误分类与秘密过滤。
- 官网原始 SVG 提供商图标；额度卡片默认简体中文，可通过 Magpie 插件开关切换英文，切换复用额度缓存；登录标签使用宿主多语言字段。
- 补齐 `package.json.magpie.icon`，使插件列表与详情页读取同一官网图标；结构检查核对插件和提供商两个图标来源一致。
- 基于完整 MIT 参考适配器补齐公共目录发现、空列表刷新、凭据切换保护和 Request 流 / init / 代理选项转发。
- 默认离线测试、真实 SDK 到本地合成 HTTP 的 Chat / SSE / 工具 / 图片 / 取消测试、Node 检查与打包检查。
- 记录服务端存储提示词与响应的事实、按宿主版本拆分的本地安装步骤，以及仍待真实 Key / 宿主验收的边界。

- GitHub 仓库元数据、中英文市场简介、Node 22 / 24 CI，以及发布前自动执行的离线测试和独立打包检查。

分发进度见 [DISTRIBUTION.md](docs/DISTRIBUTION.md)；真实服务与宿主验收结果见 [验证报告](docs/VALIDATION.md)。
