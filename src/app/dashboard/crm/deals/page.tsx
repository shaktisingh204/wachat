/**
 * Legacy deals list — redirects to the canonical Sales CRM deals route.
 *
 * The CRM rebuild (CRM_REBUILD_PLAN §1D) consolidated the duplicate
 * `/dashboard/crm/deals` + `/dashboard/crm/sales-crm/deals` trees onto
 * the latter. This file is a permanent 308 so deep links from old
 * dashboards / notifications continue to resolve.
 */

import { permanentRedirect } from 'next/navigation';

export default function LegacyDealsRedirect() {
  permanentRedirect('/dashboard/crm/sales-crm/deals');
}
