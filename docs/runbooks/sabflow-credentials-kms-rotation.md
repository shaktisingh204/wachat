# SabFlow Credentials — KMS & Key Rotation Runbook

- **Track / Phase / Sub-task:** Track B · Phase 5 · #3
- **Status:** Proposed
- **Owner:** SabFlow credentials on-call
- **Related:** `src/lib/sabflow/executor/credentials/kms.ts` (the abstraction this runbook drives), `src/lib/sabflow/executor/credentials/crypto.ts` (Phase 5 #2, the `rotateCredential` primitive), `src/lib/sabflow/credentials/db.ts` (Mongo collection `sabflow_credentials`), `CLAUDE.md` → "Deployment platform — Vercel".

> Scope. Covers the *Key-Encryption Key* (KEK) lifecycle for SabFlow credential envelope encryption. Per-row Data-Encryption Keys (DEKs) and the symmetric cipher are owned by Phase 5 #2 and are out of scope here except where rotation crosses both layers.

---

## 1. KEK model in one paragraph

Every credential row in `sabflow_credentials` is sealed with a per-row DEK; the DEK is wrapped under a KEK identified by the row's `kek` field. KEK *material* never lives in Mongo — it is resolved at runtime by the `Kms` abstraction (`getKms()` in `src/lib/sabflow/executor/credentials/kms.ts`). The default backend `EnvKms` reads keys from `SABFLOW_KEK_<id>` environment variables; the `VercelMarketplaceKms` stub is the swap point for a future Vercel Marketplace KMS integration (AWS KMS, Google Cloud KMS, etc.) — once an integration is adopted, set `SABFLOW_KMS_BACKEND=marketplace` and the rest of this runbook applies unchanged at the `Kms` interface level.

---

## 2. Provisioning a new KEK

KEKs are 32 random bytes (AES-256) stored as base64.

### 2.1 Generate

Pick *one* of the following. Both produce identical material.

- [ ] Local one-liner: `openssl rand -base64 32` → copy the single-line value.
- [ ] From a Vercel Function or REPL: call `kms.generateKek()` (returns `{ id, key }`), then `key.toString('base64')`.

The `id` convention is the UTC date the KEK was minted, no separators (e.g. `20260518`). Suffix with `-rN` if you mint multiple in one day (`20260518-r2`).

### 2.2 Provision into Vercel

KEKs are first-class env vars. Do **not** commit them, do **not** paste them into chat, and do **not** ship them in `.env.example`. Use `vercel env` so the value lands in Vercel-managed env storage:

- [ ] `vercel env add SABFLOW_KEK_<id> production` — paste the base64 value at the prompt.
- [ ] Repeat for `preview` if previews need to read credentials (typically yes for staging).
- [ ] `vercel env pull` locally to refresh `.env.local` for any operator running rotations from their workstation.
- [ ] Trigger a redeploy so Vercel Functions pick up the new env (`vercel deploy --prod`, or merge to `main`).

After redeploy, confirm visibility with `kms.listKeks()` — the new id should appear with `source: 'env'`.

### 2.3 Marketplace-backed KEKs (forward-ref)

When a Vercel Marketplace KMS integration is installed, KEKs are auto-provisioned as env vars by that integration — steps 2.1 and 2.2 are replaced by the integration's install flow. The runbook from §3 onwards is unchanged.

---

## 3. Rotation cadence

- [ ] **Default cadence:** every **90 days**, scheduled as a Vercel Cron entry that pages on failure (declared in `vercel.json`, not node-cron).
- [ ] **Forced rotation:** within 24 h of a known KEK leak (§6).
- [ ] **Forced rotation:** within 24 h of an operator with KEK access leaving the team.
- [ ] **Floor:** never rotate more than once per 24 h outside an incident — the rotation loop touches every credential row and amplifies any latent bug.

The Cron entry calls a server-action wrapper around `rotateAll({ from, to })`, where `from` is the currently-active KEK id (tracked in `sabflow_settings`, key `activeKekId`) and `to` is the freshly-provisioned successor.

---

## 4. Dry-run procedure

Always dry-run before mutating a single row. The dry-run path counts matching rows but performs no writes, so it is safe to run from any environment.

- [ ] Provision the successor KEK per §2.
- [ ] In a Vercel Function (or local REPL with `vercel env pull`'d secrets):

  ```ts
  import { rotateAll } from '@/lib/sabflow/executor/credentials/kms';
  const report = await rotateAll({ from: '20260218', to: '20260518', dryRun: true });
  console.log(report); // { rotated: <count>, failed: [] }
  ```

- [ ] Sanity check `report.rotated` against `db.sabflow_credentials.countDocuments({ kek: '<from>' })` — they must match exactly.
- [ ] If `failed` is non-empty in dry-run (it shouldn't be — dry-run does not touch rows), stop and investigate before proceeding.

---

## 5. Real rotation + rollback window

Once dry-run is clean:

- [ ] Announce the rotation in `#sabflow-oncall` with the `from`/`to` ids and the expected row count.
- [ ] Run `rotateAll({ from, to })` (no `dryRun`). It iterates in cursor order, calls `rotateCredential` (Phase 5 #2) per row, and collects per-row failures rather than aborting.
- [ ] On completion, verify `report.failed.length === 0`. If non-empty, page on-call and treat each entry as an incident — the row is still readable under `from`, so the system is not down, but the rotation is incomplete.
- [ ] Update `sabflow_settings.activeKekId` to `to`. New credentials will now be sealed under `to`.
- [ ] **Keep the old KEK around for 30 days** by leaving `SABFLOW_KEK_<from>` in Vercel env vars and marking the metadata `deprecated: true` (operator note — the `KekMetadata.deprecated` flag is informational; nothing in the codepath gates on it). Rationale: if a bug surfaces post-rotation, you can re-wrap *backwards* (`rotateAll({ from: to, to: from })`) using the same primitive.
- [ ] After 30 days with no incidents, remove the old env var via `vercel env rm SABFLOW_KEK_<from> production` (and `preview`). Redeploy. The KEK is now unrecoverable, which is the desired end state.

---

## 6. Incident response — KEK leaked

A KEK leak means an attacker can unwrap any DEK that was sealed under that KEK and, via the DEK, decrypt the credential bytes. Treat as **Sev-1**.

- [ ] **Contain.** Within 1 h: rotate the leaked KEK to a fresh successor following §5, but skip the announce-and-wait steps — execute the rotation immediately.
- [ ] **Invalidate downstream.** For every credential whose `kek` field equalled the leaked id at the time of leak, force a re-credential flow: mark the row `revoked: true`, surface a banner in the SabFlow UI, and trigger the relevant OAuth refresh / API-token reissue flow per provider. The KEK rotation alone is *not* sufficient because the plaintext credential values may already have been exfiltrated.
- [ ] **Burn the env var.** `vercel env rm SABFLOW_KEK_<leakedId>` from `production`, `preview`, and `development`. Do not leave the 30-day rollback window open — rollback requires re-introducing the compromised key.
- [ ] **Audit access.** Pull `vercel team activity` for the env-var read/write trail. Check `sabflow_audit_log` for any unusual credential-fetch patterns in the 30 days preceding the leak.
- [ ] **Post-mortem.** File against `docs/adr/` within 5 business days. Update §3 cadence if the leak vector suggests 90 days is too long.

If the leak source is a Vercel Marketplace KMS integration rather than an env var, additionally revoke the integration's credentials through the Marketplace's own console and rotate any IAM principals it used.

---

## 7. Quick reference

| Operation                       | Command / call                                                         |
| ------------------------------- | ---------------------------------------------------------------------- |
| Mint KEK (32 random bytes b64)  | `openssl rand -base64 32` *or* `kms.generateKek()`                     |
| Add KEK to Vercel               | `vercel env add SABFLOW_KEK_<id> production`                           |
| List visible KEKs (runtime)     | `await kms.listKeks()`                                                 |
| Dry-run rotation                | `rotateAll({ from, to, dryRun: true })`                                |
| Real rotation                   | `rotateAll({ from, to })`                                              |
| Rollback (within 30-day window) | `rotateAll({ from: to, to: from })`                                    |
| Burn an old KEK                 | `vercel env rm SABFLOW_KEK_<id> production` (+ `preview` / `development`) |
| Switch backend (forward-ref)    | `vercel env add SABFLOW_KMS_BACKEND=marketplace`                       |
