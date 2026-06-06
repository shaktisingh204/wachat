import { Suspense } from 'react';
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
    Plus,
    Sparkles,
    Globe,
    Zap,
} from 'lucide-react';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { Button, Skeleton, Card } from '@/components/sabcrm/20ui/compat';

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

const SMART_FEATURES = [
    {
        title: 'Bank Sync (Plaid)',
        description: 'Automatically fetch real-time transactions from connected institutions.',
        icon: Zap,
        action: 'Connect Bank',
    },
    {
        title: 'AI Auto-Reconciliation',
        description: 'Automatically match high-confidence statement lines with booked entries.',
        icon: Sparkles,
        action: 'Run Matcher',
    },
    {
        title: 'Multi-Currency Adjustments',
        description: 'Automated FX gain/loss entries based on real-time exchange rates.',
        icon: Globe,
        action: 'Review Rates',
    }
];

export default function CrmBankingHubPage() {
    return (
        <EntityListShell
            title="Banking"
            subtitle="Bank accounts, statements, and reconciliation against your books."
            primaryAction={
                <Button variant="default" className="gap-2">
                    <Plus className="h-4 w-4" />
                    Connect Bank
                </Button>
            }
        >
            <Suspense fallback={<BankingDashboardSkeleton />}>
                <BankingDashboardData />
            </Suspense>
        </EntityListShell>
    );
}

function BankingDashboardSkeleton() {
    return (
        <div className="flex flex-col gap-6" aria-hidden="true">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-32 w-full rounded-xl" />
                ))}
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-36 w-full rounded-xl" />
                ))}
            </div>
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                <div className="lg:col-span-2">
                    <Skeleton className="h-64 w-full rounded-xl" />
                </div>
                <div className="lg:col-span-1 flex flex-col gap-3">
                    {Array.from({ length: 3 }).map((_, i) => (
                        <Skeleton key={i} className="h-32 w-full rounded-xl" />
                    ))}
                </div>
            </div>
        </div>
    );
}

async function BankingDashboardData() {
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
            value: monthTxnCount.toLocaleString('en-US'),
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
            <span className={tx.type === 'credit' ? 'text-[var(--st-status-ok)]' : 'text-[var(--st-text)]'}>
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
        <div className="flex flex-col gap-6">
            <HubKpiGrid kpis={kpis} />
            
            <div className="flex flex-col gap-3">
                <h2 className="text-[14px] font-medium text-[var(--st-text)] px-1">Navigation</h2>
                <HubQuickLinkGrid links={QUICK_LINKS} />
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                <div className="lg:col-span-2">
                    <HubRecentList
                        title="Recent transactions"
                        rows={recentRows}
                        emptyHint="No bank transactions yet."
                        viewAllHref="/dashboard/crm/banking/bank-transactions"
                    />
                </div>
                
                <div className="flex flex-col gap-3 lg:col-span-1">
                    <h2 className="text-[14px] font-medium text-[var(--st-text)] px-1">Smart Features</h2>
                    {SMART_FEATURES.map((feat) => {
                        const Icon = feat.icon;
                        return (
                            <Card key={feat.title} className="p-4 flex flex-col gap-3">
                                <div className="flex items-start gap-3">
                                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--zoru-radius)] bg-[var(--st-bg-muted)] text-[var(--st-text)]">
                                        <Icon className="h-4 w-4" strokeWidth={2} />
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="text-[13px] font-medium text-[var(--st-text)]">
                                            {feat.title}
                                        </h3>
                                        <p className="mt-0.5 text-[12px] leading-relaxed text-[var(--st-text-secondary)]">
                                            {feat.description}
                                        </p>
                                    </div>
                                </div>
                                <Button variant="outline" size="sm" className="w-full text-[12px]">
                                    {feat.action}
                                </Button>
                            </Card>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
