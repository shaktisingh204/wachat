# ADR — SabFlow Credential Audit Log (Track B · Phase 5 · §7)

**Status:** Proposed
**Date:** 2026-05-18
**Owner:** SabFlow / Track B Phase 5
**Phase branch:** worktree `worktree-agent-af0bb67edc5f71442`
**Source file:** `src/lib/sabflow/executor/credentials/audit.ts`
**Sibling ADRs:** `sabflow-credentials-schema.md` (§1 — §6 enumerates the `cred.*` triggers this module emits), `sabflow-credentials-resolver.md` (§4 — runtime caller of `cred.read`), `sabflow-credentials-oauth2-refresh.md` (§5 — caller of `cred.refresh`).

---

## 1. Goal (≤200 words)

Define the **credential-specific audit emitter** consumed by every read / write / share / test / refresh path in the credential subsystem. The module is a deliberately *thin wrapper* around the already-shipped SabFlow audit infrastructure (`src/lib/sabflow/audit/middleware.ts` → `src/lib/sabflow/audit/db.ts` → `sabflow_audit_log` Mongo collection). It never reshapes the persisted schema; it funnels credential lifecycle events into the existing collection under a tightly-typed `cred.*` action namespace. Three hard rules govern every line: (a) **audit must never break the user action** — every persistence call is try/catch + log + swallow; (b) **never persist plaintext** — a `META_WHITELIST` enforces, at both the TypeScript and runtime layers, that secrets / OAuth tokens / refresh tokens cannot reach Mongo; (c) **hash the credential id** — a salted SHA-256 lives in both `target` and `metadata.credentialHash` so audit rows survive a GDPR / DSR purge of the underlying credential. A per-execution daily rate cap on `cred.read` (the only hot-path event) keeps a tight inner loop from flooding the collection. No new dependencies; no model registered; `server-only` import.

## 2. Scope & non-goals

**In scope (owned by this file):**

- TypeScript types: `CredentialAuditAction`, `CredentialAuditMeta`, `RecordCredentialAuditInput`.
- The `cred.*` action union (`read`, `write`, `delete`, `share`, `unshare`, `test`, `refresh`).
- The `META_WHITELIST` (`ALLOWED_META_KEYS`) and the `sanitiseMeta` stripper.
- Salted SHA-256 hashing of `credentialId` (`hashCredentialId`, `CRED_HASH_SALT`).
- The in-process per-execution daily rate cap for `cred.read` (`READ_DAILY_CAP`, `POST_CAP_SAMPLE_EVERY`, `consumeReadBudget`, `readCounters`).
- The single public entry point `recordCredentialAudit`.
- A test-only reset helper (`__resetCredentialAuditRateCapForTests`).

**Out of scope (owned elsewhere):**

- The audit collection itself, indexes, and the generic writer — `src/lib/sabflow/audit/db.ts`.
- The cross-module audit middleware (`recordFlowAction`) — `src/lib/sabflow/audit/middleware.ts`.
- The doc-level (workflow / node / execution) audit emitter — `src/lib/sabflow/persistence/audit.ts`.
- The credential schema this file references by id — Phase 5 §1 (`./schema.ts`).
- Who *calls* the emitter — Phase 5 §3 (CRUD), §4 (resolver), §5 (OAuth2 refresh), §7 (test runner), §10 (REST surface).
- RBAC checks — `./rbac.ts` (already shipped); audit is unconditional once the gate has been passed.

## 3. Why a wrapper, not a fresh collection

The pre-existing `sabflow_audit_log` collection (with its `userId` / `workspaceId` / `action` / `target` / `metadata` / `timestamp` shape, its TTL, its compound indexes, and its `recordFlowAction` writer) is already battle-tested across SabFlow's workflow, node, and execution audit paths. Adding a parallel `sabflow_credential_audit` collection would force every audit reader (admin UI timeline, GDPR export, security dashboards) to JOIN across two stores for one logical view. Instead:

- This file **maps** every credential event onto the existing schema (`action` ∈ `cred.*`, `target` = hashed credentialId, `metadata.credentialHash` = same hash for indexability).
- The underlying writer is reused verbatim — `action` on `recordFlowAction` is typed as `AuditAction | string`, so the `cred.*` strings flow through without a schema bump.
- The conceptual parallel is `src/lib/sabflow/persistence/audit.ts` (doc-level audits) — this file is the **executor-layer analogue** for credentials.

The cost is one indirection in the call chain; the benefit is one collection, one reader, one TTL policy, and one set of indexes for every audit row in SabFlow.

## 4. The `cred.*` action namespace

The credential subsystem emits seven discrete actions. They are deliberately namespaced `cred.*` (not `credential.*`) to keep them distinct from the pre-existing `AuditAction` lifecycle events (`credential.created` / `credential.updated` / `credential.deleted`), which track *administrative* changes; these `cred.*` actions track *access* — read / write / share / test / refresh on a live record.

| Action | Emitter | Source values | Notes |
| --- | --- | --- | --- |
| `cred.read` | Resolver (`./resolver.ts`, Phase 5 §4) | `'runtime'`, occasionally `'ui'` / `'api'` | **Rate-capped.** Fires every time a node calls `ctx.getCredentials()`. |
| `cred.write` | CRUD (`./db.ts`, Phase 5 §3) | `'ui'`, `'api'` | Create / update. KEK rotation worker also emits this with `metadata.rotation: true`. |
| `cred.delete` | CRUD (`./db.ts`, Phase 5 §3) | `'ui'`, `'api'` | The audit row outlives the credential. |
| `cred.share` | CRUD / share-helper | `'ui'`, `'api'` | ACL grant — workspace, user, or node-type. |
| `cred.unshare` | CRUD / share-helper | `'ui'`, `'api'` | ACL revoke. |
| `cred.test` | Test-connection runner (Phase 5 §7) | `'ui'`, `'api'` | Whether the probe succeeded or not is **not** logged here — only the attempt. |
| `cred.refresh` | OAuth2 refresh worker (Phase 5 §5) | `'runtime'` | Fires on every successful or failed refresh; never carries the new access token. |

The `source` discriminator (`'ui' | 'runtime' | 'api'`) is intentionally three-way — the security dashboard often wants to slice "show me every runtime read of credential X in the last hour" or "every UI-driven write since the breach window opened", and a flat `source` is the cheapest way to support that without joining against the execution store.

## 5. The three hard rules

### 5.1 Audit must never break the user action

The wrapper is **layered try/catch**: the underlying `recordFlowAction` already catches and logs internally, but the public `recordCredentialAudit` re-wraps the call in its own try/catch as belt-and-braces against an unexpected throw in the sanitiser or the hasher. The function always resolves with `undefined` — including on failure — so callers may `await` for ordering guarantees or fire-and-forget; either way an audit-write failure cannot propagate into the caller's user-facing operation.

A defensive guard at the top of the function (missing `workspaceId` / `credentialId` / `action`) logs a `console.warn` and returns early rather than throwing. This is the second layer: the caller is buggy, not the audit infra, but we still refuse to break the user.

### 5.2 Never log plaintext — the `META_WHITELIST`

`CredentialAuditMeta` is the **only** legal shape for caller-supplied metadata. Its keys are:

- `credentialType` — opaque identifier string (e.g. `'oauth2.google'`, `'apiKey.openai'`).
- `scope` — OAuth / API scope descriptor (`string` or `string[]`). Descriptive only; never a token.
- `source` — `'ui' | 'api' | 'runtime'`.
- `nodeType` — the node type that triggered a runtime read (e.g. `'http.request'`, `'gmail.send'`).
- `dropped` — number of dropped reads represented by this row (set by the rate cap; not caller-supplied in practice).

The `ALLOWED_META_KEYS` `Set` enforces this at runtime: `sanitiseMeta` iterates the caller's `meta` and **silently drops** every key that is not in the whitelist. The TypeScript type is `CredentialAuditMeta & Record<string, unknown>` precisely so a careless caller *can* hand in extra keys without a compile error — the runtime stripper then guarantees the audit row never sees them. This is the last line of defence against an accidental `meta: { token: '...' }` slipping through.

What the whitelist deliberately omits: any token (`accessToken`, `refreshToken`, `idToken`), any password / API-key value, any decrypted credential bag, any URL with a secret in the query string, and any response body from a test probe.

### 5.3 Hash the credential id (GDPR survival)

Both the `target` field on the audit row and `metadata.credentialHash` carry a **salted SHA-256** of the raw `credentialId` — never the raw id itself. Properties:

- Salt is sourced from `SABFLOW_CRED_AUDIT_SALT` env (Vercel-provisioned), with a fixed dev fallback (`'sabflow.cred-audit.salt.v1'`) so the hash is reproducible across local restarts.
- A NUL byte (`\x00`) delimits salt from id so `salt|id != salt+id` for crafted inputs.
- The salt is **deliberately non-rotatable**: old audit rows must remain joinable to new ones for the same credential. Rotating it would break the timeline; we treat that as a worse failure than the static-salt downside.
- A later GDPR / DSR purge can drop the credential row, redact `metadata.credentialHash`, or both, without orphaning the audit timeline — the hash is stable as long as the salt and id survive.

The hash is written to both `target` (the canonical "affected resource" field on `sabflow_audit_log`, used by the admin timeline) and `metadata.credentialHash` (for index-friendly grouping). Downstream readers group rows for one logical credential by hash, never by raw id.

## 6. Why `cred.read` is rate-capped but `cred.write` is not

Writes are **rare** — a credential is created once, updated occasionally, deleted at most once. The lifecycle event count is small enough that every write should be preserved in full forever (or until the global audit TTL evicts it).

Reads are **hot-path**. A single workflow execution can plausibly emit:

```
n credentials × m items per node × k nodes
```

…calls to `ctx.getCredentials()`. A modest loop over a thousand-row Google Sheet calling out to a Slack webhook is already an O(thousands)-reads execution; an OAuth2-backed scraper over a large input set is O(tens-of-thousands). Persisting one row per read would (a) bloat the audit collection by 100×–1000× without proportional information gain, (b) push the writer onto the foreground of the executor's tight loop, and (c) make the admin timeline unreadable.

The cap is therefore **applied only to `cred.read`**; `write` / `delete` / `share` / `unshare` / `test` / `refresh` are persisted in full.

## 7. The per-execution daily rate cap

### 7.1 Mechanism

- **Key:** `${executionId}|${UTC-day}`. The cap is scoped to one execution on one UTC day; a long-running execution that crosses midnight gets a fresh budget on the new day.
- **Cap:** `READ_DAILY_CAP = 10_000` reads. Up to and including the 10 000th read, every event is persisted with `dropped: 0` (the field is elided from `metadata` when zero, to avoid polluting normal rows).
- **Post-cap sampling:** `POST_CAP_SAMPLE_EVERY = 100`. From read 10 001 onward, the cap emits a **sentinel row** at read 10 001 (the first over-cap event) and then one row every 100 reads thereafter. Each surviving row carries `metadata.dropped: N` summarising how many reads were dropped since the previous surviving sample.
- **Garbage collection:** when a counter's stored `day` no longer matches `currentUtcDay()`, it is deleted lazily on the next access for that key.

### 7.2 Storage

Counters live in an in-process `Map<string, ReadCounter>`. This is **deliberately not durable**:

- On Vercel Fluid Compute, a fresh warm instance gets a fresh budget. That is correct — each instance pays its own audit cost independently, and the cap is a noise-reduction guardrail, not a security boundary. Bypassing the cap by cycling instances buys an attacker nothing they don't already have via the legitimate read path.
- A cold start zeroes the table; the next read on that instance starts a new counter. Same property.
- We deliberately do **not** reach for Redis / `unstable_cache` / Vercel Edge Config — the cap's correctness budget is approximate, not exact, and the latency cost of a network round-trip in a tight inner loop would defeat the purpose.

### 7.3 Missing `executionId`

When no `executionId` is supplied (UI button click, REST API call, ad-hoc admin tool), the cap **lets every read through** with `dropped: 0`. UI / API reads are vanishingly rare compared to runtime reads, and there is no natural grouping key for them — letting them all persist is both safe and useful.

### 7.4 Test surface

`__resetCredentialAuditRateCapForTests` clears the counter table. It is exported solely so unit tests can deterministically exercise (a) the under-cap path, (b) the boundary at exactly the cap, (c) the first over-cap sentinel, and (d) the post-cap sampling cadence. The function is documented `@internal`; production code must never call it (doing so would silently re-open a budget mid-execution and lose the dropped-count attribution).

## 8. End-to-end write path

```
caller (resolver / CRUD / refresh / test / share)
  │
  ▼
recordCredentialAudit({ workspaceId, credentialId, userId?, executionId?, action, meta? })
  │
  ├── guard: workspaceId & credentialId & action present?  ──no──► console.warn + return
  │
  ├── action === 'cred.read' ?
  │     └── consumeReadBudget(executionId)
  │           ├── under cap         → { dropped: 0 }
  │           ├── over cap, sample  → { dropped: N }
  │           └── over cap, elide   → null  ──► return (silently dropped)
  │
  ├── sanitiseMeta(meta)  → strips anything outside ALLOWED_META_KEYS
  ├── hashCredentialId(credentialId)  → salted SHA-256
  │
  ├── metadata = { ...sanitised, credentialHash, executionId?, dropped? }
  ├── actor    = userId ?? workspaceId
  │
  └── try { await recordFlowAction(action, { userId: actor, workspaceId, target: hash, metadata }) }
      catch { console.error + swallow }
```

The actor fallback (`userId ?? workspaceId`) matches the underlying writer's expectation that `userId` is always populated; for fully-automated paths (KEK rotation worker, OAuth2 refresh on a service-owned credential) the workspace is the most accurate principal we have.

## 9. Cross-references — who calls this

| Caller (Phase 5 §) | Action emitted | Typical `source` | Typical `meta` |
| --- | --- | --- | --- |
| §3 CRUD — create / update | `cred.write` | `'ui'` / `'api'` | `{ credentialType }` (+ `rotation: true` via the KEK worker, which is dropped by the whitelist — the existing infra carries it instead) |
| §3 CRUD — delete | `cred.delete` | `'ui'` / `'api'` | `{ credentialType }` |
| §3 CRUD — share / unshare | `cred.share` / `cred.unshare` | `'ui'` / `'api'` | `{ credentialType }` |
| §4 Resolver — `ctx.getCredentials()` | `cred.read` (rate-capped) | `'runtime'` | `{ credentialType, nodeType }` |
| §5 OAuth2 refresh worker | `cred.refresh` | `'runtime'` | `{ credentialType, scope }` |
| §7 Test-connection runner | `cred.test` | `'ui'` / `'api'` | `{ credentialType }` |

The triggers table in `sabflow-credentials-schema.md` §6 is the source of truth for which actions exist; this file owns *how* each action is persisted.

## 10. Constraints honoured

- **No new dependencies.** Imports are `crypto` (Node built-in) and the in-repo `@/lib/sabflow/audit/middleware`. Nothing added to `package.json`.
- **`server-only` import.** Audit hashing, the rate-cap table, and the writer all stay on the server; the file cannot be pulled into a client bundle (the salted hash + `process.env` access would be meaningless there, and the in-process counters would multiply per RSC island).
- **No model registered.** This file opens zero Mongo connections and creates zero indexes. It defers entirely to `src/lib/sabflow/audit/db.ts` (which owns `sabflow_audit_log` registration) via `recordFlowAction`.
- **Vercel-native env.** `SABFLOW_CRED_AUDIT_SALT` is provisioned via `vercel env`; the dev fallback (`'sabflow.cred-audit.salt.v1'`) keeps local hashes reproducible across restarts without requiring a Marketplace secret manager.
- **Plaintext-free at the type and runtime layer.** `CredentialAuditMeta` cannot, by its type, name a token field; the runtime `ALLOWED_META_KEYS` sanitiser additionally drops any extra key supplied via the `& Record<string, unknown>` escape hatch.

## 11. Decision log

| Date | Event | Notes |
| --- | --- | --- |
| 2026-05-18 | Wrapper landed | Funnels `cred.*` events into the existing `sabflow_audit_log` collection; no schema reshape, no new model. |
| 2026-05-18 | Whitelist + hash + cap fixed | `ALLOWED_META_KEYS` enumerated; salted SHA-256 chosen with a non-rotatable salt; cap set to 10 000 reads/execution/day with 1-in-100 post-cap sampling. |
| 2026-05-18 | Test reset helper exported | `__resetCredentialAuditRateCapForTests` marked `@internal` for unit-test determinism only. |
