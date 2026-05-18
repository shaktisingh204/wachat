# ADR — SabFlow Credential Envelope Crypto (Track B · Phase 5 · §2)

**Status:** Proposed
**Date:** 2026-05-18
**Owner:** SabFlow / Track B Phase 5
**Phase branch:** worktree `worktree-agent-a6defcb94ff0fab00`
**Source file:** `src/lib/sabflow/executor/credentials/crypto.ts`
**Sibling ADRs:** `sabflow-executor-foundation.md` (umbrella), `sabflow-credentials-schema.md` (§1 — the schema this file encrypts), `../runbooks/sabflow-credentials-kms-rotation.md` (operational runbook that drives `rotateCredential`).

---

## 1. Goal (≤200 words)

Provide the **cryptographic primitives** that seal SabFlow executor credentials at rest. Concretely: `encryptCredential(plaintext, kekId)`, `decryptCredential(envelope)`, and `rotateCredential(envelope, fromKekId, toKekId)`, plus the supporting `getKek(kekId)` resolver and the typed `CredentialEnvelope` wire shape. The model is **envelope encryption** — a fresh 256-bit Data-Encryption-Key (DEK) is minted per record and encrypts the JSON-serialized credential under AES-256-GCM; that DEK is then wrapped under a Key-Encryption-Key (KEK) sourced from `SABFLOW_KEK_<id>` (base64-encoded 32 raw bytes) on Vercel env. The KEK never touches Mongo — only the *wrapped* DEK and its `kekId` marker land on the row. Rotation re-wraps **60 bytes per record** (`iv ‖ ct ‖ tag` of the DEK) and leaves the ciphertext immutable, so a workspace-wide rotation is O(rows) of cheap writes with zero plaintext exposure outside the rotation worker. Authenticated encryption means any tamper / wrong-KEK / wrong-record surfaces as a typed `CredentialsError` from a constant-time GCM tag check. No new npm deps — only `node:crypto`. `server-only` import. This file owns crypto, not schema or CRUD.

## 2. Scope & non-goals

**In scope (owned by this file):**

- The `CredentialEnvelope` interface (`ciphertext`, `iv`, `tag`, `dek`, `kekId`) — the persisted wire shape consumed by Phase 5 §3's reader / writer.
- `encryptCredential(plaintext, kekId?)` — serialize + seal.
- `decryptCredential(envelope)` — unwrap DEK then decrypt, with constant-time tag checks at both layers.
- `rotateCredential(envelope, fromKekId, toKekId)` — re-wrap DEK only; ciphertext untouched.
- `getKek(kekId)` — env-var resolver with id validation, base64 decode, and length check.
- The wire-format constants (`IV_LENGTH = 12`, `TAG_LENGTH = 16`, `KEY_LENGTH = 32`, `WRAPPED_DEK_LENGTH = 60`).
- `DEFAULT_KEK_ID = 'v1'` and the `SABFLOW_KEK_<id>` env-var contract.
- Best-effort buffer wipe (`fill(0)`) of transient secrets on every code path.

**Out of scope (owned by siblings):**

- Mongo `CredentialEntity` schema, indexes, and `CredentialType` registry — `./schema.ts` (Phase 5 §1, ADR `sabflow-credentials-schema.md`).
- CRUD repository + collection registration — Phase 5 §3 (explicitly forbidden here).
- OAuth2 refresh worker — Phase 5 §6.
- `testOperation` runner — Phase 5 §7.
- RBAC keys — `./rbac.ts` (already shipped).
- Audit emitter — `./audit.ts` (already shipped).
- Marketplace KMS-backed KEK sourcing (forward-ref via `./kms.ts`) — Phase 5 §11.
- Operational rotation procedure (paging, batching, alerting, runbook) — `../runbooks/sabflow-credentials-kms-rotation.md`.

## 3. Envelope encryption model

### 3.1 Two layers

| Layer | Algorithm | Key | Stored where |
| --- | --- | --- | --- |
| Plaintext → ciphertext | AES-256-GCM | DEK (fresh per record, 32 bytes) | `envelope.ciphertext` + `envelope.iv` + `envelope.tag` |
| DEK → wrapped DEK | AES-256-GCM | KEK (32 bytes, from `SABFLOW_KEK_<id>`) | `envelope.dek` (packed) + `envelope.kekId` |

**Why two layers:**

- KEK rotation re-wraps **60 bytes per row** and never touches the (potentially many KB) ciphertext.
- A leaked DEK exposes one credential — not the whole store.
- The KEK lives in Vercel env (or a Marketplace KMS once Phase 5 §11 lands) and is *never* persisted alongside the data it protects.
- Per-record DEKs mean the rotation worker handles only DEK bytes, never plaintext.

### 3.2 DEK lifecycle

1. **Mint** — `randomBytes(32)` at encrypt time. Never reused.
2. **Use** — feeds a single `createCipheriv('aes-256-gcm', dek, iv)` call.
3. **Wrap** — encrypted under the resolved KEK, also with AES-256-GCM and a fresh IV.
4. **Wipe** — `dek.fill(0)` in the `finally` block of every entry point. JS doesn't guarantee in-place erasure (V8 may have copied the buffer), but this is strictly better than leaving raw DEK bytes lying around in the GC graph.

The DEK never leaves the function frame that minted (or unwrapped) it.

## 4. Wire format

Per the schema ADR §3.2, the persisted envelope is conceptually:

```
iv (12) ‖ ciphertext (n) ‖ tag (16) ‖ wrappedDek (60)
```

This file represents that as a typed object of `Buffer`s rather than a single packed blob — the credential store (Phase 5 §3) decides how to flatten it on disk (typically each buffer becomes a base64 JSON string, or a BSON `Binary` per field). The `wrappedDek` field is internally packed as a single 60-byte buffer with layout:

```
wrappedDek = iv_kek (12) ‖ ct_dek (32) ‖ tag_kek (16)
```

so a caller never has to track three separate buffers to round-trip the wrapped DEK. `packWrappedDek` / `unpackWrappedDek` are the only places that touch this packing; everything else operates on the `{ iv, ct, tag }` triple.

`envelope.kekId` is the **plaintext** id of the KEK used to wrap `envelope.dek`. It's recorded on the row so a store with mixed-vintage records (mid-rotation) still decrypts cleanly: `decryptCredential` reads `kekId`, resolves that exact KEK via `getKek`, and unwraps. The id is constrained to `/^[A-Za-z0-9_-]{1,32}$/` so it can be safely interpolated into the env-var name without injection risk.

## 5. `rotateCredential` — the rotation primitive

```ts
rotateCredential(envelope, fromKekId, toKekId): CredentialEnvelope
```

**Semantics:**

1. `assertEnvelopeShape(envelope)` — fail fast on malformed input with a structured error rather than a cryptic Buffer assertion deep inside `createDecipheriv`.
2. **Loud guard**: if `envelope.kekId !== fromKekId`, throw. The caller is operating on the wrong row and we want to fail loud instead of silently corrupting it.
3. Resolve `fromKek` and `toKek` via `getKek`.
4. **Alias guard**: if `fromKekId !== toKekId` but the two env vars resolve to identical bytes (operator typo, double-provisioned secret), refuse to rotate and throw. The comparison uses `timingSafeEqual` — not strictly required here, but cheap insurance against leaking key-comparison timing.
5. Unwrap the DEK under `fromKek` (GCM tag verified — tamper / wrong-KEK surfaces as `CredentialsError`).
6. Re-wrap the DEK under `toKek` with a fresh IV + fresh tag.
7. Return a **new** `CredentialEnvelope` with `ciphertext` / `iv` / `tag` copied by reference from the input (immutable) and `dek` / `kekId` swapped for the freshly wrapped values.

**Why this is cheap:**

- We touch only **60 bytes per row** of crypto work (one GCM decrypt + one GCM encrypt of the 32-byte DEK).
- Disk I/O writes back 60 bytes for `dek` + a tiny `kekId` string. The bulky ciphertext blob is unchanged, so BSON storage / index footprints don't move; Mongo can avoid moving the document on most updates.
- A workspace with 100k credentials rotates in seconds of CPU and one bulk-update of small fields — versus n8n-style rotation, which would decrypt + re-encrypt every ciphertext, doubling-up plaintext exposure across the worker's memory.

**Same-id rotation:** `fromKekId === toKekId` is **allowed** and re-wraps with a fresh IV + tag. Useful for refreshing wrap material without changing keys (e.g. on suspicion of DEK ciphertext exfiltration, where the KEK itself is still trusted). The alias guard does not trip in this case because the early `kekId` equality is checked separately.

**Operational driver:** the per-row mechanics are exposed; the *scheduling* of rotation (batch sizing, retry, cohort selection, alerting) lives in `../runbooks/sabflow-credentials-kms-rotation.md`. That runbook reads this ADR for the byte-level contract.

## 6. Tamper detection — authenticated encryption end-to-end

AES-256-GCM gives us a **constant-time 128-bit auth tag** on each layer. When `decipher.final()` runs, it internally compares the tag against the computed MAC; any mismatch throws `Unsupported state or unable to authenticate data`. We catch that and translate it into a typed `CredentialsError`:

- **DEK unwrap fails** → `'Failed to unwrap DEK — KEK mismatch or tampered envelope'` (`context: 'dek'`).
- **Ciphertext decrypt fails** → `'Failed to decrypt credential — DEK mismatch or tampered ciphertext'` (`context: 'ciphertext'`).

Both carry `reason: 'invalid'` and a `cause` chain. Callers (Phase 5 §3 reader, §6 OAuth2 refresh, §7 test runner) handle them uniformly via the `CredentialsError` discriminator.

What this catches:

| Attack | Surface |
| --- | --- |
| Bit-flip in `ciphertext` | Ciphertext GCM tag fails → typed error |
| Bit-flip in `dek` | DEK GCM tag fails → typed error (caught before ciphertext is even attempted) |
| Swapping `dek` from another row | DEK tag was bound to the *other* row's IV → fails |
| Swapping `kekId` to a different KEK | DEK unwrap tag fails under the wrong KEK → typed error |
| Replacing `ciphertext` with another row's | Ciphertext tag was bound to *that* row's IV under *that* row's DEK → fails |
| Truncating `dek` or `ciphertext` | Length check in `assertEnvelopeShape` / `unpackWrappedDek` fires before any crypto runs |

The `CredentialsError` surface (defined in `./errors.ts`) is the only error type this module emits. Callers can pattern-match `reason` (`'invalid'` / `'missing'`) and `details.context` (`'dek'` / `'ciphertext'`).

## 7. Why AES-256-GCM (not CBC)

n8n uses AES-256-CBC keyed off `N8N_ENCRYPTION_KEY`. We deliberately chose GCM:

| Concern | CBC | GCM |
| --- | --- | --- |
| Authenticated? | No — needs a separate HMAC pass to detect tamper. | **Yes** — built-in 128-bit auth tag. |
| Padding-oracle risk? | **Yes** — PKCS#7 padding is malleable; a decryption error that distinguishes "bad padding" from "bad plaintext" leaks plaintext over many queries. | **No padding** at all — GCM is a stream cipher mode. |
| Tag check timing | If you bolt on HMAC, you must use a constant-time compare or you leak. | `final()` does the comparison internally in constant time. |
| IV length | 16 bytes random. | 12 bytes random (96-bit), the GCM-preferred size. |
| Tag length | N/A (or external HMAC). | 16 bytes appended. |
| Hardware support | Widely available. | Widely available — AES-NI + PCLMULQDQ on every modern x86 / arm64 Vercel runtime. |

The only thing CBC has going for it is "more familiar". For a fresh design with no on-disk backwards compatibility constraint (Phase 5 is the first SabFlow credential store with envelope encryption), GCM is the unambiguously safer pick. We do *not* support a CBC fallback — `ALGORITHM` is a `const` and the file rejects any envelope whose buffers don't match the GCM-shaped lengths.

## 8. KEK env layout

```
SABFLOW_KEK_<id> = <base64-encoded 32 raw bytes>
```

- Default `<id>` is `v1`; bootstrap env var is `SABFLOW_KEK_v1`.
- `<id>` is constrained to `/^[A-Za-z0-9_-]{1,32}$/` so it can be safely interpolated into the env-var name. Resolver rejects out-of-pattern ids with a typed `CredentialsError`.
- Provisioned via `vercel env add SABFLOW_KEK_v1 production` (and Preview / Development). No external KMS, no service-account JSON, no extra dependency. Marketplace KMS is the Phase 5 §11 upgrade path (forward-ref via `./kms.ts`), not a Phase 1 requirement.
- Generate a fresh KEK with: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`.
- **Length check:** `getKek` decodes base64 and asserts `decoded.length === 32`. A truncated or wrong-format value fails fast with `reason: 'invalid'`, never reaching the cipher.
- **Missing check:** an empty or unset env var throws `reason: 'missing'`. Callers (and the runbook) distinguish "operator forgot to set the KEK" from "operator set the wrong KEK".

Mid-rotation the env has *both* `SABFLOW_KEK_v1` and `SABFLOW_KEK_v2` present. Old rows decrypt under `v1`, new writes go under whichever id is configured as `DEFAULT_KEK_ID` (constant in code; bumped in a deploy when the cohort is empty). The rotation worker walks `{ kekId: 'v1' }` rows and rewrites them with `kekId: 'v2'`; when the count is zero, the deploy that retires `SABFLOW_KEK_v1` is safe.

## 9. Non-determinism — testing strategy

Every encryption picks a fresh IV via `randomBytes(IV_LENGTH)`. Two calls to `encryptCredential` with identical plaintext + identical KEK produce **different** ciphertexts and **different** wrapped DEKs. This is exactly what we want — deterministic encryption leaks equality of plaintexts across rows, which would let an attacker with DB read access correlate "these two workspaces use the same Slack token".

Test implications:

- **Never assert on raw ciphertext bytes.** Tests round-trip: `decryptCredential(encryptCredential(x)) deepEquals x`.
- **Tag-tamper tests** flip a bit in `envelope.ciphertext` or `envelope.tag` and assert the typed `CredentialsError` with `reason: 'invalid'` and the correct `context`.
- **KEK-mismatch tests** mutate `envelope.kekId` to point at a different KEK env var and assert `context: 'dek'` failure.
- **Rotation round-trip:** `decryptCredential(rotateCredential(encryptCredential(x, 'v1'), 'v1', 'v2')) deepEquals x` — verifies the DEK survives the wrap-swap.
- **Alias-KEK refusal:** point `SABFLOW_KEK_v2` at the same base64 as `v1`, call `rotateCredential(env, 'v1', 'v2')`, assert `reason: 'invalid'` with the alias-guard message.
- **Same-id refresh:** `rotateCredential(env, 'v1', 'v1')` returns a *new* envelope whose `dek` bytes are different from the input (proves we minted a fresh wrap IV + tag).

No KAT (Known-Answer Test) vectors are checked in for the encryption path itself — they wouldn't reproduce. KATs *are* used for `getKek` (base64 decode), `packWrappedDek` / `unpackWrappedDek` (byte layout), and `assertEnvelopeShape` (validation), all of which are deterministic.

## 10. Why no Mongo model here

This file imports zero database code on purpose. The separation:

- `./schema.ts` (Phase 5 §1) — types, `CredentialType` registry, collection-name constant, n8n field map.
- `./crypto.ts` (**this file**, Phase 5 §2) — `CredentialEnvelope` wire shape + pure cryptographic primitives.
- `./db.ts` (Phase 5 §3) — Mongo connection, index registration, CRUD repository, BSON `Binary` ↔ `Buffer` marshalling.

Reasons:

- **Testability.** Crypto runs without a Mongo connection. The whole file is unit-testable with `node --test` or Vitest in milliseconds — no `mongodb-memory-server`, no fixtures.
- **Reusability.** The OAuth2 refresh worker (§6), the rotation worker (driven by the runbook), the importer (§8), and the test runner (§7) all import the primitives directly. None of them need a repository.
- **Audit boundary.** This file emits zero audit rows — it doesn't know the credential id, the actor, or the workspace. The repository (§3) wraps every public call with the appropriate `./audit.ts` emission. Keeping crypto pure means there's no risk of audit-on-crypto-call double-emission.
- **Bundle hygiene.** `server-only` is imported at the top; nothing in this file would survive client bundling anyway (raw `node:crypto` + env reads), but the explicit marker turns "leaked into a client component" into a build error rather than a runtime surprise.

The schema ADR §2 already forbids registering a model in `./schema.ts`; this ADR makes the same explicit guarantee for `./crypto.ts`.

## 11. Constraints honoured

- **No new dependencies.** Only `node:crypto` (Node built-in) and the in-repo `../errors` (`CredentialsError`). Nothing added to `package.json`.
- **`server-only` import** at the top of the source — keeps the module out of any client bundle. Importing this file into a client component is a build error.
- **Vercel-native KEK sourcing.** KEKs come from `SABFLOW_KEK_<id>` env vars, provisioned via `vercel env` for Production / Preview / Development. No external KMS, no service-account JSON, no SDK. Marketplace KMS-backed KEKs are a forward-reference via `./kms.ts` (Phase 5 §11), not a Phase 1 requirement.
- **Constant-time tag checks.** Delegated to GCM's `final()` — no hand-rolled MAC compare, no `Buffer.compare` of tags, no early-exit based on tag bytes.
- **Best-effort secret wipe.** Every `try { ... } finally { wipe(...) }` path zeroizes transient DEK / KEK / plaintext buffers.
- **No deterministic encryption.** Fresh IV per call; round-trip-only test contract documented in §9.
- **Strict envelope validation.** `assertEnvelopeShape` runs before any key material is touched on the decrypt / rotate path, so malformed input fails fast with a structured error instead of a buffer-arithmetic crash.
- **No model registration.** Zero Mongo imports; zero index calls; zero connection logic. Phase 5 §3 owns persistence (§10).

## 12. Decision log

| Date | Event | Notes |
| --- | --- | --- |
| 2026-05-18 | Crypto module landed | AES-256-GCM envelope; `encryptCredential` / `decryptCredential` / `rotateCredential` / `getKek` shipped; `DEFAULT_KEK_ID = 'v1'`; no new deps. Consumed by Phase 5 §3 (CRUD), §6 (OAuth2 refresh), §7 (test runner), §8 (importer), and the KMS-rotation runbook. |
