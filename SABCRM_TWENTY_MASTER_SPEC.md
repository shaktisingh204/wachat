# SabCRM ⇄ Twenty — Master Implementation Spec

> **Single source of truth for finishing SabCRM to Twenty parity.**
> Derived from a deep, file-level review of the vendored Twenty source at
> `services/sabcrm/packages/` (~14,900 source files). The 13 detailed slice
> catalogs live in [`docs/twenty-review/`](docs/twenty-review/) — this file
> synthesizes them into one feature inventory, data model, gap matrix, and a
> phased build plan.
>
> Last updated: 2026-06-04 · Branch `main`.

---

## 0. How to use this doc

1. Skim **§1 (what's already built)** so you don't rebuild it.
2. Read **§2 (the canonical data model + field types)** — copy these shapes byte-for-byte; they're the contract between front + server.
3. Work the **§5 gap matrix** top-down by phase. Each row = one buildable unit with an effort tag.
4. For depth on any area, open the matching `docs/twenty-review/NN-*.md`.

**Effort tags:** `SIMPLE` = CRUD/UI on our existing stack · `MEDIUM` = real engineering, no new infra · `RUNTIME` = needs a running worker / external integration / new infra (defer until the engine + the unrelated `sabsign-fields` workspace break are fixed).

**Our stack (target):** Next.js App Router + ZoruUI-scoped Twenty CSS (`.st-*`, light+dark) on the front; **Rust crates in `rust/` over MongoDB** behind gated Next server actions; SabNode session/RBAC/**plan** plumbing. NOT NestJS/Postgres/GraphQL/Stripe.

---

## 1. Index of the 13 deep-dive catalogs

| # | File | Covers |
|---|------|--------|
| 01 | `01-server-auth-security.md` | auth, jwt, sso, 2FA, api-key, app-token, sessions, impersonation, captcha, user/workspace/invitation, onboarding |
| 02 | `02-server-data-engine-objects.md` | record-crud, position, transformer, search; standard objects (company/person/opportunity/task/note/attachment/timeline/blocklist/member) |
| 03 | `03-server-messaging-calendar.md` | messaging + calendar sync, connected-account, IMAP/SMTP/Caldav, domains, the background jobs |
| 04 | `04-server-workflow-ai.md` | workflow data model, 4 trigger types, 17 action types, executor/queue, AI tools, logic-functions, code-interpreter |
| 05 | `05-server-billing-admin-infra.md` | billing (Stripe), usage, admin-panel, feature-flag, audit, event-logs, file-storage, infra |
| 06 | `06-server-metadata-permissions.md` | **the metadata engine** — ObjectMetadata/FieldMetadata, full field-type enum, relations, roles + object/field/row permissions, view entities, dynamic API gen |
| 07 | `07-front-object-record-views.md` | record table/board/calendar/index/show/field/inline/picker/merge, filters (AND/OR), sort, group, aggregate, spreadsheet-import, views |
| 08 | `08-front-record-show-activities.md` | record show page + page-layout widgets (19 types), activities (timeline/tasks/notes/emails/calendar/files), BlockNote + TipTap editors, mentions |
| 09 | `09-front-settings.md` | the ENTIRE settings surface (~24 areas) incl. the per-field-type data-model editor |
| 10 | `10-front-nav-command-dashboards.md` | shell/nav/favorites, ⌘K command menu, side-panel, dashboards + chart widgets, theme/token system |
| 11 | `11-front-workflow-ai-apps.md` | visual workflow builder (React Flow canvas), AI chat, applications/marketplace, accounts, spreadsheet-import |
| 12 | `12-front-auth-uilib-shared.md` | auth/onboarding front, twenty-ui categories + tokens, **twenty-shared canonical enums** (field types, object names) |
| 13 | `13-emails-cli-peripheral.md` | transactional emails (8 templates), server CLI/migrations, peripheral packages triage |

---

## 2. Canonical data model (copy these shapes exactly)

### 2.1 Field types — the full `FieldMetadataType` set (24 values)

Twenty's `twenty-shared` is the source of truth. Categories:

| Group | Types |
|---|---|
| **Scalar** | `TEXT`, `NUMBER`, `NUMERIC`, `BOOLEAN`, `DATE`, `DATE_TIME`, `UUID`, `RATING`, `POSITION` |
| **Enum** | `SELECT`, `MULTI_SELECT` (options: `{value,label,color,position}[]`) |
| **Composite** | `CURRENCY` `{amountMicros,currencyCode}`, `FULL_NAME` `{firstName,lastName}`, `ADDRESS` `{addressStreet1/2,city,state,postcode,country,lat,lng}`, `LINKS` `{primaryLinkUrl,primaryLinkLabel,secondaryLinks[]}`, `EMAILS` `{primaryEmail,additionalEmails[]}`, `PHONES` `{primaryPhoneNumber,primaryPhoneCountryCode,additionalPhones[]}`, `ACTOR` `{source,workspaceMemberId,name}`, `RICH_TEXT_V2` `{blocknote,markdown}` |
| **Relation** | `RELATION` (MANY_TO_ONE / ONE_TO_MANY; a relation = **two paired field rows**), `MORPH_RELATION` (polymorphic via `morphId`) |
| **System** | `RAW_JSON`, `TS_VECTOR` (search), `RICH_TEXT` (legacy) |

> **Our status:** we model TEXT/NUMBER/CURRENCY/SELECT/MULTI_SELECT/LINK(S)/EMAIL(S)/PHONE(S)/FULL_NAME/ADDRESS/RATING/RAW_JSON/RELATION/DATE/DATE_TIME/BOOLEAN as renderers+editors. **Gaps:** `ACTOR` (who created/updated), `MORPH_RELATION` (polymorphic targets — needed for notes/tasks attached to *any* object), `RICH_TEXT_V2` blocknote shape, `TS_VECTOR` search, `POSITION` semantics, `NUMERIC` vs `NUMBER`. See §5-A.

### 2.2 Standard objects (field source-of-truth → `02-...md`)

`company`, `person`, `opportunity`, `task` (+`taskTarget`), `note` (+`noteTarget`), `attachment`, `timelineActivity`, `workspaceMember`, `blocklist`, plus dashboards. **Key pattern we're missing:** `task`/`note` link to *any* record via **polymorphic `*-target` junctions** (a task can target a company AND a person). We currently store notes/tasks as activities scoped to one record — parity needs the morph-target model.

### 2.3 Metadata + permission model (→ `06-...md`)

- **ObjectMetadata / FieldMetadata** stored as data (we do this in Mongo `sabcrm_objects` + code `STANDARD_OBJECTS`). Twenty adds: per-field `settings` blob, `isUnique` (derived from indexes), object flags (`isSystem/isRemote/isSearchable/labelIdentifierFieldMetadataId`), **IndexMetadata** (BTREE/GIN, unique, partial).
- **Permissions (4 layers):** role defaults → tri-state **object** overrides (read/update/softDelete/destroy) → tri-state **field** overrides (read/update) → **25 capability flags** (settings + tool families) → polymorphic **RoleTarget** (user/agent/apiKey) → Enterprise **row-level predicates** (nested AND/OR, 16 operands). We have `sabcrm-roles` with free-form string permissions — parity needs the structured enum + field-level + (optionally) row-level.
- **Views are first-class metadata entities:** `view` + `view-field` (visibility/order/width/aggregateOp) + `view-filter` + `view-filter-group` + `view-sort` + `view-group`. We have `sabcrm-views` (kind/filters/sort/group/fields) — close; missing per-field width/aggregateOp + filter-group tree persisted server-side.

---

## 3. API surface (how Twenty exposes it vs how we do)

Twenty generates a **per-workspace GraphQL + REST schema from metadata at runtime** (15 generated ops per object incl. `findMany/findOne/create/update/delete/restore/destroy/mergeMany/groupBy/search`), plus an MCP surface. **We don't replicate dynamic codegen** — instead each capability is a hand-written Rust endpoint under `/v1/sabcrm/*` behind a gated Next action. Our generic `sabcrm-records` crate already covers find/create/update/delete/group/aggregate/count/distinct/duplicates/merge/trash/restore/permanent — which is the practical equivalent of Twenty's generated record ops. Keep extending that crate rather than building a codegen layer.

---

## 4. What's already BUILT on SabNode (don't rebuild)

**Backend — 17 Rust crates** (`sabcrm-core/records/objects/activities/views/favorites/roles/settings/notifications/workflows/audit/invites/dashboards/tags/templates/pipelines/segments`), all mounted in `sabnode-api`, `cargo check -p` green. Records engine: list/get/create/update/delete, group (kanban), aggregate, count, distinct, duplicates, merge, soft-delete/trash/restore/permanent, structured + nested AND/OR filters.

**Frontend — every `/sabcrm` page Twenty-styled (light+dark `.st-*`):** record table (inline edit, pagination, sortable + reorder/resize columns, group aggregations, keyboard nav, bulk select/edit), kanban (+DnD, pipeline-aware), calendar, map, ER-graph; record page (Fields/Notes/Tasks/Activity tabs, relations attach/detach, timeline, composer, **rich-text editor**, attachments via SabFiles, comments, collapsible sections, templates-in-composer, print); ⌘K command menu (search/navigate/actions/recent/favorites/shortcuts); favorites + notifications bell; saved dashboards w/ editable widgets; advanced AND/OR filter builder; saved views + saved searches; ~26 settings pages (profile/appearance/general/members/invites/roles/data-model[field+option+color+relation+per-object editors]/api[+scopes]/playground/webhooks[+event matrix]/audit/functions/security/accounts/usage/lab/tags/templates/pipelines/segments/notifications/localization/help/**billing[plan-based]**/import-export[wizard]/views/automations[workflow builder]); duplicates page, trash page, activity feed, getting-started.

**Runtime wiring (best-effort, inline):** record mutations auto-write **audit** entries, **notify on assignment**, and **run matching workflows** (create_task/send_notification/update_field/webhook); workflow **Run-now**. Billing is **plan-based on SabNode's plan** (no Stripe).

---

## 5. GAP MATRIX → the build plan

Ordered by phase. ✅ built · 🟡 partial · ⬜ missing.

### Phase A — Data-model & field-type parity (mostly SIMPLE/MEDIUM, no new infra)

| Item | State | Effort | Notes |
|---|---|---|---|
| `ACTOR` field type (created/updated by) | ⬜ | SIMPLE | render `{source,name}`; auto-set on mutations (we have actorId in gate) |
| `MORPH_RELATION` + `*-target` junctions | ⬜ | MEDIUM | lets a note/task attach to *any* record; new `sabcrm-targets` crate (recordId↔(object,recordId) links) |
| Per-field `settings` blob + `isUnique` + object flags | 🟡 | SIMPLE | extend `sabcrm-objects` doc + data-model editor |
| Index metadata (define indexes per object) | ⬜ | MEDIUM | `sabcrm-objects` stores index defs; ensureIndexes applies them |
| `labelIdentifierFieldMetadataId` (which field is the title) | 🟡 | SIMPLE | we infer `isLabel`; make it editable |
| Field-level permissions (read/update per field per role) | ⬜ | MEDIUM | extend `sabcrm-roles` + gate reads/writes in record actions |
| Structured permission-flag enum (replace free-form strings) | 🟡 | SIMPLE | adopt Twenty's 25-flag vocabulary in `sabcrm-roles` |
| Row-level permission predicates | ⬜ | RUNTIME | nested AND/OR evaluated per query — defer |
| Server-persisted view-field width/aggregateOp + filter-group tree | 🟡 | SIMPLE | extend `sabcrm-views` doc |
| Full-text search (`TS_VECTOR` equiv) | 🟡 | MEDIUM | we have Mongo `$text`; add a real search endpoint + global search UI |

### Phase B — Record experience depth (SIMPLE/MEDIUM)

| Item | State | Effort | Notes |
|---|---|---|---|
| Table row/column **virtualization** + infinite scroll | ⬜ | MEDIUM | for 10k+ rows; we paginate today |
| **Page-layout widget engine** (configurable record-page tabs/widgets) | ⬜ | MEDIUM | `sabcrm-page-layouts` crate; widget types: fields/notes/tasks/timeline/files/record-table/rich-text/graph/iframe |
| **BlockNote-style** slash/block editor (replace our basic rich-text) | 🟡 | MEDIUM | block types + slash menu + @mention; dependency-light |
| Multi-card kanban drag + marquee select | 🟡 | MEDIUM | we have single-card DnD |
| Spreadsheet import: relation-connect column mapping | 🟡 | MEDIUM | map a CSV column to an existing related record |
| Record merge preview/settings tabs | 🟡 | SIMPLE | we have field-picker merge |
| URL-encoded shareable filters/views | ⬜ | SIMPLE | sync view state to query string |

### Phase C — Workflow engine real execution (MEDIUM → RUNTIME)

→ `04-...md`. We store workflows + inline-run 4 actions. Parity:

| Item | State | Effort | Notes |
|---|---|---|---|
| Durable **WorkflowRun** persistence + per-step status | ⬜ | MEDIUM | `sabcrm-workflow-runs` crate; record run history (the builder already shows lastRun) |
| **Variable engine** `{{step.field}}` resolution + output-schema inference | ⬜ | MEDIUM | needed before richer actions |
| Full action library (17): FILTER, IF_ELSE, ITERATOR, DELAY, FIND/UPSERT_RECORDS, FORM, SEND/DRAFT_EMAIL, AI_AGENT, HTTP, CODE | 🟡 | MEDIUM | add action types incrementally; DELAY/ITERATOR need the queue |
| **Visual node canvas** (React-Flow-style branches/loops) | ⬜ | MEDIUM | the headline UI gap; our builder is a linear step list |
| Async **queue worker** + CRON triggers + DB-event listener | ⬜ | RUNTIME | needs a running worker process; today we run inline on mutation |
| Code/AI sandboxes (logic-function, code-interpreter, ai-agent) | ⬜ | RUNTIME | external execution infra |

### Phase D — Settings & admin completeness (mostly SIMPLE)

→ `09-...md`. Most areas BUILT. Remaining:

| Item | State | Effort |
|---|---|---|
| Roles: **field-level** + **record-level filter builder** UI | 🟡 | MEDIUM |
| Application-registrations / marketplace / installed apps | ⬜ | RUNTIME |
| Emailing-domains + custom domains + DNS verify | ⬜ | RUNTIME |
| Admin-panel cluster (config-vars, signing-keys, health, AI providers) | ⬜ | MEDIUM (UI) / RUNTIME (behavior) |
| Object indexes editor + graph ERD polish | 🟡 | SIMPLE |

### Phase E — Runtime integrations (all RUNTIME — need the engine + workers up)

→ `01,03,05,11,12`. **Defer until `sabnode-api` links (fix the unrelated `sabsign-fields` break) and a worker exists.**

- Email sync (Gmail/Outlook/IMAP) + outbound send; Calendar sync (Google/MS/Caldav) — `03-...md` lists every cron/worker.
- Connected accounts OAuth2 + token refresh.
- SSO (OIDC/SAML), 2FA TOTP enforcement, sessions registry — `01-...md`.
- Real-time: SSE/websocket live record updates + Apollo-style optimistic cache.
- AI chat + suggested replies; marketplace apps + front-components runtime.
- Analytics pipeline (telemetry `track`) + support chat boot.

### Phase F — Billing (DONE, plan-based)

Twenty's Stripe model (customer/subscription/price/meter/entitlement/usageEvent + webhook) is **intentionally NOT ported**. SabCRM billing reads **SabNode's plan** (`sessionUser.plan` + `getPlans()` + `sabcrmPlanFeature`), shows entitlement + usage vs plan limits, and redirects changes to `/dashboard/billing`. Twenty's boolean **entitlements** (SSO, CUSTOM_DOMAIN, RLS, AUDIT_LOGS) map to SabNode plan-feature flags if/when those Phase-E features land. → `05-...md`.

---

## 6. Recommended execution order (waves)

The proven cadence: **8–15 disjoint-file agents per wave** (FE+rust pairs; FE agents skip their own `tsc`), one central `cargo check` + `tsc` per wave, commit by explicit path with the `_ported_raw` guard at 0. New crates self-add to `rust/Cargo.toml` via unique anchors; orchestrator mounts in `crates/api` centrally.

1. **Wave A** (Phase A): `sabcrm-targets` crate + morph-relation UI · ACTOR field + auto-set · field settings/flags/index editor · field-level permissions + structured flags · global search endpoint + UI. *(all SIMPLE/MEDIUM, no infra)*
2. **Wave B** (Phase B): page-layout widget engine (`sabcrm-page-layouts` crate + configurable record tabs) · BlockNote-style editor · table virtualization · multi-card kanban · URL-shareable views.
3. **Wave C** (Phase C, static parts): `sabcrm-workflow-runs` crate + run history · variable engine · more action types (FILTER/IF_ELSE/FIND/UPSERT/FORM) · visual node canvas UI.
4. **Wave D** (Phase D): roles field/record-level UI · admin-panel UI · indexes/ERD polish · object-registration UI shells.
5. **Wave E** (Phase E): **only after the engine runs** — stand up a SabCRM worker process for the queue/cron, then wire email/calendar sync, SSO, realtime, AI. This is the multi-week, infra-bearing tier.

---

## 7. Hard blockers / caveats (unchanged)

- **`sabnode-api` won't link** today — solely due to the **pre-existing, unrelated `sabsign-fields` break** (imports a missing `EsignEnvelope`) in the workspace. Every `sabcrm-*` crate compiles standalone (`cargo check -p` green) and is mounted. Nothing runtime can be exercised until this is fixed and the engine is up (`RUST_API_URL` + Mongo).
- Twenty is **Postgres/NestJS/GraphQL/Stripe**; we deliberately re-implement *behavior* on **Mongo/Rust/Next/SabNode-plan**. Copy **data shapes** (field types, object fields, enums from `twenty-shared`) verbatim for compatibility; re-implement everything else natively.
- The vendored Twenty tree (`services/sabcrm/packages/`) and `_ported_raw_misc/` are **reference only** — never promote those files; build native per this spec.

---

*Catalog generated by a 13-agent file-level review on 2026-06-04. Update this file as phases land; keep the per-slice catalogs in `docs/twenty-review/` in sync.*
