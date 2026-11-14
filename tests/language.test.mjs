import { describe, test, expect } from "bun:test"
import { readFileSync } from "node:fs"
import { _internal, CoarenaPlugin } from "../index.mjs"

const fixture = JSON.parse(readFileSync(new URL("./fixtures/limits-default.json", import.meta.url), "utf8"))
const auth = async () => ({ type: "api", key: "synthetic-locale" })

describe("usage card languages", () => {
  test("default Chinese covers plan, daily requests, rate limits, request status and unknown values", () => {
    const body = structuredClone(fixture)
    body.data.requests_per_day = 20
    body.data.request = { status: "pending" }
    const result = _internal.usageOf(body)
    expect(result.plan).toBe("免费每日额度")
    expect(result.windows.map((w) => w.name)).toEqual(["每日模型额度", "每日请求次数", "速率限制", "额度申请"])
    expect(result.windows[0].display).toBe("已用 $1.20 · 预占 $0.30 · 剩余 $3.50 / $5.00")
    expect(result.windows[1].unit).toBe("次")
    expect(result.windows[2].display).toContain("次/分钟（每 Key）")
    expect(result.windows[3].display).toBe("申请状态：待审核")
    expect(_internal.usageOf({ data: { usd_per_day: 0, today: {} } }).windows[0].display).toBe("已用 未知 · 预占 未知 · 剩余 未知 / $0.00 · 无可用额度")
    expect(_internal.usageOf(body, "unsupported").plan).toBe(result.plan)
  })
  test("both languages preserve all quota numbers and distinguish unknown from zero", () => {
    for (const data of [fixture.data, { usd_per_day: 0, today: {} }, { usd_per_day: 5, today: { used_usd: 0, held_usd: 0 } }, { today: {} }]) {
      const values = (language) => _internal.usageOf({ data }, language).windows.map(({ amount, limit, used, span, resetsAt }) => ({ amount, limit, used, span, resetsAt }))
      expect(values("zh")).toEqual(values("en"))
    }
    expect(_internal.usageOf(fixture, "en").windows[0].display).toBe("Used $1.20 · Held $0.30 · Left $3.50 / $5.00")
  })
  test("switching language rerenders the account cache without refetching or sharing mutable output", async () => {
    let language = "zh"; let calls = 0
    const plugin = _internal.createPlugin({ language: () => language, fetchImpl: async () => { calls++; return Response.json(fixture) } })
    const first = await plugin.auth.usage(auth)
    first.windows[0].limit = 999
    language = "en"
    const english = await plugin.auth.usage(auth)
    expect(english.plan).toBe("Free daily allowance")
    expect(english.windows[0].limit).toBe(5)
    language = "zh"
    expect((await plugin.auth.usage(auth)).plan).toBe("免费每日额度")
    expect(calls).toBe(1)
  })
  test("coalesced readers can choose different languages, including safe HTTP errors", async () => {
    for (const failed of [false, true]) {
      let language = "zh"; let calls = 0; let release
      const gate = new Promise((resolve) => { release = resolve })
      const plugin = _internal.createPlugin({ language: () => language, fetchImpl: async () => {
        calls++; await gate
        return failed ? Response.json({ error: { code: "insufficient_quota", message: "service detail" } }, { status: 429, headers: { "x-request-id": "synthetic-request" } }) : Response.json(fixture)
      } })
      const chinese = plugin.auth.usage(auth)
      await Promise.resolve()
      language = "en"
      const english = plugin.auth.usage(auth)
      await Promise.resolve()
      release()
      const [zh, en] = await Promise.all([chinese, english])
      if (failed) {
        expect(zh.error).toContain("请等待每日额度重置")
        expect(en.error).toContain("Wait for the daily reset")
        for (const value of [zh, en]) {
          expect(value.signIn).toBe("kept")
          expect(value.error).toContain("HTTP 429 (insufficient_quota)")
          expect(value.error).toContain("synthetic-request")
        }
      } else {
        expect(zh.plan).toBe("免费每日额度")
        expect(en.plan).toBe("Free daily allowance")
      }
      expect(calls).toBe(1)
    }
  })
  test("host option selects English dynamically; absent host option keeps Chinese", async () => {
    let english = false; const calls = []
    const plugin = await CoarenaPlugin({ magpie: { option: (...args) => { calls.push(args); return english } } })
    const controller = new AbortController(); controller.abort()
    const read = (hooks) => hooks.auth.usage(auth, {}, { signal: controller.signal })
    expect((await read(plugin)).error).toContain("额度读取已取消")
    english = true
    expect((await read(plugin)).error).toContain("read cancelled")
    expect(calls).toEqual([["coarena", "english_usage"], ["coarena", "english_usage"]])
    expect((await read(await CoarenaPlugin())).error).toContain("额度读取已取消")
  })
})
