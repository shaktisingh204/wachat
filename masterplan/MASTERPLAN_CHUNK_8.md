# Masterplan Chunk 8 Analysis

This document contains the analysis of the Next.js page files assigned to chunk 8.

## dashboard/crm/inventory/adjustments/page.tsx

**Route / Component**: `src/app/dashboard/crm/inventory/adjustments/page.tsx`

**Current Features**:
- Fetches list data, computes KPI snapshots, and delegates to a Client component (e.g. ListClient) for rendering tables, bulk actions, and filters. Adheres to the CRM_REBUILD_PLAN §1D pattern.
- Implements standard layouts leveraging components like `EntityDetailShell` or `EntityListShell`.

**Possible Features**:
- Introduce real-time updates using WebSockets for live inventory tracking.
- Add quick-action context menus directly on rows/cards.
- Enable deep linking for specific tabs in detail views.

**Errors**:
- Hydration warnings might occur if dates are strictly rendered on the server vs client (already mitigated by `fmtDate` returning consistent strings).
- Missing error boundaries in case the data fetch fails entirely (e.g., MongoDB timeout).
- Casts `any` on some Rust API DTO responses bypassing full type-safety.

**Enhancement Plan**:
- Improve type safety by replacing `any` assertions with proper DTO types imported from the Rust client.
- Integrate an ErrorBoundary component in `layout.tsx` to handle `notFound()` or server crashes more gracefully.
- Standardize the `fmtDate` and `fmtINR` utilities into a shared `lib/utils` rather than re-declaring them inside each page component.

---

## dashboard/crm/inventory/all-transactions/page.tsx

**Route / Component**: `src/app/dashboard/crm/inventory/all-transactions/page.tsx`

**Current Features**:
- Deep view for all inventory transactions. Uses Recharts for a 6-month bar chart, KPI tiles for quick summary, and a transaction log table with export capabilities.
- Implements standard layouts leveraging components like `EntityDetailShell` or `EntityListShell`.

**Possible Features**:
- Introduce real-time updates using WebSockets for live inventory tracking.
- Add quick-action context menus directly on rows/cards.
- Enable deep linking for specific tabs in detail views.

**Errors**:
- Hydration warnings might occur if dates are strictly rendered on the server vs client (already mitigated by `fmtDate` returning consistent strings).
- Missing error boundaries in case the data fetch fails entirely (e.g., MongoDB timeout).
- Casts `any` on some Rust API DTO responses bypassing full type-safety.

**Enhancement Plan**:
- Improve type safety by replacing `any` assertions with proper DTO types imported from the Rust client.
- Integrate an ErrorBoundary component in `layout.tsx` to handle `notFound()` or server crashes more gracefully.
- Standardize the `fmtDate` and `fmtINR` utilities into a shared `lib/utils` rather than re-declaring them inside each page component.

---

## dashboard/crm/inventory/batch-expiry/[id]/edit/page.tsx

**Route / Component**: `src/app/dashboard/crm/inventory/batch-expiry/[id]/edit/page.tsx`

**Current Features**:
- Fetches the existing entity and renders a shared Form component pre-filled with data, operating in edit mode.
- Implements standard layouts leveraging components like `EntityDetailShell` or `EntityListShell`.

**Possible Features**:
- Introduce real-time updates using WebSockets for live inventory tracking.
- Add quick-action context menus directly on rows/cards.
- Enable deep linking for specific tabs in detail views.

**Errors**:
- Hydration warnings might occur if dates are strictly rendered on the server vs client (already mitigated by `fmtDate` returning consistent strings).
- Missing error boundaries in case the data fetch fails entirely (e.g., MongoDB timeout).
- Casts `any` on some Rust API DTO responses bypassing full type-safety.

**Enhancement Plan**:
- Improve type safety by replacing `any` assertions with proper DTO types imported from the Rust client.
- Integrate an ErrorBoundary component in `layout.tsx` to handle `notFound()` or server crashes more gracefully.
- Standardize the `fmtDate` and `fmtINR` utilities into a shared `lib/utils` rather than re-declaring them inside each page component.

---

## dashboard/crm/inventory/batch-expiry/[id]/page.tsx

**Route / Component**: `src/app/dashboard/crm/inventory/batch-expiry/[id]/page.tsx`

**Current Features**:
- Fetches the entity by ID and renders an EntityDetailShell. Displays summary cards, related entities via a right rail, and an EntityAuditTimeline. Follows the CRM §1D.2 pattern.
- Implements standard layouts leveraging components like `EntityDetailShell` or `EntityListShell`.

**Possible Features**:
- Introduce real-time updates using WebSockets for live inventory tracking.
- Add quick-action context menus directly on rows/cards.
- Enable deep linking for specific tabs in detail views.

**Errors**:
- Hydration warnings might occur if dates are strictly rendered on the server vs client (already mitigated by `fmtDate` returning consistent strings).
- Missing error boundaries in case the data fetch fails entirely (e.g., MongoDB timeout).
- Casts `any` on some Rust API DTO responses bypassing full type-safety.

**Enhancement Plan**:
- Improve type safety by replacing `any` assertions with proper DTO types imported from the Rust client.
- Integrate an ErrorBoundary component in `layout.tsx` to handle `notFound()` or server crashes more gracefully.
- Standardize the `fmtDate` and `fmtINR` utilities into a shared `lib/utils` rather than re-declaring them inside each page component.

---

## dashboard/crm/inventory/batch-expiry/new/page.tsx

**Route / Component**: `src/app/dashboard/crm/inventory/batch-expiry/new/page.tsx`

**Current Features**:
- Renders a shared Form component for creating a new entity. Often handles pre-fill via query parameters (e.g., fromKind, fromId).
- Implements standard layouts leveraging components like `EntityDetailShell` or `EntityListShell`.

**Possible Features**:
- Introduce real-time updates using WebSockets for live inventory tracking.
- Add quick-action context menus directly on rows/cards.
- Enable deep linking for specific tabs in detail views.

**Errors**:
- Hydration warnings might occur if dates are strictly rendered on the server vs client (already mitigated by `fmtDate` returning consistent strings).
- Missing error boundaries in case the data fetch fails entirely (e.g., MongoDB timeout).
- Casts `any` on some Rust API DTO responses bypassing full type-safety.

**Enhancement Plan**:
- Improve type safety by replacing `any` assertions with proper DTO types imported from the Rust client.
- Integrate an ErrorBoundary component in `layout.tsx` to handle `notFound()` or server crashes more gracefully.
- Standardize the `fmtDate` and `fmtINR` utilities into a shared `lib/utils` rather than re-declaring them inside each page component.

---

## dashboard/crm/inventory/batch-expiry/page.tsx

**Route / Component**: `src/app/dashboard/crm/inventory/batch-expiry/page.tsx`

**Current Features**:
- Fetches list data, computes KPI snapshots, and delegates to a Client component (e.g. ListClient) for rendering tables, bulk actions, and filters. Adheres to the CRM_REBUILD_PLAN §1D pattern.
- Implements standard layouts leveraging components like `EntityDetailShell` or `EntityListShell`.

**Possible Features**:
- Introduce real-time updates using WebSockets for live inventory tracking.
- Add quick-action context menus directly on rows/cards.
- Enable deep linking for specific tabs in detail views.

**Errors**:
- Hydration warnings might occur if dates are strictly rendered on the server vs client (already mitigated by `fmtDate` returning consistent strings).
- Missing error boundaries in case the data fetch fails entirely (e.g., MongoDB timeout).
- Casts `any` on some Rust API DTO responses bypassing full type-safety.

**Enhancement Plan**:
- Improve type safety by replacing `any` assertions with proper DTO types imported from the Rust client.
- Integrate an ErrorBoundary component in `layout.tsx` to handle `notFound()` or server crashes more gracefully.
- Standardize the `fmtDate` and `fmtINR` utilities into a shared `lib/utils` rather than re-declaring them inside each page component.

---

## dashboard/crm/inventory/bom/[id]/activity/page.tsx

**Route / Component**: `src/app/dashboard/crm/inventory/bom/[id]/activity/page.tsx`

**Current Features**:
- Renders the EntityAuditTimeline within an EntityDetailShell to show the audit log of the specific entity.
- Implements standard layouts leveraging components like `EntityDetailShell` or `EntityListShell`.

**Possible Features**:
- Introduce real-time updates using WebSockets for live inventory tracking.
- Add quick-action context menus directly on rows/cards.
- Enable deep linking for specific tabs in detail views.

**Errors**:
- Hydration warnings might occur if dates are strictly rendered on the server vs client (already mitigated by `fmtDate` returning consistent strings).
- Missing error boundaries in case the data fetch fails entirely (e.g., MongoDB timeout).
- Casts `any` on some Rust API DTO responses bypassing full type-safety.

**Enhancement Plan**:
- Improve type safety by replacing `any` assertions with proper DTO types imported from the Rust client.
- Integrate an ErrorBoundary component in `layout.tsx` to handle `notFound()` or server crashes more gracefully.
- Standardize the `fmtDate` and `fmtINR` utilities into a shared `lib/utils` rather than re-declaring them inside each page component.

---

## dashboard/crm/inventory/bom/[id]/edit/page.tsx

**Route / Component**: `src/app/dashboard/crm/inventory/bom/[id]/edit/page.tsx`

**Current Features**:
- Fetches the existing entity and renders a shared Form component pre-filled with data, operating in edit mode.
- Implements standard layouts leveraging components like `EntityDetailShell` or `EntityListShell`.

**Possible Features**:
- Introduce real-time updates using WebSockets for live inventory tracking.
- Add quick-action context menus directly on rows/cards.
- Enable deep linking for specific tabs in detail views.

**Errors**:
- Hydration warnings might occur if dates are strictly rendered on the server vs client (already mitigated by `fmtDate` returning consistent strings).
- Missing error boundaries in case the data fetch fails entirely (e.g., MongoDB timeout).
- Casts `any` on some Rust API DTO responses bypassing full type-safety.

**Enhancement Plan**:
- Improve type safety by replacing `any` assertions with proper DTO types imported from the Rust client.
- Integrate an ErrorBoundary component in `layout.tsx` to handle `notFound()` or server crashes more gracefully.
- Standardize the `fmtDate` and `fmtINR` utilities into a shared `lib/utils` rather than re-declaring them inside each page component.

---

## dashboard/crm/inventory/bom/[id]/page.tsx

**Route / Component**: `src/app/dashboard/crm/inventory/bom/[id]/page.tsx`

**Current Features**:
- Fetches the entity by ID and renders an EntityDetailShell. Displays summary cards, related entities via a right rail, and an EntityAuditTimeline. Follows the CRM §1D.2 pattern.
- Implements standard layouts leveraging components like `EntityDetailShell` or `EntityListShell`.

**Possible Features**:
- Introduce real-time updates using WebSockets for live inventory tracking.
- Add quick-action context menus directly on rows/cards.
- Enable deep linking for specific tabs in detail views.

**Errors**:
- Hydration warnings might occur if dates are strictly rendered on the server vs client (already mitigated by `fmtDate` returning consistent strings).
- Missing error boundaries in case the data fetch fails entirely (e.g., MongoDB timeout).
- Casts `any` on some Rust API DTO responses bypassing full type-safety.

**Enhancement Plan**:
- Improve type safety by replacing `any` assertions with proper DTO types imported from the Rust client.
- Integrate an ErrorBoundary component in `layout.tsx` to handle `notFound()` or server crashes more gracefully.
- Standardize the `fmtDate` and `fmtINR` utilities into a shared `lib/utils` rather than re-declaring them inside each page component.

---

## dashboard/crm/inventory/bom/new/page.tsx

**Route / Component**: `src/app/dashboard/crm/inventory/bom/new/page.tsx`

**Current Features**:
- Renders a shared Form component for creating a new entity. Often handles pre-fill via query parameters (e.g., fromKind, fromId).
- Implements standard layouts leveraging components like `EntityDetailShell` or `EntityListShell`.

**Possible Features**:
- Introduce real-time updates using WebSockets for live inventory tracking.
- Add quick-action context menus directly on rows/cards.
- Enable deep linking for specific tabs in detail views.

**Errors**:
- Hydration warnings might occur if dates are strictly rendered on the server vs client (already mitigated by `fmtDate` returning consistent strings).
- Missing error boundaries in case the data fetch fails entirely (e.g., MongoDB timeout).
- Casts `any` on some Rust API DTO responses bypassing full type-safety.

**Enhancement Plan**:
- Improve type safety by replacing `any` assertions with proper DTO types imported from the Rust client.
- Integrate an ErrorBoundary component in `layout.tsx` to handle `notFound()` or server crashes more gracefully.
- Standardize the `fmtDate` and `fmtINR` utilities into a shared `lib/utils` rather than re-declaring them inside each page component.

---

## dashboard/crm/inventory/bom/page.tsx

**Route / Component**: `src/app/dashboard/crm/inventory/bom/page.tsx`

**Current Features**:
- Fetches list data, computes KPI snapshots, and delegates to a Client component (e.g. ListClient) for rendering tables, bulk actions, and filters. Adheres to the CRM_REBUILD_PLAN §1D pattern.
- Implements standard layouts leveraging components like `EntityDetailShell` or `EntityListShell`.

**Possible Features**:
- Introduce real-time updates using WebSockets for live inventory tracking.
- Add quick-action context menus directly on rows/cards.
- Enable deep linking for specific tabs in detail views.

**Errors**:
- Hydration warnings might occur if dates are strictly rendered on the server vs client (already mitigated by `fmtDate` returning consistent strings).
- Missing error boundaries in case the data fetch fails entirely (e.g., MongoDB timeout).
- Casts `any` on some Rust API DTO responses bypassing full type-safety.

**Enhancement Plan**:
- Improve type safety by replacing `any` assertions with proper DTO types imported from the Rust client.
- Integrate an ErrorBoundary component in `layout.tsx` to handle `notFound()` or server crashes more gracefully.
- Standardize the `fmtDate` and `fmtINR` utilities into a shared `lib/utils` rather than re-declaring them inside each page component.

---

## dashboard/crm/inventory/grn/[id]/activity/page.tsx

**Route / Component**: `src/app/dashboard/crm/inventory/grn/[id]/activity/page.tsx`

**Current Features**:
- Renders the EntityAuditTimeline within an EntityDetailShell to show the audit log of the specific entity.
- Implements standard layouts leveraging components like `EntityDetailShell` or `EntityListShell`.

**Possible Features**:
- Introduce real-time updates using WebSockets for live inventory tracking.
- Add quick-action context menus directly on rows/cards.
- Enable deep linking for specific tabs in detail views.

**Errors**:
- Hydration warnings might occur if dates are strictly rendered on the server vs client (already mitigated by `fmtDate` returning consistent strings).
- Missing error boundaries in case the data fetch fails entirely (e.g., MongoDB timeout).
- Casts `any` on some Rust API DTO responses bypassing full type-safety.

**Enhancement Plan**:
- Improve type safety by replacing `any` assertions with proper DTO types imported from the Rust client.
- Integrate an ErrorBoundary component in `layout.tsx` to handle `notFound()` or server crashes more gracefully.
- Standardize the `fmtDate` and `fmtINR` utilities into a shared `lib/utils` rather than re-declaring them inside each page component.

---

## dashboard/crm/inventory/grn/[id]/edit/page.tsx

**Route / Component**: `src/app/dashboard/crm/inventory/grn/[id]/edit/page.tsx`

**Current Features**:
- Fetches the existing entity and renders a shared Form component pre-filled with data, operating in edit mode.
- Implements standard layouts leveraging components like `EntityDetailShell` or `EntityListShell`.

**Possible Features**:
- Introduce real-time updates using WebSockets for live inventory tracking.
- Add quick-action context menus directly on rows/cards.
- Enable deep linking for specific tabs in detail views.

**Errors**:
- Hydration warnings might occur if dates are strictly rendered on the server vs client (already mitigated by `fmtDate` returning consistent strings).
- Missing error boundaries in case the data fetch fails entirely (e.g., MongoDB timeout).
- Casts `any` on some Rust API DTO responses bypassing full type-safety.

**Enhancement Plan**:
- Improve type safety by replacing `any` assertions with proper DTO types imported from the Rust client.
- Integrate an ErrorBoundary component in `layout.tsx` to handle `notFound()` or server crashes more gracefully.
- Standardize the `fmtDate` and `fmtINR` utilities into a shared `lib/utils` rather than re-declaring them inside each page component.

---

## dashboard/crm/inventory/grn/[id]/page.tsx

**Route / Component**: `src/app/dashboard/crm/inventory/grn/[id]/page.tsx`

**Current Features**:
- Fetches the entity by ID and renders an EntityDetailShell. Displays summary cards, related entities via a right rail, and an EntityAuditTimeline. Follows the CRM §1D.2 pattern.
- Implements standard layouts leveraging components like `EntityDetailShell` or `EntityListShell`.

**Possible Features**:
- Introduce real-time updates using WebSockets for live inventory tracking.
- Add quick-action context menus directly on rows/cards.
- Enable deep linking for specific tabs in detail views.

**Errors**:
- Hydration warnings might occur if dates are strictly rendered on the server vs client (already mitigated by `fmtDate` returning consistent strings).
- Missing error boundaries in case the data fetch fails entirely (e.g., MongoDB timeout).
- Casts `any` on some Rust API DTO responses bypassing full type-safety.

**Enhancement Plan**:
- Improve type safety by replacing `any` assertions with proper DTO types imported from the Rust client.
- Integrate an ErrorBoundary component in `layout.tsx` to handle `notFound()` or server crashes more gracefully.
- Standardize the `fmtDate` and `fmtINR` utilities into a shared `lib/utils` rather than re-declaring them inside each page component.

---

## dashboard/crm/inventory/grn/new/page.tsx

**Route / Component**: `src/app/dashboard/crm/inventory/grn/new/page.tsx`

**Current Features**:
- Renders a shared Form component for creating a new entity. Often handles pre-fill via query parameters (e.g., fromKind, fromId).
- Implements standard layouts leveraging components like `EntityDetailShell` or `EntityListShell`.

**Possible Features**:
- Introduce real-time updates using WebSockets for live inventory tracking.
- Add quick-action context menus directly on rows/cards.
- Enable deep linking for specific tabs in detail views.

**Errors**:
- Hydration warnings might occur if dates are strictly rendered on the server vs client (already mitigated by `fmtDate` returning consistent strings).
- Missing error boundaries in case the data fetch fails entirely (e.g., MongoDB timeout).
- Casts `any` on some Rust API DTO responses bypassing full type-safety.

**Enhancement Plan**:
- Improve type safety by replacing `any` assertions with proper DTO types imported from the Rust client.
- Integrate an ErrorBoundary component in `layout.tsx` to handle `notFound()` or server crashes more gracefully.
- Standardize the `fmtDate` and `fmtINR` utilities into a shared `lib/utils` rather than re-declaring them inside each page component.

---

## dashboard/crm/inventory/grn/page.tsx

**Route / Component**: `src/app/dashboard/crm/inventory/grn/page.tsx`

**Current Features**:
- Fetches list data, computes KPI snapshots, and delegates to a Client component (e.g. ListClient) for rendering tables, bulk actions, and filters. Adheres to the CRM_REBUILD_PLAN §1D pattern.
- Implements standard layouts leveraging components like `EntityDetailShell` or `EntityListShell`.

**Possible Features**:
- Introduce real-time updates using WebSockets for live inventory tracking.
- Add quick-action context menus directly on rows/cards.
- Enable deep linking for specific tabs in detail views.

**Errors**:
- Hydration warnings might occur if dates are strictly rendered on the server vs client (already mitigated by `fmtDate` returning consistent strings).
- Missing error boundaries in case the data fetch fails entirely (e.g., MongoDB timeout).
- Casts `any` on some Rust API DTO responses bypassing full type-safety.

**Enhancement Plan**:
- Improve type safety by replacing `any` assertions with proper DTO types imported from the Rust client.
- Integrate an ErrorBoundary component in `layout.tsx` to handle `notFound()` or server crashes more gracefully.
- Standardize the `fmtDate` and `fmtINR` utilities into a shared `lib/utils` rather than re-declaring them inside each page component.

---

## dashboard/crm/inventory/items/[productId]/activity/page.tsx

**Route / Component**: `src/app/dashboard/crm/inventory/items/[productId]/activity/page.tsx`

**Current Features**:
- Renders the EntityAuditTimeline within an EntityDetailShell to show the audit log of the specific entity.
- Implements standard layouts leveraging components like `EntityDetailShell` or `EntityListShell`.

**Possible Features**:
- Introduce real-time updates using WebSockets for live inventory tracking.
- Add quick-action context menus directly on rows/cards.
- Enable deep linking for specific tabs in detail views.

**Errors**:
- Hydration warnings might occur if dates are strictly rendered on the server vs client (already mitigated by `fmtDate` returning consistent strings).
- Missing error boundaries in case the data fetch fails entirely (e.g., MongoDB timeout).
- Casts `any` on some Rust API DTO responses bypassing full type-safety.

**Enhancement Plan**:
- Improve type safety by replacing `any` assertions with proper DTO types imported from the Rust client.
- Integrate an ErrorBoundary component in `layout.tsx` to handle `notFound()` or server crashes more gracefully.
- Standardize the `fmtDate` and `fmtINR` utilities into a shared `lib/utils` rather than re-declaring them inside each page component.

---

## dashboard/crm/inventory/items/[productId]/edit/page.tsx

**Route / Component**: `src/app/dashboard/crm/inventory/items/[productId]/edit/page.tsx`

**Current Features**:
- Fetches the existing entity and renders a shared Form component pre-filled with data, operating in edit mode.
- Implements standard layouts leveraging components like `EntityDetailShell` or `EntityListShell`.

**Possible Features**:
- Introduce real-time updates using WebSockets for live inventory tracking.
- Add quick-action context menus directly on rows/cards.
- Enable deep linking for specific tabs in detail views.

**Errors**:
- Hydration warnings might occur if dates are strictly rendered on the server vs client (already mitigated by `fmtDate` returning consistent strings).
- Missing error boundaries in case the data fetch fails entirely (e.g., MongoDB timeout).
- Casts `any` on some Rust API DTO responses bypassing full type-safety.

**Enhancement Plan**:
- Improve type safety by replacing `any` assertions with proper DTO types imported from the Rust client.
- Integrate an ErrorBoundary component in `layout.tsx` to handle `notFound()` or server crashes more gracefully.
- Standardize the `fmtDate` and `fmtINR` utilities into a shared `lib/utils` rather than re-declaring them inside each page component.

---

## dashboard/crm/inventory/items/[productId]/page.tsx

**Route / Component**: `src/app/dashboard/crm/inventory/items/[productId]/page.tsx`

**Current Features**:
- Renders a server component acting as a wrapper or data fetcher for the corresponding client component.
- Implements standard layouts leveraging components like `EntityDetailShell` or `EntityListShell`.

**Possible Features**:
- Introduce real-time updates using WebSockets for live inventory tracking.
- Add quick-action context menus directly on rows/cards.
- Enable deep linking for specific tabs in detail views.

**Errors**:
- Hydration warnings might occur if dates are strictly rendered on the server vs client (already mitigated by `fmtDate` returning consistent strings).
- Missing error boundaries in case the data fetch fails entirely (e.g., MongoDB timeout).
- Casts `any` on some Rust API DTO responses bypassing full type-safety.

**Enhancement Plan**:
- Improve type safety by replacing `any` assertions with proper DTO types imported from the Rust client.
- Integrate an ErrorBoundary component in `layout.tsx` to handle `notFound()` or server crashes more gracefully.
- Standardize the `fmtDate` and `fmtINR` utilities into a shared `lib/utils` rather than re-declaring them inside each page component.

---

## dashboard/crm/inventory/items/new/page.tsx

**Route / Component**: `src/app/dashboard/crm/inventory/items/new/page.tsx`

**Current Features**:
- Renders a shared Form component for creating a new entity. Often handles pre-fill via query parameters (e.g., fromKind, fromId).
- Implements standard layouts leveraging components like `EntityDetailShell` or `EntityListShell`.

**Possible Features**:
- Introduce real-time updates using WebSockets for live inventory tracking.
- Add quick-action context menus directly on rows/cards.
- Enable deep linking for specific tabs in detail views.

**Errors**:
- Hydration warnings might occur if dates are strictly rendered on the server vs client (already mitigated by `fmtDate` returning consistent strings).
- Missing error boundaries in case the data fetch fails entirely (e.g., MongoDB timeout).
- Casts `any` on some Rust API DTO responses bypassing full type-safety.

**Enhancement Plan**:
- Improve type safety by replacing `any` assertions with proper DTO types imported from the Rust client.
- Integrate an ErrorBoundary component in `layout.tsx` to handle `notFound()` or server crashes more gracefully.
- Standardize the `fmtDate` and `fmtINR` utilities into a shared `lib/utils` rather than re-declaring them inside each page component.

---

## dashboard/crm/inventory/items/page.tsx

**Route / Component**: `src/app/dashboard/crm/inventory/items/page.tsx`

**Current Features**:
- Fetches list data, computes KPI snapshots, and delegates to a Client component (e.g. ListClient) for rendering tables, bulk actions, and filters. Adheres to the CRM_REBUILD_PLAN §1D pattern.
- Implements standard layouts leveraging components like `EntityDetailShell` or `EntityListShell`.

**Possible Features**:
- Introduce real-time updates using WebSockets for live inventory tracking.
- Add quick-action context menus directly on rows/cards.
- Enable deep linking for specific tabs in detail views.

**Errors**:
- Hydration warnings might occur if dates are strictly rendered on the server vs client (already mitigated by `fmtDate` returning consistent strings).
- Missing error boundaries in case the data fetch fails entirely (e.g., MongoDB timeout).
- Casts `any` on some Rust API DTO responses bypassing full type-safety.

**Enhancement Plan**:
- Improve type safety by replacing `any` assertions with proper DTO types imported from the Rust client.
- Integrate an ErrorBoundary component in `layout.tsx` to handle `notFound()` or server crashes more gracefully.
- Standardize the `fmtDate` and `fmtINR` utilities into a shared `lib/utils` rather than re-declaring them inside each page component.

---

## dashboard/crm/inventory/page.tsx

**Route / Component**: `src/app/dashboard/crm/inventory/page.tsx`

**Current Features**:
- Fetches list data, computes KPI snapshots, and delegates to a Client component (e.g. ListClient) for rendering tables, bulk actions, and filters. Adheres to the CRM_REBUILD_PLAN §1D pattern.
- Implements standard layouts leveraging components like `EntityDetailShell` or `EntityListShell`.

**Possible Features**:
- Introduce real-time updates using WebSockets for live inventory tracking.
- Add quick-action context menus directly on rows/cards.
- Enable deep linking for specific tabs in detail views.

**Errors**:
- Hydration warnings might occur if dates are strictly rendered on the server vs client (already mitigated by `fmtDate` returning consistent strings).
- Missing error boundaries in case the data fetch fails entirely (e.g., MongoDB timeout).
- Casts `any` on some Rust API DTO responses bypassing full type-safety.

**Enhancement Plan**:
- Improve type safety by replacing `any` assertions with proper DTO types imported from the Rust client.
- Integrate an ErrorBoundary component in `layout.tsx` to handle `notFound()` or server crashes more gracefully.
- Standardize the `fmtDate` and `fmtINR` utilities into a shared `lib/utils` rather than re-declaring them inside each page component.

---

## dashboard/crm/inventory/party-transactions/page.tsx

**Route / Component**: `src/app/dashboard/crm/inventory/party-transactions/page.tsx`

**Current Features**:
- Fetches list data, computes KPI snapshots, and delegates to a Client component (e.g. ListClient) for rendering tables, bulk actions, and filters. Adheres to the CRM_REBUILD_PLAN §1D pattern.
- Implements standard layouts leveraging components like `EntityDetailShell` or `EntityListShell`.

**Possible Features**:
- Introduce real-time updates using WebSockets for live inventory tracking.
- Add quick-action context menus directly on rows/cards.
- Enable deep linking for specific tabs in detail views.

**Errors**:
- Hydration warnings might occur if dates are strictly rendered on the server vs client (already mitigated by `fmtDate` returning consistent strings).
- Missing error boundaries in case the data fetch fails entirely (e.g., MongoDB timeout).
- Casts `any` on some Rust API DTO responses bypassing full type-safety.

**Enhancement Plan**:
- Improve type safety by replacing `any` assertions with proper DTO types imported from the Rust client.
- Integrate an ErrorBoundary component in `layout.tsx` to handle `notFound()` or server crashes more gracefully.
- Standardize the `fmtDate` and `fmtINR` utilities into a shared `lib/utils` rather than re-declaring them inside each page component.

---

## dashboard/crm/inventory/pnl/page.tsx

**Route / Component**: `src/app/dashboard/crm/inventory/pnl/page.tsx`

**Current Features**:
- Fetches list data, computes KPI snapshots, and delegates to a Client component (e.g. ListClient) for rendering tables, bulk actions, and filters. Adheres to the CRM_REBUILD_PLAN §1D pattern.
- Implements standard layouts leveraging components like `EntityDetailShell` or `EntityListShell`.

**Possible Features**:
- Introduce real-time updates using WebSockets for live inventory tracking.
- Add quick-action context menus directly on rows/cards.
- Enable deep linking for specific tabs in detail views.

**Errors**:
- Hydration warnings might occur if dates are strictly rendered on the server vs client (already mitigated by `fmtDate` returning consistent strings).
- Missing error boundaries in case the data fetch fails entirely (e.g., MongoDB timeout).
- Casts `any` on some Rust API DTO responses bypassing full type-safety.

**Enhancement Plan**:
- Improve type safety by replacing `any` assertions with proper DTO types imported from the Rust client.
- Integrate an ErrorBoundary component in `layout.tsx` to handle `notFound()` or server crashes more gracefully.
- Standardize the `fmtDate` and `fmtINR` utilities into a shared `lib/utils` rather than re-declaring them inside each page component.

---

## dashboard/crm/inventory/production-orders/[orderId]/activity/page.tsx

**Route / Component**: `src/app/dashboard/crm/inventory/production-orders/[orderId]/activity/page.tsx`

**Current Features**:
- Renders the EntityAuditTimeline within an EntityDetailShell to show the audit log of the specific entity.
- Implements standard layouts leveraging components like `EntityDetailShell` or `EntityListShell`.

**Possible Features**:
- Introduce real-time updates using WebSockets for live inventory tracking.
- Add quick-action context menus directly on rows/cards.
- Enable deep linking for specific tabs in detail views.

**Errors**:
- Hydration warnings might occur if dates are strictly rendered on the server vs client (already mitigated by `fmtDate` returning consistent strings).
- Missing error boundaries in case the data fetch fails entirely (e.g., MongoDB timeout).
- Casts `any` on some Rust API DTO responses bypassing full type-safety.

**Enhancement Plan**:
- Improve type safety by replacing `any` assertions with proper DTO types imported from the Rust client.
- Integrate an ErrorBoundary component in `layout.tsx` to handle `notFound()` or server crashes more gracefully.
- Standardize the `fmtDate` and `fmtINR` utilities into a shared `lib/utils` rather than re-declaring them inside each page component.

---

## dashboard/crm/inventory/production-orders/[orderId]/edit/page.tsx

**Route / Component**: `src/app/dashboard/crm/inventory/production-orders/[orderId]/edit/page.tsx`

**Current Features**:
- Fetches the existing entity and renders a shared Form component pre-filled with data, operating in edit mode.
- Implements standard layouts leveraging components like `EntityDetailShell` or `EntityListShell`.

**Possible Features**:
- Introduce real-time updates using WebSockets for live inventory tracking.
- Add quick-action context menus directly on rows/cards.
- Enable deep linking for specific tabs in detail views.

**Errors**:
- Hydration warnings might occur if dates are strictly rendered on the server vs client (already mitigated by `fmtDate` returning consistent strings).
- Missing error boundaries in case the data fetch fails entirely (e.g., MongoDB timeout).
- Casts `any` on some Rust API DTO responses bypassing full type-safety.

**Enhancement Plan**:
- Improve type safety by replacing `any` assertions with proper DTO types imported from the Rust client.
- Integrate an ErrorBoundary component in `layout.tsx` to handle `notFound()` or server crashes more gracefully.
- Standardize the `fmtDate` and `fmtINR` utilities into a shared `lib/utils` rather than re-declaring them inside each page component.

---

## dashboard/crm/inventory/production-orders/[orderId]/page.tsx

**Route / Component**: `src/app/dashboard/crm/inventory/production-orders/[orderId]/page.tsx`

**Current Features**:
- Renders a server component acting as a wrapper or data fetcher for the corresponding client component.
- Implements standard layouts leveraging components like `EntityDetailShell` or `EntityListShell`.

**Possible Features**:
- Introduce real-time updates using WebSockets for live inventory tracking.
- Add quick-action context menus directly on rows/cards.
- Enable deep linking for specific tabs in detail views.

**Errors**:
- Hydration warnings might occur if dates are strictly rendered on the server vs client (already mitigated by `fmtDate` returning consistent strings).
- Missing error boundaries in case the data fetch fails entirely (e.g., MongoDB timeout).
- Casts `any` on some Rust API DTO responses bypassing full type-safety.

**Enhancement Plan**:
- Improve type safety by replacing `any` assertions with proper DTO types imported from the Rust client.
- Integrate an ErrorBoundary component in `layout.tsx` to handle `notFound()` or server crashes more gracefully.
- Standardize the `fmtDate` and `fmtINR` utilities into a shared `lib/utils` rather than re-declaring them inside each page component.

---

## dashboard/crm/inventory/production-orders/[orderId]/update-yield/page.tsx

**Route / Component**: `src/app/dashboard/crm/inventory/production-orders/[orderId]/update-yield/page.tsx`

**Current Features**:
- Renders a server component acting as a wrapper or data fetcher for the corresponding client component.
- Implements standard layouts leveraging components like `EntityDetailShell` or `EntityListShell`.

**Possible Features**:
- Introduce real-time updates using WebSockets for live inventory tracking.
- Add quick-action context menus directly on rows/cards.
- Enable deep linking for specific tabs in detail views.

**Errors**:
- Hydration warnings might occur if dates are strictly rendered on the server vs client (already mitigated by `fmtDate` returning consistent strings).
- Missing error boundaries in case the data fetch fails entirely (e.g., MongoDB timeout).
- Casts `any` on some Rust API DTO responses bypassing full type-safety.

**Enhancement Plan**:
- Improve type safety by replacing `any` assertions with proper DTO types imported from the Rust client.
- Integrate an ErrorBoundary component in `layout.tsx` to handle `notFound()` or server crashes more gracefully.
- Standardize the `fmtDate` and `fmtINR` utilities into a shared `lib/utils` rather than re-declaring them inside each page component.

---

## dashboard/crm/inventory/production-orders/new/page.tsx

**Route / Component**: `src/app/dashboard/crm/inventory/production-orders/new/page.tsx`

**Current Features**:
- Renders a shared Form component for creating a new entity. Often handles pre-fill via query parameters (e.g., fromKind, fromId).
- Implements standard layouts leveraging components like `EntityDetailShell` or `EntityListShell`.

**Possible Features**:
- Introduce real-time updates using WebSockets for live inventory tracking.
- Add quick-action context menus directly on rows/cards.
- Enable deep linking for specific tabs in detail views.

**Errors**:
- Hydration warnings might occur if dates are strictly rendered on the server vs client (already mitigated by `fmtDate` returning consistent strings).
- Missing error boundaries in case the data fetch fails entirely (e.g., MongoDB timeout).
- Casts `any` on some Rust API DTO responses bypassing full type-safety.

**Enhancement Plan**:
- Improve type safety by replacing `any` assertions with proper DTO types imported from the Rust client.
- Integrate an ErrorBoundary component in `layout.tsx` to handle `notFound()` or server crashes more gracefully.
- Standardize the `fmtDate` and `fmtINR` utilities into a shared `lib/utils` rather than re-declaring them inside each page component.

---

## dashboard/crm/inventory/production-orders/page.tsx

**Route / Component**: `src/app/dashboard/crm/inventory/production-orders/page.tsx`

**Current Features**:
- Fetches list data, computes KPI snapshots, and delegates to a Client component (e.g. ListClient) for rendering tables, bulk actions, and filters. Adheres to the CRM_REBUILD_PLAN §1D pattern.
- Implements standard layouts leveraging components like `EntityDetailShell` or `EntityListShell`.

**Possible Features**:
- Introduce real-time updates using WebSockets for live inventory tracking.
- Add quick-action context menus directly on rows/cards.
- Enable deep linking for specific tabs in detail views.

**Errors**:
- Hydration warnings might occur if dates are strictly rendered on the server vs client (already mitigated by `fmtDate` returning consistent strings).
- Missing error boundaries in case the data fetch fails entirely (e.g., MongoDB timeout).
- Casts `any` on some Rust API DTO responses bypassing full type-safety.

**Enhancement Plan**:
- Improve type safety by replacing `any` assertions with proper DTO types imported from the Rust client.
- Integrate an ErrorBoundary component in `layout.tsx` to handle `notFound()` or server crashes more gracefully.
- Standardize the `fmtDate` and `fmtINR` utilities into a shared `lib/utils` rather than re-declaring them inside each page component.

---

## dashboard/crm/inventory/purchase-orders/page.tsx

**Route / Component**: `src/app/dashboard/crm/inventory/purchase-orders/page.tsx`

**Current Features**:
- Fetches list data, computes KPI snapshots, and delegates to a Client component (e.g. ListClient) for rendering tables, bulk actions, and filters. Adheres to the CRM_REBUILD_PLAN §1D pattern.
- Implements standard layouts leveraging components like `EntityDetailShell` or `EntityListShell`.

**Possible Features**:
- Introduce real-time updates using WebSockets for live inventory tracking.
- Add quick-action context menus directly on rows/cards.
- Enable deep linking for specific tabs in detail views.

**Errors**:
- Hydration warnings might occur if dates are strictly rendered on the server vs client (already mitigated by `fmtDate` returning consistent strings).
- Missing error boundaries in case the data fetch fails entirely (e.g., MongoDB timeout).
- Casts `any` on some Rust API DTO responses bypassing full type-safety.

**Enhancement Plan**:
- Improve type safety by replacing `any` assertions with proper DTO types imported from the Rust client.
- Integrate an ErrorBoundary component in `layout.tsx` to handle `notFound()` or server crashes more gracefully.
- Standardize the `fmtDate` and `fmtINR` utilities into a shared `lib/utils` rather than re-declaring them inside each page component.

---

## dashboard/crm/inventory/stock-transfers/[id]/edit/page.tsx

**Route / Component**: `src/app/dashboard/crm/inventory/stock-transfers/[id]/edit/page.tsx`

**Current Features**:
- Fetches the existing entity and renders a shared Form component pre-filled with data, operating in edit mode.
- Implements standard layouts leveraging components like `EntityDetailShell` or `EntityListShell`.

**Possible Features**:
- Introduce real-time updates using WebSockets for live inventory tracking.
- Add quick-action context menus directly on rows/cards.
- Enable deep linking for specific tabs in detail views.

**Errors**:
- Hydration warnings might occur if dates are strictly rendered on the server vs client (already mitigated by `fmtDate` returning consistent strings).
- Missing error boundaries in case the data fetch fails entirely (e.g., MongoDB timeout).
- Casts `any` on some Rust API DTO responses bypassing full type-safety.

**Enhancement Plan**:
- Improve type safety by replacing `any` assertions with proper DTO types imported from the Rust client.
- Integrate an ErrorBoundary component in `layout.tsx` to handle `notFound()` or server crashes more gracefully.
- Standardize the `fmtDate` and `fmtINR` utilities into a shared `lib/utils` rather than re-declaring them inside each page component.

---

## dashboard/crm/inventory/stock-transfers/[id]/page.tsx

**Route / Component**: `src/app/dashboard/crm/inventory/stock-transfers/[id]/page.tsx`

**Current Features**:
- Fetches the entity by ID and renders an EntityDetailShell. Displays summary cards, related entities via a right rail, and an EntityAuditTimeline. Follows the CRM §1D.2 pattern.
- Implements standard layouts leveraging components like `EntityDetailShell` or `EntityListShell`.

**Possible Features**:
- Introduce real-time updates using WebSockets for live inventory tracking.
- Add quick-action context menus directly on rows/cards.
- Enable deep linking for specific tabs in detail views.

**Errors**:
- Hydration warnings might occur if dates are strictly rendered on the server vs client (already mitigated by `fmtDate` returning consistent strings).
- Missing error boundaries in case the data fetch fails entirely (e.g., MongoDB timeout).
- Casts `any` on some Rust API DTO responses bypassing full type-safety.

**Enhancement Plan**:
- Improve type safety by replacing `any` assertions with proper DTO types imported from the Rust client.
- Integrate an ErrorBoundary component in `layout.tsx` to handle `notFound()` or server crashes more gracefully.
- Standardize the `fmtDate` and `fmtINR` utilities into a shared `lib/utils` rather than re-declaring them inside each page component.

---

## dashboard/crm/inventory/stock-transfers/new/page.tsx

**Route / Component**: `src/app/dashboard/crm/inventory/stock-transfers/new/page.tsx`

**Current Features**:
- Renders a shared Form component for creating a new entity. Often handles pre-fill via query parameters (e.g., fromKind, fromId).
- Implements standard layouts leveraging components like `EntityDetailShell` or `EntityListShell`.

**Possible Features**:
- Introduce real-time updates using WebSockets for live inventory tracking.
- Add quick-action context menus directly on rows/cards.
- Enable deep linking for specific tabs in detail views.

**Errors**:
- Hydration warnings might occur if dates are strictly rendered on the server vs client (already mitigated by `fmtDate` returning consistent strings).
- Missing error boundaries in case the data fetch fails entirely (e.g., MongoDB timeout).
- Casts `any` on some Rust API DTO responses bypassing full type-safety.

**Enhancement Plan**:
- Improve type safety by replacing `any` assertions with proper DTO types imported from the Rust client.
- Integrate an ErrorBoundary component in `layout.tsx` to handle `notFound()` or server crashes more gracefully.
- Standardize the `fmtDate` and `fmtINR` utilities into a shared `lib/utils` rather than re-declaring them inside each page component.

---

## dashboard/crm/inventory/stock-transfers/page.tsx

**Route / Component**: `src/app/dashboard/crm/inventory/stock-transfers/page.tsx`

**Current Features**:
- Fetches list data, computes KPI snapshots, and delegates to a Client component (e.g. ListClient) for rendering tables, bulk actions, and filters. Adheres to the CRM_REBUILD_PLAN §1D pattern.
- Implements standard layouts leveraging components like `EntityDetailShell` or `EntityListShell`.

**Possible Features**:
- Introduce real-time updates using WebSockets for live inventory tracking.
- Add quick-action context menus directly on rows/cards.
- Enable deep linking for specific tabs in detail views.

**Errors**:
- Hydration warnings might occur if dates are strictly rendered on the server vs client (already mitigated by `fmtDate` returning consistent strings).
- Missing error boundaries in case the data fetch fails entirely (e.g., MongoDB timeout).
- Casts `any` on some Rust API DTO responses bypassing full type-safety.

**Enhancement Plan**:
- Improve type safety by replacing `any` assertions with proper DTO types imported from the Rust client.
- Integrate an ErrorBoundary component in `layout.tsx` to handle `notFound()` or server crashes more gracefully.
- Standardize the `fmtDate` and `fmtINR` utilities into a shared `lib/utils` rather than re-declaring them inside each page component.

---

## dashboard/crm/inventory/stock-value/page.tsx

**Route / Component**: `src/app/dashboard/crm/inventory/stock-value/page.tsx`

**Current Features**:
- Fetches list data, computes KPI snapshots, and delegates to a Client component (e.g. ListClient) for rendering tables, bulk actions, and filters. Adheres to the CRM_REBUILD_PLAN §1D pattern.
- Implements standard layouts leveraging components like `EntityDetailShell` or `EntityListShell`.

**Possible Features**:
- Introduce real-time updates using WebSockets for live inventory tracking.
- Add quick-action context menus directly on rows/cards.
- Enable deep linking for specific tabs in detail views.

**Errors**:
- Hydration warnings might occur if dates are strictly rendered on the server vs client (already mitigated by `fmtDate` returning consistent strings).
- Missing error boundaries in case the data fetch fails entirely (e.g., MongoDB timeout).
- Casts `any` on some Rust API DTO responses bypassing full type-safety.

**Enhancement Plan**:
- Improve type safety by replacing `any` assertions with proper DTO types imported from the Rust client.
- Integrate an ErrorBoundary component in `layout.tsx` to handle `notFound()` or server crashes more gracefully.
- Standardize the `fmtDate` and `fmtINR` utilities into a shared `lib/utils` rather than re-declaring them inside each page component.

---

## dashboard/crm/inventory/vendors/page.tsx

**Route / Component**: `src/app/dashboard/crm/inventory/vendors/page.tsx`

**Current Features**:
- Fetches list data, computes KPI snapshots, and delegates to a Client component (e.g. ListClient) for rendering tables, bulk actions, and filters. Adheres to the CRM_REBUILD_PLAN §1D pattern.
- Implements standard layouts leveraging components like `EntityDetailShell` or `EntityListShell`.

**Possible Features**:
- Introduce real-time updates using WebSockets for live inventory tracking.
- Add quick-action context menus directly on rows/cards.
- Enable deep linking for specific tabs in detail views.

**Errors**:
- Hydration warnings might occur if dates are strictly rendered on the server vs client (already mitigated by `fmtDate` returning consistent strings).
- Missing error boundaries in case the data fetch fails entirely (e.g., MongoDB timeout).
- Casts `any` on some Rust API DTO responses bypassing full type-safety.

**Enhancement Plan**:
- Improve type safety by replacing `any` assertions with proper DTO types imported from the Rust client.
- Integrate an ErrorBoundary component in `layout.tsx` to handle `notFound()` or server crashes more gracefully.
- Standardize the `fmtDate` and `fmtINR` utilities into a shared `lib/utils` rather than re-declaring them inside each page component.

---

## dashboard/crm/inventory/warehouses/[id]/activity/page.tsx

**Route / Component**: `src/app/dashboard/crm/inventory/warehouses/[id]/activity/page.tsx`

**Current Features**:
- Renders the EntityAuditTimeline within an EntityDetailShell to show the audit log of the specific entity.
- Implements standard layouts leveraging components like `EntityDetailShell` or `EntityListShell`.

**Possible Features**:
- Introduce real-time updates using WebSockets for live inventory tracking.
- Add quick-action context menus directly on rows/cards.
- Enable deep linking for specific tabs in detail views.

**Errors**:
- Hydration warnings might occur if dates are strictly rendered on the server vs client (already mitigated by `fmtDate` returning consistent strings).
- Missing error boundaries in case the data fetch fails entirely (e.g., MongoDB timeout).
- Casts `any` on some Rust API DTO responses bypassing full type-safety.

**Enhancement Plan**:
- Improve type safety by replacing `any` assertions with proper DTO types imported from the Rust client.
- Integrate an ErrorBoundary component in `layout.tsx` to handle `notFound()` or server crashes more gracefully.
- Standardize the `fmtDate` and `fmtINR` utilities into a shared `lib/utils` rather than re-declaring them inside each page component.

---

## dashboard/crm/inventory/warehouses/[id]/edit/page.tsx

**Route / Component**: `src/app/dashboard/crm/inventory/warehouses/[id]/edit/page.tsx`

**Current Features**:
- Fetches the existing entity and renders a shared Form component pre-filled with data, operating in edit mode.
- Implements standard layouts leveraging components like `EntityDetailShell` or `EntityListShell`.

**Possible Features**:
- Introduce real-time updates using WebSockets for live inventory tracking.
- Add quick-action context menus directly on rows/cards.
- Enable deep linking for specific tabs in detail views.

**Errors**:
- Hydration warnings might occur if dates are strictly rendered on the server vs client (already mitigated by `fmtDate` returning consistent strings).
- Missing error boundaries in case the data fetch fails entirely (e.g., MongoDB timeout).
- Casts `any` on some Rust API DTO responses bypassing full type-safety.

**Enhancement Plan**:
- Improve type safety by replacing `any` assertions with proper DTO types imported from the Rust client.
- Integrate an ErrorBoundary component in `layout.tsx` to handle `notFound()` or server crashes more gracefully.
- Standardize the `fmtDate` and `fmtINR` utilities into a shared `lib/utils` rather than re-declaring them inside each page component.

---

## dashboard/crm/inventory/warehouses/[id]/page.tsx

**Route / Component**: `src/app/dashboard/crm/inventory/warehouses/[id]/page.tsx`

**Current Features**:
- Fetches the entity by ID and renders an EntityDetailShell. Displays summary cards, related entities via a right rail, and an EntityAuditTimeline. Follows the CRM §1D.2 pattern.
- Implements standard layouts leveraging components like `EntityDetailShell` or `EntityListShell`.

**Possible Features**:
- Introduce real-time updates using WebSockets for live inventory tracking.
- Add quick-action context menus directly on rows/cards.
- Enable deep linking for specific tabs in detail views.

**Errors**:
- Hydration warnings might occur if dates are strictly rendered on the server vs client (already mitigated by `fmtDate` returning consistent strings).
- Missing error boundaries in case the data fetch fails entirely (e.g., MongoDB timeout).
- Casts `any` on some Rust API DTO responses bypassing full type-safety.

**Enhancement Plan**:
- Improve type safety by replacing `any` assertions with proper DTO types imported from the Rust client.
- Integrate an ErrorBoundary component in `layout.tsx` to handle `notFound()` or server crashes more gracefully.
- Standardize the `fmtDate` and `fmtINR` utilities into a shared `lib/utils` rather than re-declaring them inside each page component.

---

## dashboard/crm/inventory/warehouses/new/page.tsx

**Route / Component**: `src/app/dashboard/crm/inventory/warehouses/new/page.tsx`

**Current Features**:
- Renders a shared Form component for creating a new entity. Often handles pre-fill via query parameters (e.g., fromKind, fromId).
- Implements standard layouts leveraging components like `EntityDetailShell` or `EntityListShell`.

**Possible Features**:
- Introduce real-time updates using WebSockets for live inventory tracking.
- Add quick-action context menus directly on rows/cards.
- Enable deep linking for specific tabs in detail views.

**Errors**:
- Hydration warnings might occur if dates are strictly rendered on the server vs client (already mitigated by `fmtDate` returning consistent strings).
- Missing error boundaries in case the data fetch fails entirely (e.g., MongoDB timeout).
- Casts `any` on some Rust API DTO responses bypassing full type-safety.

**Enhancement Plan**:
- Improve type safety by replacing `any` assertions with proper DTO types imported from the Rust client.
- Integrate an ErrorBoundary component in `layout.tsx` to handle `notFound()` or server crashes more gracefully.
- Standardize the `fmtDate` and `fmtINR` utilities into a shared `lib/utils` rather than re-declaring them inside each page component.

---

## dashboard/crm/inventory/warehouses/page.tsx

**Route / Component**: `src/app/dashboard/crm/inventory/warehouses/page.tsx`

**Current Features**:
- Fetches list data, computes KPI snapshots, and delegates to a Client component (e.g. ListClient) for rendering tables, bulk actions, and filters. Adheres to the CRM_REBUILD_PLAN §1D pattern.
- Implements standard layouts leveraging components like `EntityDetailShell` or `EntityListShell`.

**Possible Features**:
- Introduce real-time updates using WebSockets for live inventory tracking.
- Add quick-action context menus directly on rows/cards.
- Enable deep linking for specific tabs in detail views.

**Errors**:
- Hydration warnings might occur if dates are strictly rendered on the server vs client (already mitigated by `fmtDate` returning consistent strings).
- Missing error boundaries in case the data fetch fails entirely (e.g., MongoDB timeout).
- Casts `any` on some Rust API DTO responses bypassing full type-safety.

**Enhancement Plan**:
- Improve type safety by replacing `any` assertions with proper DTO types imported from the Rust client.
- Integrate an ErrorBoundary component in `layout.tsx` to handle `notFound()` or server crashes more gracefully.
- Standardize the `fmtDate` and `fmtINR` utilities into a shared `lib/utils` rather than re-declaring them inside each page component.

---

## dashboard/crm/leads/[id]/edit/page.tsx

**Route / Component**: `src/app/dashboard/crm/leads/[id]/edit/page.tsx`

**Current Features**:
- Fetches the existing entity and renders a shared Form component pre-filled with data, operating in edit mode.
- Implements standard layouts leveraging components like `EntityDetailShell` or `EntityListShell`.

**Possible Features**:
- Introduce real-time updates using WebSockets for live inventory tracking.
- Add quick-action context menus directly on rows/cards.
- Enable deep linking for specific tabs in detail views.

**Errors**:
- Hydration warnings might occur if dates are strictly rendered on the server vs client (already mitigated by `fmtDate` returning consistent strings).
- Missing error boundaries in case the data fetch fails entirely (e.g., MongoDB timeout).
- Casts `any` on some Rust API DTO responses bypassing full type-safety.

**Enhancement Plan**:
- Improve type safety by replacing `any` assertions with proper DTO types imported from the Rust client.
- Integrate an ErrorBoundary component in `layout.tsx` to handle `notFound()` or server crashes more gracefully.
- Standardize the `fmtDate` and `fmtINR` utilities into a shared `lib/utils` rather than re-declaring them inside each page component.

---

## dashboard/crm/leads/[id]/page.tsx

**Route / Component**: `src/app/dashboard/crm/leads/[id]/page.tsx`

**Current Features**:
- Fetches the entity by ID and renders an EntityDetailShell. Displays summary cards, related entities via a right rail, and an EntityAuditTimeline. Follows the CRM §1D.2 pattern.
- Implements standard layouts leveraging components like `EntityDetailShell` or `EntityListShell`.

**Possible Features**:
- Introduce real-time updates using WebSockets for live inventory tracking.
- Add quick-action context menus directly on rows/cards.
- Enable deep linking for specific tabs in detail views.

**Errors**:
- Hydration warnings might occur if dates are strictly rendered on the server vs client (already mitigated by `fmtDate` returning consistent strings).
- Missing error boundaries in case the data fetch fails entirely (e.g., MongoDB timeout).
- Casts `any` on some Rust API DTO responses bypassing full type-safety.

**Enhancement Plan**:
- Improve type safety by replacing `any` assertions with proper DTO types imported from the Rust client.
- Integrate an ErrorBoundary component in `layout.tsx` to handle `notFound()` or server crashes more gracefully.
- Standardize the `fmtDate` and `fmtINR` utilities into a shared `lib/utils` rather than re-declaring them inside each page component.

---

## dashboard/crm/leads/new/page.tsx

**Route / Component**: `src/app/dashboard/crm/leads/new/page.tsx`

**Current Features**:
- Renders a shared Form component for creating a new entity. Often handles pre-fill via query parameters (e.g., fromKind, fromId).
- Implements standard layouts leveraging components like `EntityDetailShell` or `EntityListShell`.

**Possible Features**:
- Introduce real-time updates using WebSockets for live inventory tracking.
- Add quick-action context menus directly on rows/cards.
- Enable deep linking for specific tabs in detail views.

**Errors**:
- Hydration warnings might occur if dates are strictly rendered on the server vs client (already mitigated by `fmtDate` returning consistent strings).
- Missing error boundaries in case the data fetch fails entirely (e.g., MongoDB timeout).
- Casts `any` on some Rust API DTO responses bypassing full type-safety.

**Enhancement Plan**:
- Improve type safety by replacing `any` assertions with proper DTO types imported from the Rust client.
- Integrate an ErrorBoundary component in `layout.tsx` to handle `notFound()` or server crashes more gracefully.
- Standardize the `fmtDate` and `fmtINR` utilities into a shared `lib/utils` rather than re-declaring them inside each page component.

---

