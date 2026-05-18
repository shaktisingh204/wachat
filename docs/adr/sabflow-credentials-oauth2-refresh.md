# ADR — SabFlow OAuth2 Token-Refresh Worker (Track B · Phase 5 · §5)

**Status:** Proposed
**Date:** 2026-05-18
**Owner:** SabFlow / Track B Phase 5
**Phase branch:** worktree `worktree-agent-a72bb1d85cfed380d`
**Source file:** `src/lib/sabflow/executor/credentials/oauth2-refresh.ts`
**Sibling ADRs:** `sabflow-credentials-schema.md` (§1 — the `oauth2` block on `CredentialTypeDef`), `sabflow-credentials-crypto.md` (§2 — envelope encrypt/decrypt), `sabflow-credentials-resolver.md` (§4 — calls `refreshIfExpired` JIT before node execution).

---

## 1. Goal (≤200 words)

Guarantee that any SabFlow node which dereferences an OAuth2 credential sees a **non-expired access token**, without round-tripping the user through an OAuth consent screen. The worker has two responsibilities: (a) a **just-in-time** path the resolver calls right before a node runs (`refreshIfExpired`), which refreshes the token only if it has already expired or sits inside a 60 s safety window; and (b) a **proactive sweep** that pre-refreshes any OAuth2 credential whose `expiresAt` falls inside the next 15 minutes, invoked by **Vercel Cron** at `/api/cron/sabflow-oauth2-refresh` (Phase B.6 §2 wires the route). Concurrent callers for the same `credentialId` coalesce onto a single in-flight `Promise` via an in-memory `Map`, so ten parallel node-executions sharing one credential issue exactly one refresh request to the IdP. Every refresh re-encrypts the rotated `access_token` / `refresh_token` / `expiresAt` triple under the current KEK and emits a `cred.refresh` audit row. Failures throw a typed `CredentialsError` so the executor can `continueOnFail` per node policy. No new dependencies — `fetch`, `URLSearchParams`, `AbortController`, and `Buffer` are all platform-native.

## 2. Scope & non-goals

**In scope (owned by this file):**

- `refreshIfExpired(credentialId, decrypted)` — synchronous JIT helper.
- `startOAuth2RefreshWorker()` — long-lived in-process sweep (dev / self-hosted only).
- `stopOAuth2RefreshWorker()` — paired stopper for tests.
- `runOAuth2RefreshSweep()` — single-tick variant driven by Vercel Cron.
- `needsRefresh(decrypted, nowMs?)` — pure predicate exported for tests.
- The in-memory coalescing map.
- The `CredentialsError` typed-error shape and code set (`REFRESH_FAILED`, `MISSING_REFRESH_TOKEN`, `MISSING_TOKEN_URL`, `CREDENTIAL_NOT_FOUND`).

**Out of scope (owned by siblings):**

- The decrypt/encrypt primitives themselves — `./crypto.ts` (§2). This module lazy-imports them at call time.
- Mongo CRUD + indexes for `sabflow_credentials` — Phase 5 §3.
- The cron route handler `/api/cron/sabflow-oauth2-refresh` — Phase B.6 §2.
- The resolver that calls `refreshIfExpired` JIT — §4.
- KEK rotation — Phase 5 §6 (independent worker; rotation only re-wraps the DEK, never the plaintext, so refreshes and rotations don't fight).
- Audit emission internals — `./audit.ts` (already shipped). This file just calls `audit.cred.refresh(...)`.

## 3. Three entry points — and why each exists

### 3.1 `refreshIfExpired(credentialId, decrypted)` — JIT, called by the resolver

This is the **load-bearing** path. The resolver (§4) calls it right before handing a decrypted credential to a node. Logic:

1. If `decrypted.expiresAt` is missing, return as-is (long-lived credentials like API keys take this path).
2. Compute `needsRefresh()` — true iff `now + 60 000 ms >= expiresAt`. The 60 s safety window absorbs clock skew between SabFlow and the IdP, and avoids the 401 → retry round-trip that costs an extra HTTP hop on the user's critical path.
3. Otherwise refresh against `decrypted.tokenUrl`, persist the rotated payload, and resolve with the patched `DecryptedCredentialData`.

Concurrent callers for the same `credentialId` **coalesce**:

```
const existing = inFlight.get(credentialId);
if (existing) return existing;
const promise = doRefresh(...).finally(() => inFlight.delete(credentialId));
inFlight.set(credentialId, promise);
```

This matters because a fan-out workflow (e.g. ten HTTP nodes in parallel branches sharing one Google credential) will otherwise fire ten simultaneous refresh requests at the IdP — and Google in particular rate-limits refresh endpoints aggressively. The map's scope is **per Vercel Function instance**; Fluid Compute reuses instances across concurrent requests within the same region, so a single workflow's fan-out coalesces correctly. Cross-region simultaneous bursts can still issue parallel refreshes, but Mongo's last-write-wins on `data` + `expiresAtMs` keeps the row consistent, and the IdP-issued tokens are idempotent at the resource layer.

### 3.2 `startOAuth2RefreshWorker()` — long-lived in-process sweep

Documented but explicitly **not the source of truth in production**. The function early-returns when `process.env.VERCEL === '1'`:

```
if (process.env.VERCEL === '1') {
  // Long-lived intervals don't survive in serverless. Rely on Vercel Cron.
  return;
}
```

It exists for two cases:

- **Local dev** (`vercel dev` / `next dev` / `npm run dev`) — developers expect background-refresh to "just work" without registering a cron.
- **Self-hosted SabFlow** (Phase 5 §11 future) — when SabFlow runs outside Vercel as a long-lived Node process, this is the durable source.

When active it kicks once on boot (so tokens already inside the look-ahead window refresh immediately) and then `setInterval`s at `SWEEP_INTERVAL_MS = 5 min`. The timer is `unref()`-ed so it never keeps the Node process alive on its own.

### 3.3 `runOAuth2RefreshSweep()` — single-tick, called by Vercel Cron

This is the production sweep. Phase B.6 §2 wires it into `/api/cron/sabflow-oauth2-refresh` (declared in `vercel.ts` at `0,5,10,... * * * *` cadence — every 5 minutes). One tick:

1. Re-entrancy guard via `sweepRunning` boolean — if a previous tick is still in flight, the new tick no-ops. Vercel Cron is at-least-once, so overlapping invocations are real and must be safe.
2. Open Mongo and query `sabflow_credentials` for OAuth2-shaped rows whose plaintext `expiresAtMs` sentinel is `< now + SWEEP_LOOKAHEAD_MS` (15 min).
3. For each row (capped at `SWEEP_BATCH_LIMIT = 200`): decrypt, double-check `needsRefresh()` with the look-ahead-shifted `now`, and call `refreshIfExpired()` — which re-uses the same coalescing path the resolver hits, so a JIT refresh that lands during the sweep does **not** double-fire.
4. Return `{ inspected, refreshed, failed, durationMs }` so the cron route can log a structured line for observability.

The 200-row batch limit keeps a single invocation comfortably under the 300 s Vercel Function default timeout even when the IdP is slow.

## 4. Why Vercel Cron, not `setInterval`

Three concrete reasons:

1. **Fluid Compute instances recycle.** A function instance lives only as long as it's hot. A `setInterval` registered on boot dies the moment the instance is reaped — silently. Cron is **scheduler-driven**: the platform invokes the URL, so the schedule survives instance death.
2. **Multiple instances would multiply sweeps.** Fluid Compute can run several instances per region, plus multiple regions. If each one set its own interval, the IdP would see N× the refresh traffic. Cron fires the URL once per scheduled tick, regardless of how many instances are warm.
3. **Cron has retries and observability.** Vercel Cron logs the invocation, captures the response code, and retries on 5xx. A `setInterval` swallows errors silently.

So this file's *contract* with the platform is: **Vercel Cron is the durable source of truth in production; the in-process sweep is a dev convenience.** The cron route, in turn, is the smallest possible adapter — it just `await runOAuth2RefreshSweep()` and returns the counters as JSON.

## 5. Refresh window — 15 min look-ahead, 60 s safety

Two windows, two purposes:

| Constant | Value | Used by | Purpose |
| --- | --- | --- | --- |
| `EXPIRY_SAFETY_WINDOW_MS` | 60 s | JIT (`needsRefresh`) | Avoid handing a node a token that expires mid-flight. 60 s comfortably covers clock skew + a slow node run. |
| `SWEEP_LOOKAHEAD_MS` | 15 min | Sweep (Mongo filter + `needsRefresh(now + 15min)`) | Refresh tokens *before* they bite. The cron fires every 5 min, so a 15 min look-ahead gives three sweep opportunities per token before the JIT path has to kick in. |
| `SWEEP_INTERVAL_MS` | 5 min | In-process worker only | Mirrors the prod cron cadence so dev behaviour matches. |
| `SWEEP_BATCH_LIMIT` | 200 | Sweep cursor `.limit()` | Caps wall-clock per tick. |
| `REFRESH_TIMEOUT_MS` | 15 s | `fetch` `AbortController` | Bounds a single refresh's network wait. |

If the sweep ever misses (cron skipped, IdP outage longer than 15 min), the JIT path still catches the token at the 60 s window and refreshes it inline — at the cost of one extra HTTP hop on the user's request. The system degrades gracefully rather than failing.

## 6. HTTP call shape

`POST` to `decrypted.tokenUrl` (e.g. `https://oauth2.googleapis.com/token`):

```
content-type: application/x-www-form-urlencoded
accept: application/json
authorization: Basic base64(clientId ":" clientSecret)   ← if both present

grant_type=refresh_token
&refresh_token=<the refresh token>
&client_id=<id>             ← if present
&client_secret=<secret>     ← if present
&scope=<scope>              ← if present
```

The body always carries `grant_type=refresh_token` and `refresh_token`. The client id/secret pair is included **both** in the body **and** as HTTP Basic — n8n's `CredentialTypeDef` exposes `authStyle: 'body' | 'header'` to pick one, but the IdP-side reality is that Google, Microsoft, GitHub, Slack, and most others accept either. Belt-and-braces sending both is harmless (IdPs ignore whichever they don't use) and saves us from an `authStyle` mis-configuration breaking refreshes silently in production.

The request is wrapped in an `AbortController` with `REFRESH_TIMEOUT_MS = 15 s`. Network errors throw `REFRESH_FAILED` with `retryable: true`. HTTP non-2xx responses inspect the body for the OAuth2 spec's `invalid_grant` sentinel — that means the refresh token itself is revoked / expired, so `retryable: false` (otherwise we'd flap forever).

## 7. Parsing the IdP response

The response is JSON. Field extraction:

| Spec field | Behaviour |
| --- | --- |
| `access_token` | **Required.** Absent ⇒ `REFRESH_FAILED retryable=false`. |
| `expires_in` (seconds) | Optional. Converts to `expiresAt = Date.now() + expires_in * 1000`. Missing leaves `expiresAt` undefined (some IdPs issue non-expiring tokens). |
| `refresh_token` | Optional. **If the IdP rotates** (Google does for some scopes, Microsoft for confidential clients), we adopt the new token. **If the IdP omits it** (most do — Slack, GitHub, OAuth2 spec default), we keep the existing one. |
| `scope` | Optional, defaults to the previous scope. |
| `token_type` | Optional, defaults to `Bearer`. |

This round-trip is why we don't pre-emptively reissue refresh tokens ourselves: provider semantics differ. Google rotates on some flows but not others; Microsoft rotates for confidential clients; GitHub doesn't rotate at all. Treating the IdP response as ground truth and updating the persisted `refreshToken` only when one is present in the payload keeps us correct for every IdP without per-provider branches.

## 8. Persisting the refreshed row

After a successful refresh, `persistRefreshed()`:

1. Re-encrypts the **entire** plaintext payload (not just the rotated fields) under the current KEK via `crypto.encryptRecord(...)`. The envelope's DEK is fresh, the KEK is the current `SABFLOW_KEK_<id>` per the schema ADR (§1 §3). Re-wrapping the whole payload keeps the at-rest invariant — no row ever holds a half-old / half-new ciphertext.
2. Writes a `$set` that updates `data` (the envelope), `updatedAt`, and a **plaintext `expiresAtMs` sentinel field** on the document.
3. The sentinel is the trick that makes the sweep cheap: the sweep filters `expiresAtMs: { $lt: now + SWEEP_LOOKAHEAD_MS }` server-side without decrypting any row. The expiry instant is not a secret — it tells an attacker *when* a token rotates, not *what* the token is — so exposing it as plaintext is an acceptable trade for two-orders-of-magnitude cheaper sweeps.
4. Emits `cred.refresh` via `./audit.ts` with `{ source: 'runtime', credentialId, idpHost: new URL(tokenUrl).host }`. No tokens, no body fragments, no secrets.

A `crypto.decryptRecord` happens once per JIT call (the resolver already did it) and once per sweep row. The encrypt-on-write is a single envelope operation per refresh, so the steady-state crypto cost is one AES-GCM seal per token-lifetime per credential.

## 9. Concurrency — coalescing in detail

The map is keyed by `credentialId`. Lifecycle:

```
inFlight.set(credentialId, promise);
promise.finally(() => inFlight.delete(credentialId));
```

The `.finally()` cleanup runs whether the refresh succeeded or threw, so a failed refresh doesn't pin the entry. Critically, the cleanup runs **before** the awaiting callers' `.then()` handlers fire on most engines, but the contract this file relies on is only that *new* callers arriving after the entry is deleted will issue a fresh refresh — which is exactly what we want if the previous one failed.

What this *doesn't* defend against:

- **Cross-instance concurrency.** Two Vercel Function instances in different regions can each see "expired" and each refresh. The IdP-issued `access_token` is fine (idempotent at the resource layer), and Mongo's last-write-wins on `data` + `expiresAtMs` produces a consistent final row. The cost is one wasted refresh call per cross-region race — acceptable.
- **Cron vs JIT race.** If the cron tick decrypts a row at the same instant a node tries to use it, both paths funnel through `refreshIfExpired()`, which coalesces them via the same map — but only inside one instance. Cross-instance races are again resolved at Mongo.

## 10. Audit

Every refresh emits `cred.refresh` via `./audit.ts` (sibling, already shipped). Per the schema ADR's audit table:

| Trigger | Action | Source |
| --- | --- | --- |
| JIT `refreshIfExpired` from resolver | `cred.refresh` | `'runtime'` |
| Sweep tick (cron or in-process) | `cred.refresh` | `'runtime'` with `metadata.sweep: true` |
| Refresh failure | `cred.refresh` with `metadata.error: code` | same |

The audit emitter is wrapped in try/catch in `./audit.ts`, so a logging failure never aborts a refresh and a refresh-on-the-critical-path is never blocked by audit-write latency.

## 11. Failure semantics

`CredentialsError` carries three fields:

```
code: 'REFRESH_FAILED' | 'MISSING_REFRESH_TOKEN' | 'MISSING_TOKEN_URL' | 'CREDENTIAL_NOT_FOUND'
retryable: boolean
cause?: unknown
```

The resolver (§4) catches this and converts it to a typed node error:

- `retryable: true` (network error, 5xx, non-JSON response, timeout) → the workflow's `continueOnFail` policy decides whether to re-queue.
- `retryable: false` (missing fields, `invalid_grant`, response missing `access_token`) → the node fails permanently with a "Reconnect this credential" message; no retry would help.

The sweep path swallows per-row errors and just increments the `failed` counter, so one rogue credential doesn't poison the whole sweep — but the per-row `console.warn` carries the hashed credential id (not plaintext) for operator triage.

## 12. Why we don't pre-emptively reissue refresh tokens

The OAuth2 spec is permissive about refresh-token rotation:

> [The authorization server] MAY issue a new refresh token, in which case the client MUST discard the old refresh token and replace it with the new refresh token. — RFC 6749 §6

Provider behaviour:

| IdP | Refresh-token rotation |
| --- | --- |
| Google | Sometimes (depends on consent flow + scope) |
| Microsoft | Confidential clients: usually. Public: not always |
| Slack | Never (long-lived tokens) |
| GitHub | Never |
| Salesforce | On every refresh (when configured) |
| Zoho | Yes |

A SabFlow-side policy that always-rotates would invalidate the working tokens of IdPs that don't rotate; a policy that never-rotates would let rotated tokens diverge from what the IdP expects. The right behaviour is the one this file implements: **mirror the IdP's response**. If `parsed.refresh_token` is present, persist it; otherwise keep the existing one. This is the `oauthTokenData` round-trip the resolver hands us — we don't try to predict.

## 13. Constraints honoured

- **No new dependencies.** All HTTP via platform-native `fetch` + `URLSearchParams` + `AbortController`. Encoding via Node's `Buffer`. The only external import is `mongodb` (already in `package.json`).
- **`server-only`** import at the top — the file is incinerated by Next/Webpack if anything tries to pull it into a client bundle. Refresh-token plaintext, KEKs, and IdP responses never get a chance to leak browserward.
- **Vercel-native via Vercel Cron.** The production scheduler is `/api/cron/sabflow-oauth2-refresh` declared in `vercel.ts`. No `node-cron`, no `agenda`, no `Bull`. The in-process `startOAuth2RefreshWorker()` is gated behind `process.env.VERCEL !== '1'` so production never accidentally double-schedules.
- **No KEK leakage.** Re-encryption goes through the same `crypto.encryptRecord` the rest of the credentials module uses, so KEK selection follows the schema ADR's policy without this file ever naming a KEK id.
- **Plaintext sentinel is bounded.** Only `expiresAtMs` (a Unix-ms integer) is exposed unencrypted on the row. No tokens, no client secrets, no scopes.

## 14. Decision log

| Date | Event | Notes |
| --- | --- | --- |
| 2026-05-18 | Worker landed | Three entry points: JIT, in-process sweep (dev), cron sweep (prod). |
| 2026-05-18 | 15 min look-ahead chosen | Three cron ticks per token before JIT has to fire — leaves headroom for a single IdP outage without user-visible latency. |
| 2026-05-18 | Coalescing map scoped per-instance | Cross-instance races resolved at Mongo last-write-wins; cost is one redundant refresh call per region race. Accepted. |
| 2026-05-18 | Plaintext `expiresAtMs` sentinel | Two-orders-of-magnitude cheaper sweeps. Exposes *when* tokens rotate, not the tokens. Accepted. |
| 2026-05-18 | `setInterval` gated on `VERCEL !== '1'` | Prevents prod from double-scheduling refreshes alongside cron. |
