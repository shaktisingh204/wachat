# Masterplan Chunk 12 Analysis

This document contains the analysis of the `src/app/dashboard/crm/sales/*` route files assigned to agent 12.

## 1. CRM Clients
**Route / Component:** `src/app/dashboard/crm/sales/clients/page.tsx`
- **Current Features:** Displays a list of CRM accounts (Clients & Prospects). Integrates `EntityListShell` and `<CrmAddClientDialog>`. Uses KPI cards for account metrics (Total, Active, Strategic, ARR). Supports client-side filtering (by industry and status) on top of server-fetched rows, pagination, bulk archive/delete, and CSV/XLSX export functions.
- **Possible Features:** Add advanced segmentation based on engagement scores, last contact date, or deal stage. Implement a map view for clients based on address.
- **Errors:** No severe errors, but the `fmtMoney` utility handles errors gracefully by falling back to `.toLocaleString()`. Client-side filtering on server-paginated data might produce inconsistent views if total pages are calculated before filtering.
- **Enhancement Plan:** Move industry and status filters to the server-side API query so that pagination reflects the filtered dataset accurately. Add a column for "Last Activity" or "Account Owner".

## 2. Contacts (Legacy Redirects)
**Routes:** 
- `src/app/dashboard/crm/sales/contacts/[contactId]/edit/page.tsx`
- `src/app/dashboard/crm/sales/contacts/[contactId]/page.tsx`
- `src/app/dashboard/crm/sales/contacts/new/page.tsx`
- `src/app/dashboard/crm/sales/contacts/page.tsx`
- **Current Features:** These files serve as `permanentRedirect` routes to `/dashboard/crm/sales-crm/contacts/*`, preserving query parameters (e.g., `?accountId=...`).
- **Possible Features:** None (they exist solely for backward compatibility).
- **Errors:** No errors found.
- **Enhancement Plan:** Monitor analytics for hits on these old routes. Once deep-link usage reaches zero, these files can be safely removed to prune the routing tree.

## 3. Contracts
**Routes:**
- `src/app/dashboard/crm/sales/contracts/page.tsx`
- `src/app/dashboard/crm/sales/contracts/[contractId]/activity/page.tsx`
- `src/app/dashboard/crm/sales/contracts/[contractId]/edit/page.tsx`
- `src/app/dashboard/crm/sales/contracts/[contractId]/page.tsx`
- `src/app/dashboard/crm/sales/contracts/new/page.tsx`
- `src/app/dashboard/crm/sales/contracts/renewals/page.tsx`
- `src/app/dashboard/crm/sales/contracts/templates/...`
- `src/app/dashboard/crm/sales/contracts/types/page.tsx`
- **Current Features:** The index page (`page.tsx`) is a server component that fetches paginated contracts and KPI data in parallel, passing them to `<ContractListClient>`. It forms the core of the contract lifecycle management.
- **Possible Features:** Integrate an e-signature tracking dashboard directly into the `activity` route. Setup automated renewal reminders.
- **Errors:** None apparent in the server wrapper. 
- **Enhancement Plan:** Migrate filter states (status, date ranges) into URL parameters to allow deep linking to specific filtered contract views.

## 4. Coupons
**Routes:**
- `src/app/dashboard/crm/sales/coupons/page.tsx`
- `src/app/dashboard/crm/sales/coupons/[id]/activity/page.tsx`
- `src/app/dashboard/crm/sales/coupons/[id]/edit/page.tsx`
- `src/app/dashboard/crm/sales/coupons/[id]/page.tsx`
- `src/app/dashboard/crm/sales/coupons/new/page.tsx`
- **Current Features:** Deep list page managing promo codes, free shipping vouchers, and discounts. Tracks active/expired status, redemptions, and value. Includes bulk status updates and dynamic ExcelJS integration for XLSX exports.
- **Possible Features:** Add a coupon performance chart (redemptions over time). Allow linking coupons to specific product categories or customer segments natively from the list.
- **Errors:** Dynamic import of `exceljs` (`const ExcelJS = (await import('exceljs')).default;`) is not wrapped in a `try...catch` block. If the chunk fails to load, it will cause an unhandled promise rejection.
- **Enhancement Plan:** Wrap the Excel export logic in a `try...catch` and display a toast error if it fails. Move complex formatting logic like `formatValue` and `formatValidity` to shared utility files.

## 5. Credit Notes
**Routes:**
- `src/app/dashboard/crm/sales/credit-notes/page.tsx`
- `src/app/dashboard/crm/sales/credit-notes/[id]/activity/page.tsx`
- `src/app/dashboard/crm/sales/credit-notes/[id]/edit/page.tsx`
- `src/app/dashboard/crm/sales/credit-notes/[id]/page.tsx`
- `src/app/dashboard/crm/sales/credit-notes/new/page.tsx`
- **Current Features:** Issues refunds/credits against prior invoices. The list page utilizes `<EntityListShell>` with a KPI strip, advanced filters (reason, refund mode, customer), and bulk actions.
- **Possible Features:** Allow auto-applying credit notes to future invoices from the same client directly from the dashboard.
- **Errors:** Status filtering has mixed client-side and server-side logic (e.g., `if (statusFilter === 'pending') return undefined; // computed client-side`). This will break pagination.
- **Enhancement Plan:** Refactor the API action `listCreditNotes` to natively support the `'pending'` status so that all filtering is strictly server-side, ensuring accurate total counts and pagination.

## 6. Delivery Challans
**Routes:**
- `src/app/dashboard/crm/sales/delivery/page.tsx`
- `src/app/dashboard/crm/sales/delivery/[challanId]/activity/page.tsx`
- `src/app/dashboard/crm/sales/delivery/[challanId]/edit/page.tsx`
- `src/app/dashboard/crm/sales/delivery/[challanId]/page.tsx`
- `src/app/dashboard/crm/sales/delivery/new/page.tsx`
- **Current Features:** Server component rendering delivery management. Loads a wide window (up to 200 items) to approximate client-side filtering and KPI bucketing as a temporary measure until Phase 2 is implemented.
- **Possible Features:** Print bulk delivery challans or generate combined dispatch manifests. Integrate tracking URL generation for transporters.
- **Errors:** "Temporary approximation" logic (fetching 200 records and filtering in memory) causes data mismatch if the system has >200 challans.
- **Enhancement Plan:** Expedite the Phase 2 W4 Rust crate migration to implement proper `/counts` and server-side filtered pagination for delivery challans.

## 7. Estimate Requests & Templates
**Routes:**
- `src/app/dashboard/crm/sales/estimate-requests/page.tsx` (and nested `[requestId]`)
- `src/app/dashboard/crm/sales/estimates-templates/page.tsx` (and nested `[templateId]`)
- **Current Features:** `estimate-requests` manages incoming quotes/requests with an embedded "New Request" fast-form. `estimates-templates` manages reusable quote templates with bulk archive, bulk delete, and CSV export.
- **Possible Features:** One-click conversion of an `estimate-request` into a drafted Estimate/Proposal using an `estimate-template`.
- **Errors:** In `estimate-requests`, the `saveEstimateRequest` action error response could be more robustly handled if fields fail validation (currently relies entirely on the server returning an `error` string).
- **Enhancement Plan:** Implement a visual drag-and-drop template builder for estimate templates instead of just standard forms. Ensure table rows use consistent hydration patterns.

## 8. Forms (Legacy Redirects)
**Routes:**
- `src/app/dashboard/crm/sales/forms/[formId]/edit/page.tsx`
- `src/app/dashboard/crm/sales/forms/[formId]/page.tsx`
- `src/app/dashboard/crm/sales/forms/new/page.tsx`
- `src/app/dashboard/crm/sales/forms/page.tsx`
- **Current Features:** Permanent redirects mapping old `/dashboard/crm/sales/forms/*` routes to `/dashboard/crm/sales-crm/forms/*`.
- **Possible Features:** None.
- **Errors:** No errors.
- **Enhancement Plan:** Clean up from the Next.js router once analytics show these are no longer organically hit.

## 9. Gift Cards
**Routes:**
- `src/app/dashboard/crm/sales/gift-cards/page.tsx`
- `src/app/dashboard/crm/sales/gift-cards/[id]/edit/page.tsx`
- `src/app/dashboard/crm/sales/gift-cards/[id]/page.tsx`
- `src/app/dashboard/crm/sales/gift-cards/new/page.tsx`
- **Current Features:** Deep list page mapping gift cards with balances, issues, and transfers. Detail page provides an audit timeline. Edit page explicitly restricts financial field modifications. 
- **Possible Features:** Option to resend gift card email/SMS to the customer. Add a QR code generation feature for in-store redemption.
- **Errors:** Similar to coupons, `ExcelJS` dynamic import is not error-handled.
- **Enhancement Plan:** Add `try-catch` around the export functionalities. Implement a dedicated "Add Funds" workflow if gift cards are reloadable (or explicitly mark them as non-reloadable in the UI to prevent confusion).
