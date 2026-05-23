# Masterplan Chunk 13

This document contains the analysis for chunk 13, covering CRM Sales modules including Gift Cards, Invoices, Loyalty Programs, and Sales Orders.

## Route / Component: `/dashboard/crm/sales/gift-cards`
- **Current Features**:
  - `page.tsx`: Deep list page for gift cards with a KPI strip (total issued, active, redeemed, expiring), filters, and bulk actions.
  - `new/page.tsx`: Form to issue a new gift card with fields for code, recipient, value, expiry date, and transferability.
- **Possible Features**:
  - Email integration to directly dispatch the gift card to the recipient upon creation.
  - QR code or Barcode generation for physical gift card printing.
  - Partial redemption tracking UI on the detail page.
- **Errors**:
  - Minimal type issues, but `resolveIssuedTo` assumes ID properties which might not accurately reflect populated refs if unpopulated.
- **Enhancement Plan**:
  - Build a visual gift card preview in the `new/page.tsx` form.
  - Add quick action to "Email Gift Card" from the list and detail views.

## Route / Component: `/dashboard/crm/sales/invoices`
- **Current Features**:
  - `page.tsx`: Canonical Invoices list with KPI aggregates, search, pagination, and customer name hydration.
  - `[id]/page.tsx`: Extensive detail view with lineage rail (Lead -> Deal -> Quote -> SO -> Delivery -> Invoice -> Receipt), 360 timeline, related entities, and quick edits.
  - `[id]/e-invoice/page.tsx`: India-specific e-invoice manager. Decodes the signed QR payload and manages IRN status.
  - `duplicates/page.tsx`: A sophisticated duplicate finder that clusters invoices by similarity (total, customer, date) and allows resolving them by keeping a survivor and cancelling the rest.
  - Forms (`new/page.tsx`, `[id]/edit/page.tsx`): Wrappers around the shared `<InvoiceForm>`.
- **Possible Features**:
  - Payment link generation via integrations (Stripe/Razorpay) directly on the invoice detail.
  - Automated follow-up/reminder scheduling for overdue invoices.
- **Errors**:
  - In `[id]/e-invoice/page.tsx`, `decodeQrPayload` uses `Buffer.from(b64, 'base64')`. While safe in Node.js, if this component is ever moved to the Edge runtime, it will crash (Edge requires `atob` or a polyfill).
- **Enhancement Plan**:
  - Implement a real visual QR code renderer in `e-invoice/page.tsx` instead of displaying raw JSON data.
  - The `duplicates/page.tsx` UI could benefit from a visual diff viewer to compare the line items of duplicate invoices before merging.

## Route / Component: `/dashboard/crm/sales/loyalty`
- **Current Features**:
  - `page.tsx`: List of loyalty programs with KPIs (total members, points outstanding, etc.).
  - `new/page.tsx`, `[id]/edit/page.tsx`, `[id]/page.tsx`: CRUD for loyalty programs defining points per unit, redemption ratio, expiry, welcome bonus, and tiers.
- **Possible Features**:
  - Customer portal widget integration to allow customers to check their tier and points.
  - Automated tier upgrade/downgrade logic visualizer.
- **Errors**:
  - High reliance on `any` types in `[id]/page.tsx` (`const program: Record<string, any> = result!;`). Missing type safety on `tiers` mapping could lead to runtime errors if `result.tiers` is undefined or malformed.
- **Enhancement Plan**:
  - Enforce strict typing on `LoyaltyProgram` documents.
  - Add a "Simulate Points" calculator on the detail page to help staff explain point accrual to customers.

## Route / Component: `/dashboard/crm/sales/orders`
- **Current Features**:
  - `[id]/page.tsx`: Sales order detail with a 10-button action group, fulfillment progress (delivered/invoiced tracking per line item), totals breakout, and lineage rail.
  - `cart/page.tsx`: A dedicated draft cart page for building orders quickly.
- **Possible Features**:
  - Inventory stock check indicators directly on the line items.
  - One-click splitting of a Sales Order into multiple Delivery Challans if items are backordered.
- **Errors**:
  - In `cart/page.tsx`, `discount` state is not tightly constrained and could be submitted as a negative value or string, potentially bypassing backend validation.
- **Enhancement Plan**:
  - Connect the `<SalesOrdersDetailFulfillment>` UI with real-time inventory levels to flag out-of-stock items.
  - Add input validation to `cart/page.tsx` for tax and discount fields to prevent NaN or negative calculations.
