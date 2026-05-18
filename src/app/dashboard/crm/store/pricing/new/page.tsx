/**
 * New pricing rule — `/dashboard/crm/store/pricing/new`.
 */

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { PricingRuleForm } from '../_components/pricing-rule-form';

export const dynamic = 'force-dynamic';

interface PageProps {
    searchParams: Promise<{ storefrontId?: string }>;
}

export default async function NewPricingRulePage({ searchParams }: PageProps) {
    const sp = await searchParams;
    const storefrontId = sp.storefrontId ?? null;

    return (
        <EntityDetailShell
            eyebrow="PRICING RULE"
            title="New pricing rule"
            back={{ href: '/dashboard/crm/store/pricing', label: 'Pricing rules' }}
        >
            <PricingRuleForm defaultStorefrontId={storefrontId} />
        </EntityDetailShell>
    );
}
