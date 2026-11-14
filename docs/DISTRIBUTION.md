# Coarena 分发记录

日期：2026-11-14。用户已明确要求创建 GitHub 仓库、发布 npm 包，随后向 Magpie 提交插件。本次授权覆盖相应提交、推送、发布和提交收录；不包含真实推理、额度申请或反馈。

## 状态

| 项目 | 地址 / 名称 | 状态 |
| --- | --- | --- |
| GitHub | https://github.com/Mars-Sea/coarena | 已创建公开仓库，待首次代码推送 |
| npm | `coarena@0.1.0` | 官方 registry 查询 E404；本机 whoami 返回 E401，等待用户完成官方网页登录，尚未发布 |
| Magpie | 插件名 Coarena，provider ID `coarena` | 核对官方收录方式中；按用户顺序在 npm 发布后提交 |

## 发布前验证

- `npm run prepublishOnly` 已通过：68 项离线测试、Node Request 检查、12 文件实际打包 / 解包检查。
- `npm run check:package` 验证 tarball 无生产依赖、无 node_modules、无凭据与参考文档；在禁用网络的临时目录验证双入口、同一官网图标、中文默认及英文开关。
- 15 个归档来源的 SHA-256 保持一致。测试中的受保护响应与 Key 均为合成数据。
- GitHub CI 为 Node 22 / 24 加 Bun 1.4.4，检查仅使用本地合成接口；CI 结果需等待推送后实际运行。
- 已设置公开 npm registry、public access、仓库 / 问题反馈链接和发布前自动检查。首次发布需 npm 登录，可能还需账号要求的浏览器认证。

## 执行步骤

1. 提交独立实现及上述发布配置，推送新建的 GitHub 仓库，确认 CI。
2. 用户在官方 npm 网页完成登录后，使用官方 registry 发布 `coarena@0.1.0`；发布后核对 registry 的版本、入口与 tarball。
3. 按最新 Magpie 文档完成外部插件发现 / 收录流程，分别记录“已提交”“可发现”“已接受”，不将任意一步当作全部完成。

登录令牌和真实 Coarena Key 不写入命令参数、仓库或本文。真实 Magpie / OpenCode 宿主及 Coarena 端到端结果仍以 [VALIDATION.md](VALIDATION.md) 的边界为准。
