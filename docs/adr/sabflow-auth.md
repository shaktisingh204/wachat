# ADR — SabFlow WebSocket Gateway Auth (Track A Phase 1 §7)

**Status:** Proposed
**Date:** 2026-05-18
**Track / Phase / Sub-task:** Track A · Phase 1 · §7 (auth reuse)
**Companion ADRs:** `docs/adr/sabflow-foundation.md` (Phase 1 §10), `docs/adr/sabflow-executor.md` (Track B §10)

> Constraint: this ADR **only** documents the chosen design. No auth code is
> modified and **no RBAC keys are registered** here. The keys named in §4 and the
> summary are *reserved* for Phase 8 §1 ("Per-doc RBAC keys registered in
> SabNode RBAC registry"). Registration happens there via the standard pattern
> shown in `src/lib/sabwa/rbac-keys.ts` plus the matching adds to
> `src/lib/permission-modules.ts` and `src/lib/definitions.ts`.

---

## 1. SabNode's existing auth (verified against the codebase)

SabNode runs a **dual-auth** model. There is exactly one HS256 JWT secret
(`process.env.JWT_SECRET`) and two cookie surfaces (`session`, `admin_session`).
Tokens are minted with `jose.SignJWT`, verified with `jose.jwtVerify`, and
revoked via a Mongo `revoked_tokens` collection keyed by `jti`.

| Concern | File | Lines |
|---|---|---|
| Secret loader | `src/lib/auth.ts` | 15–21 |
| Firebase admin token path | `src/lib/auth.ts` | 98–109 |
| User JWT verify (Node runtime, with revocation lookup) | `src/lib/auth.ts` | 111–140 |
| Admin JWT verify (Node runtime) | `src/lib/auth.ts` | 143–162 |
| `createSessionToken` — 7d TTL, `jti = nanoid()` | `src/lib/auth.ts` | 164–172 |
| `createAdminSessionToken` — 1d TTL | `src/lib/auth.ts` | 174–182 |
| Edge-runtime user verify (used by the proxy) | `src/lib/auth.edge.ts` | 12–34 |
| Edge-runtime admin verify | `src/lib/auth.edge.ts` | 37–50 |
| Cookie flags (`httpOnly: true`, `sameSite: 'lax'`, conditional `secure`) | `src/lib/cookies.ts` | 17–53 |
| Single jti revoke | `src/lib/auth.ts` | 60–71 |
| User-wide "sign out everywhere" sentinel | `src/lib/auth.ts` | 79–96 |
| `SessionPayload` shape (`userId / email / jti / exp`) | `src/lib/definitions.ts` | 3267 |
| Middleware (Next 16 rename → `proxy.ts`): reads `session` + `admin_session` cookies, calls `verifyJwtEdge` / `verifyAdminJwtEdge`, redirects unauthenticated traffic | `src/proxy.ts` | 72–151 |
| Short-lived **Rust BFF JWT** mint endpoint (15-min HS256, separate `RUST_JWT_SECRET`, claims = `sub / tid / roles`) | `src/app/api/auth/rust-token/route.ts` | 23–69 |
| Rust BFF JWT issuer (`ISSUER = 'sabnode-bff'`, `TTL_SECONDS = 15 * 60`) | `src/lib/jwt-for-rust.ts` | 31–89 |
| SabFlow API-key auth (Bearer / `X-API-Key`) for `/api/v1/*` | `src/lib/sabflow/apiKeys/auth.ts` | 22–56 |
| SabFlow workspace role types (`owner / admin / editor / viewer`) | `src/lib/sabflow/workspaces/types.ts` | 12 |
| SabFlow workspace role precedence + helpers | `src/lib/sabflow/workspaces/permissions.ts` | 12–60 |
| In-memory presence store (extends in Phase 7 §1) | `src/lib/sabflow/presence/store.ts` | 14–67 |

**Key takeaways for the gateway:**

- The browser-facing session is an **httpOnly cookie** named `session`, not a
  bearer token. JS in the browser cannot read it. (`src/lib/cookies.ts:46`).
- Two distinct JWT pools exist already: the **user session JWT**
  (`JWT_SECRET`, 7d, cookie-bound) and the **Rust BFF JWT** (`RUST_JWT_SECRET`,
  15-min, header-bound). The Rust BFF pattern is the template for the WS
  gateway token.
- Revocation is `jti`-indexed in Mongo, and a per-user `kind: 'user-wide'`
  sentinel lets "sign out everywhere" invalidate every active token issued
  before a wall-clock cutoff (`src/lib/auth.ts:79–96`). The WS gateway can
  reuse this exact mechanism.

## 2. SabNode's RBAC system (verified against the codebase)

There are **two layers**, in this order of precedence:

1. **Plan ceiling** — `session.user.plan.permissions` (`{moduleKey -> {view, create, edit, delete}}`).
2. **Project role** — `project.agents[].role` (`owner`, `admin`, or a named role
   whose permission template lives on the project owner's
   `user.crm.permissions`).

| Concern | File | Lines |
|---|---|---|
| `PermissionAction` / `ModulePermission` / `EffectivePermissions` types | `src/lib/rbac.ts` | 11–26 |
| Pure `can(effective, moduleKey, action)` check | `src/lib/rbac.ts` | 32–49 |
| `intersectWithCeiling` (plan caps role) | `src/lib/rbac.ts` | 63–84 |
| Elevated-role list (`admin`, `owner`) | `src/lib/rbac.ts` | 91–96 |
| `getEffectivePermissionsForProject` — splits mixed bag, resolves agent role, intersects with ceiling | `src/lib/rbac-server.ts` | 127–182 |
| `requirePermission(moduleKey, action, projectId)` — server-side guard | `src/lib/rbac-server.ts` | 194–199 |
| Path → permission lookup for nav filtering | `src/lib/rbac-server.ts` | 43–77 |
| **Global module registry** (single source of truth for all permission keys) | `src/lib/permission-modules.ts` | 1–142 |
| Module → category mapping (drives UI grouping) | `src/lib/permission-modules.ts` | 146–171 |
| **Per-module key registry pattern** (this is the template to copy for SabFlow) | `src/lib/sabwa/rbac-keys.ts` | 14–42 |

### How a new RBAC key is added (standard pattern, do **not** do this here)

Per the SabWa precedent (`src/lib/sabwa/rbac-keys.ts` lines 1–11), each module
keeps a typed key list and registers it in **three** places:

1. **`src/lib/permission-modules.ts`** — append to the `globalModules` array
   (line 1–142) and to the appropriate entry of `moduleCategories`
   (line 146–171). Phase 8 §1 adds a `'SabFlow'` category here.
2. **`src/lib/definitions.ts`** — extend `GlobalRolePermissions` so the type
   matches at every call site (`SessionPayload` resolution path).
3. **`src/lib/sabflow/rbac-keys.ts`** *(new file in Phase 8 §1)* — `as const`
   tuple + `type SabFlowPermissionKey = (typeof SABFLOW_PERMISSION_KEYS)[number]`
   exactly like SabWa.

After that, callers use `requirePermission('sabflow.doc.write', 'edit', projectId)`
from `src/lib/rbac-server.ts:194` exactly as every other module does. The WS
gateway just calls this function once on upgrade.

## 3. WS-upgrade auth flow — design

### Options considered

**Option A — Cookie via upgrade headers.** The browser's `WebSocket` constructor
automatically attaches `Cookie:` headers when the URL is same-origin (or, in
sub-domain deployments, on a host that shares `COOKIE_DOMAIN` per
`src/lib/cookies.ts:34–38`). The WS server parses `session` from the upgrade
request and calls `verifyJwt(token)` from `src/lib/auth.ts:111`.

- Pros: zero client changes; httpOnly preserved end-to-end; same revocation
  surface as the rest of the app for free.
- Cons: tight CORS coupling — the WS endpoint must live on a host the cookie is
  scoped to (i.e. canonical SabNode host per `src/proxy.ts:23–28`); a
  long-lived (7-day) credential ends up on the WS process for the connection
  lifetime; standalone `services/sabflow-ws` would need cookie-domain sharing.
- Token-in-URL is **rejected outright** — query strings leak via logs and
  Referer.

**Option B — Short-lived JWT via subprotocol or first message.** The client
fetches `/api/sabflow/ws-token` (a new sibling of
`/api/auth/rust-token/route.ts`) over the cookie-authenticated REST surface,
gets a **2-minute** HS256 token, and presents it on connect via the WS
subprotocol header (`Sec-WebSocket-Protocol: sabflow.v1, jwt.<token>`). The
gateway parses it on upgrade and rejects the handshake (HTTP 401) if invalid.
Tokens are bound to `{ sub: userId, tid: workspaceId, docId, roles[], jti, exp }`.

- Pros: short-lived (replay window ≤ 2 min); host-portable (works for both
  in-process Next.js route handler and a separate `services/sabflow-ws`,
  matching the Phase 3 §1 fork); credential surface decoupled from the long
  cookie; `docId` baked into the token closes the room-hopping vector (§6);
  trivially compatible with non-browser clients.
- Cons: one extra REST round-trip on connect; needs token refresh on reconnect
  (handled by the client SDK in Phase 5 §1 — calls the mint endpoint again).

### Decision — **Option B**, with cookie auth on the mint endpoint

We pick **Option B** and reuse Option A's cookie auth on the mint endpoint
itself. Rationale:

1. **Phase 3 §1 is undecided.** That sub-task picks Next.js route handler vs
   standalone `services/sabflow-ws`. Option B works identically for both;
   Option A constrains the standalone case to cookie-domain sharing.
2. **Bench-driven Rust port (Phase 1 §4).** A Rust gateway (`tokio +
   tungstenite`) verifying an HS256 JWT is a 5-line `jsonwebtoken` call,
   identical to the existing Rust BFF verifier (`rust/crates/auth/src/jwt.rs`
   referenced from `src/lib/jwt-for-rust.ts:17`). Cookie parsing + Mongo
   revocation lookup would push verification onto the Node side, defeating the
   Rust win.
3. **Short-lived ≠ unrevocable.** With a 2-minute TTL the existing
   `revoked_tokens` collection (per `src/lib/auth.ts:60–71` + 79–96) remains
   authoritative — the longest a revoked WS connection can stay alive is the
   token TTL, which we already bound. The gateway additionally re-checks
   `isTokenRevoked(jti)` once on upgrade and again on each ping/heartbeat boundary
   that crosses a TTL window.

### Mint endpoint contract

```
POST /api/sabflow/ws-token
Cookie: session=<httpOnly cookie>            # validated via getSession() — same pattern as /api/auth/rust-token/route.ts:26
Body:   { workspaceId: string, docId: string }
```

The handler:

1. `getSession()` → 401 if absent. (Pattern from `src/app/api/auth/rust-token/route.ts:26–32`.)
2. `requirePermission('sabflow.doc.read', 'view', workspaceId)` from
   `src/lib/rbac-server.ts:194` → 403 if denied.
3. Resolve `workspaceMember.role` via the existing workspace permissions module
   (`src/lib/sabflow/workspaces/permissions.ts:12`) and inline it as the JWT's
   `roles` claim (`['viewer'] | ['editor'] | ['admin'] | ['owner']`).
4. Sign HS256 with `JWT_SECRET` (re-use, not a new secret — same trust domain
   as cookies; the *Rust BFF* secret stays separate because Rust BFF is
   server-to-server, the gateway is client-to-server).

Returned JSON: `{ token, expiresAt, expiresIn: 120 }`, response header
`Cache-Control: private, no-store` (copied verbatim from
`src/app/api/auth/rust-token/route.ts:57`).

### Claim layout

```
{
  sub: userId,           // matches SessionPayload.userId
  tid: workspaceId,      // per-workspace scope — §5
  docId: string,         // pin to one CRDT room — §6
  roles: WorkspaceRole[],
  jti: nanoid(),         // revocable via revoked_tokens
  iat, exp               // exp = iat + 120s
}
```

### Token rotation

Reconnect handler in the client SDK (Phase 5 §1) calls `POST /api/sabflow/ws-token`
again whenever the cached `expiresAt - now < 30_000` ms. Server-side rotation
is implicit — every new mint is a brand-new `jti` with a brand-new TTL. The
gateway accepts overlapping connections from the same `userId` (presence stays
correct because the awareness client de-duplicates on `userId` — Phase 7 §1).

### Revocation

Three layers, all already shipped:

1. **TTL expiry** — 2 min, hard ceiling on any leaked token.
2. **Single-jti revoke** — admin tooling writes `{jti}` into
   `revoked_tokens` (`src/lib/auth.ts:60`). Gateway re-checks on upgrade and
   on the first heartbeat past the half-TTL mark.
3. **User-wide revoke** ("sign out everywhere") — sentinel row
   `{userId, kind: 'user-wide', revokedBefore}` (`src/lib/auth.ts:79–96`). The
   gateway treats this as a force-disconnect signal: existing connections
   whose token `iat < revokedBefore` are closed with WS code `4001`.

## 4. Role mapping — n8n → SabNode RBAC

n8n's collaboration model (per the Phase 1 plan, line 31) uses three roles for
a workflow / project: **owner**, **member**, **viewer**. SabFlow's existing
workspace types already have a four-role refinement
(`src/lib/sabflow/workspaces/types.ts:12`).

| n8n role  | SabFlow `WorkspaceRole` | RBAC key (reserved, registered in Phase 8 §1) | Actions granted |
|-----------|--------------------------|------------------------------------------------|-----------------|
| viewer    | `viewer`                 | `sabflow.doc.read`                             | `view` only — read-only WS subscription, no awareness write, no doc mutations |
| member    | `editor`                 | `sabflow.doc.write`                            | `view + create + edit` — full Yjs update broadcast + awareness write |
| owner     | `owner` (and `admin`)    | `sabflow.doc.admin`                            | `view + create + edit + delete` — share-link mint, role changes, doc delete |

n8n has no analog for the **share-link / commenter** tier listed in Phase 8
§2; we leave that as an extension of `sabflow.doc.read` (read + comment-write,
gated by share-token claim rather than a fourth permission key).

### How the gateway uses these keys

```
const guard = await requirePermission(             // src/lib/rbac-server.ts:194
  'sabflow.doc.read',                              // minimum for any WS join
  'view',
  workspaceId,
);
if (!guard.ok) return reject(403);
// Then promote to write if `can(guard.effective, 'sabflow.doc.write', 'edit')` — src/lib/rbac.ts:32
```

The pure `can()` from `src/lib/rbac.ts:32` is reused on the gateway side for
per-message authorization (e.g. an inbound awareness packet from a `viewer`
connection is dropped).

## 5. Per-workspace credential scoping

Every connection is bound to a **single workspace** and a **single doc** by
its `tid` and `docId` claims.

- The mint endpoint refuses to issue a token for a workspace where
  `requirePermission` returns `ok: false` for `sabflow.doc.read`.
- The gateway compares `tid` against the room it serves; mismatch → close
  `4003 workspace-scope-violation`.
- The gateway compares `docId` against the requested room path
  (`/sabflow/ws/:docId`); mismatch → close `4004 room-mismatch`.
- All credential lookups inside the gateway (Mongo `sabflow_docs` reads from
  Phase 2 §1, Redis pub/sub keys from Phase 7 §9) are namespaced with
  `tid:` to enforce the existing multi-tenant guard pattern
  (Phase 2 §8 "Multi-tenant row-level guards (workspaceId + RBAC)").
- Plan-tier seat enforcement (Phase 3 §7, Phase 8 §4) reads `tid` to look up
  the workspace's plan and counts active connections per
  `(tid, docId)`.

## 6. Threat model

| Threat | Mitigation |
|---|---|
| **Token leakage** (token captured from devtools, logs, or memory dump). | 2-min TTL caps the replay window. `Cache-Control: private, no-store` on the mint response (`/api/auth/rust-token/route.ts:57` pattern). Token never in URL — only in the WS subprotocol header, which is not Referer-leaked. Cookie that authenticates the mint is httpOnly. |
| **Replay** (token re-used after the user logs out / a viewer's access is revoked / their role is downgraded). | `jti` indexed in `revoked_tokens` — gateway checks on upgrade and at half-TTL. User-wide revoke sentinel forces disconnect of every active gateway connection whose token `iat < revokedBefore`. Role downgrade also writes a per-user sentinel. |
| **Room hopping** (a token issued for doc A re-used to subscribe to doc B in the same workspace). | `docId` is a JWT claim. The gateway routes by the URL path `:docId` AND independently asserts `claim.docId === path.docId`. A mismatch closes the socket (`4004`). Even an admin token for the same workspace cannot move sideways without a fresh mint. |
| **Workspace hopping** (cross-tenant). | `tid` is a JWT claim. Workspace handler asserts `claim.tid === room.workspaceId`. Mongo / Redis keys are tid-prefixed (per Phase 2 §8). |
| **Signature forgery.** | HS256 with `JWT_SECRET`, same secret already trusted everywhere else in the app; `jose.jwtVerify` rejects everything else. Secret rotation is a global event (see "user-wide revoke" — same mechanism). |
| **Stale RBAC** (token minted under role X, role changes mid-session). | Gateway recomputes `requirePermission` on a periodic interval (every 30s) and on every share-link / role-change event (broadcast via the existing Redis pub/sub bus reserved for presence — Phase 7 §9). On role downgrade, in-flight messages are dropped before the next ack and the socket is closed with a code that triggers SDK token refresh. |
| **Cross-site WS (CSWSH).** | Mint endpoint requires the httpOnly `session` cookie + a CSRF check (`X-Requested-With: fetch` header, plus `Origin` allow-list matching `CANONICAL_HOST_SUFFIXES` in `src/proxy.ts:23–28`). The WS handshake itself is gated by the short-lived token, which cannot be obtained without satisfying the mint preconditions. |
| **Subprotocol stripping by intermediaries.** | Fallback: first WS message after `open` is `{type: 'auth', token}` — gateway accepts whichever arrives first, both verified identically. |

---

## Summary (≤ 200 words)

**Chosen flow:** Browser → `POST /api/sabflow/ws-token` (cookie-authenticated
via `getSession()`, exactly mirroring `src/app/api/auth/rust-token/route.ts`)
→ 2-minute HS256 JWT (claims: `sub`, `tid` = workspaceId, `docId`, `roles[]`,
`jti`, `exp`) signed with the existing `JWT_SECRET` → client opens the
WebSocket and presents the token in `Sec-WebSocket-Protocol: jwt.<token>` (or
the first frame if intermediaries strip subprotocols). Gateway verifies
signature, checks `revoked_tokens.jti` and the per-user `revokedBefore`
sentinel (both already in `src/lib/auth.ts:60–96`), asserts the URL `docId`
matches `claim.docId`, and binds the connection to `tid`. Token rotates on
reconnect; revocation is handled by the same `jti` and user-wide mechanisms
the rest of the app uses; room/workspace hopping closed by the `docId`/`tid`
claims.

**3 RBAC keys reserved** (registered in Phase 8 §1, **not** here):

- `sabflow.doc.read` — viewer parity (n8n viewer).
- `sabflow.doc.write` — editor parity (n8n member).
- `sabflow.doc.admin` — owner / share-link mint / role change (n8n owner).
