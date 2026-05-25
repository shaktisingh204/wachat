/**
 * Legacy deal-edit redirect — see /dashboard/crm/deals/page.tsx for context.
 */

import { permanentRedirect } from 'next/navigation';

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function LegacyDealEditRedirect({ params, searchParams }: PageProps) {
  const { id } = await params;
  const sp = await searchParams;
  
  const query = new URLSearchParams();
  Object.entries(sp).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach(v => query.append(key, v));
    } else if (value !== undefined) {
      query.append(key, value);
    }
  });

  const queryString = query.toString();
  const url = `/dashboard/crm/sales-crm/deals/${id}/edit${queryString ? `?${queryString}` : ''}`;
  
  permanentRedirect(url);
}
