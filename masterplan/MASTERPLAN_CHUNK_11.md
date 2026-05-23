# Page Analysis: Agent 11

## Purchase Module

### RFQs
#### `src/app/dashboard/crm/purchases/rfqs/page.tsx`
- **Route / Component**: `/dashboard/crm/purchases/rfqs`
- **Current Features**: Lists RFQs with `EntityListShell`. Fetches data via `getRfqs`.
- **Possible Features**: Add quick filters for RFQ status (e.g., open, closed, awarded).
- **Errors**: Lack of error boundary around data fetching.
- **Enhancement Plan**: Implement real-time status updates via WebSockets for collaborative purchasing.

#### `src/app/dashboard/crm/purchases/rfqs/[id]/page.tsx`
- **Route / Component**: `/dashboard/crm/purchases/rfqs/[id]`
- **Current Features**: Detail view for an RFQ, using `EntityDetailShell`.
- **Possible Features**: Vendor bid comparison view.
- **Errors**: Relies on `notFound()` correctly throwing, but could use more granular error messaging.
- **Enhancement Plan**: Introduce an inline preview of associated bids.

#### `src/app/dashboard/crm/purchases/rfqs/[id]/edit/page.tsx`
- **Route / Component**: `/dashboard/crm/purchases/rfqs/[id]/edit`
- **Current Features**: Edit page for RFQ using `EntityDetailShell` and `RfqForm`.
- **Possible Features**: Auto-save drafts.
- **Errors**: No explicit concurrency handling if two users edit simultaneously.
- **Enhancement Plan**: Add optimistic UI updates on save.

#### `src/app/dashboard/crm/purchases/rfqs/[id]/activity/page.tsx`
- **Route / Component**: `/dashboard/crm/purchases/rfqs/[id]/activity`
- **Current Features**: Displays activity timeline for an RFQ using `EntityAuditTimeline`.
- **Possible Features**: Allow users to add manual comments to the timeline.
- **Errors**: Audit logs might grow large, pagination might be needed.
- **Enhancement Plan**: Implement timeline filtering (e.g., system vs. user comments).

### Vendor Bids
#### `src/app/dashboard/crm/purchases/vendor-bids/page.tsx`
- **Route / Component**: `/dashboard/crm/purchases/vendor-bids`
- **Current Features**: Master list of vendor bids.
- **Possible Features**: Bulk approve/reject operations.
- **Errors**: Pagination could be slow if unindexed.
- **Enhancement Plan**: Add comparative metric columns (price vs. budget).

#### `src/app/dashboard/crm/purchases/vendor-bids/[id]/page.tsx`
- **Route / Component**: `/dashboard/crm/purchases/vendor-bids/[id]`
- **Current Features**: Detail view for a vendor bid.
- **Possible Features**: Deep linking to the original RFQ items.
- **Errors**: None.
- **Enhancement Plan**: Improve cross-referencing to the parent RFQ.

#### `src/app/dashboard/crm/purchases/vendor-bids/[id]/edit/page.tsx`
- **Route / Component**: `/dashboard/crm/purchases/vendor-bids/[id]/edit`
- **Current Features**: Form wrapper to edit vendor bids.
- **Possible Features**: Inline status transition (e.g., "Award Bid").
- **Errors**: Potential mismatch if bid is locked.
- **Enhancement Plan**: Add validation to prevent editing accepted bids.

#### `src/app/dashboard/crm/purchases/vendor-bids/[id]/activity/page.tsx`
- **Route / Component**: `/dashboard/crm/purchases/vendor-bids/[id]/activity`
- **Current Features**: Audit timeline for vendor bids.
- **Possible Features**: Notification pings when bid is updated.
- **Errors**: Missing suspense boundary for slow activity logs.
- **Enhancement Plan**: Standardize timeline UI with other entities.

### Vendors
#### `src/app/dashboard/crm/purchases/vendors/page.tsx`
- **Route / Component**: `/dashboard/crm/purchases/vendors`
- **Current Features**: Vendor directory with `EntityListShell`.
- **Possible Features**: Vendor compliance/health score column.
- **Errors**: Uses older `[id]` parameter convention instead of `[vendorId]`.
- **Enhancement Plan**: Standardize the parameter naming and improve list performance.

#### `src/app/dashboard/crm/purchases/vendors/[id]/page.tsx`
- **Route / Component**: `/dashboard/crm/purchases/vendors/[id]`
- **Current Features**: Vendor detail view.
- **Possible Features**: Dashboard for vendor performance metrics.
- **Errors**: Legacy `[id]` path.
- **Enhancement Plan**: Migrate to `[vendorId]` and add a quick-action menu for POs.

#### `src/app/dashboard/crm/purchases/vendors/[id]/edit/page.tsx`
- **Route / Component**: `/dashboard/crm/purchases/vendors/[id]/edit`
- **Current Features**: Form wrapper for updating vendor details.
- **Possible Features**: Tax info validation (GSTIN checks).
- **Errors**: None spotted.
- **Enhancement Plan**: Provide field-level warnings for missing compliance docs.

#### `src/app/dashboard/crm/purchases/vendors/[id]/activity/page.tsx`
- **Route / Component**: `/dashboard/crm/purchases/vendors/[id]/activity`
- **Current Features**: Vendor audit timeline.
- **Possible Features**: System events for failed payments.
- **Errors**: None.
- **Enhancement Plan**: Integrate communications (emails) into the timeline.

#### `src/app/dashboard/crm/purchases/vendors/categories/page.tsx`
- **Route / Component**: `/dashboard/crm/purchases/vendors/categories`
- **Current Features**: Settings list for vendor categories.
- **Possible Features**: Hierarchical categories.
- **Errors**: None.
- **Enhancement Plan**: Add drag-and-drop ordering.

#### `src/app/dashboard/crm/purchases/vendors/portals/page.tsx`
- **Route / Component**: `/dashboard/crm/purchases/vendors/portals`
- **Current Features**: List of vendor portals.
- **Possible Features**: Copy-to-clipboard for portal links.
- **Errors**: None.
- **Enhancement Plan**: Provide status toggles (active/inactive) directly in the list.

#### `src/app/dashboard/crm/purchases/vendors/ratings/page.tsx`
- **Route / Component**: `/dashboard/crm/purchases/vendors/ratings`
- **Current Features**: Settings for vendor ratings.
- **Possible Features**: Custom rating criteria.
- **Errors**: None.
- **Enhancement Plan**: Introduce a 5-star graphical representation component.

#### `src/app/dashboard/crm/purchases/vendors/types/page.tsx`
- **Route / Component**: `/dashboard/crm/purchases/vendors/types`
- **Current Features**: Settings for vendor types.
- **Possible Features**: Link types to specific workflows.
- **Errors**: None.
- **Enhancement Plan**: Clean up unused imports if any, use standard shell.

## Reports Module

### Report Hub & Infrastructure
#### `src/app/dashboard/crm/reports/page.tsx`
- **Route / Component**: `/dashboard/crm/reports`
- **Current Features**: Hub overview page linking to all reports, showing KPIs and recent runs.
- **Possible Features**: User-customizable favorite reports dashboard.
- **Errors**: Hardcoded category lists could become unwieldy.
- **Enhancement Plan**: Move category definitions to a shared constant or DB configuration.

#### `src/app/dashboard/crm/reports/[id]/runs/page.tsx`
- **Route / Component**: `/dashboard/crm/reports/[id]/runs`
- **Current Features**: List of historical runs for a specific report definition.
- **Possible Features**: Bulk delete old runs.
- **Errors**: None.
- **Enhancement Plan**: Add visual sparkline for row count over time.

#### `src/app/dashboard/crm/reports/[id]/runs/[runId]/page.tsx`
- **Route / Component**: `/dashboard/crm/reports/[id]/runs/[runId]`
- **Current Features**: View output of a specific report run in a table.
- **Possible Features**: Export to Excel/CSV directly from run view.
- **Errors**: Large reports could crash the browser; needs pagination on results.
- **Enhancement Plan**: Implement virtual scrolling or pagination for `result.rows`.

### Specialized Reports
#### `src/app/dashboard/crm/reports/agent-performance/page.tsx`
- **Route / Component**: `/dashboard/crm/reports/agent-performance`
- **Current Features**: HR/Sales performance table and charts.
- **Possible Features**: Drill-down into individual deals.
- **Errors**: Potential client-side hydration issues with heavy charts.
- **Enhancement Plan**: Lazy load the charts.

#### `src/app/dashboard/crm/reports/attendance-report/page.tsx`
- **Route / Component**: `/dashboard/crm/reports/attendance-report`
- **Current Features**: Monthly attendance matrix and stats.
- **Possible Features**: Export to payroll systems.
- **Errors**: Date math could be tricky across timezones.
- **Enhancement Plan**: Use robust timezone library for dates.

#### `src/app/dashboard/crm/reports/birthday-anniversary/page.tsx`
- **Route / Component**: `/dashboard/crm/reports/birthday-anniversary`
- **Current Features**: Upcoming birthdays/anniversaries.
- **Possible Features**: Automated email greetings integration.
- **Errors**: Leap year birthday handling.
- **Enhancement Plan**: Add "Send Message" quick action.

#### `src/app/dashboard/crm/reports/expense/page.tsx`
- **Route / Component**: `/dashboard/crm/reports/expense`
- **Current Features**: Finance expense report with category pie and monthly trend.
- **Possible Features**: Predictive forecasting based on historical expenses.
- **Errors**: In-memory filtering on 500 rows; might not scale.
- **Enhancement Plan**: Move filtering to the database query instead of in-memory.

#### `src/app/dashboard/crm/reports/gstr-1/page.tsx`
- **Route / Component**: `/dashboard/crm/reports/gstr-1`
- **Current Features**: Outward supplies report for GST compliance.
- **Possible Features**: Direct API integration with GST portal.
- **Errors**: Manual DB lookups intermixed with actions.
- **Enhancement Plan**: Refactor `nameByAccount` DB logic into the action layer.

#### `src/app/dashboard/crm/reports/gstr-2b/page.tsx`
- **Route / Component**: `/dashboard/crm/reports/gstr-2b`
- **Current Features**: Inward supplies / ITC auto-drafted statement.
- **Possible Features**: Reconciliation tool vs. local purchase register.
- **Errors**: Direct MongoDB connection in server component.
- **Enhancement Plan**: Abstract the `crm_gstr2b_imports` query into a server action.

#### `src/app/dashboard/crm/reports/income/page.tsx`
- **Route / Component**: `/dashboard/crm/reports/income`
- **Current Features**: Revenue and paid invoice metrics.
- **Possible Features**: Multi-currency aggregation handling.
- **Errors**: In-memory filtering limits scalability.
- **Enhancement Plan**: Push filtering down to the DB query.

#### `src/app/dashboard/crm/reports/invoice-aging/page.tsx`
- **Route / Component**: `/dashboard/crm/reports/invoice-aging`
- **Current Features**: Accounts receivable aging buckets (0-30, 31-60, etc.).
- **Possible Features**: Send bulk dunning emails for 90+ days.
- **Errors**: `filter` runs in memory.
- **Enhancement Plan**: Implement server-side filtering for better performance.

#### `src/app/dashboard/crm/reports/late-report/page.tsx`
- **Route / Component**: `/dashboard/crm/reports/late-report`
- **Current Features**: Tasks/Projects/Invoices past due.
- **Possible Features**: Priority escalation workflows.
- **Errors**: None.
- **Enhancement Plan**: Add deep links to resolve items quickly.

#### `src/app/dashboard/crm/reports/leads-conversion/page.tsx`
- **Route / Component**: `/dashboard/crm/reports/leads-conversion`
- **Current Features**: Lead funnel and conversion stats.
- **Possible Features**: Conversion timeline tracking.
- **Errors**: In-memory filtering for `sp.source`.
- **Enhancement Plan**: Update `getCrmLeads` to accept source filters.

#### `src/app/dashboard/crm/reports/leave-balance-report/page.tsx`
- **Route / Component**: `/dashboard/crm/reports/leave-balance-report`
- **Current Features**: Remaining leave balances per employee.
- **Possible Features**: Leave policy assignment visualizer.
- **Errors**: None.
- **Enhancement Plan**: Add highlight for employees with negative balances.

#### `src/app/dashboard/crm/reports/leave-report/page.tsx`
- **Route / Component**: `/dashboard/crm/reports/leave-report`
- **Current Features**: Leave tracking report.
- **Possible Features**: Calendar view toggle.
- **Errors**: None.
- **Enhancement Plan**: Incorporate public holiday overlaps.

#### `src/app/dashboard/crm/reports/overdue-tasks/page.tsx`
- **Route / Component**: `/dashboard/crm/reports/overdue-tasks`
- **Current Features**: Tasks past due date.
- **Possible Features**: Reassign bulk actions.
- **Errors**: None.
- **Enhancement Plan**: Combine with late-report or clarify distinction.

#### `src/app/dashboard/crm/reports/payment-report/page.tsx`
- **Route / Component**: `/dashboard/crm/reports/payment-report`
- **Current Features**: Receivables by payment mode.
- **Possible Features**: Dispute/Chargeback tracking.
- **Errors**: In-memory filtering.
- **Enhancement Plan**: Add backend filter support.

#### `src/app/dashboard/crm/reports/profit-loss/page.tsx`
- **Route / Component**: `/dashboard/crm/reports/profit-loss`
- **Current Features**: P&L statement (monthly/quarterly).
- **Possible Features**: YTD vs Last YTD comparison columns.
- **Errors**: None.
- **Enhancement Plan**: Add an option to expand details for COGS/Expenses.

#### `src/app/dashboard/crm/reports/project-status-report/page.tsx`
- **Route / Component**: `/dashboard/crm/reports/project-status-report`
- **Current Features**: RAG status and delivery velocity.
- **Possible Features**: Resource utilization overlay.
- **Errors**: None.
- **Enhancement Plan**: Add Gantt chart previews.

#### `src/app/dashboard/crm/reports/sales-deals/page.tsx`
- **Route / Component**: `/dashboard/crm/reports/sales-deals`
- **Current Features**: Deal funnel and monthly revenue.
- **Possible Features**: Weighted pipeline value forecasting.
- **Errors**: None.
- **Enhancement Plan**: Add interactive stage drag-and-drop filters.

#### `src/app/dashboard/crm/reports/task-report/page.tsx`
- **Route / Component**: `/dashboard/crm/reports/task-report`
- **Current Features**: General task report.
- **Possible Features**: Time logged vs. Estimated time.
- **Errors**: None.
- **Enhancement Plan**: Filter by custom tags or epics.

#### `src/app/dashboard/crm/reports/tax/page.tsx`
- **Route / Component**: `/dashboard/crm/reports/tax`
- **Current Features**: Tax collected vs paid.
- **Possible Features**: Automated journal entries for tax settlement.
- **Errors**: `labelTaxType` is currently hardcoded to 'GST'.
- **Enhancement Plan**: Make tax type extraction robust based on real tax items.

#### `src/app/dashboard/crm/reports/ticket-report/page.tsx`
- **Route / Component**: `/dashboard/crm/reports/ticket-report`
- **Current Features**: Support SLA metrics and ticket volume.
- **Possible Features**: Customer satisfaction (CSAT) overlays.
- **Errors**: None.
- **Enhancement Plan**: Introduce real-time SLA breach warnings.
