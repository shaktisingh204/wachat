/**
 * Budget detail — server component.
 * Renders every field of the budget via <EntityDetailShell>.
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Pencil } from 'lucide-react';

import { EntityDetailShell, type EntityStatusTone } from '@/components/crm/entity-detail-shell';
import {
    ZoruButton,
    ZoruCard,
    ZoruCardContent,
    ZoruCardHeader,
    ZoruCardTitle,
} from '@/components/zoruui';
import { getBudgetById } from '@/app/actions/crm-budgets.actions';

interface PageProps {
    params: Promise<{ id: string }>;
}

function toneFor(status?: string): EntityStatusTone {
    const s = (status || '').toLowerCase();
    if (s === 'active' || s === 'approved') return 'green';
    if (s === 'draft') return 'neutral';
    if (s === 'closed' || s === 'archived') return 'red';
    return 'amber';
}

function fmtMoney(value: unknown): string {
    if (typeof value !== 'number' || Number.isNaN(value)) return '—';
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 2,
    }).format(value);
}

function fmtDate(value: unknown): string {
    if (!value) return '—';
    try {
        const d = new Date(value as string);
        if (Number.isNaN(d.getTime())) return '—';
        return d.toLocaleDateString();
    } catch {
        return '—';
    }
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div className="grid grid-cols-3 gap-3 border-b border-zoru-line/60 py-2 last:border-0">
            <dt className="col-span-1 text-[12.5px] text-zoru-ink-muted">{label}</dt>
            <dd className="col-span-2 text-[13px] text-zoru-ink">{value ?? '—'}</dd>
        </div>
    );
}

export default async function BudgetDetailPage({ params }: PageProps) {
    const { id } = await params;
    const budget = await getBudgetById(id);
    if (!budget) notFound();

    const title = (budget.budgetHead as string) || 'Budget';
    const status = (budget.status as string) || 'draft';

    return (
        <EntityDetailShell
            title={title}
            eyebrow="BUDGET"
            status={{ label: status, tone: toneFor(status) }}
            back={{ href: '/dashboard/crm/budgets', label: 'Back to budgets' }}
            actions={
                <ZoruButton variant="outline" size="sm" asChild>
                    <Link href={`/dashboard/crm/budgets/${id}/edit`}>
                        <Pencil className="h-3.5 w-3.5" strokeWidth={1.75} />
                        Edit
                    </Link>
                </ZoruButton>
            }
            audit={{ entityKind: 'budget', entityId: id }}
        >
            <ZoruCard>
                <ZoruCardHeader>
                    <ZoruCardTitle>Budget details</ZoruCardTitle>
                </ZoruCardHeader>
                <ZoruCardContent>
                    <dl>
                        <Field label="Budget head" value={budget.budgetHead} />
                        <Field label="Period" value={budget.period || '—'} />
                        <Field label="Scenario" value={budget.scenario || '—'} />
                        <Field label="Plan amount" value={fmtMoney(budget.planAmount)} />
                        <Field label="Actual" value={fmtMoney(budget.actual)} />
                        <Field label="Variance" value={fmtMoney(budget.variance)} />
                        <Field
                            label="Alert threshold"
                            value={
                                typeof budget.alertAt === 'number'
                                    ? `${budget.alertAt}%`
                                    : '—'
                            }
                        />
                        <Field label="Owner" value={budget.ownerName || '—'} />
                        <Field label="Status" value={status} />
                        <Field label="Notes" value={budget.notes || '—'} />
                        <Field label="Created" value={fmtDate(budget.createdAt)} />
                        <Field label="Updated" value={fmtDate(budget.updatedAt)} />
                    </dl>
                </ZoruCardContent>
            </ZoruCard>
        </EntityDetailShell>
    );
}
