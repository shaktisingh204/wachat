import { notFound } from 'next/navigation';

import { EntityAuditTimeline } from '@/components/crm/entity-audit-timeline';
import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { getPayoutById } from '@/app/actions/crm-payouts.actions';

interface PageProps {
    params: Promise<{ id: string }>;
}

export default async function PayoutActivityPage({ params }: PageProps) {
    const { id } = await params;
    const payout = await getPayoutById(id);
    if (!payout) notFound();

    return (
        <EntityDetailShell
            title={(payout as any).payoutNumber || 'Payout'}
            eyebrow="PAYOUT ACTIVITY"
            back={{
                href: `/dashboard/crm/purchases/payouts/${id}`,
                label: 'Back to payout',
            }}
        >
            <EntityAuditTimeline entityKind="payout" entityId={id} />
        </EntityDetailShell>
    );
}
