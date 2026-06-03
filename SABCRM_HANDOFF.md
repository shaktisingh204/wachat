# SabCRM — Handoff & Resume Guide

> **Read this first to continue the SabCRM work in a new session.**
> Last updated: 2026-06-03 · Branch: `main` · Last commit: `d03599a10`

---

## 1. TL;DR — where things stand

SabCRM exists in **two parallel forms** in this repo. Don't confuse them.

| | What it is | Status |
|---|---|---|
| **A. Native SabCRM module** (`src/app/sabcrm`, `src/lib/sabcrm`, `src/components/sabcrm`) | A working, Mongo-backed, SabNode-native CRM. Builds clean, deployed-ready, part of the SabNode shell. | ✅ **WORKING — this is the product** |
| **B. Literal Twenty 1:1 port drafts** (`_ported_raw_misc/`, `src/**/_ported_raw/`) | ~16,600 raw first-draft files from translating all of `twentyhq/twenty` to Next.js+Mongo. | ⚠️ **NOT working** — raw NestJS/TypeORM/Emotion, don't compile, build-excluded (gitignored). Reference only. |

**The app builds and deploys today.** `next build` was verified green (commit `8882fc8e2` fixed the only blocker). The remaining work is converting form-B drafts into more of form-A.

---

## 2. What is DONE (live, building, on `main`)

- **Native CRM module** — metadata-driven (objects/fields/relations as Mongo data), gated server actions (session→project→RBAC→plan→Mongo), ZoruUI black-&-white UI. Surfaces: overview, record index (table + kanban), record detail (inline edit), saved views/filters, activity timeline, dashboards/analytics, reports, settings (data-model/members/views/api/automations), tasks, REST API (`/api/sabcrm/*`), webhooks, automations. ~80 hand-built files + 257 passing unit tests.
- **SabNode integration** — `sabcrm:view/manage/admin` RBAC keys registered (`permission-modules.ts`, `definitions.ts`, route registry in `dashboard-config.ts` + `rbac-server.ts`); `sabcrmPlanFeature` in `plans.ts`; app-rail entry in `zoru-apps.ts`.
- **Shared SabNode shell** — `/sabcrm/*` wraps in `ZoruHomeShell` (same app rail, header, sidebar, dock, ⌘K, ProjectProvider, LocaleProvider) as `/dashboard`. (commit `d03599a10`)
- **Build-blocker fix** — moved all types out of the `'use server'` `sabcrm.actions.ts` into `sabcrm.actions.types.ts` (Turbopack forbids non-async exports from use-server files). 36 consumers repointed. (commit `8882fc8e2`)
- **Ported from Twenty (promotion + verify, framework-neutral pure TS):**
  - `src/lib/sabcrm/shared/` — **556 files** (utils, constants, types, ai, workflow, metadata, application, i18n, etc.). 0 errors.
  - `src/lib/sabcrm/emails/` — **43 files** (react-email templates + renderer). 0 errors.
  - Deps installed for these: `@sniptt/guards`, `expr-eval-fork`, `temporal-polyfill`, `@lingui/core`, `@lingui/react`, `@react-email/components`, `@tiptap/core`.

**Commits this effort (newest first):** `d03599a10` shell mount · `9496d33ba` emails · `c7a81b96a` shared rest · `3f01d3b9e` shared foundation · `8882fc8e2` build fix.

---

## 3. What is LEFT (the real work)

All remaining work = converting raw drafts (form B) into working native code (form A). **These are genuine framework rewrites, not file copies.** The "promotable" tail (pure TS) is exhausted — everything below needs real engineering.

| Layer | ~Files | Conversion required |
|---|---|---|
| **twenty-server** | ~4,700 (193 framework-coupled) | TypeORM `@Entity` → Mongo schema/collection; NestJS resolver/service → Next.js server action (drop DI); GraphQL inputs → zod; Postgres migrations → Mongo indexes/seed |
| **twenty-front** | ~6,900 | Recoil/Jotai → SabNode store; Apollo GraphQL calls → server-action calls; Emotion/Linaria → ZoruUI; React Router pages → App Router routes under `/sabcrm` |
| **twenty-ui** | ~312 | Emotion/Linaria components → ZoruUI primitives (preserve props/behavior) |
| **SDKs / CLI / apps / website** | ~1,500 | Mostly NOT app runtime — `@genql/cli`, `danger`, `ink`, `inquirer`, `vitest`, `child_process`. **Likely SKIP** (developer/build tooling, not the CRM product). Triage before porting. |

**Where the drafts live (build-excluded, gitignored):**
- `_ported_raw_misc/port/src/...` — bulk (server, front, ui, sdks, apps, website)
- `_ported_raw_misc/app+components/...` — front modules (alt path)
- `src/lib/sabcrm/_ported_raw/` — early server/shared drafts (2,077 files)

> ⚠️ The drafts are **first-draft translations**: many import `@nestjs/*`, `typeorm`, `class-validator`, `@emotion/*` — packages not installed and not usable in Next.js. They do NOT compile. Use them as a *reference/starting point* per file, not as droppable code.

---

## 4. The PROVEN method (and the anti-pattern to avoid)

### ✅ What works — module-by-module, verified
1. Pick ONE coherent module (e.g. one server `metadata-module`, or one front feature).
2. Convert its files for real (entity→Mongo schema, resolver→action, Emotion→ZoruUI). Reuse the matching `_ported_raw` draft as a starting reference, but rewrite to the SabNode stack.
3. Wire imports to live paths (`@/lib/sabcrm/shared`, `@/lib/sabcrm/server`, etc.); install any genuinely-needed runtime deps.
4. **Build-gate:** `NODE_OPTIONS="--max-old-space-size=12288" npx tsc --noEmit` — must be 0 errors in the module's scope. (Full `next build` for UI-touching modules.)
5. Commit ONLY that module by explicit path (never `git add -A` — it sweeps the quarantine). Push.
6. Repeat. App stays green every step.

### ❌ What FAILED (don't repeat)
- **Mass parallel "waves" (100 agents spraying 25 files each).** Tried repeatedly. Wave 6 = 96/100 agents failed; Wave 8 = 100/100 failed, 0 tokens, 4.8 hrs wasted — concurrency starvation on the box. Even when files got written, they were raw NestJS that doesn't compile.
- **`git add -A` / broad `git add src/lib/sabcrm/`** — sweeps the ~16k draft files into commits. Always stage by explicit module path and verify `git diff --cached --name-only | grep -c _ported_raw` is `0`.
- Trusting agent "0 errors / build passed" self-reports — verify `tsc`/`next build` yourself by reading the real log.

### Concurrency limit (hard fact)
Workflows cap at ~16 concurrent agents; the 24GB box OOMs `tsc` at 8GB (use `--max-old-space-size=12288`). Run ONE workflow at a time, small batches (≤16 agents), sequential modules.

---

## 5. Effort estimate (honest)

~12,000 files of genuine rewrite remain. At a sustainable, verified pace this is **many sessions / multi-week**, not a one-shot. Recommended order: `twenty-ui` (UI primitives everything else uses) → `twenty-server` metadata + core modules (the data engine) → `twenty-front` feature modules → SDK/apps triage.

---

## 6. RESUME PROMPT (paste this to continue)

```
Continue the SabCRM → Twenty 1:1 port. Read SABCRM_HANDOFF.md and
SABCRM_NATIVE_PLAN.md first for full context.

State: the native SabCRM module is live and building on `main`; twenty-shared
(556) and twenty-emails (43) are ported. Raw Twenty drafts for everything else
sit build-excluded in _ported_raw_misc/ and src/**/_ported_raw/ (gitignored).

Do the next REAL increment, module by module, verified — NOT mass parallel
waves (those failed 96–100% — see handoff §4):

1. Start with: <PICK ONE — e.g. "twenty-ui → ZoruUI", or "the server
   object-metadata module → Mongo + server actions">.
2. Rewrite its files to the SabNode stack (Mongo + Next server actions +
   ZoruUI), using the matching _ported_raw draft only as reference.
3. Wire imports to @/lib/sabcrm/shared etc.; install only genuinely-needed
   runtime deps (skip CLI/build tooling: @genql/cli, danger, ink, inquirer,
   vitest).
4. Build-gate: NODE_OPTIONS="--max-old-space-size=12288" npx tsc --noEmit
   (and `next build` if UI). Fix until 0 errors in scope.
5. Commit ONLY that module by explicit path (verify no _ported_raw staged),
   push. Then move to the next module. Keep the app green every commit.

Be honest about scope each turn; don't claim the full port is "done" until
every module is converted, building, and wired in.
```

---

## 7. Quick reference — verify commands

```bash
# typecheck (needs big heap; default OOMs)
NODE_OPTIONS="--max-old-space-size=12288" npx tsc --noEmit

# full production build (the real deploy gate; ~15-20 min)
NODE_OPTIONS="--max-old-space-size=12288" npx next build

# guard: ensure no draft files are staged before committing
git diff --cached --name-only | grep -c _ported_raw   # must print 0

# what's ported & live
find src/lib/sabcrm/shared src/lib/sabcrm/emails -name '*.ts*' | wc -l
```

### Deploy note
Production server runs **Node 20.20**, but deps + Twenty want **Node ≥22/24**
(`EBADENGINE` warnings in deploy.log). Bump the server to Node 22+ to clear
warnings and avoid runtime surprises. The native module builds fine on 20 today.
