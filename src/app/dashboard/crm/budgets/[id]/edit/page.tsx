/**
 * Edit Budget — server wrapper that fetches by id, wraps the client
 * edit form in <EntityDetailShell> with a context right-rail and the
 * <EntityAuditTimeline> activity footer (per CRM_PAGE_REDESIGN_PLAN
 * §3.3.2 — every Deep edit page should show activity context while
 * the user edits).
 */

import { notFound } from 'next/navigation';
import { Card, ZoruCardContent, ZoruCardHeader, ZoruCardTitle } from '@/components/zoruui';

import { getBudgetById } from '@/app/actions/crm-budgets.actions';
import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { EntityAuditTimeline } from '@/components/crm/entity-audit-timeline';
import { EditBudgetForm } from './edit-budget-form';

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
    const utilisation = plan > 0 ? Math.min(100, Math.round((actual / plan) * 100)) : 0;

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
                    <ZoruCard>
                        <ZoruCardHeader>
                            <ZoruCardTitle>Plan vs actual</ZoruCardTitle>
                        </ZoruCardHeader>
                        <ZoruCardContent>
                            <div className="space-y-2 text-[12.5px]">
                                <div className="flex items-center justify-between">
                                    <span className="text-zoru-ink-muted">Plan</span>
                                    <span className="font-mono tabular-nums">
                                        {fmtMoney(plan)}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-zoru-ink-muted">Actual</span>
                                    <span className="font-mono tabular-nums">
                                        {fmtMoney(actual)}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between border-t border-zoru-line pt-2">
                                    <span className="text-zoru-ink-muted">Variance</span>
                                    <span
                                        className={`font-mono tabular-nums ${variance < 0 ? 'text-zoru-danger-ink' : 'text-zoru-success-ink'}`}
                                    >
                                        {fmtMoney(variance)}
                                    </span>
                                </div>
                                <div className="mt-2 h-1.5 w-full overflow-hidden rounded bg-zoru-surface-2">
                                    <div
                                        className={`h-full ${utilisation >= 100 ? 'bg-zoru-danger-ink' : utilisation >= 80 ? 'bg-zoru-warning-ink' : 'bg-zoru-primary'}`}
                                        style={{ width: `${utilisation}%` }}
                                    />
                                </div>
                                <div className="text-right text-[11px] text-zoru-ink-muted">
                                    {utilisation}% utilised
                                </div>
                            </div>
                        </ZoruCardContent>
                    </ZoruCard>
                    <ZoruCard>
                        <ZoruCardHeader>
                            <ZoruCardTitle>Owner</ZoruCardTitle>
                        </ZoruCardHeader>
                        <ZoruCardContent>
                            <div className="text-[12.5px] text-zoru-ink">
                                {budget.ownerName || '—'}
                            </div>
                            {budget.approverName ? (
                                <div className="mt-2 text-[12px] text-zoru-ink-muted">
                                    Approver: {budget.approverName}
                                </div>
                            ) : null}
                        </ZoruCardContent>
                    </ZoruCard>
                </>
            }
            audit={<EntityAuditTimeline entityKind="budget" entityId={id} />}
        >
            <EditBudgetForm budget={budget} budgetId={id} />
        </EntityDetailShell>
    );
}
