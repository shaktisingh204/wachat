# MASTERPLAN CHUNK 2

This document provides a handcrafted analysis of the files assigned to Chunk 2.

## Route / Component: `src/app/dashboard/ad-manager/campaigns/[id]/page.tsx` & `src/app/dashboard/ad-manager/campaigns/page.tsx`
**Current Features**: Lists and displays details for ad campaigns. Handles dynamic routing for specific campaign IDs.
**Possible Features**: Add inline editing for campaign budgets, advanced filtering by ROAS or CPA.
**Errors**: Missing error boundaries if Meta API fails.
**Enhancement Plan**: Implement a unified caching layer for campaign metrics to avoid redundant fetches.

## Route / Component: `src/app/dashboard/ad-manager/customer-lists/page.tsx`
**Current Features**: Provides a privacy-safe Customer List uploader. In-browser SHA-256 hashing ensures raw emails never leave the user's device. Pushes hashed arrays to Meta's API for Custom Audiences.
**Possible Features**: Add phone number hashing and multi-column mapping for LTV (Lifetime Value) audiences.
**Errors**: The form state doesn't fully persist if navigation occurs mid-upload.
**Enhancement Plan**: Add a drag-and-drop CSV parser instead of purely text-area input. Use Web Workers for hashing large lists (10k+ rows) to avoid blocking the main thread.

## Route / Component: `src/app/dashboard/admin/marketplace/analytics/page.tsx`
**Current Features**: Shows KPI cards (total templates, installs, views) and top 10 templates by installs in a tabular view. Renders a recent search queries table.
**Possible Features**: Add line charts for install trends over time.
**Errors**: The template table `rate` calculation assumes `views` always accurately match or exceed `installs`. It could throw zero-division if not handled securely on API failures.
**Enhancement Plan**: Shift to standard charting libraries (e.g., Recharts) instead of manual tables for trend visualizations.

## Route / Component: `src/app/dashboard/api/apps/page.tsx`
**Current Features**: Server component that loads OAuth Apps (`listOAuthApps()`) and passes them to a Client Component (`AppsClient`).
**Possible Features**: Provide app usage analytics and rate limit monitoring per app.
**Errors**: Basic error handling is present (`loadError`), but no active retry mechanism for the user if the initial fetch fails.
**Enhancement Plan**: Adopt React 18 Suspense with a dedicated loading skeleton to improve perceived performance.

## Route / Component: `src/app/dashboard/api/keys/page.tsx`
**Current Features**: Allows developers to create, list, copy, and revoke API keys for programmatic access. Displays key status and creation date.
**Possible Features**: Add scopes or granular permissions to individual API keys.
**Errors**: The `maskKey` function could potentially fail if the key format unexpectedly changes.
**Enhancement Plan**: Implement an audit log directly visible on this page for when the key was last used.

## Route / Component: `src/app/dashboard/billing/history/page.tsx` & `src/app/dashboard/billing/page.tsx`
**Current Features**: Deprecated pages. They render a `LoaderCircle` and use `useEffect` to redirect users to `/dashboard/user/billing/history` and `/dashboard/user/billing`.
**Possible Features**: N/A (Deprecated)
**Errors**: Using `useEffect` for redirects can cause a momentary flash of the page content.
**Enhancement Plan**: Use Next.js `redirect()` from `next/navigation` in a Server Component or `next.config.js` redirects for a faster, flicker-free routing experience.

## Route / Component: `src/app/dashboard/crm/accounting/trial-balance/page.tsx`
**Current Features**: Renders a comprehensive Trial Balance report with opening, debit, credit, and closing balances. Includes a Recharts bar chart for top accounts. Allows CSV/XLSX export.
**Possible Features**: Drill-down capability from the Trial Balance directly into the General Ledger.
**Errors**: Chart data mapping (`chartData`) slices the top 12 items, but does not group the remaining items into an "Others" category, potentially hiding significant balances from the visual representation.
**Enhancement Plan**: Enhance the `PaginationBar` integration to allow dynamic sizing.

## Route / Component: `src/app/dashboard/crm/accounting/charts/[accountId]/page.tsx`
**Current Features**: Displays the balance summary, description, and recent transactions (voucher entries) for a specific Chart of Account.
**Possible Features**: Export individual account ledger to PDF.
**Errors**: The table searches `debitEntries` and `creditEntries` inside the render loop (`entry.debitEntries.find(...)`). This is computationally expensive for large transaction lists.
**Enhancement Plan**: Pre-process and flatten the transaction entries array before passing it to the render function to improve UI performance.

## General Overview: Ad Manager Module (`src/app/dashboard/ad-manager/...`)
**Current Features**: Pages for catalogs, conversion funnels, custom conversions, events manager, lead forms, pixels, and split tests.
**Enhancement Plan**: Adopt a standardized `AmBreadcrumb` and layout wrapper across all ad-manager sub-routes. Implement unified error boundaries to catch API failures gracefully.

## General Overview: API & Developer Tools (`src/app/dashboard/api/...`)
**Current Features**: Documentation, webhook management, personal tokens, logs, and usage tracking.
**Enhancement Plan**: Migrate generic API logs to a dedicated visual timeline component with filtering by HTTP status and endpoint.

## General Overview: CRM Accounting (`src/app/dashboard/crm/accounting/...`)
**Current Features**: Full suite of accounting tools (Balance Sheet, Cash Flow, Day Book, Groups, Income Statement, PnL).
**Enhancement Plan**: Add standard accounting standard (GAAP/IFRS) compliance checks and a unified fiscal year selector stored in global Context/Zustand state so it persists across all accounting views.
