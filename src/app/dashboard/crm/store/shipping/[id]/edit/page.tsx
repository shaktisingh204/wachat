/**
 * Edit shipping zone — `/dashboard/crm/store/shipping/[id]/edit`.
 */

import { notFound } from 'next/navigation';

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { ShippingZoneForm } from '../../_components/shipping-zone-form';
import { getShippingZoneById } from '@/app/actions/crm-store.actions';

export const dynamic = 'force-dynamic';

const BASE = '/dashboard/crm/store/shipping';

export default async function EditShippingZonePage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    const zone = await getShippingZoneById(id);
    if (!zone) notFound();
    const name = (zone.name as string) || `Zone ${id.slice(-6)}`;

    return (
        <EntityDetailShell
            eyebrow="SHIPPING ZONE"
            title={`Edit · ${name}`}
            back={{ href: `${BASE}/${id}`, label: 'Back to zone' }}
        >
            <ShippingZoneForm initial={zone} zoneId={id} />
        </EntityDetailShell>
    );
}
