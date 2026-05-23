# Masterplan: Chunk 40 Analysis

This document contains a handcrafted analysis for the 35 pages processed in Chunk 40.

## 1. Route / Component: `src/app/wachat/message-tags/page.tsx`
- **Current Features**: Manages message tags. Displays a data table of tags with CRUD capabilities.
- **Possible Features**: Bulk apply tags to past conversations, tag analytics (usage count over time).
- **Errors**: No explicit hydration or server errors.
- **Enhancement Plan**: Add a color-picker for tags to make them visually distinct in the UI. 

## 2. Route / Component: `src/app/wachat/message-templates-library/page.tsx`
- **Current Features**: Template library grid with pre-built message templates.
- **Possible Features**: Allow users to publish their own highly-performant templates to a community library.
- **Errors**: Cloning a template passes data via `localStorage`, which can be unreliable.
- **Enhancement Plan**: Replace `localStorage` with a robust state management solution or URL query parameters for cloning templates.

## 3. Route / Component: `src/app/wachat/numbers/page.tsx`
- **Current Features**: Displays connected WhatsApp Business API phone numbers. Syncs with Meta to show status and quality rating.
- **Possible Features**: Automatic alerts if a number's quality rating drops to "Yellow" or "Red".
- **Errors**: Number status sync might timeout if Meta API is slow.
- **Enhancement Plan**: Implement polling or WebSocket updates for number status instead of requiring manual refreshes.

## 4. Route / Component: `src/app/wachat/opt-out/page.tsx`
- **Current Features**: Manages opt-out lists (blocklist) for numbers that shouldn't receive broadcasts.
- **Possible Features**: Auto-add to opt-out list based on sentiment analysis of inbound messages.
- **Errors**: Bulk upload of opt-outs might fail silently for large files.
- **Enhancement Plan**: Add progress bars and row-level validation for CSV opt-out uploads.

## 5. Route / Component: `src/app/wachat/overview/page.tsx`
- **Current Features**: High-level dashboard for Wachat. KPI metrics, recent activity, and charts.
- **Possible Features**: Customizable widget layouts.
- **Errors**: Heavy charts might cause client-side rendering bottlenecks.
- **Enhancement Plan**: Implement lazy loading and server-side aggregation for complex dashboard metrics.

## 6. Route / Component: `src/app/wachat/page.tsx`
- **Current Features**: Root redirect page, typically routing the user to the `/overview` or onboarding if incomplete.
- **Possible Features**: Serve as a unified search interface instead of a raw redirect.
- **Errors**: Redirect loop if project onboarding state is misconfigured.
- **Enhancement Plan**: Improve the onboarding state machine logic before issuing the redirect.

## 7. Route / Component: `src/app/wachat/phone-number-settings/page.tsx`
- **Current Features**: Configures business profile (about text, address, vertical, email) and syncs to WhatsApp profile.
- **Possible Features**: AI assistant to generate optimized business descriptions.
- **Errors**: Meta API sometimes rejects invalid address formats without clear error messages.
- **Enhancement Plan**: Add strict client-side validation for business profile fields matching Meta's requirements.

## 8. Route / Component: `src/app/wachat/post-generator/page.tsx`
- **Current Features**: AI-driven social media post/WhatsApp status generator.
- **Possible Features**: Direct publishing to WhatsApp status (if API permits in the future) or Facebook Pages.
- **Errors**: Generation can timeout if the AI provider is slow.
- **Enhancement Plan**: Add streaming UI (`useChat`) for text generation to improve perceived performance.

## 9. Route / Component: `src/app/wachat/qr-codes/page.tsx`
- **Current Features**: Generates QR codes that open WhatsApp chats with pre-filled messages.
- **Possible Features**: Analytics on QR code scans (using a redirection tracking link).
- **Errors**: Hardcoded QR sizes or missing error boundary if the image fails to load.
- **Enhancement Plan**: Integrate a custom styling engine for QR codes (logos, colors) natively on the client.

## 10. Route / Component: `src/app/wachat/quick-reply-categories/page.tsx`
- **Current Features**: Manages categories for quick replies. CRUD table.
- **Possible Features**: Nested categories.
- **Errors**: Deleting a category that has linked replies might orphan them.
- **Enhancement Plan**: Add a confirmation prompt specifying the number of affected quick replies before deletion.

## 11. Route / Component: `src/app/wachat/response-time-tracker/page.tsx`
- **Current Features**: Analytics dashboard specifically for agent/bot response times. Shows average SLA times.
- **Possible Features**: Export to PDF, scheduled email reports for managers.
- **Errors**: Time zone conversions might skew hourly averages if not handled carefully.
- **Enhancement Plan**: Add a "Time Zone" toggle to allow managers to view response metrics in their local time.

## 12. Route / Component: `src/app/wachat/saved-replies/page.tsx`
- **Current Features**: Manages the actual canned responses/saved replies. Supports filtering by category.
- **Possible Features**: AI auto-suggest replies based on incoming message context.
- **Errors**: Search filter might be case-sensitive or slow on large datasets.
- **Enhancement Plan**: Implement fuzzy searching and keyboard shortcuts for quick replies.

## 13. Route / Component: `src/app/wachat/scheduled-messages/page.tsx`
- **Current Features**: Lists upcoming scheduled messages/broadcasts. Allows editing or cancelling.
- **Possible Features**: Calendar view for scheduled broadcasts.
- **Errors**: Editing a scheduled message very close to its dispatch time might fail or dispatch twice.
- **Enhancement Plan**: Lock editing capabilities 5 minutes prior to the scheduled dispatch time.

## 14. Route / Component: `src/app/wachat/settings/agents/page.tsx`
- **Current Features**: Agent management, role assignments, and routing rules (round-robin, manual).
- **Possible Features**: Skill-based routing (e.g., routing billing queries to finance agents).
- **Errors**: Deleting an agent might leave conversations unassigned.
- **Enhancement Plan**: Enforce re-assignment of open tickets before an agent can be removed.

## 15. Route / Component: `src/app/wachat/settings/attributes/page.tsx`
- **Current Features**: Custom contact attributes (e.g., "VIP", "Subscription Date").
- **Possible Features**: Dynamic attribute mapping via webhooks.
- **Errors**: Changing an attribute's data type after creation could break existing UI components.
- **Enhancement Plan**: Make data types immutable after creation; require creating a new attribute instead.

## 16. Route / Component: `src/app/wachat/settings/canned/page.tsx`
- **Current Features**: General settings for canned responses (e.g., keyboard trigger shortcuts).
- **Possible Features**: Sync canned responses across multiple sub-projects.
- **Errors**: Conflicts with browser native shortcuts.
- **Enhancement Plan**: Add a shortcut collision detector to warn users if they select a reserved keybind.

## 17. Route / Component: `src/app/wachat/settings/general/page.tsx`
- **Current Features**: General project settings for Wachat (time zones, default language).
- **Possible Features**: Branding settings (colors, logos) for web chat widgets.
- **Errors**: None apparent.
- **Enhancement Plan**: Group settings into an accordion or tab layout to prevent an overly long scrolling page.

## 18. Route / Component: `src/app/wachat/team-performance/page.tsx`
- **Current Features**: Leaderboard and metrics for agent performance (resolution time, CSAT).
- **Possible Features**: Gamification (badges, points) for top-performing agents.
- **Errors**: CSAT scores might skew if sample size is too low.
- **Enhancement Plan**: Add statistical significance indicators to the performance metrics.

## 19. Route / Component: `src/app/wachat/template-analytics/page.tsx`
- **Current Features**: Detailed metrics for sent templates (read rates, click rates).
- **Possible Features**: A/B testing dashboard directly comparing two templates.
- **Errors**: Data heavily reliant on Meta webhook deliveries, which can be delayed.
- **Enhancement Plan**: Add a "Last Synced" timestamp so users know when the analytics were last updated from Meta.

## 20. Route / Component: `src/app/wachat/template-builder/page.tsx`
- **Current Features**: Visual drag-and-drop template builder for WhatsApp messages.
- **Possible Features**: Version control for templates.
- **Errors**: Heavy state management; dragging components can cause frame drops.
- **Enhancement Plan**: Optimize React renders using `useMemo` and standardizing the drag-and-drop context.

## 21. Route / Component: `src/app/wachat/templates/create/page.tsx`
- **Current Features**: Comprehensive template creation form (Body, Header, Footer, Buttons, Variables). Support for Carousels.
- **Possible Features**: Direct media upload to Meta servers instead of URL linking.
- **Errors**: The file is massive (>1200 lines) and hard to maintain.
- **Enhancement Plan**: Refactor the monolithic `CreateTemplateContent` into separate components (`HeaderEditor`, `BodyEditor`, `ButtonManager`).

## 22. Route / Component: `src/app/wachat/templates/library/page.tsx`
- **Current Features**: Another entry point for the template library grid with filters.
- **Possible Features**: User ratings/reviews for community templates.
- **Errors**: Relies on `localStorage.setItem('templateToAction', ...)` for passing clone data.
- **Enhancement Plan**: Use a global state store or query parameters to securely and reliably pass template cloning data.

## 23. Route / Component: `src/app/wachat/templates/page.tsx`
- **Current Features**: Lists user templates. Supports filtering and syncing with Meta.
- **Possible Features**: Bulk deletion and bulk submission for approval.
- **Errors**: Deletion is optimistic local only; real Meta server deletion is not fully wired up.
- **Enhancement Plan**: Implement true API deletion via Meta Graph API so deleted templates are removed from the WABA account.

## 24. Route / Component: `src/app/wachat/two-line/page.tsx`
- **Current Features**: A demo/mock page showing the "Two-line" concept (multiple WABAs in one workspace).
- **Possible Features**: Actually implement the backend routing rules for multi-number management.
- **Errors**: Currently just a UI shell without backend logic.
- **Enhancement Plan**: Convert this from a demo into a functional configuration interface binding multiple numbers to specific teams.

## 25. Route / Component: `src/app/wachat/webhook-logs/page.tsx`
- **Current Features**: Shows a data table of incoming webhook events with JSON payloads.
- **Possible Features**: Advanced JSON querying (e.g., searching for a specific contact phone number inside the payload).
- **Errors**: The "Retry Delivery" function is a mocked toast and does not actually replay the webhook.
- **Enhancement Plan**: Implement real webhook replay logic using an event bus or background queue.

## 26. Route / Component: `src/app/wachat/webhooks/page.tsx`
- **Current Features**: Configures webhook endpoints, provides setup instructions for Meta App dashboard.
- **Possible Features**: Provide pre-configured deployment templates (e.g., Vercel, AWS Lambda) for custom endpoints.
- **Errors**: Creating an endpoint does not verify the signature in real-time before saving.
- **Enhancement Plan**: Add a validation step that pings the provided webhook URL with a verification token before saving it to the database.

## 27. Route / Component: `src/app/wachat/whatsapp-ads/page.tsx`
- **Current Features**: Click-to-WhatsApp ads dashboard. Shows linked ad accounts, campaigns, and KPIs.
- **Possible Features**: AI-driven ad campaign generation (copy + creative).
- **Errors**: Depends heavily on the Meta Marketing API, which frequently changes versions.
- **Enhancement Plan**: Add robust error boundaries and fallback UI in case the Meta API returns permission or version errors.

## 28. Route / Component: `src/app/wachat/whatsapp-ads/roadmap/page.tsx`
- **Current Features**: Static roadmap display showing phases of Facebook integration.
- **Possible Features**: Interactive voting on roadmap features.
- **Errors**: None.
- **Enhancement Plan**: Connect the roadmap statuses to a live project management tool (like Linear or Jira) for auto-updating.

## 29. Route / Component: `src/app/wachat/whatsapp-ads/setup/page.tsx`
- **Current Features**: Deprecated wizard page that auto-redirects to `/dashboard/facebook/all-projects`.
- **Possible Features**: None needed, as it is deprecated.
- **Errors**: Redirect relies on a `setTimeout` which is not ideal for Next.js app router.
- **Enhancement Plan**: Replace the client-side `setTimeout` redirect with a Next.js server-side `redirect()` or `permanentRedirect()`.

## 30. Route / Component: `src/app/wachat/whatsapp-link-generator/page.tsx`
- **Current Features**: Tool to generate `wa.me` links and corresponding QR codes with pre-filled messages.
- **Possible Features**: URL shortener integration (e.g., bit.ly or a custom short domain).
- **Errors**: No validation on phone number formats for international compatibility.
- **Enhancement Plan**: Integrate a library like `libphonenumber-js` to ensure generated numbers are valid E.164 formats.

## 31. Route / Component: `src/app/wachat/whatsapp-pay/page.tsx`
- **Current Features**: Dashboard for WhatsApp Pay transactions. Includes charts, a data table, and refund capabilities.
- **Possible Features**: Automated reconciliation reports.
- **Errors**: Refund state transitions might get stuck if the provider API hangs.
- **Enhancement Plan**: Add idempotency keys to the refund API calls to prevent double-refunding in case of network retries.

## 32. Route / Component: `src/app/wachat/whatsapp-pay/settings/page.tsx`
- **Current Features**: Settings page for linking Payment Configurations (e.g., Razorpay, PayU) via Meta Commerce Manager.
- **Possible Features**: Deep linking directly into the specific Commerce Manager app ID.
- **Errors**: Missing loading skeletons for individual config cards during fetch.
- **Enhancement Plan**: Add granular loading states per configuration card instead of a global page loader.

## 33. Route / Component: `src/app/web/[slug]/[pageSlug]/page.tsx`
- **Current Features**: Server Component that renders subpages of a generated website using the `Canvas` component.
- **Possible Features**: SEO metadata generation based on page content.
- **Errors**: If `db.collection` fails, it currently lacks a try/catch block resulting in a raw server error.
- **Enhancement Plan**: Wrap the database call in a try/catch and render a proper 500 error page if the DB is unreachable.

## 34. Route / Component: `src/app/web/[slug]/page.tsx`
- **Current Features**: Server Component that renders the homepage of a generated website.
- **Possible Features**: A/B testing of different homepage layouts.
- **Errors**: Similar missing try/catch for database connectivity.
- **Enhancement Plan**: Implement Incremental Static Regeneration (ISR) to cache the homepage and improve load times.

## 35. Route / Component: `src/app/zoruui/page.tsx`
- **Current Features**: A comprehensive component gallery showcasing all `ZoruUI` primitives (buttons, cards, dialogs, forms, layout elements).
- **Possible Features**: Copy-to-clipboard code snippets for each component to act as internal documentation.
- **Errors**: Highly massive file; likely to cause hot-reload delays during development.
- **Enhancement Plan**: Break this gallery down into sub-routes (e.g., `/zoruui/buttons`, `/zoruui/forms`) to improve maintainability and developer experience.
