# Page Analysis: Chunk 22 (Finance & HR)

This document contains the analysis of the 45 Next.js page files assigned to Agent 22.

## Finance Module Pages

### 1. `src/app/dashboard/finance/payouts/page.tsx`
- **Route / Component**: `/dashboard/finance/payouts`
- **Current Features**: A server-side page component that fetches initial data via `listPayouts` and passes it to the `PayoutListClient` component.
- **Possible Features**: Real-time updates for payout status changes via websockets, summary cards for total payouts pending vs. completed.
- **Errors**: No explicit error handling fallback UI, simply passes `error` prop to client component.
- **Enhancement Plan**: Implement a React Suspense boundary or standard Next.js `error.tsx` file to handle underlying server action failures more gracefully.

### 2. `src/app/dashboard/finance/po-approvals/page.tsx`
- **Route / Component**: `/dashboard/finance/po-approvals`
- **Current Features**: Wrapper page fetching initial purchase orders and rendering `PurchaseOrderListClient`.
- **Possible Features**: Add inline approval/rejection quick actions directly from the list page summary.
- **Errors**: Similar to payouts, relies on the client component to handle the `error` object.
- **Enhancement Plan**: Add loading skeleton states using Suspense.

### 3. `src/app/dashboard/finance/subscriptions/page.tsx`
- **Route / Component**: `/dashboard/finance/subscriptions`
- **Current Features**: Wrapper page fetching subscriptions via `listSubscriptions` and rendering `SubscriptionListClient`.
- **Possible Features**: Analytics on upcoming renewals, MRR/ARR summaries based on the active subscriptions.
- **Errors**: Standard generic error passing to client.
- **Enhancement Plan**: Consolidate error handling and ensure the layout handles empty states when no subscriptions exist.

### 4. `src/app/dashboard/finance/taxes/page.tsx`
- **Route / Component**: `/dashboard/finance/taxes`
- **Current Features**: Wrapper page fetching tax records and rendering `TaxRecordListClient`.
- **Possible Features**: Regional tax reporting widgets or CSV export capabilities on the server side.
- **Errors**: None observed; error is passed correctly to the client component.
- **Enhancement Plan**: Introduce a period/year filter in the server URL params to pre-filter data before passing to client.

### 5. `src/app/dashboard/finance/vendor-portal/page.tsx`
- **Route / Component**: `/dashboard/finance/vendor-portal`
- **Current Features**: Wrapper page fetching vendors via `listVendors` and rendering `VendorListClient`.
- **Possible Features**: Vendor performance scoring, contact directory integration.
- **Errors**: Simple data passthrough.
- **Enhancement Plan**: Add standard `<EntityListShell>` layout patterns if the client component doesn't fully adopt it yet.

## HR Module Pages

### 6. `src/app/dashboard/hrm/hr/announcements` (CRUD)
- **Routes / Components**: `page.tsx`, `new/page.tsx`, `[id]/page.tsx`, `[id]/edit/page.tsx`
- **Current Features**: Full CRUD for HR Announcements.
  - `page.tsx`: Uses `<EntityListShell>`, fetches `CrmAnnouncementDoc`s, has enum filters for status/category/audience. Contains an `AlertDialog` for archiving/deleting.
  - `new` & `edit`: Wraps the `<AnnouncementForm>`.
  - `[id]`: Detail view showing banner images, audience summary, scheduling details, view counts, and acknowledgement stats.
- **Possible Features**: Push notifications / email broadcasts upon publish; Rich text editor for body instead of a basic textarea.
- **Errors**: The detail page expects a string for category/audience, but forces casting: `titleCase(announcement.category as string)`. This could fail if the field is omitted.
- **Enhancement Plan**: Ensure fallback values for all enum fields before rendering string manipulations. Migrate `body` to a rich-text block component.

### 7. `src/app/dashboard/hrm/hr/asset-assignments` (CRUD)
- **Routes / Components**: `page.tsx`, `new/page.tsx`, `[id]/page.tsx`, `[id]/edit/page.tsx`
- **Current Features**: Maps an asset to an employee. Detailed status tracking (`assigned`, `returned`, `lost`, `damaged`). List uses `<EntityListShell>`, detailed page shows assignment/return dates and condition.
- **Possible Features**: PDF generation for "Asset Handover Document" with e-signature.
- **Errors**: None. Safe fallback rendering for statuses.
- **Enhancement Plan**: Add history logging of previous assignments linked to the same asset in the detailed view.

### 8. `src/app/dashboard/hrm/hr/assets` (CRUD)
- **Routes / Components**: `page.tsx`, `new/page.tsx`, `[id]/page.tsx`, `[id]/edit/page.tsx`
- **Current Features**: IT and office asset register. `page.tsx` handles filtering by category and status. `[id]` page displays warranty, purchase price, and location.
- **Possible Features**: QR code generation for asset tags, automated depreciation calculation.
- **Errors**: Safe rendering of `fmtMoney` prevents NaN.
- **Enhancement Plan**: Add a quick "Assign" modal from the list view directly without navigating to the assignment creation page.

### 9. `src/app/dashboard/hrm/hr/awards` (CRUD)
- **Routes / Components**: `page.tsx`, `new/page.tsx`, `[programId]/page.tsx`, `[programId]/edit/page.tsx`
- **Current Features**: Manages award programs (e.g. Employee of the Month). The detail view `[programId]` has tables for displaying nominations and winners, and actions to "Cast vote" and "Declare winner". `new`/`edit` forms are implemented directly inside the `page.tsx` using `useActionState`.
- **Possible Features**: Peer-to-peer nomination links, integration with payroll for cash value rewards.
- **Errors**: ID casting logic in `page.tsx` map function `(c._id as any)?.toString?.()` is brittle.
- **Enhancement Plan**: Centralize type definitions to avoid manual ID casting and improve form validation using Zod.

### 10. `src/app/dashboard/hrm/hr/candidates`
- **Routes / Components**: `page.tsx`, `new/page.tsx`, `[id]/page.tsx`, `[id]/edit/page.tsx`, `[id]/activity/page.tsx`
- **Current Features**: Recruitment pipeline tracking. Detail page provides an extensive summary (current role, expected role, skills, notes) and quick actions (schedule interview, send offer, reject). The list wraps `CandidatesView` for Kanban/Table toggling. `activity` page shows the `<EntityAuditTimeline>`.
- **Possible Features**: Resume parsing, automated interview scheduling links (Calendly integration), scorecard creation.
- **Errors**: Missing notes composer (noted as `TODO 1D.2` in code).
- **Enhancement Plan**: Implement the inline notes composer and tie it directly into the audit stream as highlighted by the inline TODOs.

### 11. `src/app/dashboard/hrm/hr/careers-page/page.tsx`
- **Route / Component**: `/dashboard/hrm/hr/careers-page`
- **Current Features**: A singleton configuration page for the public careers site. Configures slug, primary color, logo, headline, intro, CTA, and visibility.
- **Possible Features**: Full WYSIWYG editor for the careers page, custom domain mapping.
- **Errors**: Forms rely heavily on casting to `any` for `value(key)`. SEO fields are omitted pending schema updates (marked as `TODO 1D.4`).
- **Enhancement Plan**: Add the SEO meta fields (title, description, OG image) as planned in the TODO.

### 12. `src/app/dashboard/hrm/hr/certifications` (CRUD)
- **Routes / Components**: `page.tsx`, `new/page.tsx`, `[id]/page.tsx`, `[id]/edit/page.tsx`
- **Current Features**: Tracks employee certifications and expirations. The list view groups by expiry (Valid, Expiring 90d, Expired). Uses `<HrFormPage>` for edit/new.
- **Possible Features**: Automated renewal reminder emails 30/60/90 days before expiry.
- **Errors**: In `[id]/page.tsx`, the `getCertifications` function returns an untyped list which is manually cast.
- **Enhancement Plan**: Switch to a direct DB query for a specific certification rather than fetching all of them in the `[id]` page.

### 13. `src/app/dashboard/hrm/hr/compensation-bands` (CRUD)
- **Routes / Components**: `page.tsx`, `new/page.tsx`, `[id]/page.tsx`, `[id]/edit/page.tsx`
- **Current Features**: Salary bands by level and role. Displays average min/max salaries in KPIs. Detail page lists requirements like experience min/max and geography multipliers.
- **Possible Features**: Visual chart comparing current employee salaries to their bands (Compa-ratio analysis).
- **Errors**: `<LineChart className="hidden" />` is used on the detail page arbitrarily, possibly as a styling hack or unused import.
- **Enhancement Plan**: Remove unused hidden icons and introduce a graphical range visualization component for the min/mid/max values.

### 14. `src/app/dashboard/hrm/hr/directory/page.tsx`
- **Route / Component**: `/dashboard/hrm/hr/directory`
- **Current Features**: Read-only employee directory with both grid and list views. Supports text search and generates deterministic placeholder avatars.
- **Possible Features**: Org-chart tree view, advanced filtering by location/department.
- **Errors**: Loading state doesn't account for failed network requests elegantly (though it does have a generic `failed` boolean flag).
- **Enhancement Plan**: Abstract the `Employee` type to a shared definitions file. 

### 15. `src/app/dashboard/hrm/hr/disciplinary` (CRUD)
- **Routes / Components**: `page.tsx`, `new/page.tsx`, `[caseId]/page.tsx`, `[caseId]/edit/page.tsx`
- **Current Features**: Confidential register for disciplinary cases. Detail page shows case details, hearings timeline, and evidence links. Actions allow escalating, appealing, or closing cases.
- **Possible Features**: Document generation for formal warning letters, restricted access controls (RBAC) specifically tailored for this sub-module.
- **Errors**: No strict enforcement of `userId` access in the list view other than simple query filtering.
- **Enhancement Plan**: The "Add Hearing" button is currently disabled. Implement the `Add Hearing` modal and associated server action.

### 16. `src/app/dashboard/hrm/hr/document-templates` (CRUD)
- **Routes / Components**: `page.tsx`, `new/page.tsx`, `[id]/page.tsx`, `[id]/edit/page.tsx`
- **Current Features**: HR document templates supporting `{{token}}` replacements. Detail page displays the template body and available merge tokens. List page shows the count of variables.
- **Possible Features**: A variable picker sidebar when editing the template, live preview with mock employee data.
- **Errors**: Relies on a generic `<ClipboardList className="hidden" />` which serves no purpose.
- **Enhancement Plan**: Implement a rich text editor or markdown editor for the template body instead of relying on standard textareas.

### 17. `src/app/dashboard/hrm/hr/documents/[id]/edit/page.tsx`
- **Route / Component**: `/dashboard/hrm/hr/documents/[id]/edit`
- **Current Features**: Wrapper around `<DocumentForm>` for updating an existing filled HR document.
- **Possible Features**: Version history for filled documents.
- **Errors**: None.
- **Enhancement Plan**: Ensure auto-saving drafts are supported in the inner `<DocumentForm>`.

---
**Summary of Architecture & UI Guidelines Observed:**
- Heavily relies on `<EntityListShell>` and `<EntityDetailShell>` for consistent layouts.
- Reusable components like `<StatusPill>`, `<HrActionButtons>`, and `zoruui` cards.
- Server Actions drive the data fetching (`get*`) and mutations (`save*`, `delete*`).
- Consistent use of KPI grids in list views.
