# SabNode patches to vendored Webstudio

This tree is a vendored copy of https://github.com/webstudio-is/webstudio
(AGPL-3.0-or-later, upstream commit `f52545a2e9e747a451d03d91421751d86535331f`), rebranded **SabSites** and compiled into the SabNode
app (mounted at `/sites` by `src/app/sites/[[...path]]/route.ts`). This file
enumerates every local modification so upstream upgrades stay tractable and
the AGPL source-offer obligation is easy to satisfy.

> Upgrade recipe: pull upstream into a fresh clone, re-apply the sections
> below (each is small and grep-able), rebuild via
> `node scripts/build-sabsites.mjs`.

## 1. Branding (Webstudio → SabSites)

- `packages/icons/src/__generated__/components.tsx`, `__generated__/svg.ts` —
  `WebstudioIcon` SVG replaced with the SabSites mark (gradient square + "S").
- `apps/builder/public/favicon.ico` — SabSites favicon.
- `apps/builder/app/**` user-visible strings "Webstudio" → "SabSites":
  `auth/login.tsx`, `routes/_ui.login._index.tsx` (+ canonical link removed),
  `routes/_ui.dashboard.tsx`, `routes/_ui.dashboard.search.tsx`,
  `routes/_ui.logout.tsx`, `routes/_ui.error.tsx`, `builder/builder.tsx`
  (document.title), `builder/features/publish/publish.tsx`,
  `builder/features/blocking-alerts/blocking-alerts.tsx`,
  `builder/features/settings-panel/variable-popover.tsx`,
  `builder/sidebar-left/sidebar-left.tsx`, `shared/notifications/subscription.tsx`
  (changelog link removed), `services/workspace-router.server.ts`,
  `builder/features/sync-status.tsx`.
- `apps/builder/app/shared/help.tsx` — socials emptied; help links →
  sabnode.com. `dashboard/dashboard.tsx` — Inception banner removed.
  `dashboard/profile-menu.tsx` — pricing link → sabnode.com/pricing.
- Default dev email `hello@webstudio.is` → `hello@sabnode.com`
  (`services/auth.server.ts`, `routes/auth.dev.tsx`).

## 2. Login

- `apps/builder/app/auth/login.tsx` — Google/GitHub buttons replaced with a
  single "Continue with SabNode" button (`SABNODE_APP_URL`); secret login kept
  behind `DEV_LOGIN`. `LoginProps` gained `sabnodeUrl`, lost the OAuth flags
  (`routes/_ui.login._index.tsx`, `auth/login.stories.tsx` updated).

## 3. SabNode unified auth (no separate login)

- NEW `apps/builder/app/services/sabnode-auth.server.ts` — verifies the
  SabNode `session` cookie (HS256 JWT, `JWT_SECRET`) without extra deps.
- `apps/builder/app/shared/db/user.server.ts` — added
  `createOrLoginWithSabNode(context, email, username)` (provider "sabnode").
- `apps/builder/app/shared/context.server.ts` — `createAuthorizationContext`
  falls back to the SabNode cookie (auto-provisioning the user) when there is
  no native session and the request is not a builder (p-*) origin; exported
  `getAuthenticatedSessionData` helper.
- `apps/builder/app/services/auth.server.ts` — `findAuthenticatedUser`
  delegates to `createContext` so the fallback applies.
- `apps/builder/app/routes/oauth.ws.authorize.tsx` — uses
  `getAuthenticatedSessionData` (otherwise the project-builder OAuth dance
  loops via /login for SabNode-cookie users).
- `apps/builder/app/env/env.server.ts` — added `SABNODE_APP_URL`,
  `JWT_SECRET`; empty-string env vars are normalized to undefined (shared
  .env files set things like `VERCEL_ENV=`).

## 4. /sites mount (embedded in the SabNode Next.js app)

- `apps/builder/vite.config.ts` — `base: "/sites/"`,
  `basename: "/sites"` for builds (`"/sites/"` for the standalone dev
  server), `vercelPreset` removed (plain `build/server/index.js` output).
- Raw (non-router) URLs prefixed with `/sites`:
  `shared/trpc/trpc-client.ts`, `routes/trpc.$.ts`,
  `shared/nano-states/props.ts` (`assetBaseUrl`),
  `builder/features/publish/publish.tsx` (ssg download),
  `routes/cgi.image.$.ts`, `routes/cgi.asset.$.ts`, `routes/cgi.video.$.ts`,
  `routes/_ui.$.tsx` (publicPaths),
  `shared/router-utils/path-utils.ts` (`restAssetsPath`,
  `restAssetsUploadPath`, `restResourcesLoader`, `getCanvasUrl`,
  `restLogoutPath`, `planSubscriptionPath`, `dashboardUrl`,
  `cloneProjectUrl`, and `builderUrl` embeds `/sites` in absolute URLs).
- ws OAuth endpoints carry the prefix: `services/builder-auth.server.ts`
  (authorize/token/redirect URIs), `routes/oauth.ws.authorize.tsx`
  (callback-path check `/sites/auth/ws/callback`; redirect-uri check compares
  origins because `builderUrl` now has a pathname).
- `packages/http-client/src/index.ts` — `parseBuilderUrl` preserves the
  request protocol instead of forcing https (plain-http local dev).
- `apps/builder/app/services/auth-strategy/ws.server.ts` — the
  `debug.enable()` silencing call is wrapped in try/catch (the host app's
  DEBUG state can be unparseable).
- UI routes additionally allow `sec-fetch-dest: iframe`
  (`routes/_ui.(builder).tsx`, `_ui.dashboard.tsx`, `_ui.login._index.tsx`,
  `_ui.logout.tsx`) — harmless leftover from an earlier embed approach,
  kept for flexibility.
- `apps/builder/.env.development` — local standalone-dev values
  (sabsites Postgres/PostgREST, dev login).
- Basename leaks that broke the canvas/images (browser-facing paths the first
  pass missed):
  - `apps/builder/app/routes/_ui.(builder).tsx` — CSP `frame-src` →
    `${origin}/sites/canvas`; dropped `help.webstudio.is`.
  - `apps/builder/app/shared/router-utils/is-canvas.ts` — `isCanvas` pathname
    check → `/sites/canvas` (else the canvas route 404s under the basename).
  - `packages/image/src/image-loaders.ts` — `wsImageLoader`/`wsVideoLoader`
    detect a `/sites/cgi/asset` prefix on input and emit the matching
    `/sites/cgi/image|video/` base (bare `/cgi/...` still works for the CLI).
  - `packages/sdk/src/assets.ts` — `getAssetUrl` gained an optional
    `basePath=""`; builder callsite `asset-manager/asset-info.tsx` passes
    `"/sites"` so download/preview links resolve.
  These keep the CLI/publish (bare-path) output intact; revisit when
  custom-domain publishing is wired.

## SabNode chrome on the dashboard (project list)

The SabSites dashboard (project list) is restyled to wear SabNode chrome
in-process (no iframe, no native rebuild); the editor/canvas stays chromeless.
- NEW `apps/builder/app/dashboard/sabnode-chrome.tsx` — `SabNodeTopHeader`
  (SabSites mark + wordmark + "Open SabNode") and a floating macOS-style
  `SabNodeDock` linking to SabNode apps.
- `apps/builder/app/dashboard/dashboard.tsx` — wraps the dashboard in a column
  (header + body) + the dock; sidebar gains a "SabNode" section
  (`SabNodeNavItems`, plain `<a>` so links escape the /sites basename into the
  Next.js shell) with Back-to-SabNode + Portfolio/URL-shortener/QR/SEO; removed
  the empty "Follow us" row.
- Links to SabNode routes use raw anchors (full-page nav) because the dashboard
  is on the apex origin; Remix `<Link>` would prepend the /sites basename.

Note: the published-site "Built with SabNode" badge still uses the upstream
`Webstudio1cIcon` glyph (`packages/sdk/src/core-templates.tsx`) — only renders
on published output, deferred with the publishing work.

## Licensing

- Webstudio core: AGPL-3.0-or-later. SabNode offers this modified source
  (this vendored tree) to satisfy the network-use clause.
- `packages/sdk-components-animation` is proprietary (Webstudio EULA) —
  review/accept the EULA or disable the package before production use.
