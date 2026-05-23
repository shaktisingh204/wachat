# Masterplan Chunk 9 Analysis

This document contains the analysis for the 45 files assigned to Agent 9. 

## Route / Component: `src/app/dashboard/crm/leads/page.tsx`
- **Current Features**: A simple server component that immediately redirects the user to `/dashboard/crm/sales/leads`.
- **Possible Features**: Consider turning this into an actual "Leads Dashboard" overview if the `sales/leads` route grows too large or requires a distinct entry point.
- **Errors**: No explicit bugs. Standard redirect implementation.
- **Enhancement Plan**: Audit whether this file is required for legacy links. If obsolete, remove it to trim the route tree.

## Route / Component: `src/app/dashboard/crm/loans/[id]/activity/page.tsx`
- **Current Features**: Shows an audit timeline of a specific loan's history (e.g. status changes, edits) using `EntityAuditTimeline` inside `EntityDetailShell`.
- **Possible Features**: Allow users to manually add log entries/comments directly into the timeline.
- **Errors**: No hydration issues or error boundaries missing.
- **Enhancement Plan**: Integrate filtering by activity type (e.g., payments vs. status changes) to make long histories easier to parse.

## Route / Component: `src/app/dashboard/crm/loans/[id]/edit/page.tsx`
- **Current Features**: Server component that fetches an existing loan by ID and renders `<LoanForm mode="edit">` prefilled with its current values.
- **Possible Features**: Add inline validation or preview of loan schedule recalculations before saving.
- **Errors**: Fails gracefully with `notFound()` if the loan doesn't exist.
- **Enhancement Plan**: Standardize the error boundaries so that unexpected database failures result in a clean error UI rather than a generic 500 page.

## Route / Component: `src/app/dashboard/crm/loans/[id]/page.tsx`
- **Current Features**: Deep detail view for a loan, showing KPIs (Principal, Interest, Outstanding), linked client, term details, and a repayment schedule tab. It includes "Edit" and "Delete" quick actions.
- **Possible Features**: Include an "Export Amortization Schedule" button (CSV/PDF) and a "Log Payment" quick action.
- **Errors**: Missing specific error boundaries around the client fetch logic, which could crash the page if the client ID becomes orphaned.
- **Enhancement Plan**: Extract the repayment schedule table into a client component with client-side sorting and filtering for faster UX.

## Route / Component: `src/app/dashboard/crm/loans/new/page.tsx`
- **Current Features**: Shell for creating a new loan, hydrating `<LoanForm mode="create">`.
- **Possible Features**: Allow passing a `?clientId=` search param to pre-fill the customer when navigating from a CRM contact profile.
- **Errors**: None observed.
- **Enhancement Plan**: Add a client-side calculator preview within the form so users can see the resulting monthly payment before submitting.

## Route / Component: `src/app/dashboard/crm/loans/page.tsx`
- **Current Features**: Lists all loans. Fetches data server-side and passes it to `<LoansListClient>` for client-side filtering, KPIs, and bulk actions.
- **Possible Features**: Add a chart visualizing total outstanding loans grouped by status (active vs. defaulted).
- **Errors**: None. Safe data handoff to client component.
- **Enhancement Plan**: Implement pagination or infinite scrolling if the number of loans scales significantly.

## Route / Component: `src/app/dashboard/crm/mentions/page.tsx`
- **Current Features**: An inbox-style page showing where the current user was `@mentioned` across the CRM (e.g., in task comments, project notes).
- **Possible Features**: "Mark all as read" button and filtering by entity type (Task, Issue, Lead).
- **Errors**: Needs proper empty state handling if the user has no mentions.
- **Enhancement Plan**: Implement real-time updates (via WebSockets or SSE) so mentions appear instantly without a page refresh.

## Route / Component: `src/app/dashboard/crm/messages/[peerId]/page.tsx`
- **Current Features**: Direct messaging thread with a specific peer. Fetches the chat history server-side and mounts `<ChatThreadClient>`.
- **Possible Features**: Typing indicators, read receipts, and file attachment support.
- **Errors**: Lacks a graceful fallback if `peerId` is invalid or refers to a deleted user.
- **Enhancement Plan**: Switch to an optimistic UI approach for message sending to make the chat feel instantaneous.

## Route / Component: `src/app/dashboard/crm/messages/page.tsx`
- **Current Features**: Lists recent direct message conversations and acts as an entry point for the chat system.
- **Possible Features**: Add a global unread badge and a "New Message" modal to easily search for peers.
- **Errors**: Standard component, no glaring bugs.
- **Enhancement Plan**: Add online status indicators for peers in the recent conversations list.

## Route / Component: `src/app/dashboard/crm/notifications/page.tsx`
- **Current Features**: A general notifications center (system alerts, task assignments).
- **Possible Features**: Grouping notifications by day/week and allowing bulk dismissal.
- **Errors**: If notifications grow too large, the initial payload could be heavy.
- **Enhancement Plan**: Introduce cursor-based pagination and a "Notification Settings" panel to let users opt out of specific alert types.

## Route / Component: `src/app/dashboard/crm/page.tsx`
- **Current Features**: The main CRM overview dashboard. Currently contains placeholder stats or redirects.
- **Possible Features**: A customizable widget system allowing users to pin KPI cards (Sales, Active Projects, Outstanding Loans) to their home screen.
- **Errors**: None.
- **Enhancement Plan**: Aggregate personalized data (assigned tasks, unread mentions, upcoming loan repayments) into a unified "My Day" view.

## Route / Component: `src/app/dashboard/crm/petty-cash/[id]/activity/page.tsx`
- **Current Features**: Shows the audit trail for a specific petty cash voucher/record.
- **Possible Features**: Show differences (diffs) of amount changes in the activity feed.
- **Errors**: None.
- **Enhancement Plan**: Standardize the timeline UI to match the generic `EntityAuditTimeline` used in other modules.

## Route / Component: `src/app/dashboard/crm/petty-cash/[id]/edit/page.tsx`
- **Current Features**: Server component for editing an existing petty cash record via `<PettyCashForm>`.
- **Possible Features**: Add image upload for receipts directly in the edit form.
- **Errors**: `notFound()` handles missing IDs safely.
- **Enhancement Plan**: Prevent editing if the petty cash record has already been "reconciled" by finance.

## Route / Component: `src/app/dashboard/crm/petty-cash/[id]/page.tsx`
- **Current Features**: Detail view of a petty cash voucher, showing amount, date, description, and attached receipts.
- **Possible Features**: Add an "Approve / Reject" workflow for managers.
- **Errors**: Could error if receipt image URLs are broken.
- **Enhancement Plan**: Integrate a lightbox or PDF viewer for attached receipts so they can be viewed without leaving the page.

## Route / Component: `src/app/dashboard/crm/petty-cash/new/page.tsx`
- **Current Features**: Form shell for creating a new petty cash request or log.
- **Possible Features**: Auto-fill the date and the requester's name based on the logged-in user.
- **Errors**: None.
- **Enhancement Plan**: Introduce OCR capabilities so uploading a receipt automatically populates the amount and vendor.

## Route / Component: `src/app/dashboard/crm/petty-cash/page.tsx`
- **Current Features**: List of all petty cash logs, filterable by date and status, managed by a client island.
- **Possible Features**: Add a KPI strip showing "Total Disbursed This Month" vs "Total Reconciled".
- **Errors**: None.
- **Enhancement Plan**: Add a CSV/Excel export feature tailored for accounting (e.g., mapping to specific GL codes).

## Route / Component: `src/app/dashboard/crm/pinned/page.tsx`
- **Current Features**: Lists entities (projects, tasks, clients) that the user has "pinned" for quick access.
- **Possible Features**: Allow users to manually reorder their pinned items via drag-and-drop.
- **Errors**: If a pinned entity is deleted, it might result in a dead link or a crash if not safely filtered out.
- **Enhancement Plan**: Eagerly validate pinned IDs against the database to silently remove orphaned pins on load.

## Route / Component: `src/app/dashboard/crm/portal/[id]/activity/page.tsx`
- **Current Features**: Audit timeline for a portal user account (login history, capability changes).
- **Possible Features**: IP address logging for security audits.
- **Errors**: None.
- **Enhancement Plan**: Provide a "Force Logout" action button directly from the activity feed if suspicious logins are detected.

## Route / Component: `src/app/dashboard/crm/portal/[id]/edit/page.tsx`
- **Current Features**: Edit settings for a portal user, such as changing their linked CRM entity or updating capabilities.
- **Possible Features**: A toggle to temporarily suspend portal access.
- **Errors**: None.
- **Enhancement Plan**: Ensure capability changes are instantly pushed to the user's active session.

## Route / Component: `src/app/dashboard/crm/portal/[id]/page.tsx`
- **Current Features**: Portal user profile view, showing their login stats, linked entity (e.g., Customer/Vendor), and access rights.
- **Possible Features**: "Send password reset" button.
- **Errors**: None.
- **Enhancement Plan**: Show a summary of their recent activity (e.g., tickets raised, invoices viewed) on the profile page.

## Route / Component: `src/app/dashboard/crm/portal/new/page.tsx`
- **Current Features**: Form for inviting a new external user (Customer, Vendor, Employee) to the self-service portal.
- **Possible Features**: Role templates (e.g., "Basic Customer", "Admin Customer") to quickly set capabilities.
- **Errors**: Validation relies heavily on server actions; could use more client-side validation (e.g. Zod in the form).
- **Enhancement Plan**: Convert the hidden capability JSON string (`value='["view_invoices",...]'`) into a set of interactive checkboxes for fine-grained control.

## Route / Component: `src/app/dashboard/crm/portal/page.tsx`
- **Current Features**: Lists all portal users.
- **Possible Features**: Bulk action to revoke access or resend invites.
- **Errors**: Minor risk: The `userId` filter hardcodes a fallback type; should ensure `session.user._id` exists.
- **Enhancement Plan**: Add a "Last Active" column to help identify dormant portal accounts that can be deactivated.

## Route / Component: `src/app/dashboard/crm/pos/hold-recall/page.tsx`
- **Current Features**: Displays a list of parked/held POS transactions waiting to be recalled.
- **Possible Features**: Allow merging multiple held tickets.
- **Errors**: None.
- **Enhancement Plan**: Add an auto-purge policy (e.g., held tickets older than 24h are automatically voided).

## Route / Component: `src/app/dashboard/crm/pos/page.tsx`
- **Current Features**: Deep POS overview dashboard with KPI strips (today's revenue, top register, avg ticket) and recent activity lists.
- **Possible Features**: Real-time sales graph comparing today vs. yesterday.
- **Errors**: Date logic (`setHours(0,0,0,0)`) relies on the server's local timezone. Could cause data discrepancies for users in different timezones.
- **Enhancement Plan**: Refactor timezone logic to use the store's configured timezone rather than the server's local time.

## Route / Component: `src/app/dashboard/crm/pos/refunds/new/page.tsx`
- **Current Features**: Pre-fills a refund form based on a required `originalTransactionId`.
- **Possible Features**: Restock inventory option (toggle per line item).
- **Errors**: Fails safely with a fallback UI if no `originalTransactionId` is provided.
- **Enhancement Plan**: Add an approval flow for refunds exceeding a certain threshold (requiring manager pin).

## Route / Component: `src/app/dashboard/crm/pos/refunds/page.tsx`
- **Current Features**: Read-only audit list of all processed POS refunds.
- **Possible Features**: Filter by refund reason (e.g., damaged goods, customer changed mind).
- **Errors**: None.
- **Enhancement Plan**: Add a summary KPI showing the total value of refunds in the currently filtered date range.

## Route / Component: `src/app/dashboard/crm/pos/sessions/[id]/page.tsx`
- **Current Features**: Detailed view of a POS session with tabs for Overview, Transactions, Reconciliation, and Activity. Shows expected vs actual cash.
- **Possible Features**: Option to print a Z-Report/End-of-Day summary directly from this page.
- **Errors**: Discrepancy logic relies on nullable fields (`closingCash`, `expectedCash`); needs robust rendering for sessions that are still open.
- **Enhancement Plan**: Enhance the "Reconciliation" tab with a visual coin/bill counter widget to assist cashiers in calculating their drawer totals.

## Route / Component: `src/app/dashboard/crm/pos/sessions/new/page.tsx`
- **Current Features**: Server component hosting the form to open a new POS session.
- **Possible Features**: Force the user to enter the opening float (cash in drawer) before proceeding.
- **Errors**: Terminal selection is currently free-text. This could lead to typos and fragmented reporting.
- **Enhancement Plan**: As noted in the comments, implement a lookup registry for terminals instead of free-text inputs.

## Route / Component: `src/app/dashboard/crm/pos/sessions/page.tsx`
- **Current Features**: List of all POS sessions (shifts).
- **Possible Features**: Bulk export of session summaries for accounting.
- **Errors**: None.
- **Enhancement Plan**: Add a visual indicator (like a pulsing green dot) next to open sessions to easily spot active registers.

## Route / Component: `src/app/dashboard/crm/pos/terminal/page.tsx`
- **Current Features**: Dual-mode component: Shows the active terminal UI if `?live=1` is passed, otherwise shows a Terminal Manager dashboard summarizing device status.
- **Possible Features**: Remote lockdown of a terminal from the manager view.
- **Errors**: If multiple sessions are open on the same terminal, the logic might arbitrarily pick the first one.
- **Enhancement Plan**: Introduce explicit WebSocket heartbeats to accurately determine if a terminal is truly "online" vs just having an open session.

## Route / Component: `src/app/dashboard/crm/products/[productId]/edit/page.tsx`
- **Current Features**: Reuses `<ItemForm>` to edit a product's details.
- **Possible Features**: Allow updating stock directly from the edit view (creating a quick adjustment record).
- **Errors**: Missing error boundary if `productId` lookup fails.
- **Enhancement Plan**: Refactor to handle concurrent edits (optimistic locking) so two users don't overwrite each other's changes.

## Route / Component: `src/app/dashboard/crm/products/[productId]/page.tsx`
- **Current Features**: Displays product details and inventory status, including a low-stock indicator.
- **Possible Features**: View a history graph of price changes or stock movements.
- **Errors**: Potential mismatch if the item is not tracked but has a reorder point configured.
- **Enhancement Plan**: Add a "Supplier Information" card to quickly see who to contact when stock is low.

## Route / Component: `src/app/dashboard/crm/products/new/page.tsx`
- **Current Features**: Reuses `<ItemForm>` to create a new product. Supports `?fromKind=product&fromId=` to duplicate an existing item.
- **Possible Features**: Bulk import via CSV inside the new product flow.
- **Errors**: None.
- **Enhancement Plan**: When duplicating, ensure that images/attachments from the original product are also deep-copied if desired.

## Route / Component: `src/app/dashboard/crm/products/page.tsx`
- **Current Features**: Grid/List view of products with complex filtering (stock status, category, type), KPIs, and bulk actions.
- **Possible Features**: Barcode scanner integration in the search bar.
- **Errors**: Loading state relies heavily on React Transition; could feel unresponsive if the backend is slow.
- **Enhancement Plan**: Implement server-side pagination and filtering instead of loading all products and filtering them on the client (which won't scale).

## Route / Component: `src/app/dashboard/crm/projects/[projectId]/edit/page.tsx`
- **Current Features**: Uses `<ProjectForm>` to update an existing project's metadata (budget, dates, client).
- **Possible Features**: Option to archive/unarchive the project.
- **Errors**: Formats dates simply via `.slice(0, 10)`, which could cause off-by-one errors due to timezones.
- **Enhancement Plan**: Use a robust date library (e.g., `date-fns`) for date input parsing and formatting.

## Route / Component: `src/app/dashboard/crm/projects/[projectId]/page.tsx`
- **Current Features**: Massive detail view with tabs for Tasks, Milestones, Members, Files, Notes, Activity, Gantt, and Burndown.
- **Possible Features**: Add a "Client View" link to share a read-only progress dashboard with external stakeholders.
- **Errors**: The file is quite monolithic (1300+ lines); highly complex state management.
- **Enhancement Plan**: Split the tab contents (Tasks, Milestones, etc.) into separate dynamic imports or parallel routes to reduce initial bundle size and improve maintainability.

## Route / Component: `src/app/dashboard/crm/projects/activity/page.tsx`
- **Current Features**: Cross-project timeline feed using `<ActivityTimelinePage>`.
- **Possible Features**: Slack/Discord webhook integration configurations for activity feeds.
- **Errors**: None.
- **Enhancement Plan**: Allow users to "Subscribe" to specific project activities to get email digests.

## Route / Component: `src/app/dashboard/crm/projects/categories/page.tsx`
- **Current Features**: Manages project Categories and Sub-categories using `TaxonomyLookupPage`.
- **Possible Features**: Drag-and-drop hierarchy management for sub-categories.
- **Errors**: None.
- **Enhancement Plan**: Implement soft deletes for categories so that existing projects aren't orphaned if a category is removed.

## Route / Component: `src/app/dashboard/crm/projects/gantt/page.tsx`
- **Current Features**: Interactive Gantt chart for scheduling tasks and mapping dependencies across a project. Supports drag-to-reschedule and drag-to-link.
- **Possible Features**: Critical path highlighting and auto-scheduling downstream dependent tasks when an upstream task moves.
- **Errors**: Highly complex SVG manipulation; could have performance bottlenecks with projects containing hundreds of tasks.
- **Enhancement Plan**: Refactor the drag handlers to use pointer capture and requestAnimationFrame for smoother 60fps dragging on large charts.

## Route / Component: `src/app/dashboard/crm/projects/issues/[id]/edit/page.tsx`
- **Current Features**: Wraps `<IssueForm mode="edit">` to modify an issue, with an activity rail on the side.
- **Possible Features**: Markdown support in the description editor.
- **Errors**: Subtasks and attachments are cast heavily from unknown arrays, which is brittle if the database schema changes.
- **Enhancement Plan**: Use Zod to strongly type and parse the issue record retrieved from the database before passing it to the form.

## Route / Component: `src/app/dashboard/crm/projects/issues/[id]/page.tsx`
- **Current Features**: Read-only view of a specific issue. Notes that the comments subsystem needs to be plugged in.
- **Possible Features**: Implement the aforementioned comments subsystem.
- **Errors**: None.
- **Enhancement Plan**: Add GitHub/GitLab integration to link issues to specific PRs or commits.

## Route / Component: `src/app/dashboard/crm/projects/issues/new/page.tsx`
- **Current Features**: Wraps `<NewIssueForm>`.
- **Possible Features**: Templates for different issue types (Bug, Feature Request, Epic).
- **Errors**: None.
- **Enhancement Plan**: Automatically assign the issue to the project lead if no assignee is selected.

## Route / Component: `src/app/dashboard/crm/projects/issues/page.tsx`
- **Current Features**: List/Kanban view of all issues across projects, with bulk actions (close, delete) and CSV export.
- **Possible Features**: Custom saved filters (e.g., "My Open Critical Bugs").
- **Errors**: KPI `avgDays` calculation relies on client-side array reduction which will be inaccurate if pagination is introduced.
- **Enhancement Plan**: Move KPI calculation to the backend via a MongoDB aggregation pipeline for accurate, global stats.

## Route / Component: `src/app/dashboard/crm/projects/kanban/page.tsx`
- **Current Features**: Global task board allowing users to drag tasks across custom or default columns (To Do, In Progress, Review, Done).
- **Possible Features**: Swimlanes grouped by Assignee or Project.
- **Errors**: Optimistic UI update could desync if the `updateWsTaskColumn` API fails repeatedly.
- **Enhancement Plan**: Introduce WebSockets to sync board state across multiple users viewing the Kanban board simultaneously.

## Route / Component: `src/app/dashboard/crm/projects/labels/page.tsx`
- **Current Features**: Manages reusable colored labels for projects using `TaxonomyLookupPage`.
- **Possible Features**: Allow assigning labels to specific project templates.
- **Errors**: None.
- **Enhancement Plan**: Ensure text contrast on labels (automatically use black or white text depending on the chosen hex color's luminance).
