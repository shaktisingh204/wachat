/**
 * Legacy contacts list redirect.
 *
 * The CRM rebuild (CRM_REBUILD_PLAN §1D) consolidated the duplicate
 * `/dashboard/crm/sales/contacts` + `/dashboard/crm/sales-crm/contacts`
 * trees onto the latter. This file is a permanent 308 so deep links
 * from old dashboards / notifications continue to resolve.
 */

import { permanentRedirect } from 'next/navigation';

interface PageProps {
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function LegacyContactsListRedirect({
    searchParams,
}: PageProps) {
    const sp = await searchParams;
    const usp = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) {
        if (typeof v === 'string') usp.set(k, v);
        else if (Array.isArray(v) && v[0]) usp.set(k, v[0]);
    }
    const qs = usp.toString();
    permanentRedirect(
        `/dashboard/crm/sales-crm/contacts${qs ? `?${qs}` : ''}`,
    );
}
