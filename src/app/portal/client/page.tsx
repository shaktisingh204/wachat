import React from "react";
/**
 * /portal/client — Client Portal Dashboard.
 *
 * Server Component. Renders the client's snapshot:
 *   - KPI strip (open tickets, unpaid invoices, active projects, pending estimates)
 *   - Recent Activity timeline (last 10 events across entities)
 *   - Quick Links grid (Create Ticket / View Projects / Pay Invoice)
 */

export const dynamic = 'force-dynamic';

import {
    getClientPortalActivity,
    getClientPortalKpis,
} from '@/app/actions/client-portal.actions';
import { ClientOverviewContent } from './_components/ClientOverviewContent';

async function ClientPortalDashboardPageContent() {
    const [kpis, activity] = await Promise.all([
        getClientPortalKpis(),
        getClientPortalActivity(10),
    ]);

    return <ClientOverviewContent initialKpis={kpis} initialActivity={activity} />;
}


export default function ClientPortalDashboardPage() {
  return (
    <React.Suspense fallback={<div>Loading...</div>}>
      <ClientPortalDashboardPageContent  />
    </React.Suspense>
  );
}
