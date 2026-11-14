# 实施计划与验证手册

当前只交付需求和参考资料；本文件中的运行命令适用于未来代码完成以后。不要在没有 package.json / runtime 入口时声称插件可以安装。

## M1：独立包与加载入口

1. 创建 package.json、LICENSE、index.mjs、opencode.mjs；按 PLUGIN-CONTRACT 保持两个宿主入口。
2. 从reference/plugins/river/opencode2.mjs复制完整兼容基线，再按PLUGIN-CONTRACT修正未登录目录发现、刷新时机与Request转发；记录来源、许可证和补丁理由。
3. 建立 `scripts/check.mjs`，独立验证元数据 / 导出 / provider id / 离线 config。不要直接运行参考 monorepo check。
4. 从公开 models.json 生成带来源日期的 bootstrap；config 仅使用本地数据，不联网。
5. 使用 Bun 和 Node LTS分别验证入口 import；记录精确版本。最初不引入生产依赖。

完成标准：A01、A02 的离线部分通过；宿主 main 不会错误执行辅助导出。

## M2：认证、目录与能力

建议在业务模块提供 `createPlugin({fetchImpl,now})` 或同等依赖注入。模块实例保存目录缓存和按Key摘要隔离的额度缓存；不要把一个固定Key闭包共享给所有账号。

目录用一个 canonical model归一化函数，再转换 config rows / runtime rows。缓存状态明确区分“没有成功结果”“成功空列表”“成功非空列表”“暂时失败”，成功空列表不得回退bootstrap。

有错误时保留最后成功目录；初次失败回bootstrap；成功TTL5分钟、失败退避15秒，同一时间只有一个远端刷新。回退返回副本设置 `Symbol.for("magpie.fellBack")`，成功缓存本体不带标记，成功空列表无标记；HTTP200格式错误可抛异常让宿主保留目录。让使用者取消不会损坏其他共享读取；如合并fetch，单个caller的signal不得直接取消其他caller仍在等待的请求。

TTL不是调度器：启动 / 重载 / 账号变化是v2必须验证的刷新时机；无Key也调用公共目录hook。凭据长期不变时按用户重载更新，不承诺无触发后台刷新。通过setup(ctx)测试调用链，不能只单测业务hook绕过桥接。

核心测试：未登录可读取；请求没有认证头；aliases去重；空列表清空；非法结构不污染；能力 false/缺失；未知数字；模型退休；缓存TTL边界；并发合并；故障恢复。每个测试注入独立clock与fetch，不依赖本地网络。

完成标准：A03–A07、A19对应离线项通过。

## M3：额度与错误

只调用 `/limits` 作为首版读取源；`/key`、`/usage` 的形状并不相同，不作为默认并行依赖。为鉴权读取合并15秒超时与宿主signal，清理timer / listeners，不给推理请求套读取超时。

额度成功缓存30秒，按Key摘要隔离；到期读取失败不得返回“当前额度读取成功”。可将明确错误显示给宿主；若之后清除失效Key缓存也不能影响其他账号。

合成fixtures建议：

| 文件名 | 输入覆盖 | 主要断言 |
| --- | --- | --- |
| limits-default.json | 5 / used1.2 / held0.3 / left3.5 | amount1.5、used30 |
| limits-granted.json | granted、有效期、pending申请 | 当前limit不被申请值覆盖 |
| limits-zero.json | used0、held0、limit5 | used显式0 |
| limits-no-allowance.json | limit0、left0 | used100，无可用额度 |
| limits-missing.json | 缺少金额、null/空串、无效时间 | 未知不变成0或1970年 |
| limits-requests.json | 有限每日次数 vs null | 有限窗口与无限语义区分 |
| errors/*.json | 明确无效Key、403、429、503 | 只有确定失效才expired |

还需断言：server left优先；held不重复扣减；微美元浮点展示；超额amount保留；reset ISO / epoch ms；两Key并行不串缓存；abort/timeout不重试。

完成标准：A13–A19离线项通过。

## M4：推理链路与宿主验证

先用本地合成HTTP服务验证普通 / SSE / 工具 / 取消。服务只能接受合成数据，不访问真实厂商。若使用默认SDK链路，测试要实际走所选SDK或宿主链路，不能只证明mock fetch能返回字符串；开发依赖可按测试需要引入并说明。

SSE测试分两次写入并控制结束时机，断言首个chunk在结束前可见。工具测试包含参数分片、tool_call_id、工具结果后的第二轮；取消测试让服务观察连接结束，并断言无重复推理请求。另测v2 `fetch(Request,init)`，检查body未被无谓文本化、init覆盖语义、取消信号、代理/dispatcher/redirect等选项完整保留；此处参考基线存在已知缺陷，必须修正。

若尚无SDK / 宿主环境，hook测试与合成HTTP测试分别标注覆盖范围，不能把后者称为宿主端到端验证。

### Magpie（有CLI后执行）

下面命令需在实施完成后、合适的测试账号 / 独立宿主配置下运行。登录交互中输入Key；不在命令参数或文档里粘贴秘密。

```sh
magpie plugin add /Users/mars-sea/Development/opencode-coarena-auth
magpie plugin login coarena
magpie provider test coarena
magpie quota coarena --json
```

`provider test` 会触发真实模型调用，纳入真实Key验收范围。运行前用当前 `--help` 核对版本参数。CLI或App编辑后可能需要禁用 / 重新启用插件。

逐项确认：插件列表可见；无Key模型可发现；正确API登录；当天额度与Coarena账号页一致；两个Key切换；一个工具调用；一个流式长回答取消。至少抽测两个不同厂商的模型。不要为了验证边界故意耗尽额度或制造并发风暴。

### OpenCode

已发布npm包后，配置示例：

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["opencode-coarena-auth"]
}
```

随后按安装版本运行 `opencode auth login`，选择Coarena，测试 `coarena/<live-model-id>`。包名仅为拟定示例，在发布前此配置不能从npm安装。

本地包加载方式和1.x/2.x命令可能随版本变化；本次没有验证可通用的本地目录语法。实施者应读取所装OpenCode版本的官方文档，用独立配置目录完成本地加载，再将实际可运行的路径 / 文件入口写回README；不要把Magpie的add命令套用到OpenCode。

OpenCode 2.x至少验证provider注册、API auth和转换后的模型能力；不能因default.setup存在就认定实际宿主可用。Magpie usage卡片不在OpenCode验收范围。

### 真实Key边界

本次交接没有提供Key，也未读用户已有凭据。默认`bun test`永不访问远端或读取真实Key。额外真实测试须显式开启（例如单独integration脚本和环境变量），缺Key时清晰skip。不要从shell历史、其他项目配置、钥匙串或宿主auth文件寻找凭据。

完成标准：A08–A12真实与离线项分别列出；缺环境就保留真实项“未验证”。

## M5：打包、文档与交付

代码完成后执行：

```sh
bun test
bun run check
npm pack --dry-run
```

如果开发实现使用不同脚本名称，在README和此文档同步，不留不可运行命令。`npm pack --dry-run`仅检查包内容，不等于发布成功。

检查清单：

- main / exports / 所有相对import可从tarball文件清单解析。
- npm包不含docs/reference、测试私有数据、.env、缓存、宿主配置。
- README包含安装、创建Key、登录、模型选择、额度语义、宿主差异、故障处理、服务端留存事实。
- 引用MIT源码保留归属；新代码许可证最终一致。不要把Coarena公开内容误当作MIT许可。
- 写入 `docs/VALIDATION.md`：OS、Bun/Node、宿主版本、命令与结果、真实接口覆盖、未测项、适配器来源。
- 不自动发布npm、推送远程、上架市场。代码交付与分发分别记录。

## 可供测试使用的最小hook样例

下列是测试结构示意，函数和导出按最终实现调整：

```js
import { expect, test } from "bun:test"
import { _internal } from "../index.mjs"

test("no auth required for public catalog", async () => {
  const calls = []
  const plugin = _internal.createPlugin({
    now: () => 1000,
    fetchImpl: async (url, init) => {
      calls.push({ url, init })
      return Response.json({ object: "list", data: [] })
    }
  })
  const rows = await plugin.provider.models({}, {})
  expect(rows).toEqual({})
  expect(calls).toHaveLength(1)
  const headers = new Headers(calls[0].init?.headers)
  expect(headers.has("authorization")).toBe(false)
  expect(headers.has("x-api-key")).toBe(false)
})
```

不要直接照抄参考River的真实model id / 账号余额URL / 测试期望；它展示工程结构，不代表Coarena契约。
