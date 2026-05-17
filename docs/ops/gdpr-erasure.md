# GDPR Erasure Runbook

This runbook documents the SabNode CRM right-to-be-forgotten (GDPR
Art. 17) erase-request workflow. It covers who can file a request, how
the approval flow works, the per-subject cascade rules, the legal-hold
gate, and how the chained-hash audit ledger proves the workflow is
tamper-evident.

It is the operational complement to:

- `src/app/actions/crm-erase-requests.actions.ts` — server actions.
- `src/app/dashboard/crm/settings/gdpr/removal-requests/page.tsx` — list UI.
- `src/app/dashboard/crm/settings/gdpr/removal-requests/[id]/page.tsx` — detail + execute.
- `src/app/dashboard/crm/settings/gdpr/removal-requests/new/page.tsx` — file a request.
- `src/lib/compliance/audit-log.ts` — chained-hash ledger.
- `src/lib/compliance/legal-hold.ts` — legal-hold flags.

## TL;DR

```
file → pending → approve → approved → dry-run → execute → executed
                ↘ reject       ↘ legal-hold       ↘ failed
                  rejected         block
```

Every transition writes a row to the `audit_events` capped collection
with a SHA-256 hash that links to the previous tenant entry. Tampering
with any historical row breaks the chain; `verifyChain()` from
`src/lib/compliance/audit-log.ts` walks the chain and returns the
index of the first divergence.

## Roles

| Role | Permission key | Can file | Can approve / reject | Can execute |
|------|----------------|----------|----------------------|-------------|
| DPO / Privacy admin | `crm_gdpr: create + edit + delete` | yes | yes | yes |
| CRM admin | `crm_gdpr: create + edit` | yes | yes | no |
| CRM operator | `crm_gdpr: view + create` | yes | no | no |
| Read-only auditor | `crm_gdpr: view` | no | no | no |

The permission module key `crm_gdpr` is not yet registered in
`src/lib/permission-modules.ts`. It will be added in the next batch
registration along with the other §6 keys. Until then the guard fails
closed for everyone except project owners, which is intentional — an
unregistered key with an irreversible side-effect must default to
deny.

## Approval flow

1. **File.** Operator picks a subject (contact / lead / employee), a
   scope (`soft_redact` or `hard_delete`) and an optional reason. The
   server stores a `crm_erase_requests` row with `status='pending'`
   and snapshots the subject's legal-hold state (a hold applied
   *after* filing is re-checked at execute time).
2. **Approve.** A second user with `crm_gdpr:edit` reviews and
   approves. Legal-hold subjects cannot be approved. The audit row
   records the approver.
3. **Dry-run.** Any reviewer with `crm_gdpr:view` runs the dry-run.
   The server scans every collection in the cascade set, counts
   matching rows, and stores `{ collectionsScanned, rowsAffected[] }`
   on the request. **The dry-run is mandatory before execution** —
   the UI hides the Execute button until a report exists, and the
   server refuses the call.
4. **Execute.** A user with `crm_gdpr:delete` confirms. The action
   requires `{ confirm: true }` and an `approved` status; it also
   re-checks legal hold. Execution writes a per-step log to
   `executionLog[]` and flips status to `executed` (or `failed`).

## Cascade set

Per subject kind, the collections + foreign-key fields touched. The
`owned` column indicates whether the row is wholly owned by the
subject — those rows are hard-deleted under `hard_delete`. Non-owned
rows are also deleted under `hard_delete` (legal: a subject's data
must be erased even when it lives on a co-owned row), and PII-redacted
under `soft_redact`.

### Contact

| Collection | Field | Owned |
|------------|-------|-------|
| `crm_contacts` | `_id` | yes |
| `crm_tasks` | `contactId` | no |
| `crm_notes` | `contactId` | no |
| `crm_activity` | `contactId` | no |
| `crm_attachments` | `contactId` | no |
| `crm_deals` | `contactId` | no |
| `crm_tickets` | `contactId` | no |
| `crm_invoices` | `contactId` | no |
| `crm_emails` | `contactId` | no |
| `crm_calls` | `contactId` | no |

### Lead

| Collection | Field | Owned |
|------------|-------|-------|
| `crm_leads` | `_id` | yes |
| `crm_tasks` | `leadId` | no |
| `crm_notes` | `leadId` | no |
| `crm_activity` | `leadId` | no |
| `crm_attachments` | `leadId` | no |
| `crm_emails` | `leadId` | no |
| `crm_calls` | `leadId` | no |
| `crm_interviews` | `leadId` | no |

### Employee

| Collection | Field | Owned |
|------------|-------|-------|
| `crm_employees` | `_id` | yes |
| `crm_tasks` | `employeeId` | no |
| `crm_notes` | `employeeId` | no |
| `crm_attachments` | `employeeId` | no |
| `crm_attendance` | `employeeId` | no |
| `crm_shifts` | `employeeId` | no |
| `crm_payroll` | `employeeId` | no |
| `crm_documents` | `employeeId` | no |
| `crm_appraisals` | `employeeId` | no |
| `crm_leaves` | `employeeId` | no |

### PII fields redacted under `soft_redact`

```
name, firstName, lastName, fullName,
email, phone, mobile, whatsapp,
address, street, city, postalCode,
dateOfBirth, nationalId, taxId,
note, description
```

Each field is replaced with the sentinel `[redacted-gdpr-<requestId>]`.
`gdprRedactedAt` (ISO) and `gdprRequestId` are also written so a
forensics review can trace any row back to the request.

## Legal-hold gate

A row in `legal_holds` whose scope matches the subject (by
`subjectKind` + `subjectId`, or a wildcard `subjectId: '*'`) blocks
both approval and execution. The flag is snapshotted at filing and
re-checked at execution time — a hold applied between approve and
execute will refuse the execute call and flip status to `failed`.

To file a request for a held subject, release the hold first via
`releaseHold()` in `src/lib/compliance/legal-hold.ts` (this itself
goes through the audit ledger).

## Env-gate for actual deletion

**By design, `executeEraseRequest` does not mutate data unless the
environment variable `GDPR_EXECUTION_ENABLED` is set to the literal
string `true`.** This is a defence-in-depth control for the initial
rollout:

- Without the env, the action walks the full deletion code path,
  computes what it *would* mutate, writes the per-step `executionLog`
  (each step suffixed with `→ env-gated: skipped mutation`), and
  marks the request as `executed` with `executionMode: 'env_gated_logged_only'`.
- With the env, the same path runs but issues `deleteMany` /
  `updateMany` and records the actual modified count in the log. The
  request is marked `executed` with `executionMode: 'mutated'`.

Either way the audit ledger gets the same
`gdpr_erase_request.execute` row.

**Production cutover checklist:**

1. Verify the cascade map covers every collection that holds PII for
   the subject kinds. Run at least one dry-run against each subject
   kind in staging and inspect the report.
2. Confirm at least one `legal_holds` row exists and that an erase
   against a held subject is refused.
3. Confirm the audit chain verifies clean with `verifyChain()` in a
   read-only console session.
4. Flip `GDPR_EXECUTION_ENABLED=true` in the production environment.
5. Run a single `soft_redact` against a test subject and verify the
   target rows have sentinel values and `gdprRedactedAt`.
6. Run a single `hard_delete` against a test subject and verify the
   rows are gone from every collection in the cascade.

## Audit-log immutability

The audit ledger lives in `audit_events`, a capped collection
(1 GiB) with three indexes (`tenantId+ts`, `tenantId+action+ts`,
`tenantId+resource+ts`). Each row carries:

- `prev_hash` — the SHA-256 of the previous tenant entry, or
  `0…0` for the genesis entry.
- `hash` — `SHA-256(prev_hash || '|' || canonicalize(payload))`.

`canonicalize()` is a stable JSON encoder that sorts object keys
recursively so the same logical payload always hashes identically.

`verifyChain(events)` walks the chain in chronological order and
returns the index of the first row whose `prev_hash` or `hash` does
not match. If the return value is `-1` the chain is intact end-to-end.

**Tampering with one row breaks every row after it.** A bad actor
who edits a historical `gdpr_erase_request.execute` row also has to
recompute every subsequent row's hash *and* keep the chain
self-consistent — which is detectable as a divergence from any
external attestation (e.g. periodic SHA-256 of the head row, written
to a sealed log).

## Operational queries

```js
// Most recent erase requests for tenant T.
db.crm_erase_requests.find({ tenantUserId: ObjectId('…') })
    .sort({ requestedAt: -1 }).limit(50);

// Anything blocked on legal hold.
db.crm_erase_requests.find({ legalHold: true, status: { $in: ['pending', 'approved'] } });

// Verify the audit chain for tenant T.
const events = await db.audit_events
    .find({ tenantId: 'T' })
    .sort({ ts: 1 })
    .toArray();
const bad = verifyChain(events);
// bad === -1 → chain is intact.
```

## Incidents

If an execute fails midway:

1. Status is set to `failed` and the `executionLog` carries the
   error.
2. The audit chain still records the attempt — no entry is dropped.
3. Re-running the request is **not** automatic. The DPO must inspect
   the log, fix whatever caused the failure (usually a Mongo
   connectivity blip), and file a fresh request — the original
   `failed` row is left in place as a permanent record.

If the chain verification fails:

1. Treat as a security incident.
2. Snapshot `audit_events` to cold storage.
3. Engage Privacy + Security teams. Do not run `verifyChain` against
   a tampered live ledger to "see how bad it is" — that result is
   meaningless without an external attestation.
