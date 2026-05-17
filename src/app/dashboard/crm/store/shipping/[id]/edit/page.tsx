/**
 * Edit shipping zone — `/dashboard/crm/store/shipping/[id]/edit`.
 */

import { notFound } from 'next/navigation';
import { Truck } from 'lucide-react';

import { CrmPageHeader } from '../../../../_components/crm-page-header';
import { ShippingZoneForm } from '../../_components/shipping-zone-form';
import { getShippingZoneById } from '@/app/actions/crm-store.actions';

export const dynamic = 'force-dynamic';

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
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                title={`Edit · ${name}`}
                subtitle="Update zone coverage and method rates."
                icon={Truck}
                breadcrumbs={[
                    { label: 'CRM', href: '/dashboard/crm' },
                    { label: 'Store', href: '/dashboard/crm/store' },
                    {
                        label: 'Shipping',
                        href: '/dashboard/crm/store/shipping',
                    },
                    {
                        label: name,
                        href: `/dashboard/crm/store/shipping/${id}`,
                    },
                    { label: 'Edit' },
                ]}
            />
            <ShippingZoneForm initial={zone} zoneId={id} />
        </div>
    );
}
