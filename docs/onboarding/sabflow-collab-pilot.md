# SabFlow Real-Time Collaboration — Internal Pilot Rollout Checklist

- **Audience:** SabNode Customer Success
- **Status:** Active — Phase C.8 GA closeout (2026-05-18)
- **Owner:** SabFlow on-call + Customer Success lead
- **Related:** [`docs/features/sabflow-realtime-collab.md`](../features/sabflow-realtime-collab.md), [`docs/changelog/sabflow-collab-ga.md`](../changelog/sabflow-collab-ga.md), [`docs/adr/sabflow-seat-model.md`](../adr/sabflow-seat-model.md), [`docs/inventory/collab-state.md`](../inventory/collab-state.md)

> Scope. This is the **internal** playbook Customer Success uses to walk a pilot tenant through enabling, monitoring, and supporting SabFlow real-time collab. It is **not** customer-facing; the customer-facing doc is `docs/features/sabflow-realtime-collab.md`.

---

## §1. Pre-flight — before reaching out to a pilot tenant

- [ ] Confirm the tenant's **plan tier** in the SabNode admin console. If `free`, recommend an upgrade to `starter` or higher before enabling pilot — the single-editor cap on `free` makes the feature un-demonstrable.
- [ ] Check the tenant's **active workspace member count** vs. their per-doc cap. If the workspace has 8 members and they're on `pro` (5-editor cap), prep the customer for the cap UX so the first hit isn't a surprise.
- [ ] Pull the **last 30 days of SabFlow telemetry** for the tenant from the `sabflow.collab.*` dashboard (Grafana folder `sabflow-collab/`). Look for prior `seat_limit` rejections — those identify the docs most likely to hit the cap first.
- [ ] Confirm `SABFLOW_COLLAB_ENABLED=true` is set in the tenant's deploy environment (Vercel env per project). If staging the rollout per-tenant, this is the gate.
- [ ] Confirm the WS gateway service `sabflow-ws` is **green** on PM2 for the tenant's region (port 4002, healthcheck `/health`). If it's not, page on-call before contacting the customer.
- [ ] Pre-load a **test workspace** (separate from the customer's prod) so you can demo the flow end-to-end on a screenshare without touching their data.

---

## §2. Tenant kickoff — first contact

- [ ] Schedule a **30-min kickoff call** with the customer's SabFlow champion + their workspace admin. CS lead + on-call SabFlow eng both attend the first one.
- [ ] Send the customer the **public feature doc** ([`docs/features/sabflow-realtime-collab.md`](../features/sabflow-realtime-collab.md)) 24 h ahead. Do **not** send this onboarding doc — it's internal.
- [ ] Walk the customer through the **demo flow** in their staging workspace:
  - [ ] Open the same doc in two browser windows side-by-side; show live cursors, avatars, typing indicators.
  - [ ] Make a concurrent edit to the same node in both windows; show the CRDT merge.
  - [ ] Drop the WS in one window (devtools → offline); make edits; reconnect; show the sync.
  - [ ] Trip the seat cap (open `N+1` tabs on their plan); show the modal + "Join as viewer" CTA.
  - [ ] Walk them through `/dashboard/sabflow/[id]/share` — create a share link, assign a role, revoke it.
- [ ] Set explicit **success criteria** for the pilot:
  - [ ] At least 3 of their users have actively edited collaboratively across at least 5 flows within 2 weeks.
  - [ ] No Sev-1 issues filed against the doc.
  - [ ] Customer's NPS-style "would you keep using this" answer is captured (verbal is fine for the pilot).
- [ ] Schedule a **2-week follow-up** before ending the kickoff.

---

## §3. Monitoring — first 14 days

CS owns the tenant's first 14 days of telemetry monitoring. Eng on-call is the escalation, not the primary.

### §3.1 Daily check (5 min)

- [ ] Open the Grafana folder `sabflow-collab/` and filter by `tenantId`.
- [ ] Confirm `sabflow.collab.awareness_lag` p99 is **< 250 ms**. If it spikes above 1 s for >5 min, page on-call.
- [ ] Confirm `sabflow.collab.conflict_rollback` rate is **< 0.5 /minute** for the tenant. Higher means client/server are disagreeing on something; investigate.
- [ ] Check `sabflow.collab.reconnect` rate against the regional baseline. Tenant-specific spikes usually mean a flaky customer-side network — not a SabFlow bug, but worth noting to the customer.
- [ ] Confirm the tenant's `sabflow_collab_minutes` usage vs. their plan cap (`src/lib/billing/usage-meter.ts` → `usageForPeriod`). If they're trending toward 80% of cap before day 14, flag for upsell.

### §3.2 Per-week review (30 min)

- [ ] Pull the per-doc seat-rejection histogram for the tenant. Identify the top-3 docs by `seat_limit` hits — these are upsell candidates.
- [ ] Review `sabflow_audit_log` for the tenant — confirm no unexpected role changes, no share-link revokes that look adversarial.
- [ ] Spot-check 5 random flows the tenant has touched. Open each, confirm presence renders correctly, no orphan cursors, no ghost avatars.

### §3.3 Incident response

- [ ] **Sev-1 (data loss / edits not landing / doc corruption):** page `#sabflow-oncall` immediately. Customer-facing message template in §5.
- [ ] **Sev-2 (presence flicker, seat-cap false reject, cursor lag):** file via the in-product report; CS owns triage; eng on-call ack within 1 business day.
- [ ] **Sev-3 (cosmetic, polish, tooltip):** CS notes in the tenant CRM; batch into the weekly customer-issues triage with eng.
- [ ] **Sev-4 (single-user nitpick):** capture in CRM; do not escalate.

---

## §4. Common customer questions — canned answers

### "Why was my user disconnected?"

Check the WS close code in the browser devtools. If it's `4403` with payload `{"code":"SEAT_LIMIT",...}` it's the per-doc editor cap — they need to either upgrade, ask a teammate to leave the doc, or join as viewer. If it's any other 4xxx code, page on-call — the disconnection is a SabFlow-side issue.

### "Why do I see two avatars for the same person?"

Stale WS session, usually from a duplicate browser tab or an unclean reload. The idle-state detection (`src/lib/sabflow/client/use-idle-state.ts`) will time it out within 90 s. If both avatars persist after 90 s, page on-call — the Redis backplane may have drifted between gateway instances.

### "Why isn't my edit showing up for my colleague?"

Three possibilities, in order:
1. **WS dropped on either side** — check the editor's connection indicator (top-right in the chrome). If red, reconnect is in flight.
2. **They're in viewer mode** — they joined when the doc was at cap, or the share link gave them a viewer role. Check `sabflow_doc_shares` for their effective role.
3. **CRDT conflict rolled back the edit** — check `sabflow.collab.conflict_rollback` telemetry for the doc + timestamp. The `ConflictBanner` overlay should have surfaced this in-product.

### "Can I use SabFlow collab from a mobile device?"

No (at GA). Mobile users open the doc as a viewer only and cannot submit CRDT updates. See [`docs/features/sabflow-realtime-collab.md`](../features/sabflow-realtime-collab.md) §4.8 for the limitation.

### "I want to see who changed what, when."

The `sabflow_audit_log` collection captures it server-side. There is **no in-product version-history UI at GA** — see [`docs/features/sabflow-realtime-collab.md`](../features/sabflow-realtime-collab.md) §4.1. For now, CS can run the export-audit-log script (`services/sabflow-ws/scripts/export-audit.sh`) for the tenant and ship them a CSV.

### "We hit our `sabflow_collab_minutes` cap mid-month, what happens?"

Open sessions are **not disconnected**. The server sends a `meter_exceeded` frame, the editor downgrades to read-only in-place, and a banner explains the cap. Existing edits are preserved. Either upgrade or wait until the monthly meter resets.

### "Can we self-host the WS gateway?"

Not as part of standard SabNode deployment. Enterprise tenants may negotiate a self-hosted WS gateway as part of their contract — route the request to the eng lead.

---

## §5. Escalation message templates

### Sev-1 — data loss suspected

```
Subject: [Sev-1] SabFlow collab — possible data loss for <workspace>

Hi <customer>,
Our monitoring just flagged a potential SabFlow collab data-loss event on doc
<docId> in workspace <workspaceId>. We are actively investigating and have
paged our on-call engineer.

- Your other SabFlow docs are not affected.
- We have an audit log of every edit on this doc — no data has been
  permanently lost from our side; the question is whether the editor view
  has fallen out of sync.
- We will reply with a status update within 1 hour.

If you have an in-progress edit on this doc, please **leave the doc open**
(do not refresh) and reply to this thread. We may need to capture your
local Y.Doc state from the browser.
```

### Sev-1 — full service degradation

```
Subject: [Sev-1] SabFlow real-time collab degraded — single-user fallback active

Hi <customer>,
SabFlow real-time collaboration is currently degraded across our platform.
We have failed back to single-user editing mode — your flows continue to
work for solo editing and saving, but live multi-user sessions will not
sync across users until we restore the WS gateway.

- ETA: <eta or "investigating">
- No data loss — Mongo + R2 persistence are unaffected.
- Updates: status page at https://status.sabnode.com (subscribe for push).

We are very sorry for the disruption.
```

### Cap-related upsell (proactive)

```
Subject: Your team is loving SabFlow collab — time to upgrade?

Hi <champion>,
Quick note from our Customer Success side — we noticed your workspace has
hit the per-doc editor cap on <plan> tier <N> times in the last 7 days,
across <M> different flows. Your team is clearly using SabFlow collab
heavily, which is great to see.

You're currently on <plan> (<editor-cap> editors per flow). The next tier
up, <next-plan>, raises this to <next-cap>. Happy to walk you through the
upgrade math on a 15-min call this week if useful.
```

---

## §6. Pilot exit — graduation to full GA

After 14 days (or when success criteria from §2 are met), the tenant graduates from pilot to standard support. CS does the following:

- [ ] Capture the **NPS-style verbal score** ("Would you keep using this? 0–10?") in the tenant CRM.
- [ ] Capture **3 specific quotes** from the customer's champion — feature-team uses these for the public launch post.
- [ ] Pull the tenant's final telemetry summary (seat-rejection count, conflict-rollback count, awareness-lag p99, total `sabflow_collab_minutes` consumed) and attach to the CRM record.
- [ ] Confirm any feature-gap requests are filed as SabNode tracker issues with `area:sabflow + kind:collab + source:pilot-feedback`.
- [ ] Hand the tenant off to standard support — note in CRM that pilot has ended.

---

## §7. Pilot wave plan

The pilot is rolled out in waves to bound blast radius. Wave membership is owned by CS lead; eng on-call only gates by `SABFLOW_COLLAB_ENABLED`.

| Wave | Cohort                                              | Expected size | Gate                              |
| ---- | --------------------------------------------------- | ------------- | --------------------------------- |
| 1    | SabNode internal (dogfood)                          | ~30 users     | Internal Vercel project only      |
| 2    | Friendly Enterprise design partners (3–5 tenants)   | ~50 users     | Per-tenant env var                |
| 3    | Business-tier customers who opted into beta         | ~200 users    | Per-tenant env var                |
| 4    | All Pro-tier customers                              | ~2k users     | Plan-tier rollout gate            |
| 5    | All Starter + Free customers                        | All remaining | Full rollout, `SABFLOW_COLLAB_ENABLED=true` global |

CS opens a wave only after the previous wave's 14-day telemetry shows:

- `sabflow.collab.awareness_lag` p99 < 250 ms.
- `sabflow.collab.conflict_rollback` rate < 0.5 /minute / tenant.
- Zero Sev-1 issues against the wave.
- No regression on `sabflow_collab_minutes` metering accuracy (spot-check vs. WS gateway session logs).

---

## §8. Operational contacts

- **CS lead (pilot owner):** Customer Success team rotation — see internal directory.
- **SabFlow eng on-call:** `#sabflow-oncall` Slack channel + PagerDuty schedule `sabflow-oncall`.
- **WS gateway runbook:** [`docs/runbooks/sabflow-persistence-backup.md`](../runbooks/sabflow-persistence-backup.md) (persistence side) — gateway-specific runbook lives alongside the service in `services/sabflow-ws/README.md`.
- **Billing escalation (cap / upsell):** Billing team queue — route via the existing CS → Billing handoff workflow.
- **Status page:** `https://status.sabnode.com` — update via the status integration when a Sev-1 is declared.

---

## §9. Checklist summary

For a brand-new pilot tenant, the minimum sequence is:

- [ ] §1 pre-flight (every item)
- [ ] §2 kickoff call
- [ ] §3.1 daily check, weekdays only (10 min/day)
- [ ] §3.2 weekly review (30 min/week)
- [ ] §6 graduation at day 14 (or earlier if success criteria are met)

Total CS time per pilot tenant: ~5 hours over 2 weeks. Any tenant requiring more than that should be flagged to the CS lead — recurring time-sinks indicate a product gap, not a customer-success gap.
