import { readFileSync } from "node:fs"
import { BASE, SDK } from "./http.mjs"
import { createCatalog, normalizeModels, configModels, runtimeModels, toConfigModel, toRuntimeModel } from "./models.mjs"
import { createUsage, keyOf, usageOf, errorOf } from "./usage.mjs"

const bootstrap = JSON.parse(readFileSync(new URL("./models.bootstrap.json", import.meta.url), "utf8")).models
const icon = `data:image/svg+xml;base64,${readFileSync(new URL("./assets/coarena.svg", import.meta.url)).toString("base64")}`

function createPlugin({ fetchImpl = globalThis.fetch, now = Date.now, timeoutMs = 15_000, language = () => "zh" } = {}) {
  return {
    async config(cfg) {
      cfg.provider ??= {}
      cfg.provider.coarena ??= { name: "Coarena", npm: SDK, api: BASE, models: configModels(bootstrap) }
    },
    auth: {
      provider: "coarena",
      icon,
      methods: [{ type: "api", label: "Coarena API key", labels: { zh: "Coarena API 密钥", "zh-TW": "Coarena API 金鑰" }, placeholder: "coa_…" }],
      options: [{
        key: "english_usage", label: "Show usage in English", labels: { zh: "用英文显示额度卡片", "zh-TW": "以英文顯示額度卡片" },
        description: "Off: Chinese usage cards. On: English usage cards.",
        descriptions: { zh: "关闭时使用简体中文，开启时使用英文。保存后刷新额度卡片生效。", "zh-TW": "關閉時使用簡體中文，開啟時使用英文。儲存後重新整理額度卡片生效。" },
        default: false, placement: "top",
      }],
      async loader(getAuth) {
        const key = keyOf(await getAuth())
        return key ? { baseURL: BASE, apiKey: key } : {}
      },
      usage: createUsage({ fetchImpl, now, timeoutMs, language }),
    },
    provider: { id: "coarena", models: createCatalog({ fetchImpl, now, bootstrap, timeoutMs }) },
  }
}

export const CoarenaPlugin = async (input = {}) => createPlugin({
  language: () => input.magpie?.option?.("coarena", "english_usage") === true ? "en" : "zh",
})
// Not re-exported by the host's v1 entry point.
export const _internal = { createPlugin, normalizeModels, configModels, runtimeModels, toConfigModel, toRuntimeModel, usageOf, errorOf, bootstrap, BASE, SDK }
