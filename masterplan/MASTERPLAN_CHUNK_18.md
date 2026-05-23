# Agent 18 Masterplan Chunk

## 1. Route / Component: `/dashboard/crm/tax/...`
- **Current Features**:
  - `itc/page.tsx`: GSTR-2A/2B vs Purchase Register reconciliation with mismatch highlighting and export.
  - `msme-alerts/page.tsx`: Dashboard for MSME 45-day payment rule compliance. Alerts for overdue payables.
  - `tds-194q/page.tsx`: Tracker for TDS 194Q threshold limits (50L) on purchases.
- **Possible Features**:
  - Automated syncing with GSTN portal or E-invoicing APIs.
  - Bulk email reminders to vendors/suppliers directly from the MSME/TDS alerts.
- **Errors**:
  - Check if these pages have proper `<ErrorBoundary>` wrapping, as tax computations can fail or timeout during large data loads.
- **Enhancement Plan**:
  - Improve data visualization with summary charts (e.g., breakdown of ITC claimed vs pending).

## 2. Route / Component: `/dashboard/crm/team/...`
- **Current Features**:
  - Hub for team management.
  - `manage-roles`: Role and permissions matrix editor with bulk operations.
  - `manage-users`: List, invite, and role-assign for team members.
  - `pending-approvals`: View and approve new signups joining the team.
  - `team-chat`: Internal messaging interface for agents/staff.
- **Possible Features**:
  - Org chart visualization.
  - Integration with Slack/Teams for the team-chat module.
- **Errors**:
  - No noticeable hydration issues, but the chat module might need strict client-side memoization to prevent re-rendering when receiving real-time messages.
- **Enhancement Plan**:
  - Refactor `manage-roles` into a more granular permissions tree. Allow custom role creation rather than just predefined ones.

## 3. Route / Component: `/dashboard/crm/templates/...`
- **Current Features**:
  - `page.tsx`, `[id]/page.tsx`: Studio and management for document/email templates with placeholder support.
- **Possible Features**:
  - A visual drag-and-drop template builder instead of just a text/code editor.
  - Template preview with dummy data.
- **Errors**:
  - Ensure XSS protection is strictly enforced when rendering these templates.
- **Enhancement Plan**:
  - Add version history to templates so changes can be reverted.

## 4. Route / Component: `/dashboard/crm/tickets/...`
- **Current Features**:
  - A fully-fledged ticketing and helpdesk suite.
  - Core: `page.tsx` (Tickets List), `[id]/page.tsx` (Ticket Detail), `[id]/activity` (Audit feed), `[id]/edit` and `new`.
  - Config: `agent-groups`, `channels`, `custom-forms`, `groups`, `reply-templates`, `sla`, `tags`, `types`.
  - Knowledge Base: `knowledge-base/...` for article creation, activity tracking (views, helpful/not helpful).
- **Possible Features**:
  - AI-driven ticket auto-tagging or suggested reply generation using the knowledge base.
  - Customer portal view to check ticket statuses.
- **Errors**:
  - Activity feeds currently rely heavily on `doc` updates. A dedicated event-sourcing model could make the audit log more robust.
  - Custom form dynamic inputs should have strong client-side validation to prevent malformed submissions.
- **Enhancement Plan**:
  - Integrate a unified inbox view for agents. Move SLA computation to a background job queue rather than just tracking it passively.

## 5. Route / Component: `/dashboard/crm/time-tracking/...`
- **Current Features**:
  - `page.tsx`: Hub with KPIs (Today, This Week, Billable %).
  - `time-logs/...`: Real-time stopwatches, manual time entries, tracking breaks, and marking billable.
  - `weekly-timesheets/...`: Grid-based timesheet submissions, approval/rejection workflows.
  - `reports/page.tsx`: Time logged by employee/project/date.
  - `settings/page.tsx`: Configure whether to log by project, task, or both.
- **Possible Features**:
  - Desktop widget or browser extension for the stopwatch.
  - Invoicing integration (generate an invoice directly from approved billable timesheets).
- **Errors**:
  - Grid logic in `weekly-timesheets` (`updateCell`) uses string-based mutations that could lead to subtle state bugs if not careful with float parsing.
- **Enhancement Plan**:
  - Standardize date/time conversions using a robust library (e.g. date-fns or dayjs) to handle timezone differences across distributed teams.
