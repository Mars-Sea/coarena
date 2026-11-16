import { test, expect } from "bun:test"
import { _internal } from "../index.mjs"
import { freeCredits } from "./free-credits-helper.mjs"
import { readFileSync } from "node:fs"

const limits = JSON.parse(readFileSync(new URL("./fixtures/limits-default.json", import.meta.url)))
const paid = { object: "credits", plan: "paid", balance_usd: 10, held_usd: 2, available_usd: 7.5, free_daily_usd: null }
const auth = (key = "synthetic-A") => async () => ({ type: "api", key })

test("free eligibility is independent of zero prices, preserves IDs and both host shapes", async () => {
  const ids = ["gpt-6-luna", "gemini-3-8-flash", "deepseek-v4-1-flash-1017", "claude-opus-5-5", "unknown"]
  const models = _internal.normalizeModels({ data: ids.map(id => ({ id, display_name: id, pricing: { prompt: "0", completion: "0" } })) })
  for (const map of [_internal.configModels(models), _internal.runtimeModels(models)]) {
    expect(Object.keys(map)).toEqual(ids)
    expect(Object.values(map).filter(m => m.free).map(m => m.id)).toEqual(ids.slice(0, 3))
    for (const id of ids) expect(map[id].name).toBe(id)
  }
  // An explicit boolean from a future catalog overrides the dated policy.
  expect(_internal.normalizeModels({ data: [{ id: "gpt-6-luna", free: false }, { id: "new-free", free: true }] })["gpt-6-luna"].free).toBe(false)
  expect(_internal.normalizeModels({ data: [{ id: "new-free", free: true }] })["new-free"].free).toBe(true)
  const cfg = {}; await _internal.createPlugin().config(cfg)
  expect(Object.values(cfg.provider.coarena.models).filter(m => m.free).map(m => m.id).sort()).toEqual(ids.slice(0, 3).sort())
})

test("paid credits are a wallet without a daily reset or fabricated usage percentage", () => {
  for (const language of ["en", "zh"]) {
    const u = _internal.usageOf(limits, language, paid)
    expect(u.balance).toBe("$7.50")
    expect(u.until).toBeUndefined()
    expect(u.windows[0]).toMatchObject({ balance: 7.5, unit: "USD" })
    for (const field of ["amount", "limit", "used", "span", "resetsAt"]) expect(u.windows[0][field]).toBeUndefined()
    expect(u.windows[0].display).toContain("$2.00")
  }
  const missing = _internal.usageOf(limits, "en", { object: "credits", plan: "paid" })
  expect(missing.windows[0].balance).toBeUndefined()
  expect(missing.balance).toBe("unknown")
  expect(_internal.usageOf(limits, "en", { ...paid, available_usd: 0 }).windows[0].balance).toBe(0)
  const free = _internal.usageOf({ data: { source: "default", today: { used_usd: 1, held_usd: 0 } } }, "en", freeCredits)
  expect(free.windows[0]).toMatchObject({ amount: 1, limit: 5, used: 20 })
  expect(_internal.usageOf(limits, "en", { ...paid, plan: "suspended" })).toMatchObject({ signIn: "kept", windows: [] })
})

test("both reads share account isolation, TTL and language rerender; plan changes after expiry", async () => {
  let time = 0; let language = "zh"; let upgraded = false
  const calls = []
  const p = _internal.createPlugin({ now: () => time, language: () => language, fetchImpl: async (url, init) => {
    const key = new Headers(init.headers).get("authorization")
    calls.push({ url, init, key })
    return Response.json(url.endsWith("/limits") ? limits : key.endsWith("B") || upgraded ? paid : freeCredits)
  } })
  const [a,b] = await Promise.all([p.auth.usage(auth()), p.auth.usage(auth("synthetic-B"))])
  expect(a.plan).toBe("免费每日额度"); expect(b.balance).toBe("$7.50")
  expect(calls.length).toBe(4)
  language = "en"; upgraded = true; time = 29999
  expect((await p.auth.usage(auth())).plan).toBe("Free daily allowance")
  expect(calls.length).toBe(4)
  time = 30000
  expect((await p.auth.usage(auth())).plan).toBe("Paid credits")
  expect(calls.length).toBe(6)
  for (const { url, init } of calls) {
    expect([`${_internal.BASE}/limits`, `${_internal.BASE}/credits`]).toContain(url)
    expect(init.redirect).toBe("error")
    expect(new Headers(init.headers).has("x-api-key")).toBe(false)
  }
})

test("credits failures never reuse expired success or misclassify a paid account as free", async () => {
  for (const failure of [null, { data: paid }, { object: "credits", plan: "unknown" }, 401, 403, 429, 503]) {
    let time = 0; let bad = false
    const p = _internal.createPlugin({ now: () => time, fetchImpl: async url => {
      if (url.endsWith("/limits")) return Response.json(limits)
      if (!bad) return Response.json(paid)
      if (typeof failure === "number") return Response.json({ error: { code: failure === 401 ? "invalid_api_key" : "synthetic_failure" } }, { status: failure })
      return Response.json(failure)
    } })
    expect((await p.auth.usage(auth())).balance).toBe("$7.50")
    bad = true; time = 30000
    const result = await p.auth.usage(auth())
    expect(result.error).toBeTruthy(); expect(result.windows).toEqual([])
    expect(result.balance).toBeUndefined()
    expect(result.signIn).toBe(failure === 401 ? "expired" : "kept")
  }
})

test("cancelling during credits read aborts the same task without retry", async () => {
  let signal; let started
  const ready = new Promise(resolve => { started = resolve })
  let calls = 0
  const p = _internal.createPlugin({ fetchImpl: async (url, init) => {
    calls++
    if (url.endsWith("/limits")) return Response.json(limits)
    signal = init.signal; started(); return new Promise(() => {})
  } })
  const ctl = new AbortController()
  const read = p.auth.usage(auth(), {}, { signal: ctl.signal })
  await ready; ctl.abort()
  expect((await read).signIn).toBe("kept")
  expect(signal.aborted).toBe(true); expect(calls).toBe(2)
})

test("payment errors keep sign-in, include billing advice and Coarena request id", async () => {
  for (const code of ["payment_required", "insufficient_balance", "billing_suspended"]) {
    const r = await _internal.errorOf(Response.json({ error: { code } }, { status: code === "billing_suspended" ? 403 : 402, headers: { "x-coarena-request-id": "synthetic-credit-request" } }), "secret-key-not-in-request-id", "en")
    expect(r.signIn).toBe("kept"); expect(r.error).toContain(code)
    expect(r.error).toContain("synthetic-credit-request")
  }
})
