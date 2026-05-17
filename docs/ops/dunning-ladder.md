# Dunning Ladder Runbook

Operational guide for the CRM subscription dunning ladder. The ladder is
driven by `/api/cron/subscriptions-daily` (a Vercel Cron handler at
`src/app/api/cron/subscriptions-daily/route.ts`) which runs once per day
at `0 2 * * *` UTC.

This document covers what the ladder does, how to disable it for a
specific subscription, how to manually re-trigger a step, and which env
flags / fields gate the safe-to-live behavior.

---

## TL;DR

- **Default behavior**: dry-run. Set `?execute=1` on the cron URL to
  actually mutate Mongo, send notifications, create tickets, suspend.
- **Cap per run**: 200 subscriptions. The response carries
  `hasMore: true` when more are pending; re-invoke (or wait for the
  next tick) to drain.
- **Auth**: `Authorization: Bearer $CRON_SECRET` (Vercel cron default),
  `x-cron-secret: $CRON_SECRET` as a fallback for non-Vercel callers.

---

## The Ladder

`src/lib/billing/dunning.ts` defines the canonical step list. Day offsets
are measured from `dunningStartedAt` on the subscription doc and may be
overridden per-subscription via `dunningConfig` (see "Per-subscription
overrides" below).

| Step | Channel             | Default day | Helper                          |
| ---- | ------------------- | ----------- | ------------------------------- |
| 1    | Email               | D+1         | `sendDunningEmail`              |
| 2    | SMS                 | D+3         | `sendDunningSms`                |
| 3    | WhatsApp template   | D+5         | `sendDunningWhatsApp`           |
| 4    | Create billing tkt  | D+7         | `createDunningTicket`           |
| 5    | Suspend             | D+14        | `suspendSubscriptionForDunning` |

Step 5 flips the subscription to `status: 'paused'` with
`pausedReason: 'dunning_exhausted'`. It writes via the Rust BFF first
(`crmSubscriptionsApi.update`) and falls back to a direct Mongo write so
the suspend is durable even when the BFF is down.

### How the cron picks a step

1. Pull every subscription where `status === 'active'` and
   `nextBillingAt <= today`, OR `dunningStep > 0`, OR `dunningStartedAt`
   is set. Excludes any doc with `dunningDisabled: true`.
2. For each subscription:
   - If `attemptCount === 0` and billing is due, issue an invoice,
     advance `nextBillingAt` by the billing interval, set
     `attemptCount: 1`, emit `subscription.invoice_issued` notification.
   - Otherwise, if the latest invoice is older than `graceDays` (default
     `3`) and `dunningStartedAt` is not set yet, stamp `dunningStartedAt
     = today`.
   - Pick the next step via `getNextDunningStep(sub, history, today)` —
     this walks highest → lowest (so a 14-day-stale subscription jumps
     straight to suspend) and skips any step already attempted on the
     same UTC day.
   - Apply the step idempotently via `applyDunningStep(sub, step,
     { execute })`. The helper short-circuits if the same step was
     attempted on the same `lastDunningRun.day`.

### Wait intervals (configurable)

The default ladder uses the constants in
`DEFAULT_SUB_DUNNING_CONFIG` (`emailDay`, `smsDay`, `whatsappDay`,
`ticketDay`, `suspendDay`). To override the global default, edit the
constant in `src/lib/billing/dunning.ts`. To override per-subscription,
write a `dunningConfig` object on the Mongo doc (see below).

---

## Per-subscription overrides

The subscription schema is **not** changed by this work — the following
fields are additive and optional. Add them to a specific
`crm_subscriptions` document to influence the cron:

| Field                      | Type      | Effect                                              |
| -------------------------- | --------- | --------------------------------------------------- |
| `dunningDisabled`          | `boolean` | Cron skips this subscription entirely.              |
| `dunningConfig`            | `object`  | Partial override of the day offsets (see below).    |
| `dunningStartedAt`         | `Date`    | Cron uses this as the ladder reference timestamp.   |
| `dunningStep`              | `number`  | 0 = not in dunning. 1–5 = last step that fired.     |
| `lastDunningRun`           | `object`  | `{ step, ranAt, ok, day }` — idempotency key.       |
| `lastInvoiceIssuedAt`      | `Date`    | Used to evaluate the `graceDays` window.            |
| `lastInvoiceId`            | `string`  | Most-recent invoice id; written by the cron.        |
| `attemptCount`             | `number`  | 0 = no invoice yet this cycle; the cron sets to 1.  |

### Disabling for a single subscription

```js
db.crm_subscriptions.updateOne(
  { _id: ObjectId("…") },
  { $set: { dunningDisabled: true, updatedAt: new Date() } },
);
```

### Per-subscription override of the day offsets

```js
db.crm_subscriptions.updateOne(
  { _id: ObjectId("…") },
  { $set: {
      dunningConfig: {
        emailDay: 2,
        smsDay: 5,
        whatsappDay: 8,
        ticketDay: 12,
        suspendDay: 21,
      },
      updatedAt: new Date(),
  } },
);
```

Any keys you omit fall back to `DEFAULT_SUB_DUNNING_CONFIG`.

---

## Manually re-triggering a step

There is no per-step "fire now" endpoint by design — the ladder is
gated by `dunningStartedAt + dayOffset` to avoid stomping on the
production cadence. To manually advance a single subscription:

1. **Reset its `lastDunningRun.day`** so the idempotency guard lets the
   step fire again today:

   ```js
   db.crm_subscriptions.updateOne(
     { _id: ObjectId("…") },
     { $unset: { lastDunningRun: "" } },
   );
   ```

2. **Optionally drop `dunningStep`** to re-fire an earlier rung:

   ```js
   db.crm_subscriptions.updateOne(
     { _id: ObjectId("…") },
     { $set: { dunningStep: 0 } },
   );
   ```

3. **Invoke the cron with `?execute=1`** to actually fire:

   ```sh
   curl -X POST \
     -H "Authorization: Bearer $CRON_SECRET" \
     "$DEPLOY_URL/api/cron/subscriptions-daily?execute=1"
   ```

If you only want to **inspect** what would happen, omit `?execute=1`
(this is the default — the cron is dry-run unless you opt in).

---

## Dry-run vs. live

| URL                                                           | Behavior                                             |
| ------------------------------------------------------------- | ---------------------------------------------------- |
| `/api/cron/subscriptions-daily`                               | Dry-run. Reads + logs only. No Mongo writes, no notifications. |
| `/api/cron/subscriptions-daily?execute=1`                     | Live. Issues invoices, sends notifications, advances ladder, suspends. |
| `/api/cron/subscriptions-daily?execute=1&graceDays=7`         | Live with a 7-day grace window instead of the default 3. |

The dry-run path emits a structured `dunning_step_due` log line for every
step it would have fired:

```json
{
  "ts": "2026-05-18T02:00:01.234Z",
  "event": "dunning_step_due",
  "subscriptionId": "…",
  "step": 2,
  "label": "sms",
  "dryRun": true
}
```

When `execute=1` and the step actually fires, an additional
`dunning_step_applied` line follows with `ok` + `detail`.

---

## Response shape

```jsonc
{
  "ok": true,
  "dryRun": false,
  "durationMs": 184,
  "processed": 42,         // subscriptions examined this run
  "invoicesIssued": 6,     // fresh-cycle invoices created
  "dunningSteps": 11,      // ladder advancements (steps 1-4)
  "suspended": 1,          // step-5 suspends
  "skipped": 24,           // within-grace or same-day idempotency skips
  "errors": [],
  "hasMore": false         // true when >200 are pending; re-invoke to drain
}
```

When `hasMore: true`, the next cron tick at `0 2 * * *` UTC will pick up
the remainder. To drain immediately, re-invoke the URL — the cap is
per-request, not per-day.

---

## Wiring TODO — real channel sends

The current ladder helpers (`sendDunningEmail`, `sendDunningSms`,
`sendDunningWhatsApp`) emit:

1. An in-app notification row via `notifyTeamMember` (tenant owner sees
   it in the bell popover).
2. A `billing_events` row of type `dunning.attempt` with the
   `{ channel, subscriptionId, customerId }` payload.

The real outbound channel (email / SMS gateway / WhatsApp template
send) needs a subscriber that tails `billing_events` and dispatches
through the existing channel workers. See:

- `src/lib/notifications/crm.ts` — typed CRM notification builder.
- `src/lib/team-notifications.ts` — in-app notification writer.
- `src/lib/events/notification-bridge.ts` — event → notification bridge.

The ticket step (4) already wires through the Rust BFF
(`@/app/actions/crm/tickets.actions::createTicket`) when available and
degrades to a notification only otherwise. The suspend step (5) writes
through the Rust BFF with a Mongo fallback.

---

## Troubleshooting

| Symptom                              | Check                                                  |
| ------------------------------------ | ------------------------------------------------------ |
| Cron returns `401`                   | `CRON_SECRET` env var on Vercel; bearer header.        |
| Cron returns `503 "not configured"`  | `CRON_SECRET` is unset on the deployment.              |
| `hasMore: true` every day            | Increase cron frequency or lift `RUN_CAP` (currently 200). |
| Step never fires for a subscription  | Confirm `dunningDisabled !== true` and `dunningStartedAt` is set; check `lastDunningRun.day` for today. |
| Same step fires twice in a day       | Shouldn't happen — guarded by `lastDunningRun.day`. If it does, the guard is being bypassed; check `applyDunningStep` and `advanceDunningStep` are both being called. |
| Suspend writes via Rust but Mongo lags | Expected — the suspend helper writes Mongo as the durable fallback after the Rust call. Re-run the cron to verify the doc is `paused`. |
