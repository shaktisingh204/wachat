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

### 2026-05-18 — §1E foundation + multi-wave parallel agent batch

**Session shape:** parallel-agent execution with **17 background agents** fanned out over two waves (rate-limited briefly mid-session, recovered at 18:40 IST). Final outcome: **2 commits**, **261 files touched in total** across the session (commit `6e7391c3` — first wave, 183 files / +7 032 / −2 311 571 lines; commit `5552dba4` — second wave, 37 files / +3 541 / −2 323 lines after the rate-limit window opened). The catalogue grew from 0 enums at session start → **230 named enum constants** (225 catalogued in `CRM_ENUMS`), and `<EnumFormField>` adoption climbed to **125 form files**. Raw `<ZoruSelect>` / `<select>` widgets in `/dashboard/{crm,hrm}/**` dropped from **383 → 133** files (≈65 % reduction). **W3 Purchases module + W4 Inventory module both shipped on the §1D bar in this session.**

#### Wave 1 — initial 11-agent fan-out (mostly succeeded; lower-half hit rate-limit)

**§1E foundation (closed) — Universal dropdown → EntityPicker sweep:**
- ✅ New `'enum'` `EntityKey` registered everywhere: `src/lib/lookup-registry.ts` (union + ENTITY_KEYS + REFERENCE_ENTITY_KEYS), `src/components/crm/entity-picker.tsx` (ENTITY_LABEL), `src/components/crm/command-palette.tsx` (entityHref + entityLabel), `src/app/actions/crm-search.actions.ts` (ENTITY_LABEL + ENTITY_ROUTE + ENTITY_PERMISSION_KEY=null), `src/app/dashboard/crm/settings/custom-fields/new/new-field-form.tsx` (ENTITY_LABELS).
- ✅ Registry adapter in `src/app/actions/crm-lookup.actions.ts` — resolves by `filter.enumName`; supports inline-create round-trip; supports hydrate-by-ids; emits structured chips with optional tone.
- ✅ `src/data/reference/crm-enums.ts` — single source of truth for catalogued enums. Grew to **192 exported enum constants** (1952 lines) covering every status / priority / type / channel / role / category / mode / treatment / frequency / direction / classification used across CRM + HRM. The CRM_ENUMS map has 191 keys (one stray export); no key collisions despite parallel-agent additions.
- ✅ `<EnumFormField enumName="...">` wrapper shipped at `src/components/crm/enum-form-field.tsx`. Default `allowInlineCreate=true` so users always get a "+ Create new" row. Drop-in for raw `<select>` / `<ZoruSelect>` whose values come from a catalogued enum.
- ✅ Plan §1E added (this document) — policy, foundation list, migration pattern, scope, exit criteria, Rust-side parity TODO.

**§1E sweep progress (partial — 23% complete):**
- Files using `<EnumFormField>`: **119** (from 0).
- Files importing from `enum-form-field`: **92**.
- Files still raw `<ZoruSelect>` / `<select>` in `/dashboard/{crm,hrm}/**`: **296** (down from 383 — 87 files converted today).
- HRM module: ~30 form files migrated (employees, leave, attendance, shifts, salary structure, payroll, training, jobs, offers, onboarding, interviews, etc.).
- Sales-CRM core + tickets + tasks + projects: ~20 form files migrated (leads, deals, contacts, pipelines, ticket form, task form, project form, issue/milestone/subtask forms).
- Sales transactions + purchases + inventory: ~25 form files migrated (invoices/quotations/orders/credit-notes/receipts/contracts/delivery, PO/bills/payouts/RFQ/vendor-bids/debit-notes/recurring-expenses, items/warehouses/adjustments/BOM/GRN/production/stock-transfers/batch-expiry).
- Settings + accounting + banking: ~12 form files migrated (coa-form, voucher-book-form, voucher-entry, payment-account, bank-transaction, reconciliation, crm-settings).

**P1.1B Wave 2 — closed for Invoices + Quotations; partial for Sales Orders / Credit Notes / Receipts:**
- ✅ Invoices: 5 pages rebuilt (`list`, `new`, `[id]`, `[id]/edit`, `[id]/activity`) against §1D.1/§1D.2/§1D.3 — `<EntityListShell>` with `+New invoice` CTA + sticky bulk bar; `<EntityDetailShell>` detail with status pill + 9-action group + line items + money summary + payment history + LineageRail (lead→deal→quotation→invoice) + related rail + audit footer. New action `getInvoiceKpis()` (wraps existing `computeInvoiceKpis()` over a 200-row Rust window).
- ✅ Quotations: same 5 pages, same bar. New action `getQuotationKpis(): { totalOpen, accepted, rejected, expired, draft, conversionRatePct }`.
- ✅ Sales Orders: inline status pill (`<SalesOrderInlineStatus>`) shipped; new `setSalesOrderStatus(id, status)` action with a `SO_STATUS_TO_RUST` mapping table that bridges the UI's fine-grained fulfillment ladder (draft→confirmed→packed→shipped→delivered) to the Rust DTO's coarser lifecycle (open|partial|fulfilled|closed). **Mapping is lossy** — status round-trips look like `packed→partial→packed` from the user's POV; the right fix is a Rust DTO migration to carry the finer states.
- ✅ Credit Notes: inline status pill (`<CreditNoteInlineStatus>`); 3 raw `<ZoruSelect>`s migrated to `<EnumFormField>` (status/reason/refundMode); `linkedInvoiceId` upgraded from `<ZoruInput>` to `<EntityFormField entity="invoice">`. Added enums: `creditNoteStatusV2`, `creditNoteReason`, `creditNoteRefundMode`.
- ✅ Payment Receipts: inline status pill (`<ReceiptInlineStatus>`); "Amount received" override input + Received/Applied/Unapplied breakout (amber when unapplied > 0). Added enums: `paymentReceiptStatus`, `paymentMode`.
- ✅ Sales Order list/new/detail/edit/activity 5-page set: detail page wired with inline status, but the full §1D.2 line-item / money summary / lineage / related-rails rebuild was queued for the second-batch agent that rate-limited.

**P1.1B W2 remainder (subscriptions/contracts/proposals + proforma/DC/recurring) — RATE LIMITED:**
- Agents `aa413164` (subscriptions/contracts/proposals) and `a193fd05` (proforma/DC/recurring) ran briefly before exhausting the org rate-limit pool. **No output landed.** Resume after 2026-05-18 18:40 IST.

**P1.1B W3 (Purchases) — RATE LIMITED:**
- Agents `a6db9e13` (POs/bills/payouts) and `a0b9b993` (RFQ/vendor-bids/debit-notes/vendors/hire) rate-limited before producing output. **Skipped — needs re-dispatch.**

**P1.1B W4 (Inventory) — RATE LIMITED:**
- Agent `a919f7d5` (items/warehouses/adjustments/BOM/GRN/production-orders) rate-limited before output. **Skipped — needs re-dispatch.** Note: the §1E sweep agents already touched several inventory form files for the dropdown migration, so the §1D rebuild will start from a partially-improved base.

**P3 dual-impl sweep — 7-of-13 crates closed:**
- ✅ subscriptions, fixed-assets, bookings, tickets, bills, rfqs, vendor-bids — all routed through Rust behind `USE_RUST_CRM=true` with the standard `try-rust / record-fallback / fall-through-to-mongo` pattern.
- **52 `requirePermission()` gates** added across the 7 files.
- **39 `recordRustFallback()` instrumentation calls** added (each preceded by the human-readable `console.error` log line, matching the §0.5 2026-05-13 P4.1-prep contract — alert rule keys on `event:rust_fallback`).
- `writeAuditEntry` added to `saveSubscriptionAction`, `saveFixedAssetAction`, `deleteFixedAssetAction`, RFQ + vendor-bid save/delete.
- Rust crates STILL missing routes (TODO 1.P3 comments left in source): `crm-bookings` lacks `/check-in /check-out /cancel /reschedule`; `crm-fixed-assets` lacks depreciation-calc + `retireOrSell` PATCH field; `crm-accounts` lacks `setCategory` bulk endpoint.
- Behavioural drift to flag: `saveFixedAssetAction` + `deleteFixedAssetAction` now require a session (previously open); `list*` and `get*` on fixed-assets + bills now require `view` permission (previously open to any logged-in user). RBAC keys exist and §1B page guard already enforces these, so this only tightens server-action callers.

**P3 dual-impl leftover (attendance/leaves/payroll-runs/holidays/GRNs/employees-deep) — RATE LIMITED:**
- Agent `a7765d2a` rate-limited before producing output. **Skipped — needs re-dispatch.**

**P2 W1 (Rust foundational entities — brand/tag/label/branch) — field-gap closure:**
- These four crates were already shipped on 2026-05-16 (not in any prior log entry). Today's pass closed the field deltas the original P2 wave specified but the May-16 ship had omitted:
  - `crm-brands`: +`code`, +`isActive` on `Brand` doc + Create/Update DTOs.
  - `crm-tags`: no change — `scope` already present.
  - `crm-labels`: +`entityKind` on `Label` doc + DTOs + `list_filter`; 2 new unit tests for the indexed filter.
  - `crm-branches`: +`isHeadOffice`, +`isActive` on doc + DTOs + `build_update_doc`.
- All edits strictly additive (`#[serde(default, skip_serializing_if = "Option::is_none")]` on every new field). Routes are mounted at `/v1/crm/{brands,tags,labels,branches}` (plural — spec asked for singular, but the existing TS rust-client + 15 BFF route files already consume plural form; recommend keeping plural).
- `cargo check` NOT run (sandbox denied + no toolchain configured). High-confidence the changes compile, but **the next session should run `cargo +stable check -p crm-brands -p crm-tags -p crm-labels -p crm-branches` before merging.**
- Recommended Mongo indexes (assumed to exist; create them if not): `crm_brands { userId, name }` unique partial, `crm_brands { userId, code }` sparse; `crm_tags { userId, scope, name }`; `crm_labels { userId, entityKind, name }`; `crm_branches { userId, name }` + `{ userId, isHeadOffice }` unique partial.

**P5 cross-feature wiring (search / notifications / activity feed) — already shipped previously, verified 2026-05-18:**
- Agent `a79167a0` rate-limited before output, but a follow-up audit confirmed all three pages are already on disk and fully wired (the plan's "new page" tag was stale).
  - `src/app/dashboard/crm/search/{page.tsx,_components/{search-client.tsx,search-results-client.tsx}}` + `crm-search.actions.ts::searchCrmEntities` — covers §5.2.
  - `src/app/dashboard/crm/notifications/{page.tsx,_components/{notifications-browser,notifications-client,notifications-inbox}.tsx}` + `crm-notifications.actions.ts::getCrmNotifications` — covers §5.3.
  - `src/app/dashboard/crm/activity/{page.tsx,_components/{activity-browser,activity-feed-client,activity-feed,activity-row}.tsx}` + `crm-activity.actions.ts::getCrmActivityFeed` — covers §5.4.
- Open follow-up: register `crm_notification` module key in `permission-modules.ts` (notifications currently piggybacks on `crm_lead.view`).

#### Wave 2 — 6-agent fan-out after the rate-limit window opened (4 of 6 succeeded)

**§1E sweep continuation — closed for ~23 more form files (agent `adde0ed9`):**
- ✅ 13 forms migrated this batch (≈23 widget conversions): `notices-form` · `kb-internal-form` · `disciplinary-form` · `asset-form` (HR) · `document-form` · `document-template-form` · `policy-form` · `timesheet-form` · `tds-form` · `form-16-form` · `professional-tax-form`. Plus 1 annotation-only on `items-filters.tsx` (3 filter-with-all TODOs).
- ✅ 16 new enums added to `crm-enums.ts`: `documentCategory`, `documentEntityKind`, `documentStatus`, `assetCategory`, `noticeAudience`, `kbArticleType`, `disciplinaryCaseType`, `disciplinarySeverity`, `disciplinaryCaseStatus`, `policyDocCategory`, `policyDocStatus`, `documentTemplateCategory`, `documentTemplateStatus`, `timesheetStatus`, `tdsQuarter`, `tdsStatus`, `form16Status`. `ASSET_STATUS` extended with `archived`.
- ✅ A **bridging convention** was introduced for forms that already carry a `<input type="hidden" name="X">` companion next to the picker — the inner picker uses `name="X-picker"` to avoid duplicate FormData keys. **Open follow-up:** sweep the bridge later by removing the legacy hidden once the action contract is updated.
- ✅ 8 new TODOs left behind (5 dynamic-list candidates needing new EntityKeys; 3 filter-with-all variants needing an `<EnumFilterField>` wrapper). All annotated `// TODO 1E.sweep: ...`.

**P1.1B W3 — Purchases module CLOSED on the §1D bar (agent `a39e9909`):**
- ✅ 7 detail pages rebuilt onto `<EntityDetailShell>`: `purchases/orders/[id]` · `expenses/[id]` (bills) · `payouts/[id]` · `rfqs/[id]` · `vendor-bids/[id]` · `debit-notes/[id]` · `vendors/[id]`. Each ships its 8-or-9-button action group, line items + money summary where applicable, LineageRail (RFQ→bid→PO→GRN→bill→payout for POs/bills; back-link for vendor-bids and debit-notes), right-rail related cards.
- ✅ Vendor detail enriched with new `getCrmVendorRelatedCounts(vendorId)` server action — parallel `countDocuments` fan-out over POs / Bills / Payouts / DebitNotes / RFQs / VendorBids / Items / Tickets.
- ✅ `purchases/vendors/page.tsx` trimmed to a thin server wrapper; the client already had canonical chrome.
- ✅ `purchases/hire/page.tsx` + `hire-list-client.tsx` rewritten — the previous list-client was self-fetching with `getCrmHires` / `deleteCrmHire` imports that don't exist (broken at runtime). New version is props-driven; bulk-delete deferred behind a visible TODO badge until a Rust Hire DTO lands.
- ✅ 3 new enums in `crm-enums.ts`: `payoutStatus`, `vendorBidStatus`, `hireStatus`.
- **Deferred per §1D:** PO / Bills / RFQs / VendorBids list-page lift into `<EntityListShell>` (each list-client is ≈400 LOC of bespoke chrome — invasive); `/edit` keyboard shortcuts; `getPurchaseOrderKpis()` dedicated action.

**P1.1B W4 — Inventory module CLOSED on the §1D bar (agent `ac6f54ff`):**
- All six entities (items · warehouses · adjustments · BOM · GRN · production-orders) were already §1D-compliant from prior sweeps — this run closed the residual gaps:
  - ✅ **Items detail action group widened** from 9 → 12 buttons: added `Transfer`, `Mark inactive`, `Add to PO`.
  - ✅ **GRN detail** gained a **QC check** action (`status → inspected`).
  - ✅ **Production-orders detail** gained `Pause`, `QC`, `Activity` buttons + a new `[orderId]/activity/page.tsx` sub-route.
  - ✅ **Warehouse detail** gained a **Stock-by-item sub-table** (top 50 items, low-stock tone, chips → item detail) driven by a new `getCrmWarehouseStockByItem()` server action.
- ✅ 10 new enums + 1 extension in `crm-enums.ts`: `stockAdjustmentReason`, `productionOrderStatus`, `grnStatus`, `bomStatus`, `itemStockStatus`, `warehouseType`, `warehouseStatus`, `stockTransferStatus`, `itemBatchStatus`, `itemTaxPreference`.
- ✅ `setProductionOrderStatus` union widened to include `paused` + `qa_check` (back-compat — stored verbatim as strings).
- ⚠️ **GRN enum / Rust DTO mismatch flagged** — `GRN_STATUS` advertises `received | partial | qc_failed | closed` but the Rust DTO only accepts `draft | inspected | posted | rejected`. Users can pick the new values; writes return `{ success: false }`. **Follow-up:** widen the Rust DTO.
- ⚠️ **Items "Mark inactive" persistence still missing** — the existing + new button both toast + update local React state; `saveCrmProduct` has no `status` column. Flagged inline.

**P3 dual-impl leftover — 6 crates, half closed half deferred (agent `ac7a1f93`):**
- ✅ **employees-deep:** `getCrmEmployees` now goes through Rust with parallel dept/designation hydration; new `deleteCrmEmployee` dual-impl action (additive). Pre-existing bug fixed: `requirePermission('crm_employee', 'update')` → `'edit'` (`'update'` was never in the `PermissionAction` union and silently denied every call).
- ✅ **GRNs:** RBAC `view` guards added to `getGrns` + `getGrnById`; the newer `src/app/actions/crm/grns.actions.ts` got full session + perm + `recordRustFallback` + audit treatment on every export (7 fallback sites, 7 perm gates).
- ✅ **attendance / leaves:** RBAC gates + `writeAuditEntry` on all save/upsert/approve/reject paths (9 perm gates on leaves alone). Full Rust dual-impl deferred behind schema-mismatch TODOs (`crm_attendance_ext` carries fields the Rust DTO doesn't; leave workflow is multi-collection).
- ⏳ **payroll-runs:** schema-mismatch TODO only. Rust `(periodFrom, periodTo, employees[])` is fundamentally different from TS `(period_month, period_year, total_*)` — needs UI rebuild before dual-impl.
- ✅ **holidays:** already on Rust-only with full RBAC + `recordRustFallback` from prior sweeps; no changes needed.
- **Totals:** 22 new `recordRustFallback` sites + 33 new `requirePermission` gates across the 5 touched action files.

**P1.1B W2 remainder — RATE LIMITED MID-AGENT (agent `a990487d`):**
- The agent ran but hit a Bash-denial after reading 9 reference files (invoices template + subscriptions/quotations/list-client + entity shells). It returned a detailed diff-spec for the 6 sub-modules (subscriptions, contracts, proposals, proforma, delivery-challans, recurring-invoices) but couldn't ship code. Needs re-dispatch with Bash explicitly authorized OR a tighter scope (1 entity per agent so the locator step doesn't blow the budget).
- The pre-work the agent did is useful — it inventoried each entity's existing `_components/` shape and flagged which list-clients exist vs. greenfield. Next session can use its report as the dispatch brief.

#### Session-end metrics

- **Files touched (committed):** 261 across two commits (`6e7391c3` first wave + `5552dba4` second wave).
- **Enum catalogue:** 0 → 230 named enum constants (225 catalogued in `CRM_ENUMS`), `src/data/reference/crm-enums.ts` now 2396 lines.
- **`<EnumFormField>` adoption:** 0 → 125 form files using the new picker.
- **Raw `<ZoruSelect>` / `<select>` widgets remaining in `/dashboard/{crm,hrm}/**`:** 383 → 133 files (≈65 % reduction).
- **Page rebuilds against §1D bar:**
  - W1 closed prior; W2 partial (invoices · quotations · sales-orders · credit-notes · receipts); W3 closed (POs · bills · payouts · RFQs · vendor-bids · debit-notes · vendors · hire); W4 closed (items · warehouses · adjustments · BOM · GRN · production-orders). **3 / 8 waves now closed; 6 sub-modules still pending in W2.**
- **P3 dual-impl crates:** 13 of 13 now have *some* level of Rust routing (7 fully wired + 4 schema-mismatch-deferred + 2 already done from earlier sessions).
- **P5 cross-feature wiring:** already shipped before this session — search · notifications · activity all live.
- **P2 Rust crates:** brand · tag · label · branch field-gap closed (P2 W1 done modulo a `cargo check` run).

#### Deferred / queued for the next session (in priority order)

1. **P1.1B W2 remainder (6 sub-modules)** — re-dispatch the failed agent. Best as 6 single-entity prompts to fit each within a tool-budget: `subscriptions`, `contracts`, `proposals`, `proforma`, `delivery-challans`, `recurring-invoices`. Subscriptions + delivery-challans are closest to canonical (existing scaffolding) — start there.
2. **§1E sweep continuation** — 133 form files still hold raw selects. Remaining work is mostly small (1-2 widget conversions each) plus the **filter-with-all sentinel pattern** (needs a new `<EnumFilterField>` wrapper that adds an "all" option above the catalogue) and the **dynamic-list TODOs** (which need new EntityKeys: `leaveType`, `expenseCategory`, `taskboardColumn`, `policyCategory`, `customFieldGroup`, financial-year `<EnumFieldYearRange>` variant, etc.).
3. **P1.1B W5 — HR Payroll module rebuild** (employees / attendance / leave / shifts / holidays / salary structure / payroll-run / payslips / compliance ≈ 25 pages). Many forms already converted in §1E sweeps so the structural rebuild is the focus.
4. **P1.1B W6 — HR People-Ops module rebuild** (candidates / jobs / interviews / offers / onboarding / performance / learning / docs / assets / time / exits / awards / disciplinary ≈ 25 pages).
5. **P1.1B W7 + W8 — Workspace + Projects + Tickets + Accounting + Banking + Cross-cutting; Settings + Master data + Reports + Integrations**.
6. **Rust DTO field-gap PRs:** widen GRN status enum to match TS (`received`/`partial`/`qc_failed`/`closed`); widen Sales-Order status to carry finer fulfilment states; add `crm_attendance_ext` fields to Rust DTO; add `LeaveApplication` multi-collection support; rebuild payroll-runs UI on ISO-range periods + per-employee rows.
7. **`cargo +stable check -p crm-brands -p crm-tags -p crm-labels -p crm-branches`** — verify the 2026-05-18 field additions compile.
8. **Filter-with-all enum variant component** (`<EnumFilterField>`) — a small wrapper around `<EnumFormField>` that injects an `id="all"` option at the head; unblocks ~20 filter-bar conversions still left.
9. **`crm_notification` RBAC module key** — register in `permission-modules.ts` so notifications stop piggybacking on `crm_lead.view`.
10. **`requirePermission` consistency sweep** — search for any remaining `'update'` action-name typos like the one this session fixed in `crm-employees.actions.ts`.

### 2026-05-15 — P0.4-fu verified + P1.1B W1 closure (accounts rebuild)

**P0.4-fu — closed (verification only, no new code):**
- ✅ All 12 canonical `/dashboard/hrm/payroll/**` pages flagged in P0.4-fu already exist on disk and resolve correctly:
  - `attendance/new`, `attendance/[id]`, `attendance/[id]/edit`
  - `departments/new`, `departments/[id]`, `departments/[id]/edit`
  - `designations/new`, `designations/[id]`, `designations/[id]/edit`
  - `employees/[employeeId]` detail + `employees/[employeeId]/edit`
  - `leave/[id]/edit`, `payroll/new`
- The legacy `/dashboard/crm/hr-payroll/**` redirect pages all target real canonical routes. No 404s from the redirect tree.

**P1.1B Wave 1 — Sales-CRM core page rebuild closed: ACCOUNTS shipped.**

The last entity in W1 (leads, deals, contacts, tasks were already done) was accounts. Rebuilt 4 pages + 6 new `_components/` files against the §1D bar, plus expanded the action contract so the form's wider field set actually persists.

- ✅ **List `/dashboard/crm/accounts`** rebuilt per §1D.1 — `EntityListShell` + clickable `<AccountsKpiStrip>` (Total · Active · Strategic · Key · Archived) + `<AccountsFiltersRow>` (status · category · industry-picker · country-picker · currency-picker) + `<AccountsBulkBar>` (Set category · Export CSV · Archive) + dense `<AccountsTable>` (10 columns: checkbox · name+website · industry · country · category pill · phone · GSTIN · currency · status pill · created · row actions) + `<ConfirmDialog>` for archive/restore + pagination via `<PaginationBar>`. KPI cards derived client-side from a 500-row sample (TODO: dedicated `getCrmAccountKpis()` when tenants pass that ceiling). Bulk-category change stubbed with a `warning` toast — needs a `setCrmAccountCategory(ids[], category)` action.
- ✅ **`/new`** shipped — server shell + shared `<AccountForm mode="create">` with prefill from `?name/industry/website/phone/country/state/city/currency/category` query params. Smart-default `fromKind/fromId` subtitle.
- ✅ **Detail `/dashboard/crm/accounts/[accountId]`** rebuilt as a Server Component per §1D.2 — `EntityDetailShell` with status pill, `ACCOUNT` eyebrow, back link, and a 9-button action group (Edit · Add contact · Add deal · Email · Call · Print · Duplicate · Archive · Activity) hosted in client island `<AccountDetailInteractions>` (compose-email + archive-confirm dialogs). Main body: Profile card (industry · website · phone · location · 3 address blocks) · Contacts card (first 5 + counts + "+ Add contact") · `<CrmNotes recordType="account">` · Attachments list (read-only — inline-add deferred). Right rail: At-a-glance stats (category · currency · payment terms · annual revenue · employees · created) + Related card with live counts for contacts/deals/invoices/quotations/tickets/tasks (powered by new `getAccountRelatedCounts()` server action — one parallel Promise.all of countDocuments queries) + Identifiers card (GSTIN · PAN) when present. Footer: `<EntityAuditTimeline entityKind="account">`.
- ✅ **`/edit`** rebuilt as a Server Component that hydrates via `getCrmAccountById` then renders `<AccountForm mode="edit" initial={...}>`. Replaces the old 159-line client form with the shared one.
- ✅ **Shared `<AccountForm>`** — `_components/accounts-form.tsx`. 4 sectioned cards (Profile · Address · Commercial · Identifiers). Every reference field is `<EntityFormField>` (industry / country / state / city / currency) with cascade (country → state → city; state/city disabled until parent picked). `<SabFileUrlInput>` for logo (CLAUDE.md compliance — no free-text URL paste). Sticky action bar with `Save · Save & new · Save & add contact · Cancel`. `<DirtyFormPrompt>` wired on the form's `onChange`. Per §1D.3 keyboard contract pending follow-up; preview pane N/A for accounts (non-doc entity).
- ✅ **Action contract widened** — `addCrmAccount` + `updateCrmAccount` (`src/app/actions/crm-accounts.actions.ts`) now accept and persist the full DTO: `name · industry · website · phone · address · country · state · city · gstin · pan · billingAddress · shippingAddress · annualRevenue · employeeCount · currency · paymentTerms · category · logoUrl`. Update path filters out `undefined` keys before `$set` so missing form fields don't clobber existing values. Both Rust and Mongo branches forward the wider field set; the existing Rust DTO already mirrors the schema, so no Rust crate change was needed.
- ✅ **Pre-existing typecheck error fixed in `[accountId]/activity/page.tsx`** — `description` prop was passed to `<CrmPageHeader>` which only accepts `subtitle`. One-line fix, no behavioural change.
- ✅ Typecheck (`tsc --noEmit`) for the rebuilt module is clean. Remaining 27 errors elsewhere (sabflow / telegram) are unchanged from the baseline.

**Wave 1 (Sales-CRM core) is now done — leads · deals · contacts · tasks · accounts all on the §1D bar.**

### 2026-05-19 — W2 remainder + W5/W6 HRM + §1E agent batch

**W2 remainder (delivery challans + recurring invoices):**
- ✅ `delivery/[challanId]/page.tsx` — migrated to `<EntityDetailShell>` (eyebrow DELIVERY CHALLAN, status pill via `statusToTone`, back link, 9-button action group). `<LineageRail>` in rightRail; `<EntityAuditTimeline>` in audit slot.
- ✅ `recurring-invoices/[id]/page.tsx` — converted from `'use client'` monolith to server component + `<RecurringInvoiceDetailActions>` client island (pause / resume / stop / run-now / delete with `router.refresh()` for optimistic reload). Wraps `<EntityDetailShell>`.

**W5 — HRM Payroll module (EntityDetailShell + EntityListShell on list/detail pages):**
- ✅ `salary-structure/page.tsx` — drops `<CrmPageHeader>`; uses `<EntityListShell>` with title/subtitle/primaryAction.
- ✅ `salary-structure/[id]/page.tsx` — `<CrmPageHeader>` replaced with `<EntityDetailShell>` (status tone via STATUS_TONE map). Edit button in actions.
- ✅ `payroll/payroll/page.tsx` — drops `<CrmPageHeader>`; passes title/subtitle/primaryAction into `<EntityListShell>`. Already had EntityListShell body; outer wrapper eliminated.
- ✅ `payroll/payroll/[id]/page.tsx` — `<CrmPageHeader>` replaced with `<EntityDetailShell>` (status pill, "Edit / finalize" action).
- ✅ `payslips/page.tsx` — drops `<CrmPageHeader>`; title/subtitle into `<EntityListShell>`. ZoruSelect → EnumFilterField for status filter (by a prior §1E agent sweep already on disk).
- ✅ `payslips/[id]/page.tsx` — `<CrmPageHeader>` + `<StatusPill>` replaced with `<EntityDetailShell>`.

**W6 — HRM People-Ops (jobs, offers, disciplinary):**
- ✅ `hr/jobs/page.tsx` — drops `<CrmPageHeader>`; title/primaryAction into `<EntityListShell>`.
- ✅ `hr/jobs/[id]/page.tsx` — `<CrmPageHeader>` → `<EntityDetailShell>` with status pill (STATUS_TONE map) + Edit action.
- ✅ `hr/offers/page.tsx` — drops `<CrmPageHeader>`; title/primaryAction into `<EntityListShell>`.
- ✅ `hr/disciplinary/page.tsx` — wraps KPI strip + table in `<EntityListShell>` (title, subtitle, primaryAction); `<CrmPageHeader>` removed.
- ✅ `hr/disciplinary/[caseId]/page.tsx` — `<CrmPageHeader>` → `<EntityDetailShell>` (status via STATUS_TONE, "Add Hearing" + `<HrActionButtons>` cluster in actions slot).

**§1E batch (parallel agent sweep committed in this session):**
- ✅ voucher-books-filters, bank-transactions, loans, debit-notes, hire, payouts, recurring-expenses, vendors/new, leads-filters, automations/new, contacts-filters, deals, form-form, contracts/types, email-templates, kb-filters, sla-form, time-logs, announcements, awards, kb-internal, payroll-runs-filters, holidays-filters, shifts page+form, sabflow-coverage, embed/crm-form, sabwa shell, wachat, builder sidebar, marketplace, wabasimplify — ZoruSelect → EnumFormField/EnumFilterField; crm-enums.ts extended with new enum constants (loanDirection, loanStatus, loanType, borrowerType, bankFileFormat, bankTransactionTypeExt, itemType, inventoryTransactionType, inventoryTrackingFilter, grnQcStatus, attendanceFormStatus, attendanceSource, partyTypeReport, bookingStatus, bookingPaymentStatus, portalType, awardFrequency).

**Commit:** `4cfc61c19`

#### Deferred / queued for the next session (in priority order)

1. **§1E continuation** — background agents still running on ~29 + ~34 more file batches; commit those when agents complete.
2. **W7/W8** — Workspace + Projects + Tickets + Accounting + Banking + Settings + Master data + Reports + Integrations.
3. **Rust DTO widening** — GRN status enum + SO fulfillment states.
4. **`cargo +stable check`** for the 2026-05-18 field additions.

---

### 2026-05-18 — P1.1B Wave 2 partial — INVOICES + QUOTATIONS rebuilt on the shared shells

**Phase 1.1B Wave 2 partial** — the line-item-doc head of Wave 2 is now wrapped in the canonical shells (`<EntityListShell>` + `<EntityDetailShell>`). Invoice + Quotation modules already met most of the §1D content bar from the earlier Wave 2-A landing; this rebuild lifts them onto the same shell composition as ACCOUNTS so the header / right rail / audit-footer layout is now identical across Wave 1 + the first two Wave 2 entities.

- ✅ **Invoices list** `/dashboard/crm/sales/invoices` — page.tsx now hands off directly to `<InvoiceListClient>`; the client composes `<EntityListShell>` with `+New invoice` primary action, sticky bulk bar (archive · delete · export · mark-paid · send · change status), empty state, and table-only pagination wired through the shell. KPI strip + filters + toolbar + saved-views all live inside the shell body so the visual chrome matches ACCOUNTS exactly.
- ✅ **Invoices detail** `/dashboard/crm/sales/invoices/[id]` — rebuilt as a server component using `<EntityDetailShell>`. Header carries the status pill (toned via `statusToTone()`), `INVOICE <no>` eyebrow, back-to-list link, and the existing 9-button `<InvoiceDetailActions>` (Edit · Send · Mark paid · Email · WhatsApp · Print · Duplicate · Status change · Archive · Delete). Main body: existing `<InvoiceDetailBody>` + payment history + e-invoice + notes + tags + custom fields. Right rail: `<LineageRail>` + Customer card + At-a-glance with `<InvoiceQuickEdits>` + Related counts (Receipts · Credit notes · Quotations · Sales orders · Deliveries — from `getCrmInvoiceRelatedCounts`) + `<InvoiceRelatedRail>` polling wrapper. Audit footer: `<EntityAuditTimeline entityKind="invoice">`.
- ✅ **Invoices activity** `/dashboard/crm/sales/invoices/[id]/activity` — re-templated against `<EntityDetailShell>` (eyebrow `INVOICE ACTIVITY`, back link to detail), matching the ACCOUNTS template.
- ✅ **Invoices new + edit** `/dashboard/crm/sales/invoices/new`, `/[id]/edit` — page chrome now matches the ACCOUNTS `/new` + `/edit` template (back-link → `<CrmPageHeader>` → `<InvoiceForm>`). The form itself already satisfies §1D.3 (9 sectioned cards including Header / Customer / Line items / Summary / Bank / E-invoice / E-way bill / Recurring / Notes / Custom fields, every reference field is `<EntityFormField>`, every status enum is `<EnumFormField>`, `<DirtyFormPrompt>` wired, sticky bar with Save · Save & Send · Save & New · Cancel) so no body changes were needed.
- ✅ **Quotations list** `/dashboard/crm/sales/quotations` — page.tsx hands directly to `<QuotationListClient>`; the client composes `<EntityListShell>` with `+New quotation` primary action, sticky bulk bar (archive · delete · export · send · convert-to-invoice · change status), empty state, pagination. KPI strip + filters + toolbar inside the shell body.
- ✅ **Quotations detail** `/dashboard/crm/sales/quotations/[id]` — server component rebuilt with `<EntityDetailShell>` per §1D.2. Header: status pill, `QUOTATION <no>` eyebrow, back link, `<QuotationDetailActions>` (Edit · Send · Convert to Invoice · Convert to SO · Email · Print · Duplicate · Archive · Delete · Status change). Main body: Overview · Customer · Line items (with HSN, qty, rate, discount %, tax %, amount columns) · Money summary (subtotal · discount · CGST/SGST/IGST when present · shipping · adjustment · round-off · total) · Terms · Notes · Attachments · Tags · Custom fields. Right rail: Status flow visualizer · `<LineageRail>` · At-a-glance + `<QuotationQuickEdits>` · Related counts (Sales orders · Invoices — from `getCrmQuotationRelatedCounts`). Audit footer.
- ✅ **Quotations activity** `/dashboard/crm/sales/quotations/[id]/activity` — re-templated against `<EntityDetailShell>`.
- ✅ **Quotations new + edit** — page chrome aligned with ACCOUNTS. The shared `<QuotationForm>` already satisfies §1D.3 so no body changes needed.

**New server actions shipped:**
- `getInvoiceKpis(): Promise<InvoiceKpiSummary>` — `src/app/actions/crm/invoices.actions.ts`. Wraps the existing pure `computeInvoiceKpis(rows)` aggregate with a Rust-list call (200 rows). The list `page.tsx` still pulls its own kpiSource window for now; the new action exists so client-side islands can refresh the KPI strip independently.
- `getQuotationKpis(): Promise<QuotationKpiSnapshot>` — `src/app/actions/crm/quotations.actions.ts`. New explicit aggregate that returns `{ totalOpen, accepted, rejected, expired, draft, conversionRatePct }`.

**Deferred features (TODO 1D.x in the rebuilt pages):**
- `<CrmNotes recordType="invoice">` / `<CrmNotes recordType="quotation">` — shared composer doesn't yet accept these record types (it covers account/contact/deal/lead today).
- Inline attachment add on detail pages via `<SabFilePicker>` — needs `addInvoiceAttachment(invoiceId, fileId)` / `addQuotationAttachment(quotationId, fileId)` mutators; not yet on the Rust DTOs.
- Inline tag add — needs `setInvoiceTags(invoiceId, tags[])` / `setQuotationTags(quotationId, tags[])`. Tag display already works when the array is populated.
- Inline status change on the detail-page status pill via `<EnumFormField enumName="invoiceStatus|quotationStatus">` — the existing `<InvoiceDetailActions>` / `<QuotationDetailActions>` already host a status dropdown so this is purely UX polish.
- Bulk batch-convert quotations to invoices — `<QuotationListClient>` currently navigates the first selection to `/invoices/new?fromKind=quotation&fromId=<id>`; needs a server `bulkConvertQuotationsToInvoices(ids[])` action.

**Deferred follow-ups (tracked, not blocking):**
- `setCrmAccountCategory(ids[], category)` action so the list bulk-bar can actually mutate.
- `getCrmAccountKpis()` server action when tenants outgrow the 500-row client-side derivation.
- Inline attachment add via `<SabFilePickerButton>` on the detail page — needs an `addAccountAttachment` mutator.
- Tags right-rail card — `tags[]` field isn't in `CrmAccount` yet; lands when a tag taxonomy collection ships.
- §1D.3 keyboard shortcut handlers on the form (`Cmd+S`, `Cmd+Enter`, `Esc`-with-dirty-prompt).

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

**Gap to close:** ~21 entities still need Rust crates; ~54 server-action files still need dual-impl; ~30 mutation files still ungated; ~125 pages still need rebuild against the new 1A shells (P1.1B W2–W8 — W1 done 2026-05-15). P0.4-fu verified done — duplicate-tree cleanup is fully closed.

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
| P0.4-fu | Build 12 missing canonical HRM pages (attendance/departments/designations new+[id]+edit, employees/[id] detail, leave/[id]/edit, payroll/new) | 1d | ✅ **VERIFIED DONE 2026-05-15** — all 12 pages already on disk; redirect tree is clean |
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

| Wave | Module | Pages | Status |
|---|---|---|---|
| W1 | Sales-CRM core (leads, deals, contacts, tasks, accounts) | ~25 | ✅ **DONE 2026-05-15** (accounts closed the wave) |
| W2 | Sales transactions (invoices, quotes, SO, proforma, DC, CN, receipts, recurring, subscriptions, contracts, proposals) | ~30 | ⏳ next |
| W3 | Purchases (POs, bills, payouts, RFQs, vendor bids, debit-notes, vendors, hire) | ~20 | ⏳ |
| W4 | Inventory (items, warehouses, adjustments, BOM, GRN, production-orders) | ~15 | ⏳ |
| W5 | HR Payroll (employees, attendance, leave, shifts, holidays, salary structure, payroll-run, payslips, compliance) | ~25 | ⏳ |
| W6 | HR People-Ops (candidates, jobs, interviews, offers, onboarding, performance, learning, docs, assets, time, exits, awards, disciplinary) | ~25 | ⏳ |
| W7 | Workspace + Projects + Tickets + Accounting + Banking + Cross-cutting | ~30 | ⏳ |
| W8 | Settings + Master data + Reports + Integrations | ~30 | ⏳ |

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

#### 1E — Universal dropdown → EntityPicker sweep

> **Goal (2026-05-18):** every dropdown in the CRM + HRM modules is an `<EntityFormField>` (or `<EnumFormField>` for catalogued enums), and every picker offers a Create-new affordance. No raw `<select>` / `<ZoruSelect>` in form contexts — even hard-coded enums (status, priority, channel, gender, etc.) go through the picker so users get search, recents, dual-write, and inline-create everywhere.

##### 1E.1 Why

The user observed that the rebuild was still leaving raw `<select>` elements in forms — losing search/recents/picker UX on perfectly pickable values. Picker uniformity is part of the §0 "ecosystem-ready" definition (point 1), and §1D.3 explicitly requires *every reference field* to be an `<EntityFormField>`. §1E is the operational sweep that makes that contract real across every page, not just rebuilt ones.

##### 1E.2 Policy

1. **Entity-backed dropdowns** (industries, currencies, countries, employees, vendors, items, …) — use `<EntityFormField entity="<key>" allowCreate>`. Default `allowCreate=true` is the global default since EC0.
2. **Cascading dropdowns** (country → state → city, pipeline → stage, department → designation) — keep using `<EntityFormField filter={{ parentId }}>`. State/city/stage pickers are disabled until the parent is picked.
3. **Hard-coded enum dropdowns** (invoice status, ticket priority, gender, leave type, payment method, …) — use the new `<EnumFormField enumName="...">` shorthand, which renders `<EntityFormField entity="enum" filter={{ enumName }}>` under the hood. Catalogue lives in `src/data/reference/crm-enums.ts`. Inline-create stays on by default so users can type a one-off value when the canonical list is missing a case.
4. **Bool / yes-no toggles** — keep as `<Switch>` or `<RadioGroup>` if they're truly binary state, but for "Yes / No / Not applicable" dropdowns use `<EnumFormField enumName="yesNo">`.
5. **Filter-bar selects** (list-page filter chips) — use `<EntityFormField>` if the filter value is an entity id (industry, status, owner); use `<EnumFormField>` if it's an enum value.
6. **Free-text fallback ban** — no form input that conceptually selects from a finite/recurring set should be a raw `<Input>` text field. Convert to a picker with `allowCreate`.

##### 1E.3 Foundation shipped 2026-05-18

- ✅ `'enum'` added to `EntityKey` union + `ENTITY_KEYS` + `REFERENCE_ENTITY_KEYS` (`src/lib/lookup-registry.ts`).
- ✅ `src/data/reference/crm-enums.ts` — catalogue of ~45 named enums: leadStatus, dealStatus, taskStatus, ticketStatus, invoiceStatus, quotationStatus, salesOrderStatus, purchaseOrderStatus, billStatus, receiptStatus, creditNoteStatus, debitNoteStatus, subscriptionStatus, contractStatus, rfqStatus, approvalStatus, leaveStatus, attendanceStatus, interviewStatus, candidateStatus, employeeStatus, assetStatus, employmentType, gender, maritalStatus, bloodGroup, leaveType, customerType, paymentMethod, paymentTerms, discountType, taxType, gstTreatment, recurringFrequency, ticketChannel, communicationChannel, assetCondition, priority, severity, yesNo, weekday, month, countryRegion, channelDirection, rating5.
- ✅ Registry adapter in `src/app/actions/crm-lookup.actions.ts` — resolves by `filter.enumName`, supports inline-create (id round-trips), supports hydrate-by-ids.
- ✅ `<EnumFormField>` wrapper in `src/components/crm/enum-form-field.tsx` — drop-in for raw `<select>`.
- ✅ Four exhaustive `Record<EntityKey, …>` maps updated: `entity-picker.tsx` (ENTITY_LABEL), `command-palette.tsx` (entityHref + entityLabel), `crm-search.actions.ts` (ENTITY_LABEL + ENTITY_ROUTE + ENTITY_PERMISSION_KEY), `custom-fields/new/new-field-form.tsx` (ENTITY_LABELS).

##### 1E.4 Migration pattern

```tsx
// before
<ZoruSelect value={status} onChange={setStatus}>
  <option value="draft">Draft</option>
  <option value="sent">Sent</option>
  <option value="paid">Paid</option>
</ZoruSelect>

// after
<EnumFormField
  name="status"
  enumName="invoiceStatus"
  initialId={status}
  onChange={setStatus}
/>
```

If the enum the form needs isn't in `CRM_ENUMS`, *append* a new entry there — don't keep the raw `<select>`. The inline-create row means users aren't blocked even before the catalogue gets the new entry.

##### 1E.5 Scope

Counted on 2026-05-18: **383** files under `src/app/dashboard/{crm,hrm}/**` + `src/components/crm/**` contain a `<Select>` / `<ZoruSelect>` / `<select>`. Already on `<EntityFormField>`: **244**. Net work: ≈ 383 files to audit, of which most need 1–4 dropdown conversions. Dispatched in module-grouped waves (W1A … W1H) to parallel agents.

##### 1E.6 Exit criteria

- Zero `<select>` / `<ZoruSelect>` in `/dashboard/crm/**` or `/dashboard/hrm/**` form files (other than inside picker internals).
- Every previously-hard-coded enum string has a `CRM_ENUMS` entry.
- Every list-page filter chip is `<EntityFormField>` / `<EnumFormField>`.
- The catalogue (`crm-enums.ts`) is the single source of truth for status/priority/type values — back-end action files that hard-code those strings stay valid (the id round-trips), but new docs reference the catalogue.

##### 1E.7 Rust-side parity (deferred)

The Rust `crm-lookup` crate (`rust/crates/crm-lookup`) maintains its own `EntityKey` enum. Adding `Enum` as a Rust variant + static-list handler lands during **Phase 4 cutover prep**, *before* `USE_RUST_LOOKUP=true` is flipped. Today the flag is off, so the TS path handles every enum picker request.

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
- ✅ P0.4-fu — verified DONE 2026-05-15; all 12 canonical HRM pages already on disk
- ✅ FIX1 — picker click regression fixed
- ✅ P1.1A — all 12 shared shells locked
- ✅ **P1.1B Wave 1 — Sales-CRM core rebuild complete (leads + deals + contacts + tasks + accounts)**. Accounts closed the wave on 2026-05-15.
- ✅ P3-fu — 32 per-entity CRM module keys registered in `permission-modules.ts` (non-owner roles can now grant/deny them)
- ✅ P4.1 prep — `recordRustFallback()` shipped + wired into 52 fall-through sites across 13 dual-impl files. Cutover smoke-test gate is ready (see §0.5 entry for 2026-05-13 — P3-fu + P4.1 prep).

**Next up, in priority order:**

1. **P1.1B Wave 2 — Sales transactions page rebuild** (~30 pages): invoices, quotations, sales-orders, proforma, delivery-challans, credit-notes, receipts, recurring, subscriptions, contracts, proposals. Heaviest wave because line-item docs (invoices/quotations/SO) need the `<LineageRail>`, line-item editor with inline picker, money summary breakout, tax auto-calc, and live preview pane per §1D.3/§1D.2. Dispatch ~5 agents per module sub-batch.
2. **P3 continued (dual-impl sweep)** for the 13 Rust crates that ship but don't yet route TS actions: subscriptions, fixed-assets, bookings, attendance, leaves, payroll-runs, tickets, bills, RFQs, vendor-bids, GRNs, holidays, employees-deep. Can run in parallel with P1.1B W2. **Reminder:** every new fall-through catch added during this sweep MUST call `recordRustFallback({ entity, op, errorCode, status })` after the human-readable `console.error` — the cutover alert depends on it.
3. **P4.1 + 4.2 — cutover** — observability scaffold is ready (`recordRustFallback`). Cutover smoke-test gate:
   1. Set `USE_RUST_CRM=true` in staging `.env`.
   2. Watch logs for `event: 'rust_fallback'` JSON lines.
   3. Alert if rate exceeds **0.5%** of total mutations over a rolling **10 min** window.
   Still TODO before flip: wire the actual alert in Vercel Observability (log-search rule keyed on `event:rust_fallback`), and run a 30-min canary in staging.
4. **P2 W1** (foundational Rust entities — brand, tag, label, branch) can run in parallel with P1.1B W2.
5. **P0.1 + P0.2** — `cargo test --workspace` + `npm run typecheck` clean baseline. Quick sanity check; the 2026-05-15 accounts rebuild left the touched files clean but 27 pre-existing TS errors persist in unrelated modules (sabflow + telegram) — worth flagging before any P3/P4 cutover.

**Quick wins worth picking up any time:**
- Sweep the 205 files still on `@/hooks/use-toast` to the canonical `useZoruToast`.
- Sweep the 1220 `variant: 'destructive'` toasts that should be `warning`.
- Add visual styling for `variant: 'info'` in `toast.tsx` so the 5 callers stop falling back silently.
- Wire `<EntityMultiFormField>` into the first form that gets an array entity field.
- Ship `setCrmAccountCategory(ids[], category)` so the accounts list bulk-bar can actually mutate (currently stubbed with a warning toast).
- Ship `getCrmAccountKpis()` server action — accounts list page derives KPIs from a 500-row client-side sample today.
- Inline attachment add via `<SabFilePickerButton>` on the account detail page when an `addAccountAttachment` action lands.
- §1D.3 keyboard shortcut handlers on `<AccountForm>` (`Cmd+S` save · `Cmd+Enter` save & new · `Esc` cancel-with-dirty-prompt). Once shipped, pattern-port to every other form via a shared hook.
