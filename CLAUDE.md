## graphify

This project has a graphify knowledge graph at graphify-out/.

Rules:
- Before answering architecture or codebase questions, read graphify-out/GRAPH_REPORT.md for god nodes and community structure
- If graphify-out/wiki/index.md exists, navigate it instead of reading raw files
- For cross-module "how does X relate to Y" questions, prefer `graphify query "<question>"`, `graphify path "<A>" "<B>"`, or `graphify explain "<concept>"` over grep — these traverse the graph's EXTRACTED + INFERRED edges instead of scanning files
- After modifying code files in this session, run `graphify update .` to keep the graph current (AST-only, no API cost)

## ZoruUI design system

- **ALWAYS use ZoruUI** (`@/components/zoruui`) primitives and namespaced `--zoru-*` CSS variables (scoped under `.zoruui` class) for UI components, pages, and modules.
- Avoid using legacy design systems (like `clay`), raw Tailwind accents, or bespoke layouts. Rebuild/port legacy views to ZoruUI.

## SabFiles policy

- **ALWAYS use SabFiles** for all file inputs, uploads, and file-picking interfaces.
- Every file in SabNode lives in SabFiles. NEVER expose a free-text URL paste for files — file inputs source from `<SabFilePicker>` / `<SabFileUrlInput>` / `<SabFilePickerButton>` / `<SabFileToFileButton>` (all in `@/components/sabfiles`), which read from the user's library or upload fresh. The picker has only Library + Upload modes; do not re-add a "From URL" tab.

## Deployment platform — Vercel (native, not integration)

SabNode **IS a Vercel project**, deployed on Vercel. It is not a project that *integrates with* Vercel as an external service — Vercel is the runtime.

Rules:
- Treat Vercel as the target runtime for every Next.js route, server action, and edge feature. Default to Fluid Compute + Node.js runtime unless a specific feature requires otherwise.
- Use platform-native primitives (`vercel env`, Vercel Marketplace integrations, Routing Middleware, Vercel Functions, Vercel Cron) before custom infrastructure.
- Do **not** add code, docs, or comments framing Vercel as an external API — there are no Vercel "webhooks", "API keys", or "linking flows" to manage from inside SabNode; the deployment IS Vercel.
- Env vars are provisioned via `vercel env` (or the Vercel dashboard) — `.env.example` documents what the app reads, and `.env` is for local dev only. Marketplace integrations auto-provision their secrets and should be preferred over hand-rolled provider setups when possible.
- Cron jobs use Vercel Cron (declared in `vercel.json` / `vercel.ts` or via the Vercel dashboard) — do not introduce node-cron / agenda / Bull for periodic work.
- When recommending an integration (Postgres, Redis, blob storage, auth provider), prefer the Vercel Marketplace option first; only fall back to a self-hosted alternative when the Marketplace doesn't have a match.
