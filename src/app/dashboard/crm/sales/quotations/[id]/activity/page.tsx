/**
 * Quotation activity (audit log) — server route.
 *
 * Mirrors `accounts/[accountId]/activity/page.tsx`. Renders the shared
 * <EntityAuditTimeline> for `entityKind: 'quotation'`.
 */

import { notFound } from 'next/navigation';

import { CrmPageHeader } from '../../../../_components/crm-page-header';
import { EntityAuditTimeline } from '@/components/crm/entity-audit-timeline';
import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { getQuotationById } from '@/app/actions/crm-quotations.actions';

interface PageProps {
    params: Promise<{ id: string }>;
}

export default async function QuotationActivityPage({ params }: PageProps) {
    const { id } = await params;
    const quotation = await getQuotationById(id);
    if (!quotation) notFound();

    const title = (quotation as any).quotationNumber || (quotation as any).quotationNo || `Quotation ${id.slice(-6)}`;

    return (
        <div className="space-y-6">
            <CrmPageHeader
                title={`${title} — Activity`}
                subtitle="Audit trail of changes made to this quotation."
            />
            <EntityDetailShell
                title={title}
                eyebrow="QUOTATION ACTIVITY"
                back={{
                    href: `/dashboard/crm/sales/quotations/${id}`,
                    label: 'Back to quotation',
                }}
            >
                <EntityAuditTimeline entityKind="quotation" entityId={id} />
            </EntityDetailShell>
        </div>
    );
}
