import { notFound } from 'next/navigation';

import { EntityAuditTimeline } from '@/components/crm/entity-audit-timeline';
import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { getExpenseById } from '@/app/actions/crm-expenses.actions';

interface PageProps {
    params: Promise<{ id: string }>;
}

export default async function BillActivityPage({ params }: PageProps) {
    const { id } = await params;
    const bill = await getExpenseById(id);
    if (!bill) notFound();

    return (
        <EntityDetailShell
            title={(bill as any).billNumber || (bill as any).billNo || 'Bill'}
            eyebrow="BILL ACTIVITY"
            back={{
                href: `/dashboard/crm/purchases/expenses/${id}`,
                label: 'Back to bill',
            }}
        >
            <EntityAuditTimeline entityKind="bill" entityId={id} />
        </EntityDetailShell>
    );
}
