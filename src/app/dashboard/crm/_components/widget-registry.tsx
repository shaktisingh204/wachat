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
import {
  Badge,
  Card,
  ZoruCardContent,
  ZoruCardHeader,
  ZoruCardTitle,
} from '@/components/zoruui';
import type { WidgetKey } from '@/app/actions/dashboard-widgets.config';

/* ─────────────────────────────────────────────────────────────────────
 * Widget registry — maps a `WidgetKey` to a React component.
 *
 * Most widgets here are placeholder shells today; richer widgets (e.g.
 * `RecentDealsCard`, `UpcomingTasksCard`) live in
 * `./crm-dashboard-components.tsx` and are wired into the main dashboard
 * directly. New widget types should be added here so the
 * `WidgetConfigDrawer` toggles them on/off cleanly.
 * ──────────────────────────────────────────────────────────────────── */

interface WidgetShellProps {
  title: string;
  icon: React.ElementType;
  hint?: string;
  href?: string;
  children?: React.ReactNode;
}

function WidgetShell({ title, icon: Icon, hint, href, children }: WidgetShellProps) {
  const header = (
    <ZoruCardHeader className="pb-2">
      <div className="flex items-center justify-between">
        <ZoruCardTitle className="flex items-center gap-2 text-[14px] text-zoru-ink">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-zoru-surface-2">
            <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
          </span>
          {title}
        </ZoruCardTitle>
        {hint ? <Badge variant="ghost">{hint}</Badge> : null}
      </div>
    </ZoruCardHeader>
  );

  const body = (
    <ZoruCardContent className="pt-2">
      {children ?? (
        <p className="text-[12.5px] text-zoru-ink-muted">
          Widget data not yet wired — open the configure drawer to remove this
          tile, or check back soon.
        </p>
      )}
    </ZoruCardContent>
  );

  return (
    <Card className="p-0">
      {header}
      {body}
      {href ? (
        <div className="border-t border-zoru-line px-5 py-2">
          <Link
            href={href}
            className="text-[12px] text-zoru-ink-muted hover:text-zoru-ink hover:underline"
          >
            Open
          </Link>
        </div>
      ) : null}
    </Card>
  );
}

function PlaceholderWidget({ label }: { label: string }) {
  return (
    <Card className="p-5">
      <p className="text-[12.5px] text-zoru-ink-muted">
        Widget "<span className="text-zoru-ink">{label}</span>" — not yet
        implemented.
      </p>
    </Card>
  );
}

/* ── Built-in widget components (placeholders for now). ─────────────── */

function ProjectStatusCountsWidget() {
  return (
    <WidgetShell
      title="Project status"
      icon={ClipboardList}
      href="/dashboard/crm/projects"
    />
  );
}
function TodayTasksWidget() {
  return (
    <WidgetShell
      title="Today's tasks"
      icon={ClipboardList}
      href="/dashboard/crm/tasks"
    />
  );
}
function OpenTicketsWidget() {
  return (
    <WidgetShell
      title="Open tickets"
      icon={MessageSquare}
      href="/dashboard/sabdesk"
    />
  );
}
function ActiveTimerWidget() {
  return <WidgetShell title="Active timer" icon={Timer} />;
}
function WeekTimelogWidget() {
  return <WidgetShell title="This week's time log" icon={Timer} />;
}
function PendingLeavesWidget() {
  return <WidgetShell title="Pending leaves" icon={Users} />;
}
function UpcomingBirthdaysWidget() {
  return <WidgetShell title="Upcoming birthdays" icon={Cake} />;
}
function LatestDiscussionsWidget() {
  return <WidgetShell title="Latest discussions" icon={MessageSquare} />;
}
function RecentNoticesWidget() {
  return <WidgetShell title="Recent notices" icon={Megaphone} />;
}
function UpcomingEventsWidget() {
  return <WidgetShell title="Upcoming events" icon={CalendarDays} />;
}
function TopProjectsWidget() {
  return (
    <WidgetShell
      title="Top projects"
      icon={Trophy}
      href="/dashboard/crm/projects"
    />
  );
}
function RevenueMtdWidget() {
  return <WidgetShell title="Revenue (MTD)" icon={CircleDollarSign} />;
}
function ExpenseMtdWidget() {
  return <WidgetShell title="Expense (MTD)" icon={Receipt} />;
}
function PendingInvoicesWidget() {
  return (
    <WidgetShell
      title="Pending invoices"
      icon={FileText}
      href="/dashboard/crm/sales/invoices"
    />
  );
}
function NewLeadsWidget() {
  return (
    <WidgetShell
      title="New leads"
      icon={Sparkles}
      href="/dashboard/crm/leads"
    />
  );
}
function WonDealsWidget() {
  return (
    <WidgetShell
      title="Won deals"
      icon={Handshake}
      href="/dashboard/crm/deals"
    />
  );
}
function UpcomingFollowupsWidget() {
  return <WidgetShell title="Upcoming follow-ups" icon={Gift} />;
}
function ActivityFeedWidget() {
  return <WidgetShell title="Activity feed" icon={Activity} />;
}
function CalendarWidget() {
  return <WidgetShell title="Calendar" icon={Calendar} />;
}
function StickyNotesWidget() {
  return <WidgetShell title="Sticky notes" icon={StickyNote} />;
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
    />
  );
}

/* Catch-all map. */
const REGISTRY: Partial<Record<WidgetKey, React.ComponentType>> = {
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
  calendar: CalendarWidget,
  'sticky-notes': StickyNotesWidget,
  'my-team': MyTeamWidgetStub,
};

export interface RenderWidgetProps {
  widgetKey: WidgetKey;
  label: string;
}

/**
 * Renders a widget by key. Falls back to a placeholder card if no
 * concrete component is registered for the key.
 */
export function RenderWidget({ widgetKey, label }: RenderWidgetProps) {
  const Component = REGISTRY[widgetKey];
  if (Component) return <Component />;
  return <PlaceholderWidget label={label} />;
}

// Re-export helper icon for callers that want a small badge.
export const RevenueIcon = TrendingUp;
export const ChartIcon = LineChartIcon;
