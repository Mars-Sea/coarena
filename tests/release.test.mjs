import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { releaseOf } from "../scripts/check-release.mjs"

const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"))
const lock = JSON.parse(readFileSync(new URL("../package-lock.json", import.meta.url), "utf8"))
const context = { repository: "Mars-Sea/coarena", event: "release", tag: `v${pkg.version}`, draft: false, prerelease: false }

describe("trusted release boundaries", () => {
  test("a matching stable release is eligible, while manual runs never publish", () => {
    expect(releaseOf(pkg, lock, context)).toEqual({ name: "coarena", version: pkg.version, publish: true })
    expect(releaseOf(pkg, lock, { ...context, event: "workflow_dispatch" }).publish).toBe(false)
  })
  test.each([
    ["fork identity", { repository: "somebody/coarena" }],
    ["tag/package mismatch", { tag: "v99.0.0" }],
    ["tag containing shell syntax", { tag: "v0.1.0; echo unexpected" }],
    ["draft release", { draft: true }],
    ["prerelease", { prerelease: true }],
    ["push event", { event: "push" }],
    ["pull request event", { event: "pull_request" }],
  ])("rejects %s before publishing", (_, changes) => {
    expect(() => releaseOf(pkg, lock, { ...context, ...changes })).toThrow()
  })
  test("mismatched lockfiles and repository metadata fail closed", () => {
    for (const change of ["lock version", "root version", "repository", "name", "prerelease version"]) {
      const candidate = structuredClone(pkg)
      const pinned = structuredClone(lock)
      if (change === "lock version") pinned.version = "99.0.0"
      if (change === "root version") pinned.packages[""].version = "99.0.0"
      if (change === "repository") candidate.repository.url = "git+https://github.com/elsewhere/coarena.git"
      if (change === "name") candidate.name = "elsewhere"
      if (change === "prerelease version") candidate.version += "-preview.0"
      expect(() => releaseOf(candidate, pinned, context)).toThrow()
    }
  })
})
