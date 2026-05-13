/**
 * Loan activity (audit log) — server route.
 *
 * Mirrors `accounts/[accountId]/activity/page.tsx`.
 */

import { notFound } from 'next/navigation';

import { CrmPageHeader } from '../../../_components/crm-page-header';
import { EntityAuditTimeline } from '@/components/crm/entity-audit-timeline';
import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { getLoanById } from '@/app/actions/crm-loans.actions';

interface PageProps {
    params: Promise<{ id: string }>;
}

export default async function LoanActivityPage({ params }: PageProps) {
    const { id } = await params;
    const loan = await getLoanById(id);
    if (!loan) notFound();

    const title = (loan.borrowerName as string) || 'Loan';

    return (
        <div className="space-y-6">
            <CrmPageHeader
                title={`${title} — Activity`}
                subtitle="Audit trail of changes made to this loan."
            />
            <EntityDetailShell
                title={title}
                eyebrow="LOAN ACTIVITY"
                back={{
                    href: `/dashboard/crm/loans/${id}`,
                    label: 'Back to loan',
                }}
            >
                <EntityAuditTimeline entityKind="loan" entityId={id} />
            </EntityDetailShell>
        </div>
    );
}
