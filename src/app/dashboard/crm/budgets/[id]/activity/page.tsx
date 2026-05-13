/**
 * Budget activity (audit log) — server route.
 */

import { notFound } from 'next/navigation';

import { CrmPageHeader } from '../../../_components/crm-page-header';
import { EntityAuditTimeline } from '@/components/crm/entity-audit-timeline';
import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { getBudgetById } from '@/app/actions/crm-budgets.actions';

interface PageProps {
    params: Promise<{ id: string }>;
}

export default async function BudgetActivityPage({ params }: PageProps) {
    const { id } = await params;
    const budget = await getBudgetById(id);
    if (!budget) notFound();

    const title = (budget.budgetHead as string) || 'Budget';

    return (
        <div className="space-y-6">
            <CrmPageHeader
                title={`${title} — Activity`}
                subtitle="Audit trail of changes made to this budget."
            />
            <EntityDetailShell
                title={title}
                eyebrow="BUDGET ACTIVITY"
                back={{
                    href: `/dashboard/crm/budgets/${id}`,
                    label: 'Back to budget',
                }}
            >
                <EntityAuditTimeline entityKind="budget" entityId={id} />
            </EntityDetailShell>
        </div>
    );
}
