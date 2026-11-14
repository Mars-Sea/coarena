import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"
import { setTimeout } from "node:timers/promises"

const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"))
const commit = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim()
let failure
for (let attempt = 1; attempt <= 24; attempt++) {
  try {
    const response = await fetch(`https://registry.npmjs.org/${pkg.name}/${pkg.version}`, {
      headers: { "cache-control": "no-cache" }, signal: AbortSignal.timeout(15_000),
    })
    assert.ok(response.ok, `Public registry returned HTTP ${response.status}`)
    const metadata = await response.json()
    assert.equal(metadata.name, pkg.name)
    assert.equal(metadata.version, pkg.version)
    assert.equal(metadata.gitHead, commit, "Published source commit differs")
    assert.deepEqual(metadata.exports, pkg.exports)
    assert.equal(metadata.main, pkg.main)
    assert.deepEqual(metadata.magpie, pkg.magpie)
    assert.equal(Object.keys(metadata.dependencies ?? {}).length, 0)
    assert.equal(metadata.dist.fileCount, pkg.files.length + 1)
    assert.ok(metadata.dist.attestations?.url, "Provenance metadata is not available yet")
    assert.equal(new URL(metadata.dist.attestations.url).origin, "https://registry.npmjs.org")
    assert.equal(new URL(metadata.dist.tarball).origin, "https://registry.npmjs.org")
    const archive = await fetch(metadata.dist.tarball, { signal: AbortSignal.timeout(30_000) })
    assert.ok(archive.ok, `Tarball returned HTTP ${archive.status}`)
    const bytes = Buffer.from(await archive.arrayBuffer())
    assert.equal(createHash("sha1").update(bytes).digest("hex"), metadata.dist.shasum)
    assert.equal("sha512-" + createHash("sha512").update(bytes).digest("base64"), metadata.dist.integrity)
    console.log(`Public ${pkg.name}@${pkg.version} verified: source, entries, icons, 12 files, tarball hashes and provenance metadata`)
    process.exit(0)
  } catch (error) {
    failure = error
    if (attempt < 24) {
      console.log(`Waiting for public npm package/provenance (${attempt}/24): ${error.message}`)
      await setTimeout(5_000)
    }
  }
}
throw failure
