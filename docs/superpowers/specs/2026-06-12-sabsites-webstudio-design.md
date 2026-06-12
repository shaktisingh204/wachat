# SabSites — Webstudio-powered Website Builder (Design, as built)

Date: 2026-06-12
Status: Implemented. Supersedes the earlier sidecar+SSO draft in this file —
the user directed: no separate app, no separate login; merge it into SabNode
like other modules.

## Goal

Replace SabNode's home-grown block-based website builder with the full
open-source **Webstudio** platform, vendored into this repo, rebranded
**SabSites**, and merged into the SabNode app: one origin, one process, one
deployment, one login.

## Decisions (user-confirmed)

- **MongoDB**: requested "if possible" — ruled not possible without a rewrite
  (Webstudio is hard-wired to Postgres + PostgREST: Prisma SQL migrations,
  PostgREST-only data access). Confirmed: Postgres/PostgREST stay as a hidden
  internal detail of this module; all other SabNode data remains in Mongo.
- **Name**: SabSites.
- **Legacy block builder**: replaced entirely (module pages + `/web/[slug]`
  removed; the Portfolio module keeps its own copy of the block builder).
- **Integration shape** (iterated during the session): vendored sidecar →
  iframe embed → **final: in-process mount** — the Remix builder is compiled
  with basename `/sites` and its request handler runs inside the Next.js app
  via a catch-all route. No sidecar app, no iframe.

## Architecture (final)

- `vendor/webstudio/` — vendored source (upstream commit f52545a2e9e7…,
  AGPL-3.0; all local changes enumerated in `vendor/webstudio/SABNODE-PATCHES.md`).
- `src/app/sites/[[...path]]/route.ts` — loads
  `vendor/webstudio/apps/builder/build/server/index.js` (ESM, basename
  `/sites`) and forwards requests in-process; rebases document-redirect
  Location headers; client assets staged to `public/sites/` by
  `scripts/build-sabsites.mjs` (`npm run build:sabsites`).
- **Unified auth** — the builder trusts SabNode's `session` JWT cookie
  (shared `JWT_SECRET`, same process) and auto-provisions its user
  (`createOrLoginWithSabNode`); bridged in `createAuthorizationContext`,
  `findAuthenticatedUser`, and the ws-OAuth authorize route. Project
  builders open on `p-<projectId>.<host>` subdomains (upstream's
  origin-isolation model) and authenticate via Webstudio's internal ws-OAuth
  handshake against the dashboard origin — invisible to users.
- **Data layer** — Postgres 16 db `sabsites` + PostgREST :4006
  (PM2 `sabsites-postgrest`, the module's only extra process).
- **Entry points** — app-registry entry "SabSites" → `/sites/dashboard`
  (un-hidden `website-builder` id); `/dashboard/website-builder` is a
  plan-gated forwarder (`plan.features.websiteBuilder`).
- **Branding** — WebstudioIcon SVG swapped for a SabSites mark, all
  user-visible strings/links/favicon rebranded, login reduced to
  "Continue with SabNode" (+ dev secret login).

## Verification

`npm run e2e:sabsites` (Playwright): SabNode session cookie → SabSites
dashboard (no login) → create project via UI → builder opens on
`p-<projectId>` subdomain → canvas renders. Passing 2026-06-12.

## Ops

See `docs/sabsites/README.md` — local setup, PostgREST token minting, prod
(zerobet) requirements (Postgres 16, postgrest binary, wildcard
`*.sabnode.com` DNS/TLS, `AUTH_WS_CLIENT_ID/SECRET`, build step).

## Out of scope (v1)

Custom-domain publishing / static export automation; SabNode-plan →
Webstudio-plan mapping; legacy `sites`/`website_pages` content migration.
