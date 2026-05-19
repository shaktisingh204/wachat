import {
    ArrowDownLeft,
    ArrowUpRight,
    Banknote,
    CheckCircle2,
    Landmark,
    RefreshCcw,
    Repeat,
    UserCircle,
    Wallet,
} from 'lucide-react';

import { EntityListShell } from '@/components/crm/entity-list-shell';

import {
    HubKpiGrid,
    HubQuickLinkGrid,
    HubRecentList,
    type HubKpi,
    type HubQuickLink,
    type HubRecentRow,
} from '../_components/hub-kpi-grid';
import {
    countByUser,
    formatCurrency,
    formatDate,
    recentByUser,
    startOfMonth,
    sumByUser,
} from '../_components/hub-data';

export const dynamic = 'force-dynamic';

interface BankTxnDoc {
    _id: string;
    description?: string;
    amount?: number;
    type?: 'debit' | 'credit';
    status?: string;
    txnDate?: string;
    createdAt?: string;
}

const QUICK_LINKS: HubQuickLink[] = [
    { href: '/dashboard/crm/banking/all', title: 'All Banking', description: 'Combined view of every bank account and transaction.', icon: Banknote },
    { href: '/dashboard/crm/banking/bank-accounts', title: 'Bank Accounts', description: 'Company bank accounts and their balances.', icon: Landmark },
    { href: '/dashboard/crm/banking/bank-transactions', title: 'Bank Transactions', description: 'Statement transactions imported from your banks.', icon: Repeat },
    { href: '/dashboard/crm/banking/employee-accounts', title: 'Employee Accounts', description: 'Employee payout / reimbursement accounts.', icon: UserCircle },
    { href: '/dashboard/crm/banking/reconciliation', title: 'Reconciliation', description: 'Match statement lines against booked entries.', icon: RefreshCcw },
];

export default async function CrmBankingHubPage() {
    const monthStart = startOfMonth();

    const [totalBalance, accountsCount, monthTxnCount, reconciledCount, totalTxnCount, recentTxns] = await Promise.all([
        sumByUser('crm_bank_accounts', 'currentBalance'),
        countByUser('crm_bank_accounts'),
        countByUser('crm_bank_transactions', { txnDate: { $gte: monthStart } }),
        countByUser('crm_bank_transactions', { status: 'reconciled' }),
        countByUser('crm_bank_transactions'),
        recentByUser<BankTxnDoc>('crm_bank_transactions', {
            sortField: 'txnDate',
            limit: 5,
        }),
    ]);

    const reconciledPct = totalTxnCount > 0 ? Math.round((reconciledCount / totalTxnCount) * 100) : 0;

    const kpis: HubKpi[] = [
        {
            label: 'Total Balance',
            value: formatCurrency(totalBalance),
            icon: Wallet,
            hint: `Across ${accountsCount} account${accountsCount === 1 ? '' : 's'}`,
            href: '/dashboard/crm/banking/bank-accounts',
        },
        {
            label: 'Accounts',
            value: accountsCount,
            icon: Landmark,
            href: '/dashboard/crm/banking/bank-accounts',
        },
        {
            label: 'Txns This Month',
            value: monthTxnCount.toLocaleString(),
            icon: Repeat,
            href: '/dashboard/crm/banking/bank-transactions',
        },
        {
            label: 'Reconciled %',
            value: `${reconciledPct}%`,
            icon: CheckCircle2,
            tone: reconciledPct >= 80 ? 'success' : reconciledPct >= 40 ? 'warning' : 'danger',
            href: '/dashboard/crm/banking/reconciliation',
        },
    ];

    const recentRows: HubRecentRow[] = recentTxns.map((tx) => ({
        id: String(tx._id),
        primary: tx.description || 'Bank transaction',
        secondary: formatDate(tx.txnDate || tx.createdAt),
        trailing: (
            <span className={tx.type === 'credit' ? 'text-zoru-success-ink' : 'text-zoru-ink'}>
                {tx.type === 'credit' ? (
                    <ArrowDownLeft className="mr-1 inline h-3 w-3" />
                ) : (
                    <ArrowUpRight className="mr-1 inline h-3 w-3" />
                )}
                {formatCurrency(tx.amount ?? 0)}
            </span>
        ),
        href: `/dashboard/crm/banking/bank-transactions/${tx._id}`,
    }));

    return (
        <EntityListShell
            title="Banking"
            subtitle="Bank accounts, statements, and reconciliation against your books."
        >
            <div className="flex flex-col gap-6">
                <HubKpiGrid kpis={kpis} />
                <HubQuickLinkGrid links={QUICK_LINKS} />
                <HubRecentList
                    title="Recent transactions"
                    rows={recentRows}
                    emptyHint="No bank transactions yet."
                    viewAllHref="/dashboard/crm/banking/bank-transactions"
                />
            </div>
        </EntityListShell>
    );
}
