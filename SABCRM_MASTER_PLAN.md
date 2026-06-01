# SabCRM — Master Plan (Twenty, vendored & rebranded into SabNode)

> **Status:** Planning. Build is multi‑session.
> **Owner:** @shaktisingh204 · **Created:** 2026-06-01
> **Source base:** [`twentyhq/twenty`](https://github.com/twentyhq/twenty) vendored at `/twenty` — **v0.2.1**, commit `e430e4ea0a`.

---

## 0. TL;DR — Locked decisions

We take **Twenty CRM** and **vendor it as‑is**, then wrap it inside SabNode. We change as little of Twenty's internals as possible.

1. **Vendor Twenty as‑is** — keep every internal: NestJS server, GraphQL, **PostgreSQL + Redis (DB untouched)**, TypeORM, BullMQ worker, the dynamic **metadata engine**, and the front stack (Vite + React + **Jotai** + Apollo + React Router + **Linaria**). No rewrites.
2. **Black‑&‑white UI — NO ZoruUI.** We do **not** port Twenty onto ZoruUI primitives. We re‑theme Twenty to a black‑and‑white palette by overriding its **CSS theme variables** (`--t-*`). This is a values‑only change in Twenty's theme CSS — the whole app re‑skins from one place. (ZoruUI is itself B&W, so the look stays on‑brand without adopting the library — per the owner's "no need of zoruui".)
3. **SabNode ecosystem** — mount under `/sabcrm`, single sign‑on handoff from SabNode's session, RBAC/plan gate the module, glue via `src/lib/sabcrm/` (mirrors the `sabwa` engine pattern).
4. **"SabCRM" branding everywhere** — names, logos, emails, titles, favicons, auth/onboarding copy.

> **Why this is now simple:** Twenty's `ThemeProvider` reads CSS variables from the DOM at runtime (`getComputedStyle`). Re‑theming = editing variable *values* in `theme-light.css` (+ `theme-dark.css`). No component edits, no design‑system migration.

---

## 1. Source facts — Twenty v0.2.1 (verified in `/twenty`)

Monorepo: **nx 22.5.4**, **yarn 4.13.0** (npm blocked), Node **^24.5.0** (`.nvmrc` = 24.5.0). Workspaces = `packages/*`.

### Front stack (what we re‑theme & rebrand)
- **Bundler:** Vite · **UI:** React 18 · **Routing:** React Router v6 · **State:** **Jotai** (`JotaiProvider`, atoms per module) · **GraphQL:** Apollo Client v4 · **i18n:** Lingui · **Animation:** framer‑motion.
- **Styling:** **Emotion** (`@emotion/react` + `styled`). Components consume a **JS theme object** via `useTheme()` / `${({ theme }) => theme.xxx}` styled-components. (An earlier scan reported Linaria/`--t-*` CSS vars — that was wrong; verified the real source below.)
- **Theme source of truth (runtime) — VERIFIED:**
  - `packages/twenty-ui/src/theme/provider/ThemeProvider.tsx` — the **single composition point**. Picks `THEME_DARK`/`THEME_LIGHT` by color scheme and passes it to Emotion's `<ThemeProvider theme={…}>`.
  - `packages/twenty-ui/src/theme/constants/ThemeLight.ts` (+ `ThemeDark.ts`) — assemble `THEME_LIGHT` = `{ ...COMMON, accent: ACCENT_LIGHT, background: BACKGROUND_LIGHT, border: BORDER_LIGHT, font: FONT_LIGHT, color: COLOR, grayScale: GRAY_SCALE, … }`.
  - Chromatic sources to neutralize for B&W: **`AccentLight.ts`/`AccentDark.ts`** (the Twenty blue) and **`Colors.ts`** (`COLOR`: named blue/green/red/… families used by tags/avatars/charts).
  - Constants dir: `packages/twenty-ui/src/theme/constants/*.ts` (~67 files).
- **Entry/providers:** `packages/twenty-front/src/index.tsx` → `modules/app/components/App.tsx`. Provider tree: `JotaiProvider → AppErrorBoundary → I18nProvider → SnackBar ctx → IconsProvider → ExceptionHandlerProvider → HelmetProvider → ClickOutside ctx → AppRouter (RouterProvider) → DefaultLayout/BlankLayout`.
- **Entry CSS (`index.tsx` → `index.css`):** only resets; comment confirms *"Themes are injected at runtime by ThemeProvider; static CSS only resets."* → the reskin target is the **Emotion theme JS**, not a CSS file.
- **App shell:** `modules/ui/layout/page/components/DefaultLayout.tsx` (shell) + `modules/navigation/components/AppNavigationDrawer.tsx` (left sidebar) + `MobileNavigationBar`, `MainNavigationDrawer`. Command palette: `modules/command-menu/`.
- **Router:** `modules/app/hooks/useCreateAppRouter.tsx`. Top routes: `/auth/*`, `/onboarding/*`, `/{objectNamePlural}` (record index), `/{objectNamePlural}/{id}` (record detail), `/settings/*`, `/admin/*`, `*` → NotFound. Pages under `src/pages/`.

### Server stack (keep as‑is; only rebrand strings/emails/env)
- **NestJS 11** · entry `packages/twenty-server/src/main.ts` (API :3000) · worker `src/queue-worker/queue-worker.ts` (BullMQ) · CLI `src/command/`.
- **Engine** `src/engine/`: `core-modules/` (auth, workspace, user, billing, cache, jwt, session…), `metadata-modules/` (**dynamic object/field metadata** — `object-metadata/`, `field-metadata/`, `view/`, `*-permission/`, `role/`, `flat-*`), `api/` (GraphQL/REST/MCP), `workspace-manager/` (per‑workspace Postgres schemas), `twenty-orm/`.
- **DB:** **PostgreSQL 16** via TypeORM (patched 0.3.20). **`core` schema** holds metadata + users/workspaces; **per‑workspace schemas** (`workspace_<id>`) hold records. **204 core migrations** in `src/database/typeorm/core/migrations/`. **Redis 7** for sessions/cache/queue/subscriptions. Optional ClickHouse for analytics.
- **API surface:** GraphQL `POST /graphql` (workspace data), `POST /metadata` (object/field defs), `POST /admin-panel`, `WS /graphql` (subscriptions); REST `/rest/*`; webhooks; MCP `/mcp/*`; health `/healthz`.
- **Auth:** email/password (bcrypt), JWT (access/refresh/login/file), Google + Microsoft OAuth, SAML SSO, TOTP 2FA. Multi‑tenant via workspace id in JWT.

### Packages we keep / drop
| Keep | Drop / defer |
|---|---|
| twenty-server, twenty-front, twenty-ui, twenty-shared, twenty-utils, twenty-emails, twenty-docker | twenty-website, twenty-zapier, twenty-companion, twenty-docs, twenty-e2e-testing, create-twenty-app, twenty-cli, twenty-sdk, twenty-client-sdk, twenty-front-component-renderer, twenty-oxlint-rules, twenty-claude-skills |

---

## 2. Target — SabNode

- **App:** Next.js **16.2.3**, App Router (`src/app`), Mongo + Firebase + Redis, PM2 workers, multi‑tenant SaaS.
- **Module mount precedent:** `/sabwa` — `src/app/sabwa/layout.tsx` (shell + session provider + RBAC guard) + `src/lib/sabwa/` (engine‑client, plan limits, RBAC keys). External engine = `services/sabwa-node/`, reached via `SABWA_ENGINE_URL` / `SABWA_ENGINE_TOKEN`. **We mirror this exactly for sabcrm.**
- **Available ecosystem plumbing to integrate (not rewrite Twenty with):** auth/session `src/lib/auth.ts`, RBAC `src/lib/rbac.ts` + `rbac-server.ts` (+ `RBACGuard`), plans `src/lib/plans.ts`, SabFiles picker `src/components/sabfiles/`, notifications, billing.
- **Existing CRM (separate, leave alone):** `src/lib/crm/` + `src/components/crm/` exist but are utility‑level and unrelated; **sabcrm is a new, independent Twenty‑based module.**

---

## 3. Architecture — how Twenty lives inside SabNode

Mirror the `sabwa` engine pattern: Twenty runs as its own service; SabNode wraps and brands it.

```
SabNode (Next.js 16, dev :3000 / :3001)
└── route  /sabcrm  ──────────────────────────────────────────┐
     ├── src/lib/sabcrm/engine-client.ts  (Next ↔ Twenty glue) │
     │     • SSO handoff: SabNode session → Twenty login token  │
     │     • env: SABCRM_ENGINE_URL, SABCRM_ENGINE_TOKEN        │
     └── serves / proxies the Twenty front (Vite SPA)           │
services/sabcrm/  = vendored Twenty monorepo (rebranded, B&W)   │
     • twenty-server  NestJS API + worker                       │
     • twenty-front   Vite SPA (B&W themed)                     │
     • Postgres 16 + Redis 7  (docker-compose.dev.yml)          ┘
```

**Port plan (resolve in Session 1):** Twenty server defaults to **:3000**, which clashes with Next dev. Remap Twenty server (e.g. `:4300`) and front (`:4301`) via env; SabNode Next stays on :3000. Document the final ports in `src/lib/sabcrm/`.

**Mount options (decide Session 1):**
- **(A, default) Reverse‑proxy/embed the Twenty SPA** under `/sabcrm` from the Next app, after an SSO handoff. Faithful to "vendor as‑is, wrap it." Lowest risk.
- **(B) Link‑out** to the Twenty front on its own host with shared auth. Even simpler; less seamless.

---

## 4. The black‑&‑white reskin (Emotion theme override)

**Principle:** override the **Emotion theme JS** at its single composition point, not components and not CSS. Twenty already ships light + dark; we neutralize the chromatic parts of the theme object to grayscale.

### 4.1 Mechanism (verified)
`ThemeProvider.tsx` computes `resolvedTheme = theme ?? (Dark ? THEME_DARK : THEME_LIGHT)` and hands it to Emotion. We wrap that with a transform:

```ts
// new file: twenty-ui/src/theme/provider/applySabcrmBwTheme.ts
export const applySabcrmBwTheme = (t: ThemeType): ThemeType => ({
  ...t,
  accent: GRAYSCALE_ACCENT,   // Twenty blue → zinc/black ramp (same key shape as ACCENT_LIGHT/DARK)
  color: GRAYSCALE_COLOR,     // COLOR families (blue/green/red/…) → gray (same key shape as COLOR)
});
```
…and in `ThemeProvider.tsx`: `const resolvedTheme = applySabcrmBwTheme(base);` (one-line change, covers light + dark at once).

### 4.2 What to neutralize
- **`accent`** (the Twenty blue family) → zinc/black ramp. Highest visual impact.
- **`color`** (named `COLOR` families used by tags/avatars/charts) → grayscale ramp. Decide per-family: default all to gray for a true B&W look; optionally keep `red` for destructive clarity (owner decision Q2).
- Backgrounds/fonts/borders in Twenty light are already near-neutral — leave unless a tint shows.

### 4.3 Caveats
1. **Dual theme system (verified — v0.2.1 is mid-migration).** Twenty has BOTH: (a) the **Emotion theme object** (`theme/constants/ThemeLight.ts` → `THEME_LIGHT`, built from `ACCENT_LIGHT` + `COLOR_LIGHT`), consumed via `useTheme()`; and (b) **CSS variables** `--t-*` (`twenty-ui/src/theme-constants/theme-light.css` + `themeCssVariables.ts`, read by a second `ThemeProvider` via `getComputedStyle`), imported in `index.tsx`. Both derive from the same hue source. **The clean B&W edit is at the source:** make `ColorsLight.ts`/`ColorsDark.ts` (`COLOR_LIGHT.blue*` etc.) + `AccentLight.ts`/`AccentDark.ts` grayscale — that fixes the Emotion object; then **regenerate** `theme-light.css`/`theme-dark.css` (or also override those `--t-*` values) so the CSS-var path matches. Confirm the regeneration command on first build.
2. The override key shapes must match `ACCENT_LIGHT` (`primary/secondary/tertiary/quaternary/accent3570/accent4060/accent1..12`) and `COLOR_LIGHT` exactly (strict lint, no `any`). Fill values once the engine builds.
3. A few components import `COLOR`/`ACCENT_*` constants **directly** — grep + patch stragglers after.
4. Ship **light-only B&W** first (matches SabNode/ZoruUI, light-only); dark later if wanted. **All M1 edits verify-on-build (Node 24 + yarn 4).**

> Net: one new file + one-line provider edit = ~85–90% of the B&W reskin. No ZoruUI, no adapter layer. **Requires a buildable engine to verify** (Node 24 + yarn 4).

---

## 5. Rebrand checklist (Twenty → SabCRM)

- [ ] User‑facing name strings "Twenty" → "SabCRM" (display only — **do not** rename packages, imports, or DB/TypeORM identifiers).
- [ ] Logos / wordmark / favicon / app icons (front `public/`, twenty‑ui logo components).
- [ ] Email templates `twenty-emails` — logo, sender, footer, colors → B&W.
- [ ] `<title>`, meta, manifest, OG.
- [ ] Auth + onboarding copy & sign‑in background imagery.
- [ ] Default workspace name / placeholders / sample‑data labels.
- [ ] Support/help links → SabNode equivalents.
- [ ] Track every replaced string in a `BRAND_MAP.md` for auditability. **No blanket find/replace of "twenty".**

---

## 6. SabNode ecosystem integration

- [ ] **Route:** `src/app/sabcrm/layout.tsx` (import `@/styles/zoruui.css` only for the *wrapper chrome*, RBAC guard, session) + `page.tsx` that loads/embeds the Twenty SPA. Lib: `src/lib/sabcrm/` (engine‑client, env, types — `types.ts` already exists).
- [ ] **SSO handoff:** SabNode session → signed token → Twenty login (engine‑client issues `SABCRM_ENGINE_TOKEN`‑signed handoff; mirror sabwa).
- [ ] **RBAC + plan gate:** register a `sabcrm` RBAC key; gate `/sabcrm` by plan via `src/lib/plans.ts` + `RBACGuard`. (SabNode is multi‑tenant, plan‑gated, RBAC‑guarded — treat sabcrm as a plan feature.)
- [ ] **Optional later:** SabFiles for attachments, route Twenty notifications into SabNode's bell. These are enhancements *on top of* vendored Twenty — keep minimal to honor "vendor as‑is."

---

## 7. Local setup / run (Twenty engine)

Prereqs: Node 24.5 (`nvm use`), corepack (yarn 4.13), Docker (Postgres 16 + Redis 7).

```bash
# inside services/sabcrm (after vendoring twenty there)
corepack enable && nvm use            # Node 24.5.0
yarn install
# DB + cache (dev): Postgres + Redis only
docker compose -f packages/twenty-docker/docker-compose.dev.yml up -d
# or the all-in-one helper (auto-detects local pg/redis or uses Docker, copies .env):
bash packages/twenty-utils/setup-dev-env.sh
# start server(:3000→remap) + front(:3001) + worker:
yarn start
```

Key env (`packages/twenty-server/.env.example`, ~104 vars): `PG_DATABASE_URL`, `REDIS_URL`, `APP_SECRET` (≥32 chars), `FRONTEND_URL`, `SIGN_IN_PREFILLED`, optional auth/email/storage/AI/billing. Add SabNode overrides (`SABCRM_ENGINE_URL`, `SABCRM_ENGINE_TOKEN`, remapped ports) documented in `src/lib/sabcrm/`.

---

## 8. Milestones / multi‑session roadmap

### M0 — Vendor & boot (Session 1)
- [ ] Move/confirm Twenty into `services/sabcrm/` (now at `/twenty`).
- [ ] `nvm use`, `yarn install`, bring up Postgres+Redis, `yarn start` **unchanged**; confirm Twenty boots (baseline). Remap ports off :3000.
- [ ] Scaffold `src/lib/sabcrm/` (engine‑client, env) + `/sabcrm` route placeholder. Confirm mount option A vs B.

### M1 — Black‑&‑white reskin (Sessions 2–3)
- [ ] Add `sabcrm-theme-bw.css` override (grayscale `--t-*`), import after theme CSS.
- [ ] Pass over shell (sidebar, top bar, record table, buttons, tags, avatars) for stray hardcoded colors.
- [ ] Light‑only B&W locked; screenshot diff vs stock Twenty.

### M2 — Rebrand (Sessions 3–4)
- [ ] Names, logos, favicon, titles, auth/onboarding copy, emails → SabCRM. Maintain BRAND_MAP.md.

### M3 — Ecosystem wrap (Sessions 4–6)
- [ ] `/sabcrm` mount + SSO handoff + RBAC/plan gate. Embed/proxy the Twenty SPA. Verify login flows end‑to‑end.

### M4 — Hardening & deploy (Sessions 7+)
- [ ] PM2 apps (`sabcrm-server`, `sabcrm-worker`), Postgres+Redis provisioning, reverse proxy, prod env. CHANGELOG + docs.
- [ ] Optional feature ports (SabFiles attachments, notifications).

---

## 9. Risks & open decisions

| Item | Default / mitigation |
|---|---|
| Twenty server :3000 clashes with Next dev | Remap Twenty to :4300/:4301 via env (Session 1). |
| Two databases (Twenty Postgres alongside SabNode Mongo) | Per owner: **keep Postgres**; sabcrm runs its own DB, no migration. |
| Blanket "twenty"→"sabcrm" rename breaks builds/DB | Rename **display strings only**; track in BRAND_MAP. |
| Upstream Twenty updates | Keep a clean vendor boundary; our only diffs = `sabcrm-theme-bw.css`, brand strings/assets, env — easy to rebase. |
| Embedding a Vite SPA under Next | Default = proxy/embed after SSO (mount option A); fall back to link‑out (B). |
| Dark mode | Ship light‑only B&W first (matches SabNode); dark later if requested. |
| CLAUDE.md says "always use ZoruUI" | Explicitly overridden by owner for sabcrm ("no need of zoruui"); B&W theme keeps the aesthetic aligned. |

---

## 10. Session log

| Session | Date | Done | Next |
|---|---|---|---|
| 0 (plan) | 2026-06-01 | Scope locked: **vendor Twenty as‑is, B&W re‑theme (no ZoruUI), SabNode ecosystem + SabCRM branding.** Verified Twenty v0.2.1 stack (Linaria/Jotai/Apollo/NestJS/Postgres). Wrote this plan. | Session 1 (M0). |
| 1 (M0a) | 2026-06-01 | **Vendored Twenty → `services/sabcrm/` (rsync excl. `.git`); `diff -r` confirms 100% identical to `/twenty` working tree — 22,766 files, 0 missing.** `src/lib/sabcrm/types.ts` glue types present. | M0b. |
| 2 (M0b) | 2026-06-01 | **SabNode integration layer + deploy (no engine boot needed):** `src/lib/sabcrm/` `constants.ts` + `engine-client.ts` (+`isSabcrmEngineUp`) + `rbac-keys.ts`. Route `src/app/sabcrm/` `layout.tsx` + `page.tsx` (iframes engine SPA, ZoruUI offline-fallback). PM2 `services/sabcrm/ecosystem.config.js` (sabcrm-server :4300 + sabcrm-worker). `deploy.sh` extended with guarded engine build/migrate/restart. `.env.example` +SABCRM_* vars. `SABCRM_BRAND_MAP.md` created. **Corrected plan: theme is BOTH Emotion JS object AND `--t-*` CSS vars (mid-migration); CSS-var path is runtime-authoritative.** | M1+M2 via workflow. |
| 3 (M1+M2) | 2026-06-01 | **18-agent workflow: B&W reskin + rebrand.** Reskin = luminance-grayscale (Rec.709) of `src/theme-constants/theme-light/dark.css` (0 chromatic) + 8 Accent/Main/Secondary/Transparent TS color records + new `toGrayscale.ts`/`generateGrayscaleTheme.cjs`. Rebrand Twenty→SabCRM across ~62 files (74 total changed, ~1,371 replacements; 0 broken imports, 0 package renames; identifiers/msgids/GraphQL preserved). **Post-run fix:** patched stale prebuilt `dist/theme-*.css` (was 463 chromatic each → 0) since `exports` resolves the CSS import to `dist/`. | M4 finish pass. |
| 4 (M2 finish + URLs) | 2026-06-01 | **16-agent workflow: finish rebrand + URL pass.** 69 files changed, ~349 replacements. Swapped `app.twenty.com`→`app.sabnode.com`, `twenty.com`→`sabnode.com`, `docs.twenty.com`→`docs.sabnode.com` (domains derived from SabNode's own env+source). Safety verifier PASS. **Verified all edits landed in `services/sabcrm`**; **`/twenty` upstream ref confirmed pristine** (the "wrong directory" claim was a false alarm). | M4. |
| 5 (M2 complete + M3) | 2026-06-01 | **25-agent workflow: complete rebrand + M3 integration.** Rebrand finish: 88 files changed, ~280 replacements across all packages (engine safety PASS). **M3 SabNode wiring (verified PASS, tsc-clean, additive):** RBAC keys `sabcrm:view/manage/admin` registered in `src/lib/permission-modules.ts` + `src/lib/definitions.ts`; `sabcrmPlanFeature` added to `src/lib/plans.ts`; `src/app/sabcrm/layout.tsx` upgraded to guarded layout (session/onboarding/RBACGuard/ProjectProvider); `src/lib/sabcrm/sso.ts` SSO-handoff scaffold + `engineGraphql()` helper in engine-client (engine token-mint contract documented as TODO). **Then fixed the 2 last user-facing residuals** in `twenty-emails` (`clean-suspended-workspace` copy → SabCRM; `Logo.tsx` asset domain → app.sabnode.com). | **Only verify-on-build remains (Node24+yarn4+Docker):** `nx build` (regenerates `dist/index.mjs`), `lingui extract` (regenerates `locales/generated/*` from new source strings), `nx typecheck`, then boot + screenshot. SSO handoff needs the running engine to confirm the token-mint contract. Remaining "Twenty" is test/mock/spec data + identifiers (intentional). |

---

### Appendix — quick facts
- Twenty **v0.2.1**, nx 22.5.4, yarn 4.13.0, Node ^24.5.0.
- Front: Vite · React 18 · React Router v6 · **Jotai** · Apollo v4 · **Emotion** (JS theme object) · Lingui.
- Server: NestJS 11 · GraphQL (Yoga) · **PostgreSQL 16** (core + per‑workspace schemas, 204 migrations) · **Redis 7** · BullMQ · TypeORM 0.3.20.
- Reskin target: `twenty-ui/src/theme/provider/ThemeProvider.tsx` + `theme/constants/AccentLight.ts`,`AccentDark.ts`,`Colors.ts` (neutralize accent + color families to grayscale).
- Mirror pattern: `services/sabwa-node/` + `src/lib/sabwa/engine-client.ts` → `services/sabcrm/` + `src/lib/sabcrm/engine-client.ts`.
- Ports: Next :3000 (SabNode), Twenty server :3000→**remap**, Twenty front :3001→remap.
