# ADR — SabFlow KMS / KEK Abstraction (Track B · Phase 5 · §3)

**Status:** Proposed
**Date:** 2026-05-18
**Owner:** SabFlow / Track B Phase 5
**Phase branch:** worktree `worktree-agent-ab4a8321c9a93b94a`
**Source file:** `src/lib/sabflow/executor/credentials/kms.ts`
**Sibling ADRs:**
- `sabflow-credentials-schema.md` — §1, the schema whose `kek` field this abstraction resolves.
- `sabflow-credentials-crypto.md` — §2 sibling that consumes KEK material to wrap/unwrap per-row DEKs. *(Forward-reference: not yet merged at the time of writing — see §7.2.)*
- Operational counterpart: `docs/runbooks/sabflow-credentials-kms-rotation.md` (how operators provision, rotate, and burn KEKs; incident response for leaks).

---

## 1. Goal (≤200 words)

Define a **pluggable Key-Encryption-Key resolver** so the SabFlow credential store can fetch KEK material at runtime without hard-coding `process.env` reads anywhere outside this module. The schema (§1) wraps each per-row Data-Encryption Key with a KEK; the crypto module (§2) needs 32 bytes on demand to wrap/unwrap; rotation needs a way to enumerate and mint keys. Centralising those three operations behind one `Kms` interface (`getKek`, `generateKek`, `listKeks`) gives us a single swap point for the **eventual Vercel Marketplace KMS integration** (AWS KMS, Google Cloud KMS, or equivalent) without rewriting either the crypto module or the rotation worker. Two implementations ship: `EnvKms` reads `SABFLOW_KEK_<id>` from Vercel env vars and is the production default; `VercelMarketplaceKms` is a typed stub that throws on use and exists purely to document the swap point. Backend selection is one env var: `SABFLOW_KMS_BACKEND` (`'env'` default, `'marketplace'` once the integration lands). A `rotateAll({ from, to, dryRun? })` orchestrator delegates per-row re-wrapping to the crypto module, so this file owns key *resolution* and *enumeration* only — it never sees plaintext credential bytes.

## 2. Scope & non-goals

**In scope (owned by `kms.ts`):**

- The `Kms` interface and the `KekMetadata` shape (`id`, `source`, `observedAt`, `deprecated?`).
- `EnvKms` — the default backend reading `SABFLOW_KEK_<id>` env vars.
- `VercelMarketplaceKms` — the typed stub for the future Marketplace integration.
- `getKms()` factory + the shared `kms` singleton (selected by `SABFLOW_KMS_BACKEND`).
- `rotateAll({ from, to, dryRun? })` orchestrator (cursor iteration over `sabflow_credentials` + per-row delegation).
- The forward-decl shim (`__setRotateCredentialImpl`, lazy `./crypto` import) that lets this file land before §2 publishes `rotateCredential`.

**Out of scope (owned by siblings):**

- The actual AES-256-GCM wrap/unwrap of DEKs and the per-row `rotateCredential(credentialId, { from, to })` primitive — `./crypto.ts` (Phase 5 §2).
- Operational procedure (cadence, dry-run discipline, rollback window, incident response) — `docs/runbooks/sabflow-credentials-kms-rotation.md`.
- The Mongo schema and field-level types — `./schema.ts` (Phase 5 §1).
- The Vercel Cron entry that calls `rotateAll` on the 90-day schedule — Phase 5 §6 + `vercel.json`.
- Audit-log emission for `cred.write` rotation events — `./audit.ts` (already shipped).
- RBAC gating of who can call `rotateAll` (`sabflow.credential.admin`) — `./rbac.ts` (already shipped).

## 3. Why an abstraction, not direct `process.env`

The naive design reads `process.env[\`SABFLOW_KEK_${id}\`]` inline from the crypto module. It works on day one but locks us into a single backend and a single resolution strategy. Three problems become expensive later:

1. **Marketplace migration.** SabNode IS a Vercel project (`CLAUDE.md` → "Deployment platform"). The Marketplace is the preferred path for managed services — when a KMS listing becomes viable, the install flow auto-provisions secrets as env vars *of the integration*, not as `SABFLOW_KEK_*`. Without an abstraction, every call site has to change. With one, only the implementation behind `getKek` changes — and `SABFLOW_KMS_BACKEND=marketplace` flips the factory.
2. **Caching.** `EnvKms` keeps a `Map<string, Buffer>` of decoded keys so we don't re-`Buffer.from(_, 'base64')` on every credential read. That cache belongs on the resolver, not at every call site.
3. **Testing.** Tests inject a fake `Kms` (or use `__setRotateCredentialImpl` for the rotation path) without monkey-patching `process.env`. Test isolation is much cleaner when the production code already accepts a contract.

The cost is one indirection (`kms.getKek(id)` vs `process.env[...]`) and roughly forty lines of class scaffolding — paid once.

## 4. The `Kms` interface

```ts
interface Kms {
  getKek(id: string): Promise<Buffer>;                       // exactly 32 bytes
  generateKek(): Promise<{ id: string; key: Buffer }>;       // mint, return; caller persists
  listKeks(): Promise<KekMetadata[]>;                        // visibility
}
```

Three operations, no more. The contract is deliberately minimal:

- **`getKek` always returns 32 bytes** (AES-256 key length). `EnvKms.decodeKekBase64` enforces this on the env path — a typo'd value that decodes to anything other than 32 bytes throws immediately, so weak crypto is impossible to produce by accident.
- **`generateKek` mints, but does not store.** The implementation picks the id (date-stamped UTC ISO, no separators) and returns the freshly randomised bytes. Persisting the key is an *operator* action (`vercel env add SABFLOW_KEK_<id>`) — the runtime cannot write to Vercel's env store, and forcing the operator to do so is the right safety property: the key is reviewed before it lands in production.
- **`listKeks` is best-effort enumeration.** For `EnvKms` that's a `Object.keys(process.env)` filter. For a future Marketplace backend it's whatever listing API the integration exposes. Returned `KekMetadata` carries `id`, `source` (`'env'` | `'marketplace'`), and `observedAt` — never the raw bytes.

Callers MUST NOT log, persist, or transmit the returned `Buffer`. This is a contract obligation enforced by code review, not by the type system.

## 5. `KekMetadata` shape and the `deprecated` flag

```ts
interface KekMetadata {
  id: string;                        // e.g. "20260518" or "v3"
  source: 'env' | 'marketplace';     // which backend can resolve it
  observedAt: Date;                  // when this process first saw it
  deprecated?: boolean;              // informational only — see below
}
```

`deprecated` is intentionally **informational**. Nothing in the codepath gates on it — `getKek` will happily return a deprecated KEK's bytes, `rotateCredential` will happily wrap under it, and the executor will happily decrypt rows sealed against it. The flag exists so operators can mark a KEK as "successor rolled in; keep around for the 30-day rollback window" (runbook §5) and have that visible in `listKeks()` output for dashboards and audit. Gating reads on `deprecated` would break the rollback property (`rotateAll({ from: to, to: from })` must still work against a KEK an operator already labelled deprecated). The runbook explicitly calls this out — see runbook §5: *"the `KekMetadata.deprecated` flag is informational; nothing in the codepath gates on it"*.

If a KEK must be *forbidden*, the operator removes it (`vercel env rm SABFLOW_KEK_<id>`) and `getKek` will throw a typed not-set error on the next call. That's the enforcement boundary.

## 6. The two ship-with backends

### 6.1 `EnvKms` — production default

Reads `SABFLOW_KEK_<id>` from `process.env`. Each value is base64-encoded 32 random bytes. The decoder rejects anything other than 32 bytes post-decode to make typos loud rather than silent.

The KEK *material* never lives in Mongo. Only the KEK *id* is persisted in the credential row's `kek` field (per schema §1). That separation is what makes envelope encryption useful: a Mongo dump alone is unrecoverable, and the env vars (which are not in the dump) are managed by Vercel's secret store with its own access controls and audit trail (`vercel team activity` — runbook §6).

`generateKek` produces an `id` of `YYYYMMDD` (the runbook documents suffixing `-rN` when minting multiple in one day; that suffix is an operator convention, not a property of this code). The returned `{ id, key }` is meant to be piped directly into `vercel env add SABFLOW_KEK_<id> production`.

`listKeks` scans `process.env` for the prefix and reports each match with `source: 'env'`. The `observedAt` timestamp is "when this process first asked" — best-effort, not authoritative; the runbook never relies on it for compliance ordering.

### 6.2 `VercelMarketplaceKms` — stub

Three methods that all call `throwNotConfigured()` with a message that says exactly what to do: install a Marketplace KMS integration, fill in the class, or fall back to `SABFLOW_KMS_BACKEND=env`. The stub exists for three reasons:

1. **Type-level documentation.** Anyone reading `kms.ts` sees the swap point as a class, not as a TODO comment.
2. **Compile-safe factory branch.** `getKms()` can `return new VercelMarketplaceKms()` without conditional imports.
3. **No silent degrade.** If someone sets `SABFLOW_KMS_BACKEND=marketplace` before the integration is implemented, the system fails loudly on first credential access rather than silently rolling out broken crypto.

### 6.3 Backend selection

```ts
const backend = process.env.SABFLOW_KMS_BACKEND ?? 'env';
if (backend === 'marketplace') return new VercelMarketplaceKms();
return new EnvKms();
```

One env var, two values. Unknown values fall through to `EnvKms` — that's deliberately permissive so a typo doesn't take production down; `EnvKms` is the safe default.

The shared `kms` singleton is constructed once at module load and reused so `EnvKms`'s decoded-buffer cache stays warm.

## 7. The `rotateAll` orchestrator

### 7.1 Shape

```ts
rotateAll({ from, to, dryRun? }): Promise<{
  rotated: number,
  failed: Array<{ credentialId: string; error: string }>
}>
```

Three behaviours, in order:

1. **Fail fast.** Validates `from`, `to`, and `from !== to` synchronously, then resolves *both* KEKs via `kms.getKek` before touching Mongo. A typo in either id throws before a single row is read.
2. **Dry-run.** If `dryRun: true`, runs `countDocuments({ kek: from })` and returns. No writes, no per-row work, safe from any environment with read access. Runbook §4 mandates dry-run before every real rotation.
3. **Real rotation.** Opens a cursor on `{ kek: from }` with `{ _id: 1, kek: 1 }` projection, calls `rotateCredential(credentialId, { from, to })` per row, and collects per-row failures into `failed[]`. Failures **do not abort the run** — one bad row cannot strand the rest of the fleet. Operators triage the `failed` list against runbook §6.

The actual DEK unwrap/re-wrap is delegated to `./crypto.ts` (§2 sibling). `kms.ts` only orchestrates the cursor, the delegation, and the result accumulation. This separation is what keeps the KMS module free of any plaintext or DEK bytes — it sees credential ids and KEK ids, nothing else.

### 7.2 The `crypto.ts` forward-decl

At the time of writing, the §2 sibling (`./crypto.ts`'s `rotateCredential`) has not landed. To let §3 merge independently, `kms.ts` declares a local `RotateCredentialFn` type and resolves the real implementation lazily:

- `__setRotateCredentialImpl(fn)` — exported test seam; also the one-line wire-up once §2 publishes the symbol.
- `loadRotateCredential()` — lazy `await import('./crypto')`; if the symbol isn't exported, throws a clear error pointing at §2.

This shim is **temporary**. Once `./crypto.ts` is merged with its `rotateCredential` export, the shim is replaced by a top-of-file `import { rotateCredential } from './crypto'` and `loadRotateCredential` / `__setRotateCredentialImpl` are deleted in a follow-up. The decision-log row below records the cleanup obligation.

## 8. Why KEK material never lives in Mongo

A single sentence: *Mongo holds the row's `kek` field (an id) and the row's `dataEncrypted` (the envelope), but never the bytes that turn one into the other.*

The consequences:

- A Mongo dump alone is unrecoverable. The attacker also needs Vercel env access (or the Marketplace integration's IAM principal).
- KEK rotation is O(rows) of cheap writes — re-wrap 60 bytes per row, never the ciphertext (schema §3.1).
- A leaked KEK exposes only the credentials whose envelopes were *also* exfiltrated (paired-leakage); a leaked Mongo dump without env access exposes none.
- The `Kms` interface's read shape (`getKek(id) → Buffer`) is the *only* path from a row's `kek` field to usable bytes. There is no Mongo-resident fallback; if env is unset, decryption fails loudly.

## 9. Marketplace-KMS upgrade path

When a Vercel Marketplace KMS listing becomes the better answer (managed rotation, hardware-backed keys, dedicated audit trail), the migration is mechanical:

1. **Install** the Marketplace integration from the Vercel dashboard. Env vars are auto-provisioned by the integration; no manual `vercel env add` needed.
2. **Implement** `VercelMarketplaceKms` against the integration's SDK / REST surface (replace the three `throwNotConfigured()` bodies). The method signatures do not change — `getKek` still returns a `Buffer`, `generateKek` still returns `{ id, key }`, `listKeks` still returns `KekMetadata[]`.
3. **Flip** `SABFLOW_KMS_BACKEND=marketplace` via `vercel env add`.
4. **Migrate** existing rows by calling `rotateAll({ from: <env-kek-id>, to: <marketplace-kek-id> })` — same primitive, same runbook §5 procedure, same 30-day rollback window.

No call-site changes. No schema changes. No rotation-worker changes. That is the entire point of the abstraction.

## 10. Constraints honoured

- **No new dependencies.** Imports are `node:crypto` (built-in), `mongodb` (already in `package.json` for cursor iteration), and the in-repo `@/lib/mongodb` connector. The Marketplace stub adds nothing — it's a class with three throwing methods.
- **`server-only`.** First non-comment line is `import 'server-only';` — this module cannot leak into a client bundle. KEK bytes never reach the browser.
- **Vercel-native.** KEKs are first-class env vars provisioned via `vercel env add`, never committed, never in `.env.example`. The Marketplace path is the *preferred upgrade* per `CLAUDE.md` → "Deployment platform — Vercel". No external KMS service account, no hand-rolled provider setup.
- **No node-cron / agenda / Bull.** Periodic rotation is scheduled via Vercel Cron pointing at a server action that calls `rotateAll` — this file owns the primitive, not the schedule.
- **No model registration here.** `kms.ts` reads `sabflow_credentials` via the existing connector; it does not declare indexes or open its own collection. Phase 5 §3 (the credentials data layer) owns that.

## 11. Decision log

| Date | Event | Notes |
| --- | --- | --- |
| 2026-05-18 | KMS abstraction landed | `Kms` interface + `EnvKms` (default) + `VercelMarketplaceKms` stub + `rotateAll` orchestrator. |
| 2026-05-18 | `deprecated` flag is informational | Confirmed against runbook §5; nothing in the codepath gates on it, so rollback (`rotateAll({ from: to, to: from })`) keeps working against a flagged KEK. |
| 2026-05-18 | `crypto.ts` forward-decl shim accepted | `__setRotateCredentialImpl` + lazy `./crypto` import; cleanup obligation: delete once Phase 5 §2 merges and replace with a direct top-of-file import. |
| TBD | Marketplace KMS adopted | Implement `VercelMarketplaceKms`, flip `SABFLOW_KMS_BACKEND=marketplace`, run `rotateAll` to migrate. Record listing name and integration version here. |
