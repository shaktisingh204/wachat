/**
 * New shipping zone — `/dashboard/crm/store/shipping/new`.
 */

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { ShippingZoneForm } from '../_components/shipping-zone-form';

export const dynamic = 'force-dynamic';

interface PageProps {
    searchParams: Promise<{ storefrontId?: string }>;
}

export default async function NewShippingZonePage({ searchParams }: PageProps) {
    const sp = await searchParams;
    const storefrontId = sp.storefrontId ?? null;

    return (
        <EntityDetailShell
            eyebrow="SHIPPING ZONE"
            title="New shipping zone"
            back={{ href: '/dashboard/crm/store/shipping', label: 'Shipping zones' }}
        >
            <ShippingZoneForm defaultStorefrontId={storefrontId} />
        </EntityDetailShell>
    );
}
