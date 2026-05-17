/**
 * New storefront — `/dashboard/crm/store/storefronts/new`.
 */

import { Store } from 'lucide-react';

import { CrmPageHeader } from '../../../_components/crm-page-header';
import { StorefrontForm } from '../_components/storefront-form';

export const dynamic = 'force-dynamic';

export default function NewStorefrontPage() {
    return (
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                title="New storefront"
                subtitle="Provision a new online store with its own currency and domain."
                icon={Store}
                breadcrumbs={[
                    { label: 'CRM', href: '/dashboard/crm' },
                    { label: 'Store', href: '/dashboard/crm/store' },
                    {
                        label: 'Storefronts',
                        href: '/dashboard/crm/store/storefronts',
                    },
                    { label: 'New' },
                ]}
            />
            <StorefrontForm />
        </div>
    );
}
