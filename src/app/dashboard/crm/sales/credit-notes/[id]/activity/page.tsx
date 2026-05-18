/**
 * Credit note activity (audit log) — server route.
 *
 * Mirrors `accounts/[accountId]/activity/page.tsx`. Renders the shared
 * <EntityAuditTimeline> for `entityKind: 'creditNote'`.
 */

import { notFound } from 'next/navigation';

import { EntityAuditTimeline } from '@/components/crm/entity-audit-timeline';
import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { getCreditNoteById } from '@/app/actions/crm-credit-notes.actions';

interface PageProps {
    params: Promise<{ id: string }>;
}

export default async function CreditNoteActivityPage({ params }: PageProps) {
    const { id } = await params;
    const note = await getCreditNoteById(id);
    if (!note) notFound();

    const title = (note as any).creditNoteNumber || (note as any).cnNo || `Credit note ${id.slice(-6)}`;

    return (
        <EntityDetailShell
            title={title}
            eyebrow="CREDIT NOTE ACTIVITY"
            back={{
                href: `/dashboard/crm/sales/credit-notes/${id}`,
                label: 'Back to credit note',
            }}
        >
            <EntityAuditTimeline entityKind="creditNote" entityId={id} />
        </EntityDetailShell>
    );
}
