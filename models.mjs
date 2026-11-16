import { BASE, SDK, FELL_BACK, numberOf, isoOf, record, sharedTask, jsonResponse } from "./http.mjs"

import { readFileSync } from "node:fs"

// The public catalog currently omits eligibility and quotes zero for paid models too.
const freeModels = new Set(JSON.parse(readFileSync(new URL("./free-tier.json", import.meta.url), "utf8")).models)

const tokenOf = (v) => { const n = numberOf(v); return n === undefined ? undefined : Math.trunc(n) }
const modalities = (image = false) => ({ text: true, image, audio: false, video: false, pdf: false })

export function normalizeModels(body, now = Date.now()) {
  if (!Array.isArray(body?.data)) throw new Error("Coarena model directory is missing its data array")
  const entries = new Map()
  for (const m of body.data) {
    if (typeof m?.id !== "string" || !m.id || /\s|[\u0000-\u001f\u007f]/u.test(m.id))
      throw new Error("Coarena model directory contains an invalid model ID")
    const retires = isoOf(m.retires_at)
    if (m.lifecycle === "retired" || (retires && Date.parse(retires) <= now)) {
      entries.set(m.id, null)
      continue
    }
    const caps = record(m.capabilities)
    const input = tokenOf(m.max_input_tokens)
    const cost = {}
    // Only a known zero has a unit-independent meaning. Nonzero price units
    // and cache prices are not specified by the current public API.
    if (numberOf(m.pricing?.prompt) === 0) cost.input = 0
    if (numberOf(m.pricing?.completion) === 0) cost.output = 0
    const release = isoOf(m.created_at)
    entries.set(m.id, {
      id: m.id,
      free: typeof m.free === "boolean" ? m.free : freeModels.has(m.id),
      name: typeof m.display_name === "string" && m.display_name.trim() ? m.display_name : m.id,
      status: m.lifecycle === "deprecated" || isoOf(m.deprecated_at) ? "deprecated" : "active",
      limit: { context: tokenOf(m.context_length) ?? input ?? 0, ...(input !== undefined ? { input } : {}), output: tokenOf(m.max_completion_tokens) ?? tokenOf(m.max_tokens) ?? 0 },
      image: caps.vision === true,
      tools: caps.tools === true,
      reasoning: caps.reasoning_text === true,
      efforts: [...new Set(Array.isArray(caps.efforts) ? caps.efforts.filter((v) => typeof v === "string" && v.length > 0) : [])],
      cost,
      ...(release ? { release_date: release.slice(0, 10) } : {}),
    })
  }
  return Object.fromEntries([...entries].filter(([, m]) => m !== null))
}

export function toConfigModel(m) {
  return {
    id: m.id, name: m.name, status: m.status, free: m.free === true,
    provider: { npm: SDK, api: BASE },
    reasoning: m.reasoning, attachment: m.image, tool_call: m.tools,
    temperature: false,
    modalities: { input: m.image ? ["text", "image"] : ["text"], output: ["text"] },
    limit: { ...m.limit }, cost: { ...m.cost },
    ...(m.release_date ? { release_date: m.release_date } : {}),
    // Efforts remain metadata until host-to-wire serialization is verified.
    variants: {},
  }
}

export function toRuntimeModel(m) {
  return {
    id: m.id, name: m.name, providerID: "coarena", status: m.status, free: m.free === true,
    api: { id: m.id, url: BASE, npm: SDK }, headers: {}, options: {},
    limit: { ...m.limit },
    cost: { ...m.cost, cache: { read: 0, write: 0 } }, // host unknown-price defaults
    capabilities: {
      temperature: false, reasoning: m.reasoning, attachment: m.image, toolcall: m.tools,
      input: modalities(m.image), output: modalities(), interleaved: false,
      efforts: [...m.efforts],
    },
    ...(m.release_date ? { release_date: m.release_date } : {}), variants: {},
  }
}
export const configModels = (models) => Object.fromEntries(Object.entries(models).map(([id, m]) => [id, toConfigModel(m)]))
export const runtimeModels = (models) => Object.fromEntries(Object.entries(models).map(([id, m]) => [id, toRuntimeModel(m)]))

export function createCatalog({ fetchImpl, now, bootstrap, timeoutMs }) {
  let lastGood = null
  let validUntil = 0
  let retryAt = 0
  let pending = null
  const fallback = () => {
    const map = runtimeModels(lastGood ?? bootstrap)
    Object.defineProperty(map, FELL_BACK, { value: true })
    return map
  }
  return async (_provider, { signal } = {}) => {
    signal?.throwIfAborted()
    if (lastGood !== null && now() < validUntil) return runtimeModels(lastGood)
    if (now() < retryAt) return fallback()
    if (!pending || pending.cancelled) {
      const task = sharedTask(async (readSignal) => {
        const res = await fetchImpl(`${BASE}/models`, { headers: { accept: "application/json" }, signal: readSignal, redirect: "error" })
        if (!res.ok) throw new Error(`Coarena model directory HTTP ${res.status}`)
        const body = await jsonResponse(res)
        const models = normalizeModels(body, now())
        if (body.has_more === true) console.warn("Coarena model directory is incomplete (has_more=true); pagination requires a documented API.")
        return models
      }, timeoutMs)
      pending = task
      task.promise.then((models) => {
        if (pending !== task) return
        lastGood = models
        validUntil = now() + 300_000
        retryAt = 0
        pending = null
      }, (error) => {
        if (pending !== task) return
        pending = null
        if (error?.name !== "AbortError") {
          retryAt = now() + 15_000
          // Never include response bodies, credentials or user data.
          console.warn(error?.name === "TimeoutError" ? "Coarena model directory timed out; using fallback." : "Coarena model directory could not be read; using fallback.")
        }
      })
    }
    try { return runtimeModels(await pending.wait(signal)) }
    catch (error) {
      if (signal?.aborted) throw signal.reason
      if (error?.name === "AbortError") throw error
      return fallback()
    }
  }
}
