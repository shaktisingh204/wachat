/**
 * Expense claim detail page (§1D.2).
 *
 * Loads a single document from `hr_expense_claims` and renders an
 * overview grid + claim-lines table (if `lines` is an array). Actions:
 * Edit · Approve · Reject · Mark reimbursed · Print (stubs).
 */

import { notFound } from 'next/navigation';
import Link from 'next/link';
import {
    Wallet,
    Pencil,
    Check,
    X,
    Banknote,
    Printer,
    ArrowLeft,
} from 'lucide-react';

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import {
    ZoruBadge,
    ZoruButton,
    ZoruCard,
    ZoruTable,
    ZoruTableBody,
    ZoruTableCell,
    ZoruTableHead,
    ZoruTableHeader,
    ZoruTableRow,
} from '@/components/zoruui';
import { statusToTone } from '@/components/crm/status-pill';
import {
    getHrEntityById,
    fmtDate,
    fmtText,
    fmtCurrency,
    fmtShortId,
} from '../../_components/hr-detail-loader';
import { HrDetailGrid, HrDetailRow } from '../../_components/hr-detail-grid';

interface PageProps {
    params: Promise<{ id: string }>;
}

const BASE = '/dashboard/hrm/hr/expense-claims';

interface ClaimLine {
    category?: string;
    date?: string;
    amount?: number | string;
    receiptUrl?: string;
    receipt?: string;
    project?: string;
    projectId?: string;
    description?: string;
}

export default async function ExpenseClaimDetailPage({ params }: PageProps) {
    const { id } = await params;
    const doc = await getHrEntityById('hr_expense_claims', id);
    if (!doc) notFound();

    const c = doc as Record<string, unknown>;
    const status = String(c.status || 'pending');
    const title = (c.title as string) || 'Untitled claim';
    const employeeRef = (c.employeeName as string) || (c.employeeId as string) || '—';
    const currency = (c.currency as string) || 'INR';
    const lines: ClaimLine[] = Array.isArray(c.lines) ? (c.lines as ClaimLine[]) : [];

    return (
        <EntityDetailShell
            title={`${title} · ${fmtShortId(employeeRef)}`}
            eyebrow="HR · EXPENSE CLAIM"
            back={{ href: BASE, label: 'All claims' }}
            status={{ label: status, tone: statusToTone(status) }}
            actions={
                <>
                    <Link href={BASE}>
                        <ZoruButton variant="outline" size="sm">
                            <ArrowLeft className="h-4 w-4" /> Back
                        </ZoruButton>
                    </Link>
                    <Link href={`${BASE}/${id}/edit`}>
                        <ZoruButton size="sm">
                            <Pencil className="h-4 w-4" /> Edit
                        </ZoruButton>
                    </Link>
                    {/* TODO 1D.2: wire Approve/Reject/Reimburse to status mutations. */}
                    <ZoruButton variant="outline" size="sm" disabled>
                        <Check className="h-4 w-4" /> Approve
                    </ZoruButton>
                    <ZoruButton variant="outline" size="sm" disabled>
                        <X className="h-4 w-4" /> Reject
                    </ZoruButton>
                    <ZoruButton variant="outline" size="sm" disabled>
                        <Banknote className="h-4 w-4" /> Mark reimbursed
                    </ZoruButton>
                    <ZoruButton variant="outline" size="sm" disabled>
                        <Printer className="h-4 w-4" /> Print
                    </ZoruButton>
                </>
            }
            audit={{ entityKind: 'expense-claim', entityId: id }}
        >
            <HrDetailGrid title="Overview">
                <HrDetailRow label="Employee">{fmtText(employeeRef)}</HrDetailRow>
                <HrDetailRow label="Category">{fmtText(c.category)}</HrDetailRow>
                <HrDetailRow label="Amount">{fmtCurrency(c.amount, currency)}</HrDetailRow>
                <HrDetailRow label="Currency">{fmtText(currency)}</HrDetailRow>
                <HrDetailRow label="Incurred on">{fmtDate(c.incurredAt)}</HrDetailRow>
                <HrDetailRow label="Submitted">{fmtDate(c.submittedAt || c.createdAt)}</HrDetailRow>
                <HrDetailRow label="Approver">{fmtText(c.approverName || c.approverId)}</HrDetailRow>
                <HrDetailRow label="Reimbursed">
                    {String(c.reimbursed) === 'true' || c.reimbursed === true ? 'Yes' : 'No'}
                </HrDetailRow>
                <HrDetailRow label="Status">
                    <ZoruBadge variant={status === 'approved' || status === 'reimbursed' ? 'success' : 'warning'}>
                        {status}
                    </ZoruBadge>
                </HrDetailRow>
                {c.description ? (
                    <HrDetailRow label="Description" fullWidth>
                        {String(c.description)}
                    </HrDetailRow>
                ) : null}
                {c.notes ? (
                    <HrDetailRow label="Notes" fullWidth>
                        {String(c.notes)}
                    </HrDetailRow>
                ) : null}
            </HrDetailGrid>

            <ZoruCard className="p-6">
                <div className="mb-4 text-[15px] font-medium text-zoru-ink">Claim lines</div>
                {lines.length === 0 ? (
                    <div className="rounded-[var(--zoru-radius)] border border-dashed border-zoru-line bg-zoru-surface-2 px-3 py-6 text-center text-[12.5px] text-zoru-ink-muted">
                        No itemized lines — this claim has a single amount only.
                    </div>
                ) : (
                    <div className="overflow-x-auto rounded-[var(--zoru-radius)] border border-zoru-line">
                        <ZoruTable>
                            <ZoruTableHeader>
                                <ZoruTableRow>
                                    <ZoruTableHead>Date</ZoruTableHead>
                                    <ZoruTableHead>Category</ZoruTableHead>
                                    <ZoruTableHead>Project</ZoruTableHead>
                                    <ZoruTableHead>Description</ZoruTableHead>
                                    <ZoruTableHead className="text-right">Amount</ZoruTableHead>
                                </ZoruTableRow>
                            </ZoruTableHeader>
                            <ZoruTableBody>
                                {lines.map((row, idx) => (
                                    <ZoruTableRow key={idx}>
                                        <ZoruTableCell>{fmtDate(row.date)}</ZoruTableCell>
                                        <ZoruTableCell>{fmtText(row.category)}</ZoruTableCell>
                                        <ZoruTableCell>
                                            {fmtText(row.project || row.projectId)}
                                        </ZoruTableCell>
                                        <ZoruTableCell>{fmtText(row.description)}</ZoruTableCell>
                                        <ZoruTableCell className="text-right">
                                            {fmtCurrency(row.amount, currency)}
                                        </ZoruTableCell>
                                    </ZoruTableRow>
                                ))}
                            </ZoruTableBody>
                        </ZoruTable>
                    </div>
                )}
            </ZoruCard>

            <Wallet className="hidden" />
        </EntityDetailShell>
    );
}
