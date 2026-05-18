# ADR — SabFlow Credential Test-Connection Runner (Track B · Phase 5 · §8)

**Status:** Proposed
**Date:** 2026-05-18
**Owner:** SabFlow / Track B Phase 5
**Phase branch:** worktree `worktree-agent-aff828224e74a918c`
**Source file:** `src/lib/sabflow/executor/credentials/test.ts`
**Sibling ADRs:** `sabflow-credentials-schema.md` (§1 — owns the `CredentialTestOperation` *shape*; this ADR owns the *runner*), `sabflow-credentials-resolver.md` (§4 — decrypts before testing), `sabflow-credentials-oauth2-refresh.md` (§5 — OAuth2 test ops chain to refresh), `sabflow-credentials-audit.md` (§7 — emits `cred.test`).

---

## 1. Goal (≤200 words)

Implement the **interpreter** for the declarative `testOperation` descriptor pinned by the schema ADR §5. Given a `credentialId`, `requesterId`, and `workspaceId`, the runner resolves the row, enforces tenant ownership, decrypts the credential (via §4's resolver), looks up a per-type test op in a forward-declared registry, executes a bounded HTTP probe, and returns a typed `{ ok, error?, details? }`. Three test ops register at module load — `http_basic_auth`, `oauth2`, `google_sheets` — covering the credential types Phase 5 ships with a first-class form. A `registerCredentialTestOp(type, runner)` extension API lets Phase B.3 (built-in nodes) attach per-type runners as nodes land, without this file growing a dependency on every integration. The runner stays declarative so the same descriptor can serialise across the Node ↔ Rust IPC boundary (per the IPC ADR) and run on either side. It never bubbles raw response bodies up to the caller — only the typed surface escapes, so leaked credentials and tenant data can't ride the response back to the browser. Audit emission (`cred.test`) lives at the *route layer* (sibling §7), not here: this module is pure logic.

## 2. Scope & non-goals

**In scope (owned by this file):**

- Public entry point `testCredential(credentialId, requesterId, workspaceId, options?)`.
- Public result type `CredentialTestResult = { ok, error?, details? }`.
- Per-type runner type `CredentialTestOp = (credential: Credential) => Promise<CredentialTestResult>`.
- Registry helpers `registerCredentialTestOp(type, op)` and `getCredentialTestOp(type)`.
- Three built-in runners (`http_basic_auth`, `oauth2`, `google_sheets`) and their module-load registration.
- Shared HTTP helpers — bounded `fetch` wrapper with `AbortController`, body summariser.

**Out of scope (owned by siblings):**

- `CredentialTestOperation` *shape* — §1 schema ADR (`./schema.ts`).
- Crypto / decryption — §2 (`./crypto.ts`) and §4 resolver.
- Mongo CRUD — §3 (`./db.ts`).
- OAuth2 access-token refresh worker — §5 (`./oauth2-refresh.ts`). The `google_sheets` runner inlines a refresh call for the Phase-1 path; once §5 ships, the runner delegates to it.
- Audit row emission (`cred.test`) — §7 (`./audit.ts`), called from the **route handler**, not this module.
- RBAC — `./rbac.ts` (already shipped).
- REST surface (`POST /api/sabflow/credentials/:id/test`) — Phase 5 §10.
- Editor "Test connection" button wiring — owned by the credential form component in `src/components/sabflow/credentials/` (consumes the §10 route).

## 3. Public API

```ts
export interface CredentialTestResult {
  ok: boolean;
  error?: string;
  details?: Record<string, unknown>;
}

export type CredentialTestOp = (
  credential: Credential,
) => Promise<CredentialTestResult>;

export function testCredential(
  credentialId: string,
  requesterId: string,
  workspaceId: string,
  options?: { op?: CredentialTestOp },
): Promise<CredentialTestResult>;

export function registerCredentialTestOp(
  type: CredentialType,
  op: CredentialTestOp,
): void;

export function getCredentialTestOp(
  type: CredentialType,
): CredentialTestOp | undefined;
```

### 3.1 Contract guarantees

- **Never throws.** Every failure path — missing args, row-not-found, cross-tenant, no registered op, runner exception — returns `{ ok: false, error }`. Callers (route handler, editor) can treat the return as total.
- **Workspace-scoped.** A credential whose `workspaceId` ≠ caller `workspaceId` returns `{ ok: false, error: 'Forbidden' }` *before* decryption. No cross-tenant probing.
- **Read-only.** No write to `sabflow_credentials`, no state mutation, no side-effect cache write. (Phase 5 §5's refresh worker is the only writer; this runner can read its output but doesn't trigger persistence.)
- **`options.op` override** is for unit tests; production callers don't pass it. Lets the test suite assert the orchestration without registering a real type.

### 3.2 Result shape conventions

| Field | When set | Notes |
| --- | --- | --- |
| `ok: true` | Probe succeeded against rules. | `details` may carry derived identity (`email`, `displayName` for Google; HTTP `status` + `url` for Basic). |
| `ok: false, error` | Any failure. | `error` is a short human string — safe to surface in the editor. Never contains the credential payload. |
| `details` | Optional on both branches. | May include `status`, `url`, a truncated body summary (≤240 chars), or the OAuth2 introspection payload. Never the raw access token, never the credential bag. |

## 4. The declarative `testOperation` shape — interpreter contract

The schema ADR §5 pins the wire shape:

```ts
{
  request: { method, url, headers?, qs?, body? },
  rules?: [
    { type: 'responseStatusCode', properties: { value: 200 } },
    { type: 'responseSuccessBody', properties: { key: 'ok', value: true } },
  ],
}
```

This runner is the **interpreter** that turns it into a `fetch`. Three reasons the shape stays declarative rather than a function:

1. **IPC serialisable.** The Node ↔ Rust worker channel (IPC ADR) ships descriptors as JSON. A JS closure can't cross that boundary; a `{request, rules}` JSON object can. Either side can run the probe.
2. **Editor preview.** The credential form renders the probe URL (with secrets masked) before the user clicks "Test", which requires structural introspection.
3. **Auditable.** A descriptor can be diffed and stored; a closure can't.

### 4.1 Template resolution

Strings in `request.url`, `request.headers`, `request.qs`, and `request.body` are templated against the decrypted credential data using the **same expression engine as nodes** (`sabflow-expression-syntax.md`). The binding is `$credentials` — so `{{ $credentials.apiKey }}` interpolates the `apiKey` field of the decrypted bag. Nodes use the same syntax against `$json` / `$input`, keeping muscle memory consistent.

Resolution is **per-string**, not whole-object — so a header value `Bearer {{ $credentials.accessToken }}` works without needing the entire header map to be a template.

### 4.2 The rule engine

Both rule types are **optional** and **short-circuit on first failure**:

| Rule | Checks | Default when absent |
| --- | --- | --- |
| `responseStatusCode` | Exact HTTP status match. | Any 2xx counts as success. |
| `responseSuccessBody` | Parses response as JSON, checks `key === value`. | Body is ignored. |

If neither rule is declared, the runner falls back to `response.ok` (status in [200, 299]). This matches the n8n editor's default behaviour and lets simple "did it 200?" probes stay terse.

### 4.3 Why the built-ins are runners, not descriptors

The three built-ins (`http_basic_auth`, `oauth2`, `google_sheets`) ship as **TypeScript runner functions**, not descriptors. Reason: they encode credential-type-specific *logic* that doesn't fit the `{request, rules}` mould:

- `http_basic_auth` synthesises a `whoamiUrl` fallback when the credential doesn't carry one.
- `oauth2` derives the introspection URL from `tokenUrl` via path rewrite.
- `google_sheets` chains a token-refresh POST before the actual probe.

A user-supplied `testOperation` descriptor (declared via the editor's "advanced" form or imported from n8n) goes through the descriptor interpreter; the three built-ins bypass it. Both paths register through the same `Map<CredentialType, CredentialTestOp>` registry and are indistinguishable to `testCredential` callers.

## 5. The forward-declared registry

```ts
const registry: Map<CredentialType, CredentialTestOp> = new Map();
```

A module-local `Map` keyed by `CredentialType`. Three modes:

| Mode | When | How |
| --- | --- | --- |
| **Module load** | Built-ins (`http_basic_auth`, `oauth2`, `google_sheets`). | `registerCredentialTestOp(type, runner)` runs at the bottom of `test.ts`. |
| **Phase B.3 boot** | Built-in nodes wire per-type runners as nodes land. | Each node module's index calls `registerCredentialTestOp(type, runner)` once. |
| **Tests** | Unit / integration tests assert orchestration. | Either `registerCredentialTestOp` with a fake, or `testCredential(..., { op })` to bypass the registry entirely. |

**Forward-declared** = the registry is created empty, populated by side effect. This file deliberately does **not** import any node module — it stays a leaf in the dependency graph so the credential layer can be unit-tested without booting the node catalogue.

## 6. Built-in runners

### 6.1 `http_basic_auth`

```
GET {whoamiUrl ?? https://httpbin.org/basic-auth/<user>/<pass>}
Authorization: Basic base64(user:password)
Accept: application/json
```

- The `httpbin.org` fallback is intentional — it's RFC-compliant, returns 401 on wrong creds and 200 on right ones, and works without configuring a real endpoint. Self-hosted endpoints supply their own `whoamiUrl` on the credential.
- Returns `{ ok: true, details: { status, url } }` on success; `{ ok: false, error: 'HTTP <n>', details: { status, body, url } }` on failure. The `body` is summarised to 240 chars.

### 6.2 `oauth2`

```
POST {introspectUrl ?? tokenUrl.replace(/\/token\/?$/, '/introspect')}
Content-Type: application/x-www-form-urlencoded
Authorization: Basic base64(clientId:clientSecret)   (when both present)

token=<accessToken>
```

- Standard RFC 7662 introspection. Treats `{ active: true }` as success; otherwise the response payload comes back as `details` so the editor can surface why.
- If the credential has no `introspectUrl` and no `tokenUrl`, the runner short-circuits with `'No introspection endpoint configured'` — never makes a request to nowhere.

### 6.3 `google_sheets`

Two-step:

```
POST https://oauth2.googleapis.com/token
  grant_type=refresh_token&client_id=…&client_secret=…&refresh_token=…
→ access_token

GET https://www.googleapis.com/drive/v3/about?fields=user(emailAddress,displayName)
  Authorization: Bearer <access_token>
→ { user: { emailAddress, displayName } }
```

- `drive.about` is the cheapest authenticated Google probe (no quota cost, works with any Drive scope, returns identity).
- The refresh-token leg is duplicated from §5's worker for the Phase-1 path. Once §5 ships its public `refreshOAuth2Credential` helper, this runner delegates to it instead of inlining the POST.
- Success `details` surface the email + displayName — useful in the editor ("Connected as alice@example.com").

## 7. Why we never bubble the response body up

A probe response can carry:

- The credential itself (introspection echoes `client_id`; some misconfigured providers echo the access token).
- Tenant data (a `whoamiUrl` against the user's own API can echo workspace ids, internal user lists).
- PII (Google's `drive.about` returns the user's email).

If any of that crossed the `testCredential` return boundary verbatim, it would reach:

- The browser (via the §10 REST route).
- The audit log (via §7's `cred.test`).
- Server logs (whatever middleware logs the response).

The runner therefore **summarises bodies to 240 chars** for the `error` path's `details.body`, and on success exposes only **explicitly named fields** (`email`, `displayName`, `status`, `url`). The full payload is held in memory long enough to evaluate the rules, then dropped at function return. The `Record<string, unknown>` typing on `details` is by design — callers should treat it as opaque diagnostic data, not a structured contract.

## 8. Audit responsibility — route layer, not here

Audit emission (`cred.test`) is **not** this module's job. The route handler at `src/app/api/sabflow/credentials/[id]/test/route.ts` (Phase 5 §10) does:

```ts
const result = await testCredential(id, userId, workspaceId);
await emitCredentialAudit({
  action: 'cred.test',
  source: 'ui',         // or 'api'
  credentialId: id,
  workspaceId,
  userId,
  metadata: { ok: result.ok, error: result.error },
});
return Response.json(result);
```

Why split it:

- **Pure logic.** `testCredential` is unit-testable without mocking the audit emitter, the request context, or the source channel (UI vs API).
- **Source attribution.** The runner can't know whether it was triggered from the editor button, a REST call, or a future schedule probe. The route knows; let the route record.
- **Result-aware metadata.** The route can record `ok: false, error: 'Forbidden'` even though no probe fired. A runner-level audit would double-emit or miss those.
- **Mirrors the §6 audit table.** Schema ADR §6 already pins audit emission to "Editor test button" / "API test call" — both are route-layer signals.

## 9. Timeouts and idempotency

Every probe is wrapped in:

```ts
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), init.timeoutMs ?? 8_000);
try { return await fetch(url, { ...init, signal: controller.signal }); }
finally { clearTimeout(timeout); }
```

- **Default 8 s** — enough for any sane introspection / `drive.about` round-trip; short enough that a stuck endpoint doesn't tie up a serverless function. (The original spec said 10 s; the implementation tightens to 8 s and exposes `timeoutMs` per-request, so a slower built-in can opt up.)
- **`AbortController`** ensures the underlying socket actually closes — `Promise.race` against a timer would leak the fetch.
- **GET / metadata POST only.** Every built-in probe is either a `GET` (Basic / Google) or a credential-introspection POST. None mutates the upstream account. Re-running `testCredential` is safe and side-effect-free; the editor can poll without consequence.

## 10. How callers reach this module

| Caller | Entry | Source |
| --- | --- | --- |
| Editor "Test connection" button | `POST /api/sabflow/credentials/:id/test` | `src/components/sabflow/credentials/CredentialFormDrawer.tsx` (consumes the route, not the runner). |
| REST API consumers | Same route. | Phase 5 §10. |
| Migration / smoke tests | Direct import. | Phase 5 §8 sibling migration verifies a sample of imported n8n credentials post-import. |
| Cron health check (future) | Direct import behind a probe job. | Out of scope for Phase 1; Phase B.6's scheduled probes can call `testCredential` to flag stale OAuth2 grants. |

Client components **never** import this module directly — it's `server-only`. The editor speaks to the runner exclusively through the REST route, which keeps the credential decryption (and the audit row) on the server.

## 11. Constraints honoured

- **No new dependencies.** Uses the platform `fetch`, `Buffer` (Node built-in), `AbortController` (Web standard, available in the Node 20+ runtime Vercel ships). No `axios`, no `got`, no `node-fetch`.
- **`server-only` import** keeps this module out of any client bundle — the credential plaintext, the introspection endpoints, and the registry never leak to the browser.
- **Read-only by contract.** Never mutates the credential row, never persists state, never writes to the audit log directly. The only state in the module is the in-memory registry `Map`, which is append-only at module-load / boot time.
- **Vercel-native runtime.** Default Node.js / Fluid Compute runtime — no Edge restrictions (we need `Buffer` for Base64), no extra config.

## 12. Decision log

| Date | Event | Notes |
| --- | --- | --- |
| 2026-05-18 | Runner landed | Interprets the §1 schema's `CredentialTestOperation` shape; ships with three built-in ops covering Phase 5's first-class types. |
| 2026-05-18 | Audit split to route | Confirmed `cred.test` emission lives in `route.ts`, not `test.ts`, per §6 audit table. |
| 2026-05-18 | Default timeout 8 s | Tightened from the 10 s spec; per-request override via `timeoutMs`. |
