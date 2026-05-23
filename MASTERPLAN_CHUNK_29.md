# Masterplan: Chunk 29 Analysis

This document details the analysis of the Next.js pages assigned to agent 29. The focus area spans several core modules of the SabNode platform, primarily: Profile Redirects, QR Code Maker, SabChat, SabFiles, SabFlow, and Settings.

## 1. Profile
### `src/app/dashboard/profile/page.tsx`
- **Current Features**: Redirects the user to `/dashboard/settings/profile` immediately upon mounting using a `useEffect`. Displays a generic `Loader2` "Redirecting..." state.
- **Possible Features**: None, it is just a utility redirect.
- **Errors**: Using a client-side `useEffect` for a static redirect causes a brief UI flash.
- **Enhancement Plan**: Replace this client-side redirect with a Next.js middleware or `next.config.js` rewrite/redirect to eliminate the flash of loading state and improve performance.

## 2. QR Code Maker
### `src/app/dashboard/qr-code-maker/page.tsx`
- **Current Features**: A robust QR code generation tool offering multiple types (URL, Text, Email, Phone, SMS, WiFi, vCard). Features real-time preview, logo embedding, color customization, and error correction levels. Saves data to local storage.
- **Possible Features**: Dynamic QR codes (redirecting through a SabNode shortlink for analytics tracking), bulk generation, vector (SVG/EPS) export.
- **Errors**: Relies heavily on `localStorage` which means data does not sync across devices.
- **Enhancement Plan**: Integrate backend database models to persist QR campaigns and settings to the cloud, enabling cross-device sync and team sharing.

### `src/app/dashboard/qr-code-maker/campaigns/page.tsx`
- **Current Features**: Lists saved QR campaigns from local storage. Allows editing and deleting campaigns.
- **Possible Features**: Campaign analytics (scans over time, device types, locations).
- **Errors**: Data persistence is local-only.
- **Enhancement Plan**: Migrate storage mechanism from `localStorage` to the database via server actions, allowing the inclusion of tracking metrics.

### `src/app/dashboard/qr-code-maker/settings/page.tsx`
- **Current Features**: Settings hub for the QR Code maker. Currently acts as a router hub to specific settings pages.
- **Possible Features**: Default global styling preferences for all new QR codes.
- **Errors**: None.
- **Enhancement Plan**: Add configuration for default export formats and resolution settings.

### `src/app/dashboard/qr-code-maker/settings/brand-kit/page.tsx`
- **Current Features**: Allows saving custom brand colors and logos to apply quickly to QR codes. Uses local storage.
- **Possible Features**: Import brand assets directly from a company website URL.
- **Errors**: Local storage reliance limits utility for team workspaces.
- **Enhancement Plan**: Store the brand kit on the server so that when the team uses the QR builder, the brand kit is uniformly available.

## 3. SabChat
### `src/app/dashboard/sabchat/page.tsx`
- **Current Features**: Simple client-side redirect to `/dashboard/sabchat/inbox`.
- **Possible Features**: N/A
- **Errors**: Same as profile page; client-side redirect flash.
- **Enhancement Plan**: Move to `next.config.js` redirects.

### `src/app/dashboard/sabchat/ai-replies/page.tsx`
- **Current Features**: AI assistant configuration. Users can enable/disable AI, define system context (prompt), and save settings via `saveSabChatSettings`.
- **Possible Features**: AI Prompt testing sandbox, ability to select different AI models (e.g. Claude 3, GPT-4).
- **Errors**: None, standard ZoruUI implementation.
- **Enhancement Plan**: Add a "Test Bot" floating window to allow the user to immediately test how their prompt affects the AI's behavior before deploying.

### `src/app/dashboard/sabchat/analytics/page.tsx`
- **Current Features**: Dashboard showing chat volume metrics. Displays KPIs (total, open, closed chats, satisfaction) and a recharts area chart for daily volume.
- **Possible Features**: Filter by date range, export to CSV, agent-level performance breakdown.
- **Errors**: Currently, the analytics action is largely mocked or static for demo purposes.
- **Enhancement Plan**: Implement dynamic date-range pickers and integrate with real backend telemetry for live agent metrics.

### `src/app/dashboard/sabchat/auto-reply/page.tsx`
- **Current Features**: Configures Welcome and Away automated messages. Saves to module settings.
- **Possible Features**: Time-of-day specific auto-replies, multi-lingual auto-replies based on visitor browser language.
- **Errors**: None.
- **Enhancement Plan**: Support variables in the message like `{{visitor_name}}` and markdown formatting.

### `src/app/dashboard/sabchat/faq/page.tsx`
- **Current Features**: Knowledge base manager for AI training. Table layout with Add/Edit/Delete modals. 
- **Possible Features**: Bulk import via CSV, categorized FAQs.
- **Errors**: None.
- **Enhancement Plan**: Implement a drag-and-drop sort functionality so FAQs appear in a specific priority order on the chat widget.

### `src/app/dashboard/sabchat/inbox/page.tsx`
- **Current Features**: Real-time agent inbox. Wraps `ZoruSabChatClient` inside a Suspense boundary.
- **Possible Features**: Mentioning other agents, internal notes, visitor location map.
- **Errors**: None.
- **Enhancement Plan**: Expand the UI to include a right-hand sidebar showing visitor metadata (location, past visits, CRM data).

### `src/app/dashboard/sabchat/quick-replies/page.tsx`
- **Current Features**: Canned responses with `/` shortcuts.
- **Possible Features**: Rich text support, grouping by tags.
- **Errors**: None.
- **Enhancement Plan**: Allow template parameters inside quick replies that expand dynamically.

### `src/app/dashboard/sabchat/settings/page.tsx`
- **Current Features**: Six independent setting sections (Channels, Working hours, Autoresponder, Routing, Webhooks, Notifications) with independent save functionality to avoid large payload writes.
- **Possible Features**: External CRM integration settings, transcript export rules.
- **Errors**: None.
- **Enhancement Plan**: Add an "Unsaved Changes" warning if the user attempts to navigate away before clicking save on a modified block.

### `src/app/dashboard/sabchat/visitors/page.tsx`
- **Current Features**: Live list of website visitors. Polls `getLiveVisitors` every 10 seconds using `setInterval`.
- **Possible Features**: Real-time updates via WebSockets. Page-path tracking.
- **Errors**: HTTP polling can drain client and server resources if left open.
- **Enhancement Plan**: Migrate the 10s polling interval to Server-Sent Events (SSE) or WebSockets for instant, lower-overhead updates.

### `src/app/dashboard/sabchat/widget/page.tsx`
- **Current Features**: Embed code generator and widget preview configuration.
- **Possible Features**: Custom CSS injection, allowed domains list (CORS).
- **Errors**: None.
- **Enhancement Plan**: Render a live, interactable preview of the chat widget directly next to the configuration form.

## 4. SabFiles
### `src/app/dashboard/sabfiles/page.tsx` & `folder/[id]/page.tsx`
- **Current Features**: Root and folder-level views for the file manager. Server components passing nodes and breadcrumbs down to `FileManager`.
- **Possible Features**: Drag-and-drop folder uploads, file metadata preview sidebars.
- **Errors**: None.
- **Enhancement Plan**: Add a right-hand preview pane to show file previews (images/pdfs) without leaving the list view.

### `src/app/dashboard/sabfiles/recent/page.tsx`, `shared/page.tsx`, `starred/page.tsx`, `trash/page.tsx`
- **Current Features**: Utility views wrapping `SimpleList` with specific actions (getRecent, getShared, getStarred, getTrash).
- **Possible Features**: Empty trash button, un-share links.
- **Errors**: None.
- **Enhancement Plan**: For the Trash page, add a highly visible "Empty Trash" global action to immediately free up quota.

### `src/app/dashboard/sabfiles/storage/page.tsx`
- **Current Features**: Displays a breakdown of used vs total storage quota using a progress bar.
- **Possible Features**: Breakdown of storage used by file type.
- **Errors**: None.
- **Enhancement Plan**: Include a colorful breakdown bar chart (e.g. 50% Images, 30% Videos, 20% Documents).

## 5. SabFlow
### `src/app/dashboard/sabflow/page.tsx`
- **Current Features**: Overview dashboard for workflows. Shows execution volume over 24 hours, stats, and a recent activity log.
- **Possible Features**: Date range filters.
- **Errors**: Uses heavily mocked data `EXECUTION_DATA`.
- **Enhancement Plan**: Connect chart and table to live workflow execution telemetry from the database.

### `src/app/dashboard/sabflow/flow-builder/page.tsx`
- **Current Features**: The main SabFlow list view. Shows stats, templates, and a grid/list toggle of existing flows.
- **Possible Features**: Folder organization for flows.
- **Errors**: None.
- **Enhancement Plan**: Allow users to group workflows by folders or tags.

### `src/app/dashboard/sabflow/flow-builder/[flowId]/page.tsx`
- **Current Features**: The visual workflow editor canvas.
- **Possible Features**: Multiplayer real-time collaboration.
- **Errors**: Flow prop is cast using `as any` indicating missing schema definitions.
- **Enhancement Plan**: Strictly type the flow props to avoid runtime schema mismatches.

### `src/app/dashboard/sabflow/flow-builder/[flowId]/diff/page.tsx`
- **Current Features**: Compares two versions of a workflow, with options to restore left or right states.
- **Possible Features**: Visual node-level highlighting of what changed (green for new, red for deleted).
- **Errors**: None.
- **Enhancement Plan**: Display a summary list of changes at the top (e.g., "+1 Node added, -2 Connections removed").

### `src/app/dashboard/sabflow/executions/page.tsx` & `[executionId]/page.tsx`
- **Current Features**: Lists all historical runs and provides a detailed step-by-step playback with input/output JSON payloads for debugging.
- **Possible Features**: Re-run from a specific failed node.
- **Errors**: Relying on large sets of mock data.
- **Enhancement Plan**: Wire to the live execution database and implement pagination for the executions list, as logs can grow exponentially.

### `src/app/dashboard/sabflow/settings/page.tsx`
- **Current Features**: Global flow settings (Defaults, Retention limits, Run Limits, Webhooks, Global Variables).
- **Possible Features**: Secret management (hiding values from UI after saving).
- **Errors**: None.
- **Enhancement Plan**: Mask global variable values like API keys behind an "Eye" icon to prevent shoulder surfing.

### `src/app/dashboard/sabflow/connections/page.tsx`
- **Current Features**: Manages OAuth and API integrations.
- **Possible Features**: Connect live services.
- **Errors**: Mock data `mockConnections` used.
- **Enhancement Plan**: Implement the actual OAuth flow popup and token storage mechanics.

### `src/app/dashboard/sabflow/docs/page.tsx`
- **Current Features**: A searchable catalog of all available nodes and triggers with descriptions and payload examples.
- **Possible Features**: Deep linking to specific nodes.
- **Errors**: None.
- **Enhancement Plan**: Add URL hash routing so `docs#webhook_trigger` automatically opens the webhook documentation accordion.

## 6. Settings
### `src/app/dashboard/settings/page.tsx`
- **Current Features**: Overview grid acting as a router to the different settings areas (Profile, Security, Billing, API Keys, etc.).
- **Possible Features**: Search bar to instantly jump to a specific setting.
- **Errors**: None.
- **Enhancement Plan**: Implement a quick search bar to filter tiles or navigate directly to specific preferences.

### `src/app/dashboard/settings/profile/page.tsx`
- **Current Features**: Manages user name, email, handle, preferred language, and bio. Uses `handleUpdateUserProfile`.
- **Possible Features**: Profile picture upload, timezone preferences.
- **Errors**: None.
- **Enhancement Plan**: Add avatar/profile picture upload functionality utilizing the SabFiles infrastructure.

### `src/app/dashboard/settings/billing/page.tsx`
- **Current Features**: Displays the current subscription plan, price, and feature matrix. Links to invoices.
- **Possible Features**: Payment method management inside the app rather than linking out.
- **Errors**: Casts user objects as `any` indicating incomplete type definitions for billing structures.
- **Enhancement Plan**: Firm up TypeScript definitions for `Plan` and `Wallet` to eliminate `as any` casts.
