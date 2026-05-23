# Masterplan - Chunk 16: CRM Settings & Integrations

This chunk covers 45 files located within `src/app/dashboard/crm/settings/`. The domain represents the core configuration, metadata management, and 3rd-party integrations for the CRM workspace. The architecture heavily relies on the `SettingsEntityShell` and `EntityListShell` for UI consistency and uses Next.js App Router Server Actions for state mutations.

## Route / Component Analysis

### 1. Global & Core Settings
- **`settings/page.tsx`**: Landing page for CRM Settings. Reads settings via `getCrmSettings` and mounts the `CrmSettingsForm`.
- **`settings/global/page.tsx`**: Manages workspace-wide settings (e.g., currency, locale).
- **`settings/flags/page.tsx`**: CRUD for metadata flags using `SettingsEntityShell`.
- **`settings/languages/page.tsx`**: Configures available languages and default language using `SettingsEntityShell`. Includes KPI strip.
- **`settings/leadboard-preferences/page.tsx`**: Per-pipeline view presets (hidden stages, sort order, columns). Left-side editor, right-side list layout.
- **`settings/menu/page.tsx`**: Sidebar menu configuration. Allows reordering and visibility toggling for CRM navigation entries.
- **`settings/modules/page.tsx`**: Controls CRM modules (enable/disable, hide from menu). Uses bulk actions.
- **`settings/permission-types/page.tsx`**: Defines scope vocabulary for role grants (none, all, added, owned, both).
- **`settings/permissions/page.tsx`**: Granular access keys grouped by module. Assigned to roles to grant capability.

**Current Features**: Comprehensive workspace customization, including UI adjustments, role-based access control (RBAC), and domain entity configurations.
**Possible Features**: Audit logging for all settings changes, configuration export/import (JSON), and workspace cloning.
**Errors**: `useTransition` and `useActionState` are extensively used; error boundaries around these forms could be improved to prevent full-page crashes on hydration errors.
**Enhancement Plan**: Unify the UI state management (currently mixing `useState` and `useTransition`) into a more robust form state library (like React Hook Form + Zod) for complex validations.

### 2. GDPR Module (`settings/gdpr/`)
- **`page.tsx`**: Core GDPR compliance settings form.
- **`consent-logs/page.tsx`**: Audit trail and CSV export logic for user consents.
- **`purposes/page.tsx`**: Purpose consent management with bulk actions.
- **`removal-requests/page.tsx`, `new/page.tsx`, `[id]/page.tsx`**: Erasure workflow. Manages the right to be forgotten requests (pending, approved, executing).

**Current Features**: Audit-ledger-backed process for data removal and consent tracking.
**Possible Features**: Automated data anonymization rather than full deletion, scheduling tools for data retention policies.
**Errors**: Complex state transitions in removal requests might face race conditions if multiple admins interact simultaneously.
**Enhancement Plan**: Add a confirmation modal with a detailed impact report before executing a removal request.

### 3. Integrations Console (`settings/integrations/`)
- **`page.tsx`**: Landing grid for integrations.
- **`email-notifications/page.tsx`**: Wizard for connecting email delivery toggles.
- **`facebook-ads/page.tsx`**: Integration console for Facebook Lead Ads auto-creation.
- **`google-calendar/page.tsx`**: Two-way sync configuration using OAuth.
- **`message-settings/page.tsx`**: In-app and template-driven messaging defaults.
- **`push-notifications/page.tsx`**: Firebase Cloud Messaging configuration (FCM).
- **`pusher/page.tsx`**: Real-time pub/sub credentials for live CRM updates.
- **`quickbooks/page.tsx`**: Sync invoices and clients with QBO (OAuth 2.0).
- **`slack/page.tsx`**: Incoming webhook delivery for CRM notifications.
- **`smtp/page.tsx`**: Outbound transactional email delivery via SMTP relay.
- **`social-auth/page.tsx`**: OAuth credentials for Google, Facebook, LinkedIn, Twitter, Microsoft.
- **`storage/page.tsx`**: Filesystem driver selection (Local, S3, Google Drive, Azure Blob).
- **`ticket-email/page.tsx`**: Inbox mapping to auto-convert incoming emails into CRM tickets.

**Current Features**: A robust `IntegrationConsole` pattern featuring KPI grids, connection headers, and activity logs (`IntegrationActivityFeed`). Server Actions handle OAuth flow starts, token saving, and disconnects.
**Possible Features**: Zapier/Make webhooks integration, Microsoft Teams (to pair with Slack), Xero (to pair with Quickbooks).
**Errors**: Hardcoded environment assumptions in OAuth redirect URIs could cause callback mismatches. Error handling in activity feeds is dependent on Server Action string parsing.
**Enhancement Plan**: Extract common OAuth lifecycle logic into a shared hook or higher-order component to reduce boilerplate across `quickbooks`, `google-calendar`, and future integrations.

### 4. Billing, Projects, & Templates (`settings/*`)
- **`invoice-settings/page.tsx`**: Invoice numbering, tax calculation bases, terms, and reminders.
- **`offline-payment-methods/page.tsx`**: Client-side wrapper for managing offline payments.
- **`payment-gateways/page.tsx`**: Configures API credentials for Razorpay, Stripe, Paypal, Payfast, Paytm, Mollie, Authorize.net, Square.
- **`project-settings/page.tsx`**: Milestones, time tracking, Kanban toggles, and client portal access.
- **`project-statuses/page.tsx`**: Status list management with colors and terminal state flags.
- **`promotions/page.tsx`**: Client-side wrapper for promotional discount configurations.
- **`invitations/page.tsx`**: Workspace invitation management.
- **`email-templates/*`**: (Assumed based on naming) CRUD for transactional/marketing email templates.

**Current Features**: Deep vertical customization for invoices and project management.
**Possible Features**: Stripe Connect integration for multi-party payouts, custom webhook firing on project status changes.
**Errors**: Secret inputs in payment gateways use a simple boolean toggle to reveal passwords; browser autofill might conflict with these inputs.
**Enhancement Plan**: Implement a more secure credential vault mechanism where secrets are never sent back to the client after being saved (write-only fields).

## Overall Architecture Notes
The codebase demonstrates excellent code reuse through components like `EntityListShell`, `SettingsEntityShell`, and the Integration Console elements. State mutations are consistently handled by `useActionState` and `useTransition`, providing optimistic-like UI feedback.

**Action Items for Future Work:**
1. **Consolidate Form Logic**: Move towards unified form validation schemas across all settings pages.
2. **Credential Security**: Refactor integration secret inputs to obscure values completely from the frontend post-save.
3. **Optimistic Updates**: Expand `useTransition` usage to include optimistic updates for toggle switches (like `is_active` toggles in Modules and Permissions).
