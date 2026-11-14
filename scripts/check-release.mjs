import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { pathToFileURL } from "node:url"

export function releaseOf(pkg, lock, { repository, event, tag, draft = false, prerelease = false }) {
  assert.equal(repository, "Mars-Sea/coarena", "Only Mars-Sea/coarena can publish this package")
  assert.equal(pkg.name, "coarena", "Unexpected npm package name")
  assert.equal(pkg.repository?.url, "git+https://github.com/Mars-Sea/coarena.git", "Repository metadata must match the OIDC repository")
  assert.match(pkg.version, /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/, "Publish stable semantic versions only")
  assert.equal(lock.name, pkg.name, "Lockfile package name differs")
  assert.equal(lock.version, pkg.version, "Lockfile version differs")
  assert.equal(lock.packages?.[""]?.name, pkg.name, "Lockfile root package name differs")
  assert.equal(lock.packages?.[""]?.version, pkg.version, "Lockfile root version differs")
  assert.ok(event === "release" || event === "workflow_dispatch", "Unsupported publishing event")
  if (event === "release") {
    assert.equal(draft, false, "Draft releases cannot publish")
    assert.equal(prerelease, false, "Prereleases cannot publish to latest")
    assert.equal(tag, `v${pkg.version}`, "GitHub release tag must match package.json version")
  }
  return { name: pkg.name, version: pkg.version, publish: event === "release" }
}

async function main() {
  const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"))
  const lock = JSON.parse(readFileSync(new URL("../package-lock.json", import.meta.url), "utf8"))
  const payload = process.env.GITHUB_EVENT_PATH ? JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, "utf8")) : {}
  const result = releaseOf(pkg, lock, {
    repository: process.env.GITHUB_REPOSITORY ?? "Mars-Sea/coarena",
    event: process.env.GITHUB_EVENT_NAME ?? "workflow_dispatch",
    tag: payload.release?.tag_name,
    draft: payload.release?.draft,
    prerelease: payload.release?.prerelease,
  })
  if (result.publish) {
    const response = await fetch(`https://registry.npmjs.org/${result.name}/${result.version}`, {
      headers: { "cache-control": "no-cache" }, signal: AbortSignal.timeout(15_000),
    })
    assert.equal(response.status, 404, response.ok ? "This npm version is already published" : `Registry version check failed: HTTP ${response.status}`)
  }
  console.log(`Release checks OK: ${result.name}@${result.version}; ${result.publish ? "new version eligible for publishing" : "manual dry-run only"}`)
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) await main()
