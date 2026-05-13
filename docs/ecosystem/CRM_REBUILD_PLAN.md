# SabNode CRM + HRM — Cross-Platform Ecosystem Rebuild Plan

> Successor to `CRM_PLAN.md`. Treat this as the canonical worklist for converting the CRM + HRM into a fully-connected ecosystem where every page, every dropdown, every detail view talks to every other one — backed by Rust, RBAC-gated, audit-logged, and ready for mobile + API clients.

## Why a new plan

The original `CRM_PLAN.md` shipped the ecosystem **contract** (per-entity Rust crate + TS client + actions + list/create/detail/edit/cross-refs). It estimated 266 dev-days for ~140 entities.

We're now ~30% through:
- **6 entities** have the full ecosystem end-to-end: account, contact, vendor, item, pipeline+stage, department+designation.
- **29 Rust business-logic crates** + 31 TS clients exist (most without dual-impl yet).
- **Foundation is complete**: `EntityPicker` with global `allowCreate=true`, 39 EntityKeys with cascade filters, `EntityFormField`, `EntityMultiFormField`, `EntityDetailShell`, `EntityAuditTimeline`, `crm-common` Rust crate, `sabnode-rbac` crate, makeCrmClient / makeCrmActions factories, sidebar with ~305 grouped nav items.

This document picks up where `CRM_PLAN.md` left off and adds three new tracks:

1. **Cutover** — flip every action to USE_RUST_CRM=true in production.
2. **Ecosystem wiring** — make every page click-through to every linked entity, render lineage rails, surface activity, expose Cmd-K everywhere.
3. **New features** — subscription dunning, e-signature, POS, SLA engine, dashboard widget builder, portal auth, audit-log viewer, notifications hub.

---

## 0. North-star definition: "ecosystem"

A page is ecosystem-ready when:

1. **Every entity-reference field uses `<EntityFormField>` (or `<EntityMultiFormField>`).** No free-text where a picker fits. `allowCreate=true` by default; reference entities offer inline-create; non-reference entities can wire `onCreateClick` to a side-sheet.
2. **Every chip is clickable** — clicking a chip on a list/detail page navigates to that entity's detail page; meta+click opens a side-sheet (future).
3. **Every detail page has a Lineage Rail** for chain documents (Lead→Deal→Quotation→… and RFQ→Bid→PO→…).
4. **Every detail page has an Activity Timeline** sourced from `crm_audit_log`.
5. **Every mutation writes audit.** Every read scopes by `userId`. Every action is gated by `requirePermission(moduleKey, action)`.
6. **Cmd-K hits every entity.** Search + Recents + "Create new …" for every key in `ENTITY_KEYS`.
7. **Cross-feature automations** can target the entity (lead → task → ticket → invoice → reminder → WhatsApp) without code changes — config-driven.
8. **The same data is available via stable HTTP** — `/v1/crm/<entity>/{list,getById,create,update,delete}` works for web, mobile, third-party API consumers.
9. **The page is data-rich + feature-rich** — list pages ship KPI strips, every relevant column, filters/bulk/views; detail pages ship every field, related-rails, lineage, activity, 8+ action buttons; forms ship smart defaults, cascade pickers, live preview where applicable. The full bar is locked in §1D.

A module is ecosystem-ready when every entity in it passes (1)–(9).

---

## 0.5. Status log (most-recent first)

> Every completed batch lands here date-stamped. Future sessions read this section first to learn what's already done and avoid duplicate work. Cross-reference items by their phase code (e.g. P0.4, P1.1A.3).

### 2026-05-13 — P3-fu + P4.1 prep

**P3-fu — Permission module registry closure (RBAC unblock for non-owner roles):**
- ✅ Added 32 missing per-entity CRM module keys to `src/lib/permission-modules.ts` so non-owner role templates can grant/deny them. Without this, `requirePermission('crm_<entity>', op)` silently returned `false` for any non-owner because the module wasn't registered. Keys added (singular form, matching the strings used by `requirePermission` call-sites): `crm_account`, `crm_asset`, `crm_bill`, `crm_booking`, `crm_contact`, `crm_credit_note`, `crm_deal`, `crm_debit_note`, `crm_department`, `crm_designation`, `crm_employee`, `crm_fixed_asset`, `crm_grn`, `crm_holiday`, `crm_invoice`, `crm_item`, `crm_lead`, `crm_leave`, `crm_payout`, `crm_pipeline`, `crm_purchase_order`, `crm_quotation`, `crm_receipt`, `crm_rfq`, `crm_sales_order`, `crm_subscription`, `crm_task`, `crm_ticket`, `crm_vendor`, `crm_vendor_bid`. Two of the spec's 32 (`crm_attendance`, `crm_payroll`) were already registered and skipped. Each new key also placed into the appropriate `moduleCategories` group (`CRM Sales` / `CRM Purchases` / `CRM Inventory` / `Sales CRM` / `CRM HR` / new `CRM Cross-cutting` and `CRM Support` groups).

**P4.1 prep — Rust fallback observability scaffold:**
- ✅ Shipped `src/lib/observability/rust-fallback-counter.ts` — `recordRustFallback({ entity, op, errorCode, status })` emits a structured JSON line (`event: 'rust_fallback'`) to stderr on every Rust → Mongo fall-through. Vercel ingests stderr, so we get search-based alerting today; future iteration swaps to OpenTelemetry counter export.
- ✅ Swept the 13 dual-impl action files that have Rust fall-through catch blocks and added `recordRustFallback(...)` directly after each `console.error('[…] rust path failed; falling back', e)` log line. 52 instrumented call-sites total: accounts (6), vendors (4), products/items (4), pipelines (3), contacts (5), employees-departments+designations (6), invoices (5), quotations (3), payment-receipts (4), sales-orders (5), credit-notes (3), subscriptions (2), fixed-assets (2). `crm-leads.actions.ts` and `crm-deals.actions.ts` from the spec list had no Rust dual-impl code yet — nothing to instrument; they'll be wired during the P3 lead/deal completion pass.
- ✅ Cutover smoke-test gate is now: (1) set `USE_RUST_CRM=true` in staging `.env`; (2) watch logs for `event: 'rust_fallback'` JSON; (3) alert if fallback rate > 0.5% of total mutations over a rolling 10 minutes.

### 2026-05-13 — Plan revision: data-rich + feature-rich contract locked

- ✅ Added §1D — data-rich + feature-rich contract per page type. Locks the minimum content (1D.1 list / 1D.2 detail / 1D.3 form / 1D.4 specialized views) AND minimum features (filters, bulk, export, conversion, notes, attachments, tags, activity, 8+ action buttons per detail page, etc.). Future "rebuild this module" tasks now have an unambiguous bar — no more thin shells.
- ✅ §0 north-star extended with point 9: "page is data-rich + feature-rich". Ecosystem-ready test now requires (1)–(9).
- ✅ §7 Definition of Done checklist updated to reference the 1D bar explicitly.

### 2026-05-13 — Phase 0 complete + Phase 1A foundation complete

**Phase 0 — Stabilize:**
- ✅ **P0.4** — 72 duplicate `/dashboard/crm/hr/**` + `/dashboard/crm/hr-payroll/**` pages converted to 307 redirects → canonical `/dashboard/hrm/**`. 10 orphan `_components/` files cleaned up. 12 pages held because their canonical targets don't exist (queued as **P0.4-fu**).
- ✅ **FIX1** — EntityPicker click regression fixed. Root cause: empty-search Create row swallowed clicks after `allowCreate=true` default flip. Tightened render gate + added defensive `stopPropagation` on trigger. 357 of 359 call sites unblocked.

**Phase 1A — Frontend rebuild foundation (12/12 shells locked):**
- ✅ **1A.1** `<CrmPageHeader>` extended with `breadcrumbs[]` and `secondaryActions` slot (additive — existing callers unchanged).
- ✅ **1A.2** `<EntityDetailShell>` audit — already complete, no change.
- ✅ **1A.3** `<EntityListShell>` shipped — `src/components/crm/entity-list-shell.tsx` (toolbar + search + filters + bulk bar + empty state + pagination + view switcher).
- ✅ **1A.4** `<EntityFormShell>` shipped — `src/components/crm/entity-form-shell.tsx` (sectioned cards + sticky action bar + dirty-prompt hook + useFormStatus spinner).
- ✅ **1A.5** `<EntityAuditTimeline>` audit — already complete, no change.
- ✅ **1A.6** `<LineageRail>` audit — already complete, no change.
- ✅ **1A.7** `<StatusPill>` + `statusToTone()` shipped — `src/components/crm/status-pill.tsx`.
- ✅ **1A.8** `<EmptyState>` audit — already complete, no change.
- ✅ **1A.9** `<ConfirmDialog>` shipped — `src/components/crm/confirm-dialog.tsx` (Type-DELETE pattern + Enter-to-submit + blocks dismiss while async pending).
- ✅ **1A.10** `<DirtyFormPrompt>` shipped — `src/components/crm/dirty-form-prompt.tsx` (beforeunload-based; intra-app router events not interceptable on App Router today — documented).
- ✅ **1A.11** `<KeyboardShortcuts>` shipped — `src/components/crm/keyboard-shortcuts.tsx` (chord-nav `g<x>` go-to + `c<x>` create-new + `?` cheat sheet; ignores meta/ctrl/alt to avoid Cmd-K collision).
- ✅ **1A.12** Toast conventions — 30-line doc block locked in `src/components/zoruui/toaster.tsx`. 4 standard variants: `success/info/warning/destructive`. **Drift to fix in follow-up**: `info` variant has no styling (5 callers fall back to default); 1220 `destructive` calls should mostly be `warning`; 205 files on legacy `@/hooks/use-toast`.

### 2026-05-13 — Phase B foundational entities + ecosystem sweep (prior to this rebuild plan)

- ✅ **Account / Contact / Vendor / Item / Pipeline+Stage / Department+Designation** — full end-to-end ecosystem per the original `CRM_PLAN.md`: Rust crate + TS rust-client + dual-impl actions + `/v1/crm/<entity>` mount + EntityDetailShell + activity sub-route. 6 entities done.
- ✅ **EC0** — Flipped `allowCreate=true` global default on EntityPicker.
- ✅ **EC1-EC6** — Ecosystem-sweep across HR / Sales-CRM / Sales-tx / Purchase-tx / Inventory / Tickets / Finance-cross / Projects / Workspace / Settings forms (~82 files migrated). Fixed 7 mis-keyed `entity="location"` pickers; added pipeline→stage and country→state→city cascades.
- ✅ **REG1** — Added `task`, `asset`, `ticketGroup` to EntityKey registry + 4 consumer maps.
- ✅ **PICK1** — `<EntityMultiFormField>` component shipped (unwired today; ready for consumers with array entity fields).
- ✅ **RBAC1** — 24 mutation gates across top-10 highest-impact action files: invoice/receipt/payroll/employee/lead/deal/account/PO/SO/vendor.
- ✅ **SB1** — Sidebar rebuilt: ~305 nav items across 34 groups (16 CRM + 18 HRM) in `src/components/zoruui/shell/zoru-app-sidebars.tsx`.
- ✅ **EMP1** — `crm-employee-form.tsx` rebuilt with 6 sectioned cards, cascade filters, all 41 FormData keys preserved.

### Earlier — Phase A foundation + initial business-logic crates

- ✅ Rust foundation: `crm-core`, `crm-common`, `sabnode-rbac` (154 permission keys), `crm-lookup` (42 entities live on `/v1/crm/lookup/{entity}`), `crm-conversions`.
- ✅ 29 Rust business-logic crates: leads, deals, quotations, invoices, sales-orders, purchase-orders, payment-receipts, credit-notes, debit-notes, payouts, tickets, subscriptions, bills, RFQs, vendor-bids, GRNs, employees, attendance, leaves, payroll-runs, fixed-assets, bookings, holidays, departments, plus the 6 Phase B entity crates.
- ✅ Frontend factories: `makeCrmClient`, `makeCrmActions`, `EntityAuditTimeline`, `EntityDetailShell`.

---

## 1. Current state matrix

| Layer | Coverage | Notes |
|---|---|---|
| Rust DTO crates | 100% (12 crates, ~145 tests) | `crm-core` foundation + 11 entity DTO crates |
| Rust business-logic crates | 29 / ~50 needed (~58%) | leads, deals, quotations, invoices, SO, PO, receipts, CN, DN, payouts, tickets, subscriptions, bills, RFQ, vendor-bids, GRN, employees, attendance, leaves, payroll-runs, fixed-assets, bookings, holidays, departments, accounts, contacts, vendors, items, pipelines |
| TS rust-clients | 31 / ~50 | Most match the Rust crates; some still raw `rustFetch` |
| Dual-impl server actions | 16 / ~70 (~23%) | account, contact, vendor, item, pipeline, department, designation, invoice, quotation, sales-order, payment-receipt, credit-note, subscription, lead (partial), deal (partial), portal-user (partial) |
| RBAC gates on mutations | 10 / ~40 files (~25%) | invoice, receipt, payroll, employee, lead, deal, account, PO, SO, vendor |
| List pages with EntityPicker chips | High — sweep complete | EC1–EC6 ecosystem sweep |
| Detail pages w/ EntityDetailShell + audit | ~20 entities | account, vendor, hire, items, bom, adjustments, warehouses, loans, budgets, petty-cash, portal, service-contracts, dashboards, candidates, exits, succession, holidays |
| Activity sub-routes | ~25 entities | accounts + 24 others |
| Sidebar coverage | 100% | ~305 nav items across 34 groups |
| Cmd-K coverage | 39 entities | every EntityKey searchable |
| `USE_RUST_CRM` cutover | OFF in prod | Dual-impl shipped on 16 actions; never flipped |
| Phase 1A shared shells | 100% (12/12) ✅ | EntityListShell, EntityFormShell, StatusPill, ConfirmDialog, DirtyFormPrompt, KeyboardShortcuts shipped; CrmPageHeader extended; toast conventions locked |
| Duplicate route trees | 0 ✅ | `/dashboard/crm/hr/**` + `/dashboard/crm/hr-payroll/**` redirect to canonical `/dashboard/hrm/**` (72 pages) |

**Gap to close:** ~21 entities still need Rust crates; ~54 server-action files still need dual-impl; ~30 mutation files still ungated; ~150 pages still need rebuild against the new 1A shells (P1.1B). 12 canonical HRM pages still missing (P0.4-fu) before the duplicate-tree cleanup is fully closed.

---

## 2. Phases

### Phase 0 — Stabilize what's shipped (1 sprint) — ✅ MOSTLY DONE

Block: bugs in foundation block all per-entity work.

| # | Task | Effort | Status |
|---|---|---|---|
| P0.1 | Run `cargo test --workspace` and fix any regression from the 6 new entity crates | 0.5d | ⏳ pending (verify pre-cutover) |
| P0.2 | `npm run typecheck` to baseline TS error count; document the residual list | 0.5d | ⏳ pending (run after node_modules install) |
| P0.3 | Manual smoke test of every modified form — confirm save→detail flow works | 1d | ⏳ pending (user-driven) |
| P0.4 | Delete the duplicate `/dashboard/crm/hr/**` and `/dashboard/crm/hr-payroll/**` route trees | 1d | ✅ **DONE 2026-05-13** — 72 redirects + 10 orphans deleted |
| P0.4-fu | Build 12 missing canonical HRM pages (attendance/departments/designations new+[id]+edit, employees/[id] detail, leave/[id]/edit, payroll/new) | 1d | ⏳ pending (queued) |
| P0.5 | Wire one consumer for `<EntityMultiFormField>` | 0.5d | ⏳ pending (no array entity field on disk yet) |
| P0.6 | Add missing detail+edit pages flagged by the route audit | 1d | ✅ **DONE 2026-05-13** — closed via the 75+ pages shipped during the ecosystem sweep |

Exit criteria: zero new TS errors, all 28 Rust crates pass tests, sidebar has zero dead links.

---

### Phase 1 — Frontend rebuild ("recreate every page", smooth user flow) (4 sprints)

> The user's headline ask: every CRM + HRM page rebuilt with a unified UX, every form/list/detail page consistent, every entity-reference field a picker, every flow click-through. The Rust cutover (P2→P4) can run in parallel because this phase only touches `src/app/dashboard/**` and `src/components/**`.

**Goal of this phase:** when a user opens any route under `/dashboard/crm/**` or `/dashboard/hrm/**`, the page should feel like it was designed by one team on one day. Same header, same card grid, same form shell, same status pill semantics, same activity footer, same empty state, same loading skeleton, same destructive-confirm dialog.

#### 1A — Design tokens + shared primitives (1 sprint, foundation) — ✅ DONE 2026-05-13

Lock the standardized building blocks first; the per-page sweep depends on them.

| # | Component | What | Status |
|---|---|---|---|
| 1A.1 | `<CrmPageHeader>` | Standard list/detail page title bar (icon, title, subtitle, primary CTA, breadcrumbs) | ✅ Extended with `breadcrumbs[]` + `secondaryActions` |
| 1A.2 | `<EntityDetailShell>` | Detail page shell (header, body, right-rail, activity footer) | ✅ Audited — complete |
| 1A.3 | `<EntityListShell>` | Toolbar + search + filters + view-switcher + table/grid + empty + pagination + bulk bar | ✅ Shipped — `src/components/crm/entity-list-shell.tsx` |
| 1A.4 | `<EntityFormShell>` | Sectioned cards + sticky bottom bar + error summary + dirty-prompt slot | ✅ Shipped — `src/components/crm/entity-form-shell.tsx` |
| 1A.5 | `<EntityAuditTimeline>` | Activity footer | ✅ Audited — complete |
| 1A.6 | `<LineageRail>` | Chain doc rail | ✅ Audited — complete |
| 1A.7 | `<StatusPill>` + `statusToTone()` | Tone-mapped status pill | ✅ Shipped — `src/components/crm/status-pill.tsx` |
| 1A.8 | `<EmptyState>` (= `ZoruEmptyState`) | List/detail empty state | ✅ Audited — complete |
| 1A.9 | `<ConfirmDialog>` | Destructive-confirm modal — Type-DELETE pattern + Enter-to-submit | ✅ Shipped — `src/components/crm/confirm-dialog.tsx` |
| 1A.10 | `<DirtyFormPrompt>` | beforeunload guard for unsaved forms | ✅ Shipped — `src/components/crm/dirty-form-prompt.tsx` |
| 1A.11 | `<KeyboardShortcuts>` | Chord-nav `g<x>` / `c<x>` + `?` cheat sheet | ✅ Shipped — `src/components/crm/keyboard-shortcuts.tsx` |
| 1A.12 | Toast conventions | 4 standard variants locked in `toaster.tsx` doc block | ✅ Locked; **follow-up needed**: add `info` styling + sweep 1220 `destructive`→`warning` mis-uses + migrate 205 files off legacy `@/hooks/use-toast` |

**Exit criteria:** every shell exists, has a Storybook entry (or test page) that exercises 5 variants, and a single audit pass shows ≥80% of CRM pages can be re-rendered against the new shells without behaviour drift.

#### 1B — Per-module page rebuild waves (3 sprints, parallelizable)

Rebuild each page from a shared template. ~150 pages total across 14 modules. One agent per module per sprint.

For each page, the rebuild emits:

| Page type | Template |
|---|---|
| **List** | `<CrmPageHeader>` + `<EntityListShell>` containing: search bar, filter chips (every filter = `<EntityFormField>`), column-toggle, sort, bulk-action bar (archive/export/assign-to/tag), row click → detail, "+New" CTA opens new page or side-sheet, infinite-scroll pagination, empty state with primary CTA. |
| **/new** | `<CrmPageHeader>` + `<EntityFormShell>` containing: sectioned cards (Personal / Linked / Commercial / Documents / Audit etc.), every entity-ref via `<EntityFormField>`, cascade filters (country→state→city, pipeline→stage, department→designation), sticky save/cancel bar, dirty-prompt, success toast → redirect to detail. |
| **/[id]** detail | `<EntityDetailShell>` containing: header with status pill + actions (Edit, Convert, Archive, Activity), main body cards (Overview, fields by section, Notes, Attachments, Sub-tables for line items), right rail (`<LineageRail>` if chain-doc, related-entities chips, audit-summary), `<EntityAuditTimeline>` footer. |
| **/[id]/edit** | Reuse `/new`'s `<EntityFormShell>` with `initial` prop. |
| **/[id]/activity** | Server-component activity sub-route (already templated). |

**Wave order (priority = how often the page is hit):**

| Wave | Module | Pages |
|---|---|---|
| W1 | Sales-CRM core (leads, deals, contacts, tasks, accounts) | ~25 |
| W2 | Sales transactions (invoices, quotes, SO, proforma, DC, CN, receipts, recurring, subscriptions, contracts, proposals) | ~30 |
| W3 | Purchases (POs, bills, payouts, RFQs, vendor bids, debit-notes, vendors, hire) | ~20 |
| W4 | Inventory (items, warehouses, adjustments, BOM, GRN, production-orders) | ~15 |
| W5 | HR Payroll (employees, attendance, leave, shifts, holidays, salary structure, payroll-run, payslips, compliance) | ~25 |
| W6 | HR People-Ops (candidates, jobs, interviews, offers, onboarding, performance, learning, docs, assets, time, exits, awards, disciplinary) | ~25 |
| W7 | Workspace + Projects + Tickets + Accounting + Banking + Cross-cutting | ~30 |
| W8 | Settings + Master data + Reports + Integrations | ~30 |

#### 1C — UX quality bar (applied in every wave)

Every rebuilt page must pass:

1. **Visual** — uses `ZoruCard` (not raw `<div>`); two-column responsive grid on `md:` and up; mobile single column; max-width 1280px centered; consistent spacing (`gap-6`).
2. **Loading** — `<ZoruSkeleton>` placeholders match the final layout shape (not generic rectangles).
3. **Empty** — `<EmptyState>` with entity-specific copy + primary CTA pointing to `/new`.
4. **Error** — failed loads show a banner with retry; failed saves show a toast with the server's error string.
5. **Forms** — required fields marked with `*`; client-side validation on blur; server-side errors merged with client errors; submit button disabled + spinning while pending.
6. **Destructive actions** — hard-delete behind `<ConfirmDialog>` ("Type DELETE"). Archive is one-click but emits an "Undo" toast for 5 seconds.
7. **Navigation** — back link in the header; breadcrumb where the route is >2 levels deep; sticky action bar in long forms.
8. **Keyboard** — `Esc` closes modals/popovers; `Cmd/Ctrl+S` saves the active form; `Cmd/Ctrl+K` opens command palette; `/` focuses the page search input.
9. **Accessibility** — every interactive element has a label/aria; every entity chip has a tooltip with the secondary info; focus rings visible; color contrast ≥ WCAG AA.
10. **Dark mode** — every page renders correctly in `dark:` variants; verify zoru tokens used everywhere (no hardcoded hex).
11. **Audit** — every mutation writes `writeAuditEntry(...)` before returning; failures don't block the primary save.
12. **Ecosystem** — every reference field is a picker; clicking a chip navigates to that entity; chips show `primary + secondary` (e.g. customer name + GSTIN).

**Effort:** ~0.5d per page × ~150 pages = ~75 dev-days. At 5 engineers parallel = ~15d (3 sprints + 1A foundation = 4 sprints total).

#### 1D — Data-rich + feature-rich contract per page type

> Every rebuilt page must be **dense with useful data and saturated with features** — not a thin shell on top of a single field set. This section locks the minimum bar. Anything below the bar is not "rebuilt", it's a placeholder.

**Goal:** the rebuilt CRM should feel like Linear/Notion-tier polish — when a user lands on any page they get the answer they're looking for without leaving the page, AND every reasonable action they might want is one click away.

##### 1D.1 List pages — minimum content + features

Every list page (e.g. `/dashboard/crm/sales/invoices`) ships with:

**Data shown:**
- Header KPI strip: 3-5 summary cards (e.g. for invoices: Total outstanding · Overdue · Paid this month · Draft count · Avg days to pay). Each card is clickable → filters the list.
- Table columns include every important field, not just name+date: for invoices that's `Invoice no · Customer (chip) · Date · Due · Amount · Paid · Balance · Status · Actions`.
- Every relational column renders an `<EntityPickerChip>` (clickable to detail, hover for secondary info).
- Status column uses `<StatusPill>` with `statusToTone()`.
- Money columns right-aligned + currency-aware.
- Date columns show relative time on hover (`"2 days ago"`).
- Overdue / at-risk rows visually flagged (subtle red left-border).
- Empty state has entity-specific copy + primary CTA.

**Features:**
- Search-as-you-type across the entity's `searchableFields[]` from the lookup registry.
- Filter chips for every meaningful dimension: status, owner (user picker), date range, customer (client picker), branch, tags, amount range. Filters compose as AND; "Clear all" resets.
- Saved views: filters+columns+sort persisted under `crm_saved_views` (Phase 5.10) — initially a single "Default view" with column hide/show.
- Bulk select with sticky `<BulkBar>`: archive · delete · export · assign-to · add-tag · status-change · email-template-send.
- Per-row inline actions menu: View · Edit · Convert (to dependent doc) · Print · Email · Share · Duplicate · Archive · Delete.
- Sort by every sortable column (defaults to `createdAt desc`).
- View switcher (table / kanban / calendar / card-grid) — table required; others where it makes sense (kanban for deals/tasks/tickets; calendar for bookings/events/leave; cards for assets/products).
- Infinite scroll OR page+limit pagination at the bottom.
- Density toggle (comfortable / compact / dense).
- Column toggle dropdown (which columns visible).
- CSV/XLSX export of the current filter; print-friendly view.
- "Import" entry point (opens import wizard — Phase 5.9).
- "+New" primary CTA opens the new page OR a side-sheet inline create.

##### 1D.2 Detail pages — minimum content + features

Every detail page (e.g. `/dashboard/crm/sales/invoices/[id]`) ships with:

**Data shown (left main column):**
- Header: status pill, eyebrow ("INVOICE INV-001"), title (customer name), back link, action group (Edit · Convert · Print · Email · Archive · Activity).
- Overview card: every key field (no "click to see more" hiding). Two-column responsive grid; every reference field renders as a chip.
- **Line items section** (for line-item docs): full table with HSN, qty, rate, tax breakdown, discounts, totals row.
- **Money summary**: subtotal, discounts, taxes broken out (CGST/SGST/IGST/cess), shipping, adjustment, round-off, grand total, amount paid, balance.
- **Payment history** (for receivable docs): list of receipts + apply amounts + dates.
- **Conversion lineage** rendered as `<LineageRail>` on the right (chain docs only).
- **Notes** section: chronological list with author + timestamp; inline "+ Add note" composer.
- **Attachments** section: SabFile chips with download/preview; inline add via `<SabFilePicker>`.
- **Custom fields** section if the entity has any.

**Data shown (right rail):**
- LineageRail (if applicable).
- **Related entities** sub-cards — drill-down counts that filter on the same entity (e.g. for Account: Open deals · Tickets · Tasks · Past invoices · Documents · Contacts).
- Quick stats: lifetime value, last activity, days since last contact.
- Tags chips with inline "+" tag picker.

**Activity footer:**
- `<EntityAuditTimeline>` with the last 50 entries.

**Features:**
- Action group (top-right): Edit, Convert (e.g. quote→invoice), Email (opens compose dialog pre-filled), WhatsApp (uses templates), Print (opens print-friendly route), Share (creates public link via `/share/[token]` if applicable), Duplicate, Archive, Delete (with `<ConfirmDialog>`).
- Status change inline (click status pill → dropdown of allowed transitions).
- Inline note composer.
- Inline file upload via `<SabFilePicker>`.
- Inline tag add/remove.
- "Send reminder" if overdue.
- "Mark as paid" / "Record payment" CTA for receivables.
- Linked-entity inline create (e.g. "+ Add contact" on an account detail).
- Keyboard: `e` opens edit; `d` deletes; `c` opens convert menu; `n` opens new-note composer; `Shift+?` shows page shortcuts.
- Print-friendly: dedicated `?print=1` query renders a single-column PDF-styled layout.

##### 1D.3 New / Edit forms — minimum content + features

Every form ships with:

**Data shown:**
- Sectioned cards (`<EntityFormShell>` sections) — group fields logically (Personal · Address · Commercial · Documents · Custom · etc.).
- Every reference field is `<EntityFormField>` or `<EntityMultiFormField>` (inline create on every picker).
- Cascade filters wired (country→state→city, pipeline→stage, department→designation, etc.).
- Smart defaults: when creating from a parent doc (`?fromKind=...&fromId=...`), pre-fill every transferable field (customer, currency, line items, terms, branch).
- Required-asterisk indicators on every required field.
- Inline help text under every non-obvious field.
- Side-by-side preview pane for long documents (invoices, quotations, contracts) — live render on the right as the user types.

**Features:**
- Save · Save & New · Save & Send (email/WhatsApp) · Cancel.
- Dirty-prompt on navigation (`<DirtyFormPrompt>`).
- Auto-save draft to localStorage every 30s (recover on reload).
- Server validation errors mapped back to specific fields with focus + scroll.
- Multi-line entry: paste a comma-separated list of skus → resolves N items at once.
- Quick-add adjacent entities inline (e.g. "+ New product" right in the invoice line-item row opens a side-sheet).
- Calculator widget for amount fields (small chip "= 1000 × 12").
- Currency-aware formatting (₹1,23,456.78 vs $123,456.78).
- Tax auto-calc on item add (HSN → tax rate → CGST/SGST/IGST split).
- Document number auto-suggest from the per-tenant numbering scheme.
- Keyboard: `Cmd/Ctrl+S` saves; `Cmd/Ctrl+Enter` saves & new; `Esc` cancels with dirty-prompt.

##### 1D.4 Specialized page types

Some pages aren't simple list/detail/edit. Each has its own bar:

| Page type | Minimum features |
|---|---|
| **Kanban view** (deals, tasks, tickets) | Drag-between-columns, optimistic update, WIP limits per column, swimlanes by assignee/priority, inline-add card per column |
| **Calendar view** (bookings, events, leave, holidays) | Month/week/day toggle, drag to reschedule, click empty cell → create at that time, color-by-status legend |
| **Run wizard** (payroll-run, e-invoice batch, GSTR-1 filing) | Step indicator, save-and-resume, dry-run preview, per-row override, final approval gate |
| **Report viewer** (GSTR-1, P&L, Trial Balance) | Filter strip, drill-down to source doc, export PDF/XLSX/CSV, schedule recurring delivery, print-friendly |
| **Dashboard** (widget builder) | Grid layout, add/remove/resize widgets, data-source picker per widget, save layout, share scope |
| **Convert flow** (quote→invoice, PO→GRN→bill) | Pre-filled form + diff preview against parent + back-link audit row |
| **Approval queue** (PO, expense, leave) | Filter by my-pending, inline approve/reject with comment, bulk approve, escalate |
| **Import wizard** | CSV upload, column mapping UI, validation report, dedup rules, dry-run, commit |
| **Settings list** (taxes, units, currencies, expense-categories) | Inline-create dialog, inline-edit row, drag-reorder where applicable, archived toggle |

##### 1D.5 What this means in practice

When an agent receives "rebuild the invoices module" in Phase 1B, it must ship:

- `/dashboard/crm/sales/invoices` — list page with 1D.1's full bar (KPI strip + 9 columns + filters + bulk + view switcher + export).
- `/dashboard/crm/sales/invoices/new` — form per 1D.3 (smart defaults + line-item table with item pickers + tax auto-calc + live preview + Save & Send).
- `/dashboard/crm/sales/invoices/[id]` — detail per 1D.2 (header strip + line items + money summary + payment history + lineage rail + related-rails + activity footer + 9 action buttons).
- `/dashboard/crm/sales/invoices/[id]/edit` — same form as `/new`, pre-loaded.
- `/dashboard/crm/sales/invoices/[id]/activity` — server-rendered audit timeline (template exists).

Anything skipped lands as a comment in the page header: `{/* TODO 1D.x: <feature> deferred — depends on <blocker> */}`. The agent's report must include a "deferred features" section listing every TODO it left.

##### 1D.6 Why this bar matters

The user's frustration in this session was repeatedly that "pages don't have data" or "many pages aren't usable". Loose rebuilds that just hit the structural bar (header + cards + audit) but skip the **data density** + **action density** feel hollow. 1D.1–1D.4 is the operational definition of "data-rich and feature-rich" that turns rebuilds into actually useful pages.

---

### Phase 2 — Complete the Rust BFF layer (3 sprints, parallelizable)

Build a Rust crate for every entity that still uses direct Mongo. Target: 100% coverage of CRM_PLAN.md §6 (the original entity catalog).

**Order by dependency depth:**

| Wave | Entities | Why |
|---|---|---|
| W1 | brand, tag, label, branch (foundational) | Referenced by item, account, vendor, employee |
| W2 | warehouse, stock_adjustment, BOM, production_order, stock_transaction (inventory) | Item-dependent, line-item-dependent |
| W3 | chart_of_accounts, account_group, voucher, voucher_book, bank_account, bank_transaction (accounting) | Referenced by invoice, payment, expense |
| W4 | proforma_invoice, recurring_invoice, delivery_challan (sales-tx extras) | Crm-sales-types DTOs exist; wire handlers |
| W5 | recurring_expense, hire, purchase_lead, proposal+templates, contract+templates, service_contract (purchase + commercial) | Cover the commercial doc gap |
| W6 | coupon, gift_card, loyalty, estimate_request, booking (sales extras) | Sub-features behind /sales/* |
| W7 | task, subtask, milestone, issue, time_log, weekly_timesheet, project_category, task_category, task_label, task_tag, taskboard_column (projects+tasks) | The Project module's entities |
| W8 | ticket_group, ticket_channel, ticket_tag, ticket_type, sla, kb_article, reply_template, agent_group (tickets+KB) | Built on top of existing crm-tickets crate |
| W9 | candidate, job, interview, offer, onboarding, exit, asset, asset_assignment, document, document_template, policy, training, certification, learning_path, announcement, recognition, award, survey, compensation_band, probation, succession, hr_timesheet, travel, expense_claim, disciplinary (HR people-ops) | Heaviest module (~24 entities) |
| W10 | discussion, discussion_category, event, notice, sticky_note, workspace_kb, appreciation (workspace) | Standalone, low-coupling |
| W11 | currency, tax_rate, unit_type, expense_category, custom_field, role, permission_type, company_address, company_profile, project_status, leadboard_preference, taskboard_preference (master) | Mostly static catalogs |
| W12 | shift, shift_rotation, shift_change_request, salary_structure, payslip, pf_esi, professional_tax, tds, form_16, goal, okr, kpi, appraisal, feedback_360, one_on_one (HR Payroll deeper) | Some Rust crates exist; wire holes |

Each entity follows the `crm-accounts` template (Cargo.toml + lib.rs + types.rs + dto.rs + handlers.rs + router.rs + mount in api router).

**Parallelism:** dispatch 5–8 agents per wave, one wave per session.

**Effort:** ~1d per simple entity, ~3d per complex entity (line-item docs). Total: ~120 dev-days, 6–8 sprints at 5 engineers parallel.

---

### Phase 3 — Server-action dual-impl sweep (1 sprint, parallel)

For every Rust crate that lands in Phase 1, refactor the TS server action to route through it behind `USE_RUST_CRM=true`. Pattern:

```ts
import { rust<Entity>Api } from '@/lib/rust-client/crm-<entity>';

function useRustCrm(): boolean { return process.env.USE_RUST_CRM === 'true'; }

export async function saveX(...) {
  const session = await getSession(); if (!session?.user) return { error: 'Unauthorized' };
  const guard = await requirePermission('crm_<entity>', 'create'); if (!guard.ok) return { error: guard.error };
  if (useRustCrm()) {
    try { /* call rustApi */ } catch (e) { /* fall through */ }
  }
  /* legacy Mongo path */
}
```

**Effort:** ~0.5d per file. ~50 files. ~25 dev-days, 1 sprint at 5 engineers parallel.

---

### Phase 4 — Flip USE_RUST_CRM to true (1 sprint)

Cutover plan:

| Step | Action | Risk |
|---|---|---|
| 3.1 | Verify `cargo check --workspace` + `cargo test --workspace` clean | Low |
| 3.2 | Flip flag on staging — run smoke tests on every list + new + edit page | Medium |
| 3.3 | Add Prometheus metrics on `/v1/crm/*` (request count, error rate, p95 latency) | Low |
| 3.4 | Add logging: every dual-impl fallback prints `[entity] rust path failed; falling back` — alert on rate > 1% | Low |
| 3.5 | Canary 5% of traffic on production | High |
| 3.6 | Ramp to 50%, then 100% over a week | Medium |
| 3.7 | After 2 weeks of clean traffic, remove the legacy Mongo branch from each action file | Low (cleanup) |
| 3.8 | After all branches removed, drop the `useRustCrm()` helper | Low |

**Effort:** 5 dev-days for setup + observability; cutover itself runs over 2 weeks.

---

### Phase 5 — Cross-feature wiring (1 sprint, parallel)

Make every page talk to every other.

| # | Wire-up | Detail |
|---|---|---|
| 5.1 | Cmd-K palette — `Cmd/Ctrl+K` on every page; covers all 39 entities | Already shipped — just verify the trigger chip works (per FIX1, click was broken in palette too — verify) |
| 5.2 | Global search at `/dashboard/crm/search` — full-text across every entity using the same `lookupEntity` registry | New page; ~2d |
| 5.3 | Notifications hub at `/dashboard/crm/notifications` — surfaces audit events related to current user (assigned tasks, mentions, due-by SLA breaches) | New page; ~3d |
| 5.4 | Activity feed at `/dashboard/crm/activity` — tenant-wide audit timeline | New page; ~2d |
| 5.5 | Audit-log viewer at `/dashboard/crm/audit-log` (exists; add filters per entity, per actor, per date range) | ~2d |
| 5.6 | Cross-references: when an entity is referenced on another (e.g. Account has Deals + Invoices + Contacts + Tickets), render those as related-rails on the detail page | Per-entity work; ~0.5d each × 40 = 20d |
| 5.7 | RBAC sweep continuation — apply `requirePermission()` across the remaining ~30 mutation files | ~10d |
| 5.8 | Convert-with-prefill — every lineage transition (Lead→Deal, Quotation→Invoice, etc.) opens the target form pre-filled with parent data and `fromKind`/`fromId` set | ~5d (helper + 13 chain points) |
| 5.9 | Bulk operations: import/export per entity via CSV with field-mapping wizard + dedup rules + dry-run | ~10d (one shared component + per-entity adapters) |
| 5.10 | Saved views per list: filters + columns + sort + share-scope persisted as `crm_saved_views` rows; consumed by reports + dashboards | ~5d |

---

### Phase 6 — New feature work

These are dependent on Phase 1–3 foundation but parallelize among themselves.

| # | Feature | Scope | Effort |
|---|---|---|---|
| 6.1 | Subscriptions cron + dunning ladder | `src/app/api/cron/subscriptions-daily/` — process due renewals, retries, dunning email→SMS→WhatsApp→ticket→suspend (uses existing `src/lib/billing/dunning.ts`). Vercel Cron. | 5d |
| 6.2 | Contracts e-signature | Public `/sign/[contractId]/[signerToken]` page — signature capture (typed/drawn/uploaded), audit trail with IP/geo/UA, status transitions, provider adapter (Internal default; Digio/DocuSign/Aadhaar future) | 10d |
| 6.3 | POS terminal + online store | `/dashboard/crm/pos/*` (sessions / terminal / hold-recall / refunds) and `/dashboard/crm/store/*` (storefronts / products / pricing / shipping / abandoned cart). New crates `crm-pos` + `crm-store`. | 25d |
| 6.4 | SLA engine | `src/lib/sla/engine.ts` computes due-by per ticket; cron `src/app/api/cron/sla-breach-check/` every 5 min; ticket detail shows live countdown; notification template fires on breach | 8d |
| 6.5 | Custom dashboard widget builder | `/dashboard/crm/dashboards/[id]` — grid layout, add-widget modal (metric/line/bar/donut/funnel/table from `crm-extras-types::WidgetKind`), data-source picker (saved view / report / SQL-like query), drag/resize, save layout | 15d |
| 6.6 | Portal authentication | `/portal/[tenantSlug]/login` + `/portal/[tenantSlug]` dashboard — magic-link via email OTP, scoped role views (customer/vendor/employee) | 12d |
| 6.7 | Automations engine | Trigger-condition-action editor (`crm_automations` already typed in `crm-sales-crm-types`). Backed by Vercel Workflow DevKit for durable execution. | 20d |
| 6.8 | Reports engine | Run `crm_reports_types::ReportDefinition`; schedule via cron; deliver via email/webhook; render in dashboard widgets. ~35-variant `ReportKind` already defined. | 15d |
| 6.9 | Audit log retention + GDPR erase | Per-tenant retention policy; erase-request workflow under `/dashboard/crm/settings/gdpr/removal-requests` (route exists); chained-hash audit ledger (model exists in `src/lib/compliance/audit-log.ts`) | 8d |
| 6.10 | Tax & compliance (India) | GSTR-1/2B/3B/9 generation + reconciliation; e-invoice IRP integration; e-way bill; ITC ledger; TDS u/s 194Q; MSME 45-day alerts. DTOs already in `crm-extras-types::india_tax`. | 25d |

**Effort sub-total:** ~140 dev-days. Parallelizable across teams.

---

### Phase 7 — Mobile + API + real-time

Truly cross-platform once Phase 3 lands.

| # | Track | Detail | Effort |
|---|---|---|---|
| 7.1 | Mobile API | `/v1/crm/*` already authoritative after Phase 3. Document via OpenAPI generated from the Rust router (utoipa) | 5d |
| 7.2 | Public API keys | Tenant-scoped API keys + rate limits; existing `crm-leads.actions.ts` already has `apiUser` bypass — generalize | 8d |
| 7.3 | Webhooks | Subscribe to per-entity events (create/update/delete/status_change); ship signed payloads. Reuse `crm_audit_log` as source | 10d |
| 7.4 | Real-time sync | Server-sent events for live list updates: stream audit events filtered by entityKind + user. Per-page `EventSource` listener refreshes data. Cache invalidation via `revalidateTag` | 15d |
| 7.5 | Mobile UI (React Native) | Separate repo; consumes `/v1/crm/*`. Outside CRM scope but unblocked by Phase 3 | n/a |
| 7.6 | Webhook + automation triggers | Cross-feature event bus — Lead created fires WhatsApp + Task + Slack DM; configurable via the Automations engine (6.7) | 5d on top of 6.7 |

---

## 3. Execution model

### 3.1 How to run a wave

For each Phase 1 wave:

1. **Pre-flight (parent):** add all wave crate names to `rust/Cargo.toml` `members`. Add all crate-deps to `rust/crates/api/Cargo.toml`. This avoids race conditions on those two shared files.
2. **Dispatch:** N agents (one per entity), each with the `crm-accounts` template + entity-specific schema notes + the fallback-on-Write-denied protocol.
3. **Wait:** agents complete in parallel (5–10 min each).
4. **Integrate (parent):** run `cargo check --workspace`; fix any drift. Add `.nest("/v1/crm/<entity>", x)` lines in `rust/crates/api/src/router.rs`.
5. **Wire actions (Phase 2 agent per entity):** dual-impl + RBAC gate + audit-log.
6. **Verify:** `npm run typecheck`; baseline TS errors unchanged.

### 3.2 Stall avoidance

Long-running agents (>10 min) stall on stream timeouts. Mitigations:

- Cap per-agent scope at ~5 files or ~200-line diffs.
- Always include the explicit "if Write denied, return diffs in final report" fallback.
- Break Phase 1 page rebuilds into per-module waves (one module = ~10 pages).

### 3.3 Verification gates

After each phase ends:

- `cargo check --workspace` clean
- `cargo test --workspace` clean
- `cargo clippy --workspace --tests -- -D warnings` clean
- `npm run typecheck` baseline error count unchanged
- Manual smoke: log in, create one entity per module, edit, view detail, view activity, delete (or archive)

---

## 4. Effort & timeline

| Phase | Sub | Days | Parallel @ 5 eng | Calendar |
|---|---|---|---|---|
| P0 | Stabilize | 4.5d | – | 1 sprint |
| **P1** | **Frontend rebuild (1A foundation + 1B ~150 pages × 0.5d + 1C quality bar)** | **~85d** | **17d** | **4 sprints** |
| P2 | Rust BFF (~21 entities × ~2d) | ~42d | 9d | 2 sprints |
| P3 | Action dual-impl (~50 files × 0.5d) | ~25d | 5d | 1 sprint |
| P4 | Cutover (setup + observability + canary) | 5d + 2wk wall | – | 1 sprint |
| P5 | Cross-feature wiring | ~55d | 11d | 2.5 sprints |
| P6 | New features | ~140d | 28d | 6 sprints |
| P7 | Mobile/API/real-time | ~43d | 9d | 2 sprints |
| **Total** | – | **~400d** | **~83d** | **~17.5 sprints (~9 months)** |

At 5 engineers full-time, ~9 calendar months to fully ship. The Frontend Rebuild (P1) is the user's primary ask and is **independent of Rust cutover** — it can ship first against the legacy Mongo path. Rust-everywhere milestone (P0+P2+P3+P4) is ~2.5 months and can run in parallel with P1.

---

## 5. Risks & call-outs

1. **Schema drift** — TS `definitions.ts` and Rust DTOs are kept in lock-step by convention only. Add a CI job that diffs the JSON shapes and fails on mismatch.
2. **Permission moduleKey drift** — TS uses snake_case, Rust uses `sabnode-rbac::permissions::*` constants. Lock a single source-of-truth file and generate the other side.
3. **The legacy `/dashboard/crm/hr/**` and `/hr-payroll/**` route duplicates** need to go away (P0.4). If not, the sidebar will compete and users will hit stale routes.
4. **`USE_RUST_CRM` cutover** can mask Rust bugs because every action falls back to Mongo on error. Add a metrics alert that fires when the fallback rate exceeds 0.5% — that's the canary.
5. **EntityMultiFormField** is unwired today. Several Phase 1 forms (signers[], applicableProducts[], assets[], members[]) depend on it being adopted in those entities' schemas first.
6. **The 39 EntityKeys assume a registry adapter exists.** New entities added in Phase 1 must (a) add the EntityKey, (b) wire the registry adapter, (c) update all 4 exhaustive maps in entity-picker.tsx + command-palette.tsx + custom-fields settings + sidebar.
7. **Mobile dev** is unblocked by Phase 3, but the actual mobile app is a separate stream.

---

## 6. Open decisions

1. **Soft vs hard delete policy:** default proposal stays "soft-delete with 30-day purge job". Confirm before P1 starts.
2. **Pagination:** keep page+limit globally, or cursor for >5k-row lists (tasks, contacts, leads)? Default proposal: cursor for top 5 entities, page+limit elsewhere.
3. **Tenant model:** today `userId` is the tenant root. Mid-term, do we shift to `tenantId` + `userId` (multi-user tenants)? Affects every query filter. Decide before P2.
4. **Sidebar autogeneration:** today the sidebar config is hand-maintained. Phase 1 (rebuild) doubles its surface — should we auto-generate from a manifest? Default proposal: keep hand-edited (305 items × 30 sec scan is tractable; auto-gen risks dead links).

---

## 7. Definition of Done (per entity)

```
☐ Rust types in rust/crates/crm-<entity>/src/types.rs
☐ Rust DTO (Create/Update/List query/responses)
☐ Rust handlers (5 routes + soft-delete + audit-log + RBAC)
☐ Rust router mounted at /v1/crm/<entity>
☐ TS rust-client uses makeCrmClient or direct rustFetch
☐ Lookup-registry entry + EntityKey + ENTITY_LABEL + cmd-K map
☐ Server actions dual-impl with USE_RUST_CRM gate
☐ requirePermission('crm_<entity>', op) on every mutation
☐ List page meets §1D.1 bar — KPI strip, every relevant column, filter chips, search, bulk-action bar, view switcher, export, +New CTA, density toggle
☐ /new page meets §1D.3 bar — sectioned cards, every reference field as <EntityFormField>/<EntityMultiFormField>, cascade filters wired, smart defaults from ?fromKind/fromId, dirty-prompt, auto-save draft, Save · Save & New · Save & Send actions, live preview (for doc types)
☐ /[id] detail page meets §1D.2 bar — header action group (8+ buttons: Edit/Convert/Email/Print/Share/Duplicate/Archive/Delete), every field shown, money summary breakout (for doc types), payment history (receivables), <LineageRail>, related-entities right rail, notes composer, attachments, tags, inline status-change
☐ /[id]/edit page reuses /new form pre-loaded
☐ /[id]/activity sub-route with <EntityAuditTimeline>
☐ Cross-references in adjacent entities render the chip
☐ Sidebar nav entry
☐ Cmd-K search row + recents
☐ Convert-from-parent buttons on parent detail pages (where applicable)
☐ Webhook event types declared (post-Phase 7)
```

---

## 8. End-user flow (what a smooth day in the CRM looks like)

This is the experience the rebuild has to deliver. If a flow below feels clunky after Phase 1 lands, that page hasn't shipped yet.

### 8.1 Login → home

1. User opens `/`. If unauthenticated, redirect to login. Login uses email + password (or magic link). Tenant is auto-resolved from the session.
2. Land on `/dashboard/crm` — module overview: today's open tasks, deals expiring this week, invoices due, leads to follow up. Each card is a **shortcut + count** that opens the underlying filtered list.
3. Press `Cmd/Ctrl+K` from anywhere → command palette opens. Type `acm` → highlights "Acme Corp (client)". Enter → navigate to the client's detail page.

### 8.2 Lead capture → close

1. Marketing lead lands via website form / WhatsApp / Facebook / Email. Webhook into `crm_leads` (already wired in `wachat-facebook-lead-gen` + `crm-leads`).
2. Sales user opens `/dashboard/crm/sales-crm/all-leads`. New lead row appears with status pill "New", source chip (lead-source picker entity), assigned-to chip.
3. Click lead row → detail page. Right rail shows: empty Activity (audit timeline), no Deals yet, related Notes section.
4. Click "Qualify" action → status transitions to "Qualified", audit row appended. Toast: "Lead qualified — create a deal?". Toast button → `/dashboard/crm/sales-crm/deals/new?fromKind=lead&fromId=<id>`.
5. Deal form opens pre-filled with lead's company, contact, source. Pick pipeline (entity picker) → stage cascade-filters to that pipeline's stages. Save.
6. Deal detail page: lineage rail shows Lead → Deal. Right rail shows related Quotations (empty), Tasks (empty). "Create quotation" button → `/dashboard/crm/sales/quotations/new?fromKind=deal&fromId=<id>`.
7. Quotation pre-filled with deal's client + line items. Save → emails the customer (template), status "Sent".
8. Customer accepts → user clicks "Convert to Invoice" on the quotation detail. New invoice opens pre-filled. Save → invoice "Sent". Quotation status updates to "Converted".
9. Receive payment → "Record payment" on invoice detail → `/dashboard/crm/sales/receipts/new?invoiceId=…`. Save → invoice marked "Paid". Audit row + revenue dashboard updates.

### 8.3 Purchase → goods receipt → bill → payout

1. Inventory low alert (cron) creates a draft PO targeting the default vendor for the SKU. Surfaces in `/dashboard/crm/purchases/orders` with status "Draft".
2. User opens the draft → adjusts line items (every item field is a picker that auto-fills HSN/rate/unit). Approves → status "Sent". PDF mailed to vendor.
3. Goods arrive. User opens `/dashboard/crm/inventory/grn/new?fromKind=purchaseOrder&fromId=<id>`. GRN pre-filled with PO lines; user enters received qty + batch + expiry. Save → inventory increments, lineage stamped.
4. Vendor invoice arrives. User clicks "Create bill" on GRN → `/dashboard/crm/purchases/expenses/new?fromKind=grn&fromId=<id>`. Bill pre-filled with GRN lines + vendor terms. Save → AP ages from this date.
5. Time to pay: `/dashboard/crm/purchases/payouts/new?billId=<id>`. Pick bank account (picker), amount auto-filled. Save → bill status "Paid", bank balance decrements, audit row.

### 8.4 HR — onboarding to payroll

1. HR opens `/dashboard/hrm/hr/jobs/new`. Create job posting (department + designation pickers, location cascade). Publish → appears on `/careers/...` public page.
2. Candidate applies. Row appears in `/dashboard/hrm/hr/candidates`. Recruiter qualifies → schedules interview (`/dashboard/hrm/hr/interviews/new?candidateId=…`, panel = user multi-picker).
3. Offer sent → `/dashboard/hrm/hr/offers/new?candidateId=…&jobId=…`. E-signature workflow (Phase 6.2) → offer accepted.
4. Onboarding kicks off automatically: a new `crm_employees` row is created (or the user manually opens `/dashboard/hrm/payroll/employees/new` from the offer detail). Form is the fully-sectioned EMP1 rebuild — Personal, Identity, Address, Employment, Compensation, Bank, Documents.
5. Day 1: employee marks attendance via `/dashboard/hrm/payroll/attendance` (geo + selfie). Leave request → approver chain.
6. End of month: HR runs payroll at `/dashboard/hrm/payroll/payroll/new`. Compute → review per-employee earnings/deductions → approve → disburse (bank-file). Payslips auto-generated.
7. Every step writes audit. Employee can see their own payslip + leave balance via `/portal/<tenant>` (Phase 6.6).

### 8.5 Support — ticket lifecycle

1. Customer email lands on the helpdesk inbox → ticket created in `/dashboard/crm/tickets`. Channel = email, requester = client (auto-resolved from From: header via lookup), priority = auto-assigned via rule.
2. Agent opens ticket detail. SLA countdown (Phase 6.4) shows first-response due in 1h 24m. Agent types reply → status "Pending". Audit row.
3. SLA breach → red banner, ticket auto-escalates to senior agent (automation rule from Phase 6.7), notification to oncall (Phase 5.3).
4. Customer responds → status auto-flips to "Open". Agent resolves → status "Resolved". CSAT survey emailed → response writes to ticket's `satisfactionRating`.

### 8.6 Cross-platform parity

- **Web** — every flow above works at `https://<domain>/dashboard/...`.
- **Mobile (post-P7)** — every list + detail + key form available via React Native consuming `/v1/crm/*`. Audit timeline + lineage rail render the same.
- **Public API (post-P7.2)** — tenant API keys let third parties hit `/v1/crm/leads`, `/v1/crm/invoices`, etc. The same RBAC + audit applies; mutations show up in the tenant's activity feed.
- **Webhooks (post-P7.3)** — every entity event (create/update/status_change) fires a signed POST to subscriber URLs. Powers Slack/Zapier/Make integrations.
- **Notifications (Phase 5.3)** — when a task is assigned to you, a ticket breaches SLA, an invoice is paid, or a lead is captured — same notification appears on web + mobile + Slack + email + WhatsApp (configurable per user).

### 8.7 Friction we want to remove (and the page that owns each)

| Friction | Owner page |
|---|---|
| Typing a customer name when you should have picked one | Every form (Phase 1) — `<EntityFormField>` |
| Toggling between pages to find a referenced doc | Every detail page (Phase 1) — chips + LineageRail |
| Wondering "did my save go through?" | Every form (Phase 1) — toast + dirty-prompt + sticky bar |
| Manually re-typing fields when converting docs | Every chain transition (Phase 5.8) — `fromKind/fromId` prefill |
| Not knowing who changed what | Every detail page (Phase 1) — `<EntityAuditTimeline>` |
| Missing a page in the sidebar | Sidebar (SB1 — done) — 305 nav items, no dead links |
| Slow large-list scroll | Every list page (Phase 1) — infinite scroll backed by Rust lookup endpoint (post-P4) |
| Lost work on tab close | Every form (Phase 1) — `<DirtyFormPrompt>` |
| Can't find the action button I want | Every detail page (Phase 1) — top-right action group; keyboard shortcuts |

---

## 9. Where to start next session

**Already done (cross-reference §0.5 Status log for details):**
- ✅ P0.4 — duplicate hr/ + hr-payroll/ trees redirected
- ✅ FIX1 — picker click regression fixed
- ✅ P1.1A — all 12 shared shells locked
- ✅ P3-fu — 32 per-entity CRM module keys registered in `permission-modules.ts` (non-owner roles can now grant/deny them)
- ✅ P4.1 prep — `recordRustFallback()` shipped + wired into 52 fall-through sites across 13 dual-impl files. Cutover smoke-test gate is ready (see §0.5 entry for 2026-05-13 — P3-fu + P4.1 prep).

**Next up, in priority order:**

1. **P0.4-fu** — Build the 12 missing canonical `/dashboard/hrm/payroll/**` pages (attendance new+[id]+edit, departments new+[id]+edit, designations new+[id]+edit, employees/[id] detail, leave/[id]/edit, payroll/new). Unblocks the last 12 `/dashboard/crm/hr-payroll/**` redirects.
2. **P0.1 + P0.2** — `cargo test --workspace` + `npm run typecheck` clean baseline. Now that node_modules is installed, both should run.
3. **P1.1B Wave 1 — Sales-CRM core page rebuild** using the new shells: leads, deals, contacts, tasks, accounts (~25 pages). Per-entity template: list page → `<CrmPageHeader>` + `<EntityListShell>`; new/edit → `<EntityFormShell>`; detail → `<EntityDetailShell>` + `<LineageRail>` + `<EntityAuditTimeline>`. Dispatch ~5 agents per module sub-batch.
4. **P3 continued (dual-impl sweep)** for the 13 Rust crates that ship but don't yet route TS actions: subscriptions, fixed-assets, bookings, attendance, leaves, payroll-runs, tickets, bills, RFQs, vendor-bids, GRNs, holidays, employees-deep. Can run in parallel with P1.1B. **Reminder:** every new fall-through catch added during this sweep MUST call `recordRustFallback({ entity, op, errorCode, status })` after the human-readable `console.error` — the cutover alert depends on it.
5. **P4.1 + 4.2 — cutover** — observability scaffold is ready (`recordRustFallback`). Cutover smoke-test gate:
   1. Set `USE_RUST_CRM=true` in staging `.env`.
   2. Watch logs for `event: 'rust_fallback'` JSON lines.
   3. Alert if rate exceeds **0.5%** of total mutations over a rolling **10 min** window.
   Still TODO before flip: wire the actual alert in Vercel Observability (log-search rule keyed on `event:rust_fallback`), and run a 30-min canary in staging.
6. After P1.1B W1 lands: start **P2 W1** (foundational Rust entities — brand, tag, label, branch) and **P1.1B W2** (Sales-tx page rebuild) in parallel.

**Quick wins worth picking up any time:**
- Sweep the 205 files still on `@/hooks/use-toast` to the canonical `useZoruToast`.
- Sweep the 1220 `variant: 'destructive'` toasts that should be `warning`.
- Add visual styling for `variant: 'info'` in `toast.tsx` so the 5 callers stop falling back silently.
- Wire `<EntityMultiFormField>` into the first form that gets an array entity field.
