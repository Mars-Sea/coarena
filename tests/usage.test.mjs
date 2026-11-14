import { test, expect, describe } from "bun:test"
import { readFileSync } from "node:fs"
import { _internal } from "../index.mjs"

const fixture = JSON.parse(readFileSync(new URL("./fixtures/limits-default.json", import.meta.url), "utf8"))
const usage = (data) => _internal.usageOf({ data }, "en")
const auth = (key = "synthetic-A") => async () => ({ type: "api", key })
const windowOf = (data) => usage(data).windows[0]

describe("daily usage normalization", () => {
  test("used plus held equals amount and percent; reset is server UTC time", () => {
    const result = _internal.usageOf(fixture, "en")
    expect(result.plan).toBe("Free daily allowance")
    expect(result.windows[0]).toMatchObject({ amount: 1.5, used: 30, limit: 5, unit: "USD", span: 86400, resetsAt: "2026-11-15T00:00:00.000Z" })
    expect(result.windows[0].display).toBe("Used $1.20 · Held $0.30 · Left $3.50 / $5.00")
    expect(result.balance).toBeUndefined()
    expect(result.windows[1]).toMatchObject({ name: "Rate limits", aside: true })
    expect(result.windows[1].used).toBeUndefined()
  })
  test("server left takes priority, does not subtract held twice", () => {
    const w = windowOf({ usd_per_day: 5, today: { used_usd: 1.2, held_usd: 0.3, left_usd: 2 } })
    expect(w.used).toBe(30)
    expect(w.display).toContain("Left $2.00")
  })
  test("explicit zero usage, zero limit, unknown limit and incomplete held", () => {
    expect(windowOf({ usd_per_day: 5, today: { used_usd: 0, held_usd: 0 } })).toMatchObject({ used: 0, amount: 0 })
    expect(windowOf({ usd_per_day: 0, today: {} })).toMatchObject({ used: 100, limit: 0 })
    const missing = windowOf({ usd_per_day: null, today: { used_usd: 0, held_usd: 0, resets_at: "" } })
    expect(missing.used).toBeUndefined()
    expect(missing.limit).toBeUndefined()
    expect(missing.resetsAt).toBeUndefined()
    const held = windowOf({ usd_per_day: 5, today: { used_usd: 1 } })
    expect(held.amount).toBeUndefined()
    expect(held.used).toBeUndefined()
    expect(held.display).toContain("Held unknown")
  })
  test("zero allowance cannot infer unknown amount from zero remaining", () => {
    for (const today of [{ left_usd: 0 }, { used_usd: 2, left_usd: 0 }]) {
      const w = windowOf({ usd_per_day: 0, today })
      expect(w.amount).toBeUndefined()
      expect(w.used).toBe(100)
      expect(w.display).toContain("Held unknown")
    }
    expect(windowOf({ usd_per_day: 0, today: { used_usd: 2, held_usd: 0, left_usd: 0 } }).amount).toBe(2)
  })
  test("derive effective from known left without inventing spent/held breakdown", () => {
    const w = windowOf({ usd_per_day: 5, today: { left_usd: 3.5 } })
    expect(w).toMatchObject({ amount: 1.5, used: 30 })
    expect(w.display).toContain("Used unknown · Held unknown")
  })
  test("micro dollars, overage amount and bounded percentage", () => {
    const w = windowOf({ usd_per_day: "0.000005", today: { used_usd: "0.000006", held_usd: 0 } })
    expect(w.amount).toBe(0.000006)
    expect(w.used).toBe(100)
    expect(w.display).toContain("$0.000006")
  })
  test("granted until and request status do not replace today's effective limit", () => {
    const result = usage({ usd_per_day: 10, source: "granted", granted_until: "2026-12-01T08:00:00+08:00", today: {}, request: { status: "pending", usd_per_day: 50 } })
    expect(result.plan).toBe("Granted daily allowance")
    expect(result.until).toBe("2026-12-01T00:00:00.000Z")
    expect(result.windows[0].limit).toBe(10)
    expect(result.windows[1]).toMatchObject({ aside: true, display: "Request pending" })
  })
  test("finite, unlimited, zero and unknown daily request limits", () => {
    const daily = usage({ requests_per_day: 20, today: { requests: 12, requests_left: 7 } }).windows[1]
    expect(daily).toMatchObject({ amount: 12, limit: 20, used: 60 })
    expect(daily.display).toContain("Left 7")
    for (const requests_per_day of [null, undefined, "", false, -1])
      expect(usage({ requests_per_day, today: {} }).windows.length).toBe(1)
    expect(usage({ requests_per_day: 0, today: {} }).windows[1].used).toBe(100)
    expect(usage({ requests_per_day: 20, today: {} }).windows[1].used).toBeUndefined()
  })
  test("missing monetary fields are never silently zero", () => {
    for (const value of [null, "", false, -1, "Infinity"]) {
      const w = windowOf({ usd_per_day: value, today: { used_usd: value, held_usd: value } })
      expect(w.amount).toBeUndefined(); expect(w.limit).toBeUndefined(); expect(w.used).toBeUndefined()
    }
  })
})

describe("usage reads and credential isolation", () => {
  test("parallel accounts are isolated; one auth header; 30-second TTL; cached values are copied", async () => {
    let time = 0; const calls = []
    const plugin = _internal.createPlugin({ now: () => time, fetchImpl: async (url, init) => {
      calls.push({ url, init })
      const key = new Headers(init.headers).get("authorization")
      const body = structuredClone(fixture)
      body.data.usd_per_day = key.endsWith("A") ? 5 : 10
      return Response.json(body)
    } })
    const [a, b] = await Promise.all([plugin.auth.usage(auth("synthetic-A")), plugin.auth.usage(auth("synthetic-B"))])
    expect(a.windows[0].limit).toBe(5); expect(b.windows[0].limit).toBe(10)
    a.windows[0].limit = 999
    time = 29999
    expect((await plugin.auth.usage(auth())).windows[0].limit).toBe(5)
    expect(calls.length).toBe(2)
    time = 30000; await plugin.auth.usage(auth()); expect(calls.length).toBe(3)
    for (const { url, init } of calls) {
      expect(url).toBe(`${_internal.BASE}/limits`)
      expect(init.redirect).toBe("error")
      expect(new Headers(init.headers).has("authorization")).toBe(true)
      expect(new Headers(init.headers).has("x-api-key")).toBe(false)
    }
  })
  test("same-key reads merge; cancelled waiter cannot abort another", async () => {
    let release; const gate = new Promise((r) => { release = r }); let calls = 0
    const plugin = _internal.createPlugin({ fetchImpl: async () => { calls++; await gate; return Response.json(fixture) } })
    const controller = new AbortController()
    const first = plugin.auth.usage(auth(), {}, { signal: controller.signal })
    const second = plugin.auth.usage(auth())
    await Promise.resolve(); controller.abort()
    expect((await first).error).toContain("已取消")
    release()
    expect((await second).windows[0].used).toBe(30)
    expect(calls).toBe(1)
  })
  test("expired success is never returned as current after network/format failure", async () => {
    let time = 0; let calls = 0
    const plugin = _internal.createPlugin({ now: () => time, fetchImpl: async () => { if (++calls === 1) return Response.json(fixture); throw new Error("private network detail") } })
    await plugin.auth.usage(auth())
    time = 30000
    const result = await plugin.auth.usage(auth())
    expect(result).toMatchObject({ signIn: "kept", windows: [] })
    expect(result.error).not.toContain("private")
    const malformed = _internal.createPlugin({ fetchImpl: async () => new Response("<html>private</html>") })
    expect((await malformed.auth.usage(auth())).windows).toEqual([])
  })
  test("timeout and cancellation abort downstream without retry", async () => {
    let calls = 0; let downstream
    const plugin = _internal.createPlugin({ timeoutMs: 10, fetchImpl: async (_url, init) => { calls++; downstream = init.signal; return new Promise(() => {}) } })
    expect((await plugin.auth.usage(auth())).error).toContain("超时")
    expect(downstream.aborted).toBe(true)
    expect(calls).toBe(1)
    const controller = new AbortController(); controller.abort()
    expect((await plugin.auth.usage(auth("synthetic-C"), {}, { signal: controller.signal })).signIn).toBe("kept")
    expect(calls).toBe(1)
  })
  test.each([
    [401, "invalid_api_key", "expired"], [401, "api_key_revoked", "expired"], [401, "api_key_expired", "expired"],
    [401, "conflicting_credentials", "kept"], [401, "api_keys_disabled", "kept"], [401, "unknown", "kept"],
    [403, "insufficient_scope", "kept"], [403, "account_blocked", "kept"], [403, "account_withdrawn", "kept"],
    [429, "insufficient_quota", "kept"], [429, "rate_limit_exceeded", "kept"], [429, "concurrency", "kept"],
    [503, "model_api_disabled", "kept"], [503, "server_draining", "kept"], [503, "quota_unavailable", "kept"],
  ])("HTTP %s %s -> %s", async (status, code, signIn) => {
    const plugin = _internal.createPlugin({ fetchImpl: async () => Response.json({ error: { code, message: "synthetic detail" } }, { status, headers: { "x-request-id": "synthetic-request", "retry-after": "30" } }) })
    const result = await plugin.auth.usage(auth())
    expect(result.signIn).toBe(signIn)
    expect(result.windows).toEqual([])
    expect(result.error).toContain(code)
    expect(result.error).toContain(`HTTP ${status}`)
    expect(result.error).toContain("synthetic-request")
    expect(result.error).toContain("Retry-After: 30")
  })
  test("non-object error JSON retains HTTP status, request ID and retry headers", async () => {
    for (const body of [null, [], 0, "unexpected"]) {
      const result = await _internal.errorOf(Response.json(body, { status: 429, headers: { "x-request-id": "synthetic-request", "retry-after": "30" } }), "synthetic-key", "en")
      expect(result).toMatchObject({ signIn: "kept", windows: [] })
      expect(result.error).toContain("HTTP 429")
      expect(result.error).toContain("Request ID: synthetic-request")
      expect(result.error).toContain("Retry-After: 30")
    }
  })
  test("error bodies redact secrets; HTML is not echoed", async () => {
    const key = "synthetic-secret-DO-NOT-ECHO"
    const plugin = _internal.createPlugin({ fetchImpl: async () => Response.json({ error: { code: "invalid_api_key", message: `Bearer ${key}, x-api-key=coa_synthetic_secret` } }, { status: 401 }) })
    const result = await plugin.auth.usage(auth(key))
    expect(result.error).not.toContain(key)
    expect(result.error).not.toContain("coa_synthetic_secret")
    const html = await _internal.errorOf(new Response("<html>sensitive</html>", { status: 503 }), key)
    expect(html.error).not.toContain("sensitive")
  })
})
