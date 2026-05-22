import { Button, Card } from '@/components/zoruui';
import {
  notFound } from 'next/navigation';
import { Edit,
  History,
  Printer,
  Archive,
  RotateCw,
  ArrowLeftRight,
  FileText } from 'lucide-react';

import Link from 'next/link';

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { StatusPill } from '@/components/crm/status-pill';

import { getCrmPaymentAccountById } from '@/app/actions/crm-payment-accounts.actions';
import { EntityAuditTimeline } from '@/components/crm/entity-audit-timeline';

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

function mask(account?: string): string {
    if (!account) return '—';
    const trimmed = account.replace(/\s+/g, '');
    if (trimmed.length <= 4) return trimmed;
    return `••••${trimmed.slice(-4)}`;
}

export default async function PaymentAccountDetailPage(props: {
    params: Promise<{ accountId: string }>;
}) {
    const { accountId } = await props.params;
    const account = await getCrmPaymentAccountById(accountId);
    if (!account) notFound();

    const balance = (account as { currentBalance?: number }).currentBalance ?? account.openingBalance;

    return (
        <EntityDetailShell
            back={{ href: '/dashboard/crm/banking/all', label: 'Back to Banking' }}
            eyebrow={`PAYMENT ACCOUNT · ${account.accountType.toUpperCase()}`}
            title={account.accountName}
            status={{
                label: account.status,
                tone: account.status === 'active' ? 'green' : 'neutral',
            }}
            actions={
                <div className="flex flex-wrap items-center gap-2">
                    <Button asChild variant="outline" size="sm">
                        <Link href={`/dashboard/crm/banking/all/${accountId}/edit`}>
                            <Edit className="mr-1.5 h-3.5 w-3.5" /> Edit
                        </Link>
                    </Button>
                    <Button asChild variant="outline" size="sm">
                        <Link href="/dashboard/crm/banking/reconciliation">
                            <RotateCw className="mr-1.5 h-3.5 w-3.5" /> Reconcile
                        </Link>
                    </Button>
                    <Button asChild variant="outline" size="sm">
                        <Link href={`/dashboard/crm/banking/bank-transactions`}>
                            <ArrowLeftRight className="mr-1.5 h-3.5 w-3.5" /> Transactions
                        </Link>
                    </Button>
                    <Button variant="outline" size="sm" disabled>
                        <Archive className="mr-1.5 h-3.5 w-3.5" /> Archive
                    </Button>
                    <Button asChild variant="outline" size="sm">
                        <Link href={`/dashboard/crm/banking/all/${accountId}/activity`}>
                            <History className="mr-1.5 h-3.5 w-3.5" /> Activity
                        </Link>
                    </Button>
                    <Button asChild variant="outline" size="sm">
                        <Link href={`/dashboard/crm/banking/all/${accountId}?print=1`}>
                            <Printer className="mr-1.5 h-3.5 w-3.5" /> Print statement
                        </Link>
                    </Button>
                </div>
            }
            rightRail={
                <div className="flex flex-col gap-4">
                    <Card className="p-4">
                        <p className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
                            Account
                        </p>
                        <dl className="mt-2 space-y-1.5 text-[13px]">
                            <div className="flex justify-between gap-3">
                                <dt className="text-muted-foreground">Type</dt>
                                <dd className="capitalize">{account.accountType}</dd>
                            </div>
                            <div className="flex justify-between gap-3">
                                <dt className="text-muted-foreground">Currency</dt>
                                <dd className="font-mono">{account.currency}</dd>
                            </div>
                            <div className="flex justify-between gap-3">
                                <dt className="text-muted-foreground">Default</dt>
                                <dd>
                                    {account.isDefault ? (
                                        <StatusPill label="Default" tone="blue" />
                                    ) : (
                                        <span className="text-[12px] text-muted-foreground">No</span>
                                    )}
                                </dd>
                            </div>
                        </dl>
                    </Card>
                    {account.bankDetails ? (
                        <Card className="p-4">
                            <p className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
                                Bank details
                            </p>
                            <dl className="mt-2 space-y-1.5 text-[13px]">
                                <div className="flex justify-between gap-3">
                                    <dt className="text-muted-foreground">Bank</dt>
                                    <dd className="text-right">{account.bankDetails.bankName || '—'}</dd>
                                </div>
                                <div className="flex justify-between gap-3">
                                    <dt className="text-muted-foreground">Holder</dt>
                                    <dd className="text-right">{account.bankDetails.accountHolder || '—'}</dd>
                                </div>
                                <div className="flex justify-between gap-3">
                                    <dt className="text-muted-foreground">Account no</dt>
                                    <dd className="font-mono text-right">{mask(account.bankDetails.accountNumber)}</dd>
                                </div>
                                <div className="flex justify-between gap-3">
                                    <dt className="text-muted-foreground">IFSC</dt>
                                    <dd className="font-mono text-right">{account.bankDetails.ifsc || '—'}</dd>
                                </div>
                                <div className="flex justify-between gap-3">
                                    <dt className="text-muted-foreground">SWIFT</dt>
                                    <dd className="font-mono text-right">
                                        {account.bankDetails.swiftCode || '—'}
                                    </dd>
                                </div>
                                <div className="flex justify-between gap-3">
                                    <dt className="text-muted-foreground">IBAN</dt>
                                    <dd className="font-mono text-right">{account.bankDetails.ibanCode || '—'}</dd>
                                </div>
                            </dl>
                        </Card>
                    ) : null}
                </div>
            }
            audit={<EntityAuditTimeline entityKind="payment_account" entityId={accountId} />}
        >
            <div className="flex flex-col gap-4">
                <Card>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                        <SummaryCell label="Opening balance" value={fmtMoney(account.openingBalance, account.currency)} />
                        <SummaryCell label="Current balance" value={fmtMoney(balance, account.currency)} accent />
                        <SummaryCell
                            label="As of"
                            value={
                                account.openingBalanceDate
                                    ? new Date(account.openingBalanceDate).toLocaleDateString()
                                    : '—'
                            }
                        />
                    </div>
                </Card>
                <Card>
                    <p className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Linked ledger
                    </p>
                    <p className="mt-1 text-[13px] text-muted-foreground">
                        Posted vouchers using this payment account flow into the chart-of-account ledger.{' '}
                        <Link
                            href={`/dashboard/crm/accounting/day-book?accountId=${accountId}`}
                            className="text-accent-foreground hover:underline inline-flex items-center gap-1"
                        >
                            <FileText className="h-3 w-3" /> View ledger
                        </Link>
                    </p>
                </Card>
            </div>
        </EntityDetailShell>
    );
}

function SummaryCell({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
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
