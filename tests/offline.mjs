// All default tests use injected fetches or synthetic loopback HTTP, never remote APIs.
const originalFetch = globalThis.fetch
Object.defineProperty(globalThis, "fetch", {
  configurable: true, writable: true,
  value(input, init) {
    const url = new URL(input instanceof Request ? input.url : input)
    if (url.protocol !== "http:" || url.hostname !== "127.0.0.1")
      throw new Error("Offline tests forbid external network requests")
    return originalFetch(input, init)
  },
})
