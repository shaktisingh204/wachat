/**
 * Bill (purchase expense) detail page.
 *
 * Mirrors the sales/invoices/[invoiceId] PoC: a minimal detail view
 * whose primary job is to host <LineageRail> on a real purchase-side
 * document, satisfying crm_function_plan.md §13.5 for the PO → GRN →
 * Bill → Payout chain. Bulk editing still happens on the list page.
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Receipt } from 'lucide-react';

import {
    ZoruBadge,
    ZoruButton,
    ZoruCard,
} from '@/components/zoruui';
import { CrmPageHeader } from '../../../_components/crm-page-header';
import { getExpenseById } from '@/app/actions/crm-expenses.actions';
import { getCrmVendorById } from '@/app/actions/crm-vendors.actions';
import type { CrmBill, CrmExpense, WithId } from '@/lib/definitions';
import { LineageRail } from '@/components/crm/lineage-rail';

function fmtDate(v: unknown): string {
    if (!v) return '—';
    const d = new Date(v as any);
    return isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

function fmtMoney(n: number, currency = 'INR'): string {
    try {
        return new Intl.NumberFormat('en-IN', { style: 'currency', currency }).format(n || 0);
    } catch {
        return `${currency} ${n || 0}`;
    }
}

const STATUS_VARIANT: Record<string, 'ghost' | 'success' | 'warning' | 'danger'> = {
    draft: 'ghost',
    submitted: 'warning',
    approved: 'warning',
    paid: 'success',
    partially_paid: 'warning',
    overdue: 'danger',
    cancelled: 'ghost',
    Draft: 'ghost',
    Submitted: 'warning',
    Approved: 'warning',
    Paid: 'success',
    'Partially Paid': 'warning',
    Overdue: 'danger',
    Cancelled: 'ghost',
};

/**
 * The list page persists docs as `CrmExpense`, but `CrmBill` is the
 * richer accounts-payable shape used elsewhere on the purchase chain.
 * The lineage rail and detail view treat both interchangeably, so we
 * normalise the loaded doc to a permissive merged view.
 */
type BillLike = WithId<CrmExpense> & Partial<CrmBill>;

export default async function BillDetailPage(props: {
    params: Promise<{ expenseId: string }>;
}) {
    const { expenseId } = await props.params;
    const bill = (await getExpenseById(expenseId)) as BillLike | null;

    if (!bill) {
        notFound();
    }

    const vendor = bill.vendorId
        ? await getCrmVendorById(bill.vendorId.toString())
        : null;
    const vendorLabel =
        vendor?.displayName ?? vendor?.name ?? '(unknown vendor)';

    const id = (bill._id as any)?.toString?.() ?? String(bill._id);
    const billNo =
        bill.referenceNumber ??
        bill.billNo ??
        (bill as any).billNumber ??
        bill.vendorInvoiceNo ??
        (bill as any).vendorInvoiceNumber ??
        'Bill';
    const billDate = bill.billDate ?? bill.expenseDate;
    const status = (bill.status as string | undefined) ?? 'draft';
    const currency = bill.currency || 'INR';
    const total =
        typeof bill.total === 'number'
            ? bill.total
            : typeof bill.amount === 'number'
                ? bill.amount
                : 0;
    const balance =
        typeof bill.balance === 'number'
            ? bill.balance
            : typeof bill.amountPaid === 'number'
                ? Math.max(0, total - bill.amountPaid)
                : undefined;

    const items = bill.items ?? [];
    const expenseLines = bill.expenseLines ?? [];

    return (
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                title={billNo}
                subtitle="Bill detail"
                icon={Receipt}
                actions={
                    <Link href="/dashboard/crm/purchases/expenses">
                        <ZoruButton variant="outline">
                            <ArrowLeft className="h-4 w-4" />
                            Back
                        </ZoruButton>
                    </Link>
                }
            />

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
                <div className="flex flex-col gap-6">
                    <ZoruCard className="p-6">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                                <h2 className="text-[16px] text-zoru-ink">{billNo}</h2>
                                <p className="mt-0.5 text-[12.5px] text-zoru-ink-muted">
                                    Bill date {fmtDate(billDate)}
                                    {bill.dueDate ? ` • Due ${fmtDate(bill.dueDate)}` : ''}
                                </p>
                                <p className="mt-0.5 text-[12.5px] text-zoru-ink-muted">
                                    Vendor: {vendorLabel}
                                </p>
                                {vendor?.gstin && (
                                    <p className="mt-0.5 text-[11.5px] text-zoru-ink-muted">
                                        GSTIN: {vendor.gstin}
                                    </p>
                                )}
                            </div>
                            <ZoruBadge variant={STATUS_VARIANT[status] ?? 'ghost'}>
                                {status}
                            </ZoruBadge>
                        </div>

                        <div className="mt-4 grid grid-cols-2 gap-3 text-[13px] sm:grid-cols-3">
                            <div>
                                <div className="text-zoru-ink-muted">Total</div>
                                <div className="text-zoru-ink">{fmtMoney(total, currency)}</div>
                            </div>
                            {typeof bill.amountPaid === 'number' && (
                                <div>
                                    <div className="text-zoru-ink-muted">Amount paid</div>
                                    <div className="text-zoru-ink">
                                        {fmtMoney(bill.amountPaid, currency)}
                                    </div>
                                </div>
                            )}
                            {typeof balance === 'number' && (
                                <div>
                                    <div className="text-zoru-ink-muted">Balance</div>
                                    <div className="text-zoru-ink">{fmtMoney(balance, currency)}</div>
                                </div>
                            )}
                        </div>

                        {items.length > 0 && (
                            <div className="mt-6 overflow-x-auto rounded-lg border border-zoru-line">
                                <table className="w-full text-sm">
                                    <thead className="bg-zoru-surface-2">
                                        <tr className="border-b border-zoru-line">
                                            <th className="p-3 text-left text-zoru-ink">Item</th>
                                            <th className="p-3 text-right text-zoru-ink">Qty</th>
                                            <th className="p-3 text-right text-zoru-ink">Rate</th>
                                            <th className="p-3 text-right text-zoru-ink">Amount</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {items.map((it, idx) => (
                                            <tr
                                                key={`${(it.itemId as any)?.toString?.() ?? idx}-${idx}`}
                                                className="border-b border-zoru-line last:border-b-0"
                                            >
                                                <td className="p-3 text-zoru-ink">
                                                    {(it.itemId as any)?.toString?.() ?? '—'}
                                                </td>
                                                <td className="p-3 text-right text-zoru-ink">{it.qty}</td>
                                                <td className="p-3 text-right text-zoru-ink">
                                                    {fmtMoney(it.rate, currency)}
                                                </td>
                                                <td className="p-3 text-right text-zoru-ink">
                                                    {fmtMoney(it.total ?? (it.qty || 0) * (it.rate || 0), currency)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {expenseLines.length > 0 && (
                            <div className="mt-6 overflow-x-auto rounded-lg border border-zoru-line">
                                <table className="w-full text-sm">
                                    <thead className="bg-zoru-surface-2">
                                        <tr className="border-b border-zoru-line">
                                            <th className="p-3 text-left text-zoru-ink">Account</th>
                                            <th className="p-3 text-left text-zoru-ink">Description</th>
                                            <th className="p-3 text-right text-zoru-ink">Amount</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {expenseLines.map((el, idx) => (
                                            <tr
                                                key={`${(el.accountId as any)?.toString?.() ?? idx}-${idx}`}
                                                className="border-b border-zoru-line last:border-b-0"
                                            >
                                                <td className="p-3 text-zoru-ink">
                                                    {(el.accountId as any)?.toString?.() ?? '—'}
                                                </td>
                                                <td className="p-3 text-zoru-ink">{el.description ?? '—'}</td>
                                                <td className="p-3 text-right text-zoru-ink">
                                                    {fmtMoney(el.amount, currency)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {/* Fallback: the simple expense shape stores a single
                            account/amount pair, not item or expense lines. */}
                        {items.length === 0 && expenseLines.length === 0 && bill.expenseAccount && (
                            <div className="mt-6 rounded-lg border border-zoru-line">
                                <table className="w-full text-sm">
                                    <thead className="bg-zoru-surface-2">
                                        <tr className="border-b border-zoru-line">
                                            <th className="p-3 text-left text-zoru-ink">Account</th>
                                            <th className="p-3 text-left text-zoru-ink">Description</th>
                                            <th className="p-3 text-right text-zoru-ink">Amount</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr>
                                            <td className="p-3 text-zoru-ink">{bill.expenseAccount}</td>
                                            <td className="p-3 text-zoru-ink">{bill.description ?? '—'}</td>
                                            <td className="p-3 text-right text-zoru-ink">
                                                {fmtMoney(bill.amount ?? 0, currency)}
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {bill.description && (
                            <div className="mt-4 rounded-md border border-zoru-line bg-zoru-surface-2 p-3">
                                <div className="text-[11.5px] text-zoru-ink-muted">Notes</div>
                                <div className="mt-1 whitespace-pre-wrap text-[13px] text-zoru-ink">
                                    {bill.description}
                                </div>
                            </div>
                        )}
                    </ZoruCard>

                    <div className="flex flex-wrap items-center gap-2">
                        <Link href={`/dashboard/crm/purchases/expenses?edit=${id}`}>
                            <ZoruButton variant="outline">Edit</ZoruButton>
                        </Link>
                        <Link
                            href={`/dashboard/crm/purchases/payouts/new?fromKind=bill&fromId=${id}`}
                        >
                            <ZoruButton variant="outline">+ Record Payout</ZoruButton>
                        </Link>
                        <Link
                            href={`/dashboard/crm/purchases/debit-notes/new?fromKind=bill&fromId=${id}`}
                        >
                            <ZoruButton variant="outline">+ Issue Debit Note</ZoruButton>
                        </Link>
                    </div>
                </div>

                <div className="flex flex-col gap-6">
                    <LineageRail
                        current={{
                            kind: 'bill',
                            id,
                            no: billNo,
                            status,
                        }}
                        lineage={bill.lineage ?? []}
                    />
                </div>
            </div>
        </div>
    );
}
