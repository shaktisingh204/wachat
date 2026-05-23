# SabNode Pages Analysis - Chunk 36

## 1. Route: /sabsms/compliance/dlt/page.tsx
- **Current Features**: A UI for managing DLT (Distributed Ledger Technology) compliance specific to India (TRAI rules). Shows KPIs like Compliance Score, Active PEIDs. Uses collapsibles to organize PEID configuration, Headers (Sender IDs), and Template Mappings.
- **Possible Features**: Add direct API integration with Indian DLT operators (Jio, Airtel, Vi) to auto-sync templates and Sender IDs instead of manual CSV matching.
- **Errors**: Mock data is hardcoded; missing error boundaries for the DLT sync failure states. The UI relies on `ZoruAccordion` and custom collapsible states which can cause hydration mismatches if not synced properly.
- **Enhancement Plan**: Replace local states with a robust store (Zustand or context) for the complex forms. Add real-time template scrubbing via server actions to validate template payloads against DLT limits.

## 2. Route: /sabsms/compliance/gdpr/page.tsx
- **Current Features**: Dashboard for GDPR/Privacy compliance. Includes DSR (Data Subject Requests) management (SAR, Erasure, Rectification) and Auto-Redaction Rules. Includes SLA timers for requests.
- **Possible Features**: Add a one-click automated hash-preserving erasure workflow across all integrated databases. Expand PII redaction to allow custom Regex patterns via the UI.
- **Errors**: Static mock data (`MOCK_REQUESTS`, `MOCK_REDACTIONS`). No backend wiring for the bulk actions. Missing loading states on buttons.
- **Enhancement Plan**: Implement server actions to hook into the real request queue. Add a confirmation dialogue before executing "Bulk Delete (Hash-preserving)".

## 3. Route: /sabsms/compliance/keywords/page.tsx
- **Current Features**: Manages STOP/HELP keywords, auto-responses, global suppression mappings, and config. Contains tabs (view state) for Keywords, Responses, Config, and Tools.
- **Possible Features**: Introduce multi-language NLP to automatically detect opt-out intent even without exact keyword matches.
- **Errors**: "Feature X" placeholders exist. Tab state uses React state instead of URL search params, meaning refreshing the page loses the current tab view.
- **Enhancement Plan**: Move the `view` state to URL parameters (`?tab=keywords`). Connect the "Test Keyword" simulation to the actual routing engine to provide accurate debugging.

## 4. Route: /sabsms/compliance/page.tsx
- **Current Features**: High-level compliance dashboard showing EU Consent, CASL, TRAI, and suppression coverage. Displays regional registry status and operational risk.
- **Possible Features**: Add real-time risk alerts and a weekly compliance digest email configuration.
- **Errors**: Purely presentational with mock data. Buttons log to console (`console.log("Exporting PDF")`).
- **Enhancement Plan**: Wire up the PDF/CSV exports to a backend generation service. Make the dashboard widgets modular so users can customize their compliance view.

## 5. Route: /sabsms/consent/page.tsx
- **Current Features**: Manages consent lists, double opt-in configurations, and consent receipts. (Assuming standard UI based on previous files).
- **Possible Features**: Add a public-facing consent portal generator for users to manage their preferences.
- **Errors**: Needs validation for the double opt-in flows.
- **Enhancement Plan**: Add historical audit trails for each consent change to prove compliance during audits.

## 6. Route: /sabsms/contacts/[id]/page.tsx
- **Current Features**: Details for a specific contact. Displays contact info, associated numbers, opt-in/opt-out status, and message history.
- **Possible Features**: Add a timeline view showing all interactions (SMS, MMS, email, clicks).
- **Errors**: If contact ID is invalid, lacks a custom 404 page.
- **Enhancement Plan**: Implement a unified "Customer 360" timeline component. Add quick actions to manually opt-out or edit attributes inline.

## 7. Route: /sabsms/contacts/page.tsx
- **Current Features**: A data table listing all contacts. Supports filtering, bulk actions, and search.
- **Possible Features**: Advanced segment builder integration directly from the contacts table. Export to CSV.
- **Errors**: Large contact lists might cause performance issues if pagination is not server-side.
- **Enhancement Plan**: Ensure server-side pagination, sorting, and filtering are implemented to handle millions of contacts efficiently.

## 8. Route: /sabsms/drips/[id]/page.tsx
- **Current Features**: Detailed view of a specific drip campaign. Shows active enrolments, throughput, and conversion rates.
- **Possible Features**: Visual node-based editor for modifying the drip sequence. A/B testing on specific nodes.
- **Errors**: The metric calculations might be inaccurate if `rows` is empty.
- **Enhancement Plan**: Add a real-time visualizer for the flow of contacts through the drip campaign.

## 9. Route: /sabsms/drips/create/page.tsx
- **Current Features**: Form to create a new drip campaign. Prompts for trigger type, initial template, and schedule.
- **Possible Features**: Template gallery for common drip scenarios (e.g., welcome series, abandoned cart).
- **Errors**: Missing validation on complex scheduling rules.
- **Enhancement Plan**: Implement a step-by-step wizard to guide users through the creation process, reducing cognitive load.

## 10. Route: /sabsms/drips/page.tsx
- **Current Features**: Lists all drip sequences. Shows bulky data-rich dashboard header with total active nodes, enrolments, throughput, and avg conversion.
- **Possible Features**: ROI calculator based on conversion rates and SMS costs.
- **Errors**: Calculations like `rows.reduce(...)` on the server might be slow for large datasets.
- **Enhancement Plan**: Move aggregations to the database level (e.g., MongoDB aggregation pipeline) rather than calculating them in memory on the server.

## 11. Route: /sabsms/health/page.tsx
- **Current Features**: Monitors platform health, API latency, and delivery success rates.
- **Possible Features**: Add incident history and automated status page generation.
- **Errors**: Real-time polling might overload the server if not using websockets or optimized polling intervals.
- **Enhancement Plan**: Integrate with external monitoring tools (Datadog, Prometheus) for deeper analytics.

## 12. Route: /sabsms/idempotency/page.tsx
- **Current Features**: Manages idempotency keys to prevent duplicate SMS sends.
- **Possible Features**: Visual tool to search for specific API requests by idempotency key.
- **Errors**: Keys might not expire properly, bloating the database.
- **Enhancement Plan**: Ensure a strict TTL index is set on idempotency keys in the database. Add a UI to configure retention policies.

## 13. Route: /sabsms/imports/page.tsx
- **Current Features**: Handles bulk contact or keyword imports via CSV.
- **Possible Features**: AI-powered column mapping to automatically detect names, phone numbers, and attributes.
- **Errors**: Large CSVs might timeout the request.
- **Enhancement Plan**: Implement a chunked uploading mechanism with background processing and progress bars via WebSockets or Server-Sent Events.

## 14. Route: /sabsms/inbox/page.tsx
- **Current Features**: Two-way messaging interface for customer support to reply to inbound SMS.
- **Possible Features**: AI-generated reply suggestions based on the conversation context.
- **Errors**: Message ordering might bug out if timestamps are exactly identical.
- **Enhancement Plan**: Add real-time updates via WebSockets so agents see new messages instantly without refreshing.

## 15. Route: /sabsms/lists/page.tsx
- **Current Features**: Manages static and dynamic contact lists.
- **Possible Features**: Real-time audience size estimation for dynamic lists based on filters.
- **Errors**: Editing a dynamic list while a campaign is sending to it could cause unexpected behavior.
- **Enhancement Plan**: Lock lists that are actively being used in campaigns, or snapshot them at the time of send.

## 16. Route: /sabsms/logs/page.tsx
- **Current Features**: Detailed message logs showing status, direction, body, provider, cost, and timestamp. Includes filtering.
- **Possible Features**: Add full request/response payload inspector for debugging failed messages.
- **Errors**: Hardcoded `formatCost` could break if currency varies. Pagination could be slow on millions of rows.
- **Enhancement Plan**: Implement cursor-based pagination for the logs to maintain performance on massive tables.

## 17. Route: /sabsms/numbers/[id]/page.tsx
- **Current Features**: Server component showing detail for a specific phone number (health, volume, cost). Mounts `NumberDetailClient`.
- **Possible Features**: Predictive billing alerting based on the number's send volume.
- **Errors**: Returns 404 if the number isn't found, but could use a friendlier empty state.
- **Enhancement Plan**: Add historical charts for deliverability and bounce rates specific to the number.

## 18. Route: /sabsms/numbers/buy/page.tsx
- **Current Features**: Complex UI to search and provision new phone numbers. Includes filters for country, capabilities, and pattern matching.
- **Possible Features**: Recommend numbers based on the user's highest traffic regions.
- **Errors**: Dummy inventory is hardcoded. `handleSearch` is a mocked timeout.
- **Enhancement Plan**: Wire up to Twilio/Bandwidth API for real-time inventory search. Add a cart system to checkout multiple numbers at once.

## 19. Route: /sabsms/numbers/new/page.tsx
- **Current Features**: Provisioning wizard to select providers, campaigns, and pools.
- **Possible Features**: Auto-suggest the best provider based on cost and reliability for the target country.
- **Errors**: Assumes session workspace is available; if not, shows a basic alert.
- **Enhancement Plan**: Expand the wizard to include compliance registration (like 10DLC or DLT) inline during the purchase flow.

## 20. Route: /sabsms/numbers/page.tsx
- **Current Features**: Dashboard listing all provisioned numbers, their capabilities, health metrics, and costs.
- **Possible Features**: Bulk updates to routing or webhooks across multiple numbers.
- **Errors**: Mock data is injected into the server load.
- **Enhancement Plan**: Add a real-time sync with provider APIs to ensure status reflects the provider's source of truth.

## 21. Route: /sabsms/numbers/pool/page.tsx
- **Current Features**: Manages number pools (sender ID rotation) for high-volume sending. Shows limits, throughput, and error rates.
- **Possible Features**: Auto-scaling pools that automatically purchase new numbers when throughput limits are reached.
- **Errors**: Hardcoded mock data.
- **Enhancement Plan**: Implement a sticky-sender logic toggle in the UI so users can ensure recipients get messages from the same number.

## 22. Route: /sabsms/page.tsx
- **Current Features**: Main dashboard for the SabSMS product, showing overall volume, spend, delivery rates, and active campaigns.
- **Possible Features**: Customizable widgets so users can pin their most important metrics.
- **Errors**: Heavy server load if aggregating all stats synchronously.
- **Enhancement Plan**: Use a caching layer (Redis) to serve dashboard metrics instantly.

## 23. Route: /sabsms/pool/page.tsx
- **Current Features**: Similar to `numbers/pool`, configures routing and rotation logic for sender IDs.
- **Possible Features**: Geographic matching to send from a number with the same area code as the recipient.
- **Errors**: Potential redundancy with `/sabsms/numbers/pool`.
- **Enhancement Plan**: Consolidate pool management into a single robust route.

## 24. Route: /sabsms/providers/[id]/page.tsx
- **Current Features**: Configuration for a specific SMS provider (Twilio, Vonage, Plivo, etc.), including API keys and webhooks.
- **Possible Features**: One-click integration testing to verify credentials.
- **Errors**: Exposing API keys in the UI without masking.
- **Enhancement Plan**: Mask sensitive credentials and require re-authentication to reveal them.

## 25. Route: /sabsms/providers/page.tsx
- **Current Features**: Lists all connected providers and their connection health.
- **Possible Features**: Add a marketplace of SMS aggregators for users to discover new providers.
- **Errors**: Status indicators might not reflect real-time API health.
- **Enhancement Plan**: Implement a background job that pings each provider's status API and reflects the result here.

## 26. Route: /sabsms/providers/routing/page.tsx
- **Current Features**: Configures routing rules (e.g., "Send US traffic via Twilio, UK via Vonage").
- **Possible Features**: Least-cost routing (LCR) toggle to automatically select the cheapest provider.
- **Errors**: Conflicting rules might cause routing loops.
- **Enhancement Plan**: Add a rule-conflict detection engine and a UI to simulate routing for a given phone number.

## 27. Route: /sabsms/quick-send/page.tsx
- **Current Features**: A simple interface to send a single SMS quickly for testing or one-off alerts.
- **Possible Features**: Template variable injection testing.
- **Errors**: Might bypass some compliance checks if not integrated properly.
- **Enhancement Plan**: Integrate DLT/10DLC compliance checks into the quick send to mirror production behavior.

## 28. Route: /sabsms/rate-limits/page.tsx
- **Current Features**: Configures global and per-user rate limits to prevent abuse and manage costs.
- **Possible Features**: Dynamic rate limiting based on account balance.
- **Errors**: Changing limits might not take effect immediately if cached heavily.
- **Enhancement Plan**: Add visualizations showing current traffic versus configured limits.

## 29. Route: /sabsms/routing/page.tsx
- **Current Features**: High-level overview of message routing configurations.
- **Possible Features**: A visual flow-builder for complex fallback routing scenarios.
- **Errors**: Complex UIs for routing can be unintuitive.
- **Enhancement Plan**: Provide a "trace" tool where a user inputs a number and the system explains exactly which provider will be used and why.

## 30. Route: /sabsms/sabflow-blocks/page.tsx
- **Current Features**: Manages custom logical blocks for the SabFlow automation engine.
- **Possible Features**: A marketplace for sharing pre-built blocks between workspaces.
- **Errors**: Infinite loops in block configurations.
- **Enhancement Plan**: Add a static analyzer that warns users about potential infinite loops before saving.

## 31. Route: /sabsms/scheduled/page.tsx
- **Current Features**: Displays a calendar or list view of upcoming scheduled campaigns.
- **Possible Features**: Drag-and-drop calendar interface to reschedule sends easily.
- **Errors**: Timezone issues might cause confusion if not displayed clearly.
- **Enhancement Plan**: Enforce strict timezone display (e.g., showing both local and UTC times) and add a countdown to the next major send.

## 32. Route: /sabsms/sdk-reference/page.tsx
- **Current Features**: Documentation and code snippets for integrating the SabSMS SDK.
- **Possible Features**: Interactive API explorer (Swagger/OpenAPI UI).
- **Errors**: Hardcoded snippets might go out of date with the actual API.
- **Enhancement Plan**: Generate snippets dynamically based on the latest OpenAPI spec of the system.

## 33. Route: /sabsms/segments/new/page.tsx
- **Current Features**: UI to build a new audience segment using conditions (e.g., "last clicked > 30 days").
- **Possible Features**: AI segment generation (e.g., "Find me users who like shoes but haven't bought in a month").
- **Errors**: Complex boolean logic (AND/OR groups) can be tricky to render and validate.
- **Enhancement Plan**: Use a robust query-builder component and provide a live preview of the estimated segment size.

## 34. Route: /sabsms/segments/page.tsx
- **Current Features**: Lists all saved segments and their current sizes.
- **Possible Features**: Export segment data directly to external CRMs.
- **Errors**: Calculating sizes for all segments on page load could be very slow.
- **Enhancement Plan**: Cache segment sizes and calculate them asynchronously via background jobs.

## 35. Route: /sabsms/send/page.tsx
- **Current Features**: The main campaign composer interface. Select audience, create message, schedule.
- **Possible Features**: Real-time deliverability scoring as the user types the message.
- **Errors**: Missing validations for character limits (GSM-7 vs Unicode).
- **Enhancement Plan**: Add a live SMS preview that highlights exactly which characters are forcing the message into Unicode encoding.

## 36. Route: /sabsms/settings/billing/page.tsx
- **Current Features**: Manages payment methods, shows invoices, and current usage.
- **Possible Features**: Set up auto-recharge thresholds to prevent service interruption.
- **Errors**: Fails gracefully if the Stripe API is down? Needs error boundaries.
- **Enhancement Plan**: Add cost-allocation tagging so businesses can see exactly which department/campaign spent what.

## 37. Route: /sabsms/settings/notifications/page.tsx
- **Current Features**: Configures alerts for low balance, delivery drops, or compliance errors.
- **Possible Features**: Slack/Discord webhook integrations for critical alerts.
- **Errors**: Might send too many alerts (alert fatigue).
- **Enhancement Plan**: Implement alert debouncing and summarization (e.g., "15 delivery errors in the last hour").

## 38. Route: /sabsms/settings/team/page.tsx
- **Current Features**: Manages users, roles, and permissions within the workspace.
- **Possible Features**: Granular RBAC (Role-Based Access Control) to restrict access to specific campaigns or data.
- **Errors**: Removing the last admin could lock the workspace.
- **Enhancement Plan**: Prevent the last owner from being removed or downgraded.

## 39. Route: /sabsms/suppressions/page.tsx
- **Current Features**: Manages the global blocklist/suppression list.
- **Possible Features**: Auto-expiring suppressions (e.g., "Block for 30 days").
- **Errors**: Uploading a massive CSV to the suppression list might block the event loop.
- **Enhancement Plan**: Use standard background jobs for CSV processing and provide an audit log of who suppressed what.

## 40. Route: /sabsms/templates/[id]/page.tsx
- **Current Features**: Editor for a specific message template.
- **Possible Features**: Version history to roll back template changes.
- **Errors**: Variable rendering could break if the payload lacks the required fields.
- **Enhancement Plan**: Add a "Test Payload" JSON editor alongside the template to preview the final rendered output.

## 41. Route: /sabsms/templates/approvals/page.tsx
- **Current Features**: UI for admins to approve or reject templates created by users (useful for compliance).
- **Possible Features**: Automated approval rules based on regex checks.
- **Errors**: Bottlenecks if too many templates are pending.
- **Enhancement Plan**: Add bulk approve/reject actions with required reason fields.

## 42. Route: /sabsms/templates/create/page.tsx
- **Current Features**: Form to create a new template.
- **Possible Features**: Import templates directly from DLT portals via API.
- **Errors**: No duplicate detection.
- **Enhancement Plan**: Hash the template content and warn users if an identical template already exists.

## 43. Route: /sabsms/templates/page.tsx
- **Current Features**: Lists all templates, their approval status, and usage metrics.
- **Possible Features**: Folder or tag system to organize templates by campaign or region.
- **Errors**: Pagination and filtering might be fully client-side, risking performance issues.
- **Enhancement Plan**: Convert the table to use server-side searching and filtering.

## 44. Route: /sabsms/webhooks/log/page.tsx
- **Current Features**: Logs of incoming provider webhooks (DLRs, inbound SMS) or outgoing webhooks.
- **Possible Features**: "Replay" button to resend a failed webhook.
- **Errors**: Very high volume table; needs aggressive retention policies.
- **Enhancement Plan**: Automatically purge logs older than 7 days, and provide a search-by-message-ID feature.

## 45. Route: /sabsms/webhooks/page.tsx
- **Current Features**: Configures endpoints where the system will push events (like delivery receipts).
- **Possible Features**: Filter webhooks by event type (e.g., only send "Failed" events).
- **Errors**: Endpoint validation might fail if the user's server is slow.
- **Enhancement Plan**: Implement a retry policy configuration UI (e.g., exponential backoff settings).
