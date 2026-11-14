import { readFileSync, writeFileSync } from "node:fs"
import { normalizeModels } from "../models.mjs"

// Deliberately uses the checked-in public snapshot, never the network.
const snapshot = JSON.parse(readFileSync(new URL("../docs/reference/coarena/models.json", import.meta.url), "utf8"))
const generated = {
  source: "https://coarena.ai/api/v1/models",
  capturedAt: "2026-11-14",
  notice: "Public API metadata; rights remain with the original rights holders. This is a dated fallback, not a live catalog.",
  models: normalizeModels(snapshot, Date.parse("2026-11-14T00:00:00Z")),
}
writeFileSync(new URL("../models.bootstrap.json", import.meta.url), `${JSON.stringify(generated, null, 2)}\n`)
console.log(`Generated bootstrap: ${Object.keys(generated.models).length} models from the public snapshot`)
