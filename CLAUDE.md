## graphify

This project has a graphify knowledge graph at graphify-out/.

Rules:
- Before answering architecture or codebase questions, read graphify-out/GRAPH_REPORT.md for god nodes and community structure
- If graphify-out/wiki/index.md exists, navigate it instead of reading raw files
- For cross-module "how does X relate to Y" questions, prefer `graphify query "<question>"`, `graphify path "<A>" "<B>"`, or `graphify explain "<concept>"` over grep — these traverse the graph's EXTRACTED + INFERRED edges instead of scanning files
- After modifying code files in this session, run `graphify update .` to keep the graph current (AST-only, no API cost)

## SabFiles policy

Every file in SabNode lives in SabFiles. NEVER expose a free-text URL paste for files — file inputs source from `<SabFilePicker>` / `<SabFileUrlInput>` / `<SabFilePickerButton>` / `<SabFileToFileButton>` (all in `@/components/sabfiles`), which read from the user's library or upload fresh. The picker has only Library + Upload modes; do not re-add a "From URL" tab.

## SabWa engine

SabWa's personal-WhatsApp backend is **`services/sabwa-node/`** — a Node.js + Express + Baileys service on port 4001. The Next.js side talks to it through `src/lib/sabwa/engine-client.ts` with `SABWA_ENGINE_URL` + `SABWA_ENGINE_TOKEN`. PM2 app name: `sabwa-node`. Required env: `SABWA_JWT_SECRET`, `AUTH_STATE_KEY`. The previous Rust crate `services/sabwa-engine/` (with its Node sidecar) is deprecated — do not edit it; all new work goes in `services/sabwa-node/`. See `CHANGELOG-sabwa-rust-to-node.md`.
