## 04. AI Agent Ecosystem

1. Scaffold `src/ai/agents/` with a typed `Agent` base class that wraps `src/ai/genkit.ts`, exposes `run`, `stream`, `tools`, and `memory` slots, and registers each agent under a stable workspace-scoped slug.
2. Ship a Sales SDR agent at `src/ai/agents/sales-sdr.ts` that consumes CRM contacts, drafts personalized outreach via Wachat templates, and reuses `auto-reply-flow.ts` for inbound qualification responses.
3. Build a Support Triage agent that classifies inbound sabChat conversations using `sentiment-analyzer.ts`, routes by intent + plan tier, and escalates to a human queue with SLA timers.
4. Add a Marketing Copywriter agent that extends `generate-post-suggestions.ts` and `template-content-suggestions.ts` to produce multi-channel campaigns with brand-voice guardrails per workspace.
5. Implement an Ops Scheduler agent that authors SabFlow workflows by calling `generate-flow-builder-flow.ts`, validates them against `lib/sabflow/n8n/expression-runner.ts`, and commits drafts behind a review flag.
6. Create a Finance Reconciliation agent that diff-matches Stripe payouts against credit ledger entries, flags variance, and writes findings to a workspace-scoped audit collection.
7. Wire an HR Onboarding agent into the HRM module that generates checklists, sends Wachat welcome flows, and provisions module roles via the existing RBAC tables.
8. Promote `seo-meta-optimizer.ts` and `seo-schema-generator.ts` into a SEO Content agent that crawls workspace pages, proposes diffs, and opens drafts in the SEO module CMS.
9. Add an Ads Creative agent in the Ad Manager module that generates copy + thumbnail prompts, reuses `generate-promo-video.ts`, and A/B-routes variants through campaign budgets.
10. Define a unified tool-calling protocol in `src/ai/agents/tools/` mapping SabNode REST routes to JSON-schema tools, with per-tool RBAC checks and credit-cost annotations.
11. Build a `src/ai/agents/registry.ts` that lists agents, capabilities, required scopes, model preferences, and pricing so UI surfaces can render an agent picker.
12. Add a thin agent invocation API at `src/app/api/agents/[slug]/run/route.ts` that streams via SSE, enforces the workspace cookie session, and meters credits before completion.
13. Persist agent runs to a `agent_runs` Mongo collection with `workspaceId`, `agentSlug`, `userId`, `inputHash`, `tokens`, `costUsd`, `status`, and `traceId` for billing and replay.
14. Layer Redis-backed rate limits per `(workspaceId, agentSlug)` with sliding-window keys so plan tiers cap concurrency and burst usage cleanly.
15. Render an agent console at `src/app/dashboard/ai-agents/page.tsx` listing runs, costs, success rate, and a "rerun with edits" affordance backed by stored input snapshots.
16. Add an in-conversation agent picker to sabChat that surfaces only agents whose declared scopes match the active conversation's context (contact, ticket, channel).
17. Build an MCP server entrypoint `src/app/api/mcp/route.ts` that exposes Wachat contacts, CRM deals, SabFlow runs, and credit balance as tools to external Claude/Cursor clients.
18. Implement bearer-token auth and per-resource scopes for the MCP server, reusing the admin-style httpOnly session cookie path for browser clients and PAT tokens for IDEs.
19. Add a memory store in `src/ai/agents/memory/` with namespaced keys `(workspaceId, agentSlug, threadId)` backed by Mongo for episodic memory and Redis for working scratchpads.
20. Introduce a `summarize-and-compact` background job that trims long agent threads into a structured digest once token count crosses a per-model threshold.
21. Stand up a vector index using a Postgres pgvector or Qdrant adapter at `src/ai/rag/store.ts` keyed by `workspaceId` so RAG never crosses tenant boundaries.
22. Build ingestion adapters for Wachat templates, CRM notes, SabFlow execution logs, and SEO pages that chunk, embed, and upsert with content hashes for idempotency.
23. Add a `retrieve` tool that performs hybrid BM25 + vector search and returns citations with stable IDs so agents can render footnoted answers in chat UIs.
24. Define a multi-model router in `src/ai/router.ts` that picks OpenAI, Anthropic, Gemini, or a local Ollama endpoint based on agent declaration, latency budget, and cost ceiling.
25. Wire the router through Vercel AI Gateway when configured, falling back to direct provider SDKs to keep dev parity with the current Genkit setup.
26. Add streaming token + cost instrumentation that tags each chunk with model, provider, and `traceId` and pushes to the `agent_runs` collection on stream close.
27. Create a prompt registry at `src/ai/prompts/` storing prompt templates with `slug@version`, JSON schema for variables, and a `compile(vars)` helper used by every agent.
28. Hash compiled prompts and cache outputs in Redis with a configurable TTL so identical agent calls within a workspace share cost and latency.
29. Build an eval suite in `src/ai/evals/` with golden datasets per agent (SDR replies, triage labels, ad copy) and a CI script that fails PRs that regress pass rate.
30. Add a guardrails layer in `src/ai/guardrails/` that runs PII redaction, prompt-injection heuristics, and a refusal classifier before any tool call hits a SabNode API.
31. Mid: ship an agent marketplace at `src/app/dashboard/ai-agents/marketplace/` where workspaces install first-party and partner agents gated by plan and required module scopes.
32. Define a `manifest.json` schema for marketplace agents listing `tools`, `models`, `prompts`, `evalsLink`, `priceModel`, and a signed publisher key verified at install time.
33. Build a sandbox runner using Vercel Sandbox so partner agents execute their tool handlers in an isolated microVM with only the granted SabNode API scopes.
34. Add agent-to-agent messaging via a `dispatch(toAgent, payload)` tool that enqueues a child run, links it to the parent `traceId`, and bubbles up structured results.
35. Implement a planner agent that decomposes a user goal into subtasks, picks specialist agents from the registry, and supervises completion with retry budgets.
36. Add human-in-loop checkpoints so any tool flagged `requiresApproval` pauses the run, posts an approval card to sabChat, and resumes via a signed callback URL.
37. Build an autonomous-mode toggle per agent that, when enabled, removes approval gates for low-risk tools but enforces a hard credit and tool-count ceiling per run.
38. Create a fine-tuning pipeline in `src/ai/fine-tune/` that exports approved agent runs as JSONL, anonymizes PII, and submits jobs to OpenAI / Together with status tracked in Mongo.
39. Add a model registry that records workspace-fine-tuned model IDs, pins them per agent slug, and falls back to the base model on quota or evaluation regression.
40. Implement a cost dashboard at `src/app/dashboard/ai-agents/costs/page.tsx` charting daily spend per agent, model, and user with CSV export and forecast-to-month-end.
41. Add per-workspace AI budget caps that hard-stop new runs when the monthly cap is breached and surface a Stripe top-up CTA inline in the agent console.
42. Build agent telemetry views showing tool call traces, retrieved chunks, and intermediate thoughts in a tree, gated to admins via the existing RBAC layer.
43. Add a "reproduce run" button that re-fires an agent with frozen prompt version, model, and retrieved chunks so debugging avoids drift from upstream changes.
44. Wire SabFlow nodes for `Agent.Run`, `Agent.Stream`, and `Agent.Memory.Read` so visual flows can compose agents without bespoke code, validated by `lib/sabflow/n8n/expression-runner.ts`.
45. Expose a `/api/agents/webhooks/inbound/[slug]` route so external systems (Slack, GitHub, Stripe) can trigger agents with HMAC-verified payloads.
46. Platform: publish a versioned Agent SDK npm package `@sabnode/agent-sdk` that mirrors the internal `Agent` base class so partners build against a stable contract.
47. Stand up an agent observability backbone using OpenTelemetry exporters that ship spans for prompt compile, model call, tool call, and RAG retrieve to a configurable OTLP endpoint.
48. Add a red-team harness that nightly fuzzes every published agent with adversarial prompts and posts a safety scorecard to the admin dashboard.
49. Ship a federation layer letting trusted partner SabNode tenants invoke each other's agents via signed JWTs, with explicit per-tool allowlists and shared audit trails.
50. Define an agent lifecycle policy (draft, beta, GA, deprecated) enforced in the registry so the marketplace can sunset risky agents without breaking installed flows.
