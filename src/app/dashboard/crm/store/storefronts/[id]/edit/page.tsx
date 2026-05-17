/**
 * Edit storefront — `/dashboard/crm/store/storefronts/[id]/edit`.
 */

import { notFound } from 'next/navigation';
import { Store } from 'lucide-react';

import { CrmPageHeader } from '../../../../_components/crm-page-header';
import { StorefrontForm } from '../../_components/storefront-form';
import { getStorefrontById } from '@/app/actions/crm-store.actions';

export const dynamic = 'force-dynamic';

export default async function EditStorefrontPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    const sf = await getStorefrontById(id);
    if (!sf) notFound();
    const name = (sf.name as string) || `Storefront ${id.slice(-6)}`;

    return (
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                title={`Edit · ${name}`}
                subtitle="Update storefront settings, domain and homepage layout."
                icon={Store}
                breadcrumbs={[
                    { label: 'CRM', href: '/dashboard/crm' },
                    { label: 'Store', href: '/dashboard/crm/store' },
                    {
                        label: 'Storefronts',
                        href: '/dashboard/crm/store/storefronts',
                    },
                    {
                        label: name,
                        href: `/dashboard/crm/store/storefronts/${id}`,
                    },
                    { label: 'Edit' },
                ]}
            />
            <StorefrontForm initial={sf} storefrontId={id} />
        </div>
    );
}
