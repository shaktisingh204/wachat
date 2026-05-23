# Chunk 21 Masterplan: Meta Suite Features & Finance Module Initialization

## Overview
This chunk encompasses:
1. **Facebook/Meta Suite Features**: Overview, Connected Pages, Post Randomizer, Reels, Stories, Roadmap, Scheduled Posts, Setup Wizard, Visitor Posts.
2. **Finance Module**: Asset tracking, Bank Reconciliation, Budgets, General Ledger (GL), and Inventory.

---

## Facebook (Meta Suite) Features

### 1. Overview Page
**Route / Component:** `/src/app/dashboard/facebook/page.tsx`
**Current Features:**
- Displays an overview of the connected Facebook page, pulling the `activeProjectId` from `localStorage`.
- Fetches data including page details, insights, posts, and connected Instagram accounts using parallelized API calls in `fetchPageData`.
- Shows key stats via `StatTile` components and groups recent activity (Top Posts, Recent Comments) into columns.
- Uses `FeatureLock` and handles permission errors with a dedicated dialog (`PermissionErrorDialog`).
**Possible Features:**
- Add comparative analytics to track engagement growth over time.
- Implement more robust error states that allow inline token refresh without full page reloads.
**Errors / Issues:**
- Hydration mismatch: `localStorage` is read during the initial render before the component is mounted, which might cause hydration issues in SSR contexts.
- No fallback for failed parallel requests (e.g. if Instagram fails, the page should still load facebook insights). The current implementation handles `firstError`, but might block the whole UI if one minor endpoint errors out.
**Enhancement Plan:**
- **Refactor Data Fetching**: Standardize data fetching through `useQuery` (React Query) to handle caching and partial failures gracefully.
- **Project Context**: Replace `localStorage` reads with the `useProject` context which provides the active project natively, minimizing client-side flickering.

### 2. Connected Pages
**Route / Component:** `/src/app/dashboard/facebook/pages/page.tsx`
**Current Features:**
- Lists all connected Facebook Pages and highlights the currently active project's page.
- Allows inline editing of the active page's `about`, `phone`, and `website` details via `handleUpdatePageDetails` server action.
- Uses the `useProject` context to identify the active project ID.
**Possible Features:**
- Bulk sync details across multiple pages.
- Integrate with Instagram profiles to update linked bio details simultaneously.
**Errors / Issues:**
- The form submit `onSave` uses raw `FormData`, which lacks strong typing or client-side validation logic.
**Enhancement Plan:**
- **Form Validation**: Adopt `react-hook-form` + `zod` for the edit page details modal to give immediate validation feedback.

### 3. Post Randomizer
**Route / Component:** `/src/app/dashboard/facebook/post-randomizer/page.tsx`
**Current Features:**
- Auto-rotates posts from a content pool at a specified frequency.
- Uses `FeatureLock` to gate the feature based on the user's plan.
- Settings form updates the `enabled` and `frequencyHours` properties on the project.
- List view for the current randomizer pool with removal capability.
**Possible Features:**
- Allow users to specify "blackout hours" when the randomizer should not post.
- Give a history of recently published posts by the randomizer.
**Errors / Issues:**
- **Logic Bug**: The feature lock check uses `sessionUser?.plan?.features?.liveChat` to lock the Post Randomizer. This looks like a copy-paste error and should map to a relevant publishing/randomizer feature flag.
**Enhancement Plan:**
- **Fix Feature Lock Check**: Map the feature lock to a proper `postRandomizer` feature flag.
- **UI Improvement**: Add a preview of the next scheduled post.

### 4. Reels
**Route / Component:** `/src/app/dashboard/facebook/reels/page.tsx`
**Current Features:**
- Displays published Reels in a grid (`ReelTile`).
- Modal to upload a new Reel using a local file input and a caption (`UploadReelDialog`).
- Uses `useActionState` to handle the `publishPageReel` server action.
**Possible Features:**
- Support drafting Reels and scheduling them.
- Provide analytics (likes, comments, average watch time) on the `ReelTile`.
**Errors / Issues:**
- Upload form logic: file state is kept in `useState` alongside `useActionState` which might lead to desyncs. The form sends `videoFile` natively without visual upload progress tracking for large video files.
**Enhancement Plan:**
- **Upload Progress**: Use a custom XHR/fetch or an upload service component that provides upload progress feedback for large video files.

### 5. Roadmap
**Route / Component:** `/src/app/dashboard/facebook/roadmap/page.tsx`
**Current Features:**
- Static, client-side product marketing page displaying shipped, in-progress, and planned features.
- Uses ZoruUI `Card`, `Badge` components.
**Possible Features:**
- Upvoting mechanism for planned features.
- Fetch roadmap dynamically from a CMS or changelog API.
**Errors / Issues:**
- None. This is a clean static display.
**Enhancement Plan:**
- Integrate a user feedback mechanism (e.g., "Request a feature" button).

### 6. Scheduled Posts
**Route / Component:** `/src/app/dashboard/facebook/scheduled/page.tsx`
**Current Features:**
- Lists queued posts in a `DataTable`.
- Allows publishing scheduled posts immediately, editing them, or cancelling them.
- Refreshes based on an `actionCounter` dependency in `useEffect`.
**Possible Features:**
- Calendar view representation of scheduled posts.
- Drag-and-drop rescheduling.
**Errors / Issues:**
- Using `actionCounter` as a dependency is an anti-pattern.
**Enhancement Plan:**
- **Calendar Integration**: Add a calendar-view toggle using something like `react-big-calendar` to complement the data table.
- **Refactoring**: Standardize state invalidation.

### 7. Setup Wizard
**Route / Component:** `/src/app/dashboard/facebook/setup/page.tsx`
**Current Features:**
- 3-step wizard: Connect Meta account, select a project/page, link assets (WhatsApp/Instagram).
- Reads `NEXT_PUBLIC_FACEBOOK_APP_ID`.
- Modifies `localStorage` directly with `activeProjectId` and `activeProjectName`.
**Possible Features:**
- Include troubleshooting tips directly in the wizard for permission errors.
**Errors / Issues:**
- Bypasses Context: It directly sets `localStorage` items instead of updating the `ProjectContext` state, which could lead to stale data in other parts of the app until a hard refresh.
**Enhancement Plan:**
- **Context Syncing**: Ensure the wizard syncs selections with `useProject` so that the global sidebar updates correctly.

### 8. Stories
**Route / Component:** `/src/app/dashboard/facebook/stories/page.tsx`
**Current Features:**
- Manages 24-hour stories.
- Upload photo stories via URL input.
**Possible Features:**
- Direct file upload for stories instead of just URL.
- Video story support.
**Errors / Issues:**
- Only supports public image URLs for publishing, not local file uploads. This is a significant UX limitation.
**Enhancement Plan:**
- **File Upload Integration**: Add file upload integration to auto-upload to SabNode's S3/Storage and pass that generated URL to Facebook.

### 9. Visitor Posts
**Route / Component:** `/src/app/dashboard/facebook/visitor-posts/page.tsx`
**Current Features:**
- Moderation queue for user-submitted posts on the page.
- Status filters: all, published, hidden, spam.
- Slide-out `Sheet` for viewing the post and taking action (Reply, Like, Hide, Mark Spam, Delete).
- Mock/Queued toasts for 'Hide' and 'Spam' (awaiting BFF implementation).
**Possible Features:**
- Automated spam detection rules.
- Bulk actions.
**Errors / Issues:**
- None strictly; the UI awaits backend endpoints for some actions.
**Enhancement Plan:**
- **Finish BFF Integration**: Wire up the "Hide" and "Mark Spam" actions once the backend server actions are ready.

---

## Finance Module Features

### 1. Finance Root & Pages
**Routes / Components:**
- `/src/app/dashboard/finance/page.tsx`: Redirects to `/dashboard/finance/gl`.
- `/src/app/dashboard/finance/assets/page.tsx`: Fetches assets and passes to `AssetListClient`.
- `/src/app/dashboard/finance/bank-reconciliation/page.tsx`: Fetches reconciliations and passes to `BankReconListClient`.
- `/src/app/dashboard/finance/budgets/page.tsx`: Fetches budgets and passes to `BudgetListClient`.
- `/src/app/dashboard/finance/gl/page.tsx`: Fetches GL entries and passes to `GlEntryListClient`.
- `/src/app/dashboard/finance/inventory/page.tsx`: Fetches inventory and passes to `InventoryItemListClient`.

**Current Features:**
- All use the Next.js Server Components pattern: Fetch data securely on the server with `list*` actions, pass initial data to Client components for rendering.
**Possible Features:**
- Detailed drill-down for each item.
- Export to Excel/CSV for accounting integration.
**Errors / Issues:**
- Missing suspense boundaries: The `await list*()` calls are happening in the Server Component without explicit `loading.tsx` or `<Suspense>` wrappers shown in these files. This could block the routing transition if the DB queries are slow.
**Enhancement Plan:**
- **Streaming & Suspense**: Add local `loading.tsx` files or wrap the list clients in `<Suspense>` boundaries to ensure fast initial page loads.
