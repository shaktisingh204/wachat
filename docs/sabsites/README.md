# SabSites — website builder (vendored Webstudio)

SabSites is SabNode's website-builder module: a full vendored copy of
[Webstudio](https://github.com/webstudio-is/webstudio) (open-source visual
development platform), rebranded and **compiled into the SabNode app
itself** — one origin, one process, one login. It replaces the old
block-based website builder (`/dashboard/website-builder/manage`,
`/web/[slug]`), which has been removed. The Portfolio module keeps its own
copy of the old block builder.

## Architecture

```
Browser ── /sites/** ──► Next.js (src/app/sites/[[...path]]/route.ts)
                              │  loads vendor/webstudio/apps/builder/build/server
                              │  (Remix request handler, basename /sites)
                              ▼
                    PostgREST :4006 (pm2: sabsites-postgrest)
                              ▼
                    Postgres 16, database `sabsites`
```

- **Source**: `vendor/webstudio/` (pnpm workspace, Node 22). Every local
  change is enumerated in `vendor/webstudio/SABNODE-PATCHES.md`.
- **Mount**: `src/app/sites/[[...path]]/route.ts` runs the compiled Remix
  handler in-process; client assets are copied to `public/sites/` and served
  statically.
- **Auth (unified)**: the builder trusts SabNode's `session` JWT cookie
  (`JWT_SECRET`) and auto-provisions its user on first visit — there is no
  separate SabSites login. Project builders open on `p-<projectId>.<host>`
  subdomains (Webstudio's origin-isolation model) and authenticate through
  Webstudio's internal ws-OAuth handshake against the dashboard origin,
  which is in turn satisfied by the SabNode cookie. All invisible to users.
- **Data**: Webstudio is hard-wired to Postgres + PostgREST; this stays an
  internal implementation detail of the module. All other SabNode data
  remains in MongoDB.
- **Entry points**: dock/app registry entry "SabSites" → `/sites/dashboard`;
  `/dashboard/website-builder` is a plan-gated forwarder
  (`plan.features.websiteBuilder`).

## Local setup (macOS dev box)

```sh
# 1. Postgres 16 (brew) — create role + db once
brew services start postgresql@16
psql -h localhost -d postgres -c "CREATE ROLE sabsites LOGIN PASSWORD 'sabsites' SUPERUSER"
createdb -h localhost -O sabsites sabsites

# 2. Migrations (Node 22 required by the webstudio workspace)
cd vendor/webstudio
corepack pnpm install
export DATABASE_URL=postgresql://sabsites:sabsites@localhost:5432/sabsites
export DIRECT_URL=$DATABASE_URL
corepack pnpm --filter=@webstudio-is/prisma-client generate
corepack pnpm --filter=./packages/prisma-client migrations migrate --cwd ../../apps/builder
# PostgREST caches the schema at startup — restart it after migrating
# (pm2 restart sabsites-postgrest) or it answers 42P01 "relation does not
# exist" and /sites loops back to /sites/login.

# 3. PostgREST
brew install postgrest
pm2 start ecosystem.config.js --only sabsites-postgrest   # or run the binary directly

# 4. Build the builder + stage assets (repeat after changing vendor/)
npm run build:sabsites

# 5. .env — see the SabSites section in .env.example
#    (POSTGREST_URL/POSTGREST_API_KEY/SABSITES_POSTGREST_JWT_SECRET/AUTH_SECRET/PLANS/…)

# 6. Run the app and open /sites/dashboard while logged into SabNode
npm run dev
```

`POSTGREST_API_KEY` is an HS256 JWT with claim `{"role":"sabsites"}` signed
with `SABSITES_POSTGREST_JWT_SECRET`:

```sh
node -e 'const {createHmac}=require("crypto");const b=(v)=>Buffer.from(JSON.stringify(v)).toString("base64url");const h=b({alg:"HS256",typ:"JWT"}),p=b({role:"sabsites",exp:4102444800});console.log(`${h}.${p}.`+createHmac("sha256",process.env.S).update(`${h}.${p}`).digest("base64url"))' S=<secret>
```

## Verification

`npm run e2e:sabsites` (Playwright, against a running dev server) checks:
unified auth into the dashboard → project creation through the real UI →
builder opens on its `p-<projectId>` subdomain → canvas renders.

## Production (zerobet) notes

- Install Postgres 16 + the `postgrest` binary; run migrations as above;
  `pm2 start ecosystem.config.js --only sabsites-postgrest`.
- Deploy step: `npm run build:sabsites` before `next build` (vendor assets
  land in `public/sites/`).
- **Wildcard DNS + TLS for `*.sabnode.com`** must route to the Next.js app —
  project builders live on `p-<projectId>.sabnode.com`. Set real
  `AUTH_WS_CLIENT_ID` / `AUTH_WS_CLIENT_SECRET` (any strong random values).
- Set `AUTH_SECRET`, `SABNODE_APP_URL=https://sabnode.com`, and S3/R2 vars
  for media storage at scale.

## Out of scope (v1) / follow-ups

- Publishing to custom domains / static export automation
  (`@webstudio-is/cli` exists upstream; the publish dialog's cloud targets
  are not wired to SabNode infrastructure yet).
- Mapping SabNode plan tiers to Webstudio `PLANS` (today every user gets the
  single Pro-like plan from env).
- Migration of legacy `sites` / `website_pages` Mongo content.

## Licensing

Webstudio core is **AGPL-3.0-or-later** — running it as a network service
requires offering the modified source, which the vendored tree +
`SABNODE-PATCHES.md` satisfies. `packages/sdk-components-animation` is
proprietary (Webstudio EULA): accept it or disable that package before
production.
