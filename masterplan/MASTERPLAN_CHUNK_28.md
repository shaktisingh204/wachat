# Masterplan - Chunk 28 Analysis

This document outlines the architectural analysis, current features, potential enhancements, and identified issues for the pages assigned to Agent 28. The files span across Marketing modules, App Marketplace, core Dashboard, n8n integration, Platform tools, Portfolio builder, and Profile Security settings.

## 1. Marketing Modules
**Path:** `src/app/dashboard/marketing/*`

### Route / Component
- `drip-campaigns/page.tsx`
- `landing-page-builder/page.tsx`
- `social-media-scheduler/page.tsx`
- `universal-inbox/page.tsx`
- `utm-tracking/page.tsx`
- `whatsapp-chatbots/page.tsx`

### Current Features
- These pages act as lightweight Server Components that fetch initial data using Server Actions (e.g., `getDripCampaigns()`, `getLandingPages()`).
- Data is passed down to highly specialized Client Components (e.g., `<DripCampaignClient initialData={data} />`) for rendering and interactivity.

### Possible Features
- **Global Campaign Dashboard:** A centralized analytics view that aggregates metrics from Drip Campaigns, Landing Pages, and WhatsApp Chatbots to show cross-channel ROI.
- **AI Suggestions:** Incorporate generative AI (like the one seen in the Platform tools) directly into the UTM tracker or Social Media Scheduler to automatically suggest optimal tags and posting times.

### Errors / Issues
- No immediate errors detected. The Server-to-Client component separation is well-architected for Next.js 13+ App Router.

### Enhancement Plan
- Standardize error handling and loading states across these Client Components using Next.js `loading.tsx` and `error.tsx` boundaries rather than handling loading states manually.

---

## 2. App Marketplace
**Path:** `src/app/dashboard/marketplace/*`

### Route / Component
- `page.tsx` (Marketplace Browse Page)
- `installed/page.tsx` (Installed Apps Page)

### Current Features
- **Browse Page:** A Server Component (`force-dynamic`) that utilizes URL `searchParams` for filtering apps. It renders a beautifully styled grid of available apps using `ZoruUI`.
- **Installed Page:** A Client Component that fetches installed apps via a client-side API call to `/api/marketplace/installed` based on the active `projectId` from context. Includes a neat SVG-based usage sparkline.

### Possible Features
- **One-Click Installation Flow:** Introduce a seamless, modal-based installation flow directly from the browse page without redirecting.
- **App Reviews/Ratings:** Allow users to rate installed apps, displaying aggregates on the browse page.

### Errors / Issues
- `installed/page.tsx` fetches data using `fetch` inside `useEffect` with manual `try/catch` error state management.

### Enhancement Plan
- Refactor `installed/page.tsx` to either use a Server Component with Suspense or leverage a robust data fetching library (like SWR or React Query) to handle caching, revalidation, and error states automatically.

---

## 3. Main Dashboard & Core Pages
**Path:** `src/app/dashboard/*`

### Route / Component
- `page.tsx` (Main Account Overview)
- `notifications/page.tsx` & `notification-preferences/page.tsx`
- `meta-suite/page.tsx` (Redirect)
- `plans/page.tsx` & `plans/[planId]/page.tsx` (Plan Editors)

### Current Features
- **Main Dashboard (`page.tsx`):** A massive Client Component that provides a bird's-eye view of the account. It pulls data from `getAccountHomeData`, `getSession`, and `getOnboardingState`, displaying stats, pipeline values, and module tiles.
- **Notifications:** Supports filtering, pagination, marking as read, and granular user preferences saved to the project level.
- **Plans Editor:** Handles complex forms for creating/editing pricing plans, features, and limits using `useFormStatus` and Server Actions.

### Possible Features
- **Customizable Dashboard Layouts:** Allow users to drag-and-drop or hide specific metric tiles on the main dashboard to suit their workflow.

### Errors / Issues
- In `notifications/page.tsx` (Line 100), `projectId` is retrieved via `localStorage.getItem("activeProjectId")`. This is an anti-pattern as it can become stale. Other pages correctly use the `useProject()` React Context.
- The `dashboard/page.tsx` is quite monolithic and heavily reliant on manual state transitions (`useTransition`) for fetching initial data.

### Enhancement Plan
- Replace `localStorage` in `notifications/page.tsx` with the `useProject` hook.
- Refactor `dashboard/page.tsx` into smaller, independent sub-components (e.g., `<StatsOverview>`, `<OnboardingBanner>`, `<AppModulesGrid>`) to reduce file size and improve maintainability. Consider converting parts of it to Server Components to reduce client-side JavaScript.

---

## 4. n8n Integrations
**Path:** `src/app/dashboard/n8n/*`

### Route / Component
- `page.tsx` (Workflow List)
- `[workflowId]/page.tsx` (Workflow Editor)

### Current Features
- Lists automated workflows with status pills, execution counts, and last run metadata.
- Integrates a workflow editor canvas (presumably embedding n8n or a custom flow builder UI).

### Possible Features
- **Pre-built Templates:** Offer a library of common n8n workflows (e.g., Lead Capture -> CRM -> Slack) that users can clone instantly.

### Enhancement Plan
- Add bulk actions to the Workflow list (e.g., bulk activate/deactivate/delete).

---

## 5. Platform Management Tools
**Path:** `src/app/dashboard/platform/*`

### Route / Component
- `activity-logs/page.tsx`
- `ai-sales-forecasting/page.tsx`
- `custom-object-builder/page.tsx`
- `custom-report-builder/page.tsx`
- `data-redaction/page.tsx`
- `generative-ai-drafter/page.tsx`
- `global-search/page.tsx`
- `native-app-apis/page.tsx`
- `org-switcher/page.tsx`
- `webhooks/page.tsx`

### Current Features
- An extensive suite of internal and advanced user tools wrapping `EntityListShell`.
- Features include generating API keys (shown once securely), drafting AI content with approval workflows, configuring data redaction masks (`***-**-****`), building custom data objects, and global platform search.

### Possible Features
- **Advanced Activity Log Filters:** Add date range pickers and user specific filters to the Activity Logs page.
- **AI Model Selection:** In the Generative AI drafter, allow users to select which underlying LLM model to use (e.g., GPT-4 vs Claude) if applicable.

### Errors / Issues
- Most of these pages fetch data directly in `useEffect` on mount. This can lead to race conditions if not careful, though the `useTransition` for mutations is well implemented.

### Enhancement Plan
- Introduce server-side pagination for `activity-logs/page.tsx` and `global-search/page.tsx` to handle large datasets efficiently.

---

## 6. Portfolio & Security Settings
**Path:** `src/app/dashboard/portfolio/*` & `src/app/dashboard/profile/2fa-setup/page.tsx`

### Route / Component
- `portfolio/page.tsx` & `portfolio/manage/[portfolioId]/builder/page.tsx`
- `profile/2fa-setup/page.tsx`

### Current Features
- **Portfolio:** Dashboard to list created websites, linking into a fully-fledged React-based `<WebsiteBuilder>` wrapped in a `CartProvider`.
- **2FA Setup:** Highly secure and well-designed interface for configuring Email-based or TOTP (Authenticator App) Two-Factor Authentication. It handles QR code generation, backup codes, and verification elegantly using tabs and transitions.

### Possible Features
- **Domain Mapping:** Add UI in the Portfolio manager for users to link custom domains (`www.mybrand.com`) to their generated portfolio sites.
- **Security Audit Log:** Display recent login attempts below the 2FA setup to encourage users to enable 2FA if they spot suspicious activity.

### Enhancement Plan
- The 2FA page is excellent. Ensure the QR code generator (`setup.qrUrl`) relies on a secure, backend-generated data URI rather than an external third-party API to prevent data leakage of the TOTP secret.
