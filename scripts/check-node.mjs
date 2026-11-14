import "./check.mjs"
import assert from "node:assert/strict"
import { wrapFetch } from "../opencode2.mjs"

const source = new AbortController()
const override = new AbortController()
const request = new Request("https://configured.invalid/v1/chat/completions", {
  method: "POST", body: new ReadableStream({ start(c) { c.enqueue(new TextEncoder().encode("original stream")); c.close() } }),
  duplex: "half", credentials: "omit", cache: "no-store", redirect: "manual", signal: source.signal,
  headers: { "x-original": "true", authorization: "Bearer opencode2-v1-key" },
})
request.text = () => { throw new Error("Request must not be buffered") }
let sent = 0
const dispatcher = { synthetic: true }
const wrapped = wrapFetch(async (input, init) => {
  sent++
  assert.equal(input.url, "https://selected.invalid/api/v1/chat/completions")
  assert.equal(input.credentials, "omit")
  assert.equal(input.cache, "no-store")
  assert.equal(input.redirect, "manual")
  assert.equal(init.dispatcher, dispatcher)
  assert.equal(init.proxy, "http://proxy.invalid")
  const effective = new Request(input, init)
  assert.equal(await effective.text(), "original stream")
  assert.equal(effective.headers.get("authorization"), "Bearer synthetic-node-key")
  source.abort()
  assert.equal(effective.signal.aborted, true)
  return new Response("ok")
}, "https://configured.invalid/v1", async () => ({ baseURL: "https://selected.invalid/api/v1", key: "synthetic-node-key" }))
await wrapped(request, { dispatcher, proxy: "http://proxy.invalid" })
assert.equal(sent, 1)

const originalSignal = new AbortController()
const original = new Request("https://same.invalid/chat", { method: "POST", body: "old", signal: originalSignal.signal, headers: { "x-old": "old" } })
const overriding = wrapFetch(async (input, init) => {
  assert.equal(input, original)
  const effective = new Request(input, init)
  assert.equal(effective.method, "PUT")
  assert.equal(effective.redirect, "error")
  assert.equal(await effective.text(), "new body")
  assert.equal(effective.headers.get("x-old"), null)
  assert.equal(effective.headers.get("x-new"), "new")
  originalSignal.abort()
  assert.equal(effective.signal.aborted, false)
  override.abort()
  assert.equal(effective.signal.aborted, true)
  return new Response("ok")
}, "https://same.invalid", async () => ({}))
await overriding(original, { method: "PUT", body: "new body", signal: override.signal, headers: { "x-new": "new" }, redirect: "error" })

for (const streaming of [false, true]) {
  const used = new Request("https://before.invalid/v1/chat", { method: "POST", body: "used body" })
  await used.text()
  const body = streaming ? new ReadableStream({ start(c) { c.enqueue(new TextEncoder().encode("replacement")); c.close() } }) : "replacement"
  const replacing = wrapFetch(async (input, init) => {
    assert.equal(input.url, "https://after.invalid/api/v1/chat")
    assert.equal(input.redirect, "error")
    assert.equal(await new Request(input, init).text(), "replacement")
    return new Response("ok")
  }, "https://before.invalid/v1", async () => ({ baseURL: "https://after.invalid/api/v1" }))
  await replacing(used, { body, redirect: "error" })
}

const cancelled = new AbortController()
const noDispatch = wrapFetch(() => { throw new Error("Cancelled requests must not dispatch") }, "https://same.invalid", async () => { cancelled.abort(); return {} })
await assert.rejects(noDispatch("https://same.invalid/chat", { signal: cancelled.signal }), { name: "AbortError" })
console.log("Node Request OK: stream, init overrides, credentials, proxy options and cancellation")
