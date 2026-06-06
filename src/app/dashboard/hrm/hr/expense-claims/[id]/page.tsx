export const dynamic = 'force-dynamic';
import { Badge, Button, Card, Table, TBody, Td, Th, THead, Tr } from '@/components/sabcrm/20ui';
import {
  notFound } from 'next/navigation';
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

/**
 * Expense claim detail page (§1D.2).
 *
 * Loads a single document from `hr_expense_claims` and renders an
 * overview grid + claim-lines table (if `lines` is an array). Actions:
 * Edit · Approve · Reject · Mark reimbursed · Print (stubs).
 */

import { statusToTone } from '@/components/crm/status-pill';
import {
    getHrEntityById,
    fmtDate,
    fmtText,
    fmtCurrency,
    fmtShortId,
} from '../../_components/hr-detail-loader';
import { HrDetailGrid, HrDetailRow } from '../../_components/hr-detail-grid';
import { HrActionButtons } from '../../_components/hr-action-buttons';
import {
    approveExpenseClaim,
    rejectExpenseClaim,
    markExpenseClaimReimbursed,
} from '@/app/actions/hr-status-flow.actions';
import { EntityAuditTimeline } from '@/components/crm/entity-audit-timeline';

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
                        <Button variant="outline" size="sm">
                            <ArrowLeft className="h-4 w-4" /> Back
                        </Button>
                    </Link>
                    <Link href={`${BASE}/${id}/edit`}>
                        <Button size="sm">
                            <Pencil className="h-4 w-4" /> Edit
                        </Button>
                    </Link>
                    <a href={`${BASE}/${id}?print=1`} target="_blank" rel="noopener noreferrer">
                        <Button variant="outline" size="sm">
                            <Printer className="h-4 w-4" /> Print
                        </Button>
                    </a>
                    <HrActionButtons
                        actions={[
                            {
                                key: 'approve',
                                kind: 'action',
                                label: 'Approve',
                                icon: <Check className="h-4 w-4" />,
                                onRun: () => approveExpenseClaim(id),
                            },
                            {
                                key: 'reject',
                                kind: 'prompt',
                                label: 'Reject',
                                icon: <X className="h-4 w-4" />,
                                variant: 'destructive',
                                promptTitle: 'Reject expense claim',
                                promptDescription:
                                    'Provide a reason for rejection — this will be visible to the claimant.',
                                submitLabel: 'Reject',
                                fields: [
                                    {
                                        name: 'reason',
                                        label: 'Reason',
                                        type: 'textarea',
                                        required: true,
                                    },
                                ],
                                onRun: (v) => rejectExpenseClaim(id, v.reason ?? ''),
                            },
                            {
                                key: 'reimburse',
                                kind: 'prompt',
                                label: 'Mark reimbursed',
                                icon: <Banknote className="h-4 w-4" />,
                                promptTitle: 'Mark claim as reimbursed',
                                promptDescription:
                                    'Optionally record the reimbursed amount in the claim currency.',
                                submitLabel: 'Mark reimbursed',
                                fields: [
                                    {
                                        name: 'amount',
                                        label: 'Reimbursed amount',
                                        type: 'number',
                                        placeholder: 'Optional',
                                    },
                                ],
                                onRun: (v) => {
                                    const n = Number(v.amount);
                                    return markExpenseClaimReimbursed(
                                        id,
                                        Number.isFinite(n) && v.amount
                                            ? n
                                            : undefined,
                                    );
                                },
                            },
                        ]}
                    />
                </>
            }
            audit={<EntityAuditTimeline entityKind="expense_claim" entityId={id} />}
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
                    <Badge variant={status === 'approved' || status === 'reimbursed' ? 'success' : 'warning'}>
                        {status}
                    </Badge>
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

            <Card className="p-6">
                <div className="mb-4 text-[15px] font-medium text-[var(--st-text)]">Claim lines</div>
                {lines.length === 0 ? (
                    <div className="rounded-[var(--st-radius)] border border-dashed border-[var(--st-border)] bg-[var(--st-bg-muted)] px-3 py-6 text-center text-[12.5px] text-[var(--st-text-secondary)]">
                        No itemized lines — this claim has a single amount only.
                    </div>
                ) : (
                    <div className="overflow-x-auto rounded-[var(--st-radius)] border border-[var(--st-border)]">
                        <Table>
                            <THead>
                                <Tr>
                                    <Th>Date</Th>
                                    <Th>Category</Th>
                                    <Th>Project</Th>
                                    <Th>Description</Th>
                                    <Th className="text-right">Amount</Th>
                                </Tr>
                            </THead>
                            <TBody>
                                {lines.map((row, idx) => (
                                    <Tr key={idx}>
                                        <Td>{fmtDate(row.date)}</Td>
                                        <Td>{fmtText(row.category)}</Td>
                                        <Td>
                                            {fmtText(row.project || row.projectId)}
                                        </Td>
                                        <Td>{fmtText(row.description)}</Td>
                                        <Td className="text-right">
                                            {fmtCurrency(row.amount, currency)}
                                        </Td>
                                    </Tr>
                                ))}
                            </TBody>
                        </Table>
                    </div>
                )}
            </Card>

            <Wallet className="hidden" />
        </EntityDetailShell>
    );
}
