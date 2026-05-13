/**
 * Legacy contact-detail redirect. See sibling routes for context.
 */

import { permanentRedirect } from 'next/navigation';

interface PageProps {
    params: Promise<{ contactId: string }>;
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function LegacyContactDetailRedirect({
    params,
    searchParams,
}: PageProps) {
    const { contactId } = await params;
    const sp = await searchParams;
    const usp = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) {
        if (typeof v === 'string') usp.set(k, v);
        else if (Array.isArray(v) && v[0]) usp.set(k, v[0]);
    }
    const qs = usp.toString();
    permanentRedirect(
        `/dashboard/crm/sales-crm/contacts/${contactId}${qs ? `?${qs}` : ''}`,
    );
}
