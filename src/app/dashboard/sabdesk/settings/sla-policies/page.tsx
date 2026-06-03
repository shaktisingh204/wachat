/**
 * Helpdesk Settings → SLA Policies — `/dashboard/sabdesk/settings/sla-policies`.
 *
 * The canonical SLA list lives at `/dashboard/sabdesk/sla` and owns
 * KPIs, filters, bulk ops, and the row drawer. This page is the
 * Zoho-Desk-equivalent settings entrypoint that re-uses the same
 * `<SlaPoliciesPage>` client component so the surface stays in sync.
 *
 * The legacy URL (`/sla`) keeps working for back-compat; this route is
 * what the helpdesk module's "Settings → SLA policies" sidebar entry
 * points at going forward.
 */

import SlaPoliciesPage from "../../sla/page";

export const dynamic = "force-dynamic";

export default function HelpdeskSettingsSlaPoliciesPage() {
  return <SlaPoliciesPage />;
}
