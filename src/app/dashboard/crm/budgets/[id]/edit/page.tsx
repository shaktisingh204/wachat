/**
 * Edit Budget — server wrapper that fetches by id, wraps the client
 * edit form in <EntityDetailShell> with a context right-rail and the
 * <EntityAuditTimeline> activity footer (per CRM_PAGE_REDESIGN_PLAN
 * §3.3.2 — every Deep edit page should show activity context while
 * the user edits).
 */

import { notFound } from 'next/navigation';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/sabcrm/20ui';

import { getBudgetById } from '@/app/actions/crm-budgets.actions';
import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { EntityAuditTimeline } from '@/components/crm/entity-audit-timeline';
import { EditBudgetForm } from './edit-budget-form';
import { BudgetProgressBar } from '../../_components/budget-progress-bar';

interface PageProps {
    params: Promise<{ id: string }>;
}

function fmtMoney(value: unknown): string {
    if (typeof value !== 'number' || Number.isNaN(value)) return '—';
    try {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0,
        }).format(value);
    } catch {
        return String(value);
    }
}

export default async function EditBudgetPage({ params }: PageProps) {
    const { id } = await params;
    const budget = await getBudgetById(id);
    if (!budget) notFound();

    const plan = typeof budget.planAmount === 'number' ? budget.planAmount : 0;
    const actual = typeof budget.actual === 'number' ? budget.actual : 0;
    const variance = plan - actual;
    
    // Prevent division by zero if planAmount is 0
    let utilisation = 0;
    if (plan !== 0) {
        utilisation = Math.min(100, Math.round((actual / plan) * 100));
    } else if (actual > 0) {
        utilisation = 100; // Fully over-utilised if there's actual spend but no plan
    }

    return (
        <EntityDetailShell
            eyebrow="BUDGET"
            title={`Edit · ${budget.budgetHead || 'budget'}`}
            back={{ href: `/dashboard/crm/budgets/${id}`, label: 'Back to budget' }}
            status={
                budget.status
                    ? {
                          label: String(budget.status),
                          tone:
                              budget.status === 'approved'
                                  ? 'green'
                                  : budget.status === 'rejected'
                                    ? 'red'
                                    : budget.status === 'pending_approval'
                                      ? 'amber'
                                      : 'neutral',
                      }
                    : undefined
            }
            rightRail={
                <>
                    <Card>
                        <CardHeader>
                            <CardTitle>Plan vs actual</CardTitle>
                        </CardHeader>
                        <CardBody>
                            <div className="space-y-2 text-[12.5px]">
                                <div className="flex items-center justify-between">
                                    <span className="text-[var(--st-text-secondary)]">Plan</span>
                                    <span className="font-mono tabular-nums">
                                        {fmtMoney(plan)}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-[var(--st-text-secondary)]">Actual</span>
                                    <span className="font-mono tabular-nums">
                                        {fmtMoney(actual)}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between border-t border-[var(--st-border)] pt-2">
                                    <span className="text-[var(--st-text-secondary)]">Variance</span>
                                    <span
                                        className={`font-mono tabular-nums ${variance < 0 ? 'text-[var(--st-danger)]' : 'text-[var(--st-status-ok)]'}`}
                                    >
                                        {fmtMoney(variance)}
                                    </span>
                                </div>
                                <BudgetProgressBar utilisation={utilisation} />
                                <div className="text-right text-[11px] text-[var(--st-text-secondary)] mt-1">
                                    {utilisation}% utilised
                                </div>
                            </div>
                        </CardBody>
                    </Card>
                    <Card>
                        <CardHeader>
                            <CardTitle>Owner</CardTitle>
                        </CardHeader>
                        <CardBody>
                            <div className="text-[12.5px] text-[var(--st-text)]">
                                {budget.ownerName || '—'}
                            </div>
                            {budget.approverName ? (
                                <div className="mt-2 text-[12px] text-[var(--st-text-secondary)]">
                                    Approver: {budget.approverName}
                                </div>
                            ) : null}
                        </CardBody>
                    </Card>
                </>
            }
            audit={<EntityAuditTimeline entityKind="budget" entityId={id} />}
        >
            <EditBudgetForm budget={budget} budgetId={id} />
        </EntityDetailShell>
    );
}
