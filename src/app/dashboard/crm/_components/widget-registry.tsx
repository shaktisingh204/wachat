'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  Activity,
  Calendar,
  CalendarDays,
  Cake,
  CircleDollarSign,
  ClipboardList,
  FileText,
  Gift,
  Handshake,
  LineChart as LineChartIcon,
  MessageSquare,
  Receipt,
  Sparkles,
  StickyNote,
  Timer,
  TrendingUp,
  Trophy,
  Users,
  Megaphone,
} from 'lucide-react';
import { Badge, Card, CardBody, CardHeader, CardTitle } from '@/components/sabcrm/20ui';
import type { WidgetKey } from '@/app/actions/dashboard-widgets.config';
import type {
  DashboardWidgetItem,
  DashboardWidgetsData,
} from '@/app/actions/dashboard-widgets.actions';

/* ─────────────────────────────────────────────────────────────────────
 * Widget registry — renders each `WidgetKey` from the per-user
 * preferences. Data is loaded server-side via `getDashboardWidgetsData`
 * and passed in through `RenderWidget`. Each widget falls back to a
 * meaningful empty state when its slice has no rows.
 * ──────────────────────────────────────────────────────────────────── */

interface WidgetShellProps {
  title: string;
  icon: React.ElementType;
  hint?: React.ReactNode;
  href?: string;
  children?: React.ReactNode;
}

function WidgetShell({ title, icon: Icon, hint, href, children }: WidgetShellProps) {
  return (
    <Card className="p-0">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-[14px] text-[var(--st-text)]">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-[var(--st-bg-muted)]">
              <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
            </span>
            {title}
          </CardTitle>
          {hint != null ? (
            typeof hint === 'string' || typeof hint === 'number' ? (
              <Badge variant="ghost">{hint}</Badge>
            ) : (
              hint
            )
          ) : null}
        </div>
      </CardHeader>
      <CardBody className="pt-2">{children}</CardBody>
      {href ? (
        <div className="border-t border-[var(--st-border)] px-5 py-2">
          <Link
            href={href}
            className="text-[12px] text-[var(--st-text-secondary)] hover:text-[var(--st-text)] hover:underline"
          >
            Open
          </Link>
        </div>
      ) : null}
    </Card>
  );
}

function EmptyHint({ children }: { children: React.ReactNode }) {
  return <p className="text-[12.5px] text-[var(--st-text-secondary)]">{children}</p>;
}

function ItemList({ items }: { items: DashboardWidgetItem[] }) {
  return (
    <ul className="flex flex-col gap-1.5">
      {items.map((it) => (
        <li
          key={it._id}
          className="flex items-start justify-between gap-3 rounded-[var(--st-radius-sm)] px-2 py-1.5 hover:bg-[var(--st-bg-muted)]"
        >
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] text-[var(--st-text)]">{it.title}</p>
            {it.subtitle ? (
              <p className="truncate text-[11.5px] text-[var(--st-text-secondary)]">
                {it.subtitle}
              </p>
            ) : null}
          </div>
          {it.meta ? (
            <span className="shrink-0 text-[11.5px] text-[var(--st-text-secondary)]">
              {it.meta}
            </span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function StatRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-[12px] text-[var(--st-text-secondary)]">{label}</span>
      <span className="text-[14px] font-medium text-[var(--st-text)]">{value}</span>
    </div>
  );
}

function BigStat({ value, hint }: { value: React.ReactNode; hint?: string }) {
  return (
    <div>
      <p className="text-[24px] leading-none text-[var(--st-text)]">{value}</p>
      {hint ? (
        <p className="mt-1 text-[12px] text-[var(--st-text-secondary)]">{hint}</p>
      ) : null}
    </div>
  );
}

function fmtCurrency(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currency || 'USD',
      maximumFractionDigits: 0,
    }).format(amount || 0);
  } catch {
    return `${(amount || 0).toLocaleString()}`;
  }
}

/* ── Concrete widgets ─────────────────────────────────────────────── */

function ProjectStatusCountsWidget({ data }: { data: DashboardWidgetsData }) {
  const { inProgress, onHold, completed } = data.projectStatus;
  const total = inProgress + onHold + completed;
  return (
    <WidgetShell
      title="Project status"
      icon={ClipboardList}
      href="/dashboard/crm/projects"
      hint={total}
    >
      {total === 0 ? (
        <EmptyHint>No projects yet.</EmptyHint>
      ) : (
        <div className="flex flex-col gap-1.5">
          <StatRow label="In progress" value={inProgress} />
          <StatRow label="On hold" value={onHold} />
          <StatRow label="Completed" value={completed} />
        </div>
      )}
    </WidgetShell>
  );
}

function TodayTasksWidget({ data }: { data: DashboardWidgetsData }) {
  const { count, items } = data.todayTasks;
  return (
    <WidgetShell
      title="Today's tasks"
      icon={ClipboardList}
      href="/dashboard/crm/tasks"
      hint={count}
    >
      {items.length === 0 ? (
        <EmptyHint>Nothing due today — nice.</EmptyHint>
      ) : (
        <ItemList items={items} />
      )}
    </WidgetShell>
  );
}

function OpenTicketsWidget({ data }: { data: DashboardWidgetsData }) {
  const { count, items } = data.openTickets;
  return (
    <WidgetShell
      title="Open tickets"
      icon={MessageSquare}
      href="/dashboard/sabdesk"
      hint={count}
    >
      {items.length === 0 ? (
        <EmptyHint>No open tickets.</EmptyHint>
      ) : (
        <ItemList items={items} />
      )}
    </WidgetShell>
  );
}

function ActiveTimerWidget({ data }: { data: DashboardWidgetsData }) {
  const { running, title, startedAt } = data.activeTimer;
  return (
    <WidgetShell
      title="Active timer"
      icon={Timer}
      hint={running ? <Badge variant="success">Running</Badge> : undefined}
    >
      {running ? (
        <BigStat
          value={title || 'Timer running'}
          hint={
            startedAt
              ? `Started ${new Date(startedAt).toLocaleTimeString()}`
              : undefined
          }
        />
      ) : (
        <EmptyHint>No timer running right now.</EmptyHint>
      )}
    </WidgetShell>
  );
}

function WeekTimelogWidget({ data }: { data: DashboardWidgetsData }) {
  const { hours, entries } = data.weekTimelog;
  return (
    <WidgetShell title="This week's time log" icon={Timer}>
      {entries === 0 ? (
        <EmptyHint>No time logged this week.</EmptyHint>
      ) : (
        <BigStat
          value={`${hours.toLocaleString()}h`}
          hint={`${entries} ${entries === 1 ? 'entry' : 'entries'}`}
        />
      )}
    </WidgetShell>
  );
}

function PendingLeavesWidget({ data }: { data: DashboardWidgetsData }) {
  const { count, items } = data.pendingLeaves;
  return (
    <WidgetShell
      title="Pending leaves"
      icon={Users}
      href="/dashboard/hrm/payroll/leave"
      hint={count}
    >
      {items.length === 0 ? (
        <EmptyHint>No pending leave requests.</EmptyHint>
      ) : (
        <ItemList items={items} />
      )}
    </WidgetShell>
  );
}

function UpcomingBirthdaysWidget({ data }: { data: DashboardWidgetsData }) {
  const { items } = data.upcomingBirthdays;
  return (
    <WidgetShell title="Upcoming birthdays" icon={Cake} hint={items.length}>
      {items.length === 0 ? (
        <EmptyHint>No birthdays in the next 30 days.</EmptyHint>
      ) : (
        <ItemList items={items} />
      )}
    </WidgetShell>
  );
}

function LatestDiscussionsWidget({ data }: { data: DashboardWidgetsData }) {
  const { items } = data.latestDiscussions;
  return (
    <WidgetShell title="Latest discussions" icon={MessageSquare}>
      {items.length === 0 ? (
        <EmptyHint>No recent discussions.</EmptyHint>
      ) : (
        <ItemList items={items} />
      )}
    </WidgetShell>
  );
}

function RecentNoticesWidget({ data }: { data: DashboardWidgetsData }) {
  const { items } = data.recentNotices;
  return (
    <WidgetShell title="Recent notices" icon={Megaphone}>
      {items.length === 0 ? (
        <EmptyHint>No notices published.</EmptyHint>
      ) : (
        <ItemList items={items} />
      )}
    </WidgetShell>
  );
}

function UpcomingEventsWidget({ data }: { data: DashboardWidgetsData }) {
  const { items } = data.upcomingEvents;
  return (
    <WidgetShell title="Upcoming events" icon={CalendarDays} hint={items.length}>
      {items.length === 0 ? (
        <EmptyHint>No events in the next 30 days.</EmptyHint>
      ) : (
        <ItemList items={items} />
      )}
    </WidgetShell>
  );
}

function TopProjectsWidget({ data }: { data: DashboardWidgetsData }) {
  const { items } = data.topProjects;
  return (
    <WidgetShell
      title="Top projects"
      icon={Trophy}
      href="/dashboard/crm/projects"
      hint={items.length}
    >
      {items.length === 0 ? (
        <EmptyHint>No active projects.</EmptyHint>
      ) : (
        <ItemList items={items} />
      )}
    </WidgetShell>
  );
}

function RevenueMtdWidget({ data }: { data: DashboardWidgetsData }) {
  const { amount, currency } = data.revenueMtd;
  return (
    <WidgetShell title="Revenue (MTD)" icon={CircleDollarSign}>
      <BigStat
        value={fmtCurrency(amount, currency)}
        hint={amount > 0 ? 'Paid invoices this month' : 'No revenue this month yet'}
      />
    </WidgetShell>
  );
}

function ExpenseMtdWidget({ data }: { data: DashboardWidgetsData }) {
  const { amount, currency } = data.expenseMtd;
  return (
    <WidgetShell title="Expense (MTD)" icon={Receipt}>
      <BigStat
        value={fmtCurrency(amount, currency)}
        hint={amount > 0 ? 'Logged this month' : 'No expenses this month yet'}
      />
    </WidgetShell>
  );
}

function PendingInvoicesWidget({ data }: { data: DashboardWidgetsData }) {
  const { count, amount, currency } = data.pendingInvoices;
  return (
    <WidgetShell
      title="Pending invoices"
      icon={FileText}
      href="/dashboard/crm/sales/invoices"
      hint={count}
    >
      {count === 0 ? (
        <EmptyHint>All invoices settled.</EmptyHint>
      ) : (
        <BigStat
          value={fmtCurrency(amount, currency)}
          hint={`${count} ${count === 1 ? 'invoice' : 'invoices'} awaiting payment`}
        />
      )}
    </WidgetShell>
  );
}

function NewLeadsWidget({ data }: { data: DashboardWidgetsData }) {
  const { count, items } = data.newLeads;
  return (
    <WidgetShell
      title="New leads"
      icon={Sparkles}
      href="/dashboard/crm/leads"
      hint={count}
    >
      {items.length === 0 ? (
        <EmptyHint>No new leads in the last 7 days.</EmptyHint>
      ) : (
        <ItemList items={items} />
      )}
    </WidgetShell>
  );
}

function WonDealsWidget({ data }: { data: DashboardWidgetsData }) {
  const { count, amount, currency } = data.wonDeals;
  return (
    <WidgetShell
      title="Won deals"
      icon={Handshake}
      href="/dashboard/crm/deals"
      hint={count}
    >
      {count === 0 ? (
        <EmptyHint>No deals closed-won yet.</EmptyHint>
      ) : (
        <BigStat
          value={fmtCurrency(amount, currency)}
          hint={`${count} ${count === 1 ? 'deal' : 'deals'} won`}
        />
      )}
    </WidgetShell>
  );
}

function UpcomingFollowupsWidget({ data }: { data: DashboardWidgetsData }) {
  const { count, items } = data.upcomingFollowups;
  return (
    <WidgetShell title="Upcoming follow-ups" icon={Gift} hint={count}>
      {items.length === 0 ? (
        <EmptyHint>No follow-ups scheduled.</EmptyHint>
      ) : (
        <ItemList items={items} />
      )}
    </WidgetShell>
  );
}

function ActivityFeedWidget({ data }: { data: DashboardWidgetsData }) {
  const { items } = data.activityFeed;
  return (
    <WidgetShell title="Activity feed" icon={Activity}>
      {items.length === 0 ? (
        <EmptyHint>No recent activity recorded.</EmptyHint>
      ) : (
        <ItemList items={items} />
      )}
    </WidgetShell>
  );
}

function CalendarWidget() {
  const now = new Date();
  const dayLabel = now.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
  return (
    <WidgetShell title="Calendar" icon={Calendar} href="/dashboard/crm/events">
      <BigStat value={now.getDate().toString()} hint={dayLabel} />
    </WidgetShell>
  );
}

function StickyNotesWidget({ data }: { data: DashboardWidgetsData }) {
  const { items } = data.stickyNotes;
  return (
    <WidgetShell title="Sticky notes" icon={StickyNote} hint={items.length}>
      {items.length === 0 ? (
        <EmptyHint>No notes yet — pin something for later.</EmptyHint>
      ) : (
        <ItemList items={items} />
      )}
    </WidgetShell>
  );
}

function MyTeamWidgetStub() {
  // Real widget is a server component (`./my-team-widget.tsx`). The
  // registry runs on the client; it renders this lightweight link card
  // and the dashboard page mounts the server version separately.
  return (
    <WidgetShell
      title="My team"
      icon={Users}
      href="/dashboard/hrm/portal#team"
      hint="Direct reports"
    >
      <EmptyHint>Loaded above in the team rail.</EmptyHint>
    </WidgetShell>
  );
}

/* ── Registry ─────────────────────────────────────────────────────── */

type WidgetComponent = React.ComponentType<{ data: DashboardWidgetsData }>;

const REGISTRY: Partial<Record<WidgetKey, WidgetComponent>> = {
  'project-status-counts': ProjectStatusCountsWidget,
  'today-tasks': TodayTasksWidget,
  'open-tickets': OpenTicketsWidget,
  'active-timer': ActiveTimerWidget,
  'week-timelog': WeekTimelogWidget,
  'pending-leaves': PendingLeavesWidget,
  'upcoming-birthdays': UpcomingBirthdaysWidget,
  'latest-discussions': LatestDiscussionsWidget,
  'recent-notices': RecentNoticesWidget,
  'upcoming-events': UpcomingEventsWidget,
  'top-projects': TopProjectsWidget,
  'revenue-mtd': RevenueMtdWidget,
  'expense-mtd': ExpenseMtdWidget,
  'pending-invoices': PendingInvoicesWidget,
  'new-leads': NewLeadsWidget,
  'won-deals': WonDealsWidget,
  'upcoming-followups': UpcomingFollowupsWidget,
  'activity-feed': ActivityFeedWidget,
  calendar: CalendarWidget as WidgetComponent,
  'sticky-notes': StickyNotesWidget,
  'my-team': MyTeamWidgetStub as WidgetComponent,
};

export interface RenderWidgetProps {
  widgetKey: WidgetKey;
  label: string;
  data: DashboardWidgetsData;
}

export function RenderWidget({ widgetKey, label, data }: RenderWidgetProps) {
  const Component = REGISTRY[widgetKey];
  if (Component) return <Component data={data} />;
  return (
    <Card className="p-5">
      <p className="text-[12.5px] text-[var(--st-text-secondary)]">
        Widget "<span className="text-[var(--st-text)]">{label}</span>" — not yet
        implemented.
      </p>
    </Card>
  );
}

export const RevenueIcon = TrendingUp;
export const ChartIcon = LineChartIcon;
