# Masterplan Chunk 14

## Quotations

### Route / Component: `src/app/dashboard/crm/sales/quotations/[id]/edit/page.tsx`
* **Current Features**: Edits an existing quotation using `QuotationForm`, fetching custom fields.
* **Possible Features**: Draft autosaving, revision history, embedded preview.
* **Errors**: Hardcoded `id` passing might lack access control check; relies on `QuotationForm` for error states.
* **Enhancement Plan**: Add parallel optimistic lock handling if multiple users edit simultaneously.

### Route / Component: `src/app/dashboard/crm/sales/quotations/[id]/page.tsx`
* **Current Features**: Detailed view of a quotation, 360-timeline, summary.
* **Possible Features**: 1-click PDF export, "Convert to Invoice", activity feed embedded inside the doc.
* **Errors**: `timelineItems` might not re-render if real-time events fire.
* **Enhancement Plan**: Introduce a quick actions floating bar.

### Route / Component: `src/app/dashboard/crm/sales/quotations/new/page.tsx`
* **Current Features**: Renders `QuotationForm` for new quotation creation, pulls custom fields via action.
* **Possible Features**: Import from external CRM (e.g. HubSpot), templates dropdown.
* **Errors**: Awaiting `getCustomFieldsFor` doesn't handle failures gracefully if the backend is down.
* **Enhancement Plan**: Wrap form inside a Suspense block with skeleton loader.

### Route / Component: `src/app/dashboard/crm/sales/quotations/page.tsx`
* **Current Features**: Canonical list for quotations, KPI strip computation, server-side data fetching.
* **Possible Features**: Drag-and-drop kanban view of quotation stages.
* **Errors**: KPI computation iterates all `rows`; if limit=200 it's fine, but true KPI over all rows relies on `snapshot` falling back, which may diverge.
* **Enhancement Plan**: Use dedicated aggregate queries in MongoDB rather than manually mapping to `toRow`.

## Receipts

### Route / Component: `src/app/dashboard/crm/sales/receipts/[receiptId]/activity/page.tsx`
* **Current Features**: Displays the audit timeline for a specific payment receipt.
* **Possible Features**: Filter timeline by type (manual edits vs system triggers).
* **Errors**: Types cast with `as any` (`(receipt as any).receiptNumber`), missing types.
* **Enhancement Plan**: Standardize `PaymentReceipt` type definition instead of `any`.

### Route / Component: `src/app/dashboard/crm/sales/receipts/[receiptId]/edit/page.tsx`
* **Current Features**: Edits a payment receipt.
* **Possible Features**: Upload physical receipt scans (OCR).
* **Errors**: None obvious, likely delegates to a shared form.
* **Enhancement Plan**: Add a modal to preview the existing receipt while editing.

### Route / Component: `src/app/dashboard/crm/sales/receipts/[receiptId]/page.tsx`
* **Current Features**: Detail view of the payment receipt.
* **Possible Features**: Share receipt via Email/WhatsApp instantly.
* **Errors**: None apparent from typical pattern.
* **Enhancement Plan**: Improve receipt print view styling.

### Route / Component: `src/app/dashboard/crm/sales/receipts/new/page.tsx`
* **Current Features**: Creates a new payment receipt.
* **Possible Features**: Link receipt to multiple unpaid invoices.
* **Errors**: None apparent.
* **Enhancement Plan**: Quick select dropdown for outstanding client invoices.

### Route / Component: `src/app/dashboard/crm/sales/receipts/page.tsx`
* **Current Features**: List of payment receipts with bulk actions, filters, KPIs.
* **Possible Features**: Advanced reconciliation view.
* **Errors**: None observed.
* **Enhancement Plan**: Enhance CSV export to use background processing for larger exports.

## Recurring Invoices

### Route / Component: `src/app/dashboard/crm/sales/recurring-invoices/[id]/edit/page.tsx`
* **Current Features**: Form to edit a recurring invoice schedule.
* **Possible Features**: Pause/Resume toggle directly in edit mode.
* **Errors**: `getRecurringInvoiceById` is called, but no typed return.
* **Enhancement Plan**: Improve scheduling UI with a calendar frequency visualizer.

### Route / Component: `src/app/dashboard/crm/sales/recurring-invoices/[id]/page.tsx`
* **Current Features**: Detail view of recurring invoice, shows generated invoices.
* **Possible Features**: Predictive chart of upcoming invoice revenue.
* **Errors**: The line items array uses inline state mutation.
* **Enhancement Plan**: Use `useFieldArray` from react-hook-form for better performance.

### Route / Component: `src/app/dashboard/crm/sales/recurring-invoices/new/page.tsx`
* **Current Features**: Create new recurring invoice.
* **Possible Features**: Clone from existing invoice.
* **Errors**: None obvious.
* **Enhancement Plan**: Implement a "Preview next 5 scheduled dates" list.

### Route / Component: `src/app/dashboard/crm/sales/recurring-invoices/page.tsx`
* **Current Features**: List view of recurring invoices.
* **Possible Features**: Calendar view showing when invoices trigger.
* **Errors**: Type assertion `(status as any)` in server action call.
* **Enhancement Plan**: Introduce strict zod validation for search params.

## Subscriptions

### Route / Component: `src/app/dashboard/crm/sales/subscriptions/[id]/activity/page.tsx`
* **Current Features**: Displays subscription audit log.
* **Possible Features**: Webhook event logs.
* **Errors**: Uses `as any` for `planName`.
* **Enhancement Plan**: Strongly type subscription responses.

### Route / Component: `src/app/dashboard/crm/sales/subscriptions/[id]/edit/page.tsx`
* **Current Features**: Edits a subscription.
* **Possible Features**: Proration handling options.
* **Errors**: None apparent.
* **Enhancement Plan**: Add upgrade/downgrade flows with pro-rata calculation preview.

### Route / Component: `src/app/dashboard/crm/sales/subscriptions/[id]/page.tsx`
* **Current Features**: Detail view of subscription status.
* **Possible Features**: Manual renewal trigger.
* **Errors**: None apparent.
* **Enhancement Plan**: Show MRR/ARR contribution on the detail page.

### Route / Component: `src/app/dashboard/crm/sales/subscriptions/new/page.tsx`
* **Current Features**: Create new subscription.
* **Possible Features**: Add-on / upsell selector.
* **Errors**: None apparent.
* **Enhancement Plan**: Pre-fill from existing quotes or deals.

### Route / Component: `src/app/dashboard/crm/sales/subscriptions/page.tsx`
* **Current Features**: Subscription list view.
* **Possible Features**: Churn risk indicators.
* **Errors**: None apparent.
* **Enhancement Plan**: Group by active vs churned vs trial.

## Sales CRM / Leads

### Route / Component: `src/app/dashboard/crm/sales-crm/agents/page.tsx`
* **Current Features**: List of agents and lead assignments, inline dialog for assigning.
* **Possible Features**: Round-robin assignment toggles.
* **Errors**: Form logic directly inside `AgentDialog` without robust error state clears.
* **Enhancement Plan**: Move lead-agent mapping to a global CRM setting or dedicated rule builder.

### Route / Component: `src/app/dashboard/crm/sales-crm/all-leads/[id]/activity/page.tsx`
* **Current Features**: Lead audit timeline.
* **Possible Features**: Email/call log integration.
* **Errors**: None apparent.
* **Enhancement Plan**: Integrate twilio/email read receipts into the timeline.

### Route / Component: `src/app/dashboard/crm/sales-crm/all-leads/[id]/edit/page.tsx`
* **Current Features**: Edit lead form.
* **Possible Features**: Social profile enrichment button.
* **Errors**: None apparent.
* **Enhancement Plan**: Real-time validation for phone numbers and emails.

### Route / Component: `src/app/dashboard/crm/sales-crm/all-leads/[id]/page.tsx`
* **Current Features**: Lead detail page.
* **Possible Features**: Convert to Deal button prominently placed.
* **Errors**: None apparent.
* **Enhancement Plan**: Combine lead scoring visualizer in the header.

### Route / Component: `src/app/dashboard/crm/sales-crm/all-leads/duplicates/page.tsx`
* **Current Features**: Merge / resolve duplicate leads.
* **Possible Features**: AI-based fuzzy matching.
* **Errors**: Complex state management for field resolution could lag on large lists.
* **Enhancement Plan**: Add an auto-merge confidence score.

### Route / Component: `src/app/dashboard/crm/sales-crm/all-leads/new/page.tsx`
* **Current Features**: Create a new lead.
* **Possible Features**: Business card scanner integration.
* **Errors**: None apparent.
* **Enhancement Plan**: Add "Save & Add Another" quick action.

### Route / Component: `src/app/dashboard/crm/sales-crm/all-leads/page.tsx`
* **Current Features**: Grid / Kanban view of all leads with KPIs.
* **Possible Features**: Drag and drop kanban with stages.
* **Errors**: Handling `archiveTarget` object values with nested optional chaining cast as string might fail if undefined.
* **Enhancement Plan**: Use Zoru library components fully, remove manual string castings.

### Route / Component: `src/app/dashboard/crm/sales-crm/all-pipelines/page.tsx`
* **Current Features**: Global pipeline overview.
* **Possible Features**: Multi-currency conversion in pipeline.
* **Errors**: None apparent.
* **Enhancement Plan**: Introduce pipeline stage funnel chart.

### Route / Component: `src/app/dashboard/crm/sales-crm/automations/new/page.tsx`
* **Current Features**: Create new sales automation rule.
* **Possible Features**: Visual drag and drop node editor.
* **Errors**: None apparent.
* **Enhancement Plan**: Pre-built automation templates.

### Route / Component: `src/app/dashboard/crm/sales-crm/automations/page.tsx`
* **Current Features**: List of automation rules.
* **Possible Features**: Execution logs for automations.
* **Errors**: None apparent.
* **Enhancement Plan**: Add toggle switches directly in the list.

### Route / Component: `src/app/dashboard/crm/sales-crm/categories/page.tsx`
* **Current Features**: Category management for sales CRM.
* **Possible Features**: Color coding for categories.
* **Errors**: None apparent.
* **Enhancement Plan**: Reorderable categories.

### Route / Component: `src/app/dashboard/crm/sales-crm/client-performance-report/page.tsx`
* **Current Features**: Top clients by revenue chart, data table.
* **Possible Features**: Export to PDF/Excel.
* **Errors**: In-line component rendering of charts might cause re-renders on filter changes.
* **Enhancement Plan**: Memoize chart data to prevent janky UI on input changes.

### Route / Component: `src/app/dashboard/crm/sales-crm/clients/page.tsx`
* **Current Features**: List of active CRM clients.
* **Possible Features**: Client health score.
* **Errors**: None apparent.
* **Enhancement Plan**: Integrated map view for local clients.

### Route / Component: `src/app/dashboard/crm/sales-crm/consent/page.tsx`
* **Current Features**: GDPR / consent tracking for CRM.
* **Possible Features**: 1-click anonymization requests.
* **Errors**: None apparent.
* **Enhancement Plan**: Bulk export consent logs.

## Contacts

### Route / Component: `src/app/dashboard/crm/sales-crm/contacts/[contactId]/activity/page.tsx`
* **Current Features**: Contact activity log.
* **Possible Features**: Add manual notes directly from timeline.
* **Errors**: None apparent.
* **Enhancement Plan**: Use a grouped timeline by day.

### Route / Component: `src/app/dashboard/crm/sales-crm/contacts/[contactId]/edit/page.tsx`
* **Current Features**: Edit contact details.
* **Possible Features**: Sync with Google Contacts.
* **Errors**: None apparent.
* **Enhancement Plan**: Add LinkedIn profile fetcher.

### Route / Component: `src/app/dashboard/crm/sales-crm/contacts/[contactId]/page.tsx`
* **Current Features**: Detail view of contact.
* **Possible Features**: Hierarchy view (if part of an account).
* **Errors**: TODO note left in code (`live counts on related entities deferred`).
* **Enhancement Plan**: Fetch the aggregations using parallel React Server Components.

### Route / Component: `src/app/dashboard/crm/sales-crm/contacts/new/page.tsx`
* **Current Features**: Add a new contact.
* **Possible Features**: Import via CSV snippet.
* **Errors**: None apparent.
* **Enhancement Plan**: Real-time dupe checking on email field blur.

### Route / Component: `src/app/dashboard/crm/sales-crm/contacts/page.tsx`
* **Current Features**: List of contacts.
* **Possible Features**: Segmentation lists.
* **Errors**: None apparent.
* **Enhancement Plan**: Allow inline editing in the table.

## Deals and Extras

### Route / Component: `src/app/dashboard/crm/sales-crm/conversions/page.tsx`
* **Current Features**: Conversion tracking and reporting.
* **Possible Features**: Goal setting integration.
* **Errors**: None apparent.
* **Enhancement Plan**: Add cohort analysis charts.

### Route / Component: `src/app/dashboard/crm/sales-crm/custom-forms/page.tsx`
* **Current Features**: Manage lead capture custom forms.
* **Possible Features**: Embed code generator.
* **Errors**: Client side blob URL generation might leak memory if not properly revoked, though `triggerDownload` handles it locally.
* **Enhancement Plan**: Live preview of the form as it is built.

### Route / Component: `src/app/dashboard/crm/sales-crm/deals/[id]/activity/page.tsx`
* **Current Features**: Deal timeline.
* **Possible Features**: Stage transition timestamps.
* **Errors**: None apparent.
* **Enhancement Plan**: Emphasize stage change events in the UI.

### Route / Component: `src/app/dashboard/crm/sales-crm/deals/[id]/edit/page.tsx`
* **Current Features**: Edit deal.
* **Possible Features**: Deal team collaborators.
* **Errors**: None apparent.
* **Enhancement Plan**: Split products and general info into tabs if too long.

### Route / Component: `src/app/dashboard/crm/sales-crm/deals/[id]/page.tsx`
* **Current Features**: Deal detail view.
* **Possible Features**: Generate quote from deal button.
* **Errors**: None apparent.
* **Enhancement Plan**: Integrated email compose widget.

### Route / Component: `src/app/dashboard/crm/sales-crm/deals/duplicates/page.tsx`
* **Current Features**: Duplicate resolution for deals.
* **Possible Features**: Automated merge rules.
* **Errors**: None apparent.
* **Enhancement Plan**: Select which fields to keep side-by-side.

### Route / Component: `src/app/dashboard/crm/sales-crm/deals/new/page.tsx`
* **Current Features**: Create deal.
* **Possible Features**: Recommend products based on account history.
* **Errors**: None apparent.
* **Enhancement Plan**: Auto-calculate expected close date based on average cycle time.

### Route / Component: `src/app/dashboard/crm/sales-crm/deals/page.tsx`
* **Current Features**: Deal list / Kanban view with KPIs.
* **Possible Features**: Weighted forecast view.
* **Errors**: Hard dependency on `mongodb` directly inside the page without wrapping it in an abstraction layer action, violating separation of concerns.
* **Enhancement Plan**: Move DB logic to `crm-deals.actions.ts`.
