import { Button, Card, Table, ZoruTableBody, ZoruTableCell, ZoruTableHead, ZoruTableHeader, ZoruTableRow } from '@/components/zoruui';
import {
  notFound } from 'next/navigation';
import { Edit,
  FileText,
  Printer,
  Archive,
  History,
  Plus } from 'lucide-react';

import Link from 'next/link';

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { StatusPill, type StatusTone } from '@/components/crm/status-pill';

import {
    getCrmChartOfAccountById,
    getVoucherEntriesForAccount,
} from '@/app/actions/crm-accounting.actions';
import { EntityAuditTimeline } from '@/components/crm/entity-audit-timeline';

function fmtMoney(value: number, currency = 'INR'): string {
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

const NATURE_TONE: Record<string, StatusTone> = {
    Asset: 'green',
    Liability: 'red',
    Income: 'blue',
    Expense: 'amber',
    Capital: 'neutral',
};

export default async function ChartOfAccountDetailPage(props: {
    params: Promise<{ accountId: string }>;
}) {
    const { accountId } = await props.params;
    const account = await getCrmChartOfAccountById(accountId);
    if (!account) notFound();

    // Pull last 50 voucher entries that touched this account, all-time.
    const entries = await getVoucherEntriesForAccount(accountId);

    const openingBalance = account.balanceType === 'Cr' ? -(account.openingBalance || 0) : (account.openingBalance || 0);
    let totalDebit = 0;
    let totalCredit = 0;
    for (const entry of entries) {
        for (const d of entry.debitEntries) {
            if (d.accountId.toString() === account._id.toString()) totalDebit += d.amount;
        }
        for (const c of entry.creditEntries) {
            if (c.accountId.toString() === account._id.toString()) totalCredit += c.amount;
        }
    }
    const currentBalance = openingBalance + totalDebit - totalCredit;
    const currentType = currentBalance >= 0 ? 'Dr' : 'Cr';
    const natureRaw = (account as { accountGroupType?: string }).accountGroupType ?? '';
    const subNatureRaw = (account as { accountGroupCategory?: string }).accountGroupCategory ?? '';
    const groupName = (account as { accountGroupName?: string }).accountGroupName ?? '';

    const accountIdStr = account._id.toString();
    const recent = entries.slice(-50).reverse();

    return (
        <EntityDetailShell
            back={{ href: '/dashboard/crm/accounting/charts', label: 'Back to Chart of Accounts' }}
            eyebrow="CHART OF ACCOUNT"
            title={account.name}
            status={{
                label: account.status,
                tone: account.status === 'Active' ? 'green' : 'neutral',
            }}
            actions={
                <div className="flex flex-wrap items-center gap-2">
                    <ZoruButton asChild variant="outline" size="sm">
                        <Link href={`/dashboard/crm/accounting/charts/${accountIdStr}/edit`}>
                            <Edit className="mr-1.5 h-3.5 w-3.5" /> Edit
                        </Link>
                    </ZoruButton>
                    <ZoruButton asChild variant="outline" size="sm">
                        <Link href={`/dashboard/crm/accounting/day-book?accountId=${accountIdStr}`}>
                            <FileText className="mr-1.5 h-3.5 w-3.5" /> View ledger
                        </Link>
                    </ZoruButton>
                    <ZoruButton asChild variant="outline" size="sm">
                        <Link href={`/dashboard/crm/accounting/charts/${accountIdStr}?print=1`}>
                            <Printer className="mr-1.5 h-3.5 w-3.5" /> Print
                        </Link>
                    </ZoruButton>
                    <ZoruButton asChild variant="outline" size="sm">
                        <Link href={`/dashboard/crm/accounting/charts/${accountIdStr}/activity`}>
                            <History className="mr-1.5 h-3.5 w-3.5" /> Activity
                        </Link>
                    </ZoruButton>
                    <ZoruButton variant="outline" size="sm" disabled>
                        <Archive className="mr-1.5 h-3.5 w-3.5" /> Archive
                    </ZoruButton>
                    <ZoruButton asChild size="sm">
                        <Link href="/dashboard/crm/accounting/vouchers/new?mode=entry">
                            <Plus className="mr-1.5 h-3.5 w-3.5" /> New voucher
                        </Link>
                    </ZoruButton>
                </div>
            }
            rightRail={
                <div className="flex flex-col gap-4">
                    <ZoruCard className="p-4">
                        <p className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
                            Snapshot
                        </p>
                        <dl className="mt-2 space-y-1.5 text-[13px]">
                            <div className="flex justify-between gap-3">
                                <dt className="text-muted-foreground">Nature</dt>
                                <dd>
                                    {natureRaw ? (
                                        <StatusPill
                                            label={natureRaw}
                                            tone={NATURE_TONE[natureRaw] ?? 'neutral'}
                                        />
                                    ) : (
                                        '—'
                                    )}
                                </dd>
                            </div>
                            <div className="flex justify-between gap-3">
                                <dt className="text-muted-foreground">Sub-nature</dt>
                                <dd className="text-right">{subNatureRaw.replace(/_/g, ' ') || '—'}</dd>
                            </div>
                            <div className="flex justify-between gap-3">
                                <dt className="text-muted-foreground">Parent group</dt>
                                <dd className="text-right">{groupName || '—'}</dd>
                            </div>
                            <div className="flex justify-between gap-3">
                                <dt className="text-muted-foreground">Currency</dt>
                                <dd className="font-mono">{account.currency}</dd>
                            </div>
                        </dl>
                    </ZoruCard>
                    <ZoruCard className="p-4">
                        <p className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
                            Related
                        </p>
                        <ul className="mt-2 space-y-1.5 text-[13px]">
                            <li>
                                <Link
                                    href={`/dashboard/crm/accounting/groups`}
                                    className="text-accent-foreground hover:underline"
                                >
                                    Account groups
                                </Link>
                            </li>
                            <li>
                                <Link
                                    href="/dashboard/crm/accounting/vouchers"
                                    className="text-accent-foreground hover:underline"
                                >
                                    Voucher books
                                </Link>
                            </li>
                            <li>
                                <Link
                                    href="/dashboard/crm/accounting/trial-balance"
                                    className="text-accent-foreground hover:underline"
                                >
                                    Trial balance
                                </Link>
                            </li>
                        </ul>
                    </ZoruCard>
                </div>
            }
            audit={<EntityAuditTimeline entityKind="chart_of_account" entityId={accountIdStr} />}
        >
            <div className="flex flex-col gap-4">
                {/* Balance summary */}
                <ZoruCard>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                        <SummaryCell label="Opening balance" value={account.openingBalance} type={account.balanceType} currency={account.currency} />
                        <SummaryCell label="Total debit" value={totalDebit} type="Dr" currency={account.currency} />
                        <SummaryCell label="Total credit" value={totalCredit} type="Cr" currency={account.currency} />
                        <SummaryCell
                            label="Current balance"
                            value={Math.abs(currentBalance)}
                            type={currentType}
                            currency={account.currency}
                            accent
                        />
                    </div>
                </ZoruCard>

                {account.description ? (
                    <ZoruCard>
                        <p className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
                            Description
                        </p>
                        <p className="mt-1.5 whitespace-pre-wrap text-[13px] text-foreground">
                            {account.description}
                        </p>
                    </ZoruCard>
                ) : null}

                <ZoruCard className="p-0">
                    <div className="px-4 py-3">
                        <p className="text-[13px] font-semibold text-foreground">
                            Recent transactions ({recent.length})
                        </p>
                        <p className="text-[11.5px] text-muted-foreground">
                            Last 50 voucher entries that touched this account.
                        </p>
                    </div>
                    <div className="overflow-x-auto border-t border-border">
                        <ZoruTable>
                            <ZoruTableHeader>
                                <ZoruTableRow className="border-border hover:bg-transparent">
                                    <ZoruTableHead className="text-muted-foreground">Date</ZoruTableHead>
                                    <ZoruTableHead className="text-muted-foreground">Voucher #</ZoruTableHead>
                                    <ZoruTableHead className="text-muted-foreground">Note</ZoruTableHead>
                                    <ZoruTableHead className="text-right text-muted-foreground">Debit</ZoruTableHead>
                                    <ZoruTableHead className="text-right text-muted-foreground">Credit</ZoruTableHead>
                                </ZoruTableRow>
                            </ZoruTableHeader>
                            <ZoruTableBody>
                                {recent.length === 0 ? (
                                    <ZoruTableRow className="border-border">
                                        <ZoruTableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                                            No transactions posted yet.
                                        </ZoruTableCell>
                                    </ZoruTableRow>
                                ) : (
                                    recent.map((entry) => {
                                        const debit = entry.debitEntries.find(
                                            (d: { accountId: { toString: () => string }; amount: number }) =>
                                                d.accountId.toString() === accountIdStr,
                                        )?.amount ?? 0;
                                        const credit = entry.creditEntries.find(
                                            (c: { accountId: { toString: () => string }; amount: number }) =>
                                                c.accountId.toString() === accountIdStr,
                                        )?.amount ?? 0;
                                        return (
                                            <ZoruTableRow key={entry._id.toString()} className="border-border">
                                                <ZoruTableCell className="text-foreground">
                                                    {new Date(entry.date).toLocaleDateString()}
                                                </ZoruTableCell>
                                                <ZoruTableCell className="font-mono text-[12px] text-foreground">
                                                    {entry.voucherNumber}
                                                </ZoruTableCell>
                                                <ZoruTableCell className="text-[12px] text-muted-foreground">
                                                    {entry.note}
                                                </ZoruTableCell>
                                                <ZoruTableCell className="text-right font-mono text-foreground">
                                                    {debit > 0 ? fmtMoney(debit, account.currency) : '—'}
                                                </ZoruTableCell>
                                                <ZoruTableCell className="text-right font-mono text-foreground">
                                                    {credit > 0 ? fmtMoney(credit, account.currency) : '—'}
                                                </ZoruTableCell>
                                            </ZoruTableRow>
                                        );
                                    })
                                )}
                            </ZoruTableBody>
                        </ZoruTable>
                    </div>
                </ZoruCard>
            </div>
        </EntityDetailShell>
    );
}

interface SummaryCellProps {
    label: string;
    value: number;
    type: 'Dr' | 'Cr';
    currency: string;
    accent?: boolean;
}

function SummaryCell({ label, value, type, currency, accent }: SummaryCellProps) {
    return (
        <div
            className={[
                'rounded-lg border border-border p-3',
                accent ? 'bg-zoru-surface-2' : 'bg-secondary',
            ].join(' ')}
        >
            <p className="text-[11.5px] text-muted-foreground">{label}</p>
            <p className="mt-1 text-[18px] font-semibold text-foreground">
                {fmtMoney(value, currency)}
            </p>
            <p className="text-[11px] font-mono text-muted-foreground">{type}</p>
        </div>
    );
}
