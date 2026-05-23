# MASTERPLAN CHUNK 3

This document contains the analysis for the CRM route modules assigned to Agent 3.

## 1. Accounting Vouchers (`/src/app/dashboard/crm/accounting/vouchers`)

### Route / Component
- `/dashboard/crm/accounting/vouchers/page.tsx`
- `/dashboard/crm/accounting/vouchers/new/page.tsx`
- `/dashboard/crm/accounting/vouchers/[voucherBookId]/page.tsx`
- `/dashboard/crm/accounting/vouchers/[voucherBookId]/edit/page.tsx`
- `/dashboard/crm/accounting/vouchers/[voucherBookId]/activity/page.tsx`

### Current Features
- Serves as the accounting hub to track and manage journal entries (vouchers).
- Provides list view, detailed viewing, creation, editing, and an activity audit log.
- Relies heavily on `EntityDetailShell` and `EntityListShell`.

### Possible Features
- Advanced multi-currency support in vouchers.
- AI-driven auto-categorization of voucher entries.
- Automated creation of recurring vouchers based on schedule templates.

### Errors
- Typical missing React Suspense boundaries for slow data fetching actions.
- Hydration mismatch risks if datetime strings from server aren't normalized correctly on the client list views.

### Enhancement Plan
- Introduce server-side pagination/filtering using searchParams directly on the server to reduce client-side state.
- Add bulk approval flow for pending vouchers on the listing page.

---

## 2. Accounts (`/src/app/dashboard/crm/accounts`)

### Route / Component
- `/dashboard/crm/accounts/page.tsx`
- `/dashboard/crm/accounts/new/page.tsx`
- `/dashboard/crm/accounts/[accountId]/page.tsx`
- `/dashboard/crm/accounts/[accountId]/edit/page.tsx`
- `/dashboard/crm/accounts/[accountId]/activity/page.tsx`

### Current Features
- Displays a comprehensive list of B2B accounts (companies) using client-side data table with KPIs, bulk actions, export capabilities.
- Account detail page shows recent activity, open deals, tickets, and associated contacts.
- Creation and Editing wrapped in standardized shells.

### Possible Features
- Org chart visualization within the Account Detail page.
- Account scoring based on recent interactions and open deal values.
- LinkedIn or clearbit enrichment integration for auto-populating account details.

### Errors
- In the list client component, bulk actions might suffer from race conditions if the data refreshes concurrently with a user action.
- Potential performance bottleneck: fetching full account list and filtering client-side may scale poorly for large datasets.

### Enhancement Plan
- Transition the `AccountsListClient` to use cursor-based or page-based server fetching.
- Add a "Merge Accounts" feature to handle duplicate entries.

---

## 3. Automations & Auto-Leads (`/src/app/dashboard/crm/automations`, `/auto-leads-setup`)

### Route / Component
- `/dashboard/crm/automations/page.tsx`
- `/dashboard/crm/automations/new/page.tsx`
- `/dashboard/crm/automations/[automationId]/page.tsx`
- `/dashboard/crm/automations/[automationId]/edit/page.tsx`
- `/dashboard/crm/automations/docs/page.tsx`
- `/dashboard/crm/auto-leads-setup/page.tsx`

### Current Features
- A flow/rule-based automation engine for the CRM.
- Detail page renders an interactive react-flow builder canvas.
- Rules can be toggled active/inactive, executed, duplicated, and checked against a robust audit log.
- `auto-leads-setup` acts as a specialized pipeline configuration for lead ingestion.

### Possible Features
- Drag-and-drop workflow builder improvements with custom node types.
- Webhook testing utilities directly within the automation UI.
- Real-time execution tracing and visual debugging of failed automation runs.

### Errors
- Flow builder (`ReactFlow`) might have layout thrashing during initial hydration.
- The `try/catch` in some automation fetchers silently swallows deep server errors, potentially leaving the UI stuck loading or displaying generic errors.

### Enhancement Plan
- Consolidate error handling for rule execution to provide clearer feedback on why an automation failed.
- Implement a template gallery (e.g., "Welcome Email Series", "Abandoned Cart") for quick automation setup.

---

## 4. General CRM Activity & Analytics (`/src/app/dashboard/crm/activity`, `/analytics`, `/audit-log`)

### Route / Component
- `/dashboard/crm/activity/page.tsx`
- `/dashboard/crm/analytics/page.tsx`
- `/dashboard/crm/audit-log/page.tsx`

### Current Features
- Provides global views of system-wide activity, basic analytics dashboards, and an immutable audit log across entities.
- Activity feed aggregates actions from multiple modules (deals, tickets, accounts).

### Possible Features
- Customizable dashboards in `/analytics` with drag-and-drop widgets.
- Advanced querying syntax (e.g., `user:john AND action:delete`) in the audit log.
- Scheduled reports generation and email delivery.

### Errors
- Activity feeds that aggregate across large collections without proper indexing can cause slow load times.
- Missing empty states for new tenants in the analytics views.

### Enhancement Plan
- Implement infinite scrolling for the global activity feed.
- Add chart export functionality (PDF/PNG) to the analytics page.

---

## 5. Banking & Reconciliation (`/src/app/dashboard/crm/banking`)

### Route / Component
- `/dashboard/crm/banking/page.tsx` (Hub)
- `/dashboard/crm/banking/all/...` (All Accounts)
- `/dashboard/crm/banking/bank-accounts/...` (Bank Accounts specifically)
- `/dashboard/crm/banking/employee-accounts/page.tsx` (Employee Accounts)
- `/dashboard/crm/banking/bank-transactions/...` (Transactions list/detail)
- `/dashboard/crm/banking/reconciliation/...` (Reconciliation match & CRUD)

### Current Features
- Comprehensive banking suite managing physical bank accounts, employee payout accounts, and general payment accounts.
- `BankTransaction` tracking representing actual bank statement lines.
- Complex `Reconciliation` engine with a CSV import tool and a split view to match statement entries against internal book entries.
- Hub provides at-a-glance KPIs.

### Possible Features
- Plaid / Bank API integration for automatic transaction fetching.
- AI-based auto-reconciliation of high-confidence matches.
- Multi-currency adjustments and FX gain/loss automated entries.

### Errors
- Reconciliation matching state (`matchedBookEntries`, `matchedStatementEntries`) is stored entirely in React state, which may be lost if the user navigates away or refreshes before saving.
- CSV parser for bank statements is fragile if the bank changes their CSV column formats.

### Enhancement Plan
- Introduce auto-save or draft states for the reconciliation matcher.
- Create mapping profiles for CSV imports so users can define "Date", "Amount", "Description" columns for different banks.

---

## 6. Bookings (`/src/app/dashboard/crm/bookings`)

### Route / Component
- `/dashboard/crm/bookings/page.tsx`
- `/dashboard/crm/bookings/new/page.tsx`
- `/dashboard/crm/bookings/[id]/page.tsx`
- `/dashboard/crm/bookings/[id]/edit/page.tsx`

### Current Features
- Schedule and manage bookings, linking a resource/staff, a customer, and a time slot.
- Features capacity management, no-show toggling, and payment status tracking.
- Client-side list view with KPIs, search, and pagination.

### Possible Features
- Calendar view (monthly/weekly/daily) to complement the list view.
- Customer self-service portal to reschedule or cancel.
- Automated reminder emails/SMS configured directly in the booking module.

### Errors
- The duration calculation `computeDuration` may misbehave across daylight saving boundaries.
- The `EntityPickerChip` might fail to resolve the name if the user/client is deleted but the ID remains in the booking.

### Enhancement Plan
- Add a calendar toggle view to `BookingListClient` using `react-big-calendar` or similar.
- Integrate Google Calendar / Outlook two-way sync for resources.

---

## 7. Budgets (Partial - `[id]/activity`, `[id]/edit`)

### Route / Component
- `/dashboard/crm/budgets/[id]/activity/page.tsx`
- `/dashboard/crm/budgets/[id]/edit/page.tsx`

### Current Features
- The edit page provides a rich view displaying variance, plan vs actual utilization, and owner/approver context in the right rail alongside the edit form.
- The activity page provides the audit timeline for the specific budget.

### Possible Features
- Scenario planning (cloning a budget to adjust parameters).
- Departmental roll-ups (hierarchical budgets).

### Errors
- Potential division by zero if `planAmount` is 0 when calculating `utilisation`. Currently handled via `plan > 0 ? ... : 0`, but requires careful edge case testing.

### Enhancement Plan
- Allow importing budget plans via CSV/Excel template.
- Implement real-time budget depletion alerts using WebSockets or server-sent events for critical overruns.

---
End of Chunk 3.
