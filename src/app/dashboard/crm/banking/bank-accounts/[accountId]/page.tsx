import { Button, Card } from '@/components/zoruui';
import {
  notFound,
  redirect } from 'next/navigation';
import {
  ArrowLeftRight,
  Edit,
  FileText,
  RotateCw,
  } from 'lucide-react';

/**
 * Bank Account detail — server component scoped to `accountType === 'bank'`.
 *
 * Renders bank-specific fields prominently (bank name, masked account
 * number, IFSC, SWIFT, IBAN) and links to ledger + reconciliation. We
 * reuse the same `getCrmPaymentAccountById` server action as `/all/[id]`.
 */

import Link from 'next/link';

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { StatusPill } from '@/components/crm/status-pill';

import { getCrmPaymentAccountById } from '@/app/actions/crm-payment-accounts.actions';
import { getSession } from '@/app/actions/user.actions';

export const dynamic = 'force-dynamic';

const BASE = '/dashboard/crm/banking/bank-accounts';

function mask(account?: string): string {
    if (!account) return '—';
    const trimmed = account.replace(/\s+/g, '');
    if (trimmed.length <= 4) return trimmed;
    return `••••${trimmed.slice(-4)}`;
}

function fmtMoney(value: number, currency: string): string {
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

export default async function BankAccountDetailPage({
    params,
}: {
    params: Promise<{ accountId: string }>;
}) {
    const { accountId } = await params;

    const session = await getSession();
    if (!session?.user) redirect('/login');

    const account = await getCrmPaymentAccountById(accountId);
    if (!account) notFound();
    // If somebody opens a non-bank account at this URL, redirect to /all.
    if (account.accountType !== 'bank') {
        redirect(`/dashboard/crm/banking/all/${accountId}`);
    }

    const balance =
        (account as { currentBalance?: number }).currentBalance ?? account.openingBalance;

    return (
        <EntityDetailShell
            eyebrow="BANK ACCOUNT"
            title={account.accountName}
            back={{ href: BASE, label: 'Bank Accounts' }}
            actions={
                <div className="flex flex-wrap items-center gap-2">
                    <Button variant="outline" asChild>
                        <Link
                            href={`/dashboard/crm/banking/bank-transactions?accountId=${accountId}`}
                        >
                            <ArrowLeftRight className="mr-1.5 h-3.5 w-3.5" /> Transactions
                        </Link>
                    </Button>
                    <Button variant="outline" asChild>
                        <Link href="/dashboard/crm/banking/reconciliation">
                            <RotateCw className="mr-1.5 h-3.5 w-3.5" /> Reconcile
                        </Link>
                    </Button>
                    <Button asChild>
                        <Link href={`${BASE}/${accountId}/edit`}>
                            <Edit className="mr-1.5 h-3.5 w-3.5" /> Edit
                        </Link>
                    </Button>
                </div>
            }
        >

            {/* Balance card */}
            <Card className="p-6">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    <BalanceCell
                        label="Current balance"
                        value={fmtMoney(balance, account.currency)}
                        accent
                    />
                    <BalanceCell
                        label="Opening balance"
                        value={fmtMoney(account.openingBalance, account.currency)}
                    />
                    <BalanceCell
                        label="As of"
                        value={
                            account.openingBalanceDate
                                ? new Date(account.openingBalanceDate).toLocaleDateString()
                                : '—'
                        }
                    />
                </div>
            </Card>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {/* Bank details */}
                <Card className="p-5">
                    <p className="mb-3 text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Bank details
                    </p>
                    <dl className="space-y-2 text-[13px]">
                        <Row label="Bank" value={account.bankDetails?.bankName || '—'} />
                        <Row label="Holder" value={account.bankDetails?.accountHolder || '—'} />
                        <Row
                            label="Account no"
                            value={mask(account.bankDetails?.accountNumber)}
                            mono
                        />
                        <Row label="IFSC" value={account.bankDetails?.ifsc || '—'} mono />
                        <Row
                            label="Type"
                            value={account.bankDetails?.accountType || '—'}
                            capitalize
                        />
                        <Row label="SWIFT" value={account.bankDetails?.swiftCode || '—'} mono />
                        <Row label="IBAN" value={account.bankDetails?.ibanCode || '—'} mono />
                    </dl>
                </Card>

                {/* Meta */}
                <Card className="p-5">
                    <p className="mb-3 text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Account
                    </p>
                    <dl className="space-y-2 text-[13px]">
                        <Row label="Type" value={account.accountType} capitalize />
                        <Row label="Currency" value={account.currency} mono />
                        <Row
                            label="Status"
                            value={
                                <StatusPill
                                    label={account.status}
                                    tone={account.status === 'active' ? 'green' : 'neutral'}
                                />
                            }
                        />
                        <Row
                            label="Default"
                            value={
                                account.isDefault ? (
                                    <StatusPill label="Default" tone="blue" />
                                ) : (
                                    <span className="text-[12px] text-muted-foreground">No</span>
                                )
                            }
                        />
                    </dl>
                </Card>
            </div>

            <Card className="p-4">
                <p className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Linked ledger
                </p>
                <p className="mt-1 text-[13px] text-muted-foreground">
                    Posted vouchers flow into the chart-of-account ledger.{' '}
                    <Link
                        href={`/dashboard/crm/accounting/day-book?accountId=${accountId}`}
                        className="inline-flex items-center gap-1 text-foreground hover:underline"
                    >
                        <FileText className="h-3 w-3" /> View ledger
                    </Link>
                </p>
            </Card>
        </EntityDetailShell>
    );
}

function BalanceCell({
    label,
    value,
    accent,
}: {
    label: string;
    value: string;
    accent?: boolean;
}) {
    return (
        <div
            className={[
                'rounded-lg border border-border p-3',
                accent ? 'bg-zoru-surface-2' : 'bg-secondary',
            ].join(' ')}
        >
            <p className="text-[11.5px] text-muted-foreground">{label}</p>
            <p className="mt-1 text-[18px] font-semibold text-foreground">{value}</p>
        </div>
    );
}

function Row({
    label,
    value,
    mono,
    capitalize,
}: {
    label: string;
    value: React.ReactNode;
    mono?: boolean;
    capitalize?: boolean;
}) {
    return (
        <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">{label}</dt>
            <dd
                className={[
                    'text-right text-foreground',
                    mono ? 'font-mono' : '',
                    capitalize ? 'capitalize' : '',
                ]
                    .filter(Boolean)
                    .join(' ')}
            >
                {value}
            </dd>
        </div>
    );
}
