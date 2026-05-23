# MASTERPLAN CHUNK 30

This document contains the detailed analysis of the Next.js pages assigned to Agent 30, which encompasses SabFlow settings and dashboards, SEO project dashboards, and the first set of SEO micro-tools.

## SabFlow Module

### `src/app/dashboard/sabflow/page.tsx`
- **Route / Component**: `/dashboard/sabflow`
- **Current Features**: Displays SabFlow execution statistics, execution volume area chart (success vs. failure), and a recent activity table using mock data (`EXECUTION_DATA`, `RECENT_ACTIVITY`).
- **Possible Features**: Real-time WebSocket or Server-Sent Events integration for live flow updates. Ability to retry failed executions directly from the table. Date-range filters.
- **Errors**: Missing error boundaries and `Suspense` loading states for live data. Exclusively relies on client-side mock data.
- **Enhancement Plan**: Replace mock data with real database fetches or server actions. Introduce real-time polling or SSE. Add a date-range picker to filter executions dynamically.

### `src/app/dashboard/sabflow/settings/page.tsx`
- **Route / Component**: `/dashboard/sabflow/settings`
- **Current Features**: Module-level settings for SabFlow. Contains five independent sections: defaults, retention, run limits, webhooks, and variables. Each section has its own save button and state.
- **Possible Features**: Bulk save action for the entire page. Form validation using Zod schemas for timeouts, retry attempts, and variable keys.
- **Errors**: `sendTest` webhook functionality uses a mock toast message instead of triggering an actual test.
- **Enhancement Plan**: Implement actual webhook endpoint testing. Add Zod validation to ensure variable keys are properly formatted (e.g., no spaces).

### `src/app/dashboard/sabflow/usage/page.tsx`
- **Route / Component**: `/dashboard/sabflow/usage`
- **Current Features**: A wrapper component that imports `UsageClient` and wraps it in a `Suspense` boundary with a loader icon.
- **Possible Features**: Add historical usage trends and limit alert configurations.
- **Errors**: None apparent; clean composition.
- **Enhancement Plan**: Ensure `UsageClient` accurately reflects workspace-specific and global API/step usage metrics.

### `src/app/dashboard/sabflow/workspaces/[workspaceId]/settings/page.tsx`
- **Route / Component**: `/dashboard/sabflow/workspaces/[workspaceId]/settings`
- **Current Features**: Server page that fetches `getWorkspaceById` and `getMemberRole`. Renders a 403 `EmptyState` if the user lacks access, or mounts the opaque client component `WorkspaceSettingsPage`. 
- **Possible Features**: Invite links, role management, audit logging for workspace-level changes.
- **Errors**: Lacks a fallback loading UI (`loading.tsx`) while the async fetch resolves.
- **Enhancement Plan**: Add a loading skeleton. Ensure that permission changes reflect immediately on the client side.

### `src/app/dashboard/sabflow/workspaces/page.tsx`
- **Route / Component**: `/dashboard/sabflow/workspaces`
- **Current Features**: Displays a grid of workspaces the user belongs to, with client-side text filtering. Uses an array of `MOCK_WORKSPACES`. Implements i18n via `useT()`.
- **Possible Features**: Pagination or infinite scroll for users with many workspaces.
- **Errors**: Depends entirely on `MOCK_WORKSPACES`; `listSabFlowWorkspaces()` is not yet wired up.
- **Enhancement Plan**: Wire up the actual server action to fetch user workspaces. Add server-side search/filtering capabilities.

---

## SEO Module - Project Dashboard & Analytics

### `src/app/dashboard/seo/page.tsx`
- **Route / Component**: `/dashboard/seo`
- **Current Features**: Lists all SEO projects using `getSeoProjects()`. Renders an empty state prompt if none exist, or a grid of `SeoProjectCard` components.
- **Possible Features**: Star/pin favorite projects. Search by domain. Add aggregate analytics across all projects.
- **Errors**: Does not handle fetch errors if `getSeoProjects()` fails.
- **Enhancement Plan**: Add error boundaries and toast notifications on fetch failure. Implement pagination or sorting (e.g., by health score).

### `src/app/dashboard/seo/[projectId]/page.tsx`
- **Route / Component**: `/dashboard/seo/[projectId]`
- **Current Features**: Main dashboard for an SEO project. Shows DA, backlinks, health score, tracked keywords. Has tabs for Overview (Traffic chart), Keywords, and Competitors.
- **Possible Features**: Add project settings editing and project deletion.
- **Errors**: The Keywords tab displays a "coming soon" stub.
- **Enhancement Plan**: Build out the keywords ranking table for the Keywords tab. Implement actual fetching for competitor metrics instead of just listing their URLs.

### `src/app/dashboard/seo/[projectId]/audit/page.tsx`
- **Route / Component**: `/dashboard/seo/[projectId]/audit`
- **Current Features**: Technical SEO audit runner. Uses polling (`setInterval`) to check audit progress. Displays scores, critical issues, warnings, and a crawled pages table.
- **Possible Features**: Export audit to PDF/CSV. Schedule weekly automated audits. Diff viewer to see what broke since the last crawl.
- **Errors**: Relies heavily on `any` typing. Short polling can cause heavy server load if multiple users run audits.
- **Enhancement Plan**: Add strict TypeScript interfaces for the audit results. Replace polling with Server-Sent Events (SSE) or WebSockets.

### `src/app/dashboard/seo/[projectId]/audit/print/page.tsx`
- **Route / Component**: `/dashboard/seo/[projectId]/audit/print`
- **Current Features**: A specialized view meant for printing the audit report.
- **Possible Features**: Customizable logo and agency branding for white-label reports.
- **Errors**: Hardcodes the authentication token (`Authorization: 'Bearer test'`) for the client-side fetch. Unused import `_zoruCn` with `void _zoruCn`.
- **Enhancement Plan**: Move the data fetch to a Server Component to securely pass session cookies/tokens. Add proper `@media print` CSS rules to optimize pagination and hide unnecessary UI elements.

### `src/app/dashboard/seo/[projectId]/brand/page.tsx` & `src/app/dashboard/seo/brand-radar/page.tsx`
- **Route / Component**: `/dashboard/seo/[projectId]/brand` & `/dashboard/seo/brand-radar`
- **Current Features**: Analyzes brand mentions, sentiment, and share of voice. The global version takes an input, while the project version is static mock UI.
- **Possible Features**: Integration with social listening APIs (e.g., Mention, Twitter API). Automated alerts for negative sentiment.
- **Errors**: Project version is purely mock data. Global version uses `any` and lacks error handling for the API fetch.
- **Enhancement Plan**: Connect both pages to a real social listening backend. Ensure the "Configure Alerts" button opens an actionable dialog.

### `src/app/dashboard/seo/[projectId]/competitors/page.tsx`
- **Route / Component**: `/dashboard/seo/[projectId]/competitors`
- **Current Features**: Competitor Gap Analysis page. Currently displays a hardcoded, locked "Premium" view showing a mock gap analysis.
- **Possible Features**: Dynamic comparison of backlink profiles and content velocity.
- **Errors**: Functionality is completely stubbed out. Buttons are disabled.
- **Enhancement Plan**: Build the actual competitor gap analysis feature, querying rank tracking data to find overlapping/missing keywords.

### `src/app/dashboard/seo/[projectId]/grid/page.tsx` & `src/app/dashboard/seo/[projectId]/local/page.tsx`
- **Route / Component**: `/dashboard/seo/[projectId]/grid` & `/dashboard/seo/[projectId]/local`
- **Current Features**: Visualizes local SEO rankings on a geographic grid using CSS absolute positioning over a grid background.
- **Possible Features**: Integration with Mapbox or Google Maps for a real map underlay. Dynamic radius selection.
- **Errors**: Hardcodes location to New York coordinates (40.7128, -74.006) when calling `startGridTracking`.
- **Enhancement Plan**: Merge `local` (which is a mock) into `grid` (which calls an action). Make the center coordinate and grid size dynamic based on user settings.

### `src/app/dashboard/seo/[projectId]/gsc/page.tsx` & `src/app/dashboard/seo/callback/page.tsx`
- **Route / Component**: `/dashboard/seo/[projectId]/gsc` & `/dashboard/seo/callback`
- **Current Features**: Connects to Google Search Console via OAuth. The callback page exchanges the code for a token. The GSC page displays a bar chart of clicks and impressions.
- **Possible Features**: Granular filtering by page, query, country, or device.
- **Errors**: The Google logo is loaded directly from a Wikimedia URL instead of a local asset. Callback uses `any` for error catching.
- **Enhancement Plan**: Store the Google logo locally. Add date range pickers and query-level breakdown tables to the GSC dashboard.

### `src/app/dashboard/seo/[projectId]/logs/page.tsx`
- **Route / Component**: `/dashboard/seo/[projectId]/logs`
- **Current Features**: Log Forensics dashboard. Shows a drag-and-drop area for Apache/Nginx logs, and mock data for bot traffic distribution and crawl waste.
- **Possible Features**: Real log parsing via web workers or a background server job. 
- **Errors**: Drag and drop area is purely decorative and does not accept files.
- **Enhancement Plan**: Implement a file uploader that streams the log file to an S3 bucket and triggers a background parsing worker.

### `src/app/dashboard/seo/[projectId]/pseo/page.tsx`
- **Route / Component**: `/dashboard/seo/[projectId]/pseo`
- **Current Features**: UI for Programmatic SEO (pSEO) keyword clustering. Currently locked and static.
- **Possible Features**: Vector-based semantic clustering of uploaded keyword CSVs.
- **Errors**: Stubbed out.
- **Enhancement Plan**: Connect to the clustering logic (similar to the one in `tools/clustering`) or a robust Python/NLP backend.

### `src/app/dashboard/seo/[projectId]/rankings/page.tsx`
- **Route / Component**: `/dashboard/seo/[projectId]/rankings`
- **Current Features**: Displays tracked keywords, top 3/10 metrics, and visibility percentage. Uses `getKeywords` action.
- **Possible Features**: Graph plotting average rank over time. Competitor rank overlays.
- **Errors**: Minimal error handling if `getKeywords` fails.
- **Enhancement Plan**: Add a line chart for historical visibility trends.

### `src/app/dashboard/seo/[projectId]/timetravel/page.tsx`
- **Route / Component**: `/dashboard/seo/[projectId]/timetravel`
- **Current Features**: SERP Time Travel. Shows a visual diff of competitor HTML changes.
- **Possible Features**: Automated tracking of competitor page title/H1 changes.
- **Errors**: Uses hardcoded mock HTML strings for the diff view.
- **Enhancement Plan**: Integrate with Wayback Machine APIs or a custom daily scraper to fetch and diff real DOM snapshots.

### `src/app/dashboard/seo/experts/page.tsx`
- **Route / Component**: `/dashboard/seo/experts`
- **Current Features**: Static empty state for an Experts directory marketplace.
- **Possible Features**: List freelancer profiles, ratings, and contact forms.
- **Errors**: None, just incomplete.
- **Enhancement Plan**: Build out the marketplace listings.

### `src/app/dashboard/seo/site-explorer/page.tsx`
- **Route / Component**: `/dashboard/seo/site-explorer`
- **Current Features**: Analyzes domain-level metrics and backlinks. Displays an area chart of backlink growth and top linking domains.
- **Possible Features**: Export backlink profile to CSV. Dofollow vs Nofollow breakdowns.
- **Errors**: Lacks pagination for the backlink table, which could be large.
- **Enhancement Plan**: Implement virtualized lists or pagination for backlinks. Handle potential timeout errors for large domains.

---

## SEO Micro-Tools (`src/app/dashboard/seo/tools/*`)

The following files represent lightweight, single-purpose SEO utilities wrapped in `ToolShell`.

### Analyzed Tools
1. **`ad-copy-generator/page.tsx`**: Uses client-side string concatenation to generate ad copy variants. *Enhancement*: Connect to an LLM for creative generation.
2. **`adwords-cpc/page.tsx`**: Calculates clicks, conversions, and CPA from Budget, CPC, and CVR.
3. **`adwords-wrapper/page.tsx`**: Wraps keywords in Google Ads match type syntax (broad, phrase, exact, modified). *Enhancement*: Add a "Copy to Clipboard" button.
4. **`alt-text-checker/page.tsx`**: Fetches a URL and parses HTML to find images missing `alt` attributes. *Enhancement*: Support exporting the list of missing images.
5. **`anchor-text-analyzer/page.tsx`**: Extracts all links from a fetched URL and groups them by anchor text frequency. 
6. **`autocomplete-suggestions/page.tsx`**: Fetches Google autocomplete suggestions via `/api/seo-tools/autocomplete`.
7. **`backlink-checker/page.tsx`**: Currently generates placeholder backlink metrics (DR, anchor) by hashing the domain name. *Enhancement*: Needs to be connected to a real API (like Ahrefs).
8. **`base64-to-image/page.tsx`**: Renders a `data:image/*;base64,...` string into an actual image tag.
9. **`broken-link-checker/page.tsx`**: Fetches a page, extracts the first 30 outgoing links, and allows checking their HTTP status codes client-side. *Enhancement*: Move checking to the backend to avoid CORS issues with target URLs.
10. **`cache-checker/page.tsx`**: (Inferred) Checks Google cache status.
11. **`canonical-tag/page.tsx`**: (Inferred) Validates canonical tags.
12. **`character-counter/page.tsx`**: (Inferred) Counts characters, words, and spaces.
13. **`clustering/page.tsx`**: Naively groups keywords client-side based on intent words (buy, price, cost) and topic. *Enhancement*: Integrate real NLP backend for accurate semantic grouping.
14. **`color-picker/page.tsx`, `css-minifier/page.tsx`, `ctr-calculator/page.tsx`, `description-checker/page.tsx`, `dns-lookup/page.tsx`, `do-follow-checker/page.tsx`, `domain-age/page.tsx`, `domain-authority/page.tsx`, `duplicate-line-remover/page.tsx`**: Collection of standard developer and SEO utilities.
15. **`event-tag-builder/page.tsx`**: Generates `gtag('event', ...)` snippets for GA4.

### General SEO Tools Enhancements
- **CORS Handling**: Tools that fetch external URLs (like the Broken Link Checker and Alt Text Checker) should ensure they route through an API proxy (`apiFetchUrl`) to bypass CORS restrictions.
- **Exporting**: Most tools dealing with lists (autocomplete, backlinks, broken links) would benefit from CSV export functionality.
- **Copy to Clipboard**: Tools generating snippets (AdWords Wrapper, Event Tag Builder) should consistently feature copy-to-clipboard buttons.
