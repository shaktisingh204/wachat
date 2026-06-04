# Phase 1C — mount the real `twenty-front` under /sabcrm (with the SabNode app rail)

Goal: serve Twenty's actual frontend (same CSS, same elements, zero drift) inside
SabNode, wrapped in the SabNode **app rail + header**. We do NOT re-port 6000+
files — we build the vendored `twenty-front` and embed it.

## How the integration works (already in the codebase)
- `/sabcrm/layout.tsx` wraps content in `SabcrmOuterShell` (SabNode app rail +
  header) — for BOTH the native pages and the embedded Twenty.
- Flag `SABCRM_USE_TWENTY_FRONT=true` makes `/sabcrm` render `<TwentyEmbed/>`
  (an iframe to the built SPA) instead of the native `.sabcrm-twenty` pages.
- `TwentyEmbed` iframes `NEXT_PUBLIC_TWENTY_FRONT_URL` (default `/sabcrm/app/`).
- The SPA's API calls go to `/sabcrm/api/{graphql,metadata,rest}` → existing
  Next.js proxy → `twenty-server`.
- SabCRM is already an icon in the app rail (`ZORU_APPS`), so it "shows in the
  app rail" out of the box.

## Build + deploy (on the server — Node 22)
1. **Boot twenty-server** (needs Postgres + Redis). Add the PM2 apps from
   `services/sabcrm/ecosystem.config.js` (`sabcrm-twenty-server` / `-worker`),
   set its env from `.env.sabnode.example`, run `yarn database:init:prod` once,
   then `pm2 start sabcrm-twenty-server sabcrm-twenty-worker`.
2. **Build twenty-front** against that server:
   ```
   cd services/sabcrm/packages/twenty-front
   # point it at the proxied API base
   REACT_APP_SERVER_BASE_URL=/sabcrm/api yarn build
   ```
3. **Serve the build at `/sabcrm/app/`** — copy/symlink the build output to a
   static location served under `/sabcrm/app/` (e.g. Next.js `public/sabcrm/app`
   or an nginx alias), or set `NEXT_PUBLIC_TWENTY_FRONT_URL` to wherever it's
   served. Keep it same-origin so the session cookie is shared.
4. **Auth bridge (Wave 2)** — implement `bridgeUserToTwenty` (C6,
   `src/lib/sabcrm/twenty-user-bridge.ts`) so a SabNode session mints a Twenty
   workspace token (one project = one workspace) and the iframe lands
   authenticated. Until then the SPA shows Twenty's own login.
5. **Flip the flag** — set `SABCRM_USE_TWENTY_FRONT=true`, `pm2 restart sabnode-web`.
   `/sabcrm` now serves the real Twenty inside the SabNode app rail. *Revert:*
   set it back to `false` (instant — native pages return).

## What I can / can't do from here
- Done in code: the app-rail-wrapped host, the embed, the flag, the proxy, the
  env, this runbook. Compiles; inert until the flag flips.
- Ops-only (needs the running server + a real Vite build, unverifiable from a dev
  box): steps 1–3 above, and provisioning. The auth bridge (step 4) is code I can
  write next once twenty-server is reachable for a smoke test.
