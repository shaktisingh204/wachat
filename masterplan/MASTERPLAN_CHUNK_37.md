# Master Plan Chunk 37

This chunk covers the analysis of SabWa settings, overview, miscellaneous SabWa tools, setup, public share pages, and some e-commerce pages.

## `src/app/sabwa/overview/page.tsx`
- **Route / Component**: `src/app/sabwa/overview/page.tsx` (`SabwaOverviewPage`)
- **Current Features**: Shell component for accounts overview. Hands off to `OverviewAccountsClient`.
- **Possible Features**: Global metric roll-ups.
- **Errors**: None.
- **Enhancement Plan**: N/A

## `src/app/sabwa/page.tsx`
- **Route / Component**: `src/app/sabwa/page.tsx` (`SabwaAllProjectsPage`)
- **Current Features**: Server component for project picker. Fetches `getCachedProjects()` and `getCachedSession()`. Maps projects to `AllProjectsBootstrap` and passes to `AllProjectsClient`. Redirects to `/login` if no session.
- **Possible Features**: Project search/filter if list is long.
- **Errors**: Extensive `any` casting because `Project` type might not match the raw mongo document. e.g., `(p as any).wabaId`.
- **Enhancement Plan**: Ensure `Project` type in `@/lib/definitions` includes `groupName`, `wabaId`, `facebookPageId`, `kind`, and `phoneNumbers` so the `any` casts can be removed safely.

## `src/app/sabwa/quick-replies/page.tsx`
- **Route / Component**: `src/app/sabwa/quick-replies/page.tsx` (`Page`)
- **Current Features**: Quick replies table. Slash command shortcuts that expand to text (e.g. `/thanks`). Toggle enabled state. Shows usage counts. Dialog for creating/editing with live preview. Attach media via SabFiles.
- **Possible Features**: Support variables in quick replies (e.g. `{{name}}`).
- **Errors**: None major.
- **Enhancement Plan**: N/A

## `src/app/sabwa/scheduler/page.tsx`
- **Route / Component**: `src/app/sabwa/scheduler/page.tsx` (`SchedulerCalendarPage`)
- **Current Features**: Scheduler calendar (month/week/day views). Drag and drop events to reschedule. Click to edit. Calls `listScheduledMessages`.
- **Possible Features**: Drag and drop onto specific times in day/week views. (Currently it seems to just drop on the slot, which is fine).
- **Errors**: No timezone handling displayed in the chips, but `item.timezone` exists in raw payload.
- **Enhancement Plan**: Visually distinguish recurring vs one-time events in the calendar chips.

## `src/app/sabwa/scheduler/queue/page.tsx`
- **Route / Component**: `src/app/sabwa/scheduler/queue/page.tsx` (`SchedulerQueuePage`)
- **Current Features**: Scheduler queue (power-user table). Filter by status, date range, search target/message. Bulk reschedule / bulk cancel. 
- **Possible Features**: Pause/resume recurring messages without cancelling.
- **Errors**: None major.
- **Enhancement Plan**: N/A

## `src/app/sabwa/settings/devices/page.tsx`
- **Route / Component**: `src/app/sabwa/settings/devices/page.tsx` (`Page`)
- **Current Features**: Settings tab for linked devices. Renders a card that links to `/sabwa/devices`.
- **Possible Features**: N/A
- **Errors**: None.
- **Enhancement Plan**: Consider moving the actual device list to this page instead of linking away, to keep settings centralized.

## `src/app/sabwa/settings/notifications/page.tsx`
- **Route / Component**: `src/app/sabwa/settings/notifications/page.tsx` (`NotificationsSettingsPage`)
- **Current Features**: Settings for notifications (Desktop, Email digests, Push (coming soon), Sound for incoming, Mute schedules).
- **Possible Features**: Granular event toggles (e.g., mute group mentions vs direct messages).
- **Errors**: Loading state and initial fetch runs inside useEffect. It catches and ignores API failures with "Phase 1 stub" comment.
- **Enhancement Plan**: Connect real user data source when engine APIs for notifications are ready. Handle API errors visibly.

## `src/app/sabwa/settings/page.tsx`
- **Route / Component**: `src/app/sabwa/settings/page.tsx` (`ProfileSettingsPage`)
- **Current Features**: Settings - Profile. View connection status (number, last connected), edit profile (push name, about, profile pic). Uses `SabFilePickerButton` for profile picture. Push to WhatsApp or Sync from WhatsApp.
- **Possible Features**: Multi-device state preview.
- **Errors**: `getProfile` uses `sessionId` but catches and ignores NOT_IMPLEMENTED if stubbed.
- **Enhancement Plan**: Finish connecting `getProfile` stubs.

## `src/app/sabwa/settings/privacy/page.tsx`
- **Route / Component**: `src/app/sabwa/settings/privacy/page.tsx` (`PrivacySettingsPage`)
- **Current Features**: Settings - Privacy. Two-factor PIN, Blocked contacts, Read receipts, Visibility selectors (last seen, group add policy, profile pic, status), E2EE disclaimer, Session key rotation.
- **Possible Features**: Disappearing messages default timer.
- **Errors**: None.
- **Enhancement Plan**: N/A

## `src/app/sabwa/settings/rate-limits/page.tsx`
- **Route / Component**: `src/app/sabwa/settings/rate-limits/page.tsx` (`RateLimitsPage`)
- **Current Features**: Settings - Rate Limits. Pick sending profile (Safe, Normal, Aggressive). Warmup mode toggle. Per-action overrides. Daily reset timezone.
- **Possible Features**: Usage charts.
- **Errors**: Emits console warning that "Engine does not yet expose a `getRateLimitProfile` action".
- **Enhancement Plan**: Implement `getRateLimitProfile` on the rust engine and connect it here.

## `src/app/sabwa/starred/page.tsx`
- **Route / Component**: `src/app/sabwa/starred/page.tsx` (`SabWaStarredPage`)
- **Current Features**: Cross-chat starred message view. Groups starred messages by chat. Collapsible cards. Previews use `MessageBubble`. "Jump to message" deep-link. Search by message body or chat name.
- **Possible Features**: Unstar directly from this view. Bulk unstar.
- **Errors**: None major.
- **Enhancement Plan**: Add ability to unstar directly without navigating away.

## `src/app/sabwa/status/page.tsx`
- **Route / Component**: `src/app/sabwa/status/page.tsx` (`SabWaStatusPage`)
- **Current Features**: Status / Stories view. Two views: "My status" and "Friends' statuses". Compose text (with bg color) or media. Audience selection. Friends' statuses are fetched from chats where `type === 'status'`. Swipeable viewer.
- **Possible Features**: Reply to a status. View list of who viewed your status (stubbed now).
- **Errors**: "My posted statuses" are only stored in React state (`const [posted, setPosted] = React.useState`). They will be lost on page reload.
- **Enhancement Plan**: Wire "My status" to the engine using a real database table/action, instead of holding it in memory.

## `src/app/sabwa/templates/page.tsx`
- **Route / Component**: `src/app/sabwa/templates/page.tsx` (`Page`)
- **Current Features**: Templates grid organized by folders. Dialog editor with `{{variable}}` insertion and media attachments. "Use template" quick actions (insert, broadcast, schedule).
- **Possible Features**: Template approval sync for Official WhatsApp API.
- **Errors**: None.
- **Enhancement Plan**: N/A

## `src/app/sabwa/webhooks/page.tsx`
- **Route / Component**: `src/app/sabwa/webhooks/page.tsx` (`WebhooksPage`)
- **Current Features**: Outbound webhook management. Create webhook (shows one-time signing secret). Table of registered endpoints with success rate. Drawer shows recent deliveries with response excerpt and latency. "Resend" and "Test" buttons.
- **Possible Features**: Webhook filtering by specific labels or conditions.
- **Errors**: None.
- **Enhancement Plan**: N/A

## `src/app/setup/page.tsx`
- **Route / Component**: `src/app/setup/page.tsx` (`SetupPage`)
- **Current Features**: Page to connect WhatsApp account using Meta Embedded Signup (`@/components/wabasimplify/embedded-signup`).
- **Possible Features**: Setup progress tracking.
- **Errors**: `appId` and `configId` from `NEXT_PUBLIC_META_ONBOARDING_APP_ID` are required. Shows error if missing.
- **Enhancement Plan**: Add fallback or guide for when env variables are not configured.

## `src/app/share/[token]/page.tsx`
- **Route / Component**: `src/app/share/[token]/page.tsx` (`ShareLandingPage`)
- **Current Features**: SabFiles public share link. Fetches public share view from rust engine `rustClient.sabfiles.publicShareView(token)`. Passes data to `<ShareLanding>`.
- **Possible Features**: Password protection.
- **Errors**: None.
- **Enhancement Plan**: N/A

## `src/app/share/contract/[hash]/page.tsx`
- **Route / Component**: `src/app/share/contract/[hash]/page.tsx` (`PublicContractPage`)
- **Current Features**: Public contract view. Fetches `getPublicContract`. Displays contract details and body (sanitized HTML). `<ContractSignPanel>` at the bottom for signing.
- **Possible Features**: Multi-party signing workflow.
- **Errors**: Strips scripts and styles from HTML but custom ALLOWED_TAGS might strip complex formatting that users expect.
- **Enhancement Plan**: Consider integrating `DOMPurify` to allow a broader set of safe formatting tags if complaints arise.

## `src/app/share/estimate/[hash]/page.tsx`
- **Route / Component**: `src/app/share/estimate/[hash]/page.tsx` (`PublicEstimatePage`)
- **Current Features**: Public estimate view. Fetches `getPublicEstimate`. Shows line items, subtotal, and notes. `<EstimateActionsPanel>` for accept/decline.
- **Possible Features**: Pay advance / deposit upon acceptance.
- **Errors**: None.
- **Enhancement Plan**: N/A

## `src/app/share/gantt/[hash]/page.tsx`
- **Route / Component**: `src/app/share/gantt/[hash]/page.tsx` (`PublicGanttPage`)
- **Current Features**: Public read-only project timeline view. Fetches `getPublicGantt`. Displays `<PublicGanttChart>`.
- **Possible Features**: PDF Export.
- **Errors**: None.
- **Enhancement Plan**: N/A

## `src/app/share/invoice/[hash]/page.tsx`
- **Route / Component**: `src/app/share/invoice/[hash]/page.tsx` (`PublicInvoicePage`)
- **Current Features**: Public invoice view. Fetches `getPublicInvoice`. Marks invoice as viewed (`markInvoiceViewed`). Displays bill to, line items, totals. Handles PayPal capture return (`capturePayPalPayment`). Displays `<InvoicePaymentPanel>`.
- **Possible Features**: Webhooks upon payment.
- **Errors**: None.
- **Enhancement Plan**: Improve messaging when a payment is captured vs pending vs failed.

## `src/app/share/layout.tsx`
- **Route / Component**: `src/app/share/layout.tsx` (`ShareLayout`)
- **Current Features**: Public share layout wrapper. Fetches branding (logo, name) from the `companies` collection. Shows unbranded footer.
- **Possible Features**: Custom domain mapping for shares.
- **Errors**: None.
- **Enhancement Plan**: N/A

## `src/app/share/lead-form/[formId]/page.tsx`
- **Route / Component**: `src/app/share/lead-form/[formId]/page.tsx` (`PublicLeadFormPage`)
- **Current Features**: Public lead form display. Fetches `getPublicLeadForm`. Passes fields and consent config to `<LeadFormClient>`.
- **Possible Features**: reCAPTCHA integration.
- **Errors**: None.
- **Enhancement Plan**: N/A

## `src/app/share/project-rating/[hash]/page.tsx`
- **Route / Component**: `src/app/share/project-rating/[hash]/page.tsx` (`PublicProjectRatingPage`)
- **Current Features**: Public project rating form. Keyed on `crm_projects.publicRatingHash`. Shows static "thanks" panel if already rated (by IP logic on backend).
- **Possible Features**: Review collection syndication.
- **Errors**: None.
- **Enhancement Plan**: N/A

## `src/app/share/proposal/[hash]/page.tsx`
- **Route / Component**: `src/app/share/proposal/[hash]/page.tsx` (`PublicProposalPage`)
- **Current Features**: Public proposal view. Fetches `getPublicProposal`. Shows totals, basic HTML body (simple manual escape). `<ProposalActionsPanel>`.
- **Possible Features**: Signature collection.
- **Errors**: Simple HTML escape does not handle rich formatting properly, replaces `\n` with `<br />` but ignores lists/bold/images.
- **Enhancement Plan**: Switch to a real HTML sanitizer or markdown parser if rich text is needed.

## `src/app/share/taskboard/[hash]/page.tsx`
- **Route / Component**: `src/app/share/taskboard/[hash]/page.tsx` (`PublicTaskboardPage`)
- **Current Features**: Public read-only Kanban view of a project. Shows columns and cards with priorities, assignees, and dates.
- **Possible Features**: Card filtering (by assignee or tag).
- **Errors**: None.
- **Enhancement Plan**: N/A

## `src/app/shop/[slug]/[pageSlug]/page.tsx`
- **Route / Component**: `src/app/shop/[slug]/[pageSlug]/page.tsx` (`ShopSubPage`)
- **Current Features**: Renders an E-commerce shop subpage using `<Canvas>` from the website-builder. Fetches page layout from `ecomm_pages` and products from `ecomm_shops`.
- **Possible Features**: Theming, cart overlay.
- **Errors**: None.
- **Enhancement Plan**: Implement proper `generateStaticParams` to statically pre-render all published pages at build time.
