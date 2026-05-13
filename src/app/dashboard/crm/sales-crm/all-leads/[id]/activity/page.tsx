/**
 * Lead activity (audit log) — server route.
 *
 * Mirrors the accounts/[accountId]/activity pattern. Renders the
 * shared <EntityAuditTimeline> for `entityKind: 'lead'`.
 */

import { notFound } from 'next/navigation';

import { CrmPageHeader } from '../../../../_components/crm-page-header';
import { EntityAuditTimeline } from '@/components/crm/entity-audit-timeline';
import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { getCrmLeadById } from '@/app/actions/crm-leads.actions';

interface PageProps {
    params: Promise<{ id: string }>;
}

export default async function LeadActivityPage({ params }: PageProps) {
    const { id } = await params;
    const lead = await getCrmLeadById(id);
    if (!lead) notFound();

    return (
        <div className="space-y-6">
            <CrmPageHeader
                title={`${lead.title} — Activity`}
                subtitle="Audit trail of changes made to this lead."
            />
            <EntityDetailShell
                title={lead.title || lead.contactName || 'Lead'}
                eyebrow="LEAD ACTIVITY"
                back={{
                    href: `/dashboard/crm/sales-crm/all-leads/${id}`,
                    label: 'Back to lead',
                }}
            >
                <EntityAuditTimeline entityKind="lead" entityId={id} />
            </EntityDetailShell>
        </div>
    );
}
