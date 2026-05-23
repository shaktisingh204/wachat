# SabNode Next.js Page Analysis - Chunk 33

## 31. Route: `/dashboard/telegram/ads`
**File:** `src/app/dashboard/telegram/ads/page.tsx`
- **Current Features**: Tracks ad campaigns from ads.telegram.org in the internal database. Displays KPIs (Total Spend, Impressions, Clicks, CTR). Provides a composed chart mapping impressions/clicks and spend over time using Recharts. Allows creating, editing, and deleting campaigns, as well as importing/exporting CSVs. Includes an action to build UTM links based on the campaign.
- **Possible Features**: Implement automatic syncing with the Telegram Ads API (if an official/unofficial integration becomes feasible) instead of relying on manual CSV imports. Add A/B testing tracking comparing performance of different ad creatives.
- **Errors**: `PCT_CTR` returns `(clk / impr) * 100`, which might divide by zero if impressions are explicitly 0 and not properly handled in all components.
- **Enhancement Plan**: 
  - Add inline editing for campaigns directly in the table to quickly update daily spend and impressions.
  - Implement bulk UTM generation for selected campaigns.

## 32. Route: `/dashboard/telegram/analytics`
**File:** `src/app/dashboard/telegram/analytics/page.tsx`
- **Current Features**: A comprehensive read-only dashboard for Telegram analytics across all bots in the workspace. Features segmented views (Overview, Messages, Broadcasts, Commands, Contacts, Funnel). Visualizes data using Recharts (AreaCharts and BarCharts). Includes filtering by date range, granularity, and bot. Supports exporting raw analytics data to CSV.
- **Possible Features**: Add custom dashboard building capabilities allowing users to pin specific charts. Implement anomaly detection alerts (e.g., sudden drop in message volume or spike in broadcast failures).
- **Errors**: Some views (e.g., Contacts, Funnel) are truncated in the analysis but rely heavily on complex state management which could cause performance bottlenecks if re-rendering excessively on large date ranges. `topLevelError` correctly checks for errors across all data streams but blocks the entire view rather than showing partial data.
- **Enhancement Plan**:
  - Implement a skeleton loader for individual charts rather than waiting for `Promise.all` to resolve all data streams simultaneously, improving perceived performance.
  - Add timezone configuration for granular day/hour aggregations.

## 33. Route: `/dashboard/telegram/api-credentials`
**File:** `src/app/dashboard/telegram/api-credentials/page.tsx`
- **Current Features**: Manages MTProto API credentials (`api_id` and `api_hash`) for user-level Telegram automation. Provides a multi-step login flow (phone number -> code -> 2FA password) to authenticate users. Tracks credential status (verified, pending, active, failed) and logs sessions/audit items. Includes a secure mask reveal component for sensitive hashes.
- **Possible Features**: Add support for proxy configurations (MTProxy, SOCKS5) for regions where Telegram is blocked. Provide a session manager view allowing users to terminate individual device sessions directly from SabNode.
- **Errors**: MTProto login flow is marked as "in preview". State management for the login steps (`start`, `code`, `password`, `done`) is entirely local and could be lost on page reload.
- **Enhancement Plan**:
  - Implement persistent state or URL parameters for the login flow to prevent data loss on accidental refresh.
  - Add inline validation warnings if `api_id` or `api_hash` have known problematic patterns before submitting to the backend.

## 34. Route: `/dashboard/telegram/auto-reply`
**File:** `src/app/dashboard/telegram/auto-reply/page.tsx`
- **Current Features**: Manages rule-based auto-replies for incoming Telegram messages. Features a drag-and-drop interface (`@dnd-kit`) to reorder rule priority. Includes a conflict detection system that warns users if multiple rules share the same trigger pattern. Displays rule stats like firing count (7d) and status.
- **Possible Features**: Introduce AI-powered auto-replies using OpenAI/Anthropic based on project knowledge bases. Add advanced scheduling criteria (e.g., only trigger rule outside business hours).
- **Errors**: If `arrayMove` fails or the backend rejects the reorder, the optimistic UI is rolled back by fetching from the backend, which might cause a visual jump.
- **Enhancement Plan**:
  - Improve the drag-and-drop UX by highlighting drop zones and adding visual feedback during the drag operation.
  - Implement a rule simulation tester directly in the UI where users can type a message and see which rule would trigger.

## 35. Route: `/dashboard/telegram/bots`
**File:** `src/app/dashboard/telegram/bots/page.tsx`
- **Current Features**: Lists and manages standard Telegram Bot API bots connected to the workspace. Provides actions to check bot health (latency), refresh webhook info, rotate webhook secrets, and disconnect bots. Includes bulk actions and CSV exports. Displays status badges and latency metrics.
- **Possible Features**: Allow users to configure Bot Menu commands, descriptions, and profile pictures directly from SabNode. Add detailed bot event logs to troubleshoot webhook delivery failures.
- **Errors**: The health check triggers a toast on success/failure but doesn't instantly update the table's latency metric unless the `fetchList` completes quickly.
- **Enhancement Plan**:
  - Add optimistic UI updates for the latency metric after a successful health check.
  - Implement a dedicated "Troubleshoot" flow for bots in the `error` state, guiding users through webhook validation and token renewal.
