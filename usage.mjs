import { createHash } from "node:crypto"
import { BASE, numberOf, isoOf, record, sharedTask, jsonResponse } from "./http.mjs"
import { words } from "./words.mjs"

const percent = (amount, limit) => limit === 0 ? 100 : amount === undefined || limit === undefined ? undefined : Math.min(100, Math.max(0, amount / limit * 100))
const money = (v, text) => v === undefined ? text.unknown : `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 6 })}`
const count = (v) => { const n = numberOf(v); return n !== undefined && Number.isInteger(n) ? n : undefined }
const defined = (v) => Object.fromEntries(Object.entries(v).filter(([, value]) => value !== undefined))

export function creditsOf(body) {
  // /credits uses a top-level object, unlike /limits.data.
  if (body?.object !== "credits" || !["free", "paid", "suspended"].includes(body.plan))
    throw new Error("Coarena credits response is missing its plan")
  return body
}

export function usageOf(body, language = "zh", credits) {
  if (!body?.data || typeof body.data !== "object" || Array.isArray(body.data)) throw new Error("Coarena limits response is missing data")
  const text = words(language)
  if (credits) creditsOf(credits)
  if (credits?.plan === "suspended") return { error: text.advice.billingSuspended, signIn: "kept", windows: [] }
  const d = body.data
  const today = record(d.today)
  const limit = numberOf(d.usd_per_day) ?? (credits?.plan === "free" ? numberOf(credits.free_daily_usd) : undefined)
  const spent = numberOf(today.used_usd)
  const held = numberOf(today.held_usd)
  let amount = spent !== undefined && held !== undefined && Number.isFinite(spent + held) ? spent + held : undefined
  let left = numberOf(today.left_usd)
  if (amount === undefined && limit > 0 && left !== undefined) amount = Math.max(0, limit - left)
  if (left === undefined && limit !== undefined && amount !== undefined) left = Math.max(0, limit - amount)
  const resetsAt = isoOf(today.resets_at)
  const windows = [defined({
    name: text.daily, amount, limit, used: percent(amount, limit), unit: "USD", span: 86_400, resetsAt,
    display: `${text.used} ${money(spent, text)} · ${text.held} ${money(held, text)} · ${text.left} ${money(left, text)} / ${money(limit, text)}${limit === 0 ? ` · ${text.unavailable}` : ""}`,
  })]
  if (credits?.plan === "paid") {
    const balance = numberOf(credits.balance_usd)
    const reserved = numberOf(credits.held_usd)
    // available_usd is authoritative; never subtract held twice or infer missing funds.
    const available = numberOf(credits.available_usd)
    windows[0] = defined({ name: text.credits, balance: available, unit: "USD",
      display: `${text.balance} ${money(balance, text)} · ${text.held} ${money(reserved, text)} · ${text.available} ${money(available, text)} · ${text.noDailyLimit}`,
    })
  }
  const requestLimit = count(d.requests_per_day)
  if (requestLimit !== undefined) {
    const requests = count(today.requests)
    const requestsLeft = count(today.requests_left) ?? (requests !== undefined ? Math.max(0, requestLimit - requests) : undefined)
    windows.push(defined({
      name: text.requests, amount: requests, limit: requestLimit, used: percent(requests, requestLimit), unit: text.requestUnit, span: 86_400, resetsAt,
      display: `${text.used} ${requests ?? text.unknown} · ${text.left} ${requestsLeft ?? text.unknown} / ${requestLimit}`,
    }))
  }
  const rate = [
    ["requests_per_minute_key", text.keyRate], ["requests_per_minute_account", text.accountRate],
    ["requests_per_minute_model", text.modelRate], ["concurrency", text.concurrency],
  ].flatMap(([key, label]) => count(d[key]) === undefined ? [] : [`${count(d[key])} ${label}`])
  if (rate.length) windows.push({ name: text.rate, display: rate.join(" · "), aside: true })
  if (["pending", "granted", "declined", "withdrawn"].includes(d.request?.status))
    windows.push({ name: text.request, display: `${text.requestStatus}${text.statuses[d.request.status]}`, aside: true })
  return defined({
    ...(credits?.plan === "paid" ? { balance: money(numberOf(credits.available_usd), text) } : {}),
    plan: credits?.plan === "paid" ? text.paid : d.source === "default" ? text.free : d.source === "granted" ? text.granted : text.plan,
    until: credits?.plan === "paid" ? undefined : isoOf(d.granted_until), windows,
  })
}

const EXPIRED = new Set(["invalid_api_key", "api_key_revoked", "api_key_expired", "revoked", "expired"])
const advice = (status, code, text) => {
  if (status === 401 && EXPIRED.has(code)) return text.advice.expired
  if (code === "conflicting_credentials") return text.advice.conflicting
  if (code === "insufficient_scope") return text.advice.scope
  if (code === "account_blocked" || code === "account_withdrawn") return text.advice.account
  if (code === "payment_required") return text.advice.payment
  if (code === "insufficient_balance") return text.advice.balance
  if (code === "billing_suspended") return text.advice.billingSuspended
  if (code === "insufficient_quota") return text.advice.quota
  if (status === 429) return text.advice.rate
  if (status >= 500 || code === "api_keys_disabled") return text.advice.unavailable
  if (status === 401) return text.advice.auth
  return text.advice.other
}
function safeText(v, key) {
  if (typeof v !== "string") return ""
  let text = key ? v.split(key).join("[redacted]") : v
  text = text.replace(/Bearer\s+[^\s,;"']+/gi, "Bearer [redacted]").replace(/\bcoa_[\w.-]+/g, "[redacted]")
  text = text.replace(/((?:authorization|x-api-key|api_key)\s*[:=]\s*)[^\s,;"']+/gi, "$1[redacted]")
  return text.replace(/[\u0000-\u001f\u007f]/g, " ").slice(0, 400)
}
async function failureOf(res, key) {
  let body = {}
  try { body = record(await res.json()) } catch {}
  const err = record(body.error)
  return {
    status: res.status, code: safeText(err.code ?? err.type, key), message: safeText(err.message, key),
    requestID: safeText(res.headers.get("x-coarena-request-id") ?? res.headers.get("x-request-id") ?? res.headers.get("request-id") ?? body.request_id, key),
    retry: safeText(res.headers.get("retry-after"), key), reset: isoOf(err.resets_at),
  }
}
function showFailure({ status, code, message, requestID, retry, reset }, language) {
  const text = words(language)
  return {
    error: [`Coarena HTTP ${status}${code ? ` (${code})` : ""}`, message, advice(status, code, text), requestID && `${text.requestID}: ${requestID}`, retry && `${text.retry}: ${retry}`, reset && `${text.reset}: ${reset}`].filter(Boolean).join(" · "),
    signIn: status === 401 && EXPIRED.has(code) ? "expired" : "kept", windows: [],
  }
}
export async function errorOf(res, key, language = "zh") { return showFailure(await failureOf(res, key), language) }
export function readError(error, language = "zh") {
  const text = words(language)
  const message = error?.name === "AbortError" ? text.cancelled : error?.name === "TimeoutError" ? text.timedOut : text.readFailed
  return { error: `Coarena ${message}`, signIn: "kept", windows: [] }
}

export function keyOf(auth) { return auth?.type === "api" && typeof auth.key === "string" ? auth.key.trim() : "" }

export function createUsage({ fetchImpl, now, timeoutMs, language = () => "zh" }) {
  const cache = new Map()
  const pending = new Map()
  return async (getAuth, _provider, { signal } = {}) => {
    const key = keyOf(await getAuth())
    if (!key) return {}
    const locale = language()
    if (signal?.aborted) return readError({ name: "AbortError" }, locale)
    const id = createHash("sha256").update(key).digest("hex")
    const hit = cache.get(id)
    if (hit && now() < hit.until) return usageOf(hit.body, locale, hit.credits)
    let task = pending.get(id)
    if (!task || task.cancelled) {
      task = sharedTask(async (readSignal) => {
        const res = await fetchImpl(`${BASE}/limits`, {
          headers: { accept: "application/json", authorization: `Bearer ${key}` }, signal: readSignal, redirect: "error",
        })
        if (!res.ok) return { failure: await failureOf(res, key) }
        const body = await jsonResponse(res)
        const creditRes = await fetchImpl(`${BASE}/credits`, {
          headers: { accept: "application/json", authorization: `Bearer ${key}` }, signal: readSignal, redirect: "error",
        })
        if (!creditRes.ok) return { failure: await failureOf(creditRes, key) }
        const credits = creditsOf(await jsonResponse(creditRes))
        usageOf(body, "zh", credits) // Validate before a response can enter the account cache.
        return { body, credits }
      }, timeoutMs)
      pending.set(id, task)
      task.promise.then((value) => {
        if (pending.get(id) !== task) return
        if (!value.failure) {
          for (const [digest, entry] of cache) if (entry.until <= now()) cache.delete(digest)
          // Bounded memory; eviction only forces a fresh explicit read.
          if (cache.size >= 128) cache.delete(cache.keys().next().value)
          cache.set(id, { until: now() + 30_000, body: value.body, credits: value.credits })
        } else cache.delete(id)
      }, () => {}).finally(() => { if (pending.get(id) === task) pending.delete(id) })
    }
    try {
      const value = await task.wait(signal)
      return value.failure ? showFailure(value.failure, locale) : usageOf(value.body, locale, value.credits)
    } catch (error) { return readError(signal?.aborted ? { name: "AbortError" } : error, locale) }
  }
}
