# SabNode AI ("SabAI") — In‑house copilot, scale‑optimized for 1000 concurrent users

> Revised after a 6‑dimension R&D (12 agents, web‑researched + adversarially verified).
> Bottom line: the original draft (Qwen3‑4B on **Ollama, CPU‑only**) was right about the
> *application* design but wrong about the *substrate*. For 1000 concurrent users you need a
> **GPU + a continuous‑batching server (vLLM)** — still 100% self‑hosted, no third‑party API.

## Goal & constraints (unchanged)

In‑house conversational agent, **no third‑party AI** (model + embeddings + vectors all on
company‑controlled hardware), grounded in each tenant's data, that performs **structured
actions across all SabNode modules** ("create a lead → ask details → create"), per‑tenant,
RBAC + credit gated.

## The capacity reframe (the most important finding)

**1000 concurrent users ≠ 1000 concurrent requests.** A chat user is idle 90–95% of the time
(reading/typing/thinking ~30–60 s between turns; a turn occupies the model ~2–5 s). By
Little's Law: `in‑flight ≈ users × turn_time / (turn_time + think_time)`.

- 1000 users × ~3 s turn / (~3 s + ~45 s think) ≈ **~60 steady‑state in‑flight requests**.
- Engineer for **bursty peaks of ~100–150 in‑flight**.
- Only the *RAG* subset ("how does X work") even touches the vector DB; slot‑filling/lead‑creation turns do **zero** vector search.

That is a **small, tractable** load — it fits comfortably on **one** modern GPU.

## Why the CPU/Ollama draft fails — and the fix

- **Ollama/llama.cpp on CPU has no continuous batching**: it serializes requests (default `OLLAMA_NUM_PARALLEL` 1–4) and 503s once its FIFO queue fills. Independent benchmarks: it collapses past ~10–16 concurrent (54–122 s first‑token, timeouts), and runs **~19–29× slower than vLLM** on identical work. CPU throughput doesn't grow with concurrency — it degrades; doubling cores barely helps (memory‑bandwidth bound).
- **Fix = vLLM (or SGLang) on a GPU.** Continuous batching + PagedAttention turn "many users" into batched work. A single mid‑tier GPU scales **near‑linearly to ~100–150 in‑flight** at 85–92% utilization — a **5–15× margin** over our ~60–150 peak. Still self‑hosted: Next.js talks to vLLM over its **OpenAI‑compatible HTTP API** (same pattern as the existing SabWa engine‑client), so the "no third party" rule holds.

## Revised stack (the verdict)

| Layer | Decision |
|---|---|
| **Inference engine** | **vLLM** (primary) on a GPU — continuous batching, **automatic prefix caching**, **guided/structured decoding** (XGrammar/llguidance). SGLang is the alt (RadixAttention) if prefix reuse is very high. Ollama → **local dev only**. |
| **Model** | A **fine‑tuned small function‑calling model**, not a general 4B. Best pick: **Salesforce xLAM‑2‑3b‑fc‑r** (≈65.7% BFCL overall / 56% multi‑turn), or **LoRA‑fine‑tune Qwen3‑4B** on SabNode's own tool schemas. Reserve a 7–8B general model only for the RAG path. (A *general* Qwen3‑4B scores only ~35% multi‑turn BFCL — which is exactly why the LLM must stay a constrained cog, not run an open agent loop.) |
| **Precision** | **FP8** (near‑lossless, ~+27% throughput, ~½ TTFT/TPOT) on FP8‑capable GPUs (L40S/H100). **AWQ‑INT4** for memory density / consumer‑GPU builds. Skip speculative decoding under load (inverts to <1× past batch ~8–48). |
| **Hardware** | **One** L40S 48 GB (~$7.5–10K owned, ~$0.85–1.9/GPU‑hr rented) or A100 80 GB carries the whole 1000‑user copilot. Add a **2nd identical GPU for HA / rolling deploys / burst** (not throughput). Keep the **existing 120 GB/32‑core box as the app + orchestration + Postgres/pgvector + embeddings tier** (genuinely fine on CPU). |
| **Vector** | **pgvector on Postgres** is the correct default and amply sufficient (copilot peaks at low‑double‑digit vector QPS; pgvector does 471 QPS@99% recall on 50M×768‑dim). **HNSW** (m=16, ef_construction 256–512), **never IVFFlat**; add **pgvectorscale** (StreamingDiskANN + binary quant) for headroom. **One shared table partitioned by `tenant_id` + RLS** — never collection‑per‑tenant. Migrate to Qdrant only past ~10–20M vectors with hot per‑tenant filtering. |
| **Embeddings** | Self‑hosted **HF Text‑Embeddings‑Inference (TEI)** running `nomic‑embed`/`bge‑base` at 768‑dim (CPU fine for live queries; bulk ingest as a batch job). Cache embeddings in Redis. (Better than Ollama‑for‑embeddings.) |
| **Routing / ops** | **vLLM Router** (KV‑cache‑aware, session affinity → big TTFT win on multi‑turn) in front of replicas; **Ray Serve** for autoscale + queue‑depth backpressure (single‑node fine; NVIDIA Dynamo only when multi‑node). Autoscale at ≈50–80% of profiled max in‑flight; shed with **429 + retry‑after** past the ceiling; **per‑tenant fair queueing**. |
| **Guardrails** | **Llama Prompt Guard 2 (86M, <1 GB, ~20–90 ms)** input gate; per‑tenant least‑privilege tool scopes; **human‑confirm before any write/destructive tool**; server‑side re‑validation of every tool arg (never trust model output). |
| **Observability/eval** | Self‑hosted **Langfuse + Arize Phoenix** via OpenInference/OpenTelemetry — track tool‑call success rate, hallucinated‑tool rate, TTFT/ITL/e2e percentiles per tenant; **nightly offline eval** over the fixed tool schemas. |

## Application architecture (validated by the R&D — keep it)

The "model as a constrained cog, deterministic engine does the control flow" design is
**confirmed correct** (the model's weak multi‑turn agentic scores are precisely why you keep
the loop in code). Components, with **load‑shedding ordered by leverage**:

1. **vLLM engine swap** *(the dividing line — do this first)*.
2. **Embedding/deterministic intent router** (sub‑10 ms, no LLM) → most turns never invoke the model.
3. **Exact + semantic response cache** (hash of normalized intent+slots, and canonical RAG questions) → deflects a meaningful share of repeat/RAG turns (studies show 40–69% on *favourable* workloads; real gains lower — measure).
4. **Prefix/KV caching** of the shared system prompt + tool schemas (free after first call; cuts TTFT, frees KV memory).
5. **Constrained decoding (XGrammar)** over a small fixed tool‑schema set → valid tool JSON first try, no retry storms.
6. **Deterministic slot‑filling dialog manager** + **tool registry** wrapping existing server actions (RBAC + credits + validation enforced) + **per‑tenant Redis session state** (TTL'd) + **append‑only audit**.
7. **Tiered cascade**: tiny router → fine‑tuned 1–3B extractor → 7–8B general only for RAG/ambiguous (≤10–25% of turns).

**Turn flow (the "create a lead" proof slice) is unchanged:** route (embeddings) → ask for
missing fields (deterministic) → extract to schema‑valid JSON (constrained model call) →
confirm → call `addCrmLead` (RBAC+credits+audit) → templated reply. Every other action is the
same pipeline with a different tool.

## Phases (revised)

- **P0 — GPU serving tier.** Stand up vLLM on a GPU (owned/colo or bare‑metal rental) serving the chosen FC model in FP8; enable automatic prefix caching + guided JSON decoding; expose OpenAI‑compatible API on the private network; new `src/lib/sabai/llm.local.ts` client (env `SABAI_LLM_URL`, `SABAI_MODEL`). **Verify:** constrained JSON round‑trip; load‑test to find the in‑flight knee.
- **P1 — Tool registry + `crm.createLead`** wrapping `src/app/actions/crm-leads.actions.ts:addCrmLead` (FormData‑shaped → normalize), RBAC + credits + audit.
- **P2 — Dialog manager + extractor → lead vertical slice** (CLI/test, no UI). **Verify:** "create a lead" → Q&A → record created, project‑scoped.
- **P3 — Embedding intent router** (TEI + pgvector HNSW) + confidence threshold + cascade fallback. **Verify:** routing accuracy on an eval set.
- **P4 — Chat API + 20ui copilot** (SSE streaming), per‑tenant Redis state, RBAC/credits/audit/rate‑limit, vLLM Router + Ray Serve backpressure.
- **P5 — Extractive RAG** ("how does X work") → `sabai_docs` via TEI embeddings → cited snippets (no synthesis). Repoint the existing `src/lib/sabcrm/embeddings.server.ts` to the **local** embedder (also makes "SabCRM Ask" no‑third‑party).
- **P6 — Generalize tool packs** across CRM/WaChat/SabSMS/SabFlow/tasks/finance.
- **P7 — Hardening**: guardrails (Prompt Guard 2), per‑tenant isolation tests, autoscale/backpressure, Langfuse/Phoenix observability, nightly eval, HA second GPU.
- **P8 — Later**: per‑tenant opt‑in data RAG; on‑box LoRA fine‑tune of the FC model on SabNode intents/tone; gated free‑form analysis beta.

## Reuse (grounded in the codebase)

`src/lib/sabsms/agent/*` (runtime/tools/guardrails + eval harness `scripts/sabsms-agent-eval.mjs`),
`src/lib/sabcrm/embeddings.server.ts` + `sabcrm-ask.actions.ts` (repoint to local embedder),
`src/lib/sabcrm/ai-llm.server.ts` (interface shape; the SabAI client is local‑only),
`src/lib/postgres.ts` (pgvector), `src/lib/rbac-server.ts` (`requirePermission`),
`src/lib/sabsms/credits/ledger.ts` (`reserveCredits`), `/api/mcp/*` (tool pattern),
`src/app/actions/crm-leads.actions.ts:addCrmLead` (first wrapped action).

## Cost (rough, honest)

- **Own/colo:** ~$16–28K capex for a **2× L40S** HA node (2× ~$8K GPU + ~$6–10K host), or ~$23–38K with 2× A100 80 GB; power <1 kW (~$0.7–1.5K/yr).
- **Rent bare‑metal:** ~$1,200–2,800/mo for a 2‑GPU L40S/A100 node on committed pricing.
- Start with **one** GPU + autoscale/queue; add the second for HA once live. The existing CPU box is reused (no new spend there).

## Evidence base & confidence

Findings converged across all six R&D dimensions and were adversarially re‑verified. **Honest caveats** the verifiers flagged: the headline vLLM throughput figures (15,243 tok/s; vLLM/TGI 3.67×) rest on a single un‑replicated Nov‑2025 preprint and are likely *overstated* for current software (confidence **medium** on those specific numbers); cache hit‑rates (60–76%) are best‑case synthetic Zipfian (real copilot gains lower); GPU prices are one provider on one date (hyperscaler on‑demand is higher); FP8/quant throughput multipliers were measured on larger models (for 3–4B the win is more VRAM than raw tok/s); "small FC model beats GPT‑4o" is BFCL‑snapshot‑sensitive. **What is strongly and consistently supported:** a single mid‑tier GPU on vLLM trivially serves a ~60–150 in‑flight chat copilot for 1000 users, while CPU+Ollama collapses at low‑double‑digit concurrency — and **pgvector is amply sufficient** for the vector layer.

## The one decision this forces

The R&D is unambiguous: **1000 concurrent users requires a GPU** — the existing CPU‑only box
cannot serve it (it's fine as the app/pgvector/embeddings tier, just not for generation).
So the real choice is:

- **(A) Provision a GPU** (own/colo/bare‑metal rental — still no third‑party AI) → full 1000‑user target, this plan as written. **Recommended.**
- **(B) Stay CPU‑only for now** → accept **dozens** of concurrent users (good for a pilot/internal rollout), same application design, swap the substrate to GPU later with **zero architecture change** (only `SABAI_LLM_URL` repoints).

Everything above the inference engine (router, dialog, tools, RAG, RBAC, vector, UI) is
**identical** in both — so building B first and upgrading to A is a safe, no‑rework path.
