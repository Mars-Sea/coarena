# Coarena 分发记录

日期：2026-11-14。用户已明确要求创建 GitHub 仓库、发布 npm 包，随后向 Magpie 提交插件。本次授权覆盖相应提交、推送、发布和提交收录；不包含真实推理、额度申请或反馈。

## 状态

| 项目 | 地址 / 名称 | 状态 |
| --- | --- | --- |
| GitHub | https://github.com/Mars-Sea/coarena | 已创建公开仓库并推送 `main`；实现提交 `f6ec210` |
| GitHub Release | [Coarena 0.1.2](https://github.com/Mars-Sea/coarena/releases/tag/v0.1.2) | 已发布，tag 与 npm `gitHead` 均为 `7ba1588` |
| npm | [`coarena@0.1.2`](https://www.npmjs.com/package/coarena) | 已通过 GitHub OIDC 发布，`latest` 为 `0.1.2`；公开 tarball 与 provenance 核对通过 |
| Trusted CI | [Publish npm 成功运行](https://github.com/Mars-Sea/coarena/actions/runs/43824829269) | validate / publish / 公开包校验均成功；未配置 npm token secret |
| Magpie | [收录 PR #1122](https://github.com/magpie-community/plugins/pull/1122) | 已提交，维护者因第三方中转服务收录政策关闭；未合并，未获 registry 收录 |

## 0.1.0 首次发布前验证

- `npm run prepublishOnly` 已通过：68 项离线测试、Node Request 检查、12 文件实际打包 / 解包检查。
- `npm run check:package` 验证 tarball 无生产依赖、无 node_modules、无凭据与参考文档；在禁用网络的临时目录验证双入口、同一官网图标、中文默认及英文开关。
- 15 个归档来源的 SHA-256 保持一致。测试中的受保护响应与 Key 均为合成数据。
- [GitHub CI](https://github.com/Mars-Sea/coarena/actions/runs/43553589358) 已实际通过：Node 22 / 24 两个 job 均成功，Bun 1.4.4；仅使用本地合成接口。
- 已设置公开 npm registry、public access、仓库 / 问题反馈链接和发布前自动检查。用户交互登录确认账号为 `mars-sea`；发布使用 npm 官方浏览器二次认证完成。

## Magpie 提交材料

- 官方当前 [README / The market](https://github.com/magpie-community/plugins#the-market) 要求修改 `registry.json` 并提 PR。已基于提交 `9bca17b5d22507d0a901e45002936367a0875b85`，在临时隔离 checkout 中追加一个独立 provider 条目，未改动相邻 plugins 仓库。
- 条目仅使用 `package`、`name`、`icon`、`providers` 与中英文 `summary`；省略 `kind`、`community`、`replaces`。已通过该提交的 `scripts/registry.mjs` 官方校验，且核对所有既有条目不变。
- 分支：[Mars-Sea/plugins:add-coarena](https://github.com/Mars-Sea/plugins/tree/add-coarena)，提交 `aec89a2`。npm 验证后创建 [PR #1122](https://github.com/magpie-community/plugins/pull/1122)，正文保存在 [MAGPIE-SUBMISSION.md](MAGPIE-SUBMISSION.md)。官方 `on-npm` 检查成功，维护者随后因收录政策关闭 PR；关闭时 `test` 尚在运行，没有合并。
- 独立仓库已设置 `magpie-plugin` topic，作为插件类型元数据；市场实际显示未验证，不将 topic 设置成功当作人工收录。未申请 `community` 徽章。

## Magpie 维护者反馈

2026-11-14，维护者 yetone 在 [PR 评论](https://github.com/magpie-community/plugins/pull/1122#issuecomment-6871683565) 中说明：Coarena Model API 通过一个 Key 提供其他实验室的模型，因此属于第三方中转提供商，registry 当前不直接收录；“感谢关注，日后会出相关合作方案，敬请期待。”PR 随即关闭，未合并。

维护者同时明确：包仍可通过 `magpie plugin add coarena` 按名称安装，暂停的是 registry listing。本次不重新打开或改换分类提交；后续收录需等待官方合作 / 政策变化。真实 CLI 安装与推理仍未实机验收。

## 0.1.0 首次发布与公开安装包验证

- npm 先提示首次发布处理中，公开 registry 暂时显示 `0.0.0-stage`；随后确认正式 `0.1.0` 可下载，`dist-tags.latest` 已指向 `0.1.0`，再提交 Magpie PR。
- 版本源码：`4c9d7eb75623d81e47082829ca62c636a237a140`，与 npm `gitHead` 一致；[该提交 CI](https://github.com/Mars-Sea/coarena/actions/runs/43556261083) 的 Node 22 / 24 均通过。
- 从未携带认证的公开 registry GET 元数据，下载 [实际 tarball](https://registry.npmjs.org/coarena/-/coarena-0.1.0.tgz)，校验 SHA-1 和 SHA-512 均与 registry 一致。
- SHA-1：`d0871439b21b6f9d0a8da317085aafd250861f76`。
- Integrity：`sha512-urcSqZjqq8YBMhlqEALyDYmLK1UPmeF7y0uHzNRcd9A9H4dyoezz82IlZI6PNXbXxE1mMXeWwc5zowcF9oY5YA==`。
- 公开包确为 12 个预期文件、没有生产依赖；在独立临时目录中禁用网络，加载双入口、bootstrap、同一图标、中英文卡片均通过。`main` 为 `./opencode.mjs`，`exports["."]` 为 `./opencode2.mjs`。

## npm 可信 CI 发布（已完成）

2026-11-14，用户进一步要求创建 GitHub npm 可信 CI 发布流程。实现位于 `.github/workflows/publish.yml`，具体维护步骤见 [RELEASING.md](RELEASING.md)。

- GitHub `npm` environment 已创建，selected deployment policy 仅允许类型为 tag 的 `v*`。
- 使用 GitHub-hosted runner、Node 24 / npm 12.2.2；validate 无 OIDC，publish job 单独取得 `id-token: write`。未添加 npm token secret。
- 稳定 Release 自动发布，手动运行仅 dry-run；验证不可变事件 SHA、main 历史、tag 与版本一致性、锁文件及版本未发布。验证与发布保持同一 SHA。
- 77 项离线测试、Node / 实际安装包检查与 actionlint 通过。审查修正了同名分支可能覆盖 tag checkout，以及共享 concurrency 挤掉待执行 release 的问题。
- npm 官方浏览器 2FA 后成功保存 GitHub trusted publisher，workflow `publish.yml`、repo `Mars-Sea/coarena`、environment `npm`，权限 `publish, stage publish`。首次认证会话失效后重新完成，未使用长期 token 代替绑定。
- [手动演练](https://github.com/Mars-Sea/coarena/actions/runs/43558399034) 成功，publish job 按预期跳过；[首次实际 CI 发布](https://github.com/Mars-Sea/coarena/actions/runs/43559393942) 的 validate / publish 均成功。
- 实际发布版本 `coarena@0.1.1`，源码 `9bbfc4380d953807b802b03ca2e0fdf815d2eae4`；公开 registry 的 `_npmUser` 为 `GitHub Actions`，`trustedPublisher.id` 为 `github`，绑定 ID `ee9702a4-ef41-418f-9d2d-e8abf5b9cfe0` 与刚保存的配置一致。首次成功发布已激活绑定，不再只是未使用配置。
- `latest` 已指向 `0.1.1`，公开 tarball SHA-1 为 `93007f0bc91e39cde0dc4aeb17f27b2b71d3a05d`，integrity 为 `sha512-NBYoGDg6EJSaR3UHTxkOojkeZpFzgY4PWlO3+2HUgw0id7sbn0QAz5aXw2ngbJmhtlOOvS8yLRZp4Qu/jzlzUA==`。独立下载、解包核对 12 个普通文件，并在无 node_modules / 禁止网络环境复验双入口、图标和中英文卡片。
- 公开 [SLSA v1 provenance](https://registry.npmjs.org/-/npm/v1/attestations/coarena@0.1.1) 的 workflow repository、path、ref 与 gitCommit 均匹配本仓库、`.github/workflows/publish.yml`、`refs/tags/v0.1.1` 和上述 SHA；invocation 指向首次实际 CI 运行。npm 日志确认签署并上传 [Sigstore 透明日志](https://search.sigstore.dev/?logIndex=3870228228)。本次检查读取公开证明并核对身份字段，未另行执行完整 Sigstore 签名验证器。

## 执行结果

1. GitHub 公开仓库、源码推送与 Node 22 / 24 CI 已完成。
2. `coarena@0.1.0` 首次发布、`0.1.1` GitHub OIDC 可信发布及公开包验证均已完成。
3. Magpie registry PR #1122 已提交，维护者因第三方中转服务政策关闭，未获收录；按包名安装仍可用。

登录令牌和真实 Coarena Key 不写入命令参数、仓库或本文。真实 Magpie / OpenCode 宿主及 Coarena 端到端结果仍以 [VALIDATION.md](VALIDATION.md) 的边界为准。

## 0.1.2 免费模型与 credits 更新发布

2026-11-16 用户明确要求发布新版，授权本次提交、推送 main 和创建稳定 Release；不包含修复随后提到的 Factory 上下文压缩错误。

- [Release v0.1.2](https://github.com/Mars-Sea/coarena/releases/tag/v0.1.2) 的不可变源码为 `7ba15884cbf40e5fa9783056a29ab5373bf0af28`，与 npm gitHead 及 provenance 的 gitCommit 一致。
- 本地 83 项离线测试、双入口结构、Node、13 文件打包/解包检查通过；[Node 22 / 24 CI](https://github.com/Mars-Sea/coarena/actions/runs/43824776473) 均成功。
- [Publish npm](https://github.com/Mars-Sea/coarena/actions/runs/43824829269) 的 validate / publish / 公开包核验均成功。npm 提交后曾短暂返回 404，等待注册表传播后确认可下载，未重复发布。
- npm latest 已为 0.1.2，公开 publisher 为 GitHub Actions / github。实际 tarball 的 13 个文件逐字节匹配发布源码；SHA-1 与 SHA-512 均匹配 registry。
- SHA-1：`ace68c7c23720352379892ef571ec934df3986d6`。
- Integrity：`sha512-AGKzZHPTFXioI5WOFSfpUyGC3E/69oqs04XRMKGRO8lRjhAdlagvnDxoYz4MCxSJq/DoxxeAOWIa5H5TuMqPGQ==`。
- 实际下载解包至临时目录，无 node_modules / 禁止网络验证双入口、18 模型、三项 free 标签、合成 Paid 钱包及取消提示。没有调用真实 Coarena 推理或读取实际账号凭据。
- 公开 SLSA provenance 的仓库、workflow、tag、gitCommit、invocationId 与本次运行一致；未另行执行完整 Sigstore 密码学签名验证。真实付费账号余额及 OpenCode 宿主仍待验收，Magpie 免费徽标证据见 VALIDATION.md。
