# Chunk 7 Analysis

## 1. Import / Export Domain

### `src/app/dashboard/crm/import-export/[entityKind]/page.tsx`
- **Route / Component**: `/dashboard/crm/import-export/[entityKind]`
- **Current Features**: Server component shell for the per-entity import/export page. Validates the `entityKind` against `SUPPORTED_ENTITY_KINDS` and wraps the `<ImportExportClient>` with breadcrumbs.
- **Possible Features**: Add export history/logs for the specific entity. Add pre-flight validation checks or mapping overrides.
- **Errors**: Missing error boundary. Non-supported entities just throw a 404 via `notFound()` instead of graceful fallback.
- **Enhancement Plan**: Add breadcrumbs for better state tracking for large imports. Introduce granular permissions check.

### `src/app/dashboard/crm/import-export/page.tsx`
- **Route / Component**: `/dashboard/crm/import-export`
- **Current Features**: Import/Export landing page. Lists entity kinds supported by the bulk pipeline and links into the per-entity wizard. Displays a KPI strip (total jobs, completed, failed, last import) by aggregating data from `crm_audit_log`.
- **Possible Features**: Pagination for recent jobs, download links for failed import logs/error reports. Add filtering by date range for the KPI grid.
- **Errors**: `getImportJobStats` catches all errors and returns an empty stat block without logging them, hiding potential DB failures.
- **Enhancement Plan**: Add `<Suspense>` boundary and Skeleton loaders for the KPI stats to prevent blocking the entire page render.

## 2. Integrations Domain

### `src/app/dashboard/crm/integrations/page.tsx`
- **Route / Component**: `/dashboard/crm/integrations`
- **Current Features**: Integrations list page. Fetches statuses via `getIntegrationTypes`. Shows a grid of supported integrations (Gmail, WhatsApp, FB Lead Ads, Shopify, Zapier, Slack) with statuses (Connected, Available, Coming Soon) and a KPI strip.
- **Possible Features**: Add a search/filter bar for finding specific integrations. Show the last sync status per integration directly in the grid.
- **Errors**: `totalCount` and specific app configurations are hardcoded arrays. `getIntegrationTypes` lacks error boundary handling.
- **Enhancement Plan**: Extract the integrations list configuration into a database or central config file to easily toggle them. Use Suspense to stream the KPI grid.

### `src/app/dashboard/crm/integrations/new/page.tsx`
- **Route / Component**: `/dashboard/crm/integrations/new`
- **Current Features**: New integration page. Server wrapper around `<IntegrationForm>`.
- **Possible Features**: Provider selection templates (e.g., pre-filling configurations for common webhooks).
- **Errors**: No specific bugs; standard redirect if unauthenticated.
- **Enhancement Plan**: Transition from a raw credentials form into a guided OAuth or API connection setup wizard.

### `src/app/dashboard/crm/integrations/[id]/page.tsx`
- **Route / Component**: `/dashboard/crm/integrations/[id]`
- **Current Features**: Integration detail page. Uses `EntityDetailShell` with actions (Connect, Edit, Delete). Displays summary (provider, status, webhook URL, last sync), JSON config, and redacted credentials. Renders audit timeline.
- **Possible Features**: Real-time sync status monitoring. View recent webhook payloads/logs. Trigger a manual sync.
- **Errors**: Date formatting logic (`fmtDate`) returns '—' for invalid dates but doesn't handle timezone shifts gracefully.
- **Enhancement Plan**: Add skeletons for loading state. Implement Webhook log previews.

### `src/app/dashboard/crm/integrations/[id]/edit/page.tsx`
- **Route / Component**: `/dashboard/crm/integrations/[id]/edit`
- **Current Features**: Edit integration page. Loads doc by ID, passes to `IntegrationForm`. Displays an empty credentials box to prevent leaking secrets.
- **Possible Features**: "Test connection" button in the form before saving. Diff view of configuration changes.
- **Errors**: Direct DB/Action calls. If `getIntegrationById` fails with DB connection issue, it throws 500 without a local error boundary.
- **Enhancement Plan**: Add `<Suspense>` wrapper to prevent page-level crashes on network blips.

## 3. Inventory Adjustments

### `src/app/dashboard/crm/inventory/adjustments/new/page.tsx`
- **Route / Component**: `/dashboard/crm/inventory/adjustments/new`
- **Current Features**: New stock-adjustment route. Wraps `<AdjustmentForm>`.
- **Possible Features**: CSV upload for bulk stock adjustments. Barcode scanner support integration.
- **Errors**: Very simplistic component without a dedicated layout shell.
- **Enhancement Plan**: Move the layout shell definition into this page instead of tightly coupling it inside the form component.

### `src/app/dashboard/crm/inventory/adjustments/[id]/page.tsx`
- **Route / Component**: `/dashboard/crm/inventory/adjustments/[id]`
- **Current Features**: Detail page for a stock adjustment. Displays header summary, per-line breakdown table, approval workflow card, and notes. Shows Edit, Approve, Reject, Print actions.
- **Possible Features**: Attachment support for physical stock proofs. Direct links to product ledgers for affected items.
- **Errors**: Uses `javascript:window.print()` which is archaic and insecure. Heavy usage of `(adj as any)` bypassing TypeScript checks completely.
- **Enhancement Plan**: Define strict TypeScript interfaces for `StockAdjustment` documents. Replace the print action with a modern react-to-print solution or dedicated print stylesheet.

### `src/app/dashboard/crm/inventory/adjustments/[id]/edit/page.tsx`
- **Route / Component**: `/dashboard/crm/inventory/adjustments/[id]/edit`
- **Current Features**: Stock-adjustment edit route. Fetches adjustment and renders `<AdjustmentEditForm>`. Form is restricted to mutating reason, referenceNumber, and notes.
- **Possible Features**: Revert adjustment action if an error was made.
- **Errors**: More `as any` casting and forced JSON clone `JSON.parse(JSON.stringify(adj))` without type safety.
- **Enhancement Plan**: Define a sanitized DTO mapping function instead of JSON serialization to strip complex objects.

### `src/app/dashboard/crm/inventory/adjustments/[id]/activity/page.tsx`
- **Route / Component**: `/dashboard/crm/inventory/adjustments/[id]/activity`
- **Current Features**: Activity audit log page. Renders the shared `EntityAuditTimeline` for `stock_adjustment`.
- **Possible Features**: Filter timeline by event type (e.g., creation vs approval vs edits).
- **Errors**: `(adj as any)` type casting used for `productName`.
- **Enhancement Plan**: Add strong typings. 

## 4. HR Payroll Legacy Redirects

The following 35 files are all implemented as legacy server-side `permanentRedirect` components that redirect incoming requests to the new `/dashboard/hrm/payroll/*` routes. They all feature dynamic search parameter preservation using `URLSearchParams` mapping.

- `src/app/dashboard/crm/hr-payroll/holidays/new/page.tsx`
- `src/app/dashboard/crm/hr-payroll/holidays/page.tsx`
- `src/app/dashboard/crm/hr-payroll/kpi-tracking/page.tsx`
- `src/app/dashboard/crm/hr-payroll/leave/[id]/edit/page.tsx`
- `src/app/dashboard/crm/hr-payroll/leave/[id]/page.tsx`
- `src/app/dashboard/crm/hr-payroll/leave/balance/page.tsx`
- `src/app/dashboard/crm/hr-payroll/leave/calendar/page.tsx`
- `src/app/dashboard/crm/hr-payroll/leave/new/page.tsx`
- `src/app/dashboard/crm/hr-payroll/leave/page.tsx`
- `src/app/dashboard/crm/hr-payroll/leave/settings/page.tsx`
- `src/app/dashboard/crm/hr-payroll/leave/types/page.tsx`
- `src/app/dashboard/crm/hr-payroll/page.tsx`
- `src/app/dashboard/crm/hr-payroll/payroll/[id]/edit/page.tsx`
- `src/app/dashboard/crm/hr-payroll/payroll/[id]/page.tsx`
- `src/app/dashboard/crm/hr-payroll/payroll/new/page.tsx`
- `src/app/dashboard/crm/hr-payroll/payroll/page.tsx`
- `src/app/dashboard/crm/hr-payroll/payslips/[id]/edit/page.tsx`
- `src/app/dashboard/crm/hr-payroll/payslips/[id]/page.tsx`
- `src/app/dashboard/crm/hr-payroll/payslips/new/page.tsx`
- `src/app/dashboard/crm/hr-payroll/payslips/page.tsx`
- `src/app/dashboard/crm/hr-payroll/pf-esi/page.tsx`
- `src/app/dashboard/crm/hr-payroll/professional-tax/page.tsx`
- `src/app/dashboard/crm/hr-payroll/reports/page.tsx`
- `src/app/dashboard/crm/hr-payroll/salary-structure/[id]/edit/page.tsx`
- `src/app/dashboard/crm/hr-payroll/salary-structure/[id]/page.tsx`
- `src/app/dashboard/crm/hr-payroll/salary-structure/new/page.tsx`
- `src/app/dashboard/crm/hr-payroll/salary-structure/page.tsx`
- `src/app/dashboard/crm/hr-payroll/settings/page.tsx`
- `src/app/dashboard/crm/hr-payroll/shift-change-requests/page.tsx`
- `src/app/dashboard/crm/hr-payroll/shift-rotations/page.tsx`
- `src/app/dashboard/crm/hr-payroll/shifts/[id]/edit/page.tsx`
- `src/app/dashboard/crm/hr-payroll/shifts/[id]/page.tsx`
- `src/app/dashboard/crm/hr-payroll/shifts/new/page.tsx`
- `src/app/dashboard/crm/hr-payroll/shifts/page.tsx`
- `src/app/dashboard/crm/hr-payroll/tds/page.tsx`

**Current Features**: Permanent Next.js redirects capturing path segments and query strings, forwarding to `/dashboard/hrm/`.
**Possible Features**: These can be completely removed from the project if next.config.js redirects are used instead. 
**Errors**: These components incur an unnecessary React Server Component render step before sending the HTTP redirect response, impacting performance compared to config-level redirects.
**Enhancement Plan**: Delete all these files and define them in `next.config.js` or Next.js middleware as `redirects()`.
