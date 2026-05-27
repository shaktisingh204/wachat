import { Card } from '@/components/zoruui';
import {
  notFound,
  redirect } from 'next/navigation';
import {
    ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  CheckCircle2,
  FileText,
  Paperclip,
  } from 'lucide-react';

/**
 * Bank Transaction detail page (server component).
 *
 * Shows the full transaction record, linked payment account, optional
 * voucher entry link, source statement file, and inline status actions.
 * Manual edits aren't supported — transactions are immutable once posted
 * (you can only change `status` via the actions on this page).
 */

import Link from 'next/link';

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { StatusPill, type StatusTone } from '@/components/crm/status-pill';

import { getSession } from '@/app/actions/user.actions';
import {
    getCrmBankTransactionById,
    type CrmBankTransactionStatus,
} from '@/app/actions/crm-bank-transactions.actions';

import { BankTransactionStatusActions } from '../_components/bank-transaction-status-actions';

export const dynamic = 'force-dynamic';

const BASE = '/dashboard/crm/banking/bank-transactions';

const STATUS_TONE: Record<CrmBankTransactionStatus, StatusTone> = {
    pending: 'amber',
    cleared: 'blue',
    reconciled: 'green',
    archived: 'neutral',
};

function fmtMoney(value: number | undefined, currency = 'INR'): string {
    if (value == null) return '—';
    try {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency,
            maximumFractionDigits: 2,
        }).format(value);
    } catch {
        return `${currency} ${value.toFixed(2)}`;
    }
}

function fmtDate(value: string | undefined): string {
    if (!value) return '—';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '—';
    return new Intl.DateTimeFormat('en-IN', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    }).format(d);
}

export default async function BankTransactionDetailPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;

    const session = await getSession();
    if (!session?.user) redirect('/login');

    const tx = await getCrmBankTransactionById(id);
    if (!tx) notFound();

    const tone = STATUS_TONE[tx.status] ?? 'neutral';
    const isCredit = tx.type === 'credit';

    return (
        <EntityDetailShell
            eyebrow="BANK TRANSACTION"
            title={tx.description || 'Transaction'}
            back={{ href: BASE, label: 'Bank Transactions' }}
        >

            {/* Summary */}
            <Card className="p-6">
                <div className="mb-4 flex flex-wrap items-center gap-2">
                    <span className="text-[14px] font-medium text-zoru-ink">Overview</span>
                    <StatusPill label={tx.status} tone={tone} />
                    <span
                        className={[
                            'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11.5px] font-medium',
                            isCredit
                                ? 'bg-zoru-ink/10 text-zoru-ink'
                                : 'bg-zoru-ink/10 text-zoru-ink',
                        ].join(' ')}
                    >
                        {isCredit ? (
                            <ArrowDownLeft className="h-3 w-3" />
                        ) : (
                            <ArrowUpRight className="h-3 w-3" />
                        )}
                        {tx.type}
                    </span>
                </div>
                <div className="grid grid-cols-1 gap-x-6 gap-y-4 text-[13px] sm:grid-cols-2">
                    <div>
                        <div className="text-zoru-ink-muted">Account</div>
                        <div className="text-zoru-ink">
                            <Link
                                href={`/dashboard/crm/banking/all/${tx.accountId}`}
                                className="hover:underline"
                            >
                                {tx.accountName ?? `Account ${tx.accountId.slice(0, 8)}…`}
                            </Link>
                        </div>
                    </div>
                    <div>
                        <div className="text-zoru-ink-muted">Date</div>
                        <div className="text-zoru-ink">{fmtDate(tx.transactionDate)}</div>
                    </div>
                    <div>
                        <div className="text-zoru-ink-muted">Amount</div>
                        <div
                            className={[
                                'text-[18px] font-semibold',
                                isCredit ? 'text-zoru-ink' : 'text-zoru-ink',
                            ].join(' ')}
                        >
                            {isCredit ? '+' : '−'} {fmtMoney(tx.amount)}
                        </div>
                    </div>
                    <div>
                        <div className="text-zoru-ink-muted">Balance after</div>
                        <div className="font-mono text-zoru-ink">
                            {fmtMoney(tx.balanceAfter)}
                        </div>
                    </div>
                    <div>
                        <div className="text-zoru-ink-muted">Reference</div>
                        <div className="font-mono text-zoru-ink">
                            {tx.referenceNumber || '—'}
                        </div>
                    </div>
                    <div>
                        <div className="text-zoru-ink-muted">Category</div>
                        <div className="capitalize text-zoru-ink">{tx.category || '—'}</div>
                    </div>
                    {tx.description ? (
                        <div className="sm:col-span-2">
                            <div className="text-zoru-ink-muted">Description</div>
                            <div className="whitespace-pre-wrap text-zoru-ink">
                                {tx.description}
                            </div>
                        </div>
                    ) : null}
                </div>
            </Card>

            {/* Linked voucher */}
            {tx.voucherEntryId ? (
                <Card className="flex flex-wrap items-center justify-between gap-2 p-4">
                    <div className="flex items-center gap-2 text-[13px] text-zoru-ink">
                        <FileText className="h-4 w-4 text-zoru-ink-muted" />
                        Linked voucher entry
                    </div>
                    <Link
                        href={`/dashboard/crm/accounting/vouchers/${tx.voucherEntryId}`}
                        className="font-mono text-[12.5px] text-zoru-ink underline-offset-2 hover:underline"
                    >
                        {tx.voucherEntryId}
                    </Link>
                </Card>
            ) : null}

            {/* Source statement file (SabFile) */}
            {tx.sourceFileUrl ? (
                <Card className="flex flex-wrap items-center justify-between gap-2 p-4">
                    <div className="flex items-center gap-2 text-[13px] text-zoru-ink">
                        <Paperclip className="h-4 w-4 text-zoru-ink-muted" />
                        Source statement
                    </div>
                    <a
                        href={tx.sourceFileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="max-w-[420px] truncate text-[12.5px] text-zoru-ink underline-offset-2 hover:underline"
                    >
                        {tx.sourceFileUrl}
                    </a>
                </Card>
            ) : null}

            {/* Status actions */}
            <Card className="p-4">
                <div className="mb-2 flex items-center gap-2 text-[13px] text-zoru-ink">
                    <CheckCircle2 className="h-4 w-4 text-zoru-ink-muted" />
                    Status actions
                </div>
                <p className="mb-3 text-[12px] text-zoru-ink-muted">
                    Bank transactions are immutable once posted. You can only move them
                    between pending → cleared → reconciled, or archive a row.
                </p>
                <BankTransactionStatusActions id={tx._id} current={tx.status} />
            </Card>

            {/* Audit timestamps */}
            <Card className="p-4 text-[12px] text-zoru-ink-muted">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <span>Created {fmtDate(tx.createdAt)}</span>
                    <span>Updated {fmtDate(tx.updatedAt)}</span>
                </div>
            </Card>
        </EntityDetailShell>
    );
}
