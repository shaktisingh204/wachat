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

import { REPORT_CATEGORIES } from '@/lib/reports/categories';

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

    const totalReports = REPORT_CATEGORIES.reduce((sum, c) => sum + c.items.length, 0);

    const topViewedLabel = (() => {
        if (!overview.topViewedReportKind) return '—';
        for (const cat of REPORT_CATEGORIES) {
            const hit = cat.items.find((i) => i.href.endsWith(`/${overview.topViewedReportKind}`));
            if (hit) return hit.label;
        }
        return overview.topViewedReportLabel ?? overview.topViewedReportKind;
    })();

    const categories: ReportCategory[] = REPORT_CATEGORIES.map((cat) => {
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
