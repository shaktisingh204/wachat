/**
 * Invoice activity (audit log) — server route.
 *
 * Mirrors `accounts/[accountId]/activity/page.tsx`. Renders the shared
 * <EntityAuditTimeline> for `entityKind: 'invoice'`.
 */

import { notFound } from 'next/navigation';

import { CrmPageHeader } from '../../../../_components/crm-page-header';
import { EntityAuditTimeline } from '@/components/crm/entity-audit-timeline';
import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { getInvoiceById } from '@/app/actions/crm-invoices.actions';

interface PageProps {
    params: Promise<{ id: string }>;
}

export default async function InvoiceActivityPage({ params }: PageProps) {
    const { id } = await params;
    const invoice = await getInvoiceById(id);
    if (!invoice) notFound();

    const title = (invoice as any).invoiceNumber || (invoice as any).invoiceNo || `Invoice ${id.slice(-6)}`;

    return (
        <div className="space-y-6">
            <CrmPageHeader
                title={`${title} — Activity`}
                subtitle="Audit trail of changes made to this invoice."
            />
            <EntityDetailShell
                title={title}
                eyebrow="INVOICE ACTIVITY"
                back={{
                    href: `/dashboard/crm/sales/invoices/${id}`,
                    label: 'Back to invoice',
                }}
            >
                <EntityAuditTimeline entityKind="invoice" entityId={id} />
            </EntityDetailShell>
        </div>
    );
}
