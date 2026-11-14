# npm 可信 CI 发布

Coarena 使用 GitHub Actions → npm Trusted Publishing（OIDC）。公开仓库 `Mars-Sea/coarena` 的 `.github/workflows/publish.yml` 负责发布；npm 绑定的 workflow 名为 `publish.yml`，environment 为 `npm`，权限为 direct publish。

已通过 [首次真实 CI 发布](https://github.com/Mars-Sea/coarena/actions/runs/43559393942) 将 `coarena@0.1.1` 发布至 npm，并生成 provenance；[手动演练](https://github.com/Mars-Sea/coarena/actions/runs/43558399034) 也确认 publish job 会跳过。

## 触发方式

- 发布稳定版 GitHub Release，例如 `v0.1.2`，自动触发验证与 npm 发布。
- 在 Actions 手动运行 **Publish npm**，只做验证和 `npm publish --dry-run`，发布 job 跳过。
- Tag 必须严格等于 `v` 加 package.json 中的版本；package-lock.json 两处版本必须一致。仅接受稳定版本，草稿、预发布、已存在的 npm 版本均拒绝发布。
- Release 源码必须属于 `main` 历史。验证从事件记录的不可变 SHA checkout，发布沿用验证输出的同一 SHA，不重新解析可能移动的 tag 或分支。

## GitHub 与 npm 配置

- GitHub-hosted `ubuntu-latest`，Node 24、npm 12.2.2、Bun 1.4.4。
- 发布环境：`npm`；仅允许 `v*` 类型为 tag 的部署。
- 只有 publish job 拥有 `id-token: write`；根权限为 `contents: read`。验证 job 不取得发布身份。
- 不设置 NPM_TOKEN / NODE_AUTH_TOKEN secret。CLI 使用 GitHub OIDC 交换短期凭据，发布时生成 provenance。
- release 任务禁用依赖缓存；验证 job 安装锁定开发依赖，运行 `prepublishOnly`，检查 12 文件实际 tarball。发布 job 使用已经通过验证的同一源码，不安装依赖、不运行构建，并以 `--ignore-scripts` 避免再次执行验证脚本。
- 发布后等待公开 registry 传播，核对版本、gitHead、双入口、图标、文件数、tarball SHA-1 / SHA-512 与 provenance 元数据。

可信绑定命令如下，只在首次配置或绑定过期时由有 npm 包写权限的维护者交互执行；npm 会要求官方浏览器 2FA：

```sh
npm trust github coarena --file publish.yml --repo Mars-Sea/coarena --env npm --allow-publish --yes
npm trust list coarena
```

按 2026-11-14 复核的 [npm 官方文档](https://docs.npmjs.com/trusted-publishers/)，新绑定需在 **2 天内完成首次成功发布**，否则过期；首次成功发布还会绑定仓库的不可变身份。配置保存、OIDC 兑换、公开发布分别验证，不能仅靠 dry-run 声称可信发布已通过。

## 日常发布

```sh
npm version patch --no-git-tag-version --ignore-scripts
# 更新 CHANGELOG，提交完整变更后推送 main
bun test
npm run check:node
npm run check:package
git push origin main
# 下例版本需与 package.json 一致
gh release create v0.1.2 --repo Mars-Sea/coarena --target main --title "Coarena 0.1.2" --generate-notes
```

先检查 workflow 的 validate 和 publish 两个 job，再检查 npm 的 `latest` 与 provenance。无需在本机再次运行 `npm publish`。

手动演练：

```sh
gh workflow run publish.yml --repo Mars-Sea/coarena --ref main
```

本次配置与首次实际 CI 发布结果见 [DISTRIBUTION.md](DISTRIBUTION.md)。真实 Coarena 推理、受保护 limits 与宿主端到端验收仍按 [VALIDATION.md](VALIDATION.md) 记录。
