Add the independently maintained **Coarena** provider to the plugin registry.

- Source: https://github.com/Mars-Sea/coarena
- npm: https://www.npmjs.com/package/coarena (`0.1.0`; publish and verify before submitting this draft)
- Provider ID: `coarena`
- Authentication: a Coarena API key stored by the host.
- Public model discovery, Chat Completions, tool/image capability mapping, and daily USD/request usage with per-account caches.
- Usage cards default to Simplified Chinese, with an English option. The package and provider use the same embedded official SVG icon.
- Separate Magpie/OpenCode 1 main entry and OpenCode 2 default setup entry; ESM with no production dependencies.

The registry change appends one provider entry with English/Chinese summaries and the package icon. It does not request a community badge or replace a built-in subscription.

Validation:

- 68 offline tests pass, including the actual OpenAI-compatible SDK against a local synthetic HTTP server for Chat, SSE, tools, images and cancellation.
- Node 22 and 24 CI passes: https://github.com/Mars-Sea/coarena/actions/runs/43553589358
- The actual 12-file tarball loads both entries without node_modules or network, including model bootstrap, icons and language selection.
- The appended registry passes upstream `registryProblems`; existing entries are preserved.
- Real Coarena inference, protected limits and Magpie/OpenCode end-to-end acceptance remain unverified. Scope and evidence: https://github.com/Mars-Sea/coarena/blob/main/docs/VALIDATION.md

The README discloses Coarena's prompt/response retention, including requests with `store:false`. The official icon and API metadata retain their original rights; MIT covers the plugin implementation and attributed adapter.
