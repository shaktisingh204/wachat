/**
 * Legacy new-deal redirect — see /dashboard/crm/deals/page.tsx for context.
 * Preserves any `?fromKind=…&fromId=…` query so lineage prefill keeps working.
 */

import { permanentRedirect } from 'next/navigation';

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function LegacyNewDealRedirect({ searchParams }: PageProps) {
  const sp = await searchParams;
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (typeof v === 'string') usp.set(k, v);
    else if (Array.isArray(v) && v[0]) usp.set(k, v[0]);
  }
  const qs = usp.toString();
  permanentRedirect(`/dashboard/crm/sales-crm/deals/new${qs ? `?${qs}` : ''}`);
}
