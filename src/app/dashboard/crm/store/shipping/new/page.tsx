/**
 * New shipping zone — `/dashboard/crm/store/shipping/new`.
 */

import { Truck } from 'lucide-react';

import { CrmPageHeader } from '../../../_components/crm-page-header';
import { ShippingZoneForm } from '../_components/shipping-zone-form';

export const dynamic = 'force-dynamic';

interface PageProps {
    searchParams: Promise<{ storefrontId?: string }>;
}

export default async function NewShippingZonePage({ searchParams }: PageProps) {
    const sp = await searchParams;
    const storefrontId = sp.storefrontId ?? null;

    return (
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                title="New shipping zone"
                subtitle="Define coverage and shipping methods for a region."
                icon={Truck}
                breadcrumbs={[
                    { label: 'CRM', href: '/dashboard/crm' },
                    { label: 'Store', href: '/dashboard/crm/store' },
                    {
                        label: 'Shipping',
                        href: '/dashboard/crm/store/shipping',
                    },
                    { label: 'New' },
                ]}
            />
            <ShippingZoneForm defaultStorefrontId={storefrontId} />
        </div>
    );
}
