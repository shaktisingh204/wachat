import { Button, Card, Table, ZoruTableBody, ZoruTableCell, ZoruTableHead, ZoruTableHeader, ZoruTableRow } from '@/components/zoruui';
import {
  notFound } from 'next/navigation';
import { Edit,
  FileText,
  Printer,
  Archive,
  History,
  Plus,
  Download } from 'lucide-react';

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

    const flattenedRecent = recent.map(entry => {
        let debit = 0;
        let credit = 0;
        for (const d of entry.debitEntries) {
            if (d.accountId.toString() === accountIdStr) debit += d.amount;
        }
        for (const c of entry.creditEntries) {
            if (c.accountId.toString() === accountIdStr) credit += c.amount;
        }
        return {
            _id: entry._id.toString(),
            date: new Date(entry.date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }),
            voucherNumber: entry.voucherNumber,
            note: entry.note,
            debit,
            credit
        };
    });

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
                    <Button asChild variant="outline" size="sm">
                        <Link href={`/dashboard/crm/accounting/charts/${accountIdStr}/edit`}>
                            <Edit className="mr-1.5 h-3.5 w-3.5" /> Edit
                        </Link>
                    </Button>
                    <Button asChild variant="outline" size="sm">
                        <Link href={`/dashboard/crm/accounting/day-book?accountId=${accountIdStr}`}>
                            <FileText className="mr-1.5 h-3.5 w-3.5" /> View ledger
                        </Link>
                    </Button>
                    <Button asChild variant="outline" size="sm">
                        <Link href={`/api/pdf/account-ledger/${accountIdStr}`} target="_blank">
                            <Printer className="mr-1.5 h-3.5 w-3.5" /> Print
                        </Link>
                    </Button>
                    <Button asChild variant="outline" size="sm">
                        <a href={`/api/pdf/account-ledger/${accountIdStr}?download=true`} download>
                            <Download className="mr-1.5 h-3.5 w-3.5" /> Export PDF
                        </a>
                    </Button>
                    <Button asChild variant="outline" size="sm">
                        <Link href={`/dashboard/crm/accounting/charts/${accountIdStr}/activity`}>
                            <History className="mr-1.5 h-3.5 w-3.5" /> Activity
                        </Link>
                    </Button>
                    <Button variant="outline" size="sm" disabled>
                        <Archive className="mr-1.5 h-3.5 w-3.5" /> Archive
                    </Button>
                    <Button asChild size="sm">
                        <Link href="/dashboard/crm/accounting/vouchers/new?mode=entry">
                            <Plus className="mr-1.5 h-3.5 w-3.5" /> New voucher
                        </Link>
                    </Button>
                </div>
            }
            rightRail={
                <div className="flex flex-col gap-4">
                    <Card className="p-4">
                        <p className="text-[12px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
                            Snapshot
                        </p>
                        <dl className="mt-2 space-y-1.5 text-[13px]">
                            <div className="flex justify-between gap-3">
                                <dt className="text-zoru-ink-muted">Nature</dt>
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
                                <dt className="text-zoru-ink-muted">Sub-nature</dt>
                                <dd className="text-right">{subNatureRaw.replace(/_/g, ' ') || '—'}</dd>
                            </div>
                            <div className="flex justify-between gap-3">
                                <dt className="text-zoru-ink-muted">Parent group</dt>
                                <dd className="text-right">{groupName || '—'}</dd>
                            </div>
                            <div className="flex justify-between gap-3">
                                <dt className="text-zoru-ink-muted">Currency</dt>
                                <dd className="font-mono">{account.currency}</dd>
                            </div>
                        </dl>
                    </Card>
                    <Card className="p-4">
                        <p className="text-[12px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
                            Related
                        </p>
                        <ul className="mt-2 space-y-1.5 text-[13px]">
                            <li>
                                <Link
                                    href={`/dashboard/crm/accounting/groups`}
                                    className="text-zoru-ink hover:underline"
                                >
                                    Account groups
                                </Link>
                            </li>
                            <li>
                                <Link
                                    href="/dashboard/crm/accounting/vouchers"
                                    className="text-zoru-ink hover:underline"
                                >
                                    Voucher books
                                </Link>
                            </li>
                            <li>
                                <Link
                                    href="/dashboard/crm/accounting/trial-balance"
                                    className="text-zoru-ink hover:underline"
                                >
                                    Trial balance
                                </Link>
                            </li>
                        </ul>
                    </Card>
                </div>
            }
            audit={<EntityAuditTimeline entityKind="chart_of_account" entityId={accountIdStr} />}
        >
            <div className="flex flex-col gap-4">
                {/* Balance summary */}
                <Card>
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
                </Card>

                {account.description ? (
                    <Card>
                        <p className="text-[12px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
                            Description
                        </p>
                        <p className="mt-1.5 whitespace-pre-wrap text-[13px] text-zoru-ink">
                            {account.description}
                        </p>
                    </Card>
                ) : null}

                <Card className="p-0">
                    <div className="px-4 py-3">
                        <p className="text-[13px] font-semibold text-zoru-ink">
                            Recent transactions ({recent.length})
                        </p>
                        <p className="text-[11.5px] text-zoru-ink-muted">
                            Last 50 voucher entries that touched this account.
                        </p>
                    </div>
                    <div className="overflow-x-auto border-t border-zoru-line">
                        <Table>
                            <ZoruTableHeader>
                                <ZoruTableRow className="border-zoru-line hover:bg-transparent">
                                    <ZoruTableHead className="text-zoru-ink-muted">Date</ZoruTableHead>
                                    <ZoruTableHead className="text-zoru-ink-muted">Voucher #</ZoruTableHead>
                                    <ZoruTableHead className="text-zoru-ink-muted">Note</ZoruTableHead>
                                    <ZoruTableHead className="text-right text-zoru-ink-muted">Debit</ZoruTableHead>
                                    <ZoruTableHead className="text-right text-zoru-ink-muted">Credit</ZoruTableHead>
                                </ZoruTableRow>
                            </ZoruTableHeader>
                            <ZoruTableBody>
                                {flattenedRecent.length === 0 ? (
                                    <ZoruTableRow className="border-zoru-line">
                                        <ZoruTableCell colSpan={5} className="h-24 text-center text-zoru-ink-muted">
                                            No transactions posted yet.
                                        </ZoruTableCell>
                                    </ZoruTableRow>
                                ) : (
                                    flattenedRecent.map((entry) => {
                                        return (
                                            <ZoruTableRow key={entry._id} className="border-zoru-line">
                                                <ZoruTableCell className="text-zoru-ink">
                                                    {entry.date}
                                                </ZoruTableCell>
                                                <ZoruTableCell className="font-mono text-[12px] text-zoru-ink">
                                                    {entry.voucherNumber}
                                                </ZoruTableCell>
                                                <ZoruTableCell className="text-[12px] text-zoru-ink-muted">
                                                    {entry.note}
                                                </ZoruTableCell>
                                                <ZoruTableCell className="text-right font-mono text-zoru-ink">
                                                    {entry.debit > 0 ? fmtMoney(entry.debit, account.currency) : '—'}
                                                </ZoruTableCell>
                                                <ZoruTableCell className="text-right font-mono text-zoru-ink">
                                                    {entry.credit > 0 ? fmtMoney(entry.credit, account.currency) : '—'}
                                                </ZoruTableCell>
                                            </ZoruTableRow>
                                        );
                                    })
                                )}
                            </ZoruTableBody>
                        </Table>
                    </div>
                </Card>
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
                'rounded-lg border border-zoru-line p-3',
                accent ? 'bg-zoru-surface-2' : 'bg-zoru-surface-2',
            ].join(' ')}
        >
            <p className="text-[11.5px] text-zoru-ink-muted">{label}</p>
            <p className="mt-1 text-[18px] font-semibold text-zoru-ink">
                {fmtMoney(value, currency)}
            </p>
            <p className="text-[11px] font-mono text-zoru-ink-muted">{type}</p>
        </div>
    );
}
