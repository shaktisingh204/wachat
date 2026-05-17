/**
 * New pricing rule — `/dashboard/crm/store/pricing/new`.
 */

import { Tag } from 'lucide-react';

import { CrmPageHeader } from '../../../_components/crm-page-header';
import { PricingRuleForm } from '../_components/pricing-rule-form';

export const dynamic = 'force-dynamic';

interface PageProps {
    searchParams: Promise<{ storefrontId?: string }>;
}

export default async function NewPricingRulePage({ searchParams }: PageProps) {
    const sp = await searchParams;
    const storefrontId = sp.storefrontId ?? null;

    return (
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                title="New pricing rule"
                subtitle="Configure a discount or bundle for a storefront."
                icon={Tag}
                breadcrumbs={[
                    { label: 'CRM', href: '/dashboard/crm' },
                    { label: 'Store', href: '/dashboard/crm/store' },
                    {
                        label: 'Pricing',
                        href: '/dashboard/crm/store/pricing',
                    },
                    { label: 'New' },
                ]}
            />
            <PricingRuleForm defaultStorefrontId={storefrontId} />
        </div>
    );
}
