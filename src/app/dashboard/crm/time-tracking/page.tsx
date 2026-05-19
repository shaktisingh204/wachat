import {
    BarChart3,
    CalendarClock,
    Clock3,
    ListChecks,
    Settings2,
    Timer,
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
    formatDate,
    recentByUser,
    startOfDay,
    startOfWeek,
} from '../_components/hub-data';

export const dynamic = 'force-dynamic';

interface TimeLogDoc {
    _id: string;
    description?: string;
    projectName?: string;
    durationMinutes?: number;
    minutes?: number;
    startedAt?: string;
    createdAt?: string;
    billable?: boolean;
    approvalStatus?: string;
}

const QUICK_LINKS: HubQuickLink[] = [
    {
        href: '/dashboard/crm/time-tracking/time-logs',
        title: 'Time Logs',
        description: 'Start/stop timers, add manual entries, and review logged time.',
        icon: ListChecks,
    },
    {
        href: '/dashboard/crm/time-tracking/weekly-timesheets',
        title: 'Weekly Timesheets',
        description: 'View and approve weekly timesheet summaries per teammate.',
        icon: CalendarClock,
    },
    {
        href: '/dashboard/crm/time-tracking/reports',
        title: 'Reports',
        description: 'Billable vs. non-billable hours and project utilisation.',
        icon: BarChart3,
    },
    {
        href: '/dashboard/crm/time-tracking/settings',
        title: 'Settings',
        description: 'Rounding rules, billable defaults, and approval workflows.',
        icon: Settings2,
    },
];

function minutesOf(log: TimeLogDoc): number {
    return log.durationMinutes ?? log.minutes ?? 0;
}

function hoursLabel(minutes: number): string {
    if (!minutes) return '0h';
    const hrs = minutes / 60;
    return hrs >= 10 ? `${Math.round(hrs)}h` : `${hrs.toFixed(1)}h`;
}

export default async function TimeTrackingHubPage() {
    const today = startOfDay();
    const weekStart = startOfWeek();

    const [todayLogs, weekLogs, recentLogs, pendingApprovals] = await Promise.all([
        recentByUser<TimeLogDoc>('crm_time_logs', {
            filter: { startedAt: { $gte: today } },
            sortField: 'startedAt',
            limit: 200,
        }),
        recentByUser<TimeLogDoc>('crm_time_logs', {
            filter: { startedAt: { $gte: weekStart } },
            sortField: 'startedAt',
            limit: 1000,
        }),
        recentByUser<TimeLogDoc>('crm_time_logs', {
            sortField: 'startedAt',
            limit: 8,
        }),
        countByUser('crm_timesheets', { approvalStatus: 'pending' }),
    ]);

    const todayMinutes = todayLogs.reduce((s, l) => s + minutesOf(l), 0);
    const weekMinutes = weekLogs.reduce((s, l) => s + minutesOf(l), 0);
    const billableMinutes = weekLogs
        .filter((l) => l.billable)
        .reduce((s, l) => s + minutesOf(l), 0);
    const billablePct = weekMinutes > 0 ? Math.round((billableMinutes / weekMinutes) * 100) : 0;

    const kpis: HubKpi[] = [
        {
            label: 'Today',
            value: hoursLabel(todayMinutes),
            icon: Clock3,
            hint: `${todayLogs.length} entries`,
            href: '/dashboard/crm/time-tracking/time-logs',
        },
        {
            label: 'This Week',
            value: hoursLabel(weekMinutes),
            icon: Timer,
            hint: `${weekLogs.length} entries`,
            href: '/dashboard/crm/time-tracking/weekly-timesheets',
        },
        {
            label: 'Billable %',
            value: `${billablePct}%`,
            icon: BarChart3,
            tone: billablePct >= 60 ? 'success' : 'warning',
            href: '/dashboard/crm/time-tracking/reports',
        },
        {
            label: 'Pending Approval',
            value: pendingApprovals,
            icon: CalendarClock,
            tone: pendingApprovals > 0 ? 'warning' : 'default',
            href: '/dashboard/crm/time-tracking/weekly-timesheets?status=pending',
        },
    ];

    const recentRows: HubRecentRow[] = recentLogs.slice(0, 5).map((log) => ({
        id: String(log._id),
        primary: log.description || log.projectName || 'Time entry',
        secondary: formatDate(log.startedAt || log.createdAt),
        trailing: hoursLabel(minutesOf(log)),
        href: '/dashboard/crm/time-tracking/time-logs',
    }));

    return (
        <EntityListShell
            title="Time Tracking"
            subtitle="Log work items, review timesheet status, and export time-tracking data."
        >
            <div className="flex flex-col gap-6">
                <HubKpiGrid kpis={kpis} />
                <HubQuickLinkGrid links={QUICK_LINKS} />
                <HubRecentList
                    title="Recent time entries"
                    rows={recentRows}
                    emptyHint="No time logged yet — start a timer from Time Logs."
                    viewAllHref="/dashboard/crm/time-tracking/time-logs"
                />
            </div>
        </EntityListShell>
    );
}
