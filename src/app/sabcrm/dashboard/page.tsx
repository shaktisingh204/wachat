import * as React from 'react';
import Link from 'next/link';
import {
  Building2,
  Users,
  Briefcase,
  ListTodo,
  TrendingUp,
  CalendarClock,
  Activity,
  ArrowRight,
} from 'lucide-react';

import {
  getKpisAction,
  getActivityFeedAction,
  runAnalyticsAction,
} from '@/app/actions/sabcrm.actions';
import type {
  CrmDashboardKpis,
  CountByFieldResult,
  SumByFieldResult,
  FeedPage,
  ObjectRecordCount,
} from '@/app/actions/sabcrm.actions.types';
import type { CrmActivityRecord } from '@/lib/sabcrm/activities.server';
import {
  Card,
  ZoruCardContent,
  ZoruCardHeader,
  ZoruCardTitle,
  ZoruCardDescription,
  ZoruCardFooter,
  StatCard,
  PageHeader,
  ZoruPageHeading,
  ZoruPageEyebrow,
  ZoruPageTitle,
  ZoruPageDescription,
  EmptyState,
  Badge,
  Separator,
  Button,
} from '@/components/zoruui';
import { DashboardCharts } from './dashboard-charts';

// Dashboard is per-request: KPIs and feed must reflect the latest data.
export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Dashboard — SabCRM',
};

/* -------------------------------------------------------------------------- */
/* Formatters                                                                  */
/* -------------------------------------------------------------------------- */

function formatNumber(n: number): string {
  return new Intl.NumberFormat().format(n);
}

function formatCurrency(n: number): string {
  if (n >= 1_000_000) {
    return `$${(n / 1_000_000).toFixed(1)}M`;
  }
  if (n >= 1_000) {
    return `$${(n / 1_000).toFixed(1)}K`;
  }
  return `$${formatNumber(n)}`;
}

function relativeTime(date: Date | string): string {
  const d = date instanceof Date ? date : new Date(date);
  const diff = Date.now() - d.getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const ACTIVITY_TYPE_LABELS: Record<string, string> = {
  NOTE: 'Note',
  TASK: 'Task',
  CALL: 'Call',
  MEETING: 'Meeting',
  EMAIL: 'Email',
  COMMENT: 'Comment',
};

const OBJECT_ICONS: Record<string, React.ReactNode> = {
  companies: <Building2 className="h-4 w-4" />,
  people: <Users className="h-4 w-4" />,
  opportunities: <Briefcase className="h-4 w-4" />,
  tasks: <ListTodo className="h-4 w-4" />,
};

/* -------------------------------------------------------------------------- */
/* Sub-components (server-side, no "use client")                               */
/* -------------------------------------------------------------------------- */

interface KpiRowProps {
  kpis: CrmDashboardKpis;
}

function KpiRow({ kpis }: KpiRowProps) {
  const { opportunities, tasks, newThisWeek, recordCounts } = kpis;

  // Top 4 objects by count for the object stat row
  const topObjects: ObjectRecordCount[] = recordCounts
    .slice()
    .sort((a: ObjectRecordCount, b: ObjectRecordCount) => b.count - a.count)
    .slice(0, 4);

  return (
    <section aria-label="Key performance indicators">
      {/* Object record counts */}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {topObjects.map((obj: ObjectRecordCount) => (
          <Link
            key={obj.slug}
            href={`/sabcrm/${obj.slug}`}
            className="no-underline"
            aria-label={`${obj.labelPlural}: ${formatNumber(obj.count)} records`}
          >
            <StatCard
              label={obj.labelPlural}
              value={formatNumber(obj.count)}
              icon={OBJECT_ICONS[obj.slug] ?? <Activity className="h-4 w-4" />}
              className="cursor-pointer transition-shadow hover:shadow-[var(--zoru-shadow-sm)]"
            />
          </Link>
        ))}
      </div>

      {/* Pipeline + task health */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard
          label="Open Pipeline"
          value={formatCurrency(opportunities.pipelineValue)}
          icon={<TrendingUp className="h-4 w-4" />}
          period={`${formatNumber(opportunities.openCount)} open ${opportunities.openCount === 1 ? 'opportunity' : 'opportunities'}`}
        />
        <StatCard
          label="Tasks Due Today"
          value={formatNumber(tasks.dueToday)}
          icon={<CalendarClock className="h-4 w-4" />}
          period={
            tasks.overdue > 0
              ? `${formatNumber(tasks.overdue)} overdue`
              : `${formatNumber(tasks.totalOpen)} total open`
          }
          invertDelta={tasks.overdue > 0}
          delta={tasks.overdue > 0 ? -tasks.overdue : undefined}
        />
        <StatCard
          label="New This Week"
          value={formatNumber(newThisWeek.count)}
          icon={<Activity className="h-4 w-4" />}
          period="records created"
        />
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Activity feed panel                                                         */
/* -------------------------------------------------------------------------- */

interface ActivityFeedPanelProps {
  feed: FeedPage;
}

function ActivityFeedPanel({ feed }: ActivityFeedPanelProps) {
  if (feed.activities.length === 0) {
    return (
      <Card>
        <ZoruCardContent className="py-10">
          <EmptyState
            title="No recent activity"
            description="Actions logged on CRM records will appear here."
          />
        </ZoruCardContent>
      </Card>
    );
  }

  return (
    <Card>
      <ZoruCardHeader className="pb-3">
        <ZoruCardTitle className="text-sm font-semibold text-zoru-ink">
          Recent Activity
        </ZoruCardTitle>
        <ZoruCardDescription className="text-xs text-zoru-ink-muted">
          Latest team interactions across all records
        </ZoruCardDescription>
      </ZoruCardHeader>
      <Separator />
      <ZoruCardContent className="p-0">
        <ul className="divide-y divide-zoru-line">
          {feed.activities.map((activity: CrmActivityRecord) => (
            <li key={activity._id} className="flex items-start gap-3 px-4 py-3">
              <span className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-zoru-surface-2 text-[10px] font-medium text-zoru-ink-muted">
                {(ACTIVITY_TYPE_LABELS[activity.type] ?? activity.type).slice(0, 2)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-zoru-ink">
                  {activity.title}
                </p>
                <div className="mt-0.5 flex items-center gap-2">
                  <Badge variant="secondary" className="text-[10px]">
                    {ACTIVITY_TYPE_LABELS[activity.type] ?? activity.type}
                  </Badge>
                  <span className="text-xs text-zoru-ink-muted capitalize">
                    {activity.targetObject}
                  </span>
                </div>
              </div>
              <time
                dateTime={
                  activity.createdAt instanceof Date
                    ? activity.createdAt.toISOString()
                    : String(activity.createdAt)
                }
                className="flex-shrink-0 text-xs text-zoru-ink-subtle"
              >
                {relativeTime(activity.createdAt)}
              </time>
            </li>
          ))}
        </ul>
      </ZoruCardContent>
      {feed.hasMore && (
        <>
          <Separator />
          <ZoruCardFooter className="py-3">
            <Link
              href="/sabcrm"
              className="flex items-center gap-1 text-xs font-medium text-zoru-ink-muted no-underline hover:text-zoru-ink"
            >
              View all activity
              <ArrowRight className="h-3 w-3" />
            </Link>
          </ZoruCardFooter>
        </>
      )}
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/* Page                                                                        */
/* -------------------------------------------------------------------------- */

export default async function SabcrmDashboardPage() {
  // All three server actions run in parallel — each independently gates via
  // session → project → RBAC → plan so this page is safe even if the layout
  // guard is bypassed.
  const [kpisRes, feedRes, stageCountRes, pipelineByStageRes] =
    await Promise.all([
      getKpisAction(),
      getActivityFeedAction({ mode: 'page', options: { page: 1, pageSize: 10 } }),
      // Opportunities by stage (distribution chart)
      runAnalyticsAction({
        kind: 'countByField',
        object: 'opportunities',
        fieldKey: 'stage',
      }),
      // Pipeline value (sum of amount) grouped by stage
      runAnalyticsAction({
        kind: 'sumByField',
        object: 'opportunities',
        groupFieldKey: 'stage',
        sumFieldKey: 'amount',
      }),
    ]);

  // Surface a calm gate error if the user has no access or no project.
  if (!kpisRes.ok) {
    return (
      <main className="mx-auto min-h-[100dvh] w-full max-w-6xl px-6 py-10 sm:px-8 sm:py-14">
        <EmptyState
          title="Dashboard unavailable"
          description={kpisRes.error}
        />
      </main>
    );
  }

  const kpis = kpisRes.data;
  const feed = feedRes.ok ? (feedRes.data as FeedPage) : null;
  const stageCount = stageCountRes.ok
    ? (stageCountRes.data as CountByFieldResult)
    : null;
  const pipelineByStage = pipelineByStageRes.ok
    ? (pipelineByStageRes.data as SumByFieldResult)
    : null;

  return (
    <main className="mx-auto min-h-[100dvh] w-full max-w-6xl px-6 py-10 sm:px-8 sm:py-14">
      {/* Page header */}
      <PageHeader className="mb-8">
        <ZoruPageHeading>
          <ZoruPageEyebrow>Customer relationships</ZoruPageEyebrow>
          <ZoruPageTitle>Dashboard</ZoruPageTitle>
          <ZoruPageDescription>
            Live snapshot of your pipeline, tasks, and team activity.
          </ZoruPageDescription>
        </ZoruPageHeading>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/sabcrm">All Objects</Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href="/sabcrm/opportunities">Pipeline</Link>
          </Button>
        </div>
      </PageHeader>

      {/* KPI stat cards */}
      <KpiRow kpis={kpis} />

      {/* Charts + Activity feed — two-column layout on md+ */}
      <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Charts section (client component — needs Recharts) */}
        <DashboardCharts
          stageCount={stageCount}
          pipelineByStage={pipelineByStage}
          tasks={kpis.tasks}
        />

        {/* Recent activity feed */}
        {feed ? (
          <ActivityFeedPanel feed={feed} />
        ) : (
          <Card>
            <ZoruCardContent className="py-10">
              <EmptyState
                title="Activity feed unavailable"
                description="Could not load recent activity."
              />
            </ZoruCardContent>
          </Card>
        )}
      </div>
    </main>
  );
}
