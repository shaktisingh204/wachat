# SabCRM — Native SabNode Module (Mongo) — Production Plan

> **Status:** Planning → executing Phase 1 via multi-agent workflow.
> **Created:** 2026-06-01 · **Owner:** @shaktisingh204
> **Supersedes the "vendor Twenty engine" approach** (`SABCRM_MASTER_PLAN.md`) for the runtime. Twenty (`services/sabcrm/`, now B&W + rebranded) is kept as a **feature/visual reference only** — it is NOT run in production.

---

## 0. Decision (locked)

Make SabCRM a **first-class SabNode module**, built **natively on SabNode's stack**:

- **Runtime:** Next.js 16 App Router (server actions + route handlers) — no NestJS, no Vite SPA.
- **Database:** **MongoDB everywhere** (SabNode's Mongo), tenant-scoped — no PostgreSQL, no TypeORM.
- **Identity & access:** SabNode **login/session** (`getCachedSession`), **plans** (`src/lib/plans.ts` → `sabcrmPlanFeature`), **users/projects** (`ProjectProvider`, `getCachedProjects`), **RBAC** (`sabcrm:view/manage/admin`, already registered).
- **Data model:** **metadata-driven** (extend the existing `src/lib/sabcrm/types.ts`): standard objects seeded as metadata; per-object custom **fields** supported now; full runtime custom **objects** later. This matches `types.ts` (`ObjectMetadata`/`FieldMetadata`/`CrmRecord`) already in the repo.
- **UI:** **ZoruUI** (black-&-white), reusing the **67 existing `src/components/crm/*`** parts; Twenty's layout/UX as the visual reference.
- **Twenty as reference:** screens, field types, view/filters behavior, and the already-produced B&W/rebrand work inform the native build; no Twenty code runs.

Why: only this satisfies "Mongo in whole + SabNode login/plans/users + part of the ecosystem," and unlike the Twenty engine it is **buildable and type-checkable in this repo** (real verification).

---

## 1. Integration points (SabNode plumbing to reuse — do NOT reinvent)

| Concern | Reuse |
|---|---|
| Session / auth | `getCachedSession`, `getCachedProjects` (`src/lib/server-cache`), `/login` redirect, onboarding gate (see `src/app/sabwa/layout.tsx`) |
| Tenancy | `projectId` scoping + `ProjectProvider` (`src/context/project-context`) |
| Plans / gating | `src/lib/plans.ts` (`sabcrmPlanFeature` added in M3) |
| RBAC | `src/lib/sabcrm/rbac-keys.ts` (`sabcrm:view/manage/admin`), `RBACGuard`, `permission-modules.ts`, `definitions.ts` (registered in M3) |
| Mongo access | SabNode's existing Mongo client/connection helper (discover exact path: `src/lib/mongodb` / `getDb()` pattern used by other modules) |
| Server actions | SabNode's action convention (e.g. `src/app/actions/*.actions.ts`, `ActionResult<T>` already in `types.ts`) |
| Files | **SabFiles** (`@/components/sabfiles`) for any attachment/file field — never raw URLs |
| Shell / nav | `ZoruHomeShell` / module nav registration used by `/sabwa`, `/dashboard` |
| Notifications, audit, bulk import/export | `src/lib/notifications/*`, `src/lib/audit-log.ts`, `src/lib/bulk-import/*`, `src/components/crm/BulkImportWizard.tsx` |

---

## 2. Data model (MongoDB, tenant-scoped)

Collections (all scoped by `projectId`; records also by `userId`/workspace per SabNode convention):

| Collection | Purpose |
|---|---|
| `sabcrm_objects` | `ObjectMetadata` docs (standard + custom objects), per project |
| `sabcrm_records` | `CrmRecord` — `{ object, projectId, userId, data, createdAt, updatedAt }` |
| `sabcrm_views` | Saved views (filters/sorts/visible fields/board config) per object |
| `sabcrm_activities` | Timeline: notes, tasks, calls, comments, logged events |
| `sabcrm_favorites` | Per-user favorites / pins |

Standard objects seeded as metadata (Twenty parity): **Companies, People, Opportunities, Notes, Tasks, Activities** with their standard fields + relations (`MANY_TO_ONE` / `ONE_TO_MANY` per `FieldRelation`). Indexes: `{projectId, object}`, text index on label fields, `{projectId, object, "data.<relationKey>"}` for relation lookups.

---

## 3. Layering

```
src/lib/sabcrm/
  types.ts            (exists — metadata + record types)
  schema.ts           (NEW) standard object/field seed definitions (Twenty parity)
  db.ts               (NEW) Mongo collection accessors (scoped helpers)
  records.server.ts   (NEW) generic record CRUD + query/filter/sort/paginate
  objects.server.ts   (NEW) object/field metadata CRUD (custom fields)
  views.server.ts     (NEW) saved views
  activities.server.ts(NEW) timeline
  rbac-keys.ts, constants.ts, sso.ts (exist; sso now optional/retired)
src/app/actions/sabcrm.actions.ts   (NEW) 'use server' wrappers (RBAC + plan + project checks)
src/app/sabcrm/                      (route group)
  layout.tsx          (exists — guarded; swap iframe shell for native shell)
  page.tsx            overview/dashboard (replace iframe)
  [objectSlug]/page.tsx          record index (table + board views)
  [objectSlug]/[recordId]/page.tsx  record detail
  settings/...        data model (objects/fields), members, views
src/components/sabcrm/               (NEW UI; reuse src/components/crm/* + zoruui)
```

Every server action: resolve session → resolve `projectId` → RBAC check (`can(effective, 'sabcrm:...', action)`) → plan check → Mongo op → return `ActionResult<T>`.

---

## 4. Phases (multi-session; agents execute per phase)

- **P1 — Foundation (this run):** discover exact SabNode plumbing (Mongo client, action convention, nav registration); build `db.ts`, `schema.ts` (seed standard objects), `records.server.ts` (CRUD + query), `sabcrm.actions.ts` (RBAC+plan+project gated), and convert `/sabcrm` from iframe to a **native ZoruUI shell** with a working **record index table** for standard objects + create/edit. **Verify: `tsc --noEmit` clean.**
- **P2 — Records UX:** detail page (field panel + inline edit), board (kanban) view, saved views + filters/sorts, relations (related-records panels), search/command menu entry.
- **P3 — Activities & collaboration:** timeline, notes, tasks, comments; SabFiles attachments; assignment + notifications.
- **P4 — Settings & metadata admin:** objects/fields editor (custom fields), views management, members/roles surfaced from SabNode RBAC, import/export (BulkImportWizard).
- **P5 — Production hardening:** indexes + pagination/perf, optimistic UI, empty/error/loading states, a11y, audit logging, plan limits enforcement, seed/migration script, e2e smoke, docs. Remove iframe/engine glue + temp workflow artifacts.

"Production-ready" = P1–P5; this workflow delivers **P1** verified, then we iterate.

---

## 5. Verification (real this time)

Native code lives in the SabNode Next.js app, so it **type-checks/builds here**: `npx tsc --noEmit` (or `npm run build`). Every workflow phase ends with a typecheck gate; agents fix until clean. No "verify-on-some-other-build" debt.

---

## 6. Disposition of prior work

- `services/sabcrm/` (vendored Twenty, B&W + rebranded): **kept as reference**, not deployed. Remove from `deploy.sh` engine section (or leave guarded/off). 
- `src/lib/sabcrm/sso.ts`, `engine-client.ts`, iframe `page.tsx`: **retired/repurposed** once native UI lands (engine-client may stay for optional reference imports).
- M3 SabNode wiring (RBAC keys, plan feature, guarded layout): **kept — it's exactly the native integration we need.**

---

### Session log
| Session | Date | Done | Next |
|---|---|---|---|
| native-0 | 2026-06-01 | Locked native-Mongo architecture; wrote this plan. Reused M3 auth/plan/RBAC wiring. | P1 foundation workflow (30+ agents). |
| native-1 (P1) | 2026-06-01 | **30-agent foundation built & type-clean.** Data layer: `db.ts`, `schema.ts` (6 standard objects seeded as metadata), `objects/records/views/activities.server.ts`; gated `sabcrm.actions.ts` (session→project→RBAC→plan→Mongo). UI: native `/sabcrm` overview + `[objectSlug]` index + `[objectSlug]/[recordId]` detail; `field-renderer`/`record-table`/`record-form-dialog`/`record-detail`/`sabcrm-shell` (ZoruUI, SabFiles for FILE fields). Nav entry in `zoru-apps.ts`. **`tsc --noEmit`: 0 errors in sabcrm scope** (10 repo errors are pre-existing worksuite/HR `*.actions.types.ts`, untouched). **Fixed P1 security gap:** registered `sabcrmMenuItems` in `dashboard-config.ts` + wired into `rbac-server.ts` `allMenuItems` so `getRequiredPermissionForPath` enforces `sabcrm:view` (`/sabcrm/settings`→`sabcrm:admin`) — RBACGuard no longer falls through. | P2 records UX (detail inline-edit, kanban, saved views/filters, relations, ⌘K). |
| native-p1 | 2026-06-01 | **P1 Foundation built.** Native lib layer under `src/lib/sabcrm/`: `db.ts` (tenant-scoped Mongo collection accessors), `schema.ts` (standard-object seed defs), `records.server.ts` (generic record CRUD + query/filter/sort/paginate), plus the metadata/types already in `types.ts`. Server actions: `src/app/actions/sabcrm.actions.ts` ('use server', gated session → projectId → RBAC `sabcrm:*` → plan → Mongo → `ActionResult<T>`). UI: `/sabcrm` converted from iframe to a native ZoruUI shell with a working record index table (list + create/edit) under `src/app/sabcrm/` (+ `src/components/sabcrm/`). **Standard objects seeded (Twenty parity): Companies, People, Opportunities, Notes, Tasks, Activities** — with standard fields + `MANY_TO_ONE`/`ONE_TO_MANY` relations. Workflow artifact: `.sabcrm-native-p1-workflow.js` (declares a typecheck gate via `tsc --noEmit`); a `tsconfig.sabcrm-check.tsbuildinfo` from an earlier scoped run is present, but no matching `tsconfig.sabcrm-check.json` remains on disk. **Typecheck status: NOT RE-VERIFIED in this session** — partial `tsc --noEmit -p tsconfig.json` runs surfaced no SabCRM-specific `error TS` diagnostics, but the runs did not complete cleanly to a confirmable exit code in this environment, so the P1 typecheck gate must be re-run (`npx tsc --noEmit`) and confirmed before P1 is formally closed. | P2 — Records UX: detail page + inline edit, kanban board, saved views/filters, relation panels, command-menu entry. |
| native-p2 (P2) | 2026-06-01 | **P2 Records UX built.** Lib layer: `relations.server.ts` (NEW, ~9 KB — resolve `MANY_TO_ONE`/`ONE_TO_MANY` relation fields, fetch related-record panels + relation lookups), `views.server.ts` (NEW, ~11 KB — saved views CRUD: filters/sorts/visible-fields/board config per object), and `records.server.ts` extended (~26 KB) to back filter/sort/paginate + kanban grouping. UI under `src/app/sabcrm/` + `src/components/sabcrm/`: record **detail page** (`[objectSlug]/[recordId]`) with field panel + inline edit, **kanban (board) view**, **saved views + filters/sorts** UI, **related-records panels**, and a **command-menu (⌘K) entry**. SabFiles used for FILE fields (no raw URLs); ZoruUI throughout. Workflow artifact: `.sabcrm-native-p2p3-workflow.js` (~18 KB). **sabcrm-scope typecheck: NOT freshly re-verified at close of this log update** — the scoped run leaves `tsconfig.sabcrm-check.tsbuildinfo` (~948 KB, last written 05:07) from an earlier P1/P2 `tsc --noEmit` pass that reported 0 sabcrm-scope errors (10 repo errors remain pre-existing worksuite/HR `*.actions.types.ts`, untouched); re-run `npx tsc --noEmit` to confirm before formal P2 sign-off. | P3 — activities & collaboration (already largely built; see native-p3 row). |
| native-p3 (P3) | 2026-06-01 | **P3 Activities & collaboration built.** Lib layer: `activities.server.ts` expanded to ~19 KB (timeline of notes/tasks/calls/comments/logged events over `sabcrm_activities`, scoped by `projectId`/`object`/`recordId`) and `assignment.server.ts` (NEW, ~13 KB — record assignment to SabNode users + notification hooks via `src/lib/notifications/*`). SabFiles (`@/components/sabfiles`) wired for attachments on notes/activities (no raw URLs). Server actions surfaced through `src/app/actions/sabcrm.actions.ts` (session → projectId → RBAC `sabcrm:*` → plan → Mongo → `ActionResult<T>`). UI: activity timeline + note/task/comment composer + assignment control in record detail under `src/app/sabcrm/` + `src/components/sabcrm/` (ZoruUI). **sabcrm-scope typecheck status (final for this session): NOT freshly re-verified in this log-update turn** — most recent scoped `tsc --noEmit` evidence (`tsconfig.sabcrm-check.tsbuildinfo`, 05:07) showed 0 errors within sabcrm scope, with the only outstanding diagnostics being the 10 pre-existing worksuite/HR `*.actions.types.ts` errors that are out of scope and untouched; the P2/P3 gate must be closed by re-running `npx tsc --noEmit` and confirming a clean sabcrm scope. | P4 — Settings & metadata admin (objects/fields editor, views management, members/roles from RBAC, import/export via BulkImportWizard). |
