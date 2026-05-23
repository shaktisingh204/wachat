# MASTERPLAN CHUNK 4

## 1. Budgets (`src/app/dashboard/crm/budgets/*`)
- **Route / Component**: `/dashboard/crm/budgets/page.tsx`, `[id]/page.tsx`, `new/page.tsx`
- **Current Features**: Standard CRUD interface for budgets. Lists budgets using `EntityListShell`, allows viewing details of a single budget (`[id]`), and provides a form to create new ones (`new`).
- **Possible Features**: Add budget forecasting, variance analysis charts, or comparative historical budget views. Enable budget approval workflows and alerts when a budget exceeds a threshold.
- **Errors**: No explicit hydration bugs observed in the shell, but ensure the Rust endpoint's pagination aligns correctly without throwing `hasMore` bounds issues. Missing error boundaries for specific CRUD actions (relying on global or layout-level boundaries).
- **Enhancement Plan**: 
  - Wrap list fetching in React Suspense to allow for streaming states rather than blocking the entire page load.
  - Implement real-time updates for budget consumption.
  - Add inline GSAP animations for progress bars if budgets are visually represented.

## 2. Contacts (`src/app/dashboard/crm/contacts/*`)
- **Route / Component**: `/dashboard/crm/contacts/page.tsx`, `[contactId]/page.tsx`, `[contactId]/edit/page.tsx`
- **Current Features**: Core CRM functionality for managing individual contact records. Includes listing, detailed view, and an edit page.
- **Possible Features**: Contact timeline or activity feed, advanced segmentation, social media profile integrations, and bulk import/export functionalities.
- **Errors**: Editing/creating components might be vulnerable to stale data if custom fields aren't properly cached or revalidated upon submission.
- **Enhancement Plan**:
  - Add virtualized list views for large contact databases to improve rendering performance.
  - Implement an optimistic UI for quick contact updates (like changing status or tags).

## 3. Contracts (`src/app/dashboard/crm/contracts/*`)
- **Route / Component**: `/dashboard/crm/contracts/*` (includes `page.tsx`, `[contractId]/*`, `renewals/page.tsx`, `templates/*`, `types/*`)
- **Current Features**: Comprehensive contract management, including standard CRUD, contract renewals management, templates listing, and contract types definitions.
- **Possible Features**: E-signature integrations (e.g., DocuSign), automated contract generation from templates, and contract expiration reminder emails.
- **Errors**: The multi-level routing (especially with `[templateId]` and `[contractId]`) might require careful layout data fetching to avoid deeply nested waterfall requests.
- **Enhancement Plan**:
  - Incorporate a visual contract status timeline using `useGSAP` for state transitions.
  - Optimize the renewals page to highlight overdue or upcoming renewals using standardized warning UI components.

## 4. Conversions (`src/app/dashboard/crm/conversions/page.tsx`)
- **Route / Component**: `/dashboard/crm/conversions/page.tsx`
- **Current Features**: Likely a list or metrics page tracking lead-to-customer conversion rates or specific funnel steps.
- **Possible Features**: Funnel visualizations, A/B testing insights, conversion by source/channel pie charts.
- **Errors**: Complex data aggregations on the server side might block rendering; needs to be monitored for timeout issues.
- **Enhancement Plan**:
  - Add interactive SVG or canvas-based funnel charts.
  - Introduce date-range filtering with immediate visual feedback.

## 5. Dashboards (`src/app/dashboard/crm/dashboards/*`)
- **Route / Component**: `/dashboard/crm/dashboards/*` (includes `[id]`, `new`, `activity`)
- **Current Features**: Customizable reporting dashboards. Supports multiple dashboards per user, activity tracking, and editing existing dashboard configurations.
- **Possible Features**: Drag-and-drop widget placement, widget resizing, and sharable public dashboard links.
- **Errors**: Potential client-side performance issues if a dashboard loads too many widgets concurrently without lazy loading.
- **Enhancement Plan**:
  - Implement a dynamic widget loader using `next/dynamic`.
  - Add smooth GSAP layout transitions when moving or resizing dashboard widgets.

## 6. Deals (`src/app/dashboard/crm/deals/*`)
- **Route / Component**: `/dashboard/crm/deals/*`
- **Current Features**: Pipeline deal tracking (CRUD), typically used in sales workflows.
- **Possible Features**: Kanban board view for deals, deal probability scoring, and automated task generation on stage change.
- **Errors**: Verify that state changes in kanban/deal pipelines properly synchronize with the backend to prevent "ghost" deals when rapidly moved.
- **Enhancement Plan**:
  - Upgrade the deals list to include a toggleable Kanban view.
  - Utilize `useGSAP` for drag-and-drop animations if the Kanban board is implemented.

## 7. Email (`src/app/dashboard/crm/email/page.tsx`)
- **Route / Component**: `/dashboard/crm/email/page.tsx`
- **Current Features**: Centralized view for CRM email communications or email campaign tracking.
- **Possible Features**: Inbox sync via IMAP/SMTP, email templates, open/click tracking analytics.
- **Errors**: Rendering full HTML email bodies can cause layout breaks or XSS vulnerabilities if not properly sanitized.
- **Enhancement Plan**:
  - Use an iframe or shadow DOM to safely sandbox email content previews.
  - Implement a split-pane view (list on left, detail on right) for faster triage.

## 8. Files (`src/app/dashboard/crm/files/*`)
- **Route / Component**: `/dashboard/crm/files/page.tsx`, `folders/page.tsx`, `new/page.tsx`
- **Current Features**: A centralized file storage system with folder tree management. Files can be attached to various entities (contacts, deals).
- **Possible Features**: Image thumbnail generation, PDF previews, batch downloads, and global file search.
- **Errors**: Large file uploads might cause memory spikes or timeout errors on the server without chunked uploads.
- **Enhancement Plan**:
  - Add visual drag-and-drop dropzones for file uploading.
  - Improve the folder tree UI with animated expand/collapse interactions.

## 9. Fixed Assets (`src/app/dashboard/crm/fixed-assets/*`)
- **Route / Component**: `/dashboard/crm/fixed-assets/*`
- **Current Features**: Tracks durable company property (laptops, machinery). Includes cost/depreciation info, custodian tracking, and warranty details.
- **Possible Features**: QR code / barcode generation and scanning for quick asset lookup. Automated depreciation calculations over time.
- **Errors**: The "Maintenance log" section has a documented `TODO` for a missing child collection and endpoint.
- **Enhancement Plan**:
  - Complete the maintenance log integration.
  - Add a timeline view for asset custody history.

## 10. HR Sub-domain (`src/app/dashboard/crm/hr/*`)
- **Route / Component**: `src/app/dashboard/crm/hr/announcements/page.tsx`, `asset-assignments`, `assets/*`, `candidates/*`, `careers-page`, `certifications`, `compensation-bands`, `directory`
- **Current Features**: These routes currently contain `LegacyHrRedirect` components that perform a `permanentRedirect` to `/dashboard/hrm/...`, successfully passing along dynamic route parameters and search queries.
- **Possible Features**: N/A for this specific directory, as they are legacy routes.
- **Errors**: Redirection loops could occur if the target `hrm` module points back, though unlikely.
- **Enhancement Plan**:
  - Monitor logs to see if these endpoints are still actively hit. If usage drops to zero, eventually deprecate and remove these legacy redirection files to reduce codebase clutter.
