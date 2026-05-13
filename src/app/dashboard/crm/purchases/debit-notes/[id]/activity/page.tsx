import { notFound } from 'next/navigation';

import { EntityAuditTimeline } from '@/components/crm/entity-audit-timeline';
import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { getDebitNoteById } from '@/app/actions/crm-debit-notes.actions';

interface PageProps {
    params: Promise<{ id: string }>;
}

export default async function DebitNoteActivityPage({ params }: PageProps) {
    const { id } = await params;
    const note = await getDebitNoteById(id);
    if (!note) notFound();

    return (
        <EntityDetailShell
            title={(note as any).noteNumber || 'Debit Note'}
            eyebrow="DEBIT NOTE ACTIVITY"
            back={{
                href: `/dashboard/crm/purchases/debit-notes/${id}`,
                label: 'Back to debit note',
            }}
        >
            <EntityAuditTimeline entityKind="debitNote" entityId={id} />
        </EntityDetailShell>
    );
}
