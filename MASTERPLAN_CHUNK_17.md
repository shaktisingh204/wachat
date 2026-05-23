# Analysis of Next.js Pages (Chunk 17)

## Settings Module (`/dashboard/crm/settings/*`)

### Roles
- **Route**: `/dashboard/crm/settings/roles/page.tsx` (List)
- **Current Features**: Displays roles table, KPIs (total, admin, generic). Bulk deletion.
- **Route**: `/dashboard/crm/settings/roles/new/page.tsx` (New)
- **Current Features**: Form with display name, slug, description, and admin toggle.
- **Route**: `/dashboard/crm/settings/roles/[id]/page.tsx` (Detail)
- **Current Features**: Shows role overview, people assigned, and a detailed permission matrix (read/write/delete toggles per resource).
- **Route**: `/dashboard/crm/settings/roles/[id]/edit/page.tsx` (Edit)
- **Current Features**: Edits role metadata.

### Webhooks
- **Route**: `/dashboard/crm/settings/webhooks/page.tsx` (List)
- **Current Features**: Lists webhooks with KPIs (active, total, failing). Status toggles, bulk delete.
- **Route**: `/dashboard/crm/settings/webhooks/new/page.tsx` (New)
- **Current Features**: Form for endpoint URL, secret, description, active status, and event subscriptions.
- **Route**: `/dashboard/crm/settings/webhooks/[id]/page.tsx` (Detail)
- **Current Features**: Shows webhook details, event subscriptions, and delivery history table (logs of success/failure).

### Other Settings
- **Route**: `/dashboard/crm/settings/task-settings/page.tsx`
- **Current Features**: Status types and priority definitions for tasks.
- **Route**: `/dashboard/crm/settings/taskboard-preferences/page.tsx`
- **Current Features**: Client wrapper for taskboard customization (columns, defaults).
- **Route**: `/dashboard/crm/settings/sign-up-settings/page.tsx`
- **Current Features**: Configures client sign-up (allow signups, admin approval requirement, terms link/text).
- **Route**: `/dashboard/crm/settings/saved-searches/page.tsx`
- **Current Features**: Renders saved searches client view.
- **Route**: `/dashboard/crm/settings/public-payment/page.tsx`
- **Current Features**: Integrates Razorpay/Stripe details, API keys, test mode toggle.
- **Route**: `/dashboard/crm/settings/tags/page.tsx`, `/dashboard/crm/settings/taxes/page.tsx`, `/dashboard/crm/settings/unit-types/page.tsx`
- **Current Features**: Taxonomies/lists management.
- **Route**: `/dashboard/crm/settings/store/page.tsx`
- **Current Features**: Standard ecommerce settings (currency, inventory sync).

## Setup Wizard
- **Route**: `/dashboard/crm/setup/page.tsx`
- **Current Features**: Multi-step onboarding (Profile, CRM prefs, Team invites, Integrations). Skips if already configured.

## CRM Store Module (`/dashboard/crm/store/*`)

### Orders
- **Route**: `/dashboard/crm/store/orders/page.tsx` (List)
- **Current Features**: Comprehensive order list. KPIs: revenue, open, unfulfilled. Filters by payment/fulfillment status. Bulk fulfill/cancel.
- **Route**: `/dashboard/crm/store/orders/[orderId]/page.tsx` (Detail)
- **Current Features**: Shows items, totals, payment details, customer info, and order timeline. Status updates.

### Products
- **Route**: `/dashboard/crm/store/products/page.tsx` (List)
- **Current Features**: KPIs: total, published, draft, low stock. Filters by status, storefront. Bulk publish/archive.
- **Route**: `/dashboard/crm/store/products/new/page.tsx` & `[id]/edit/page.tsx` (Forms)
- **Current Features**: Product forms wrapping `ProductForm`.
- **Route**: `/dashboard/crm/store/products/[id]/page.tsx` (Detail)
- **Current Features**: SKU, pricing, inventory, categories, tags, images.

### Storefronts
- **Route**: `/dashboard/crm/store/storefronts/page.tsx` (List)
- **Current Features**: Lists storefronts (domain, currency, status). KPIs. Bulk actions.
- **Route**: `/dashboard/crm/store/storefronts/new/page.tsx` & `[id]/edit/page.tsx` (Forms)
- **Current Features**: Edits storefront domain/slug/currency.
- **Route**: `/dashboard/crm/store/storefronts/[id]/page.tsx` (Detail)
- **Current Features**: Details including a raw JSON preview of homepage layout blocks.

### Shipping & Pricing
- **Route**: `/dashboard/crm/store/shipping/page.tsx` (List)
- **Current Features**: Shipping zones, states, countries coverage, method configurations.
- **Route**: `/dashboard/crm/store/shipping/new/page.tsx` & `[id]/page.tsx` & `[id]/edit/page.tsx`
- **Current Features**: Define regions and rates.
- **Route**: `/dashboard/crm/store/pricing/page.tsx` (List)
- **Current Features**: Pricing rules (discounts/surcharges). Filter by storefront, kind.
- **Route**: `/dashboard/crm/store/pricing/new/page.tsx` & `[id]/page.tsx` & `[id]/edit/page.tsx`
- **Current Features**: Rule definitions (percent vs absolute).

### Abandoned Carts
- **Route**: `/dashboard/crm/store/abandoned-cart/page.tsx`
- **Current Features**: Renders `AbandonedCartsClient` to view and potentially recover lost carts.

## Tasks Module (`/dashboard/crm/tasks/*`)

- **Route**: `/dashboard/crm/tasks/page.tsx` (List)
- **Current Features**: Advanced list with KPI strip (Open, Overdue). Filters by status, priority, due date. "Assigned to me" toggle.
- **Route**: `/dashboard/crm/tasks/new/page.tsx` & `[id]/edit/page.tsx` (Forms)
- **Current Features**: Task creation wrapper.
- **Route**: `/dashboard/crm/tasks/[id]/page.tsx` (Detail)
- **Current Features**: Task summary, assignment control, read-only checklist, and attachments. Linked entity (e.g. Deal or Ticket).

## Tax & GST Module (`/dashboard/crm/tax/*`)

### E-Way Bills
- **Route**: `/dashboard/crm/tax/eway-bills/page.tsx` (List)
- **Current Features**: Tracks Indian E-Way Bills for goods transport. KPIs for active/expired/cancelled.
- **Route**: `/dashboard/crm/tax/eway-bills/new/page.tsx` (New)
- **Current Features**: Generates e-way bill from consignment details and an optional linked invoice.
- **Route**: `/dashboard/crm/tax/eway-bills/[id]/page.tsx` (Detail)
- **Current Features**: Includes Validity Countdown, Provider status, QR Code renderer, transporter details, HSN/Tax item splits, and action history.

### GST Returns
- **Route**: `/dashboard/crm/tax/gstr1/page.tsx` & `/dashboard/crm/tax/gstr2b/page.tsx`
- **Current Features**: Thin wrappers for Outward Supplies (GSTR1) and ITC statement (GSTR2B).
- **Route**: `/dashboard/crm/tax/gstr3b/page.tsx`
- **Current Features**: GSTR-3B monthly summary. Period picker -> Generate action. Shows 9-section summary table, Total Tax, Net Payable. Filing history tracking. Export to XLSX/CSV.

## Overall Architecture Patterns & Findings
- Standardizes on `EntityListShell` and `EntityDetailShell` for layout.
- Heavy use of Server Actions (`@/app/actions/*`) paired with `useTransition` for bulk actions.
- KPI Strips are ubiquitous in lists, updating dynamically.
- `ZoruUI` component library provides tables, forms, buttons, dropdowns, and dialogs.

## Enhancements & Possible Features
- **Storefront Blocks**: Upgrade from raw JSON preview in `/storefronts/[id]/page.tsx` to a visual drag-and-drop builder using `ZoruUI`.
- **E-Way Bills**: Add direct e-way bill extension or cancellation directly from the Detail view, auto-syncing with GST portal.
- **GSTR Validation**: Pre-flight checks on invoices before GSTR generation to flag missing HSN codes or incorrect tax rates.
- **Roles**: Provide a diff view when editing a role's permissions to prevent accidental privilege escalation.
- **Webhooks**: Provide a "Test Delivery" button on the webhook detail view to manually trigger a payload.
