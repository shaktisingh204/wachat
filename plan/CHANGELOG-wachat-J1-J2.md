# Wachat hardening — Journeys 1 & 2

Two journey‑level passes over the core Wachat data flow. No feature work — this batch is security, data‑integrity and correctness fixes only. Every edit is gated by a TypeScript check and (where possible) an offline unit test.

---

## J1 · Contact → Broadcast → Delivery → Reply

### P0 — security / data loss

- **Meta webhook now verifies `x-hub-signature-256` HMAC.** Previously the `POST /api/webhooks/meta` handler accepted any payload. Anyone who discovered the public URL could forge delivery/read events, fake inbound messages, and trigger automations. Now computes HMAC‑SHA256 of the raw request body with `FACEBOOK_APP_SECRET`, compares with `crypto.timingSafeEqual`, and 401s on mismatch. Fails closed in production, fails open in dev when `FACEBOOK_APP_SECRET` is unset so local ngrok testing keeps working. Offline unit test covers: valid‑accepts, missing‑sig, wrong‑prefix, tampered‑body, wrong‑secret, short‑sig.
  - `src/app/api/webhooks/meta/route.ts`

- **Webhook persistence moved from fire‑and‑forget to `after()`.** The previous handler called `findProjectIdFromWebhook(...).then(...)` and returned 200 immediately. On Next.js the response finishing can cancel the pending promise, silently dropping delivery updates and inbound messages. Replaced with `after()` from `next/server` so the work is guaranteed to complete after the response. Inner `try/catch` so callback failures log loudly but don't crash the handler.
  - `src/app/api/webhooks/meta/route.ts`

- **`getAllBroadcasts` server action now admin‑gated.** Previously a `'use server'` action with no auth and no `projectId` filter — `.find()` with empty query returned every broadcast across every tenant. Only called from admin pages, but `'use server'` actions are callable from any client in the app via a crafted POST, so page‑level gating was not enough. Now calls `getAdminSession()` inside the action and returns an empty result on non‑admin callers. Defence‑in‑depth at the action layer.
  - `src/app/actions/broadcast.actions.ts`

### P1 — real bugs

- **Duplicate inbound messages → double automations, inflated unread counts.** Both `handleSingleMessageEvent` and `processIncomingMessageBatch` had a dedup check that only gated the insert — they still ran `$inc: unreadCount`, notifications, `handleOptInOut`, `handleFlowLogic`, and `triggerAutoReply` on every Meta retry. Fixed both paths to short‑circuit on duplicate `wamid` **before** any side effects. Also switched inserts to `updateOne`+`upsert:true`/`bulkWrite` keyed on `wamid` so concurrent duplicate batches can't race past the pre‑check.
  - `src/lib/webhook-processor.ts`

- **Broadcast worker no longer sends to opted‑out contacts.** `broadcast_contacts` is a snapshot collection — it never joined back to the canonical `contacts` collection, so `isOptedOut:true` contacts could sit in `PENDING` and receive broadcasts (both a compliance issue and a real trust issue). Worker now does one lookup per batch against `contacts` by `(projectId, waId, isOptedOut:true)`, marks opted‑out entries `FAILED` with `error: 'contact_opted_out'`, and increments `broadcasts.errorCount` without hitting Meta. Finalization still runs so the broadcast flips to `Completed` correctly if everyone in a batch was opted out.
  - `src/workers/broadcast/send.worker.js`

- **Broadcast worker no longer stomps contact status.** The post‑send contact upsert previously had `$set: { status: 'open' }`, overwriting whatever a user or CRM had set (`archived`, `vip`, `customer`, …). Moved `status: 'open'` to `$setOnInsert` so only brand‑new contacts get the default and existing contacts keep their manually‑set status.
  - `src/workers/broadcast/send.worker.js`

---

## J2 · Chat inbox threading

### P0 — security

- **`getConversation` cross‑tenant PII leak.** The chat history read action took a `contactId` string from the client, validated only that it was a valid ObjectId, and queried `incoming_messages` + `outgoing_messages` with no project check. Any authenticated user could enumerate/guess IDs and pull the full WhatsApp chat history of any contact in any tenant. Fixed with a new `resolveContactForSession(contactId)` helper (single choke point) that loads the contact, calls the existing `getProjectById(contact.projectId)` — which enforces session user + owner/agent membership — and returns null on failure. Message queries are also scoped by `projectId` as defence‑in‑depth.
  - `src/app/actions/whatsapp.actions.ts`

- **`markConversationAsRead` / `markConversationAsUnread` cross‑tenant writes.** Same problem on the write path — no project scoping meant any authed user could flip unread state on any tenant's contact and mass‑mark‑read arbitrary inbound messages. Both routed through the same `resolveContactForSession` helper, and update filters now include `{ _id, projectId }` so a bypass would still match nothing.
  - `src/app/actions/whatsapp.actions.ts`

### P1 — real bugs

- **`handleSendMessage` contact update is now project‑scoped.** Previously the post‑send `updateOne({ _id: contactId }, ...)` took `contactId` from the client and didn't check it belonged to the same project. A caller with access to project A could stomp contact metadata in project B by guessing an ID. Filter is now `{ _id, projectId }`, matching the mismatched‑project case to no‑op.
  - **Behavior note**: this edit also dropped the implicit `status: 'open'` stomp from manual chat sends (consistent with the J1 broadcast worker fix). If manual chat sends should auto‑unarchive archived contacts, reintroduce it gated on `{ status: 'archived' }`, not a blanket stomp.
  - `src/app/actions/whatsapp.actions.ts`

- **Chat thread sort is now stable.** `getConversation` merged `incoming_messages` + `outgoing_messages` and sorted by `messageTimestamp` only — two messages at the same second had undefined relative order, with an accidental "inbound before outbound" tiebreaker from the merge order. Added a deterministic `messageTimestamp → createdAt → _id` tiebreaker chain. Offline unit test covers all 5 cases including the two‑inbound‑plus‑two‑outbound interleaving scenario.
  - `src/app/actions/whatsapp.actions.ts`

---

## Subagent audit findings that were **false positives** (no action)

- "Broadcast‑only contacts are invisible in the chat list." — `syncSuccessfulSends` in the broadcast worker upserts contacts with `lastMessage`/`lastMessageTimestamp` on every successful send, so broadcast‑only recipients do appear sorted by recency.
- "Template messages render as blank bubbles." — Worker writes `content: { template: sendResult.sentPayload }` and the chat renderer reads `message.content.template`. Shapes match.
- "Outbound status ticks never update." — The chat polling loop re‑fetches the full conversation every 5 s; `React.memo` detects the fresh message objects and re‑renders. Ticks DO update with up‑to‑5 s latency. Filed as a P2 latency concern, not a correctness bug.

---

## Known punch list (deferred)

- **P2 unique index on `incoming_messages.wamid`.** Existing rows may contain duplicates from the old insert path; a unique index build will fail until a dedup pass runs. Migration script ships with this batch.
- **P2 compound indexes** on `broadcast_contacts(broadcastId, status)` and `(incoming_messages|outgoing_messages)(projectId, contactId, messageTimestamp)`. Included in the migration script.
- **P2 `webhook_logs` + `broadcast_contacts` + broadcast counter writes are not transactional.** Counters can drift from statuses on a mid‑batch crash. Not addressed in this batch; needs a decision on whether to wrap in a Mongo transaction (requires replica‑set) or accept eventual consistency via a reconciliation sweep.
- **P2 Meta API version drift** (`v21.0` in `broadcast.actions.ts`, `v23.0` in `send‑message.js`). Fixed in the follow‑up batch — see `CHANGELOG‑wachat‑P2.md` if present.

---

## Files touched (all edits typecheck clean)

- `src/app/actions/broadcast.actions.ts` — admin guard on `getAllBroadcasts`
- `src/app/api/webhooks/meta/route.ts` — HMAC verification + `after()` persistence
- `src/lib/webhook-processor.ts` — idempotent inbound message handling (both paths)
- `src/workers/broadcast/send.worker.js` — opt‑out compliance + contact status preservation
- `src/app/actions/whatsapp.actions.ts` — chat server‑action auth + stable sort

## Verification performed

- `tsc --noEmit -p tsconfig.json` → zero new errors (the 1 473 baseline errors are pre‑existing Next 16 async‑params migration noise, unchanged)
- Offline unit test: HMAC verification (6 / 6 cases pass)
- Offline unit test: chat thread stable sort (5 / 5 cases pass)
- **Live runtime verification against the dev server**:
  - `POST /api/webhooks/meta` **unsigned** → `HTTP 401 {"status":"invalid_signature"}` ✅
  - `POST /api/webhooks/meta` **validly signed with FACEBOOK_APP_SECRET** → `HTTP 200 {"status":"received"}` ✅
  - `POST /api/webhooks/meta` **valid signature but tampered body** → `HTTP 401 {"status":"invalid_signature"}` ✅ (proves byte-level integrity, not just presence)
- **Not yet runtime‑verified**: the chat cross-tenant fixes (J2‑P0‑1, J2‑P0‑2) require a signed-in session + crafted cross-tenant `contactId` to prove they reject. The code paths are straightforward (they all route through `resolveContactForSession` which calls the existing `getProjectById` auth gate), but end-to-end browser verification is a manual step.
