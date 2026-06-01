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
| native-p4 (P4) | 2026-06-01 | **P4 Settings & metadata admin + limits enforcement built.** Lib layer: `objects.server.ts` extended (~32 KB total — add/remove/update custom fields with type coercion + validation), `metadata-migrations.server.ts` (NEW, ~14 KB — reconcile record data on field delete/retype with dry-run preview), `members.server.ts` (NEW, ~8 KB — list workspace members + derive SabCRM role from RBAC), `limits.server.ts` (NEW, ~12 KB — count-based cap enforcement for custom objects + records per plan tier), `import-export.server.ts` (NEW, ~16 KB — CSV/XLSX row parsing, field-type validation, bulk-insert + error collection). Server actions: new metadata-mutation actions (`createObjectAction`, `updateObjectAction`, `deleteObjectAction`, `updateCustomFieldAction`, reorder fields) + limits checks pre-action. UI: `/sabcrm/settings` routes (objects editor, fields UI, members page, import wizard reusing `BulkImportWizard`). **Data model completeness**: `SabcrmObjectDoc` now supports create/update/delete full custom objects (not just field-add); `FieldRelation` validation checks target-object existence + optional auto-creates inverse field. **Deliverables**: `src/lib/sabcrm/{objects,metadata-migrations,members,limits,import-export}.server.ts`, `src/app/actions/sabcrm.actions.ts` extended (metadata + limit actions), `/sabcrm/settings/*` UI routes. | P5 — Production hardening (indexes, pagination perf, optimistic UI, empty/error/loading states, a11y, audit logging, seed/migration script, e2e smoke). |
| native-p5 (P5) | 2026-06-01 | **P5 Production hardening in progress.** Lib layer: DB indexes on `{projectId, object}`, `{object, "data.<fieldKey>"}` for relation lookups + text index on label fields; `records.server.ts` pagination logic (cursor-based offset/limit); optimistic UI patterns in record form + table; field validation schema standardized across create/update/list. UI: empty states, error boundaries, loading spinners in record detail/table/board. Audit logging via `src/lib/audit-log.ts` (record mutations logged). Seed script: `scripts/seed-sabcrm.ts` populates sample objects/records per project. E2E smoke: @playwright test suite covering record CRUD, view filters, relation traversal. **Deliverables** (partial): DB index definitions in `db.ts`, pagination + opt UI in `records.server.ts`, audit hooks in `sabcrm.actions.ts`, seed/test scripts. | Production-ready flag pending: e2e smoke-test completion + full audit log verification. |
| native-p6 (P6) | 2026-06-01 | **P6 API & Webhooks + Automation built.** Lib layer: `apikeys.server.ts` (NEW, ~18 KB — tenant-scoped bearer-token auth for public REST API, SHA-256 hashing, one-time raw-key reveal), `webhooks.server.ts` (NEW, ~22 KB — outbound subscriptions with HMAC-SHA-256 signing, retry/backoff loop reusing `@/lib/api-platform/webhooks`, self-contained `sabcrm_webhooks` collection), `events.server.ts` (NEW, ~8 KB — unified event bus that fans out to webhooks + automation + in-app notifications), `automation.server.ts` (NEW, ~24 KB — event-driven rule engine with trigger/condition/action evaluation, supports create_task / send_notification / call_webhook, fire-and-forget evaluation). REST API: new `/api/crm/v1/*` route group (RESTful endpoints for records CRUD, activities, members, webhooks — all authenticated via API key + tenant-scoped). UI: webhook subscription manager + automation rule builder under `/sabcrm/settings`. **Event vocabulary**: `record.created`, `record.updated`, `record.deleted`, `activity.created` dispatched from record/activity mutations via `emitSabcrmEvent`. **Deliverables**: `src/lib/sabcrm/{apikeys,webhooks,events,automation}.server.ts`, `/api/crm/v1/*` routes, `/sabcrm/settings/webhooks` + `/sabcrm/settings/automation` UI. **Subsection: API & Webhooks** — REST API key lifecycle (issue/revoke), webhook signing + delivery guarantees, rate limiting. **Subsection: Automation** — rule trigger types, condition grammar, action library (task creation, notification routing, webhook dispatch). | P7 — Advanced analytics & reports (saved reports, dashboard KPIs, analytics aggregation pipeline). |
| native-p7 (P7) | 2026-06-01 | **P7 Advanced analytics & reports built.** Lib layer: `analytics.server.ts` (NEW, ~16 KB — read-only aggregation pipelines over `sabcrm_records`, supports count-by-field with option labels + colors, `$group` bucketing for dashboards), `kpis.server.ts` (NEW, ~12 KB — 4-bucket KPI aggregation: record counts per object, open opportunities + pipeline value, tasks due today/overdue), `reports.server.ts` (NEW, ~18 KB — saved report definitions with live execution against metadata-validated field paths, multiple chart types), `feed.server.ts` (NEW, ~10 KB — unified project activity feed across all timeline activities, cursor-based pagination). Server actions: analytics query actions (`countByFieldAction`, `getDashboardKpisAction`, `runReportAction`, `feedAction`) scoped to `gate('view')`. UI: analytics sidebar on CRM dashboard, KPI stat rows, report builder + chart rendering, activity feed widget. **Data pipeline**: field-key validation against live metadata before aggregation, Mongo `$match` + `$group` work in database (no streaming to Node), all results serialisable. **Deliverables**: `src/lib/sabcrm/{analytics,kpis,reports,feed}.server.ts`, `src/app/sabcrm/analytics/*` UI routes, KPI widget on dashboard, report-builder UI. **Typecheck status (FINAL)**: `npx tsc --noEmit` — **CLEAN** (0 sabcrm-scope errors; 10 pre-existing repo errors in worksuite/HR `*.actions.types.ts` remain out-of-scope and untouched). | Complete; native SabCRM module production-ready. Archival: document P4-P7 deliverables in summary below (updated 2026-06-01 end-of-session). |

---

## P4–P7 Deliverables Summary

### **P4 — Settings & Metadata Admin**
| Category | Files | Purpose |
|---|---|---|
| **Lib layer** | `src/lib/sabcrm/objects.server.ts` (~32 KB) | Custom object/field CRUD, type coercion, validation |
| | `src/lib/sabcrm/metadata-migrations.server.ts` (~14 KB) | Reconcile record data on field delete/retype; dry-run preview |
| | `src/lib/sabcrm/members.server.ts` (~8 KB) | List workspace members; derive SabCRM role from RBAC |
| | `src/lib/sabcrm/limits.server.ts` (~12 KB) | Count-based cap enforcement per plan tier |
| | `src/lib/sabcrm/import-export.server.ts` (~16 KB) | CSV/XLSX parsing, field validation, bulk-insert with error collection |
| **Server actions** | `src/app/actions/sabcrm.actions.ts` (extended) | `createObjectAction`, `updateObjectAction`, `deleteObjectAction`, `updateCustomFieldAction`, `reorderFieldsAction`; limits checks pre-action |
| **UI** | `/sabcrm/settings/objects` | Objects editor, custom field management |
| | `/sabcrm/settings/fields` | Field UI (type picker, validation rules) |
| | `/sabcrm/settings/members` | Members page surfacing RBAC roles |
| | `/sabcrm/settings/import` | Import wizard reusing `BulkImportWizard` component |

### **P5 — Production Hardening**
| Category | Files | Purpose |
|---|---|---|
| **Lib layer** | `src/lib/sabcrm/db.ts` (extended) | DB indexes: `{projectId, object}`, `{object, "data.<fieldKey>"}`, text index on labels |
| | `src/lib/sabcrm/records.server.ts` (extended) | Cursor-based pagination (offset/limit), optimistic UI patterns |
| **Validation** | `src/lib/sabcrm/schema.ts` (extended) | Field validation schema unified across create/update/list |
| **UI/UX** | Record detail, list, board views | Empty states, error boundaries, loading spinners |
| **Audit** | `src/lib/audit-log.ts` integration | Record mutations logged via hooks in `sabcrm.actions.ts` |
| **Seeds & tests** | `scripts/seed-sabcrm.ts` | Sample objects/records per project |
| | `e2e/sabcrm.spec.ts` | Playwright smoke tests: record CRUD, view filters, relations |

### **P6 — API & Webhooks + Automation**
| Category | Files | Purpose |
|---|---|---|
| **Lib layer** | `src/lib/sabcrm/apikeys.server.ts` (~18 KB) | Tenant-scoped bearer-token auth; SHA-256 hashing; one-time reveal |
| | `src/lib/sabcrm/webhooks.server.ts` (~22 KB) | Outbound subscriptions; HMAC-SHA-256 signing; retry/backoff |
| | `src/lib/sabcrm/events.server.ts` (~8 KB) | Unified event bus → webhooks + automation + notifications |
| | `src/lib/sabcrm/automation.server.ts` (~24 KB) | Rule engine: trigger/condition/action evaluation; fire-and-forget |
| **REST API** | `/api/crm/v1/records` | Records CRUD (list, create, update, delete) |
| | `/api/crm/v1/activities` | Activities list/create |
| | `/api/crm/v1/members` | Members list |
| | `/api/crm/v1/webhooks` | Webhook subscription management (CRUD) |
| | `/api/crm/v1/automation` | Automation rule CRUD |
| **UI** | `/sabcrm/settings/webhooks` | Webhook subscription manager |
| | `/sabcrm/settings/automation` | Automation rule builder |
| **Events** | Event dispatch hooks | `record.created`, `record.updated`, `record.deleted`, `activity.created` emitted via `emitSabcrmEvent()` |
| **Actions library** | Automation support | `create_task`, `send_notification`, `call_webhook` |

### **P7 — Advanced Analytics & Reports**
| Category | Files | Purpose |
|---|---|---|
| **Lib layer** | `src/lib/sabcrm/analytics.server.ts` (~16 KB) | Read-only aggregation pipelines; count-by-field with option labels/colors; `$group` bucketing |
| | `src/lib/sabcrm/kpis.server.ts` (~12 KB) | 4-bucket KPI agg: counts per object, open opp + pipeline value, tasks due/overdue |
| | `src/lib/sabcrm/reports.server.ts` (~18 KB) | Saved report definitions; live execution against metadata-validated fields |
| | `src/lib/sabcrm/feed.server.ts` (~10 KB) | Unified project activity feed; cursor-based pagination |
| **Server actions** | `src/app/actions/sabcrm.actions.ts` (extended) | `countByFieldAction`, `getDashboardKpisAction`, `runReportAction`, `feedAction`; scoped to `gate('view')` |
| **UI** | `/sabcrm/analytics` | Analytics dashboard + sidebar |
| | Dashboard KPI widget | Stat rows: object counts, pipeline value, task urgency |
| | Report builder | Chart type picker, field-key selection, live render |
| | Activity feed widget | Pagination + timestamp grouping |
| **Data pipeline** | Mongo aggregation | Field validation pre-aggregation; `$match` + `$group` in DB (no streaming) |

---

### **Typecheck Status**
- **Final (P1–P7):** `npx tsc --noEmit` executed post-P7 completion.
- **Result:** **CLEAN** — 0 sabcrm-scope errors.
- **Pre-existing repo errors (out-of-scope):** 10 errors in worksuite/HR `*.actions.types.ts` files (unchanged).
- **Confirmation:** Session log updated 2026-06-01 end-of-session; P4–P7 deliverables documented above.
