import { describe, test, expect } from "bun:test"
import { _internal } from "../index.mjs"
import { FELL_BACK, numberOf, isoOf } from "../http.mjs"

const { createPlugin, normalizeModels, configModels, runtimeModels } = _internal
const row = (extra = {}) => ({ id: "canonical/model", display_name: "Model", capabilities: { vision: true, tools: true, reasoning_text: true, efforts: ["low", "max"] }, context_length: "128000", max_completion_tokens: 16384, pricing: { prompt: "0", completion: "0" }, ...extra })
const body = (data) => ({ object: "list", data })
const deferred = () => { let resolve; const promise = new Promise((r) => { resolve = r }); return { promise, resolve } }

describe("registration and conservative model normalization", () => {
  test("config is offline and preserves user configuration; loader is per-account", async () => {
    const plugin = createPlugin({ fetchImpl: () => { throw new Error("unexpected network") } })
    const cfg = {}
    await plugin.config(cfg)
    expect(cfg.provider.coarena.npm).toBe("@ai-sdk/openai-compatible")
    expect(Object.keys(cfg.provider.coarena.models).length).toBe(18)
    const custom = { provider: { coarena: { models: { mine: {} } } } }
    const saved = custom.provider.coarena
    await plugin.config(custom)
    expect(custom.provider.coarena).toBe(saved)
    for (const auth of [null, { type: "oauth", access: "x" }, { type: "api", key: "  " }]) {
      expect(await plugin.auth.loader(async () => auth)).toEqual({})
      expect(await plugin.auth.usage(async () => auth)).toEqual({})
    }
    for (const key of ["synthetic-A", "synthetic-B"])
      expect(await plugin.auth.loader(async () => ({ type: "api", key: ` ${key} ` }))).toEqual({ baseURL: _internal.BASE, apiKey: key })
  })
  test("canonical IDs, deduplication and both model structures", () => {
    const canonical = normalizeModels(body([row({ aliases: ["alias", "canonical/model"] }), row()]))
    expect(Object.keys(canonical)).toEqual(["canonical/model"])
    const config = configModels(canonical)["canonical/model"]
    const runtime = runtimeModels(canonical)["canonical/model"]
    expect(config.provider).toEqual({ npm: _internal.SDK, api: _internal.BASE })
    expect(config.tool_call).toBe(true)
    expect(config.modalities.input).toEqual(["text", "image"])
    expect(runtime.api.id).toBe("canonical/model")
    expect(runtime.capabilities.toolcall).toBe(true)
    expect(runtime.capabilities.efforts).toEqual(["low", "max"])
    expect(runtime.variants).toEqual({})
    expect(runtime.cost.cache).toEqual({ read: 0, write: 0 })
    expect(config.cost).toEqual({ input: 0, output: 0 })
  })
  test("capabilities require true, unknown prices and limits stay unknown", () => {
    const models = normalizeModels(body([row({ capabilities: { vision: "true", tools: false }, context_length: -1, max_input_tokens: "24.8", max_completion_tokens: null, max_tokens: "15.9", pricing: { prompt: "2.5", completion: null } })]))
    const m = runtimeModels(models)["canonical/model"]
    expect(m.limit).toEqual({ context: 24, input: 24, output: 15 })
    expect(m.capabilities.input.image).toBe(false)
    expect(m.capabilities.toolcall).toBe(false)
    expect(m.capabilities.reasoning).toBe(false)
    expect(m.cost.input).toBeUndefined()
    const unknown = normalizeModels(body([{ id: "gpt-unknown" }]))["gpt-unknown"]
    expect(unknown.limit).toEqual({ context: 0, output: 0 })
    expect(unknown.tools).toBe(false)
  })
  test("retired and expired rows are omitted; deprecated and unknown lifecycle remain", () => {
    const models = normalizeModels(body([
      row({ id: "retired", lifecycle: "retired" }), row({ id: "expired", retires_at: "2026-11-14T00:00:00Z" }),
      row({ id: "deprecated", lifecycle: "deprecated" }), row({ id: "future", retires_at: "2030-01-01T00:00:00Z" }), row({ id: "unknown", lifecycle: "new-state" }),
    ]), Date.parse("2026-11-14T00:00:00Z"))
    expect(Object.keys(models)).toEqual(["deprecated", "future", "unknown"])
    expect(models.deprecated.status).toBe("deprecated")
  })
  test("numeric and time coercion rejects missing, nonfinite and impossible inputs", () => {
    for (const v of [null, "", " ", false, -1, Infinity, NaN, "NaN", "0x10", "1e2"]) expect(numberOf(v)).toBeUndefined()
    expect(numberOf("0")).toBe(0)
    expect(numberOf("0.000001")).toBe(0.000001)
    for (const v of [null, "", "garbage", Infinity, "2026-02-30T00:00:00Z"]) expect(isoOf(v)).toBeUndefined()
    expect(isoOf("2026-11-14T08:00:00+08:00")).toBe("2026-11-14T00:00:00.000Z")
  })
})

describe("public model catalog cache", () => {
  test("no key, auth header or unrelated API; exact TTL and returned maps are isolated", async () => {
    let time = 0; const calls = []
    const plugin = createPlugin({ now: () => time, fetchImpl: async (url, init) => { calls.push({ url, init }); return Response.json(body([row()])) } })
    const result = await plugin.provider.models({}, { auth: { type: "api", key: "synthetic" } })
    result["canonical/model"].capabilities.input.image = false
    time = 299999
    expect((await plugin.provider.models({}))["canonical/model"].capabilities.input.image).toBe(true)
    expect(calls.length).toBe(1)
    time = 300000
    await plugin.provider.models({})
    expect(calls.length).toBe(2)
    for (const { url, init } of calls) {
      expect(url).toBe(`${_internal.BASE}/models`)
      expect(new Headers(init.headers).has("authorization")).toBe(false)
      expect(new Headers(init.headers).has("x-api-key")).toBe(false)
    }
  })
  test("successful empty list replaces bootstrap and is cached", async () => {
    let calls = 0
    const plugin = createPlugin({ fetchImpl: async () => { calls++; return Response.json(body([])) } })
    const result = await plugin.provider.models({})
    expect(result).toEqual({})
    expect(result[FELL_BACK]).toBeUndefined()
    await plugin.provider.models({})
    expect(calls).toBe(1)
  })
  test.each([401, 403, 429, 503])("HTTP %s falls back without expiring auth and backs off for 15 seconds", async (status) => {
    let time = 0; let calls = 0
    const plugin = createPlugin({ now: () => time, fetchImpl: async () => { calls++; return new Response("unavailable", { status }) } })
    const fallback = await plugin.provider.models({})
    expect(fallback[FELL_BACK]).toBe(true)
    expect(fallback.signIn).toBeUndefined()
    time = 14999; await plugin.provider.models({}); expect(calls).toBe(1)
    time = 15000; await plugin.provider.models({}); expect(calls).toBe(2)
  })
  test.each(["<html>failure</html>", {}, { data: null }, { data: [{ id: " " }] }])("malformed catalog keeps last-good, recovers and never marks success cache", async (bad) => {
    let time = 0; let mode = 0
    const plugin = createPlugin({ now: () => time, fetchImpl: async () => mode === 1 ? typeof bad === "string" ? new Response(bad) : Response.json(bad) : Response.json(body(mode === 2 ? [] : [row()])) })
    await plugin.provider.models({})
    time = 300000; mode = 1
    const fallback = await plugin.provider.models({})
    expect(Object.keys(fallback)).toEqual(["canonical/model"])
    expect(fallback[FELL_BACK]).toBe(true)
    time += 15000; mode = 2
    const empty = await plugin.provider.models({})
    expect(empty).toEqual({})
    expect(empty[FELL_BACK]).toBeUndefined()
  })
  test("in-flight requests coalesce while a single cancelled caller cannot cancel the other", async () => {
    const gate = deferred(); let calls = 0; let downstream
    const plugin = createPlugin({ fetchImpl: async (_url, init) => { calls++; downstream = init.signal; await gate.promise; return Response.json(body([row()])) } })
    const controller = new AbortController()
    const first = plugin.provider.models({}, { signal: controller.signal })
    const second = plugin.provider.models({})
    controller.abort()
    await expect(first).rejects.toMatchObject({ name: "AbortError" })
    expect(downstream.aborted).toBe(false)
    gate.resolve()
    expect(Object.keys(await second)).toEqual(["canonical/model"])
    expect(calls).toBe(1)
  })
  test("all callers cancelling aborts network; next explicit read can recover", async () => {
    let calls = 0; let downstream
    const plugin = createPlugin({ fetchImpl: async (_url, init) => { downstream = init.signal; if (++calls === 1) return new Promise(() => {}); return Response.json(body([])) } })
    const controller = new AbortController()
    const request = plugin.provider.models({}, { signal: controller.signal })
    await Promise.resolve()
    controller.abort()
    await expect(request).rejects.toMatchObject({ name: "AbortError" })
    expect(downstream.aborted).toBe(true)
    expect(await plugin.provider.models({})).toEqual({})
    expect(calls).toBe(2)
  })
  test("timeout covers fetch and returns a marked fallback without retries", async () => {
    let calls = 0
    const plugin = createPlugin({ timeoutMs: 10, fetchImpl: () => { calls++; return new Promise(() => {}) } })
    expect((await plugin.provider.models({}))[FELL_BACK]).toBe(true)
    expect(calls).toBe(1)
  })
})
