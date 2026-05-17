# USE_RUST_CRM Cutover Runbook

Operational playbook for the Phase 4 canary that flips CRM action traffic from
the legacy Mongo path to the Rust workspace under `rust/crates/crm-*`. Audience:
on-call + platform ops. Keep this file in lockstep with the dual-impl actions
under `src/app/actions/crm-*.ts`.

---

## 1. Architecture: dual-impl with logged fallback

Every CRM server action is wrapped in the same shape:

```ts
if (useRustCrm()) {
  try {
    return await rustClient.someOp(args);
  } catch (err) {
    console.log(JSON.stringify({
      event: "rust_fallback",
      entity: "candidates",
      op: "list",
      errorCode: err?.code ?? "unknown",
      status: "fallback",
      ts: new Date().toISOString(),
      tenantUserId,
    }));
    // fall through to Mongo
  }
}
return await mongoLegacyImpl(args);
```

Key properties:

- **Rust-first, Mongo-fallback.** A failure in Rust never user-visible — the
  request transparently lands on the legacy code path.
- **Every fallback emits a single structured JSON line** on stdout. Vercel
  captures stdout into the runtime log stream; the Log Drain is what makes it
  alertable.
- **Success on Rust emits `event:"rust_ok"`** (same shape, `status:"ok"`). The
  ratio of `rust_fallback / (rust_ok + rust_fallback)` is the canary's health
  signal.
- **The flag is read per-request** via `useRustCrm()` in
  `src/lib/feature-flags/use-rust-crm.ts`. Flipping `USE_RUST_CRM` requires no
  redeploy on Vercel (env-var change triggers a regeneration only).

Carve-outs (see §7) bypass the Rust branch unconditionally.

---

## 2. Log Drain wiring

Docs: https://vercel.com/docs/log-drains

What ops needs to click:

1. Vercel dashboard → project → **Settings → Log Drains → Add Log Drain**.
2. Source: **Runtime Logs** (covers server-action stdout).
3. Destination: pick the team's Grafana Loki / Datadog / Splunk endpoint.
4. Filter (optional): `event=rust_*` to drop noise; the structured logs all
   begin with `{"event":"rust_`.
5. Save and confirm the test delivery lands in the destination.

**Structured log shape** (must remain stable — alerts key off it):

| field          | type                       | required | notes                                     |
| -------------- | -------------------------- | -------- | ----------------------------------------- |
| `event`        | `"rust_ok" \| "rust_fallback"` | yes  | Top-level discriminator                   |
| `entity`       | string                     | yes      | e.g. `"candidates"`, `"invoices"`          |
| `op`           | string                     | yes      | `"list"`, `"get"`, `"create"`, etc.        |
| `errorCode`    | string                     | fallback | Empty on `rust_ok`                         |
| `status`       | `"ok" \| "fallback"`       | yes      | Mirrors `event` for easier filtering       |
| `ts`           | ISO-8601 string            | yes      |                                           |
| `tenantUserId` | string                     | optional | Omitted when not in request scope          |

Do **not** include raw payloads or PII. Action wrappers strip args before
logging.

---

## 3. Alert rule

Single SLO, evaluated on the Log Drain destination:

```
fallback_rate = count(event="rust_fallback") / count(event=~"rust_.*")
                 over a 10-minute trailing window
```

| level | threshold | action                                           |
| ----- | --------- | ------------------------------------------------ |
| info  | ≥ 0.2%    | warn channel (#sabnode-crm-canary)               |
| warn  | ≥ 0.5%    | page secondary on-call                           |
| page  | ≥ 1.0%    | page primary on-call → rollback decision in 15m  |

Tune the window only with sign-off from the CRM owner. Below ~50 events / 10m
the ratio is noisy; gate the rule on `count(event=~"rust_.*") ≥ 50` to suppress
low-traffic flapping at night.

A separate **per-entity** breakdown panel is recommended (group by `entity`,
`op`) so a single bad crate doesn't get hidden inside a healthy aggregate.

---

## 4. Canary cutover steps

Run in order. Each step is a checkpoint — do not advance until the previous one
is green.

### 4.1 Pre-flight (local / CI)

```bash
cd rust
cargo check --workspace
cargo test  --workspace
```

Both must be clean on the merge commit. Any failure aborts the cutover.

### 4.2 Staging flip

1. Set `USE_RUST_CRM=true` in the **Preview** environment on Vercel.
2. Redeploy the staging branch (env-var changes need a fresh build for
   server-action bundling).
3. Smoke-test every CRM list page from the staging URL. Minimum coverage:
   - `/dashboard/crm/candidates`
   - `/dashboard/crm/invoices`
   - `/dashboard/crm/banking/bank-transactions`
   - `/dashboard/crm/accounting/balance-sheet`
   - any module the diff touched
4. Tail staging logs for 30 min under synthetic load and confirm
   `rust_fallback` rate is < 0.1%.

### 4.3 Log Drain + alert

5. Configure the Log Drain per §2 against the **Production** project.
6. Add the alert rule per §3. Trigger a synthetic fallback (toggle the flag
   off-on in staging, hit a known-broken op) to confirm the alert fires.

### 4.4 Production canary

7. Roll out via Vercel **Rolling Releases** or the team's traffic-split tool:
   - **Day 0:** 5% of production traffic on `USE_RUST_CRM=true`.
   - **Day 2 (clean):** 50%.
   - **Day 4 (clean):** 100%.
   "Clean" = fallback rate stayed below the warn threshold the entire window.
8. Hold at 100% for **two full weeks** before declaring the canary done.

### 4.5 Cleanup sweep

9. After 2 weeks of clean traffic at 100%, remove the Mongo fallback branch
   from every action file. Sweep all `useRustCrm()` call sites — roughly **50
   files** under `src/app/actions/crm-*.ts`. Each PR should touch one logical
   module group and run the matching crate's tests.
10. Once all `useRustCrm()` call sites are gone, delete the helper at
    `src/lib/feature-flags/use-rust-crm.ts` and drop the env var from
    `.env.example` + Vercel project settings.

---

## 5. Rollback

The flag is the rollback. There is no data migration to unwind during the
canary because:

- Audit rows are written on both paths to the same Mongo collection.
- The Rust crates read live data; they do not maintain a shadow store.

**To roll back:**

1. Vercel → Production env vars → set `USE_RUST_CRM=false`.
2. Redeploy (Vercel will queue automatically on env change; force it if
   urgent).
3. Confirm the alert clears within one 10-min window.
4. Open an incident, attach the offending log lines (filter
   `event="rust_fallback"`), assign to the CRM owner.

No customer-facing data is lost. Audit retention continues to run regardless of
the flag (see §6).

---

## 6. Audit retention cron

The `/api/cron/audit-retention` route is registered in `vercel.json` to run
daily at **03:00 UTC**. It is auth-gated by `CRON_SECRET` (set this in Vercel
project env — see `.env.example` for the contract).

- **Default mode is dry-run.** The route reports what it *would* delete and
  exits 200 without mutating Mongo.
- **To perform live deletes**, ops must invoke it manually with `?execute=1`
  appended:

  ```
  curl -H "Authorization: Bearer $CRON_SECRET" \
       "https://<prod-host>/api/cron/audit-retention?execute=1"
  ```

  This is intentional — we don't want a scheduled job to silently purge audit
  history. The cron's role is to surface retention drift; the destructive step
  is a human decision.

---

## 7. Known carve-outs

These intentionally do **not** flow through the Rust path. Do not "fix" them
during the cleanup sweep.

### 7.1 `crm-roles` — migration gate

The Rust `crm-roles` crate expects the canonical role-key schema. Tenants
created before 2026-04 may carry legacy keys.

**Action required before flipping the flag for a tenant**: run
`scripts/migrations/` (the `crm-roles-*` script set) for that tenant. The
migration is idempotent. The `crm-roles` action falls back to Mongo for any
tenant whose migration marker is absent, so forgetting this is a soft failure
(it shows up as `rust_fallback` noise) — but if the noise floor exceeds the
alert threshold, run the migration before tuning thresholds.

### 7.2 Bulk operations stay on Mongo forever

The following ops are explicit Mongo-only and have no Rust counterpart:

- `bulkGenerateForm16` (payroll year-end fan-out)
- `importBankTransactionsCsv` (multi-MB CSV parsing + dedupe)
- Any other action whose comment contains `// MONGO-ONLY: bulk`

Rationale: these are long-running, batch-shaped, and the legacy stream-parser
beats the round-trip overhead of the Rust client. Keep them as-is and exclude
their files from the §4.5 sweep.

---

## 8. Quick reference

| What                       | Where                                                  |
| -------------------------- | ------------------------------------------------------ |
| Flag                       | `USE_RUST_CRM` (Vercel project env)                    |
| Flag helper                | `src/lib/feature-flags/use-rust-crm.ts`                |
| Action wrappers            | `src/app/actions/crm-*.ts`                             |
| Rust crates                | `rust/crates/crm-*`                                    |
| Cron secret                | `CRON_SECRET` (Vercel project env)                     |
| Retention cron             | `/api/cron/audit-retention` (daily 03:00 UTC, dry-run) |
| SLA breach cron            | `/api/cron/sla-breach-check` (every 5 min)             |
| Log Drain docs             | https://vercel.com/docs/log-drains                     |
| Alert key                  | `event="rust_fallback"` / `event=~"rust_.*"`           |
| Role migration scripts     | `scripts/migrations/crm-roles-*`                       |
