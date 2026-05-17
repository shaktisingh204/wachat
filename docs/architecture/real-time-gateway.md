# CRM Real-Time Gateway (Phase 7, deferred)

## Status
**Scaffolding only — not implemented.** This document captures the recommended
architecture so the next iteration can pick it up without re-deriving the
contract.

## Why deferred
Vercel serverless functions are short-lived and stateless. They cannot hold a
long-lived WebSocket connection: the function exits after every response and
the underlying load balancer terminates idle connections in seconds.

Building a real-time fan-out gateway on this platform requires one of three
approaches, each with its own trade-offs:

1. **Managed pub/sub** (Pusher, Ably, PartyKit). Cheapest to ship. We hand the
   `tenantUserId`-scoped channels to the SDK and let the vendor handle the
   socket lifecycle.
2. **Vercel Functions + Server-Sent Events (SSE)**. Slightly more work — we
   keep a streaming response open and write event frames as records change.
   Works inside Vercel's request budget when used with Fluid Compute, but
   loses connections on every deploy.
3. **Dedicated long-running service** (PM2 worker on the same host as
   `services/sabwa-node/`). Best for high-throughput tenants; introduces
   another service to operate.

Picking the right option is a product decision (cost vs. control), and the
contract below is identical across all three. So we ship the contract now and
implement later.

## Recommended approach
SSE at the edge, backed by the existing webhook dispatcher's event bus.

```
┌────────────────────────────┐      emit         ┌─────────────────────────┐
│  Server Actions / API v1   │ ────────────────▶ │  src/lib/events/bus.ts  │
│  (account create, etc.)    │                   │  (in-process emitter)   │
└────────────────────────────┘                   └────────────┬────────────┘
                                                              │ fan-out
                                                              ▼
                                              ┌───────────────────────────────┐
                                              │  src/lib/webhooks/dispatch.ts │   ← already shipped
                                              │  → HTTP POST to subscribers   │
                                              │                               │
                                              │  src/app/api/v1/crm/events/   │   ← future SSE handler
                                              │  → stream to browser clients  │
                                              └───────────────────────────────┘
```

The same `dispatchWebhookEvent` call site (added in Phase 7) is the single
emit point. Future work introduces an in-process bus (or a Redis pub/sub
when we go multi-instance) that webhooks AND the SSE handler subscribe to.

## Subscriber contract

### Endpoint
```
GET /api/v1/crm/events?topics=account.created,deal.updated
Authorization: Bearer <crm_api_token>
Accept: text/event-stream
```

Auth uses the same `crm_api_tokens` lookup as the REST API. A token with
`crm:read:<entity>` may subscribe to `<entity>.*` events. A token with
`crm:*` may subscribe to anything.

### Wire format
Standard SSE — one event per record change.

```
event: account.created
id: <delivery uuid>
data: {"event":"account.created","tenantUserId":"...","occurredAt":"...","data":{...}}

event: deal.updated
id: <delivery uuid>
data: {"event":"deal.updated", ...}
```

`id` is a uuidv4. Clients persist the last seen `id` and pass it as
`Last-Event-ID` on reconnect to resume from a buffered tail (server keeps
the last 100 events per tenant in Redis with a 60-second TTL — enough to
ride out a deploy without losing any record).

### Heartbeat
Server sends `: heartbeat\n\n` (SSE comment) every 25 seconds to keep
intermediaries (Cloudflare, browsers, corporate proxies) from closing the
stream.

## Why webhooks + SSE both
- **Webhooks** are the long-running integration surface — third-party servers
  hold no state, just an HTTPS endpoint, and we retry deliveries.
- **SSE** is the in-browser UX surface — dashboards stay live without
  polling. SSE failures don't matter (browsers reconnect automatically).

The two surfaces share the same event names (`account.created`, etc.) and the
same event payload shape. A consumer only picks one based on whether they
want push-to-server or pull-from-server semantics.

## Implementation checklist (future)

1. `src/lib/events/bus.ts` — in-process `EventEmitter` with topic filtering
   plus a Redis fan-out backplane for multi-instance deploys.
2. Refactor `dispatchWebhookEvent` to listen on the bus instead of being
   called inline. The CRM REST handler then only calls
   `bus.emit(tenantUserId, eventName, payload)`.
3. `src/app/api/v1/crm/events/route.ts` — SSE GET handler. Streams from the
   bus filtered by `tenantUserId` + `topics` + scope.
4. `services/sabwa-node/` (or a sibling `services/crm-rt-node/`) — optional
   long-running host for high-throughput tenants.
5. Last-event-id buffer — `crm_event_buffer` Redis list, capped at 100 per
   tenant.
6. Browser client helper at `src/lib/api/events-client.ts` for dashboard
   pages.

## What ships in Phase 7
- The webhook dispatcher (`src/lib/webhooks/dispatch.ts`) and the admin UI
  for subscriptions.
- The naming convention (`<entity>.<action>`) and the payload envelope.
- The first emitter (account.created) wired into `addCrmAccount`.

The SSE handler does **not** ship in Phase 7. Anyone trying to call
`GET /api/v1/crm/events` will get a 404 — the route does not exist yet. The
contract above is the binding contract for the next iteration.
