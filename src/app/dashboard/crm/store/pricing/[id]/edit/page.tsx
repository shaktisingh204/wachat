/**
 * Edit pricing rule — `/dashboard/crm/store/pricing/[id]/edit`.
 */

import { notFound } from 'next/navigation';

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { PricingRuleForm } from '../../_components/pricing-rule-form';
import { getPricingRuleById } from '@/app/actions/crm-store.actions';

export const dynamic = 'force-dynamic';

const BASE = '/dashboard/crm/store/pricing';

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
        <EntityDetailShell
            eyebrow="PRICING RULE"
            title={`Edit · ${name}`}
            back={{ href: `${BASE}/${id}`, label: 'Back to rule' }}
        >
            <PricingRuleForm initial={rule} pricingRuleId={id} />
        </EntityDetailShell>
    );
}
