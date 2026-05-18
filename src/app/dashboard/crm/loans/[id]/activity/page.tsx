/**
 * Loan activity (audit log) — server route.
 *
 * Mirrors `accounts/[accountId]/activity/page.tsx`.
 */

import { notFound } from 'next/navigation';

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
        <EntityDetailShell
            title={`${title} — Activity`}
            eyebrow="LOAN ACTIVITY"
            back={{
                href: `/dashboard/crm/loans/${id}`,
                label: 'Back to loan',
            }}
        >
            <EntityAuditTimeline entityKind="loan" entityId={id} />
        </EntityDetailShell>
    );
}
