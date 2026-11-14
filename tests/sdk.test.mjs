import { test, expect } from "bun:test"
import { createServer } from "node:http"
import { createOpenAICompatible } from "@ai-sdk/openai-compatible"
import { _internal } from "../index.mjs"
import { wrapFetch } from "../opencode2.mjs"

const prompt = [{ role: "user", content: [{ type: "text", text: "synthetic hello" }] }]
const defer = () => { let resolve; const promise = new Promise((r) => { resolve = r }); return { promise, resolve } }
const completion = (message) => ({ id: "synthetic-completion", object: "chat.completion", created: 1, model: "synthetic", choices: [{ index: 0, message: { role: "assistant", ...message }, finish_reason: "stop" }], usage: { prompt_tokens: 10, completion_tokens: 2, total_tokens: 12 } })
const chunk = (delta, finish_reason = null) => ({ id: "synthetic-stream", object: "chat.completion.chunk", created: 1, model: "synthetic", choices: [{ index: 0, delta, finish_reason }] })
const sse = (res, data) => res.write(`data: ${JSON.stringify(data)}\n\n`)

async function localServer(handler, run) {
  const requests = []
  let failure
  const server = createServer(async (req, res) => {
    try {
      let raw = ""
      for await (const part of req) raw += part.toString()
      const body = JSON.parse(raw)
      requests.push({ url: req.url, headers: req.headers, body })
      await handler(req, res, body, requests.length)
    } catch (error) { failure = error; res.writeHead(500); res.end("synthetic test failure") }
  })
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve))
  const baseURL = `http://127.0.0.1:${server.address().port}/api/v1`
  const plugin = _internal.createPlugin({ fetchImpl: () => { throw new Error("no auxiliary API expected") } })
  const loader = await plugin.auth.loader(async () => ({ type: "api", key: "synthetic-sdk-key" }))
  expect(loader.baseURL).toBe(_internal.BASE)
  expect(loader.fetch).toBeUndefined()
  const guarded = (input, init) => {
    const url = typeof input === "string" ? input : input.url
    if (!url.startsWith(`${baseURL}/`)) throw new Error("Tests only allow loopback requests")
    return fetch(input, init)
  }
  // Exercise the v2 request bridge as well as the real Chat SDK.
  const wrapped = wrapFetch(guarded, baseURL, async () => ({ key: loader.apiKey }))
  const sdk = createOpenAICompatible({ name: "coarena", baseURL, apiKey: "opencode2-v1-key", fetch: wrapped })
  try { await run(sdk, requests); if (failure) throw failure }
  finally { server.closeAllConnections?.(); await new Promise((r) => server.close(r)) }
}

test("real Chat SDK ordinary response and image/effort serialization through v2 bridge", async () => {
  await localServer((_req, res) => { res.setHeader("content-type", "application/json"); res.end(JSON.stringify(completion({ content: "synthetic reply", reasoning_content: "synthetic reasoning" }))) }, async (sdk, requests) => {
    const result = await sdk.chatModel("canonical-synthetic").doGenerate({
      prompt: [{ role: "user", content: [prompt[0].content[0], { type: "file", mediaType: "image/png", data: new Uint8Array([137, 80, 78, 71]) }] }],
      providerOptions: { coarena: { reasoningEffort: "high" } },
    })
    expect(result.content).toContainEqual({ type: "text", text: "synthetic reply" })
    expect(result.content).toContainEqual({ type: "reasoning", text: "synthetic reasoning" })
    expect(requests.length).toBe(1)
    const request = requests[0]
    expect(request.url).toBe("/api/v1/chat/completions")
    expect(request.headers.authorization).toBe("Bearer synthetic-sdk-key")
    expect(request.body.model).toBe("canonical-synthetic")
    expect(request.body.reasoning_effort).toBe("high")
    expect(request.body.messages[0].content[1]).toMatchObject({ type: "image_url", image_url: { url: "data:image/png;base64,iVBORw==" } })
  })
})

test("real SDK SSE emits first text before server closes and preserves final usage", async () => {
  const finish = defer(); let ended = false
  await localServer(async (_req, res) => {
    res.writeHead(200, { "content-type": "text/event-stream" })
    sse(res, chunk({ role: "assistant", content: "first" }))
    await finish.promise
    sse(res, chunk({ content: " second" }))
    sse(res, { ...chunk({}, "stop"), usage: { prompt_tokens: 10, completion_tokens: 2, total_tokens: 12 } })
    ended = true; res.end("data: [DONE]\n\n")
  }, async (sdk) => {
    const { stream } = await sdk.chatModel("synthetic-stream").doStream({ prompt })
    const reader = stream.getReader(); const parts = []
    try {
      for (;;) {
        const { value, done } = await reader.read()
        if (done) break
        parts.push(value)
        if (value.type === "text-delta") {
          expect(value.delta).toBe("first")
          expect(ended).toBe(false)
          finish.resolve(); break
        }
      }
      for (;;) { const { value, done } = await reader.read(); if (done) break; parts.push(value) }
      expect(parts.filter((p) => p.type === "text-delta").map((p) => p.delta).join("")).toBe("first second")
      expect(parts.find((p) => p.type === "finish").usage.outputTokens.total).toBe(2)
    } finally { finish.resolve(); reader.releaseLock() }
  })
})

test("fragmented tool arguments and tool_call_id survive a second actual SDK round", async () => {
  await localServer((_req, res, _body, n) => {
    if (n === 1) {
      res.writeHead(200, { "content-type": "text/event-stream" })
      sse(res, chunk({ tool_calls: [{ index: 0, id: "call_synthetic", type: "function", function: { name: "lookup", arguments: '{"city":' } }] }))
      sse(res, chunk({ tool_calls: [{ index: 0, function: { arguments: '"test"}' } }] }))
      sse(res, chunk({}, "tool_calls")); res.end("data: [DONE]\n\n")
    } else { res.setHeader("content-type", "application/json"); res.end(JSON.stringify(completion({ content: "lookup complete" }))) }
  }, async (sdk, requests) => {
    const model = sdk.chatModel("synthetic-tools")
    const first = await model.doStream({ prompt, tools: [{ type: "function", name: "lookup", description: "Synthetic lookup", inputSchema: { type: "object", properties: { city: { type: "string" } }, required: ["city"] } }] })
    const parts = []; for await (const part of first.stream) parts.push(part)
    const call = parts.find((p) => p.type === "tool-call")
    expect(call).toMatchObject({ toolCallId: "call_synthetic", toolName: "lookup", input: '{"city":"test"}' })
    const second = await model.doGenerate({ prompt: [
      ...prompt,
      { role: "assistant", content: [{ type: "tool-call", toolCallId: call.toolCallId, toolName: call.toolName, input: JSON.parse(call.input) }] },
      { role: "tool", content: [{ type: "tool-result", toolCallId: call.toolCallId, toolName: call.toolName, output: { type: "text", value: "synthetic result" } }] },
    ] })
    expect(second.content).toContainEqual({ type: "text", text: "lookup complete" })
    expect(requests.length).toBe(2)
    expect(requests[1].body.messages[1].tool_calls[0].id).toBe("call_synthetic")
    expect(requests[1].body.messages[1].tool_calls[0].function.arguments).toBe('{"city":"test"}')
    expect(requests[1].body.messages[2]).toEqual({ role: "tool", tool_call_id: "call_synthetic", content: "synthetic result" })
  })
})

test("SDK abort closes downstream stream with no replay", async () => {
  const closed = defer()
  await localServer((_req, res) => {
    res.on("close", () => closed.resolve())
    res.writeHead(200, { "content-type": "text/event-stream" })
    sse(res, chunk({ content: "start" }))
  }, async (sdk, requests) => {
    const controller = new AbortController()
    const result = await sdk.chatModel("synthetic-cancel").doStream({ prompt, abortSignal: controller.signal })
    const reader = result.stream.getReader()
    for (;;) { const { value, done } = await reader.read(); if (done || value.type === "text-delta") break }
    controller.abort()
    try { while (!(await reader.read()).done) {} } catch (error) { expect(error.name).toBe("AbortError") }
    await Promise.race([closed.promise, new Promise((_, reject) => { const timer = setTimeout(() => reject(new Error("downstream did not close")), 1000); timer.unref?.(); closed.promise.then(() => clearTimeout(timer)) })])
    expect(requests.length).toBe(1)
    reader.releaseLock()
  })
})

test("SDK preserves inference HTTP status and upstream error without plugin retry", async () => {
  await localServer((_req, res) => { res.writeHead(429, { "content-type": "application/json", "retry-after": "30" }); res.end(JSON.stringify({ error: { code: "insufficient_quota", message: "synthetic allowance exhausted" } })) }, async (sdk, requests) => {
    try { await sdk.chatModel("synthetic-quota").doGenerate({ prompt }); throw new Error("expected upstream error") }
    catch (error) { expect(error.statusCode).toBe(429); expect(error.message).toBe("synthetic allowance exhausted"); expect(error.responseHeaders["retry-after"]).toBe("30") }
    expect(requests.length).toBe(1)
  })
})
