# SabCRM — Twenty → Next.js + MongoDB Port Manifest

> Source of truth for the **full 1:1 port** of Twenty to SabNode's stack (Next.js + MongoDB).
> Generated from the vendored Twenty at `services/sabcrm/` (v0.2.1). Machine-generated — re-run `node .sabcrm-manifest-gen.cjs` to refresh counts as files flip to `ported`/`verified`.

**Total files in scope:** 22287  ·  **Code files to port:** 15813  ·  **Ported:** 0  ·  **Verified:** 0  ·  **Progress: 0%**

Full row-level map (every source file → target path + status): `docs/sabcrm-port/manifest.json` (22428 rows).

## Burndown by package (backend-first order)

| # | Package | Tier | Code files | Ported | Status |
|---|---|---|---:|---:|---|
| 1 | `twenty-shared` | core | 565 | 0 | ⏳ pending |
| 2 | `twenty-server` | core | 6180 | 0 | ⏳ pending |
| 3 | `twenty-emails` | core | 45 | 0 | ⏳ pending |
| 4 | `twenty-ui` | core | 345 | 0 | ⏳ pending |
| 5 | `twenty-front` | core | 6666 | 0 | ⏳ pending |
| 6 | `twenty-front-component-renderer` | sdk | 285 | 0 | ⏳ pending |
| 7 | `twenty-sdk` | sdk | 240 | 0 | ⏳ pending |
| 8 | `twenty-client-sdk` | sdk | 12 | 0 | ⏳ pending |
| 9 | `twenty-apps` | apps | 607 | 0 | ⏳ pending |
| 10 | `twenty-website` | site | 763 | 0 | ⏳ pending |
| 11 | `twenty-zapier` | misc | 14 | 0 | ⏳ pending |
| 12 | `twenty-cli` | misc | 1 | 0 | ⏳ pending |
| 13 | `create-twenty-app` | misc | 17 | 0 | ⏳ pending |
| 14 | `twenty-utils` | misc | 6 | 0 | ⏳ pending |
| 15 | `twenty-oxlint-rules` | misc | 23 | 0 | ⏳ pending |
| 16 | `twenty-e2e-testing` | misc | 40 | 0 | ⏳ pending |
| 17 | `twenty-docs` | misc | 4 | 0 | ⏳ pending |
| — | `twenty-claude-skills` | skip | 0 | 0 | ⏭️ skip |
| — | `twenty-companion` | skip | 11 | 0 | ⏭️ skip |
| — | `twenty-docker` | skip | 0 | 0 | ⏭️ skip |

## Port rules (how a file is "ported")

- `*.entity.ts` (TypeORM/Postgres) → **Mongo schema/collection** (`src/lib/sabcrm/server/**`), preserving every field + relation.
- `*.resolver.ts` (GraphQL) → **Next.js server action / route handler**, same inputs/outputs.
- `*.service.ts` → server logic on Mongo; `*.module.ts` → wiring/registry.
- Postgres migrations → Mongo **index/seed** equivalents (data shape preserved).
- `twenty-ui` Emotion components → **ZoruUI** (black-&-white) with the same props/behavior.
- `twenty-front` pages → `/sabcrm` **App Router routes**; components → ZoruUI; Recoil/Jotai → SabNode store; GraphQL calls → action calls.
- Each source file maps to a target file; **status flips pending → ported → verified** (typecheck/tests).

## Phase order (backend-first, your choice)

1. **twenty-shared** (types/utils) — foundation everything imports.
2. **twenty-server** — entities→Mongo schemas, then services, resolvers→actions, metadata engine (78 core + 73 metadata + 18 business modules).
3. **twenty-emails**, **twenty-ui** — shared presentation.
4. **twenty-front** (6,894 files) — screens onto the ported backend.
5. **SDKs + component-renderer**, **twenty-apps** (integrations), **twenty-website**, misc.

_Each session runs parallel, typecheck-gated workflows that port the next package/module batch and flip its rows to `ported`. This file + the JSON are updated each run so coverage is provable, not asserted._
