# Coarena 分发记录

日期：2026-11-14。用户已明确要求创建 GitHub 仓库、发布 npm 包，随后向 Magpie 提交插件。本次授权覆盖相应提交、推送、发布和提交收录；不包含真实推理、额度申请或反馈。

## 状态

| 项目 | 地址 / 名称 | 状态 |
| --- | --- | --- |
| GitHub | https://github.com/Mars-Sea/coarena | 已创建公开仓库并推送 `main`；实现提交 `f6ec210` |
| GitHub Release | [Coarena 0.1.0](https://github.com/Mars-Sea/coarena/releases/tag/v0.1.0) | 已发布，tag 指向 npm `gitHead` 对应的 `4c9d7eb` |
| npm | [`coarena@0.1.0`](https://www.npmjs.com/package/coarena) | 已公开发布，`latest` 为 `0.1.0`；公开 tarball 下载与核验通过 |
| Magpie | [收录 PR #1122](https://github.com/magpie-community/plugins/pull/1122) | 已提交，维护者因第三方中转服务收录政策关闭；未合并，未获 registry 收录 |

## 发布前验证

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

## npm 发布与公开安装包验证

- npm 先提示首次发布处理中，公开 registry 暂时显示 `0.0.0-stage`；随后确认正式 `0.1.0` 可下载，`dist-tags.latest` 已指向 `0.1.0`，再提交 Magpie PR。
- 版本源码：`4c9d7eb75623d81e47082829ca62c636a237a140`，与 npm `gitHead` 一致；[该提交 CI](https://github.com/Mars-Sea/coarena/actions/runs/43556261083) 的 Node 22 / 24 均通过。
- 从未携带认证的公开 registry GET 元数据，下载 [实际 tarball](https://registry.npmjs.org/coarena/-/coarena-0.1.0.tgz)，校验 SHA-1 和 SHA-512 均与 registry 一致。
- SHA-1：`d0871439b21b6f9d0a8da317085aafd250861f76`。
- Integrity：`sha512-urcSqZjqq8YBMhlqEALyDYmLK1UPmeF7y0uHzNRcd9A9H4dyoezz82IlZI6PNXbXxE1mMXeWwc5zowcF9oY5YA==`。
- 公开包确为 12 个预期文件、没有生产依赖；在独立临时目录中禁用网络，加载双入口、bootstrap、同一图标、中英文卡片均通过。`main` 为 `./opencode.mjs`，`exports["."]` 为 `./opencode2.mjs`。

## 执行结果

1. GitHub 公开仓库、源码推送与 Node 22 / 24 CI 已完成。
2. `coarena@0.1.0` npm 发布与公开包验证已完成。
3. Magpie registry PR #1122 已提交，维护者因第三方中转服务政策关闭，未获收录；按包名安装仍可用。

登录令牌和真实 Coarena Key 不写入命令参数、仓库或本文。真实 Magpie / OpenCode 宿主及 Coarena 端到端结果仍以 [VALIDATION.md](VALIDATION.md) 的边界为准。
