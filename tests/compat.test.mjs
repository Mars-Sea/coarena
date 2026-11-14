import { test, expect } from "bun:test"
import adapter, { setup, modelOf, wrapFetch, packageOf } from "../opencode2.mjs"
import { _internal } from "../index.mjs"
import { FELL_BACK } from "../http.mjs"

function context(value = null) {
  const transforms = []
  const providers = new Map()
  const publications = []
  const sdk = new Map()
  const methods = []
  let credential = value
  let nextEvent
  const queue = []
  const editor = { add: (p) => { providers.set(p.info.id, p); publications.push(p.models.map((m) => m.id)) } }
  const ctx = {
    location: { directory: "/synthetic" },
    integration: {
      transform: async (fn) => fn({ update() {}, method: { update: (m) => methods.push(m) } }),
      connection: { active: async () => credential ? { type: "credential", id: "selected" } : undefined, resolve: async () => credential },
    },
    provider: { transform: async (fn) => { transforms.push(fn); fn(editor) }, reload: async () => { for (const fn of transforms) fn(editor) } },
    model: { reload: async () => {} },
    aisdk: { hook: async (_name, fn, { providerID }) => sdk.set(providerID, fn) },
    event: { subscribe: async function* () { for (;;) { const event = queue.length ? queue.shift() : await new Promise((r) => { nextEvent = r }); if (!event) return; yield event } } },
  }
  return {
    ctx, providers, sdk, methods, publications,
    switchTo(v) { credential = v; const event = { type: "credential.updated" }; if (nextEvent) { const resolve = nextEvent; nextEvent = null; resolve(event) } else queue.push(event) },
    end() { nextEvent?.(null) },
  }
}
const response = (id) => Response.json({ data: id ? [{ id, capabilities: { vision: true, tools: true }, max_input_tokens: 4000, max_tokens: 200 }] : [] })
const moduleOf = (options) => ({ CoarenaPlugin: async () => _internal.createPlugin(options) })
const tickUntil = async (check) => { for (let i = 0; i < 100; i++) { if (check()) return; await new Promise((r) => setTimeout(r, 1)) } throw new Error("Bridge event did not settle") }

test("v2 default shape, public setup discovery and SDK package/capability mapping", async () => {
  expect(adapter.id).toBe("coarena")
  expect(typeof adapter.setup).toBe("function")
  const host = context()
  const stop = await setup(host.ctx, moduleOf({ fetchImpl: async () => response("public-live") }))
  const provider = host.providers.get("coarena")
  expect(provider.models.map((m) => m.id)).toEqual(["public-live"])
  expect(provider.info.package).toBe("aisdk:@ai-sdk/openai-compatible@2.0.41")
  expect(provider.info.settings.baseURL).toBe(_internal.BASE)
  expect(provider.models[0]).toMatchObject({ modelID: "public-live", limit: { context: 4000, input: 4000, output: 200 }, capabilities: { tools: true, input: ["text", "image"] } })
  expect(host.methods[0].method.type).toBe("key")
  stop(); host.end()
})

test("plugin reload with unchanged credentials rediscovers, and empty response clears bootstrap", async () => {
  const credential = { type: "key", key: "synthetic-stable" }
  let id = "first"
  const mod = moduleOf({ fetchImpl: async () => response(id) })
  for (const next of ["first", "second", null]) {
    id = next
    const host = context(credential)
    const stop = await setup(host.ctx, mod)
    expect(host.providers.get("coarena").models.map((m) => m.id)).toEqual(id ? [id] : [])
    const evt = { options: { baseURL: _internal.BASE, fetch: async (_input, init) => Response.json({ auth: new Headers(init.headers).get("authorization") }) } }
    await host.sdk.get("coarena")(evt)
    const sent = await evt.options.fetch(`${_internal.BASE}/chat/completions`, { headers: { authorization: `Bearer ${evt.options.apiKey}` } })
    expect((await sent.json()).auth).toBe("Bearer synthetic-stable")
    stop(); host.end()
  }
})

test("failure marker retains bootstrap on initial discovery", async () => {
  const host = context()
  const stop = await setup(host.ctx, { plugin: async () => {
    const hooks = _internal.createPlugin()
    hooks.provider.models = async () => { const result = {}; Object.defineProperty(result, FELL_BACK, { value: true }); return result }
    return hooks
  } })
  expect(host.providers.get("coarena").models.length).toBe(20)
  stop(); host.end()
})

test("credential changes refresh directory; failed refresh keeps last-good and selected key stays isolated", async () => {
  let time = 0; let mode = "first"; let reads = 0
  const host = context({ type: "key", key: "synthetic-A" })
  const stop = await setup(host.ctx, moduleOf({ now: () => time, fetchImpl: async () => { reads++; return mode === "failed" ? new Response("fail", { status: 503 }) : response(mode) } }))
  time = 300000; mode = "failed"; host.switchTo({ type: "key", key: "synthetic-B" })
  await tickUntil(() => reads === 2)
  await new Promise((r) => setTimeout(r, 2))
  expect(host.providers.get("coarena").models[0].id).toBe("first")
  const sent = []
  const evt = { options: { baseURL: _internal.BASE, fetch: async (_input, init) => { sent.push(new Headers(init.headers).get("authorization")); return new Response("ok") } } }
  await host.sdk.get("coarena")(evt)
  await evt.options.fetch(`${_internal.BASE}/chat/completions`, { headers: { authorization: `Bearer ${evt.options.apiKey}` } })
  expect(sent).toEqual(["Bearer synthetic-B"])
  stop(); host.end()
})

test("refresh results cannot publish after credentials change within the same connection ID", async () => {
  const host = context({ type: "key", key: "synthetic-initial" })
  const first = _internal.toRuntimeModel(_internal.normalizeModels({ data: [{ id: "first" }] }).first)
  const latest = { ...first, id: "latest", name: "latest", api: { ...first.api, id: "latest" } }
  let reads = 0; let release
  const stop = await setup(host.ctx, { plugin: async () => {
    const hooks = _internal.createPlugin()
    hooks.provider.models = async () => {
      reads++
      if (reads === 1) return { first }
      if (reads === 2) return new Promise((r) => { release = () => r({ stale: { ...first, id: "stale" } }) })
      return { latest }
    }
    return hooks
  } })
  host.switchTo({ type: "key", key: "synthetic-B" })
  await tickUntil(() => reads === 2)
  host.switchTo({ type: "key", key: "synthetic-C" })
  release()
  await tickUntil(() => host.providers.get("coarena").models[0]?.id === "latest")
  expect(host.publications.some((models) => models.includes("stale"))).toBe(false)
  stop(); host.end()
})

test("bridge disposal aborts an ongoing directory refresh and prevents publishing", async () => {
  const host = context({ type: "key", key: "synthetic-initial" })
  let signal; let reads = 0
  const stop = await setup(host.ctx, { plugin: async () => {
    const hooks = _internal.createPlugin()
    hooks.provider.models = async (_provider, options) => {
      if (++reads === 1) return {}
      signal = options.signal
      return new Promise((_, reject) => signal.addEventListener("abort", () => reject(signal.reason), { once: true }))
    }
    return hooks
  } })
  host.switchTo({ type: "key", key: "synthetic-changed" })
  await tickUntil(() => reads === 2)
  const count = host.publications.length
  stop(); host.end()
  expect(signal.aborted).toBe(true)
  await new Promise((r) => setTimeout(r, 2))
  expect(host.publications.length).toBe(count)
})

test("both model shapes convert and unknown limits use the documented bridge defaults", () => {
  const model = _internal.normalizeModels({ data: [{ id: "unknown", capabilities: { tools: false } }] }).unknown
  for (const row of [_internal.toConfigModel(model), _internal.toRuntimeModel(model)]) {
    const mapped = modelOf("coarena", { baseURL: "https://example.invalid", npm: "different" }, "unknown", row)
    expect(mapped.modelID).toBe("unknown")
    expect(mapped.package).toBe(packageOf(_internal.SDK))
    expect(mapped.settings.baseURL).toBe(_internal.BASE)
    expect(mapped.capabilities.tools).toBe(false)
    expect(mapped.limit).toEqual({ context: 128000, output: 8192 })
  }
})

test("Request forwarding preserves body stream, standard properties and extension init options", async () => {
  const abort = new AbortController()
  let read = false
  const req = new Request("https://configured.invalid/v1/chat/completions", {
    method: "POST", body: new ReadableStream({ start(c) { c.enqueue(new TextEncoder().encode("streamed-body")); c.close() } }), duplex: "half",
    signal: abort.signal, headers: { authorization: "Bearer opencode2-v1-key" }, redirect: "manual", credentials: "omit", cache: "no-store",
  })
  req.text = () => { read = true; throw new Error("must not buffer Request.text") }
  const dispatcher = { synthetic: true }; const proxy = "http://proxy.invalid"
  const wrapped = wrapFetch(async (input, init) => {
    expect(input).toBeInstanceOf(Request)
    expect(input.url).toBe("https://coarena.invalid/api/v1/chat/completions")
    expect(input.redirect).toBe("manual"); expect(input.cache).toBe("no-store"); expect(input.credentials).toBe(req.credentials)
    expect(init.dispatcher).toBe(dispatcher); expect(init.proxy).toBe(proxy)
    const effective = new Request(input, init)
    expect(effective.headers.get("authorization")).toBe("Bearer synthetic-selected")
    expect(await effective.text()).toBe("streamed-body")
    abort.abort()
    expect(effective.signal.aborted).toBe(true)
    return new Response("ok")
  }, "https://configured.invalid/v1", async () => ({ baseURL: "https://coarena.invalid/api/v1", key: "synthetic-selected" }))
  await wrapped(req, { dispatcher, proxy })
  expect(read).toBe(false)
})

test("URL rewrite applies replacement bodies before inspecting a consumed original body", async () => {
  for (const streaming of [false, true]) {
    const req = new Request("https://original.invalid/v1/chat", { method: "POST", body: "already consumed" })
    await req.text()
    const body = streaming ? new ReadableStream({ start(c) { c.enqueue(new TextEncoder().encode("replacement")); c.close() } }) : "replacement"
    const wrapped = wrapFetch(async (input, init) => {
      expect(input.url).toBe("https://selected.invalid/api/v1/chat")
      expect(input.redirect).toBe("error")
      expect(init.proxy).toBe("http://proxy.invalid")
      expect(await new Request(input, init).text()).toBe("replacement")
      return new Response("ok")
    }, "https://original.invalid/v1", async () => ({ baseURL: "https://selected.invalid/api/v1" }))
    await wrapped(req, { body, redirect: "error", proxy: "http://proxy.invalid" })
  }
})

test("Request init overrides body/method/signal/headers and preserves redirect/dispatcher", async () => {
  const original = new AbortController(); const override = new AbortController()
  const req = new Request("https://same.invalid/chat/completions", { method: "POST", body: "old", signal: original.signal, headers: { "x-old": "old" } })
  const wrapped = wrapFetch(async (input, init) => {
    expect(input).toBe(req)
    expect(init.dispatcher).toBe("synthetic-dispatcher")
    const effective = new Request(input, init)
    expect(effective.method).toBe("PUT"); expect(effective.redirect).toBe("error")
    expect(await effective.text()).toBe("override")
    expect(effective.headers.get("x-old")).toBeNull()
    expect(effective.headers.get("x-new")).toBe("new")
    original.abort(); expect(effective.signal.aborted).toBe(false)
    override.abort(); expect(effective.signal.aborted).toBe(true)
    return new Response("ok")
  }, "https://same.invalid", async () => ({}))
  await wrapped(req, { method: "PUT", body: "override", headers: { "x-new": "new" }, signal: override.signal, dispatcher: "synthetic-dispatcher", redirect: "error" })
})
