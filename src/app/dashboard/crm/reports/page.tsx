import {
    FileBarChart,
    Wallet,
    Receipt,
    TrendingUp,
    Calculator,
    Clock4,
    CreditCard,
    Target,
    ArrowRightLeft,
    Crown,
    Package,
    FolderKanban,
    ListChecks,
    AlertTriangle,
    CalendarDays,
    PlaneTakeoff,
    Timer,
    Scale,
    Cake,
    Ticket,
    UserCog,
    Banknote,
    Briefcase,
    Users,
    LifeBuoy,
    ScrollText,
    Activity,
    CalendarClock,
    Star,
    RefreshCw,
} from 'lucide-react';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { ReportKpiStrip } from '@/components/crm/report-shell';
import {
    getReportsHubOverview,
    getReportsHubRecentRuns,
} from '@/app/actions/crm-reports.actions';

import { ReportsHubClient, type ReportCategory } from './_components/reports-hub-client';

const finance = [
    {
        href: '/dashboard/crm/reports/income',
        label: 'Income',
        description: 'Revenue by period from paid invoices.',
        icon: Wallet,
    },
    {
        href: '/dashboard/crm/reports/expense',
        label: 'Expense',
        description: 'Expenses by period and category.',
        icon: Receipt,
    },
    {
        href: '/dashboard/crm/reports/profit-loss',
        label: 'Profit & Loss',
        description: 'Income minus expenses grouped by month.',
        icon: TrendingUp,
    },
    {
        href: '/dashboard/crm/reports/tax',
        label: 'Tax',
        description: 'Tax collected on invoices and paid on expenses.',
        icon: Calculator,
    },
    {
        href: '/dashboard/crm/reports/invoice-aging',
        label: 'Invoice Aging',
        description: 'Outstanding invoices by age buckets.',
        icon: Clock4,
    },
    {
        href: '/dashboard/crm/reports/payment-report',
        label: 'Payments',
        description: 'Payments by gateway/method.',
        icon: CreditCard,
    },
];

const sales = [
    {
        href: '/dashboard/crm/reports/sales-deals',
        label: 'Sales Deals',
        description: 'Deal conversion funnel by stage.',
        icon: Target,
    },
    {
        href: '/dashboard/crm/reports/leads-conversion',
        label: 'Leads Conversion',
        description: 'Conversion rate and average cycle time.',
        icon: ArrowRightLeft,
    },
    {
        href: '/dashboard/crm/reports/top-clients',
        label: 'Top Clients',
        description: 'Clients ranked by revenue.',
        icon: Crown,
    },
    {
        href: '/dashboard/crm/reports/top-products',
        label: 'Top Products',
        description: 'Products ranked by units & revenue.',
        icon: Package,
    },
];

const tasks = [
    {
        href: '/dashboard/crm/reports/project-status-report',
        label: 'Project Status',
        description: 'Projects grouped by status with completion %.',
        icon: FolderKanban,
    },
    {
        href: '/dashboard/crm/reports/task-report',
        label: 'Task Report',
        description: 'Tasks by assignee, status and priority.',
        icon: ListChecks,
    },
    {
        href: '/dashboard/crm/reports/overdue-tasks',
        label: 'Overdue Tasks',
        description: 'Tasks past their due date.',
        icon: AlertTriangle,
    },
];

const people = [
    {
        href: '/dashboard/crm/reports/attendance-report',
        label: 'Attendance',
        description: 'Employee attendance matrix by month.',
        icon: CalendarDays,
    },
    {
        href: '/dashboard/crm/reports/leave-report',
        label: 'Leaves',
        description: 'Leaves taken by employee and type.',
        icon: PlaneTakeoff,
    },
    {
        href: '/dashboard/crm/reports/late-report',
        label: 'Late Arrivals',
        description: 'Late arrivals by employee.',
        icon: Timer,
    },
    {
        href: '/dashboard/crm/reports/leave-balance-report',
        label: 'Leave Balance',
        description: 'Remaining balance per employee and type.',
        icon: Scale,
    },
    {
        href: '/dashboard/crm/reports/birthday-anniversary',
        label: 'Birthdays & Anniversaries',
        description: 'Upcoming birthdays and work anniversaries.',
        icon: Cake,
    },
];

const support = [
    {
        href: '/dashboard/crm/reports/ticket-report',
        label: 'Tickets',
        description: 'Tickets by status, channel, agent with SLA metrics.',
        icon: Ticket,
    },
    {
        href: '/dashboard/crm/reports/agent-performance',
        label: 'Agent Performance',
        description: 'Per-agent tickets closed and average resolution.',
        icon: UserCog,
    },
];

const gst = [
    {
        href: '/dashboard/crm/reports/gstr-1',
        label: 'GSTR-1',
        description: 'Outward supplies return — sales for the period.',
        icon: FileBarChart,
    },
    {
        href: '/dashboard/crm/reports/gstr-2b',
        label: 'GSTR-2B',
        description: 'Auto-drafted inward supplies return from vendors.',
        icon: FileBarChart,
    },
];

interface RawCategoryDef {
    id: string;
    title: string;
    icon: React.ElementType;
    items: typeof finance;
}

const rawCategories: RawCategoryDef[] = [
    { id: 'sales', title: 'Sales', icon: Briefcase, items: sales },
    { id: 'finance', title: 'Finance', icon: Banknote, items: finance },
    { id: 'tasks', title: 'Projects & Tasks', icon: FolderKanban, items: tasks },
    { id: 'people', title: 'People', icon: Users, items: people },
    { id: 'support', title: 'Support', icon: LifeBuoy, items: support },
    { id: 'gst', title: 'GST', icon: ScrollText, items: gst },
];

function fmtRel(iso: string | null): string {
    if (!iso) return 'Never';
    const t = new Date(iso).getTime();
    if (Number.isNaN(t)) return 'Unknown';
    const diff = Date.now() - t;
    const min = Math.round(diff / 60000);
    if (min < 1) return 'Just now';
    if (min < 60) return `${min}m ago`;
    const h = Math.round(min / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.round(h / 24);
    if (d < 7) return `${d}d ago`;
    return new Date(iso).toLocaleDateString();
}

export default async function ReportsOverviewPage() {
    const [overview, recentRuns] = await Promise.all([
        getReportsHubOverview(),
        getReportsHubRecentRuns(8),
    ]);

    const totalReports = rawCategories.reduce((sum, c) => sum + c.items.length, 0);

    const topViewedLabel = (() => {
        if (!overview.topViewedReportKind) return '—';
        for (const cat of rawCategories) {
            const hit = cat.items.find((i) => i.href.endsWith(`/${overview.topViewedReportKind}`));
            if (hit) return hit.label;
        }
        return overview.topViewedReportLabel ?? overview.topViewedReportKind;
    })();

    const categories: ReportCategory[] = rawCategories.map((cat) => {
        // Aggregate category-level "last refresh" across all item kinds.
        let lastRefreshAt: string | null = null;
        let runs = 0;
        for (const item of cat.items) {
            const kind = item.href.split('/').pop() ?? '';
            const stat = overview.categoryStats[kind];
            if (stat) {
                runs += stat.runs;
                if (
                    stat.lastRefreshAt &&
                    (!lastRefreshAt || new Date(stat.lastRefreshAt) > new Date(lastRefreshAt))
                ) {
                    lastRefreshAt = stat.lastRefreshAt;
                }
            }
        }
        return {
            id: cat.id,
            title: cat.title,
            icon: cat.icon,
            items: cat.items,
            lastRefreshAt,
            runs,
        };
    });

    return (
        <EntityListShell
            title="Reports"
            subtitle={`Financial, sales, HR, support and compliance reports — ${totalReports} total.`}
        >
            <div className="flex flex-col gap-6">
                <ReportKpiStrip
                    cards={[
                        {
                            label: 'Runs this month',
                            value: overview.totalRunsThisMonth,
                            hint: 'Across all saved report definitions',
                            icon: Activity,
                        },
                        {
                            label: 'Scheduled exports',
                            value: overview.scheduledExportsCount,
                            hint: 'Cron-backed definitions',
                            icon: CalendarClock,
                        },
                        {
                            label: 'Top-viewed report',
                            value: topViewedLabel,
                            hint: 'Most runs this month',
                            icon: Star,
                            tone: 'success',
                        },
                        {
                            label: 'Last refresh',
                            value: fmtRel(overview.lastRefreshAt),
                            hint: overview.lastRefreshAt
                                ? new Date(overview.lastRefreshAt).toLocaleString()
                                : 'No runs yet',
                            icon: RefreshCw,
                        },
                    ]}
                />

                <ReportsHubClient categories={categories} recentRuns={recentRuns} />
            </div>
        </EntityListShell>
    );
}
