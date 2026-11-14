import assert from "node:assert/strict"
import { readFileSync, existsSync } from "node:fs"

const root = new URL("../", import.meta.url)
const pkg = JSON.parse(readFileSync(new URL("package.json", root), "utf8"))
assert.equal(pkg.name, "coarena")
assert.equal(pkg.magpie.name, "Coarena")
assert.equal(pkg.type, "module")
assert.equal(pkg.main, "./opencode.mjs")
assert.equal(pkg.exports["."], "./opencode2.mjs")
assert.equal(Object.keys(pkg.dependencies ?? {}).length, 0, "runtime must have no production dependencies")
const files = new Set([...pkg.files, "package.json"])
const originalFetch = globalThis.fetch
globalThis.fetch = () => { throw new Error("Network forbidden during structure check") }
try {
  const v1 = await import(new URL(pkg.main, root))
  assert.deepEqual(Object.keys(v1), ["CoarenaPlugin"])
  assert.equal(typeof v1.CoarenaPlugin, "function")
  const hooks = await v1.CoarenaPlugin({ client: {}, directory: process.cwd() })
  assert.equal(hooks.auth.provider, "coarena")
  assert.equal(hooks.provider.id, "coarena")
  assert.equal(typeof hooks.provider.models, "function")
  assert.equal(typeof hooks.auth.usage, "function")
  assert.deepEqual(hooks.auth.methods, [{ type: "api", label: "Coarena API key", labels: { zh: "Coarena API 密钥", "zh-TW": "Coarena API 金鑰" }, placeholder: "coa_…" }])
  assert.equal(hooks.auth.icon, `data:image/svg+xml;base64,${readFileSync(new URL("assets/coarena.svg", root)).toString("base64")}`)
  assert.equal(pkg.magpie.icon, hooks.auth.icon, "plugin list/detail and provider icons must match")
  assert.ok(pkg.magpie.icon.length <= (3 << 19), "plugin icon must fit Magpie ownIcon bounds")
  assert.ok(files.has("assets/coarena.svg"))
  assert.equal(hooks.auth.options[0].key, "english_usage")
  assert.equal(hooks.auth.options[0].default, false)
  const cfg = {}
  await hooks.config(cfg)
  assert.equal(cfg.provider.coarena.name, "Coarena")
  assert.equal(cfg.provider.coarena.npm, "@ai-sdk/openai-compatible")
  assert.equal(cfg.provider.coarena.api, "https://coarena.ai/api/v1")
  assert.ok(Object.keys(cfg.provider.coarena.models).length > 0)
  const custom = { provider: { coarena: { name: "User value", models: {} } } }
  const existing = custom.provider.coarena
  await hooks.config(custom)
  assert.equal(custom.provider.coarena, existing)
  assert.deepEqual(await hooks.auth.loader(async () => null), {})
  assert.deepEqual(await hooks.auth.usage(async () => null), {})
  const v2 = (await import(new URL(pkg.exports["."], root))).default
  assert.equal(v2.id, pkg.name)
  assert.equal(typeof v2.setup, "function")
  for (const file of files) {
    assert.ok(existsSync(new URL(file, root)), `Missing packed file: ${file}`)
    assert.ok(!file.startsWith("docs/") && !file.startsWith("tests/") && !file.startsWith(".env"))
    if (!file.endsWith(".mjs")) continue
    const source = readFileSync(new URL(file, root), "utf8")
    assert.ok(!source.includes("/Users/"), `Absolute runtime path in ${file}`)
    for (const [, dependency] of source.matchAll(/(?:from\s*|import\s*\()\s*["'](\.[^"']+)["']/g)) {
      const resolved = new URL(dependency, new URL(file, root))
      assert.ok(files.has(resolved.pathname.slice(root.pathname.length)), `${file} imports unpacked ${dependency}`)
    }
  }
  console.log(`Structure OK: both entries, coarena hooks, offline config, ${files.size} packed files`)
} finally { globalThis.fetch = originalFetch }
