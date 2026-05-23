# SabNode Page Analysis - Chunk 20

## Route / Component: `src/app/dashboard/crm-advanced/voice-call/page.tsx`
**Current Features**: Provides a UI for managing Voice Calls in the CRM via an `EntityListShell`. It features a data table displaying callers, call duration, and status, with an inline dialog form to create or edit voice call records. The status supports "completed", "missed", and "voicemail".
**Possible Features**: Integration with Twilio or WebRTC for actual browser-based calling. Call recording playback inline. Call analytics and agent performance metrics.
**Errors**: None critical observed. Standard client-side React component structure.
**Enhancement Plan**: Replace the native `<select>` with a styled ZoruUI select component for visual consistency. Add sorting and filtering options in the DataTable for caller ID or call statuses.

## Route / Component: `src/app/dashboard/custom-ecommerce/flow-builder/page.tsx`
**Current Features**: A legacy path page that immediately redirects users to `/dashboard/facebook/custom-ecommerce`.
**Possible Features**: N/A
**Errors**: N/A
**Enhancement Plan**: Remove legacy route entirely once all internal and external linking references are fully migrated, to keep the Next.js router clean.

## Email Module Pages Overview (`src/app/dashboard/email/...`)
The email module constitutes a significant portion of this chunk. The structure heavily utilizes the `EmailSuiteLayout` component, wrapping various functionalities like audience, campaigns, and configurations.
- `analytics/page.tsx`: Legacy route redirecting to `/dashboard/email/reports`.
- `contacts/page.tsx`: Legacy route redirecting to `/dashboard/email/audience`.
- **Audience Management** (`audience/page.tsx`, `audience/lists/page.tsx`, `audience/segments/page.tsx`): These map directly to their respective client-rendered components (`EmailSubscribersClient`, `EmailListsClient`, `EmailSegmentsClient`). They are wrapped in React `Suspense` and act as the core hub for user contacts.
- **Audience Placeholders** (`audience/fields/page.tsx`, `audience/signup/page.tsx`, `audience/tags/page.tsx`): Feature placeholders rendering a `RouteComingSoon` component indicating upcoming functionalities for custom fields, signup forms, and tags.
- **Campaigns & Deliverability** (`campaigns/page.tsx`, `deliverability/page.tsx`, `inbox/page.tsx`, `integrations/page.tsx`): Integrates with client components (`EmailCampaignsClient`, `DeliverabilityClient`, `EmailInboxClient`, `IntegrationsClient`) for email delivery, metrics, and multi-channel campaign handling.
**Possible Features**: A unified drag-and-drop workflow builder connecting segments and automated campaigns. AI-generated subject lines and spam score checker on the deliverability page.
**Errors**: Heavy reliance on default Skeleton fallback which might cause cumulative layout shifts (CLS) if not perfectly sized.
**Enhancement Plan**: Upgrade the generic `Suspense` skeleton loaders to context-aware skeletons that mimic the list/grid layouts of actual data to prevent CLS. Clean up `RouteComingSoon` pages and prioritize their core implementations.

## Facebook Module Pages Overview (`src/app/dashboard/facebook/...`)
This chunk contains numerous pages forming the Meta Suite / Facebook integration offering.
- **Broadcasts** (`broadcasts/page.tsx`): Allows sending one-shot Messenger updates to eligible users under the 24-hour window rules. Features a multi-step composer (audience targeting, message composition, review) and historical statistics tracking. It guards access using a `FeatureLockOverlay`.
- **Create Post** (`create-post/page.tsx`): A comprehensive page to create and schedule Facebook posts. Includes multimedia support with `SabFilePickerButton`, real-time preview simulation in a mobile/desktop layout card, and date/time scheduling capabilities.
- **Competitors Tracker** (`competitors/page.tsx`): Allows tracking competitor pages using their URL or ID. Syncs public engagement signals like followers and recent posts. 
- **Commerce / Shop**: Numerous pages (`commerce/api`, `commerce/collections`, `commerce/orders`, `commerce/products/page.tsx`) mapping to Facebook's commerce API, catalog management, and order fulfillment.
**Current Features**: Deep integration with Meta APIs for audience engagement, content scheduling, and direct commerce.
**Possible Features**: Automated competitor trend analysis using LLMs on tracked competitor pages. Carousel post support in the post creator. Bulk product catalog uploads via CSV in commerce.
**Errors**: `competitors/page.tsx` directly renders an array (`c._id ?? c.id`) which could fail if API schema drifts. `create-post/page.tsx`'s real-time avatar preview relies on a potential `undefined` picture URL structure that might error out if the Facebook graph API rate limits.
**Enhancement Plan**: Abstract the multi-step `broadcasts/page.tsx` state into a reducer for better maintainability as more steps (like A/B testing) are added. Refactor the `competitors/page.tsx` table to use `DataTable` component for standard pagination and sorting matching `voice-call/page.tsx`.
