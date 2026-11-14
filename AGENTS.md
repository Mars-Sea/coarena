# 开发 AI 工作约束

本仓库当前为Coarena Provider插件的需求与实施交接仓库。用户后续要求实施时，直接按以下资料开展，不需要原monorepo。

## 开始前

依次完整阅读：README.md、PRD.md、docs/PLUGIN-CONTRACT.md、docs/API-MAPPING.md、docs/IMPLEMENTATION-PLAN.md、docs/SOURCES.md。参考源码在docs/reference，仅用于理解 / 复用，不能当作已实现的本插件运行入口。

## 实施要求

- 所有新实现放在本独立仓库，使用coarena provider id。不要改动旁边的plugins仓库，也不依赖它的绝对路径或组织发布权限。
- 先交付PRD的P0，按M1–M5实施。首版Chat Completions，显式推迟Responses / Anthropic原生协议 / 提额 / 评价 / 历史。
- 使用ESM .mjs与宿主API Key存储；默认无生产依赖。两个入口与两种模型结构必须分别验证。
- auth.usage才是额度hook；used是百分比；amount是已用加预占；不把未知当作0，不把每日额度当永久钱包。
- 公共模型目录不附带Key，导入 / config不联网。Key与额度缓存按账号隔离，不能保留全局当前Key。
- 默认测试完全离线，受保护响应使用合成fixtures。真实Key不写进命令参数、日志、文档、Git或快照，不从用户其他项目挖取凭据。
- 不自动申请额度、反馈、推理探测、发布npm、推送或上架市场。用户未来明确要求对应动作时按新授权执行。
- 默认SDK链路无需自行代理SSE；任何fetch包装必须保留流、取消和宿主代理 / 请求选项。
- 参考源码的MIT归属必须保留。Coarena资料无此处授予的开源许可，不把它重新标为MIT。
- 最新官方资料和真实宿主行为优先于历史快照。发现差异时记录来源、日期、影响和调整，不悄悄修改目标范围。

## 完成前

运行并记录相关离线测试、独立结构检查与npm打包清单。用docs/VALIDATION.md说明版本、结果与未验证项。没有Key或宿主时可完成代码和离线验证，不得声称真实模型 / 宿主端到端验收通过。

不要把仅导入成功、mock流测试、受保护API字段推测，写成真实服务已验证。README保持准确反映项目当前状态。
