/**
 * Proforma invoice activity (audit log) — server route.
 *
 * Mirrors `accounts/[accountId]/activity/page.tsx`. Renders the shared
 * <EntityAuditTimeline> for `entityKind: 'proforma'`.
 */

import { notFound } from 'next/navigation';

import { EntityAuditTimeline } from '@/components/crm/entity-audit-timeline';
import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { getProformaInvoiceById } from '@/app/actions/crm-proforma-invoices.actions';

interface PageProps {
    params: Promise<{ id: string }>;
}

export default async function ProformaActivityPage({ params }: PageProps) {
    const { id } = await params;
    const proforma = await getProformaInvoiceById(id);
    if (!proforma) notFound();

    const title = (proforma as any).proformaNumber || `Proforma ${id.slice(-6)}`;

    return (
        <EntityDetailShell
            title={title}
            eyebrow="PROFORMA ACTIVITY"
            back={{
                href: `/dashboard/crm/sales/proforma/${id}`,
                label: 'Back to proforma',
            }}
        >
            <EntityAuditTimeline entityKind="proforma" entityId={id} />
        </EntityDetailShell>
    );
}
