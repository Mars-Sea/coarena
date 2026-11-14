// Auxiliary GET requests only. Inference uses the host SDK and its own timeout.
export const BASE = "https://coarena.ai/api/v1"
export const SDK = "@ai-sdk/openai-compatible"
export const FELL_BACK = Symbol.for("magpie.fellBack")

export const record = (v) => v && typeof v === "object" && !Array.isArray(v) ? v : {}
export function numberOf(v) {
  if (typeof v !== "number" && (typeof v !== "string" || !/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(v))) return undefined
  const n = Number(v)
  return Number.isFinite(n) && n >= 0 ? n : undefined
}
export function isoOf(v) {
  if (typeof v !== "number" && (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(v))) return undefined
  const ms = typeof v === "number" ? v : Date.parse(v)
  if (!Number.isFinite(ms)) return undefined
  const date = new Date(ms)
  if (!Number.isFinite(date.getTime())) return undefined
  // Date.parse normalizes impossible calendar days; those are not valid ISO input.
  if (typeof v === "string") {
    const [year, month, day] = v.slice(0, 10).split("-").map(Number)
    const days = new Date(Date.UTC(year, month, 0)).getUTCDate()
    if (month < 1 || month > 12 || day < 1 || day > days) return undefined
  }
  return date.toISOString()
}

export function abortError() { return new DOMException("The operation was aborted", "AbortError") }

// A shared read has independent subscribers. Only the last cancellation aborts
// the network request. The timeout also covers body parsing, even in test fetches.
export function sharedTask(run, timeoutMs = 15_000) {
  const controller = new AbortController()
  let users = 0
  let settled = false
  let abortListener
  const aborted = new Promise((_, reject) => {
    abortListener = () => reject(controller.signal.reason)
    controller.signal.addEventListener("abort", abortListener, { once: true })
  })
  const timer = setTimeout(() => controller.abort(new DOMException("Coarena read timed out", "TimeoutError")), timeoutMs)
  const promise = Promise.race([Promise.resolve().then(() => run(controller.signal)), aborted]).finally(() => {
    settled = true
    clearTimeout(timer)
    controller.signal.removeEventListener("abort", abortListener)
  })
  promise.catch(() => {})
  return {
    promise,
    get cancelled() { return controller.signal.aborted },
    wait(signal) {
      if (signal?.aborted) return Promise.reject(signal.reason ?? abortError())
      users++
      return new Promise((resolve, reject) => {
        let finished = false
        const finish = (fn, value) => {
          if (finished) return
          finished = true
          signal?.removeEventListener("abort", cancel)
          users--
          fn(value)
          if (!settled && users === 0) controller.abort(abortError())
        }
        const cancel = () => finish(reject, signal.reason ?? abortError())
        signal?.addEventListener("abort", cancel, { once: true })
        promise.then((v) => finish(resolve, v), (e) => finish(reject, e))
      })
    },
  }
}

export async function jsonResponse(res) {
  try { return await res.json() }
  catch { throw new Error("Coarena returned invalid JSON") }
}
