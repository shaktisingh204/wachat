import {
    BookOpen,
    CalendarDays,
    DollarSign,
    FileBarChart,
    FileSpreadsheet,
    LineChart,
    Scale,
    ScrollText,
    TrendingDown,
    TrendingUp,
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
    formatCurrency,
    formatDate,
    recentByUser,
    startOfMonth,
    sumByUser,
} from '../_components/hub-data';
import { AccountingHubActions } from './_components/accounting-actions';

export const dynamic = 'force-dynamic';

interface JournalDoc {
    _id: string;
    reference?: string;
    description?: string;
    amount?: number;
    total?: number;
    entryDate?: string;
    createdAt?: string;
}

const QUICK_LINKS: HubQuickLink[] = [
    { href: '/dashboard/crm/accounting/charts', title: 'Chart of Accounts', description: 'Your accounting tree — every ledger account you post to.', icon: BookOpen },
    { href: '/dashboard/crm/accounting/groups', title: 'Account Groups', description: 'Group accounts by category for cleaner reports.', icon: FileSpreadsheet },
    { href: '/dashboard/crm/accounting/vouchers', title: 'Vouchers', description: 'Manual journal entries and accounting vouchers.', icon: ScrollText },
    { href: '/dashboard/crm/accounting/day-book', title: 'Day Book', description: 'Chronological log of every accounting entry.', icon: CalendarDays },
    { href: '/dashboard/crm/accounting/trial-balance', title: 'Trial Balance', description: 'Debit/credit summary across every account.', icon: Scale },
    { href: '/dashboard/crm/accounting/pnl', title: 'Profit & Loss', description: 'Income vs expense over a period.', icon: TrendingUp },
    { href: '/dashboard/crm/accounting/income-statement', title: 'Income Statement', description: 'Detailed P&L by account class.', icon: LineChart },
    { href: '/dashboard/crm/accounting/balance-sheet', title: 'Balance Sheet', description: 'Assets, liabilities, and equity at a point in time.', icon: FileBarChart },
    { href: '/dashboard/crm/accounting/cash-flow', title: 'Cash Flow', description: 'Cash movements across operating, investing, financing.', icon: Wallet },
];

export default async function CrmAccountingHubPage() {
    const monthStart = startOfMonth();

    const [revenueMtd, expensesMtd, paymentsReceived, arOutstanding, recentJournals] = await Promise.all([
        sumByUser('crm_invoices', 'totalAmount', { invoiceDate: { $gte: monthStart } }),
        sumByUser('crm_expenses', 'amount', { date: { $gte: monthStart } }),
        sumByUser('crm_payment_receipts', 'amount', { receiptDate: { $gte: monthStart } }),
        sumByUser('crm_invoices', 'balanceDue', { status: { $in: ['sent', 'partial', 'overdue'] } }),
        recentByUser<JournalDoc>('crm_journal_vouchers', { sortField: 'entryDate', limit: 5 }),
    ]);

    const netPnL = revenueMtd - expensesMtd;

    const kpis: HubKpi[] = [
        {
            label: 'Revenue (MTD)',
            value: formatCurrency(revenueMtd),
            icon: DollarSign,
            tone: 'success',
            href: '/dashboard/crm/accounting/pnl',
        },
        {
            label: 'Expenses (MTD)',
            value: formatCurrency(expensesMtd),
            icon: TrendingDown,
            href: '/dashboard/crm/accounting/pnl',
        },
        {
            label: 'Net P&L (MTD)',
            value: formatCurrency(netPnL),
            icon: netPnL >= 0 ? TrendingUp : TrendingDown,
            tone: netPnL >= 0 ? 'success' : 'danger',
            hint: `Payments in: ${formatCurrency(paymentsReceived)}`,
            href: '/dashboard/crm/accounting/income-statement',
        },
        {
            label: 'AR Outstanding',
            value: formatCurrency(arOutstanding),
            icon: Wallet,
            tone: arOutstanding > 0 ? 'warning' : 'default',
            href: '/dashboard/crm/sales/invoices?status=overdue',
        },
    ];

    const recentRows: HubRecentRow[] = recentJournals.map((j) => ({
        id: String(j._id),
        primary: j.reference || j.description || 'Journal voucher',
        secondary: formatDate(j.entryDate || j.createdAt),
        trailing: formatCurrency(j.total ?? j.amount ?? 0),
        href: `/dashboard/crm/accounting/vouchers/${j._id}`,
    }));

    return (
        <EntityListShell
            title="Accounting"
            subtitle="Books, vouchers, and the four primary financial reports."
            primaryAction={<AccountingHubActions />}
        >
            <div className="flex flex-col gap-6">
                <HubKpiGrid kpis={kpis} />
                <HubQuickLinkGrid links={QUICK_LINKS} />
                <HubRecentList
                    title="Recent journal entries"
                    rows={recentRows}
                    emptyHint="No journal entries yet."
                    viewAllHref="/dashboard/crm/accounting/day-book"
                />
            </div>
        </EntityListShell>
    );
}
