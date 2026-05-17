/**
 * Edit pricing rule — `/dashboard/crm/store/pricing/[id]/edit`.
 */

import { notFound } from 'next/navigation';
import { Tag } from 'lucide-react';

import { CrmPageHeader } from '../../../../_components/crm-page-header';
import { PricingRuleForm } from '../../_components/pricing-rule-form';
import { getPricingRuleById } from '@/app/actions/crm-store.actions';

export const dynamic = 'force-dynamic';

export default async function EditPricingRulePage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    const rule = await getPricingRuleById(id);
    if (!rule) notFound();
    const name = (rule.name as string) || `Rule ${id.slice(-6)}`;

    return (
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                title={`Edit · ${name}`}
                subtitle="Update the rule's kind, conditions and validity window."
                icon={Tag}
                breadcrumbs={[
                    { label: 'CRM', href: '/dashboard/crm' },
                    { label: 'Store', href: '/dashboard/crm/store' },
                    {
                        label: 'Pricing',
                        href: '/dashboard/crm/store/pricing',
                    },
                    {
                        label: name,
                        href: `/dashboard/crm/store/pricing/${id}`,
                    },
                    { label: 'Edit' },
                ]}
            />
            <PricingRuleForm initial={rule} pricingRuleId={id} />
        </div>
    );
}
