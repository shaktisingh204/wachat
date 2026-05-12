# SabNode CRM — Master Build Plan

> Every CRM page, every entity, every creation flow — wired through the Rust BFF with a consistent "ecosystem" contract.

This document is the canonical worklist. Each phase ships as one or more PRs and is reviewable on its own. Track progress by checking off entities in §6 — Module Rollout.

---

## 1. Vision

For every CRM entity the user can create, we ship the **full ecosystem** end-to-end:

1. **Rust BFF module** — types, repo, handlers, RBAC, audit, lookup.
2. **TypeScript client** — typed `rust-client/<entity>.ts` wrapping the BFF.
3. **Server actions** — Next.js actions that call the client (no direct Mongo).
4. **Lookup registry entry** — so `<EntityPicker entity="<name>">` works everywhere.
5. **List page** — filterable, sortable, search, pagination, RBAC-gated.
6. **Creation page / dialog** — entity pickers (no free-text where a picker fits), inline-create for reference data, dual-write for legacy schemas.
7. **Detail page** — entity-resolved chips, related-entities sidebar, audit timeline.
8. **Edit flow** — reuses the creation form.
9. **Delete with confirmation** — RBAC-gated, audit-logged.
10. **Cross-references** — anywhere this entity is referenced (deals, invoices, tasks, etc.) renders via `<EntityPickerChip>`.

**Non-goals (this plan):**
- We do **not** redesign the CRM information architecture — same sidebar, same routes.
- We do **not** build new features beyond what already exists today; this is a normalization pass.
- View-only reports/dashboards (Reports & Analytics) are **out of scope** for the creation-ecosystem work — they only need entity-resolution upgrades.

---

## 2. The "Ecosystem" Contract — per entity

Every entity ships these artifacts. Use this as the per-entity PR checklist.

### 2.1 Schema (Rust + TS)

| Artifact | Location | Required |
|---|---|---|
| Rust type | `rust/crates/<crate>/src/<entity>/types.rs` | ✅ |
| TS type | `src/lib/<module>/<entity>-types.ts` | ✅ |
| Mongo collection name | constant `COLLECTION` in repo | ✅ |
| Schema migration script | `rust/migrations/<NN>_<entity>.sql` (if structural) | only if needed |

**Rule**: every `<entity>Name` text field must have a matching `<entity>Id` reference field. Names exist only for legacy compatibility during migration.

### 2.2 Rust BFF module

Every CRM entity gets a module at `rust/crates/crm/src/<entity>/` with:

| File | Purpose |
|---|---|
| `mod.rs` | re-exports |
| `types.rs` | `Entity`, `EntityDraft`, query/filter types |
| `repo.rs` | Mongo `find / find_one / insert / update / delete` — tenant-scoped, no business logic |
| `handlers.rs` | Axum/handlers for the routes below |
| `service.rs` (optional) | non-trivial business logic (e.g. invoice numbering) |

**Standard routes** (mounted at `/v1/crm/<entity>`):

| Method | Path | Purpose |
|---|---|---|
| `GET`  | `/v1/crm/<entity>` | list with `?q=&page=&limit=&filter[...]` |
| `GET`  | `/v1/crm/<entity>/:id` | hydrate one |
| `POST` | `/v1/crm/<entity>` | create |
| `PATCH`| `/v1/crm/<entity>/:id` | partial update |
| `DELETE`| `/v1/crm/<entity>/:id` | delete (soft if applicable) |
| `POST` | `/v1/crm/lookup/<entity>` | unified lookup endpoint — already exists, just add entry |

Every handler:
- pulls `tenantUserId` from the JWT claim,
- runs RBAC via the existing `require_permission(perm, ctx)` helper,
- writes an audit entry via the existing `audit::write` on every mutation,
- returns the canonical `{ data, error }` envelope.

### 2.3 TypeScript client

`src/lib/rust-client/crm-<entity>.ts`:
```ts
export const <entity>Api = {
  list:    (params) => rustFetch('/v1/crm/<entity>',     { params }),
  getById: (id)      => rustFetch(`/v1/crm/<entity>/${id}`),
  create:  (input)   => rustFetch('/v1/crm/<entity>',     { method: 'POST', body: input }),
  update:  (id, patch) => rustFetch(`/v1/crm/<entity>/${id}`, { method: 'PATCH', body: patch }),
  delete:  (id)      => rustFetch(`/v1/crm/<entity>/${id}`, { method: 'DELETE' }),
};
```

Plus a one-line registration in `src/app/actions/crm-lookup.actions.ts` so the picker works.

### 2.4 Next.js server actions

`src/app/actions/crm/<entity>.actions.ts` — `'use server'` thin shims over the rust client. No direct `connectToDatabase()` calls. Each mutation:
- validates the FormData,
- calls `<entity>Api.<op>(...)`,
- `revalidatePath('/dashboard/crm/<module>/<entity>')`,
- returns `{ message?, error?, id? }`.

### 2.5 UI pages

For every entity:

| Page | Path | Notes |
|---|---|---|
| List | `/dashboard/crm/<module>/<entity>/page.tsx` | uses `HrEntityPage` template or custom list — entity-resolved chips in cells |
| Create | `/dashboard/crm/<module>/<entity>/new/page.tsx` **or** modal | the **creation ecosystem** — see §2.6 |
| Detail | `/dashboard/crm/<module>/<entity>/[id]/page.tsx` | server component, hydrates by id |
| Edit | same form, reused under `[id]/edit` or as a modal |

### 2.6 Creation ecosystem (the bar)

Every creation form must:

- Use `<EntityPicker>` / `<EntityFormField>` for every relational and reference field. No free-text inputs for: country, state, city, currency, timezone, language, industry, lead source, job title, salutation, unit, vendor type, **and** for any entity that exists in the registry.
- Show "Create new" inline on every reference picker (`inlineCreate` auto-on) — no detour required.
- Dual-write the `*Name` companion field for as long as the legacy schema has it.
- Default RBAC: refuse to render if the user lacks the permission; show a friendly empty state with a "Request access" CTA.
- Audit-log on successful create.
- After save: redirect to the detail page (long-form pages) **or** close modal and refresh list (inline-create pages).

---

## 3. The Rust BFF template

A new entity in Rust follows this canonical PR (~ 1 day per simple entity, 2-3 for complex):

1. Create the crate module: `cargo new --lib crates/crm-<entity>` (or add a module to the existing `crm` crate).
2. Define `types.rs` mirroring the TS type, with `serde` + `bson` derives.
3. Write `repo.rs` using the existing `Tenant`-scoped collection helper. Tenant scoping is **mandatory** — every query filter starts with `{ tenantUserId }`.
4. Write `handlers.rs` for the 5 standard routes plus the lookup adapter.
5. Wire RBAC via the per-entity permission constant (`crm.<entity>.create`, `crm.<entity>.update`, etc.). Permissions are added to `rust/crates/rbac/src/permissions.rs`.
6. Wire audit log: every mutation handler calls `audit::write` with `entity_kind = "<entity>"` and a diff (full doc on create, before/after on update, full id on delete).
7. Register routes in `rust/crates/crm/src/lib.rs`.
8. Add an integration test in `rust/crates/crm/tests/<entity>_test.rs` covering the 5 routes + tenant isolation.

**Cross-cutting Rust work** (build once, reused by every entity):

- `rust/crates/crm/src/common/tenant.rs` — extract tenant from JWT.
- `rust/crates/crm/src/common/audit.rs` — already exists, just confirm it's reusable.
- `rust/crates/crm/src/common/lookup.rs` — generic lookup adapter so each entity registers with one line.
- `rust/crates/crm/src/common/search.rs` — text/regex search helper.

---

## 4. Pre-requisites & current state

Already done:

- ✅ `EntityPicker` + `EntityFormField` + `EntityPickerChip` shipped.
- ✅ Reference-data registry (country, state, city, timezone, language, salutation, leadSource, jobTitle, currency, industry, unit, vendorType) with inline-create — `src/data/reference/*`.
- ✅ `lookup-registry.ts` with `REFERENCE_ENTITY_KEYS` / `isReferenceEntity`.
- ✅ `HrEntityPage` supports `type: 'entity'` fields with `dualWriteName` + `cascadeFilterFrom`.
- ✅ Phase-2 starter migrations: Projects, Tickets, Deals, Contacts.
- ✅ `audit-log.ts` writer + `rbac-server.ts` helpers exist.
- ✅ `rust-lookup-client.ts` with `USE_RUST_LOOKUP` feature flag.

What's missing:

- ❌ Rust BFF modules for most CRM entities — only `projects` has a stub.
- ❌ Per-action RBAC checks — gating is path-level only.
- ❌ Patchy audit logging — only a handful of save actions write to it.
- ❌ Cascading filter for state → city in HrEntityPage forms still needs an integration sweep.

---

## 5. Phasing (cross-cutting first, then per-module)

### Phase A — Foundation (cross-cutting, blocks everything else)

| # | Task | Effort | Files |
|---|---|---|---|
| A1 | Rust `crm/common/{tenant,audit,lookup,search,rbac}.rs` shared helpers | M | `rust/crates/crm/src/common/**` |
| A2 | Lookup endpoint cleanup — every Rust entity registers via one-liner | S | `rust/crates/crm/src/lookup/mod.rs` |
| A3 | TS `rust-client/crm-base.ts` — typed envelope + per-entity factory | S | `src/lib/rust-client/crm-base.ts` |
| A4 | Generic Next.js action builder: `makeCrmActions<TEntity>()` | S | `src/lib/crm/make-actions.ts` |
| A5 | RBAC permission keys table for every entity (CSV → `rbac/permissions.rs`) | S | `rust/crates/rbac/src/permissions.rs` |
| A6 | Cascading filter wired through `HrEntityPage` (state ↔ country, city ↔ state) | S | `src/app/dashboard/crm/_components/hr-entity-page.tsx` |
| A7 | Audit-trail viewer component `<EntityAuditTimeline entity={...} id={...}>` | S | `src/components/crm/entity-audit-timeline.tsx` |
| A8 | Detail-page template `<EntityDetailShell>` with related-entities sidebar | M | `src/components/crm/entity-detail-shell.tsx` |
| A9 | Per-action RBAC guard — `requirePermission()` invoked in every save action | M | sweep across `src/app/actions/crm*` |

Ship A as **one PR per row**. After Phase A, every per-entity PR is mechanical.

### Phase B — Module rollout

Order by **dependency depth** (entities everything else references go first):

1. **Foundational entities** (referenced by most other modules)
2. **Sales-CRM core** (pipeline, lead, deal, contact, account)
3. **Sales transactions** (quotation, invoice, payment, credit-note)
4. **Purchase transactions** (vendor, PO, bill, debit-note, expense)
5. **Inventory** (item, warehouse, stock, GRN, BOM, production)
6. **Projects & Tasks** (project, task, milestone, issue, time-log)
7. **Tickets & KB** (ticket, group, SLA, article)
8. **Accounting & Banking** (chart-of-accounts, voucher, bank account, transaction)
9. **HR & Payroll** (employee, attendance, leave, payslip, … — heaviest module)
10. **Workspace & Collaboration** (discussion, event, notice, sticky-note)
11. **Master data & Settings** (custom fields, roles, taxes, currencies, etc.)
12. **Cross-cutting features** (files, audit log viewer, automations, dashboards)

Each module gets a sub-doc under `docs/ecosystem/crm/<module>.md` when work starts.

---

## 6. Module rollout — every entity tracked

For each entity below:
- **R** = Rust module + TS client + lookup
- **A** = server actions migrated
- **L** = list page
- **C** = creation page/dialog
- **D** = detail page
- **E** = edit flow
- **X** = cross-refs in other pages updated
- **U** = audit + RBAC wired
- ☐ pending, 🔄 in progress, ✅ done

### 6.1 Foundational

| Entity | Mongo collection | R | A | L | C | D | E | X | U |
|---|---|---|---|---|---|---|---|---|---|
| user (read-only — managed by core) | `users` | — | ✅ | ✅ | — | — | — | ✅ | ✅ |
| pipeline | `users.crmPipelines[]` | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| stage | `users.crmPipelines[].stages[]` | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| tag (unified) | `crm_tags` (new) | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| label | `crm_labels` | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| department | `crm_departments` | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| designation | `crm_designations` | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| brand | `crm_brands` (new) | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| branch | `crm_branches` (new) | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| location | derived (country/state/city) | — | — | — | — | — | — | — | — |

### 6.2 Sales CRM core

| Entity | Mongo collection | R | A | L | C | D | E | X | U |
|---|---|---|---|---|---|---|---|---|---|
| account (client/company) | `crm_accounts` | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | 🔄 | ☐ |
| contact | `crm_contacts` | ☐ | ☐ | ☐ | 🔄 | ☐ | ☐ | ☐ | ☐ |
| lead | `crm_leads` | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| deal | `crm_deals` | ☐ | ☐ | ☐ | 🔄 | ☐ | ☐ | ☐ | ☐ |
| sales-crm pipeline / leads-summary / lead source / status / category | varies | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| sales-crm automation | `crm_automations` | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| sales-crm custom-form | `crm_forms` | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| sales-crm note | `crm_notes` | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| sales-crm agent assignment | `crm_agent_assignments` | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |

### 6.3 Sales transactions

| Entity | Mongo collection | R | A | L | C | D | E | X | U |
|---|---|---|---|---|---|---|---|---|---|
| quotation | `crm_quotations` | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| sales-order | `crm_sales_orders` | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| invoice | `crm_invoices` | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| proforma-invoice | `crm_proforma_invoices` | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| recurring-invoice | `crm_recurring_invoices` | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| credit-note | `crm_credit_notes` | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| receipt / payment | `crm_payments` | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| delivery-challan | `crm_delivery_challans` | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| proposal + templates | `crm_proposals`, `crm_proposal_templates` | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| contract + templates + renewals + types | `crm_contracts`, … | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| service-contract | `crm_service_contracts` | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| subscription | `crm_subscriptions` | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| coupon / gift-card / loyalty | `crm_promotions_*` | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| estimate-request (RFQ) | `crm_estimate_requests` | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| booking | `crm_bookings` | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |

### 6.4 Purchase transactions

| Entity | Mongo collection | R | A | L | C | D | E | X | U |
|---|---|---|---|---|---|---|---|---|---|
| vendor | `crm_vendors` | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| purchase-order | `crm_purchase_orders` | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| bill / expense | `crm_expenses` | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| recurring-expense | `crm_recurring_expenses` | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| debit-note | `crm_debit_notes` | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| rfq | `crm_rfqs` | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| vendor-bid | `crm_vendor_bids` | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| payout | `crm_payouts` | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| hire (contract) | `crm_hires` | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| purchase-lead | `crm_purchase_leads` | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |

### 6.5 Inventory

| Entity | Mongo collection | R | A | L | C | D | E | X | U |
|---|---|---|---|---|---|---|---|---|---|
| item / product | `crm_products` | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| warehouse | `crm_warehouses` | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| stock-adjustment | `crm_stock_adjustments` | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| grn | `crm_grns` | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| bom | `crm_boms` | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| production-order | `crm_production_orders` | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| stock-transaction (read-only) | `crm_stock_transactions` | ☐ | ☐ | ☐ | — | ☐ | — | ☐ | ☐ |

### 6.6 Projects & Tasks

| Entity | Mongo collection | R | A | L | C | D | E | X | U |
|---|---|---|---|---|---|---|---|---|---|
| project | `crm_projects` | ☐ | ☐ | ✅ | ✅ | ☐ | ☐ | ☐ | ☐ |
| task | `crm_tasks` | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| subtask | `crm_subtasks` | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| milestone | `crm_milestones` | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| issue | `crm_issues` | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| project category / label / task-category / task-label / task-tag / taskboard-column | varies | ☐ | ☐ | ☐ | ☐ | — | ☐ | ☐ | ☐ |
| time-log | `crm_time_logs` | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| weekly-timesheet | `crm_weekly_timesheets` | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |

### 6.7 Tickets & Knowledge Base

| Entity | Mongo collection | R | A | L | C | D | E | X | U |
|---|---|---|---|---|---|---|---|---|---|
| ticket | `crm_tickets` | ☐ | ☐ | ✅ | ✅ | ☐ | ☐ | ☐ | ☐ |
| ticket-group | `crm_ticket_groups` | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| ticket-channel | `crm_ticket_channels` | ☐ | ☐ | ☐ | ☐ | — | ☐ | ☐ | ☐ |
| ticket-tag / type | `crm_ticket_tags`, `crm_ticket_types` | ☐ | ☐ | ☐ | ☐ | — | ☐ | ☐ | ☐ |
| sla | `crm_slas` | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| kb-article | `crm_kb_articles` | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| reply-template | `crm_reply_templates` | ☐ | ☐ | ☐ | ☐ | — | ☐ | ☐ | ☐ |
| agent-group | `crm_agent_groups` | ☐ | ☐ | ☐ | ☐ | — | ☐ | ☐ | ☐ |

### 6.8 Accounting & Banking

| Entity | Mongo collection | R | A | L | C | D | E | X | U |
|---|---|---|---|---|---|---|---|---|---|
| chart-of-accounts | `crm_chart_of_accounts` | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| account-group | `crm_account_groups` | ☐ | ☐ | ☐ | ☐ | — | ☐ | ☐ | ☐ |
| voucher | `crm_vouchers` | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| voucher-book | `crm_voucher_books` | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| bank-account | `crm_payment_accounts` | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| bank-transaction | `crm_bank_transactions` | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| reconciliation | derived | ☐ | ☐ | — | — | — | — | — | ☐ |

### 6.9 HR & Payroll (heaviest module)

| Entity | Mongo collection | R | A | L | C | D | E | X | U |
|---|---|---|---|---|---|---|---|---|---|
| employee | `crm_employees` | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| attendance | `crm_attendance` | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| leave / leave-type / balance | `crm_leaves`, … | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| shift / rotation / change-request | `crm_shifts`, … | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| payroll / payslip / salary-structure | `crm_payroll`, … | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| pf-esi / professional-tax / tds / form-16 | varies | ☐ | ☐ | ☐ | ☐ | — | — | ☐ | ☐ |
| goal / okr / kpi / appraisal / feedback-360 / one-on-one | `crm_goals`, … | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| candidate / job / interview / offer / onboarding / exit | `crm_candidates`, … | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| asset / asset-assignment | `crm_assets`, `crm_asset_assignments` | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| document / document-template / policy | varies | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| training / certification / learning-path | varies | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| announcement / recognition / award / survey | varies | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| compensation-band / probation / succession | varies | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| timesheet (HR-flavor) / travel / expense-claim | varies | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |

### 6.10 Workspace & Collaboration

| Entity | Mongo collection | R | A | L | C | D | E | X | U |
|---|---|---|---|---|---|---|---|---|---|
| discussion / category | `crm_discussions`, … | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| event | `crm_events` | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| notice | `crm_notices` | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| sticky-note | `crm_sticky_notes` | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| knowledge-base / category | `crm_kb_internal`, … | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| award / appreciation | varies | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |

### 6.11 Master data & Settings

| Entity | Mongo collection | R | A | L | C | D | E | X | U |
|---|---|---|---|---|---|---|---|---|---|
| currency (master) | `crm_currencies` | ☐ | ☐ | ☐ | ☐ | — | ☐ | ☐ | ☐ |
| tax-rate | `crm_taxes` | ☐ | ☐ | ☐ | ☐ | — | ☐ | ☐ | ☐ |
| unit-type | `crm_units` | ☐ | ☐ | ☐ | ☐ | — | ☐ | ☐ | ☐ |
| expense-category | `crm_expense_categories` | ☐ | ☐ | ☐ | ☐ | — | ☐ | ☐ | ☐ |
| custom-field / group / module | `crm_custom_fields`, … | ☐ | ☐ | ☐ | ☐ | — | ☐ | ☐ | ☐ |
| role / permission-type | `crm_roles`, … | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| company-address / profile | `crm_company_*` | ☐ | ☐ | ☐ | ☐ | — | ☐ | ☐ | ☐ |
| project-status / leadboard / taskboard preference | varies | ☐ | ☐ | ☐ | ☐ | — | ☐ | ☐ | ☐ |

### 6.12 Cross-cutting (no entity, but still in scope)

| Feature | Surface | Status |
|---|---|---|
| Files manager | `/dashboard/crm/files` | ☐ — owned by SabFiles module; ensure cross-refs use `<SabFilePicker>` (per CLAUDE.md) |
| Audit log viewer | `/dashboard/crm/audit-log` | ☐ |
| Activity feed | `/dashboard/crm/activity` | ☐ |
| Notifications center | `/dashboard/crm/notifications` | ☐ |
| Global search | `/dashboard/crm/search` | ☐ — backed by lookup-registry; ensure every new entity is searchable |
| Automations | `/dashboard/crm/automations` | ☐ |
| Dashboards | `/dashboard/crm/dashboards` | ☐ |
| Auto-leads setup | `/dashboard/crm/auto-leads-setup` | ☐ |
| GDPR (consent / removal) | `/dashboard/crm/settings/gdpr/**` | ☐ |
| Setup wizard | `/dashboard/crm/setup` | ☐ |

---

## 7. Per-entity PR template

When picking an entity to ship, copy this checklist into the PR description:

```
## Entity: <name>

- [ ] Rust types in `rust/crates/crm/src/<entity>/types.rs`
- [ ] Rust repo (tenant-scoped) in `…/repo.rs`
- [ ] Rust handlers (5 routes + lookup) in `…/handlers.rs`
- [ ] RBAC permissions added to `rbac/permissions.rs`
- [ ] Audit wired on create/update/delete
- [ ] Integration test in `rust/crates/crm/tests/<entity>_test.rs`
- [ ] TS client `src/lib/rust-client/crm-<entity>.ts`
- [ ] Lookup registry entry in `crm-lookup.actions.ts`
- [ ] Server actions in `src/app/actions/crm/<entity>.actions.ts`
- [ ] List page uses `<EntityPickerChip>` for relational columns
- [ ] Creation form uses `<EntityFormField>` for every relational/reference field
- [ ] Inline-create works for every reference picker
- [ ] Dual-write `*Name` for any legacy column still in the schema
- [ ] Detail page reads via `<entity>Api.getById`
- [ ] Edit reuses the creation form
- [ ] Cross-references in other CRM pages render the picker chip
- [ ] Audit timeline visible on detail page
- [ ] RBAC gate present (`requirePermission('crm.<entity>.<op>')`)
- [ ] Sidebar nav (if applicable) updated
```

---

## 8. Dependency order — first 6 entities to ship

Foundation locked first, then everything else parallelizes by sub-team:

1. **A1–A9** complete (Phase A — blocks all per-entity PRs).
2. **account (client)** — referenced by deal/invoice/contract/PO/everything; ship first.
3. **contact** — referenced by deal/ticket/task/etc.
4. **vendor** — referenced by PO/bill/expense.
5. **item** — referenced by invoice/PO/quotation/stock.
6. **pipeline + stage** — referenced by deal/lead routing.
7. **department + designation** — referenced by employee.

After these 6, the rest of the modules can fan out independently — Sales transactions, Purchases, Inventory, HR — each picks up where it likes.

---

## 9. Effort estimate

Assumptions: 1 engineer, no parallelization, complex entities = 3 days, simple = 1 day.

| Block | Entities | Avg | Days |
|---|---|---|---|
| Phase A foundation | 9 PRs | 1.5d | 13d |
| 6.1 Foundational | 10 | 1d | 10d |
| 6.2 Sales-CRM core | 9 | 2d | 18d |
| 6.3 Sales transactions | 14 | 2.5d | 35d |
| 6.4 Purchase transactions | 10 | 2d | 20d |
| 6.5 Inventory | 7 | 2.5d | 17d |
| 6.6 Projects & Tasks | 9 | 2d | 18d |
| 6.7 Tickets & KB | 8 | 1.5d | 12d |
| 6.8 Accounting & Banking | 7 | 3d | 21d |
| 6.9 HR & Payroll | 32 | 2d | 64d |
| 6.10 Workspace | 6 | 1.5d | 9d |
| 6.11 Master data & Settings | 9 | 1d | 9d |
| 6.12 Cross-cutting | 10 | 2d | 20d |
| **Total** | **~140 entities** | — | **~266 dev-days** |

At 4 engineers in parallel after Phase A, ~3 calendar months.

---

## 10. Open questions / decisions needed

1. **Soft delete vs hard delete** — most CRM systems soft-delete (`deletedAt`). Pick one policy and apply globally. Default proposal: **soft delete** with a 30-day purge job.
2. **Pagination strategy** — keep page+limit, or move to cursor-based for the high-traffic lists (tasks, contacts, leads)? Default proposal: cursor for >5k expected rows, page+limit otherwise.
3. **Detail-page hydration** — server component render with `<entity>Api.getById` (preferred), or client fetch on mount? Default: server.
4. **Custom fields** — already handled by `WsCustomField`. Confirm each new Rust entity respects the `customFields` blob.
5. **Schema migration** — for entities with dual-write debt, when do we drop the `*Name` columns? Default: after the backfill (Phase 3 of original plan) confirms 100% ID coverage for that entity.
6. **Permission naming** — `crm.<entity>.<op>` (e.g. `crm.invoice.create`). Confirm and lock in `rbac/permissions.rs` before any Phase B work starts.
7. **Sidebar updates** — do new sub-pages auto-register, or hand-edit `zoru-app-sidebars.tsx` each time? Default: hand-edit; sidebar is small enough that auto-registration adds more risk than it removes.
8. **Test policy** — Rust integration tests are mandatory; what about Playwright/UI tests per entity? Default: smoke-test the create+list+delete for the top 20 entities; skip for the long tail.

Resolve these in a single follow-up before kicking off Phase A.
