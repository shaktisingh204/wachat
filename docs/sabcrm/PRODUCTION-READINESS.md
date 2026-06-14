# SabCRM — Production Readiness & Cutover Runbook

Status of the beyond-CRUD + email-on-SabMail program (Waves 1–6 + Buckets B/A.1 +
SabMail email). This is the exact, ordered path from "feature-complete, pre-production"
to live. Items marked **[code ✓]** are done + verified; **[ops]** needs the platform
team; **[review]** needs a human sign-off before flipping on.

---

## 1. What is verified (code)

- **[code ✓] Type-clean surface.** Every file created/edited across the program is
  type-clean under a scoped `tsc` (the whole SabCRM surface compiles together with
  zero errors in our files). NOTE: `next.config.js` sets `typescript.ignoreBuildErrors:
  true`, so the production build does not gate on types — these checks are our own
  quality bar, not the build's.
- **[code ✓] ~800 unit tests pass** across the pure modules (scoring, calibration,
  ANN/LSH, dedup, filters, address/threading, dropbox, etc.).
- **[code ✓] Adversarial review** per vertical (compiles / pattern / in-house / safe-degrade).
- **[code ✓] DB indexes** for the new collections are auto-ensured daily (best-effort,
  idempotent) via `ensureSabcrmFeatureIndexes` in the `/api/cron/sabcrm-forecast-snapshots`
  tick; hot collections (api logs, ratelimit, cadence enrollments, snapshots, embeddings)
  self-ensure their own.

## 2. What is NOT yet verified — required before "production ready"

- **[ops] Green `next build`.** Has NOT been run end-to-end here. Run `npm run build`
  (turbopack; `ignoreBuildErrors` means it bundles despite the ~repo-wide pre-existing
  type baseline). Confirm it completes and the SabCRM routes generate.
- **[ops] Integration / e2e on a real tenant.** Server actions/routes/UI were verified
  by types + reading, not by running against live Mongo / the Rust engine / SabMail /
  Redis. Run a Playwright pass + a manual create→edit→email→inbound→automation→report
  flow (browser render needs a real Mongo user).
- **[ops] Load/perf** on the heavy paths: ANN at scale, report aggregations, the CRM inbox.

## 3. Environment variables to provision (`vercel env` / dashboard / `.env`)

| Var | Used by | Notes |
|---|---|---|
| `CRON_SECRET` | all `/api/cron/sabcrm-*` | already required; the `sabnode-cron` worker sends it |
| `SABCRM_TRACK_SECRET` | email open/click tracking | falls back to `AUTH_SECRET`/`NEXTAUTH_SECRET`; unset ⇒ tracking off |
| `SABCRM_SIGN_SECRET` | quote e-sign tokens | falls back to `SABCRM_TRACK_SECRET`/`AUTH_SECRET`; unset ⇒ sharing disabled |
| `SABMAIL_ENABLED` + `SABMAIL_ENGINE_URL` | send-via-SabMail (engine path) | unset ⇒ falls back to the transactional transport |
| `SABCRM_DROPBOX_DOMAIN` | BCC dropbox address | optional; else derived from the tenant's first SabMail domain |
| `AI_GATEWAY_API_KEY` (or `ANTHROPIC_API_KEY`/`OPENAI_API_KEY`) | copilot, NL, qualify, conversation-intel | the existing LLM ladder; unset ⇒ AI degrades honestly |
| `OPENAI_API_KEY` | embeddings (semantic RAG / ANN) | unset ⇒ keyword retrieval fallback |

No NEW infra services are introduced by this program.

## 4. Scheduling — `sabnode-cron` worker (PM2)

All SabCRM crons now run via `scripts/cron-worker.mjs` (PM2 app `sabnode-cron`),
not Vercel Cron: `sabcrm-workflows` (5m), `sabcrm-cadences` (1m), `sabcrm-webhook-retries`
(1m), `sabcrm-sla` (15m), `sabcrm-autocapture` (15m), `sabcrm-forecast-snapshots` (daily;
also runs the index bootstrap). Confirm the worker is running with `CRON_SECRET` +
`APP_BASE_URL` set.

## 5. SabMail email — go-live

- Send: works once `SABMAIL_ENABLED` + engine are up (else transactional fallback).
- **Inbound + BCC-dropbox require MX/inbound routing** for the relevant domain to point
  at `/api/webhooks/sabmail-inbound` (or `/api/webhooks/email-inbound`). Same operational
  prerequisite the existing inbound features already have — no new infra, but it must be
  wired for inbound 2-way + dropbox to actually receive.

## 6. Default-OFF security features — enablement order **[review]**

Sharing rules, territories, field-level security, and OWD/role-hierarchy access
enforcement ship **default-OFF** behind per-project flags. When off, reads are
byte-for-byte identical to today. **Do NOT enable in production without:**

1. **A security review** of the resolver + each tenant's config (sharing targets,
   territory trees, FLS matrices, owner-field coverage).
2. **Two-store gap — now closed in code (still gated on the review above).** The
   read-path enforcement now covers BOTH stores: `resolveAccessFilterParam`
   (`access-readpath.server`) serializes the composed clause and the Rust
   `sabcrm-records` crate `$and`-merges it server-side (`apply_access_filter`,
   `$where`/`$expr`/`$function`/`$accumulator` rejected, 6 unit tests green), plus
   FLS redaction on the returned rows. It is threaded through the central Tw read
   seams (`listSabcrmRecordsTw`, `count`, `group`, `aggregate`, `get`, `related`,
   relation-picker `search-options`). The access POLICY still lives in ONE place
   (the TS engine); Rust only applies the resolved clause. **Remaining seams to
   wire the same way before treating the flag as a hard boundary:** the
   cross-object global `search` endpoint and any bespoke call site that hits
   `sabcrmRecordsApi` directly instead of the Tw seams. The Rust write path
   (create/update/delete) is gated separately and is out of scope for read
   enforcement.
3. **Per-role dry-run** (`dryRunForViewer`) to confirm expected access loss before flip.
4. Rollback is a single toggle (set the flag false ⇒ instant return to today's behavior).

GDPR tooling (consent / DSAR export / right-to-be-forgotten) is live (no flag); erasure
is gated `delete` + type-to-confirm + audit-logged.

## 7. Opt-in feature activation (safe, no review)

- **Predictive win-scoring**: train per object via `/dashboard/settings/crm/predictive`.
- **Semantic RAG / ANN**: call `reindexSemanticTw` to seed a project's embeddings; ANN
  auto-engages above the corpus threshold, brute-force below.
- **Win/loss, value-sets, record-types, lookups, field-deps, cadences, dropbox, etc.**:
  configured from their `/dashboard/settings/crm/*` pages.

## 8. Genuinely out of scope (external dependencies)

Not built — require external contracts/infra, integrate when forced behind adapters:
**telephony/CTI + call recording** (voice infra), **SSO/SCIM/MFA** (identity provider),
**business-card OCR** (vision). CDC realtime indexers are scaffolded but need a Mongo
replica set + Redis + a worker to run.

---

**Bottom line:** the CRM is feature-complete, type-clean, and unit-tested in-house. Before
calling it production-ready, complete §2 (build + e2e + load), provision §3–§5 (env, cron
worker, SabMail MX), and gate §6 (security review + Rust enforcement parity) before
enabling data-layer access enforcement.
