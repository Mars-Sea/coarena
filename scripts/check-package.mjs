import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { mkdtempSync, mkdirSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

const root = fileURLToPath(new URL("../", import.meta.url))
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"))
const temp = mkdtempSync(join(tmpdir(), "coarena-package-"))
try {
  const result = JSON.parse(execFileSync("npm", ["pack", "--ignore-scripts", "--json", "--pack-destination", temp], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }))
  const pack = Array.isArray(result) ? result[0] : result.files ? result : Object.values(result)[0]
  assert.equal(pack.name, pkg.name)
  assert.equal(pack.version, pkg.version)
  assert.deepEqual(pack.files.map(file => file.path).sort(), [...pkg.files, "package.json"].sort())
  assert.deepEqual(pack.bundled, [])
  const unpacked = join(temp, "unpacked")
  mkdirSync(unpacked)
  execFileSync("tar", ["-xzf", join(temp, pack.filename), "-C", unpacked])
  execFileSync(process.execPath, ["--input-type=module", "-", join(unpacked, "package")], {
    cwd: temp,
    stdio: ["pipe", "inherit", "inherit"],
    input: String.raw`
      import assert from "node:assert/strict"
      import { readFileSync } from "node:fs"
      import { pathToFileURL } from "node:url"
      globalThis.fetch = () => { throw new Error("Network forbidden in packed package smoke check") }
      const root = pathToFileURL(process.argv[2] + "/")
      const pkg = JSON.parse(readFileSync(new URL("package.json", root), "utf8"))
      assert.equal(pkg.name, "coarena")
      assert.equal(pkg.magpie.name, "Coarena")
      assert.equal(Object.keys(pkg.dependencies ?? {}).length, 0)
      const icon = "data:image/svg+xml;base64," + readFileSync(new URL("assets/coarena.svg", root)).toString("base64")
      assert.equal(pkg.magpie.icon, icon)
      assert.ok(icon.length <= (3 << 19))
      const main = await import(new URL(pkg.main, root))
      assert.deepEqual(Object.keys(main), ["CoarenaPlugin"])
      let english = false
      const hooks = await main.CoarenaPlugin({ magpie: { option: () => english } })
      assert.equal(hooks.auth.provider, "coarena")
      assert.equal(hooks.auth.icon, icon)
      const cfg = {}
      await hooks.config(cfg)
      assert.equal(cfg.provider.coarena.name, "Coarena")
      assert.ok(Object.keys(cfg.provider.coarena.models).length > 0)
      assert.deepEqual(await hooks.auth.loader(async () => null), {})
      const controller = new AbortController()
      controller.abort()
      const usage = () => hooks.auth.usage(async () => ({ type: "api", key: "synthetic-package-check" }), {}, { signal: controller.signal })
      assert.match((await usage()).error, /额度读取已取消/)
      english = true
      assert.match((await usage()).error, /read cancelled/)
      const v2 = (await import(new URL(pkg.exports["."], root))).default
      assert.equal(v2.id, "coarena")
      assert.equal(typeof v2.setup, "function")
    `,
  })
  console.log(`Packed ${pkg.name}@${pkg.version} OK: ${pack.files.length} files, both entries, icons and languages; no node_modules or network`)
} finally {
  rmSync(temp, { recursive: true, force: true })
}
