import { redirect } from 'next/navigation';

/**
 * New promotion page — server wrapper around `<PromotionForm />`.
 */

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { getSession } from '@/app/actions/user.actions';

import { PromotionForm } from '../_components/promotion-form';

export const dynamic = 'force-dynamic';

const BASE = '/dashboard/crm/sales/promotions';

export default async function NewPromotionPage() {
    const session = await getSession();
    if (!session?.user) redirect('/login');

    return (
        <EntityDetailShell
            eyebrow="PROMOTION"
            title="New Promotion"
            back={{ href: BASE, label: 'Promotions' }}
        >
            <PromotionForm />
        </EntityDetailShell>
    );
}
