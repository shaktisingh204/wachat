## 01. Cross-Module Data Fabric

1. Create a canonical Mongo `entities.contacts` collection with `tenantId`, `canonicalId`, `identities[]`, `traits`, `consent`, and `mergedFrom[]` fields to replace per-module contact stores in Wachat, CRM, and sabChat.
2. Define a shared `Contact`, `Account`, `Identity`, and `DomainEvent` TypeScript schema in `src/lib/data-fabric/types.ts` re-exported by every module instead of redefining shapes in `src/lib/sabflow/types.ts` and `src/lib/hr-types.ts`.
3. Write a one-shot migration script `scripts/fabric/backfill-contacts.ts` that walks Wachat `contacts`, CRM `leads`, sabChat `customers`, and HRM `employees`, emitting deterministic `canonicalId`s keyed on tenant+phone+email.
4. Add a Mongo unique compound index on `(tenantId, identityType, identityValueNormalized)` inside an `identities` collection so duplicate phone or email writes fail fast at the driver level.
5. Implement phone normalization via `libphonenumber-js` E.164 in `src/lib/data-fabric/normalize.ts` so Wachat WhatsApp IDs and CRM lead phones resolve to the same identity key.
6. Build an identity-resolution service `src/lib/data-fabric/resolve.ts` that, given any `{phone, email, waId, igUserId, tgChatId}` tuple, returns or creates a `canonicalId` inside a Mongo transaction.
7. Replace ad-hoc lookups like `contacts.findOne({ phone })` across `src/app/api/wachat/**` with a single `getOrCreateContact(tenantId, identity)` helper from the fabric module.
8. Stand up a Redis Streams event bus `fabric:events` in `src/lib/data-fabric/bus.ts` with consumer groups per module, replacing today's direct cross-module function calls.
9. Define a frozen catalog of event types (`contact.created`, `contact.merged`, `message.received`, `lead.qualified`, `invoice.paid`, `ticket.opened`) in `src/lib/data-fabric/events.ts` with Zod validators.
10. Wire Wachat inbound message webhook in `src/app/api/wachat/webhook/route.ts` to publish a `message.received` event onto `fabric:events` after upserting the contact.
11. Add a CRM lead-create server action that emits `contact.identified` with the lead source, replacing the current direct insert in `src/lib/actions` CRM files.
12. Implement an idempotency layer using Redis `SETNX` on `eventId` so retried webhooks from Meta, Telegram, and Razorpay never double-write to the contact timeline.
13. Build a `contact_timeline` Mongo collection that stores every `DomainEvent` with `canonicalId`, `tenantId`, `module`, `occurredAt`, and `payload`, indexed on `(canonicalId, occurredAt)` for fast paging.
14. Render a unified contact timeline component `src/components/data-fabric/ContactTimeline.tsx` that streams from `/api/fabric/contacts/[id]/timeline` and is embeddable in CRM, sabChat, and Wachat panels.
15. Expose a GraphQL contact API at `src/app/api/fabric/graphql/route.ts` using `graphql-yoga`, with `Contact`, `Account`, `Event`, `Trait`, and `Segment` types and DataLoader-batched resolvers.
16. Add Apollo-compatible persisted queries with hashes pre-registered at build time so the public GraphQL surface cannot be abused for arbitrary queries from the browser.
17. Implement a deterministic merge algorithm in `src/lib/data-fabric/merge.ts` that picks survivor `canonicalId`, rewrites foreign keys in `crm_deals`, `sabchat_tickets`, `invoices`, and writes a `contact.merged` event.
18. Add a soft-undo for merges by retaining a `merge_log` collection with the full pre-merge document snapshots, with a 30-day TTL index for compliance.
19. Build a fuzzy-match deduplication worker `src/workers/fabric-dedupe.ts` that runs nightly, using trigram similarity on `(name, email, phone)` and queues high-confidence pairs for auto-merge.
20. Surface low-confidence duplicate candidates in an admin review UI at `src/app/admin/fabric/duplicates/page.tsx` so operators can approve, reject, or split with audit trail.
21. Add a `consent` sub-document on `contacts` tracking `whatsappOptIn`, `emailOptIn`, `smsOptIn`, `marketingOptIn` with timestamps and source event IDs so every channel respects unified consent.
22. Enforce consent at send time by gating Wachat broadcast worker (`src/lib/broadcast-worker.js`) and SMS sender on the fabric `contact.consent` flags before queuing.
23. Add a `trait` engine in `src/lib/data-fabric/traits.ts` that derives computed properties (LTV, last-active-channel, NPS bucket) on every event, persisting to `contacts.computed`.
24. Define declarative segments in `src/lib/data-fabric/segments.ts` as JSONLogic-style predicates evaluated lazily for queries and incrementally on events for materialized membership.
25. Build a `segments` Mongo collection with materialized member counts and a worker that emits `segment.entered` and `segment.exited` events to drive SabFlow triggers.
26. Add a SabFlow trigger node `Contact entered segment` in `src/lib/sabflow/triggers/` that subscribes to `segment.entered` events for hand-off into automation flows.
27. Add a SabFlow action node `Update contact trait` that writes back to the canonical contact through the fabric SDK rather than touching Mongo directly.
28. Publish a typed fabric SDK as `src/lib/data-fabric/sdk.ts` exposing `getContact`, `upsertContact`, `mergeContacts`, `emit`, `subscribe`, `query` so modules never import Mongo collections directly.
29. Replace direct `getDb()` calls inside CRM, HRM, and Email actions for any contact-shaped reads with the SDK, leaving raw Mongo only for module-private collections.
30. Add row-level tenant scoping middleware `src/lib/data-fabric/tenant-guard.ts` that injects `tenantId` into every fabric query and throws on missing context, eliminating cross-tenant leak risk.
31. Wire Meta Ads attribution by mapping Facebook click IDs (`fbclid`) and IG comment events into `identities` so a paid-traffic visitor stitches to the eventual CRM deal.
32. Implement a multi-touch attribution model in `src/lib/data-fabric/attribution.ts` that walks `contact_timeline` events and assigns linear, first-touch, and last-touch credit to revenue events.
33. Surface attribution rollups in the Ad Manager dashboard with revenue-by-campaign joins computed nightly, replacing today's vanity metrics with closed-loop ROI.
34. Build a real-time sync gateway using Mongo change streams in `src/workers/fabric-sync.ts` that fans canonical contact updates out via Redis pub/sub to every module's in-memory cache.
35. Push real-time contact updates into the browser via Server-Sent Events at `src/app/api/fabric/stream/route.ts`, so an open CRM tab reflects a fresh WhatsApp message instantly.
36. Add an audit log collection `fabric_audit` recording every write with `actorId`, `module`, `action`, `before`, `after`, `requestId`, retained for one year, queryable from the Admin module.
37. Add a `requestId` propagation middleware in `src/middleware.ts` that flows through fetch headers, server actions, and fabric events so a single user click is traceable across modules in logs.
38. Migrate Wachat templates and CRM email sends to a unified `outbound_message` collection keyed on `canonicalId`, replacing per-module sent logs with one queryable surface.
39. Build a `webhooks` registry inside the fabric where tenants subscribe external systems to `contact.*` and `event.*` topics with HMAC signing and at-least-once delivery via BullMQ.
40. Provide an outbound webhook delivery worker with exponential backoff, dead-letter queue in Redis, and a UI under `src/app/dashboard/api-dev/webhooks` showing delivery status per event.
41. Add a CDC-style export sink that writes contact and event change feeds to Vercel Blob as Parquet daily for tenant-owned analytics export, configurable per workspace plan.
42. Implement field-level encryption for PII columns (`email`, `phone`, `address`) using KMS-managed keys via `src/lib/crypto/` so even DBAs cannot read raw identity values without audit.
43. Add a GDPR `forget` endpoint at `src/app/api/fabric/contacts/[id]/forget/route.ts` that hashes identities, redacts traits, retains compliance-required events with PII stripped, and emits `contact.forgotten`.
44. Build a `contact_export` endpoint that returns a tar.gz with all events, traits, and timeline data for a `canonicalId` to satisfy data-portability requests within the SLA window.
45. Stand up a feature-flag gate `data_fabric_v2` in `src/lib/features.ts` so each module can be flipped from legacy contact reads to fabric reads per tenant, enabling incremental rollout.
46. Add a shadow-read harness that double-reads from legacy and fabric stores, diffing payloads in logs, so we catch divergence before flipping the canary tenants.
47. Write a test suite `src/__tests__/data-fabric/*.test.ts` covering identity resolution, merge correctness, event idempotency, segment evaluation, and tenant isolation with at least 80% line coverage.
48. Provide an admin observability dashboard at `src/app/admin/fabric/page.tsx` showing event lag per consumer group, merge rate, dedupe queue depth, and top noisy identities.
49. Define plan-tier limits (event volume, segment count, GraphQL query complexity) in `src/lib/plans.ts` and enforce at the SDK boundary, monetizing the fabric without degrading core flows.
50. Publish an internal architecture doc `docs/ecosystem/data-fabric-architecture.md` covering schema, event topics, SLAs, ownership, and runbooks so all 19 other slices can integrate against a stable contract.
