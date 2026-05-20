# CRM Page Redesign & Sidebar Regroup Plan

**Owner:** harshkhandelwal
**Created:** 2026-05-19
**Status:** Drafted (awaiting batch selection)
**Scope:** All CRM list / detail / edit / new pages under `src/app/dashboard/crm/` + the CRM section of `src/components/zoruui/shell/zoru-app-sidebars.tsx`.

---

## 1. Why this plan exists

User complaints (verbatim, condensed):

1. *"In CRM still many pages have less pages — like forms creation is not advanced."*
2. *"If a user submitted a form there is no option to see this."*
3. *"There are many pages like this — can you redesign and recreate all these pages."*
4. *"Make sure in all pages on list, on name or ID click a details popup or page will open."*
5. *"Group the pages properly because the CRM's sidebar looks messy, not user-friendly."*

This plan addresses all five in one coordinated batch instead of one-off patches.

---

## 2. What the audit actually found

Measured corpus:

- **757 `page.tsx` files** under `src/app/dashboard/crm/` totalling **115,706 LOC**
- **121 `new/page.tsx`** create pages (range 9–~200 LOC, avg ~40)
- **112 `[id]/edit/page.tsx`** edit pages — total only **4,603 LOC** (avg 41 LOC)
- **123 `[id]/page.tsx`** detail pages (range 14–~250 LOC)
- **331 list pages** without a confirmed clickable-row signal (rough grep — narrows to ~60–90 real entity lists after excluding settings/lookup pages where popup edit is correct)

Pattern confirmed via spot-reads (budgets, petty-cash, vouchers, deals): edit/new pages are **thin server wrappers** (~20–70 LOC) that fetch the entity then delegate to a fat client form component (`edit-budget-form.tsx`, `voucher-book-form.tsx`, etc.). LOC of `page.tsx` is **not** a depth signal — the form component is where the actual UX lives.

### 2.1 Form-component depth grading

| Tier | Modules |
|---|---|
| **Deep** (rich UX, line-items, validation) | accounts (598 LOC), invoices (326), quotations (480), employees (989), projects (~400), orders (~370) |
| **Medium** | payroll-runs, automations, sales-crm/deals, leads |
| **Shallow → redesign** | petty-cash, service-contracts, portal, hr/exits, budgets, workspace/announcements, hr/onboarding, inventory/stock-transfers, purchases/orders, projects/issues |

Shallow forms share these gaps: no multi-step wizard, no linked-entity pickers, no SabFiles file attachments, minimal validation, no inline activity feed.

### 2.2 Critical missing edit pages

| Path | Status |
|---|---|
| `contacts/[contactId]/edit` | Detail page is 369 LOC, no edit route — users can view but not modify |
| `contracts/[contractId]/edit` | Same problem — viewer with no editor |
| `sales/proposals/templates/[templateId]/edit` | Template viewer with no editor |
| `deals/[id]` | 14-line legacy redirect — not a real detail page |

### 2.3 Forms module (user's named complaint)

- Builder at `src/components/wabasimplify/website-builder/crm-form-builder.tsx` (335 LOC) supports 12 field types, drag-reorder, conditional logic, CRM-field mapping, preview, embed snippet.
- **Missing**: multi-step / wizard flows, payment fields, SabFiles file uploads (file type exists but integration unclear), webhook config, email-on-submit, advanced styling.
- **Submissions UI does not exist anywhere.** `crm_form_submissions` collection + `getFormSubmissionById` action are wired to zero UI. `submissionCount` is rendered in the list, but users cannot view, filter, export, or act on submissions.

### 2.4 Thin detail pages (worst offenders)

| Path | LOC | Problem |
|---|---|---|
| `sales/contacts/[contactId]` | 27 | Header + email compose only; no tabs, activity, related entities |
| `hr/timesheets/[id]` | 38 | Overview only; no drill-down |
| `sales/proposals/templates/[templateId]` | 40 | Static list; no preview, no editor |
| `workspace/notices/[id]` | 75 | Text + metadata; no comments, no activity |
| `workspace/discussions/[id]` | 77 | Thread viewer; lacks moderation, pinning, voting |
| `workspace/knowledge-base/[id]` | 91 | Article + comments; no versioning, no approval |

### 2.5 Sidebar problems

Current CRM sidebar config (`src/components/zoruui/shell/zoru-app-sidebars.tsx` lines 670–1665):

- **58 distinct sections**, hundreds of leaf items
- **Severe duplication**: "Contacts" appears at three different paths — `/dashboard/crm/contacts`, `/dashboard/crm/sales-crm/contacts`, `/dashboard/crm/sales/contacts`. Users can't tell which is canonical.
- **Sales vs Sales CRM conflation**: two top-level sections cover overlapping concepts (Sales CRM = pipeline/leads/deals; Sales = invoices/quotes/orders). Names don't communicate the difference.
- **HR sub-mess**: 9+ sections prefixed with "HR · " (People / Recruitment / Onboarding / Performance / Learning / Docs & Assets / Time & Expenses / Exit & Comp / Recognition) plus Payroll · sections — over 15 HR-prefixed groups visible at once.
- **Cross-cutting bucket** is a junk drawer — it holds whatever didn't fit elsewhere.
- Admin-only flags (`adminOnly: true`) scattered across many sections instead of grouped into an Admin/Setup workspace.

---

## 3. The plan

Five batches. Each batch should be a single PR (or coordinated PR set). Sidebar regroup ships **first** because it changes URLs/IA that the redesigned detail pages will link to.

### Batch 1 — Sidebar regroup + clickable-row plumbing *(prereq for everything else)*

**Goal:** collapse the CRM sidebar to ~10 top-level workspaces and ship the shared clickable-row primitive that every list page will adopt.

#### 3.1.1 New sidebar IA (target)

| Workspace | Contains |
|---|---|
| **1. Overview** | Home, Activity, Mentions, Notifications, Pinned, Search |
| **2. Sales Pipeline** | Pipelines, Stages, Leads, Deals, Tasks, Forms, Automations (the current Sales CRM section, deduped) |
| **3. Customers** | Accounts/Clients, Contacts, Portal access, Documents, Notes, Categories. **Single canonical contact path.** |
| **4. Billing** | Quotations, Proforma, Orders, Delivery, Invoices, Recurring invoices, Receipts, Payments, Credit notes, Subscriptions, Proposals, Estimates (the current Sales section, minus the customer-master items that move to Customers) |
| **5. Procurement** | Vendors, RFQs, Vendor bids, PO, GRN, Bills, Debit notes, Recurring expenses, Payouts, Expenses, Hire |
| **6. Inventory** | Items, Warehouses, Stock transfers, Adjustments, GRN, BOM, Production orders, Batch & expiry |
| **7. Accounting & Banking** | Chart of accounts, Groups, Vouchers, Day book, P&L, Balance sheet, Cash flow, Bank accounts, Transactions, Reconciliation, Loans, Petty cash, Fixed assets, Tax (E-way bills) |
| **8. Operations** | Projects, Issues, Subtasks, Milestones, Tasks, Time tracking, Bookings, Service contracts, Tickets, Knowledge base, SLA, Reply templates |
| **9. Workplace** | Announcements, Awards, Discussions, Events, Knowledge base, Notices, Messages, HR (collapsed under a single "People" workspace with sub-nav: People, Recruitment, Onboarding, Performance, Learning, Docs, Time & Expenses, Exit, Recognition, Payroll) |
| **10. Admin** | Settings, Custom fields, Roles, Webhooks, API tokens, Email templates, Currencies, Languages, GDPR, Audit log, Integrations, Team, Reports, Import/Export, Setup |

Outcomes:
- 58 sections → 10 workspaces (+ one collapsible "People" inside Workplace)
- Triple-pathed "Contacts" → one canonical path; the other two become permanent redirects
- Admin-only entries consolidate under workspace 10 instead of scattering across every section
- "Cross-cutting" junk drawer is deleted; items move to their proper workspace

#### 3.1.2 Clickable-row primitive

Add two shared components to `src/components/crm/`:

- `<EntityRowLink href={...} children />` — wraps the **name/ID cell** of a row in a `Link` so the whole cell (plus its row hover state) navigates to the detail page. Used by **entity lists** (deals, leads, contacts, invoices, etc.).
- `<RowDrawer trigger detail />` — wraps the name/ID cell in a button that opens a `ZoruSheet` with the detail+edit form. Used by **settings / lookup lists** (currencies, designations, holidays, flags) where a full page is overkill.

Existing CRM list pages get a sweep PR that swaps their name/ID cell to one of these two primitives. The grep showed ~331 list pages without an obvious row-link signal; after excluding settings (where `RowDrawer` is correct), realistic gap is ~60–90 entity lists to update.

**Block:** any redesigned detail page in Batches 2–5 must exist before the list links to it (no 404 traps).

---

### Batch 2 — Forms module end-to-end *(user's #1 complaint)*

Lives at `src/app/dashboard/crm/sales-crm/forms/`. (The duplicate at `crm/sales/forms/` collapses to a redirect once Batch 1 ships.)

#### 3.2.1 Power builder upgrades

Extend `src/components/wabasimplify/website-builder/crm-form-builder.tsx` (or replace with a v2 component):

- **15+ field types**: keep current 12 (text, email, textarea, number, select, checkbox, radio, date, file, acceptance, hidden, html) + add phone, address (composite), rating, signature, payment (Stripe/Razorpay).
- **SabFiles wiring**: file-upload field uses `<SabFilePickerButton>` / `<SabFileToFileButton>` from `@/components/sabfiles` (per project's no-external-URLs policy in CLAUDE.md). Files attach to a SabFiles folder per form.
- **Multi-step pages**: form builder gains a "Pages" panel; each page has its own fields; renderer shows step indicator + prev/next.
- **Validation rules**: per-field min/max length, regex, custom message; cross-field rules ("require X if Y is filled").
- **Theme/branding**: color, font, logo, background — stored on the form doc.
- **Post-submit settings tab**: success message, redirect URL, email-on-submit (to-list + template), webhook URL (with retry + secret), auto-create lead/contact toggle with field mapping.

#### 3.2.2 Submissions inbox + detail + export *(user's #2 complaint)*

New routes:

- `sales-crm/forms/[formId]/submissions/page.tsx` — inbox table. Columns: submitted-at, snippet, lead-status, source page, IP. Search box, date-range filter, per-field filter, bulk select, mark-as-read, mark-as-spam.
- `sales-crm/forms/[formId]/submissions/[submissionId]/page.tsx` — full submission detail. Sections: payload (all fields), submitter context (UA, referrer, IP), activity (status changes, who marked-read), actions (convert to lead, convert to contact, archive, delete).
- `sales-crm/forms/[formId]/analytics` (optional, end of batch) — submission rate, conversion rate, field drop-off if multi-step.
- New server actions in `src/app/actions/crm-forms.actions.ts`: `getFormSubmissions(formId, filters)`, `markSubmissionRead`, `convertSubmissionToLead`, `exportSubmissions(formId, format)`. Existing `getFormSubmissionById` is already in place.
- Export: CSV and XLSX (server action streams from `crm_form_submissions` collection; uses existing patterns from other CRM export flows — do not re-roll).

---

### Batch 3 — Missing edit pages + shallow form redesigns

The four critical missing edit routes ship first; then the ten shallow forms get the new pattern applied.

#### 3.3.1 Missing edit pages (priority order)

1. `contacts/[contactId]/edit/page.tsx` + `edit-contact-form.tsx` — match the depth of the 369-LOC detail. Sections: identity, organisation, contact channels, address, tags, custom fields. Save uses `crm-contacts.actions.ts`.
2. `contracts/[contractId]/edit/page.tsx` + `edit-contract-form.tsx` — terms editor, parties list, value, renewal date, document attachment (SabFiles), audit-trail tab.
3. `sales/proposals/templates/[templateId]/edit/page.tsx` + form — sections editor, variable picker, preview.
4. `deals/[id]/page.tsx` — replace legacy 14-LOC redirect with a real detail page that mirrors `sales-crm/deals/[id]` content (or delete the route and keep only the redirect explicitly).

#### 3.3.2 Shallow form redesigns (apply same pattern to each)

For each of: petty-cash, service-contracts, portal, hr/exits, budgets, workspace/announcements, hr/onboarding, inventory/stock-transfers, purchases/orders, projects/issues:

- Wrap in multi-step where there are >8 fields
- Add linked-entity pickers (contact, account, vendor, project) instead of free-text IDs
- Replace any free-text file URL inputs with `<SabFilePickerButton>` (per project policy)
- Add inline activity feed component (`<EntityActivityRail entityId entityKind />` — already exists in `src/components/crm/`)
- Validation pass: required, format, cross-field

---

### Batch 4 — Thin detail page redesigns

Apply a consistent detail-page shell to: `sales/contacts/[contactId]` (27 LOC → ~250), `hr/timesheets/[id]`, `sales/proposals/templates/[templateId]`, `workspace/notices/[id]`, `workspace/discussions/[id]`, `workspace/knowledge-base/[id]`.

Detail shell template (pull from existing best-of pattern in `bookings/[id]` or `sales-crm/leads/[id]`):

- Header: title, status badge, action menu (edit, archive, delete, share)
- Left column: tabs (Overview, Activity, Related, Files, Audit)
- Right rail: key facts, owner, dates, related entity links
- Below: comments / discussion thread where applicable

---

### Batch 6 — Deepen thin entity lists *(added 2026-05-20 after batches 1–5 shipped)*

Many CRM list pages render only a plain `ZoruTable` of rows — no KPI strip, no filters beyond a search box, no bulk actions, no export. The audit and Batch 1–5 sweeps wired clickable rows everywhere, but the surrounding list UX is still shallow on ~22 entity lists.

Canonical "Deep list" template lives at `src/app/dashboard/crm/sales-crm/all-leads/page.tsx` (588 LOC). Composition:

- **KPI strip** — 3–5 stat cards (totals, status counts, derived rates) sourced from a `getXxxKpis()` server action
- **Filter row** — search input + status select + source/owner/date-range filters (URL-synced where possible)
- **Saved views** menu (optional — only for high-volume lists)
- **Bulk action bar** — appears when rows selected; supports Delete, Archive, Status change, Export selected
- **Export button** — CSV / XLSX (use existing `xlsx@^0.18.5` dep)
- **Pagination** via `<PaginationBar>` from `@/components/crm/pagination-bar`
- **Row primary cell** wrapped in `<EntityRowLink>`

Target lists (LOC currently → Deep target ~300–500):
- `sales-crm/products` (70), `sales-crm/automations` (173), `sales-crm/all-pipelines` (139), `sales-crm/custom-forms` (94)
- `sales/coupons` (201), `sales/gift-cards` (194), `sales/loyalty` (170)
- `banking/bank-accounts` (184), `banking/employee-accounts` (170)
- `inventory/vendors` (137)
- `purchases/leads` (149)
- `hr-payroll/shift-rotations` (168), `hr-payroll/form-16` (228), `hr-payroll/pf-esi` (196), `hr-payroll/tds` (183), `hr-payroll/employees/teams` (215)
- `team/manage-users` (217)
- `pinned` (222)
- `tax/gstr3b` (202)

Settings/lookup lists (currencies, languages, statuses, types, etc.) intentionally stay thin — they use `<RowDrawer>` for inline edit, no Deep template needed.

### Batch 7 — Deepen Reports module *(added 2026-05-20 after Batch 6 shipped)*

The audit flagged `crm/reports/` as a 238-LOC hub linking 22 thin sub-reports (45–180 LOC each). Most are placeholder pages with mock data and no real chart/export/drill-down. Managers/owners live in reports — this is high-impact.

Canonical report template (apply to each sub-report):

- **Header**: date range / FY picker + Compare-to-previous toggle + Refresh + Export menu
- **KPI strip**: 3–4 stat cards summarizing the period
- **Chart**: 1–2 charts via existing `recharts` (already in `package.json`) + `src/components/zoruui/chart.tsx` wrapper — bar/line/pie chosen per report
- **Filter row**: search + entity-specific filters (owner, status, department, etc.)
- **Data table**: filtered rows with EntityRowLink to source records
- **Export**: CSV + XLSX via shared `src/lib/crm-list-export.ts`
- **Saved view presets** (optional, for high-volume reports)
- **Schedule email export** (optional, ties into existing email infra)

Target reports:
- **Sales**: top-clients, top-products, sales-deals, leads-conversion
- **Finance**: income, expense, profit-loss, tax, invoice-aging, payment-report
- **Tasks/Projects**: overdue-tasks, task-report, late-report, project-status-report
- **People**: agent-performance, attendance-report, leave-report, leave-balance-report, birthday-anniversary
- **Support**: ticket-report
- **GST**: gstr-1, gstr-2b (gstr-3b already deepened in Batch 6)

### Batch 5 — Wider clickable-row sweep + cleanup

By the time Batches 1–4 land:

- All entity lists have name/ID cells using `<EntityRowLink>` pointing at real detail pages (no 404s).
- Settings/lookup lists use `<RowDrawer>` for in-place detail+edit.
- Delete or redirect duplicate routes (sales/forms → sales-crm/forms; sales/contacts → contacts; etc.).
- Final pass on remaining ~17 modules graded "Stub" in the first audit: accounting hub, analytics, audit-log, banking hub, email, inventory hub, hr hub, mentions, messages, notifications, purchases hub, sales hub, search, store hub, tax, time-tracking hub, workspace hub — each gets at least a working overview + the linked sub-pages they advertise.

---

## 4. Sequencing rules

1. **Sidebar regroup (Batch 1) ships first.** It changes URLs/IA. Without it, every subsequent batch risks landing in the wrong nav slot.
2. **Detail page must exist before list links to it.** Inside each batch, write the `[id]/page.tsx` route before flipping the list's name/ID cell to `<EntityRowLink>`.
3. **One module = one PR** for Batches 2–4 (keeps review focused). Batch 1 and Batch 5 are sweeps so they're one PR each.
4. **No new external URL inputs.** Every file-attach surface uses SabFiles components (CLAUDE.md policy).
5. **No `unstable_cache`, no Edge Functions.** Default to Fluid Compute + Node.js runtime per Vercel-native policy in CLAUDE.md. Cron-driven work (e.g., scheduled form-submission digests) uses Vercel Cron, not `node-cron` / `agenda` / `bull`.

---

## 5. Open questions before kicking off

- **Sidebar regroup approval**: target IA in §3.1.1 is a proposal — needs sign-off on the 10-workspace shape and on collapsing the HR · / Payroll · sections into a single "People" sub-nav.
- **Forms duplicate path**: `sales/forms/` vs `sales-crm/forms/` — confirm sales-crm/forms is canonical (Batch 2 assumes yes).
- **Payment fields**: which provider for the form-builder payment field? Stripe, Razorpay, or both?
- **Deals legacy route**: keep `deals/[id]` as a permanent redirect, or remove the directory and let Next.js 404?
- **Detail-page shell**: pick one existing detail page (e.g., `bookings/[id]`) as the template, or define a new `<EntityDetailShell>` component?

---

## 6. Tracking

This plan maps onto the in-session task list:

| Task # | Plan section |
|---|---|
| #2 Rebuild Forms power builder | §3.2.1 |
| #3 Build submissions inbox + detail + export | §3.2.2 |
| #4 Redesign next CRM pages from audit punch-list | §3.3.2, §3.4 |
| #5 Wire clickable name/ID → detail | §3.1.2, §3.5 |
| #6 Regroup CRM sidebar | §3.1.1 |

When a batch lands, mark its tasks complete and reference the merged PR here.

---

## 7. Out of scope (deliberately)

- Rust-side DTO changes (covered in `crm_rebuild_next_steps.md` already).
- Mobile app parity for these pages.
- Cross-workspace search overhaul.
- Marketing-site rebranding of CRM pages.
