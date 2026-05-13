/**
 * Loan detail — server component.
 *
 * Renders every field of the loan via <EntityDetailShell>, with
 * an "Edit" action button and an audit timeline footer keyed to
 * entityKind: 'loan'.
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
import { getLoanById } from '@/app/actions/crm-loans.actions';

interface PageProps {
    params: Promise<{ id: string }>;
}

function toneFor(status?: string): EntityStatusTone {
    const s = (status || '').toLowerCase();
    if (s === 'active' || s === 'approved' || s === 'closed') return 'green';
    if (s === 'draft' || s === 'pending') return 'neutral';
    if (s === 'npa' || s === 'cancelled' || s === 'expired') return 'red';
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

function fmtType(t?: string): string {
    if (!t) return '—';
    return t
        .split('_')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div className="grid grid-cols-3 gap-3 border-b border-zoru-line/60 py-2 last:border-0">
            <dt className="col-span-1 text-[12.5px] text-zoru-ink-muted">{label}</dt>
            <dd className="col-span-2 text-[13px] text-zoru-ink">{value ?? '—'}</dd>
        </div>
    );
}

export default async function LoanDetailPage({ params }: PageProps) {
    const { id } = await params;
    const loan = await getLoanById(id);
    if (!loan) notFound();

    const title = (loan.borrowerName as string) || 'Loan';
    const status = (loan.status as string) || 'draft';

    return (
        <EntityDetailShell
            title={title}
            eyebrow="LOAN"
            status={{ label: status, tone: toneFor(status) }}
            back={{ href: '/dashboard/crm/loans', label: 'Back to loans' }}
            actions={
                <ZoruButton variant="outline" size="sm" asChild>
                    <Link href={`/dashboard/crm/loans/${id}/edit`}>
                        <Pencil className="h-3.5 w-3.5" strokeWidth={1.75} />
                        Edit
                    </Link>
                </ZoruButton>
            }
            audit={{ entityKind: 'loan', entityId: id }}
        >
            <ZoruCard>
                <ZoruCardHeader>
                    <ZoruCardTitle>Loan details</ZoruCardTitle>
                </ZoruCardHeader>
                <ZoruCardContent>
                    <dl>
                        <Field label="Type" value={fmtType(loan.type)} />
                        <Field label="Borrower" value={loan.borrowerName} />
                        <Field
                            label="Borrower ID"
                            value={loan.borrowerId ? String(loan.borrowerId) : '—'}
                        />
                        <Field label="Principal" value={fmtMoney(loan.principal)} />
                        <Field
                            label="Interest rate"
                            value={
                                typeof loan.interestRate === 'number'
                                    ? `${loan.interestRate}%`
                                    : '—'
                            }
                        />
                        <Field label="Tenure (months)" value={loan.tenureMonths ?? '—'} />
                        <Field label="EMI" value={fmtMoney(loan.emi)} />
                        <Field label="Outstanding" value={fmtMoney(loan.outstanding)} />
                        <Field label="NPA" value={loan.npa ? 'Yes' : 'No'} />
                        <Field label="Start date" value={fmtDate(loan.startDate)} />
                        <Field label="Status" value={status} />
                        <Field label="Notes" value={loan.notes || '—'} />
                        <Field label="Created" value={fmtDate(loan.createdAt)} />
                        <Field label="Updated" value={fmtDate(loan.updatedAt)} />
                    </dl>
                </ZoruCardContent>
            </ZoruCard>
        </EntityDetailShell>
    );
}
