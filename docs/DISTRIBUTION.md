# Coarena 分发记录

日期：2026-11-14。用户已明确要求创建 GitHub 仓库、发布 npm 包，随后向 Magpie 提交插件。本次授权覆盖相应提交、推送、发布和提交收录；不包含真实推理、额度申请或反馈。

## 状态

| 项目 | 地址 / 名称 | 状态 |
| --- | --- | --- |
| GitHub | https://github.com/Mars-Sea/coarena | 已创建公开仓库并推送 `main`；实现提交 `f6ec210` |
| npm | `coarena@0.1.0` | 官方 registry 查询 E404；本机 whoami 返回 E401，网页登录退回交互输入，尚未发布 |
| Magpie | 插件名 Coarena，provider ID `coarena` | 已准备并推送 registry 条目分支；等待 npm 发布后创建 PR，GitHub topic 尚未启用 |

## 发布前验证

- `npm run prepublishOnly` 已通过：68 项离线测试、Node Request 检查、12 文件实际打包 / 解包检查。
- `npm run check:package` 验证 tarball 无生产依赖、无 node_modules、无凭据与参考文档；在禁用网络的临时目录验证双入口、同一官网图标、中文默认及英文开关。
- 15 个归档来源的 SHA-256 保持一致。测试中的受保护响应与 Key 均为合成数据。
- [GitHub CI](https://github.com/Mars-Sea/coarena/actions/runs/43553589358) 已实际通过：Node 22 / 24 两个 job 均成功，Bun 1.4.4；仅使用本地合成接口。
- 已设置公开 npm registry、public access、仓库 / 问题反馈链接和发布前自动检查。首次发布需 npm 登录，可能还需账号要求的浏览器认证。

## Magpie 提交材料

- 官方当前 [README / The market](https://github.com/magpie-community/plugins#the-market) 要求修改 `registry.json` 并提 PR。已基于提交 `9bca17b5d22507d0a901e45002936367a0875b85`，在临时隔离 checkout 中追加一个独立 provider 条目，未改动相邻 plugins 仓库。
- 条目仅使用 `package`、`name`、`icon`、`providers` 与中英文 `summary`；省略 `kind`、`community`、`replaces`。已通过该提交的 `scripts/registry.mjs` 官方校验，且核对所有既有条目不变。
- 分支：[Mars-Sea/plugins:add-coarena](https://github.com/Mars-Sea/plugins/tree/add-coarena)，提交 `aec89a2`。提交说明草稿见 [MAGPIE-SUBMISSION.md](MAGPIE-SUBMISSION.md)；npm 未发布，暂未向维护者创建 PR。
- 独立 GitHub 仓库的 `magpie-plugin` topic 可触发非官方自动发现，与人工审核的 registry PR 分别记录；启用 topic 不代表获准社区推荐徽章。按用户顺序等待 npm 首次发布后再启用。

## 执行步骤

1. 源码推送与 CI 已完成。
2. 用户在自己的交互终端执行 `npm login --auth-type=web --registry=https://registry.npmjs.org/` 并完成浏览器登录 / 2FA。当前后台登录尝试已退出，不再等待旧浏览器会话。不要将密码、验证码或 Token 发到聊天中。确认 `npm whoami --registry=https://registry.npmjs.org/` 成功后，发布 `coarena@0.1.0` 并核对 registry 的版本、入口与 tarball。
3. npm 验证后启用 `magpie-plugin` topic，并从已准备的分支向 `magpie-community/plugins:main` 创建 PR。分别记录“已提交”“可发现”“已接受”，不将任意一步当作全部完成。

登录令牌和真实 Coarena Key 不写入命令参数、仓库或本文。真实 Magpie / OpenCode 宿主及 Coarena 端到端结果仍以 [VALIDATION.md](VALIDATION.md) 的边界为准。
