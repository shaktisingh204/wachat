# SabNode Page Analysis - Chunk 1

## Route: `/src/app/[shortCode]/page.tsx`
- **Current Features**: Redirects short URLs tracking clicks, handling custom domains, verifying passwords, resolving UTMs.
- **Possible Features**: Geo-routing, device-based routing, A/B testing variations for short URLs.
- **Errors**: No obvious bugs; error handling for tracking failure correctly falls back.
- **Enhancement Plan**: Cache lookups for frequently accessed short links.

## Route: `/src/app/_domain/[host]/page.tsx`
- **Current Features**: Custom domain routing for SabFlow. Verifies domain and resolves the associated chat flow, rendering the `ChatWindow` component.
- **Possible Features**: Multi-flow routing on different paths of the custom domain.
- **Errors**: Resolving `decodeURIComponent(host)` could throw URIError on malformed hosts; needs a try-catch.
- **Enhancement Plan**: Add Edge caching for domain resolution to avoid DB trips.

## Route: `/src/app/about-us/page.tsx`
- **Current Features**: Static marketing/about page stylized like technical docs (SabNode Specification).
- **Possible Features**: Add dynamic team members section or live metrics.
- **Errors**: None, standard static UI.
- **Enhancement Plan**: Improve accessibility on anchor tags, maybe animate the navigation scroll.

## Route: `/src/app/admin/dashboard/audit/page.tsx`
- **Current Features**: Admin audit log viewer. Fetches `AuditSummary` for a given tenant/timeframe and displays in `AuditLogTable`.
- **Possible Features**: Export to CSV/PDF, granular filtering by action type.
- **Errors**: URL param `days` parsed but `from/to` override it. The error boundary/handling logs to console on failure and returns empty summary.
- **Enhancement Plan**: Add streaming/suspense for the table data instead of blocking the whole page load.

## Route: `/src/app/admin/dashboard/broadcast-log/page.tsx`
- **Current Features**: Client-side paginated table for system-wide broadcast logs.
- **Possible Features**: Real-time updates via WebSockets for processing broadcasts.
- **Errors**: Potential race conditions if `fetchBroadcasts` resolves out of order.
- **Enhancement Plan**: Implement URL search params for pagination state so it can be refreshed or shared.

## Route: `/src/app/admin/dashboard/flow-logs/page.tsx`
- **Current Features**: Admin UI for viewing detailed webhook/flow execution logs. Modal popup for payload.
- **Possible Features**: Retry failed flow executions directly from this UI.
- **Errors**: Uses `@ts-ignore` for API calls (`getWebhookLogs`, `getWebhookLogPayload`) which risks runtime errors.
- **Enhancement Plan**: Define proper TypeScript interfaces for the log payloads and remove `ts-ignore`.

## Route: `/src/app/admin/dashboard/marketplace/queue/page.tsx`
- **Current Features**: Admin review queue for marketplace template submissions. Server-side rendering with pagination.
- **Possible Features**: Batch approve/reject operations.
- **Errors**: Empty state checks `rows.length === 0` but doesn't handle loading state cleanly if `loadError` isn't thrown (caught internally).
- **Enhancement Plan**: Add a preview modal to see the template before approving.

## Route: `/src/app/admin/dashboard/page.tsx`
- **Current Features**: Massive admin dashboard hub aggregating stats across Core, Wachat, CRM, Ads, Marketing, Tools. Renders project table and recent broadcasts.
- **Possible Features**: Time-series charts for growth (users/revenue).
- **Errors**: The project table uses `any` for `project.plan`. Heavy concurrent data fetching might timeout on Vercel.
- **Enhancement Plan**: Break into multiple smaller Server Components wrapped in `Suspense` to improve Time To First Byte (TTFB).

## Route: `/src/app/admin/dashboard/plans/[planId]/page.tsx`
- **Current Features**: Complex client-side form to edit a subscription plan. Includes overview, pricing, limits, and module configurations.
- **Possible Features**: Plan versioning / history of changes.
- **Errors**: Uses a lot of `any` types and `ts-ignore`. Initial data loading can blink due to client-side fetching.
- **Enhancement Plan**: Move the data fetching to a Server Component and pass initial data as props to the Client Component.

## Route: `/src/app/admin/dashboard/plans/new/page.tsx`
- **Current Features**: Simple wrapper for `NewPlanForm` to create a plan.
- **Possible Features**: Clone from existing plan.
- **Errors**: None evident, mostly compositional.
- **Enhancement Plan**: Combine with the edit page structure to unify plan creation and editing logic.


## Route: `/src/app/admin/dashboard/plans/page.tsx`
- **Current Features**: List all subscription plans in a card grid. Includes quick stats (Signup Credits, Project Limits) and actions to Edit, Duplicate, Delete, or Manage Permissions.
- **Possible Features**: Reorder plans visually so they appear in a specific sequence on the pricing page.
- **Errors**: `getPlans` failure is silently caught (returns empty list), making it indistinguishable from "no plans exist".
- **Enhancement Plan**: Add toast notification on fetch failure instead of swallowing it silently.

## Route: `/src/app/admin/dashboard/sabsms/debug/page.tsx`
- **Current Features**: Admin debugging page for SabSMS. Allows pushing a real SMS through the Rust engine using Twilio credentials.
- **Possible Features**: Mock sending (dry-run) without hitting Twilio to test engine ingestion.
- **Errors**: Doesn't capture engine unavailability early before submission.
- **Enhancement Plan**: Check engine health on the page load and disable the form if the engine is down.

## Route: `/src/app/admin/dashboard/sabsms/page.tsx`
- **Current Features**: Overview dashboard for SabSMS engine. Probes engine health (HTTP ping) and fetches message counts (queued, sent, delivered, failed) from DB.
- **Possible Features**: Historical charts for sent/delivered rates over time.
- **Errors**: Catches errors from `probeEngine` but might hide real connectivity issues if the DB call fails (no explicit error boundary shown).
- **Enhancement Plan**: Add a "retry queue" or "cancel queued" action for stuck SMS messages.

## Route: `/src/app/admin/dashboard/system/page.tsx`
- **Current Features**: Administrative tools page for system-wide tasks (Sync data, cron jobs, webhook toggle, Diwali theme, App logo upload).
- **Possible Features**: System backup triggers, maintenance mode toggle.
- **Errors**: Restricted area actions are high-risk. No confirmation modal mentioned at this level (though might be in the buttons).
- **Enhancement Plan**: Wrap dangerous buttons (like `RunCronJobsButton`) in confirmation dialogs.

## Route: `/src/app/admin/dashboard/template-library/create/page.tsx`
- **Current Features**: Wraps `CreateTemplateForm` to allow admins to create new templates for the public library.
- **Possible Features**: Preview template as standard user before publishing.
- **Errors**: `getProjectById` is imported but not used.
- **Enhancement Plan**: Remove unused `getProjectById` import. Improve `LoadingZoruSkeleton` styling.


## Route: `/src/app/admin/dashboard/template-library/page.tsx`
- **Current Features**: Admin overview of public marketplace templates. Displays separate lists for custom templates and pre-made templates. Includes a category manager.
- **Possible Features**: Bulk delete/approval capabilities directly on the table, drag-and-drop to reorder pre-made templates.
- **Errors**: Doesn't handle fetch failure properly (silently ignores). The delete button for premade templates doesn't exist.
- **Enhancement Plan**: Unify the UI for managing custom vs pre-made templates and provide pagination if the lists grow large.

## Route: `/src/app/admin/dashboard/users/page.tsx`
- **Current Features**: Complete user directory for admins. Features include approving users, suspending, assigning plans, impersonating users, and managing custom permissions.
- **Possible Features**: Add a bulk action bar (e.g. select multiple users to assign a plan or approve).
- **Errors**: `getUsersForAdmin` catch block silently fails. JSON cloning using stringify/parse is a slow operation for a large array.
- **Enhancement Plan**: Replace `JSON.parse(JSON.stringify(users))` with a more robust recursive serialization utility or use Mongoose `lean()`.

## Route: `/src/app/admin/dashboard/whatsapp-projects/page.tsx`
- **Current Features**: Displays a paginated table of connected WhatsApp Business Accounts (WABAs). Shows project owner, WABA ID, review status, and allows archiving.
- **Possible Features**: Un-archive functionality or direct link to the user's project dashboard.
- **Errors**: `statusStyle` splits on space and checks index 0, which works for 'partial failure' but feels brittle.
- **Enhancement Plan**: Add filtering by specific WABA statuses (e.g. only show 'pending' or 'failed').

## Route: `/src/app/admin-login/page.tsx`
- **Current Features**: Handles both first-time admin setup and regular admin authentication. It dynamically checks if an admin exists on mount.
- **Possible Features**: Add OAuth / SSO specifically for admins.
- **Errors**: Hard-coded checking for `isAdminConfigured()` in `useEffect` could lead to a flash of loading state.
- **Enhancement Plan**: Move the "is admin configured" check to the Server Component layer and pass it as a prop to avoid the client-side loading blink.

## Route: `/src/app/api/docs/modules/[module]/[endpoint]/page.tsx`
- **Current Features**: Dynamic API documentation page that renders from a generated JSON catalog. Provides path params, query params, code samples, and an interactive runner.
- **Possible Features**: Auto-generated OpenAPI JSON export button on the endpoint page.
- **Errors**: ESLint disable rule is top-level. `generateStaticParams` returns an empty array, so dynamic params are always generated on demand.
- **Enhancement Plan**: Implement proper `generateStaticParams` to pre-build the most common API endpoints for faster docs loading.


## Route: `/src/app/api/docs/modules/[module]/page.tsx`
- **Current Features**: Intermediate module index page in the API docs. Lists all endpoints belonging to a specific module, linking to the deep detail pages.
- **Possible Features**: Add a "Try all in Postman" or "Download OpenAPI collection for module" button.
- **Errors**: Reuses the ESLint bypass from the autogen tooling. 
- **Enhancement Plan**: Group endpoints by HTTP Method in the visual table so that standard CRUD operations cluster together.

## Route: `/src/app/api/docs/modules/page.tsx`
- **Current Features**: High-level directory of all API modules, generated from `catalog.json`. Displays module names and endpoint counts in a card grid.
- **Possible Features**: Search bar to filter modules or search across all endpoints globally.
- **Errors**: Static module counts inside the file will become stale if the source code is modified without running `pnpm api:gen`.
- **Enhancement Plan**: Dynamically calculate the module counts at build-time rather than hardcoding them in the file (though `api:gen` does this currently).

## Route: `/src/app/api/docs/page.tsx`
- **Current Features**: Landing page for Wachat Suite APIs. Contains static, hard-coded endpoint specifications with `curl` examples and response blobs rendered in a custom `CodeTerminal` component.
- **Possible Features**: Dark/light mode toggle specifically for the code terminal.
- **Errors**: `wachatApiDocs` array is manually maintained and could drift from the actual API definitions.
- **Enhancement Plan**: Deprecate this hardcoded page in favor of the autogenerated `catalog.json` driven docs, or inject the live JSON definitions here.

## Route: `/src/app/api/docs/reference/page.tsx`
- **Current Features**: Interactive OpenAPI reference built with Scalar. Bypasses the Next.js app layout by rendering its own `<html>` and `<body>` tags.
- **Possible Features**: Custom theme settings for Scalar injected via `data-configuration`.
- **Errors**: Uses inline scripts. Might trigger Content Security Policy (CSP) violations if external scripts (`cdn.jsdelivr.net`) are blocked.
- **Enhancement Plan**: Self-host the Scalar script to avoid relying on jsdelivr in production and to respect strict CSPs.

## Route: `/src/app/auth/facebook/callback/page.tsx`
- **Current Features**: Server Component handling the Facebook OAuth callback. Awaits search parameters (`code`, `state`, `error`) and passes them to a Client Component (`FacebookCallbackClient`) wrapped in Suspense.
- **Possible Features**: Track OAuth success/failure metrics directly from this server component before rendering the client shell.
- **Errors**: None evident, it correctly handles the new Next.js 16 async `searchParams`.
- **Enhancement Plan**: Provide an inline fallback if the `FacebookCallbackClient` fails entirely (e.g. invalid code) rather than just a loading spinner.


## Route: `/src/app/bio/[slug]/page.tsx`
- **Current Features**: A simple placeholder "coming soon" page for user bio profiles (link-in-bio style pages).
- **Possible Features**: Render dynamic link collections, social handles, and a customizable avatar based on the `slug`.
- **Errors**: `generateStaticParams` is missing if this is intended to be statically built, though it might be SSR by default.
- **Enhancement Plan**: Connect this to a DB collection to render real user profiles if available, instead of a static "coming soon" message.

## Route: `/src/app/blog/page.tsx`
- **Current Features**: Renders a "Changelog" page describing system updates, release notes, and API changes. Uses a static `changelogEntries` array.
- **Possible Features**: Move the changelog entries to a CMS (like Sanity) or Markdown files (MDX) for easier editing.
- **Errors**: Static content in a file means a code deployment is required for every blog/changelog post.
- **Enhancement Plan**: Implement a contentlayer or standard Markdown parsing mechanism to load changelog files from a `/content/changelog` directory.

## Route: `/src/app/builder/[id]/page.tsx`
- **Current Features**: Dynamic route for the SabNode No-Code flow/page builder. Fetches `PageData` from MongoDB and passes it to the `BuilderInitializer`.
- **Possible Features**: Add real-time collaborative editing (multiplayer) for flows.
- **Errors**: The `await db.collection('pages')` doesn't include the Tenant/Project ID context. Any user with the `id` could theoretically access any page unless authorized elsewhere.
- **Enhancement Plan**: Add authorization logic to ensure the requested `id` belongs to the current user's workspace/project.

## Route: `/src/app/builder/page.tsx`
- **Current Features**: Base route for the builder, simply renders the `EditorLayout`. Likely serves as a "new project" or empty state.
- **Possible Features**: Redirect to a specific `[id]` upon creating a new template so the state isn't lost on refresh.
- **Errors**: No `EditorProvider` or initial data is passed here unlike the `[id]` page, which might cause the `EditorLayout` to break if it expects context.
- **Enhancement Plan**: Refactor to create a new record in the DB and redirect to `/builder/[id]`, or wrap it in an empty `EditorProvider`.

## Route: `/src/app/careers/page.tsx`
- **Current Features**: A creative, API-themed careers page using a strict monochrome design. Jobs are presented as API endpoints (e.g. `POST /careers/engineering/frontend`).
- **Possible Features**: Hook up the "Execute / Apply" button to an actual form or `mailto:` link.
- **Errors**: The "Execute / Apply" button is currently a no-op (no onClick or form submission).
- **Enhancement Plan**: Turn the "Execute / Apply" section into a real interactive form matching the API aesthetic (like a terminal prompt).


## Route: `/src/app/clay-showcase/page.tsx`
- **Current Features**: A beautiful, pixel-perfect UI showcase demonstrating the 'Clay' component system. It acts as a static style guide and demo dashboard (not part of the core app functionality).
- **Possible Features**: Add interactive toggles to switch the theme (light/dark/monochrome) within the showcase.
- **Errors**: `onClick={undefined}` on `ZoruTableRow` is unnecessary and could cause React warnings.
- **Enhancement Plan**: Move this out of the main `src/app/` routing tree into a separate `apps/docs` or `apps/storybook` if using a monorepo, as it shouldn't be deployed to production users.

## Route: `/src/app/contact/page.tsx`
- **Current Features**: A contact page styled as an API documentation endpoint (`POST /v1/contact`). Contains an interactive form that simulates sending a POST request.
- **Possible Features**: Actually wire the "Execute" button to send an email using Resend/SendGrid.
- **Errors**: The form has no state, no validation, and the "Execute" button does nothing.
- **Enhancement Plan**: Implement a Server Action to handle the form submission and show a success state/toast when the contact request is sent.

## Route: `/src/app/customers/page.tsx`
- **Current Features**: "Case Studies" page designed like a technical whitepaper/documentation. Shows how fictional (or real) customers use SabNode.
- **Possible Features**: Add a download button for a PDF version of the whitepapers.
- **Errors**: No obvious runtime errors; purely a static informational page.
- **Enhancement Plan**: Make the sidebar links (`#fintech-corp`) use IntersectionObserver to highlight the active section as the user scrolls.

## Route: `/src/app/dashboard/ad-manager/ad-accounts/page.tsx`
- **Current Features**: Allows users to manage connected Meta (Facebook) ad accounts. They can select an active account, view status, or disconnect an account.
- **Possible Features**: Add a bulk-sync button to refresh the status of all connected accounts at once.
- **Errors**: `getAdAccounts` returns `accounts` but the data typing relies heavily on `any` (e.g. `account: any`).
- **Enhancement Plan**: Define a strict TypeScript interface for `AdAccount` to replace the `any` types and improve editor autocompletion.

## Route: `/src/app/dashboard/ad-manager/ad-previews/page.tsx`
- **Current Features**: Gallery view of ad creatives for the active Ad Account. Filters by ALL, ACTIVE, and PAUSED. Provides direct links to edit the ad in Facebook Ads Manager.
- **Possible Features**: A modal to click and expand the ad image to full screen.
- **Errors**: Uses `act_` string manipulation which might be brittle if the context `activeAccount.account_id` sometimes already includes it and sometimes doesn't.
- **Enhancement Plan**: Standardize the Ad Account ID formatting in the `useAdManager` context so components don't have to constantly check and strip/add the `act_` prefix.


## Route: `/src/app/dashboard/ad-manager/ad-sets/[id]/page.tsx`
- **Current Features**: Specific Ad Set detail page, listing all the Ads belonging to the given Ad Set. Allows toggling Ad status, duplicating, and deleting ads. Displays basic insights (Spend, Clicks, CPC, CTR).
- **Possible Features**: Add inline editing for Ad names or budgets.
- **Errors**: No explicit check ensuring the Ad Set ID belongs to the current active Ad Account.
- **Enhancement Plan**: Add a "Create Ad" button to allow users to build new creatives directly into this Ad Set.

## Route: `/src/app/dashboard/ad-manager/ad-sets/page.tsx`
- **Current Features**: List of Ad Sets for the active Ad Account. Uses the `CampaignsHub` client component with `initialLevel="adset"`.
- **Possible Features**: N/A (Handled entirely by the shared `CampaignsHub` component).
- **Errors**: None, very simple wrapper.
- **Enhancement Plan**: N/A.

## Route: `/src/app/dashboard/ad-manager/ads/page.tsx`
- **Current Features**: List of all Ads for the active Ad Account. Uses the `CampaignsHub` client component with `initialLevel="ad"`.
- **Possible Features**: N/A (Handled entirely by the shared `CampaignsHub` component).
- **Errors**: None, very simple wrapper.
- **Enhancement Plan**: N/A.

## Route: `/src/app/dashboard/ad-manager/ai-lab/page.tsx`
- **Current Features**: "AI creative lab" offering ML workflows. Includes a "Quick ad copy generator" that builds 10 variants from a brief using static prefix/CTA arrays simulating AI output. Lists other coming-soon tools.
- **Possible Features**: Connect the copy generator to a real LLM (like OpenAI) for contextual variant generation.
- **Errors**: The ad variants generation currently just prefixes emoji and appends static CTAs, it is not actually calling an AI model.
- **Enhancement Plan**: Wire up the form to call a server action that leverages a real AI model to generate the copy variants.

## Route: `/src/app/dashboard/ad-manager/audiences/page.tsx`
- **Current Features**: Manager for Custom and Lookalike audiences. Users can list, create, and delete audiences. Supports defining Source Type, Country, and Lookalike Similarity Ratio.
- **Possible Features**: Visualize audience overlap, or allow syncing customer data from the Wachat CRM to create custom audiences.
- **Errors**: None evident. The sheet UI cleanly handles the conditional form fields based on audience type.
- **Enhancement Plan**: Add a progress indicator for audiences that are currently "Populating" (Meta often takes hours to build a custom audience).

## Route: `/src/app/dashboard/ad-manager/automated-rules/page.tsx`
- **Current Features**: Allows creating if/then rules for Meta Ads (e.g. Pause campaign if Spend > X).
- **Possible Features**: Support multiple conditions (AND/OR logic) rather than just a single metric/operator combination.
- **Errors**: `formatCondition` checks for `filters[0]` wrapped in a try/catch, meaning multi-filter rules won't display properly.
- **Enhancement Plan**: Improve the table rendering to accurately display complex multi-condition automated rules.

## Route: `/src/app/dashboard/ad-manager/billing/page.tsx`
- **Current Features**: Displays the Meta Ad Account's billing info: Amount spent, Balance, Spending Limit, Currency, Timezone, and Status.
- **Possible Features**: Add a link to the Meta Business Manager Billing page, or allow increasing the spend cap directly from the UI.
- **Errors**: No way to actually pay or change payment methods; it's read-only.
- **Enhancement Plan**: Add a visual progress bar showing how close the current "Amount spent" is to the "Spending limit".

## Route: `/src/app/dashboard/ad-manager/budget-optimizer/page.tsx`
- **Current Features**: Provides AI-driven budget recommendations (Increase, Decrease, Pause, Maintain) based on the last 7 days of ad performance.
- **Possible Features**: Add an "Apply All" button to accept all budget adjustments at once.
- **Errors**: The recommendation engine logic lives in the backend (`getBudgetRecommendations`); if it fails, the frontend gracefully degrades to an empty state.
- **Enhancement Plan**: Add a "History" tab to see previously applied recommendations and how they affected performance.

## Route: `/src/app/dashboard/ad-manager/bulk-editor/page.tsx`
- **Current Features**: Spreadsheet-style bulk editor for campaigns. Allows importing/exporting CSVs, selecting multiple rows, inline editing names/budgets, and saving changes in batch.
- **Possible Features**: Add support for bulk-editing Ad Sets and Ads, not just Campaigns.
- **Errors**: CSV import logic splits by newlines and commas without handling quoted strings that contain commas, which will break if campaign names have commas.
- **Enhancement Plan**: Use a proper CSV parsing library (like `papaparse`) to safely handle quoted strings and embedded commas during import/export.

## Route: `/src/app/dashboard/ad-manager/calendar/page.tsx`
- **Current Features**: A month-view calendar visualizing when ad campaigns start and stop.
- **Possible Features**: Click a calendar cell to quickly launch a modal to schedule a new campaign starting on that date.
- **Errors**: If a campaign spans multiple months, the logic checks `start < dateStr` and `end > dateStr`, which correctly renders it, but large lists of campaigns will overwhelm the UI cell height.
- **Enhancement Plan**: If a day has more than 3 campaigns, instead of just saying "+X more", make it clickable to open a popover detailing all campaigns for that day.

