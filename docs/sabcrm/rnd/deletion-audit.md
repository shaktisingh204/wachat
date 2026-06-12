# P9 — Legacy CRM deletion audit (task #10)

R&D pass, 2026-06-12. Execution spec for deleting the legacy CRM module
(`/dashboard/crm`) without breaking **Sabbigin** (stays standalone), the live
`/dashboard/*` suite modules (sabdesk, sabbi, sabconnect, sabthrive, finance,
email, team, portal, sabsms, admin), or the SabCRM suite (`/sabcrm/*` +
`/v1/sabcrm/*` project mounts).

Method: importer-graph greps over `src/` (both `'` and `"` import specifiers —
the single-quote-only first pass mis-bucketed 5 action files, see §2.2-caveat),
multiline-aware `.nest(` extraction from `rust/crates/api/src/router.rs`
(single-line grep undercounts: 14 sabcrm project mounts are wrapped `.nest(`
calls). `graphify-out/GRAPH_REPORT.md` does not exist in this checkout — rule
skipped, raw greps used throughout.

---

## 0. Verdict summary

| Surface | Count | P9 action |
|---|---|---|
| `src/app/dashboard/crm/**` | 560 `page.tsx`, 1,516 files, 704 dirs | **DELETE** (single subtree) |
| `src/app/actions/crm-*.actions*.ts` | 191 files (incl. `.types.ts` + 1 `.patch`) | DELETE **80** legacy-only (+types siblings) — §2.2; KEEP 92 shared |
| `src/app/actions/crm/contracts.actions.ts` | 1 | **DELETE** (only `/dashboard/crm/sales/contracts/*` imports it); rest of `actions/crm/` + `actions/crm-advanced/` UNTOUCHED |
| `/v1/crm/*` mounts in `rust/crates/api/src/router.rs` | 114 | KEEP 9 (sabbigin) + all shared-consumer mounts; **48 unmount candidates** (§2.3) after per-mount gate |
| Rust crates (`crm-*` = 160, `sabcrm-*` = 23) | — | **NO crate deletions.** 37 crates have `/v1/sabcrm/{finance,supply,commerce,forms}` `project_router` re-mounts — those re-scoped crates STAY; only legacy `.nest("/v1/crm/…")` lines + their now-unused `let` bindings go |
| `src/lib/crm/**` (10 files) | — | KEEP 5, DELETE 4 + matching `__tests__` (§2.4) |
| `USE_RUST_CRM` | 172 sites (162 actions, 10 `lib/rust-client`), `.env:501` | Flag **STAYS** (guard: `src/lib/rust-client/crm-base.ts:60-70`, semantics `'false'` ⇒ throw, default = rust ON). Sites shrink organically with the 80 deleted actions |
| Nav / dock / launchpad / landing | 9 sites | EDIT (§2.7) |
| Middleware | `src/proxy.ts` (there is **no** `src/middleware.ts`) | ADD redirect block (§2.8) — zero crm handling exists today |
| Twenty kit `src/components/sabcrm/twenty/` | 36 files, 17 external importers | NOT deleted in P9; orphan files + 5 orphan `components/sabcrm/*` wrappers deletable now; attrition plan §3 |

---

## 1. Sabbigin keep-list (MUST keep working)

Sabbigin code = `src/app/actions/sabbigin*.ts`, `src/app/dashboard/sabbigin/**`,
`src/components/sabbigin/**`, `src/lib/sabbigin/**`. Full grep of crm imports:

### 1.1 crm action files Sabbigin imports (KEEP, with exact importers)

| Keep file | Sabbigin importers |
|---|---|
| `src/app/actions/crm-pipelines.actions.ts` | `dashboard/sabbigin/page.tsx:39`, `pipelines/page.tsx:1`, `pipelines/[pipelineId]/page.tsx:29`, `pipelines/[pipelineId]/edit/page.tsx:19`, `pipelines/_components/pipeline-form.tsx:48`, `pipelines/_components/pipelines-client.tsx:33`, `deals/_data.ts:14`, `deals/new/page.tsx:26`, `deals/[dealId]/page.tsx:24`, `dashboards/_data.ts:16`, `settings/page.tsx:26`, `settings/team/page.tsx:17`, `settings/email-in/page.tsx:16`, `settings/booking/new/page.tsx:14`, `settings/booking/[pageId]/page.tsx:15` |
| `src/app/actions/crm-pipelines.actions.types.ts` | `pipelines/_components/pipelines-client.tsx:36` (`CrmPipelineKpis`) |
| `src/app/actions/crm.actions.ts` (`getCrmContacts`, `getCrmContactById`, `addCrmContact`, `addCrmNote`, `getCrmEntityTimeline`) | `contacts/page.tsx:28`, `contacts/new/page.tsx:34`, `contacts/[contactId]/page.tsx:22`, `contacts/[contactId]/_components/contact-detail-client.tsx:57`, `deals/[dealId]/page.tsx:25`, `deals/[dealId]/_components/deal-detail-client.tsx:83` |
| `src/app/actions/crm-accounts.actions.ts` (`addCrmAccount`, `updateCrmAccount`, getters) | `companies/page.tsx:35`, `companies/new/_components/company-form.tsx:32`, `companies/[companyId]/page.tsx:24`, `companies/[companyId]/_components/company-detail-client.tsx:52` |
| `src/app/actions/crm-deals.actions.ts` (`updateCrmDealStage`, `getCrmDealById`, `getCrmDealRelatedCounts`, `bulkArchiveDeals`, `bulkChangeStage`) | `src/app/actions/sabbigin-deals.actions.ts:22`, `deals/[dealId]/page.tsx:23`, `src/components/sabbigin/deals/deal-list.tsx:25` |
| `src/app/actions/crm-products.actions.ts` (`getCrmProducts`, `getCrmProductById`) | `products/page.tsx:19`, `products/[productId]/page.tsx:20` |
| `src/app/actions/crm-custom-fields.actions.ts` (`getCustomFields`, `saveCustomField`) | `settings/fields/page.tsx:12`, `settings/fields/_components/fields-manager.tsx:39` |
| `src/app/actions/crm-activity.actions.ts` | `activities/page.tsx:29`, `activities/_components/activities-client.tsx:65` |
| `src/app/actions/crm-forms.actions.ts` (`getCrmForms`) | `settings/forms/page.tsx:14` |

### 1.2 Shared components/libs Sabbigin imports (KEEP)

- `src/components/crm/entity-list-shell.tsx` ← `pipelines/_components/pipelines-client.tsx:28`
- `src/components/crm/entity-row-link.tsx` ← same file `:29`
- `src/components/crm/entity-detail-shell.tsx` ← `pipelines/[pipelineId]/page.tsx:27`
- `src/components/crm/enum-form-field.tsx` ← `pipelines/_components/pipeline-form.tsx:42`
  (these four only depend on `@/components/sabcrm/20ui`, `@/lib/utils`,
  `@/data/reference/crm-enums` — no legacy-route deps; safe keep)
- `src/lib/crm-list-export.ts` (`downloadCsv`, `dateStamp`) ← `pipelines-client.tsx:30`
  (22 importers outside legacy in total — shared, keep)

### 1.3 Transitive keep chain (rust clients → mounts → crates)

Keep `src/lib/rust-client/`: `crm-base.ts`, `crm-pipelines.ts`, `crm-contacts.ts`,
`crm-accounts.ts`, `crm-deals.ts`, `crm-items.ts`, `crm-products.ts`,
`crm-custom-fields.ts`, `crm-forms.ts`, `crm-form-submissions.ts` (+ `fetcher`).

Keep these 9 legacy mounts (router.rs `.nest` lines ~716-905):
`/v1/crm/pipelines`, `/v1/crm/contacts`, `/v1/crm/accounts`, `/v1/crm/deals`,
`/v1/crm/items`, `/v1/crm/products`, `/v1/crm/custom-fields`, `/v1/crm/forms`,
`/v1/crm/form-submissions` — and their crates.

Also keep: `src/lib/crm/access-scope.ts` (imported by `crm.actions.ts:16` —
sabbigin chain — and `crm-leads.actions.ts`), `src/lib/crm-industry-stages.ts`
(imported by `crm-deals.actions.ts`). `crm-activity.actions.ts` is pure Mongo
(`crm_activities`, `crm_audit_log` collections via `@/lib/mongodb`) — no rust
dependency; collections/data untouched by P9.

Sabbigin's own backend is independent: crates `sabbigin-config`,
`sabbigin-bookings`; client `src/lib/rust-client/sabbigin-config.ts`; sidebar
`src/components/sabcrm/20ui/composites/shell/module-sidebars/sabbigin.tsx` — none touched.

### 1.4 Link hygiene

`grep -rn "/dashboard/crm" src/app/dashboard/sabbigin src/components/sabbigin`
returns **zero** hits — no sabbigin link rewrites needed.

---

## 2. P9 delete inventory

### 2.1 Routes

Delete the whole subtree `src/app/dashboard/crm/` (560 `page.tsx`, 1,516 files,
704 dirs).

**Do NOT touch `src/app/dashboard/settings/crm/**`** — that is the SabCRM
*suite* settings hub (Twenty-styled), linked from `src/app/sabcrm/home-client.tsx`,
`src/app/sabcrm/getting-started/page.tsx`, `sabcrm-suite-frame.tsx`,
`twenty/twenty-command-menu.tsx`. It belongs to §3 attrition, not P9.
Also keep `src/app/portal/**` (customer portal; uses shared
`crm-portal-auth.actions` / `crm-knowledge-base.actions`).

### 2.2 Actions

**DELETE these 80** `src/app/actions/<name>.ts` files (each verified: importers
only under `src/app/dashboard/crm/**`, both quote styles), plus any matching
`<name>.types.ts` sibling, plus the stray `crm-payroll.actions.ts.patch`, plus
`src/app/actions/crm/contracts.actions.ts`:

`crm-accounting-reports.actions` `crm-agent-groups.actions` `crm-api-tokens.actions`
`crm-audit-log.actions` `crm-auto-leads.actions` `crm-bank-transactions.actions`
`crm-budgets.actions` `crm-bulk-export.actions` `crm-careers-pages.actions`
`crm-compensation-bands.actions` `crm-contract-signatures.actions`
`crm-contract-templates.actions` `crm-contract-types.actions` `crm-contracts.actions`
`crm-coupons.actions` `crm-credit-notes.actions` `crm-currencies.actions`
`crm-debit-notes-v2.actions` `crm-debit-notes.actions` `crm-delivery-challans.actions`
`crm-erase-requests.actions` `crm-estimate-requests.actions` `crm-estimate-templates.actions`
`crm-expense-categories.actions` `crm-expenses.actions` `crm-fixed-assets.actions`
`crm-gift-cards.actions` `crm-grn.actions` `crm-hire.actions` `crm-import.actions`
`crm-india-einvoice.actions` `crm-india-eway.actions` `crm-india-itc.actions`
`crm-india-tds194q.actions` `crm-integrations.actions` `crm-inventory-writes.actions`
`crm-inventory.actions` `crm-item-batches.actions` `crm-leads-api.actions`
`crm-loans.actions` `crm-milestones.actions` `crm-msme-alerts.actions`
`crm-notifications.actions` `crm-payment-accounts.actions` `crm-payment-receipts.actions`
`crm-payouts-v2.actions` `crm-payouts.actions` `crm-petty-cash.actions`
`crm-portal.actions` `crm-pos.actions` `crm-production-orders.actions`
`crm-proforma-invoices.actions` `crm-promotions.actions` `crm-proposals.actions`
`crm-quotations.actions` `crm-reconciliation.actions` `crm-recurring-expenses-v2.actions`
`crm-recurring-invoices.actions` `crm-rfq.actions` `crm-rfqs-v2.actions`
`crm-sales-orders.actions` `crm-search.actions` `crm-service-catalog.actions`
`crm-service-contracts.actions` `crm-services.actions` `crm-shift-change-requests.actions`
`crm-stock-transfers.actions` `crm-store.actions` `crm-subscriptions.actions`
`crm-subtasks.actions` `crm-task-categories.actions` `crm-task-tags.actions`
`crm-taskboard-columns.actions` `crm-tasks-rust.actions` `crm-templates.actions`
`crm-time-logs.actions` `crm-vendor-bids-v2.actions` `crm-vendor-bids.actions`
`crm-vendor-types.actions` `crm-webhooks.actions`

**Caveat that produced this list:** a single-quote-only grep classified 85 files
as legacy-only; re-running with `grep -rlE "app/actions/<name>['\"]"` flipped 5
to shared — `crm-kb-categories.actions`, `crm-reply-templates.actions`,
`crm-sla.actions`, `crm-ticket-groups.actions` (all sabdesk, double-quoted
imports) and `crm-warehouses.actions` (`src/components/crm/inventory/add-warehouse-dialog.tsx`).
**KEEP those 5.** Gate for the build agent — before deleting any file:

```sh
grep -rlE "app/actions/<basename-no-ext>['\"]" src --include='*.ts' --include='*.tsx' \
  | grep -v '^src/app/actions/\|^src/app/dashboard/crm/'   # must be empty
```

**KEEP (shared) — 92 files** with their non-legacy consumers, e.g.:
hrm (~60 files: `crm-employees`, `crm-payroll*`, `crm-hr*`, `crm-attendance`-family…),
sabdesk (`crm-sla`, `crm-reply-templates`, `crm-ticket-groups`, `crm-kb-categories`,
`crm-knowledge-base`→portal too), sabbi (`crm-reports`, `crm-analytics`,
`crm-invoices`, `crm-leads`, `crm-india-gst`, `crm-purchase-orders`, `crm-dashboards`,
`crm-vendors`, `crm-accounts`), sabconnect (`crm-announcements`, `crm-events`,
`crm-recognitions`), sabthrive/sabrewards (`crm-loyalty`), team (`crm-roles`),
email (`crm-email`), api/webhooks (`crm-automations`, `crm-forms`, `crm.actions`,
`crm-accounting`, `crm-reports`), 20ui-domain dialogs (`crm-tasks`, `crm-vouchers`,
`crm-email-templates`, `crm-hr`, `crm-deals`, `crm-pipelines`, `crm-products`,
`crm-vendors`, `crm-accounting`), components/crm kit (`crm-lookup`,
`crm-quick-create`, `crm-saved-views`, `crm-settings`, `crm-assignment`,
`crm-bulk-import`, `crm-analytics-reports`, `crm-inventory-settings`,
`crm-employees`, `crm-products`, `crm-vendors`), `lib/webhook-processor.ts`
(`crm-deals`, `crm-email`), portal (`crm-portal-auth`), sabwa via `lib/crm-auth`.
Note: hrm/seo are *hidden* modules, not deleted — their consumers keep these
actions compiling; do not delete hrm-consumed actions in P9.

### 2.3 Rust mounts (`rust/crates/api/src/router.rs`)

- 114 `.nest("/v1/crm/…")` legacy mounts (extract multiline-aware:
  `perl -0777 -ne 'while (/\.nest\(\s*"(\/v1\/[^"]+)"/g){print "$1\n"}' router.rs`).
- 59 `/v1/sabcrm/*` mounts, of which **37 are project-scoped re-mounts of crm-*
  crates** (`*::project_router`, declared at router.rs:384-441 + 499-500):
  finance×21 (`invoices, quotations, sales-orders, credit-notes, debit-notes,
  payment-receipts, bills, proforma-invoices, payment-accounts,
  bank-transactions, recurring-invoices, expenses, payouts, vouchers,
  petty-cash, budgets, reconciliation, accounts, account-groups,
  journal-entries, tds`), supply×10 (`items, warehouses, stock-adjustments,
  purchase-orders, grn, vendors, rfqs, vendor-bids, bom, production-orders`),
  commerce×4 (`pos, store, coupons, gift-cards`), forms×2 (`forms,
  form-submissions`). **These crates STAY.** `crm-pos`, `crm-store`,
  `crm-bank-transactions`, `crm-recurring-invoices` have NO legacy mount at all
  (router.rs comments :400-403, :433-437).
- Unmount candidates once `/dashboard/crm` + the 80 actions are gone
  (legacy-only or zero TS consumers at client level):
  **31 legacy-only:** `agent-groups, bank-transactions*, budgets*,
  compensation-bands, coupons*, currencies, estimate-requests,
  expense-categories, gift-cards*, hire, loans, milestones, payment-accounts*,
  petty-cash*, portal-users, pos*, production-orders*, proforma-invoices*,
  project-tasks, proposals, reconciliation*, recurring-invoices*,
  service-contracts, shift-change-requests, slas→(KEEP — sabdesk flip, see
  §2.2), stock-adjustments*, store*, subtasks, task-categories, task-tags,
  taskboard-columns, time-logs` (`*` = crate keeps its `/v1/sabcrm/*` re-mount);
  **17 no-consumer clients:** `auto-leads, branches, brands, company-profile,
  issues, labels, project-categories, purchase-leads, purchases, settings,
  sla-policies, tags, task-labels, ticket-channels, ticket-tags,
  ticket-templates, ticket-types`.
  Per-mount gate before removing a `.nest` line — the matching
  `src/lib/rust-client/crm-<x>.ts` must have **zero** importers
  (both quote styles) AND no raw `rustFetch('/v1/crm/<x>…')` anywhere in `src/`
  or `scripts/`. Then delete the rust-client file too, remove the unused
  `let crm_<x> = …router()` binding, and `cargo check -p sabnode-api` must pass
  with no `unused_variables` warnings.

### 2.4 `src/lib/crm/**` and `lib/crm-*` root files

| File | Verdict | Evidence |
|---|---|---|
| `access-scope.ts` | KEEP | `crm.actions.ts:16` (sabbigin chain), `crm-leads.actions.ts` |
| `cron-match.ts` | KEEP | `src/app/api/cron/reports-scheduler/route.ts:23` |
| `module-connections.server.ts` | KEEP | `src/app/api/webhooks/meta/route.ts:15`, `src/lib/sabcrm/email-inbound.ts:31`, `crm-email.actions.ts` |
| `ticket-email.server.ts` | KEEP | `src/app/api/webhooks/email-inbound/route.ts:4` |
| `number-safety.ts` | KEEP | `crm-accounting.actions.ts` (shared) — other two importers die with §2.2 |
| `convert-with-prefill.ts` | DELETE | only `dashboard/crm/sales/{receipts,payments}/new/page.tsx` |
| `lead-utils.ts` | DELETE | only `dashboard/crm/sales-crm/all-leads/duplicates/page.tsx` |
| `dispatch.server.ts` | DELETE | zero importers |
| `make-actions.ts` | DELETE | zero importers |
| `__tests__/` | prune tests of deleted files only |

Root `src/lib/`: `crm-auth.ts` KEEP (`sabwa.actions.ts` + `src/app/api/crm/auth/*` ×4 +
`dashboard/email/settings`), `crm-list-export.ts` KEEP (22 outside users),
`crm-industry-stages.ts` KEEP, `crm-import/` DELETE (sole importer is
`crm-import.actions` — gate-grep first), `crm-depth/` — verify with the §2.2
gate before touching (not audited to zero).

### 2.5 `src/app/api/crm/*` routes — ALL KEEP

`auth/{google,outlook}/{connect,callback}` (email OAuth — dashboard/email +
sabwa), `forms/{data,submit}/[formId]` (public embed flow; sabbigin forms),
`automations/{test-webhook,trigger/[automationId]}` (`crm-automations.actions`
is shared; `src/lib/sabflow/recipes/*` hardcode `/api/crm/…` URLs in ≥7 recipes).

### 2.6 `USE_RUST_CRM`

Definition/guard `src/lib/rust-client/crm-base.ts:60-70` (`'false'` ⇒ throw,
i.e. rust path is default-on). 172 `src/` sites (162 in `app/actions`, 10 in
`lib/rust-client`) + `.env:501`. **Do not remove the flag in P9** — surviving
shared actions still branch on it; its site count drops with the 80 deletions.

### 2.7 Nav / dock / launchpad / landing edits (exact sites)

1. `src/components/sabcrm/20ui/composites/shell/apps.ts:157-164` — SAB_APPS
   `crm` entry (`href: "/dashboard/crm"`); also drop `"crm"` from
   `HIDDEN_APP_IDS` (line 79) and update the comment at lines 77-78 (it
   explicitly says crm "stays hidden until its P9 deletion").
2. `src/components/sabcrm/20ui/composites/shell/home-shell.tsx:234` —
   Shortcuts entry `{ id: "crm", … href: "/dashboard/crm" }`.
3. `src/components/sabcrm/20ui/composites/shell/app-sidebars.tsx` — entire CRM
   sidebar config: comment block ~line 711, `prefix: "/dashboard/crm"` at line
   726, block ends just before `prefix: "/dashboard/hrm"` at line 1155
   (~166 `/dashboard/crm` hrefs). Plus the home-shortcuts leaf at line 1790.
4. `src/app/dashboard/page.tsx:373` — link to `/dashboard/crm/activity`.
5. `src/config/dashboard-config.ts` — 56 `/dashboard/crm` refs (app entry line
   43; nav section lines 212+). **Caution:** `src/lib/rbac-server.ts` imports
   this file — confirm it doesn't derive permission keys from the removed crm
   nav items before trimming (crm `permissionKey: 'crm_*'` strings live here).
6. `src/components/admin-panel/sidebar/app-rail.tsx:52` and
   `src/components/admin-panel/layout/admin-layout.tsx:40`.
7. `src/components/landing-v2/modules-data.ts:384` (`'/dashboard/crm'`) and
   `src/components/landing-v2/landing-footer.tsx:14` — point at `/sabcrm`
   (or the `/products/crm` marketing page).

Dock/Launchpad (`app-dock.tsx`, `launchpad.tsx`, `use-dock-apps`) read SAB_APPS —
no separate edits beyond (1).

### 2.8 Middleware redirect spec — `src/proxy.ts`

There is no `src/middleware.ts`; the edge proxy is `src/proxy.ts` and currently
has **zero** crm handling. Add, inside the authenticated `/dashboard` branch
(after the session check, before `NextResponse.next()` at ~line 146):

```ts
// P9: legacy CRM module deleted — permanent redirect into the SabCRM suite.
const LEGACY_CRM_PREFIX = '/dashboard/crm';
const LEGACY_CRM_MAP: Array<[string, string]> = [
  ['/dashboard/crm/sales/invoices',    '/sabcrm/finance/invoices'],
  ['/dashboard/crm/sales/quotations',  '/sabcrm/finance/quotations'],
  ['/dashboard/crm/sales/credit-notes','/sabcrm/finance/credit-notes'],
  ['/dashboard/crm/sales/receipts',    '/sabcrm/finance/payment-receipts'],
  ['/dashboard/crm/purchases',         '/sabcrm/supply'],
  ['/dashboard/crm/inventory',         '/sabcrm/supply/items'],
  ['/dashboard/crm/tasks',             '/sabcrm/tasks'],
  ['/dashboard/crm/projects',          '/sabcrm/projects'],
];
if (pathname === LEGACY_CRM_PREFIX || pathname.startsWith(`${LEGACY_CRM_PREFIX}/`)) {
  const hit = LEGACY_CRM_MAP.find(([from]) => pathname.startsWith(from));
  const url = req.nextUrl.clone();
  url.pathname = hit ? hit[1] : '/sabcrm';
  return NextResponse.redirect(url, 308);
}
```

Mapping table is extendable; the `/sabcrm` fallback guarantees no 404. This also
covers the shared-kit deep links that survive P9:
`components/crm/command-palette.tsx:64-66`, `lineage-rail.tsx:69-71`,
`entity-picker.tsx:811-813`, `keyboard-shortcuts.tsx:52-53`,
`lib/worksuite/search-types.ts:95-99`, `lib/email-templates/events.ts:175,212,232`
(re-point these in a later polish pass; non-blocking under the redirect).

---

## 3. Twenty-kit sweep (`src/components/sabcrm/twenty/`, 36 files)

### 3.1 Flag mechanics

`NEXT_PUBLIC_SABCRM_RECORD_SURFACE` (`'1' | 'all' | 'slug,slug'`; **unset ⇒
Twenty surface renders**) gates both record surfaces:
`src/app/sabcrm/[objectSlug]/page.tsx:2516-2520` (list) and
`src/app/sabcrm/[objectSlug]/[recordId]/page.tsx:41-57` (detail →
`RecordDetailSurface` vs `SabcrmTwentyDetailPage`).

### 3.2 Importer classification (all 17 current importers)

**Flag-off-path-only** (dead once flag default = `all`):
- `src/app/sabcrm/[objectSlug]/page.tsx` (Twenty list branch — `TwentyPageHeader/Button/Chip/Avatar`, `twenty-field`, `st-select`, `twenty-palette`, `inline-create-row`)
- `src/app/sabcrm/[objectSlug]/view-bar.tsx` (`TwentyButton`, `st-modals`)
- `src/app/sabcrm/[objectSlug]/bulk-bar.tsx` (`TwentyButton`)
- `src/app/sabcrm/[objectSlug]/[recordId]/page.tsx` (Twenty detail branch) + `record-detail-tw.tsx` (`twenty-primitives`, `twenty-field`, `twenty-timeline`, barrel)

**Always-on (NOT flag-gated — must be ported before kit deletion):**
- `src/app/sabcrm/layout.tsx:22-23` → `sabcrm-outer-shell`, `sabcrm-actors-context`
- `src/components/sabcrm/sabcrm-suite-frame.tsx:68-80` → `twenty-command-menu`, `use-command-menu`, `twenty-workspace-switcher`, `sabcrm-settings-context`

**Orphan wrappers — zero importers anywhere, DELETE in P9:**
`src/components/sabcrm/record-table.tsx`, `record-detail.tsx`,
`field-renderer.tsx`, `kpi-cards.tsx`, `view-toolbar.tsx` (each imports twenty;
nothing imports them — deleting them removes 5 of the kit's importers and the
`st-modals`/`sabcrm-settings-context` fan-in drops to the suite-frame only).

**Comment-only refs (no code dependency):**
`20ui/composites/charts/index.ts:9`, `20ui/composites/record/fields/shared.tsx`
(ported from `twenty-field`, comments only), `20ui/portal-popover.tsx`
(deliberately KEEPS the literal `sabcrm-twenty` class on the portal root —
lines 166-169 — until the kit retires).

**Orphan twenty files (zero external importers) — deletable in P9 with their CSS:**
`automation-builder.tsx/.css`, `markdown.tsx`, `notifications-bell.tsx` +
`notifications.css`, `projects-sidebar-nav.tsx/.css`, `record-detail-tabs.tsx/.css`,
`record-field-panel.tsx/.css`, `st-portal-popover.tsx` (superseded by
`20ui/portal-popover.tsx`), `twenty-app-frame.tsx`, `twenty-app-rail.tsx`,
`twenty-charts.tsx` + `twenty-charts.css`, `use-sabcrm-stream.ts`.
(`twenty-activity.css`, `field-types.css` — check `@import`/`import` chains from
surviving files before removing; prune `index.ts` barrel exports accordingly.)

### 3.3 CSS attrition list

131 CSS files reference `sabcrm-twenty` (3,580 selector hits):
- 75 under `src/components/sabcrm/20ui/**` — the `:is(.20ui,.ui20,.sabcrm-twenty,:root)`
  compat nets (per the 20ui scope-rename fix). **KEEP in P9** — removing the
  class from the net is harmless but removing `.sabcrm-twenty` from the *frame*
  is not (below).
- 26 under `src/app/dashboard/settings/crm/**` — suite settings hub
  (`settings-twenty.css`, `settings-hub.css`, per-page css). Stays until the
  settings hub is re-skinned (post-P9).
- 18 under `src/app/sabcrm/**` — page css for the Twenty record surfaces; dies
  with the flag-off path.
- 11 `src/components/sabcrm/twenty/*.css` — die with their components.
- 1 `src/components/sabcrm/ui20-showcase.css`.
- `20ui/tokens.css` compat: lines 8, 14 (works under BOTH `.20ui`/`.ui20` and
  `.sabcrm-twenty`), 268-269 (portal root carries `ui20 sabcrm-twenty st-popover`).

**Suite-frame root class:** `sabcrm-suite-frame.tsx:396` renders
`` `sabcrm-twenty ui20${…}` `` and the file header (lines 8-14) documents that
every not-yet-migrated `/sabcrm` page + the settings hub styles off that scope.
**Do NOT remove `.sabcrm-twenty` from the frame root in P9.**

### 3.4 Attrition order (P9 does only step 1)

1. **P9:** delete the 5 orphan wrappers + 12 orphan twenty files/css; prune barrel.
2. Flip `NEXT_PUBLIC_SABCRM_RECORD_SURFACE` default to `all`; delete the Twenty
   list/detail branches (`record-detail-tw.tsx`, twenty branch of both pages,
   `view-bar`/`bulk-bar` twenty imports) and the flag itself.
3. Port `sabcrm-outer-shell`, `sabcrm-actors-context`, `twenty-command-menu`,
   `twenty-workspace-switcher`, `sabcrm-settings-context` to 20ui; re-skin
   `dashboard/settings/crm`.
4. Delete the kit directory, the 18 `app/sabcrm` twenty css files, drop
   `sabcrm-twenty` from `sabcrm-suite-frame.tsx:396`, `20ui/portal-popover.tsx`,
   and finally thin the `:is()` compat nets + tokens.css lines.

---

## 4. Execution order for the build agent

A. `src/proxy.ts` redirect block (§2.8) — ship first so links never 404.
B. Nav edits (§2.7, sites 1-7).
C. Delete `src/app/dashboard/crm/**`.
D. Delete the 80 actions (+types/.patch) with the §2.2 gate-grep per file;
   delete `actions/crm/contracts.actions.ts`; delete §2.4 lib files;
   delete §3.2 orphan components.
E. Rust: remove unmount-candidate `.nest("/v1/crm/…")` lines + unused `let`
   bindings + their rust-client files, per-mount gate (§2.3).
F. Verify:
   - `grep -rn "dashboard/crm" src --include='*.ts*' | grep -v '20ui-domain\|crm/command-palette\|lineage-rail\|entity-picker\|keyboard-shortcuts\|search-types\|email-templates\|sab-file-picker\|msme-45-day'` → only the documented deep-link stragglers.
   - `NODE_OPTIONS=--max-old-space-size=16384 npx tsc --noEmit` (tsc OOMs <12GB — known).
   - `cargo check` in `rust/` — no unused-variable warnings in `crates/api`.
   - Sabbigin smoke: `/dashboard/sabbigin` home, contacts list/new, companies,
     deals (stage move), pipelines (KPIs + CSV export), products,
     settings/fields, settings/forms — all backed by the §1 keep chain.
   - Suite smoke: `/sabcrm` home, `/sabcrm/finance/invoices`, sabdesk SLA +
     reply-templates pages (the §2.2 flip files).
G. `graphify update .` is currently broken (recursion bug) — skip, note in PR.

## 5. Risks

- Quote-style grep blindspot: any future re-run of the classification MUST use
  `['\"]`-style patterns; the 5 §2.2 flips were invisible to single-quote greps.
- `dashboard-config.ts` ↔ `rbac-server.ts` coupling: trimming crm nav entries
  may shrink a derived permission-key set; verify before deleting `'crm_*'` keys.
- Hidden-but-alive modules (hrm/seo/sabwa) import ~60 shared crm actions —
  deleting "one more" action beyond the 80 breaks their builds even though
  they're invisible in nav.
- `lib/sabflow/recipes/*` hardcode `/api/crm/...` URLs — keep all §2.5 routes.
- Multiline `.nest(` extraction: any tooling that greps router mounts
  single-line will undercount (14 mounts wrap); use the perl one-liner.
- Mongo data is shared between legacy and the suite/sabbigin (same
  collections, e.g. `crm_pipelines`, `crm_activities`) — P9 is code-only; no
  migrations, no collection drops.
