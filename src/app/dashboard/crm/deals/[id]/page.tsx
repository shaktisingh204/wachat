/**
 * Legacy deal-detail redirect — see /dashboard/crm/deals/page.tsx for context.
 */

import { permanentRedirect } from 'next/navigation';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function LegacyDealDetailRedirect({ params }: PageProps) {
  const { id } = await params;
  permanentRedirect(`/dashboard/crm/sales-crm/deals/${id}`);
}
