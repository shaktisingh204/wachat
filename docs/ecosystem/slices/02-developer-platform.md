## 02. Developer Platform

1. Consolidate all public endpoints under a versioned `src/app/api/v1/` namespace and deprecate ad-hoc routes by mounting compatibility shims that 301 to the v1 equivalents.
2. Author a canonical OpenAPI 3.1 spec at `docs/openapi/sabnode.yaml` covering Wachat, sabChat, CRM, SabFlow, SMS, Telegram, SEO, and Email modules with response schemas and examples.
3. Generate a typed TypeScript client `@sabnode/sdk` from the OpenAPI spec via `openapi-typescript` and publish it to npm under the `sabnode` org with semver tied to the API version.
4. Ship a Python SDK `sabnode-python` generated from the same spec, including async support via `httpx.AsyncClient` and typed Pydantic models for every resource.
5. Add PHP, Go, and Ruby SDKs scaffolded by the OpenAPI generator with hand-tuned request signing helpers so all five SDKs share parity for retries, pagination, and error shapes.
6. Build a `sabnode` CLI in `packages/cli/` (oclif-based) supporting `sabnode login`, `sabnode workflows run`, `sabnode contacts import`, and `sabnode webhooks tail` against the public API.
7. Introduce two credential types in `src/lib/auth/` — `pat_*` personal access tokens scoped to one user and `sk_live_*` API keys scoped to a workspace — stored hashed in a new `apiCredentials` Mongo collection.
8. Add an OAuth 2.0 authorization server at `/api/v1/oauth/{authorize,token,revoke,introspect}` supporting authorization-code with PKCE, client credentials, and refresh-token grants for third-party apps.
9. Define a granular scope catalog (e.g. `wachat.messages.send`, `crm.contacts.read`, `sabflow.workflows.execute`) in `src/lib/auth/scopes.ts` and enforce it in a shared `requireScope()` middleware.
10. Build a developer app registration UI at `/dashboard/developer/apps` letting users create OAuth clients, choose redirect URIs, request scopes, and rotate `client_secret` values.
11. Implement plan-based rate-limit tiers (Free 60 rpm, Pro 600 rpm, Business 3000 rpm, Enterprise custom) using the existing Redis layer and emit `X-RateLimit-Limit/Remaining/Reset` headers on every response.
12. Add per-route burst buckets and cost weights so expensive endpoints like `/api/v1/wachat/broadcasts` consume more quota than `/api/v1/contacts` reads, configured in `src/lib/ratelimit/costs.ts`.
13. Support `Idempotency-Key` headers on all POST/PATCH/DELETE write endpoints by caching responses keyed by `(workspace, key, route)` in Redis for 24 hours and replaying on duplicate requests.
14. Standardize cursor-based pagination (`?cursor=…&limit=…`) across list endpoints, returning `{ data, next_cursor, has_more }` and back-filling existing offset endpoints with cursor support.
15. Define a uniform filtering grammar (`?filter[status]=active&filter[created_at][gte]=…`) parsed by `src/lib/api/filters.ts` and applied consistently to Mongo queries with allow-listed fields.
16. Standardize the error envelope `{ error: { code, message, doc_url, request_id, details } }` with stable `code` enums catalogued in `docs/api/errors.md` and a `request_id` echoed in `X-Request-Id`.
17. Sign all outbound webhooks using `HMAC-SHA256` with workspace-specific secrets, sending `Sabnode-Signature: t=…,v1=…` headers and documenting verification in every SDK.
18. Add replay protection by rejecting webhook payloads where the signed timestamp is older than 5 minutes, and require receivers to deduplicate on the `Sabnode-Event-Id` header.
19. Rebuild webhook delivery as a durable queue in `src/lib/webhooks/dispatcher.ts` backed by BullMQ with exponential retry (1m, 5m, 30m, 2h, 12h, 24h) and a dead-letter queue surfaced in the UI.
20. Create a webhook delivery dashboard at `/dashboard/developer/webhooks` showing per-endpoint success rate, p95 latency, last 100 deliveries, raw request/response, and one-click resend.
21. Publish a versioned event catalog at `docs/api/events.md` (e.g. `wachat.message.received`, `sabflow.workflow.completed`, `crm.deal.stage_changed`) with payload JSON Schemas under `docs/schemas/events/`.
22. Add an interactive API explorer at `/developers/explorer` using Scalar or Stoplight Elements bound to the OpenAPI spec, with a "Try it" runner that uses the developer's PAT.
23. Stand up a developer portal site at `/developers` (Next.js app group) with quickstarts per module, copy-pasteable cURL/Node/Python snippets, and an "Ask the SabNode AI" search powered by the docs corpus.
24. Ship official Postman and Bruno collections in `docs/collections/` regenerated on every spec change via CI, including environment templates for sandbox vs production.
25. Introduce a `mode=test` flag and parallel `sk_test_*` keys that route writes to an isolated `*_test` Mongo database and never trigger real WhatsApp/SMS/Email sends, simulating provider responses instead.
26. Add a sandbox WhatsApp number in `src/lib/wachat/sandbox.ts` that echoes/test-fixtures responses so developers can exercise `/api/v1/wachat/messages` without a Meta-approved BSP number.
27. Expose a public GraphQL gateway at `/api/v1/graphql` built with Apollo Server stitching read-mostly resources (contacts, deals, messages, workflows) with persisted-query support and depth/complexity limits.
28. Generate GraphQL schema from the same source-of-truth domain types in `src/lib/types/` so REST and GraphQL never drift, validated by a CI check that diffs both surfaces.
29. Ship a real-time API via WebSocket at `wss://api.sabnode.com/v1/stream` exposing channels like `wachat:incoming`, `crm:updates`, and `sabflow:executions` authenticated by short-lived JWTs.
30. Provide Server-Sent Events fallback at `/api/v1/stream/sse` for environments where WebSockets are blocked, sharing the same channel and authentication semantics.
31. Add bulk-import endpoints (`POST /api/v1/contacts/bulk`, `POST /api/v1/crm/deals/bulk`) accepting up to 10k records with async job IDs trackable via `GET /api/v1/jobs/{id}`.
32. Add export endpoints returning signed S3 URLs for large datasets and document the chunked NDJSON format under `docs/api/bulk.md`.
33. Surface an "Outgoing API Logs" viewer at `/dashboard/developer/logs` streaming the last 7 days of public API requests per workspace with method, path, status, latency, and request body hash.
34. Persist API audit events to a `apiAuditLogs` collection with a 90-day TTL on Pro and 1-year retention on Business, queryable via `/api/v1/audit-logs` for SIEM ingestion.
35. Implement IP allowlists per API key in the credential settings UI, enforced at the edge in `src/middleware.ts` before the rate limiter ever runs.
36. Add request signing v2 (`Sabnode-Signature` over canonical request) as an optional hardened mode for Enterprise tenants, modeled on AWS SigV4 and documented in `docs/api/signing.md`.
37. Publish status and incident pages at `status.sabnode.com` powered by uptime probes against `/api/v1/health` and per-module synthetic checks (send-test-message, run-test-workflow).
38. Expose Prometheus-format metrics at `/api/internal/metrics` (gated by service token) for `http_requests_total`, `webhook_delivery_seconds`, and `rate_limit_rejections_total` to feed Grafana.
39. Add a deprecation policy: every removed endpoint must emit `Sunset` and `Deprecation` headers for 6 months, log usage to `apiDeprecationUsage`, and email affected workspace owners 30/14/7 days out.
40. Build an API changelog at `/developers/changelog` auto-generated from the OpenAPI spec git history with categorized entries (added, changed, deprecated, removed) and RSS/JSON feeds.
41. Introduce request-level cost metering that increments the existing credit ledger for AI-touched endpoints (`/api/v1/sabflow/ai/*`, `/api/v1/seo/audit`) and returns `X-Sabnode-Credits-Used` per response.
42. Add a "Replay Request" button in the API Logs viewer that re-issues an exact stored request (with current credentials) for debugging, scoped to non-mutating routes by default.
43. Build a Zapier integration package consuming the public API + webhooks under `integrations/zapier/`, registering triggers for new contact, new message, and workflow completed.
44. Build a Make.com (Integromat) custom app and an n8n community node under `integrations/n8n/` to broaden no-code reach without forcing users into SabFlow itself.
45. Add a partner marketplace at `/marketplace` listing third-party apps built on SabNode OAuth, with install flow, scope review screen, revenue-share contract metadata, and review queue for Anthropic-style approval.
46. Provide a "Verify Webhook" tester at `/dashboard/developer/webhooks/verify` that accepts a payload+signature and confirms HMAC validity client-side, helping integrators debug 401s.
47. Ship a TypeScript types package `@sabnode/types` extracted from `src/lib/types/` so internal apps and external integrators share one canonical set of resource shapes.
48. Add CLI plugin support so customers can extend `sabnode` with `sabnode plugins:install @acme/sabnode-cli-plugin`, exposing internal automation as first-class CLI commands.
49. Run a public bug bounty on HackerOne scoped to `*.sabnode.com/api/v1/*`, with a documented safe-harbor policy in `docs/security/bug-bounty.md` and severity-based payouts up to $10k.
50. Stand up a Developer Council program with quarterly RFCs published in `docs/rfcs/` (e.g. "RFC-001 Idempotency", "RFC-014 GraphQL Federation") and gather feedback before any breaking v2 API change.
