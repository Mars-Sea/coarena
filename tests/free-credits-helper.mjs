import { _internal } from "../index.mjs"
export const freeCredits = { object: "credits", plan: "free", balance_usd: 0, held_usd: 0, available_usd: 0, free_daily_usd: 5 }
export function createDailyPlugin({ fetchImpl, ...options } = {}) {
  return _internal.createPlugin({ ...options, fetchImpl: (url, init) => url.endsWith("/credits") ? Response.json(freeCredits) : fetchImpl(url, init) })
}
