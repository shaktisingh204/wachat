# SabNode AI ("SabAI") — In‑house, no‑third‑party copilot

## Context & goal

Build SabNode's **own** conversational assistant that runs **entirely on our own
servers** (no external AI provider, no data leaving the box), knows **all of
SabNode's features**, is grounded in **the tenant's own data**, and **performs
actions across every module** by conversation — the canonical example:

> User: "create a lead" → assistant asks for the missing details → it creates
> the lead in CRM. The same pattern then works for *every* SabNode action
> (send a campaign, create a task, draft a WhatsApp reply, build a flow, …).

This is feasible because the work is **intent → slot‑filling → tool‑call**, not
open‑ended reasoning. We keep the model a **small, constrained cog**; a
deterministic dialog engine + embeddings do the heavy lifting, and every action
runs through our **existing server actions** so **RBAC + credit metering +
validation are unchanged** (the AI is just another caller).

**Decided constraints (from brainstorming):**
- **No third party.** Model + embeddings + vector store all self‑hosted.
- **Model:** **Qwen3‑4B** via **Ollama** (OpenAI‑compatible at `127.0.0.1:11434`), thinking‑mode off for actions. Runner‑up Llama 3.2 3B for max speed.
- **Hardware:** 120 GB RAM / 32 cores (doubling) — RAM is a non‑issue; keep model in the 3–8B range (CPU is memory‑bandwidth‑bound). 4B is the sweet spot for bounded actions.
- **v1 scope:** structured actions across modules + **extractive** RAG ("how does feature X work"). **Defer** free‑form "analyze everything" synthesis (weak on a small CPU model) to a clearly‑labelled later/beta path.

## Principles & non‑goals

- **Model as a cog, not the brain.** Routing = embeddings; dialog = deterministic; the LLM only does constrained JSON extraction (and, as a fallback, tool selection). This keeps LLM calls short → fast on CPU, and reliable.
- **Reuse, don't rebuild.** We already have: an agent runtime (`src/lib/sabsms/agent/*` — runtime/tools/guardrails/handlers/store + an eval harness `scripts/sabsms-agent-eval.mjs`), two MCP servers (`/api/mcp/sabcrm`, `/api/mcp/ad-manager`), a CRM embeddings + semantic‑search stack (`src/app/actions/sabcrm-ask.actions.ts` + `src/lib/sabcrm/embeddings.server.ts`), an LLM gateway (`src/lib/sabcrm/ai-llm.server.ts`), a credits ledger (`src/lib/sabsms/credits/ledger.ts`), RBAC (`src/lib/rbac-server.ts`), and Postgres (`src/lib/postgres.ts`).
- **Multi‑tenant by construction.** Every retrieval index and every action is scoped to the active project/workspace; the AI never gains more access than the calling user's RBAC allows.
- **Non‑goals (v1):** training a shared model on tenant data (leakage risk — use per‑tenant RAG); frontier‑quality free‑form reasoning; autonomous multi‑step chains (single‑intent, single‑tool turns first).

## Architecture

```
            ┌──────────────────────── SabAI turn ────────────────────────┐
 user msg → │ 1 Guardrails (PII/inject, rate, RBAC)                        │
            │ 2 Intent router  ── embeddings + pgvector NN ──► tool id      │
            │ 3 Dialog manager ── deterministic slot state machine ───────► │
            │        asks for missing required fields (from tool schema)   │
            │ 4 Extractor      ── Qwen3‑4B, JSON‑schema‑guided decoding ──► │
            │        fills slots from the user's free‑text answers         │
            │ 5 Confirm + Execute ── calls existing server action ────────► │
            │        (RBAC + credits + validation enforced)                │
            │ 6 Respond ── templated NLG (+ optional light paraphrase)      │
            └──────────────────────────────────────────────────────────────┘
   side channel: "explain X" → extractive RAG over feature‑docs index → snippet
```

**Components (all new code under `src/lib/sabai/` + `src/app/api/sabai/` + a UI surface):**

1. **Inference engine (on‑box).** Ollama serving `qwen3:4b` + a CPU embedding model `nomic-embed-text`. Runs as a managed process (PM2 app `sabnode-ai-ollama` or systemd). New client `src/lib/sabai/llm.local.ts` (OpenAI‑compatible `chat/completions` + `embeddings` against `127.0.0.1:11434`) mirroring the shape of `ai-llm.server.ts` but **local‑only** (no third‑party rungs). Supports **JSON‑schema‑guided/`format` constrained decoding** so even a small model always emits valid tool JSON.
2. **Vector layer (on‑box).** **pgvector** on the existing Postgres (`SABNODE_PG_URL`, via `src/lib/postgres.ts`). Three index families, all per‑tenant‑scoped:
   - `sabai_intents` — catalog of example phrasings → tool id (the router).
   - `sabai_docs` — SabNode **feature documentation** chunks (for "how does X work").
   - `sabai_data` — opt‑in tenant business‑data embeddings (reuse/repoint the existing `embeddings.server.ts` to the **local** embedder instead of a provider key).
3. **Tool registry** — `src/lib/sabai/tools/` : each tool = `{ id, title, description, module, rbacKey, paramsSchema (zod/JSON‑schema), confirm:boolean, run(args, ctx) }`. `run` adapts structured args → the existing server action (e.g., `addCrmLead` is FormData‑shaped → the tool builds the FormData / calls a normalized inner fn). A generated **manifest** feeds router + extractor. Tools grouped into per‑module packs.
4. **Dialog manager** — `src/lib/sabai/dialog/` : deterministic slot‑filling state machine. Knows each tool's required/optional fields from its schema; asks templated questions for missing slots; validates; handles "cancel"/"change"; confirms before execute.
5. **Orchestrator/runtime** — `src/lib/sabai/runtime.ts` : ties guardrails → router → dialog → extractor → execute → respond. Modeled on `src/lib/sabsms/agent/runtime.ts`. Session state (current tool, filled slots, history) in **Redis** keyed by `{tenant, user, conversation}`.
6. **API + UI** — `src/app/api/sabai/chat/route.ts` (streaming SSE) + a **20ui** copilot surface (a global launcher/drawer, and/or `/sabai`). Mounts in the app shell so it's reachable everywhere.
7. **Guardrails, audit, eval** — prompt‑injection/PII checks (reuse `sabsms/agent/guardrails.ts` patterns), append‑only `sabai_audit` log of every tool execution, and an eval harness modeled on `scripts/sabsms-agent-eval.mjs` (golden intents → expected tool + slots).

## Data flow — the "create a lead" turn (the proof slice)

1. User opens copilot, types **"create a lead"**.
2. **Router**: embed message → NN search `sabai_intents` (tenant or global) → top match `crm.createLead` (above confidence threshold; else ask the model to pick from the top‑k, or ask the user to disambiguate).
3. **Dialog manager** loads the `crm.createLead` tool schema → required slots `{name, phone}` (+ optional `email, company, source, …`) → no slots filled yet → asks **"What's the lead's name and phone number?"** (templated).
4. User: **"Rahul, +91 98xxxxxxx, from a webinar"**. **Extractor**: Qwen3‑4B with the tool's JSON schema as a guided‑decoding constraint → `{name:"Rahul", phone:"+9198xxxxxxx", source:"webinar"}`. Dialog manager merges slots; all required present.
5. **Confirm** (templated): "Create lead **Rahul** (+91 98xxxxxxx, source: webinar)? yes/no". On "yes" →
6. **Execute**: `crm.createLead.run(args, ctx)` → `requirePermission('crm_leads','create', projectId)` → calls `addCrmLead` (normalized) → on success, reserve/charge credits via the ledger, write `sabai_audit`.
7. **Respond** (templated): "✅ Lead **Rahul** created. [Open lead]" with a deep link.

Every other action is the *same pipeline* with a different tool — that's the generalization.

## Phases

- **P0 — On‑box inference + vector infra.** Install Ollama; `ollama pull qwen3:4b` + `nomic-embed-text`; run as PM2/systemd service with thread/parallel‑slot config for 32 cores. Enable `pgvector` on Postgres; migrations for `sabai_intents/docs/data/audit`. New `src/lib/sabai/llm.local.ts` (+ env: `SABAI_OLLAMA_URL`, `SABAI_MODEL`, `SABAI_EMBED_MODEL`). **Verify:** local chat + embeddings round‑trip; constrained JSON works.
- **P1 — Tool registry + first tool.** Define the registry types + manifest generator; implement `crm.createLead` wrapping `addCrmLead` (RBAC + credits + audit). **Verify:** call the tool directly with fixed args → lead appears in CRM, scoped to the project.
- **P2 — Dialog manager + extractor → the lead vertical slice (no UI yet).** Deterministic slot‑filling + guided‑decode extraction; drive it from a CLI/test script end‑to‑end ("create a lead" → Q&A → created). **Verify:** the proof slice passes via a script + unit tests.
- **P3 — Intent router.** Seed `sabai_intents` with example phrasings for the v1 tools; embeddings‑NN routing with confidence threshold + model‑pick fallback + disambiguation. **Verify:** eval set of phrasings routes to the right tool ≥ target accuracy.
- **P4 — Chat API + copilot UI.** `api/sabai/chat` SSE streaming; session state in Redis; 20ui copilot drawer mounted in the shell; wire RBAC + credits + audit + rate limiting. **Verify:** end‑to‑end in the browser, create a lead by chatting; another tenant sees isolated state.
- **P5 — Extractive RAG ("how does X work").** Ingest SabNode feature docs → `sabai_docs` (local embedder); on "explain/how" intents return the best snippet(s) with citations (no synthesis). **Verify:** feature questions return correct, sourced snippets.
- **P6 — Generalize across modules.** Add tool packs for CRM (more record types), WaChat, SabSMS, SabFlow, tasks, finance… Each tool = thin wrapper + schema + intent examples. **Verify:** a representative action per module works end‑to‑end through the same pipeline.
- **P7 — Hardening.** Guardrails (injection/PII), per‑tenant isolation tests, concurrency/load (parallel Ollama slots / queue), eval harness in CI, audit review. **Verify:** isolation + load + eval gates green.
- **P8 — Later/optional.** Per‑tenant opt‑in `sabai_data` retrieval for data‑aware answers; **LoRA fine‑tune** Qwen3‑4B on‑box for SabNode intents/tone; gated "beta" free‑form analysis path.

## Key files / integration points

- **New:** `src/lib/sabai/` (`llm.local.ts`, `runtime.ts`, `tools/`, `dialog/`, `router.ts`, `guardrails.ts`, `audit.ts`), `src/app/api/sabai/chat/route.ts`, copilot UI under `src/components/sabai/` + shell mount, `scripts/sabai-eval.mjs`, pgvector migrations.
- **Reuse / adapt:** `src/lib/sabsms/agent/*` (runtime/tools/guardrails/eval patterns), `src/lib/sabcrm/embeddings.server.ts` + `sabcrm-ask.actions.ts` (repoint embeddings to the local model), `src/lib/sabcrm/ai-llm.server.ts` (interface shape only — local client is separate, no third‑party rungs), `src/lib/postgres.ts` (pgvector), `src/lib/rbac-server.ts` (`requirePermission`), `src/lib/sabsms/credits/ledger.ts` (metering), `/api/mcp/*` (tool exposure pattern).
- **First wrapped action:** `src/app/actions/crm-leads.actions.ts` → `addCrmLead` (FormData‑shaped → normalize in the tool).
- **Ops:** add the Ollama service to `ecosystem.config.js` (or systemd); env in root `.env`.

## Tenancy, security, privacy

- Per‑tenant vector namespaces; retrieval filtered by `projectId/workspaceId`.
- AI inherits the **caller's** RBAC — every `tool.run` calls `requirePermission(rbacKey, action, projectId)`; no tool runs above the user's grants.
- Confirm‑before‑write on mutating tools; append‑only `sabai_audit` (who/what/args/result).
- Prompt‑injection/PII guardrails before tool execution; tool args re‑validated server‑side (never trust model output) via the tool's zod schema.
- Credits metered per turn/tool via the existing ledger; fail‑closed when unconfigured.

## Hosting / ops

- Ollama bound to `127.0.0.1` only; `OLLAMA_NUM_PARALLEL`/threads tuned for the core count; keep model resident (`keep_alive`). With 120 GB/32c, run multiple parallel slots for concurrency; queue overflow.
- Model/version pinned in env; updates are an explicit `ollama pull` + restart.
- Health endpoint + PM2 autorestart; resource caps so inference can't starve the web app.

## Verification (per phase)

- **Eval harness** (`scripts/sabai-eval.mjs`): golden set of utterances → expected `(tool, slots)`; run in CI; track routing accuracy + extraction validity.
- **Proof slice e2e:** "create a lead" by chat → record exists, project‑scoped, audited, credit‑charged.
- **Isolation test:** tenant A's copilot cannot read/act on tenant B's data.
- **Latency/concurrency:** measure tokens/sec for `qwen3:4b` on the box; confirm short constrained calls stay interactive under N concurrent chats.
- **Guardrail tests:** injection/PII attempts blocked; RBAC denials respected.

## Risks & tradeoffs

- **Small‑model quality ceiling** — mitigated by the cog architecture (routing/dialog deterministic; extraction constrained); free‑form analysis deferred.
- **CPU concurrency** — single instance serializes; mitigate with parallel slots + queue; GPU is a drop‑in later (design unchanged).
- **Tool‑call reliability** — guaranteed by JSON‑schema‑guided decoding + server‑side re‑validation.
- **Existing embeddings stack uses a provider key** — must repoint to the local embedder to honor "no third party".
- **Action shape variance** — some server actions are FormData/`prevState` shaped; the tool layer normalizes (don't call form actions raw).
```
