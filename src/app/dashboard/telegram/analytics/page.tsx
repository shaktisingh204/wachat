'use client';

import {
  Badge,
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
  Button,
  Card,
  DateRangePicker,
  EmptyState,
  Field,
  PageActions,
  PageDescription,
  PageEyebrow,
  PageHeader,
  PageHeading,
  PageTitle,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SegmentedControl,
  Skeleton,
  StatCard,
  Table,
  TBody,
  Td,
  Th,
  THead,
  Tr,
  useToast,
} from '@/components/sabcrm/20ui';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Area,
  AreaChart,
} from 'recharts';
import {
  BarChart3,
  BadgeAlert,
  BadgeCheck,
  Bot,
  Coins,
  Contact,
  Download,
  Filter,
  Loader2,
  Megaphone,
  MessageSquare,
  Radar,
  Send,
  Sparkles,
  TrendingUp,
  Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import {
  useEffect,
  useMemo,
  useState,
  useCallback,
  useTransition,
} from 'react';

import { useProject } from '@/context/project-context';
import { TelegramProjectGate } from '../_components/telegram-project-gate';

/**
 * Telegram Analytics dashboard. Read-only KPIs + leaderboards + a funnel,
 * scoped to the active project and an optional bot. All data comes from the
 * Rust `telegram-analytics` crate via server-action shims in
 * `telegram-analytics.actions.ts`.
 *
 * Sections live as a SegmentedControl "view" switcher. Each view has its own
 * CSV export.
 */

import * as React from 'react';

import {
  getTelegramAnalyticsOverview,
  getTelegramMessagesTimeseries,
  getTelegramBroadcastsTimeseries,
  getTelegramTopContacts,
  getTelegramTopCommands,
  getTelegramAnalyticsFunnel,
  exportTelegramAnalyticsCsv,
  type OverviewResp,
  type MessagesTimeseriesResp,
  type BroadcastsTimeseriesResp,
  type TopContactsResp,
  type TopCommandsResp,
  type FunnelResp,
  type TelegramAnalyticsGranularity,
  type TelegramAnalyticsCsvSection,
} from '@/app/actions/telegram-analytics.actions';
import { listTelegramBots } from '@/app/actions/telegram.actions';
import type { BotRow } from '@/lib/rust-client/telegram-bots';

// -------------------------------------------------------------------------
//  Constants
// -------------------------------------------------------------------------

const ACCENT = '#229ED9';
const DANGER = 'var(--st-danger)';

type View =
  | 'overview'
  | 'messages'
  | 'broadcasts'
  | 'commands'
  | 'contacts'
  | 'funnel';

const VIEW_OPTIONS: Array<{ value: View; label: string; icon: LucideIcon }> = [
  { value: 'overview', label: 'Overview', icon: Sparkles },
  { value: 'messages', label: 'Messages', icon: MessageSquare },
  { value: 'broadcasts', label: 'Broadcasts', icon: Megaphone },
  { value: 'commands', label: 'Commands', icon: Send },
  { value: 'contacts', label: 'Contacts', icon: Contact },
  { value: 'funnel', label: 'Funnel', icon: Radar },
];

const GRANULARITIES: Array<{ value: TelegramAnalyticsGranularity; label: string }> = [
  { value: 'hour', label: 'Hour' },
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
];

const CSV_SECTION_PER_VIEW: Record<View, TelegramAnalyticsCsvSection> = {
  overview: 'overview',
  messages: 'messages',
  broadcasts: 'broadcasts',
  commands: 'commands',
  // Contacts + funnel piggyback on the overview snapshot.
  contacts: 'overview',
  funnel: 'overview',
};

// -------------------------------------------------------------------------
//  Helpers
// -------------------------------------------------------------------------

function startOfNDaysAgo(n: number): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - n);
  return d;
}

function fmtNumber(n: number): string {
  if (!Number.isFinite(n)) return '0';
  return new Intl.NumberFormat().format(n);
}

function fmtPercent(n: number): string {
  if (!Number.isFinite(n)) return '0%';
  return `${(n * 100).toFixed(1)}%`;
}

function fmtMoney(cents: number): string {
  return fmtNumber(Math.round(cents / 100));
}

function downloadCsv(filename: string, body: string) {
  const blob = new Blob([body], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// -------------------------------------------------------------------------
//  Page
// -------------------------------------------------------------------------

export default function Page() {
  const { activeProject } = useProject();
  const { toast } = useToast();
  const projectId = activeProject?._id?.toString();

  // --- filter state ---
  const [range, setRange] = useState<{ from: Date; to: Date }>(() => ({
    from: startOfNDaysAgo(30),
    to: new Date(),
  }));
  const [granularity, setGranularity] =
    useState<TelegramAnalyticsGranularity>('day');
  const [view, setView] = useState<View>('overview');
  const [botId, setBotId] = useState<string>('');
  const [bots, setBots] = useState<BotRow[]>([]);

  // --- data state ---
  const [overview, setOverview] = useState<OverviewResp | null>(null);
  const [messagesSeries, setMessagesSeries] =
    useState<MessagesTimeseriesResp | null>(null);
  const [broadcastSeries, setBroadcastSeries] =
    useState<BroadcastsTimeseriesResp | null>(null);
  const [topContacts, setTopContacts] = useState<TopContactsResp | null>(null);
  const [topCommands, setTopCommands] = useState<TopCommandsResp | null>(null);
  const [funnel, setFunnel] = useState<FunnelResp | null>(null);

  const [isLoading, startLoading] = useTransition();
  const [isExporting, setIsExporting] = useState(false);

  // --- derived params (stable across re-renders) ---
  const queryArgs = useMemo(() => {
    if (!projectId) return null;
    return {
      projectId,
      from: range.from.toISOString(),
      to: range.to.toISOString(),
      botId: botId || undefined,
    };
  }, [projectId, range.from, range.to, botId]);

  // --- load bot list once per project ---
  useEffect(() => {
    let cancelled = false;
    if (!projectId) return;
    (async () => {
      const rows = await listTelegramBots(projectId);
      if (!cancelled) setBots(rows);
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  // --- load analytics whenever the query window changes ---
  const reload = useCallback(() => {
    if (!queryArgs) return;
    startLoading(async () => {
      const [ov, ms, bs, tc, cmds, fn] = await Promise.all([
        getTelegramAnalyticsOverview(queryArgs),
        getTelegramMessagesTimeseries({ ...queryArgs, granularity }),
        getTelegramBroadcastsTimeseries({ ...queryArgs, granularity }),
        getTelegramTopContacts({ ...queryArgs, limit: 20 }),
        getTelegramTopCommands({ ...queryArgs, limit: 20 }),
        getTelegramAnalyticsFunnel(queryArgs),
      ]);
      setOverview(ov);
      setMessagesSeries(ms);
      setBroadcastSeries(bs);
      setTopContacts(tc);
      setTopCommands(cmds);
      setFunnel(fn);
    });
  }, [queryArgs, granularity]);

  useEffect(() => {
    reload();
  }, [reload]);

  // --- KPIs ---
  const kpis = useMemo(() => {
    const ov = overview;
    return [
      {
        label: 'Active bots',
        value: ov?.botsBreakdown?.active ?? 0,
        hint:
          ov?.botsBreakdown?.errored
            ? `${ov.botsBreakdown.errored} errored`
            : undefined,
        icon: Bot,
      },
      {
        label: 'Messages in',
        value: ov?.messagesBreakdown?.incoming ?? 0,
        icon: MessageSquare,
      },
      {
        label: 'Messages out',
        value: ov?.messagesBreakdown?.outgoing ?? 0,
        icon: TrendingUp,
      },
      {
        label: 'Broadcasts sent',
        value: ov?.broadcastsBreakdown?.sent ?? 0,
        icon: Megaphone,
      },
      {
        label: 'Success rate',
        value: fmtPercent(ov?.broadcastsBreakdown?.successRate ?? 0),
        icon: BadgeCheck,
        isText: true,
      },
      {
        label: 'Payments',
        value: ov?.paymentsBreakdown?.count ?? 0,
        hint:
          ov?.paymentsBreakdown?.sumCents
            ? `${fmtMoney(ov.paymentsBreakdown.sumCents)} units`
            : undefined,
        icon: Coins,
      },
      {
        label: 'New contacts',
        value: ov?.contactsBreakdown?.newThisPeriod ?? 0,
        hint:
          ov?.contactsBreakdown?.lost
            ? `${fmtNumber(ov.contactsBreakdown.lost)} lost`
            : undefined,
        icon: Users,
      },
      {
        label: 'Rules fired',
        value: ov?.autoReplyBreakdown?.fired ?? 0,
        icon: Sparkles,
      },
    ];
  }, [overview]);

  // --- export handler ---
  const handleExport = useCallback(async () => {
    if (!queryArgs) return;
    const section = CSV_SECTION_PER_VIEW[view];
    setIsExporting(true);
    const res = await exportTelegramAnalyticsCsv({ ...queryArgs, section });
    setIsExporting(false);
    if (res.error || !res.csv) {
      toast({
        title: 'Export failed',
        description: res.error || 'Unknown error',
        tone: 'danger',
      });
      return;
    }
    const filename = `telegram-analytics-${section}-${range.from
      .toISOString()
      .slice(0, 10)}-${range.to.toISOString().slice(0, 10)}.csv`;
    downloadCsv(filename, res.csv);
  }, [queryArgs, view, range.from, range.to, toast]);

  const topLevelError =
    overview?.error ||
    messagesSeries?.error ||
    broadcastSeries?.error ||
    topContacts?.error ||
    topCommands?.error ||
    funnel?.error;

  const hasNoProject = !projectId;

  return (
    <div className="flex min-h-full flex-col gap-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/dashboard">SabNode</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink href="/dashboard/telegram">
              Telegram
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Analytics</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <PageHeader>
        <PageHeading>
          <PageEyebrow>Telegram</PageEyebrow>
          <div className="flex items-center gap-2.5">
            <span
              aria-hidden
              className="flex h-9 w-9 items-center justify-center rounded-[var(--st-radius)] bg-[var(--st-bg-secondary)] text-[var(--st-accent)]"
            >
              <BarChart3 className="h-4.5 w-4.5" />
            </span>
            <PageTitle>Telegram Analytics</PageTitle>
          </div>
          <PageDescription>
            Read-only KPIs and leaderboards aggregated across every bot in
            this workspace.
          </PageDescription>
        </PageHeading>
        <PageActions>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            disabled={isExporting || hasNoProject}
          >
            {isExporting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : (
              <Download className="h-3.5 w-3.5" aria-hidden />
            )}
            Export CSV
          </Button>
        </PageActions>
      </PageHeader>

      {/* Filters */}
      <Card className="flex flex-wrap items-end gap-4 p-4">
        <Field label="Date range">
          <DateRangePicker
            value={{ from: range.from, to: range.to }}
            onChange={(r) => {
              if (r?.from && r?.to) setRange({ from: r.from, to: r.to });
            }}
            className="w-[260px]"
          />
        </Field>
        <Field label="Granularity">
          <SegmentedControl<TelegramAnalyticsGranularity>
            size="sm"
            aria-label="Granularity"
            items={GRANULARITIES}
            value={granularity}
            onChange={setGranularity}
          />
        </Field>
        <Field label="Bot">
          <Select
            value={botId || '__all__'}
            onValueChange={(v) => setBotId(v === '__all__' ? '' : v)}
          >
            <SelectTrigger className="min-w-[180px]">
              <SelectValue placeholder="All bots" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All bots</SelectItem>
              {bots.map((b) => (
                <SelectItem key={b._id} value={b._id}>
                  {b.name || b.username || b._id}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <div className="ml-auto flex flex-wrap items-center gap-1.5 self-end pb-1.5">
          <Filter className="h-3.5 w-3.5 text-[var(--st-text-tertiary)]" aria-hidden />
          {isLoading ? (
            <span className="inline-flex items-center gap-1 text-xs text-[var(--st-text-secondary)]">
              <Loader2 className="h-3 w-3 animate-spin" aria-hidden /> Refreshing...
            </span>
          ) : (
            <span className="text-xs text-[var(--st-text-secondary)]">
              Showing {range.from.toLocaleDateString()} -{' '}
              {range.to.toLocaleDateString()}
            </span>
          )}
        </div>
      </Card>

      {hasNoProject && (
        <EmptyState
          icon={<Bot className="h-6 w-6" aria-hidden />}
          title="Choose a project"
          description="Telegram analytics is scoped to a workspace. Pick an active project from the sidebar to load data."
        />
      )}

      {!hasNoProject && (
        <>
          {/* KPI grid */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {kpis.map((k) => (
              <StatCard
                key={k.label}
                label={k.label}
                icon={k.icon}
                accent={ACCENT}
                value={
                  isLoading ? (
                    <Skeleton className="h-5 w-16" />
                  ) : k.isText ? (
                    (k.value as string)
                  ) : (
                    fmtNumber(k.value as number)
                  )
                }
                delta={k.hint ? { value: k.hint, tone: 'neutral' } : undefined}
              />
            ))}
          </div>

          {/* View switcher */}
          <SegmentedControl<View>
            aria-label="Analytics view"
            items={VIEW_OPTIONS}
            value={view}
            onChange={setView}
          />

          {topLevelError && (
            <Card className="border-[var(--st-danger)]/40 p-4 text-sm text-[var(--st-danger)]">
              <div className="flex items-center gap-2">
                <BadgeAlert className="h-4 w-4" aria-hidden />
                <span>Data load issue: {topLevelError}</span>
              </div>
            </Card>
          )}

          {view === 'overview' && (
            <OverviewView
              isLoading={isLoading}
              messages={overview?.messagesBreakdown}
              broadcasts={overview?.broadcastsBreakdown}
              topCommands={topCommands?.commands ?? []}
              topContacts={topContacts?.contacts ?? []}
            />
          )}
          {view === 'messages' && (
            <MessagesView
              isLoading={isLoading}
              data={messagesSeries}
              topContacts={topContacts?.contacts ?? []}
            />
          )}
          {view === 'broadcasts' && (
            <BroadcastsView
              isLoading={isLoading}
              data={broadcastSeries}
              topErrorCodes={overview?.broadcastsBreakdown?.topErrorCodes ?? []}
            />
          )}
          {view === 'commands' && (
            <CommandsView
              isLoading={isLoading}
              commands={topCommands?.commands ?? []}
            />
          )}
          {view === 'contacts' && (
            <ContactsView
              isLoading={isLoading}
              byDay={overview?.messagesBreakdown?.byDay ?? []}
              contacts={overview?.contactsBreakdown}
              chats={overview?.chatsBreakdown}
            />
          )}
          {view === 'funnel' && (
            <FunnelView isLoading={isLoading} funnel={funnel} />
          )}
        </>
      )}
    </div>
  );
}

// =========================================================================
//  Sub-views
// =========================================================================

function OverviewView({
  isLoading,
  messages,
  broadcasts,
  topCommands,
  topContacts,
}: {
  isLoading: boolean;
  messages?: OverviewResp['messagesBreakdown'];
  broadcasts?: OverviewResp['broadcastsBreakdown'];
  topCommands: { key: string; label: string; count: number }[];
  topContacts: { chatId: string; title: string; messages: number }[];
}) {
  const msgData = (messages?.byDay ?? []).map((d) => ({
    ts: d.ts,
    in: d.in,
    out: d.out,
  }));

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <ChartCard
        title="Messages in vs out"
        isLoading={isLoading}
        empty={!msgData.length}
      >
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={msgData}>
            <defs>
              <linearGradient id="tgIn" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={ACCENT} stopOpacity={0.4} />
                <stop offset="100%" stopColor={ACCENT} stopOpacity={0} />
              </linearGradient>
              <linearGradient id="tgOut" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--st-text-secondary)" stopOpacity={0.3} />
                <stop offset="100%" stopColor="var(--st-text-secondary)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--st-border)" />
            <XAxis dataKey="ts" stroke="var(--st-text-secondary)" tick={{ fontSize: 10 }} />
            <YAxis stroke="var(--st-text-secondary)" tick={{ fontSize: 10 }} />
            <Tooltip />
            <Legend />
            <Area type="monotone" dataKey="in" stroke={ACCENT} fill="url(#tgIn)" name="Incoming" />
            <Area
              type="monotone"
              dataKey="out"
              stroke="var(--st-text-secondary)"
              fill="url(#tgOut)"
              name="Outgoing"
            />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard
        title="Broadcasts sent vs failed"
        isLoading={isLoading}
        empty={!broadcasts?.sent && !broadcasts?.topErrorCodes?.length}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={[
              { kind: 'Sent', value: broadcasts?.sent ?? 0 },
              {
                kind: 'Failed',
                value:
                  Math.max(
                    0,
                    Math.round(
                      (broadcasts?.sent ?? 0) *
                        (1 - (broadcasts?.successRate ?? 1)),
                    ),
                  ),
              },
            ]}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="var(--st-border)" />
            <XAxis dataKey="kind" stroke="var(--st-text-secondary)" tick={{ fontSize: 10 }} />
            <YAxis stroke="var(--st-text-secondary)" tick={{ fontSize: 10 }} />
            <Tooltip />
            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
              <Cell fill={ACCENT} />
              <Cell fill={DANGER} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <Card className="p-5">
        <h3 className="mb-3 text-[14px] text-[var(--st-text)]">Top commands</h3>
        {isLoading ? (
          <SkeletonRows />
        ) : topCommands.length === 0 ? (
          <p className="text-sm text-[var(--st-text-secondary)]">No commands yet.</p>
        ) : (
          <ul className="space-y-1.5">
            {topCommands.slice(0, 6).map((c) => (
              <li
                key={c.key}
                className="flex items-center justify-between gap-2 text-sm"
              >
                <span className="truncate text-[var(--st-text)]">/{c.key}</span>
                <Badge tone="neutral">{c.count}</Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="p-5">
        <h3 className="mb-3 text-[14px] text-[var(--st-text)]">Top contacts</h3>
        {isLoading ? (
          <SkeletonRows />
        ) : topContacts.length === 0 ? (
          <p className="text-sm text-[var(--st-text-secondary)]">No contact activity.</p>
        ) : (
          <ul className="space-y-1.5">
            {topContacts.slice(0, 6).map((c) => (
              <li
                key={c.chatId}
                className="flex items-center justify-between gap-2 text-sm"
              >
                <span className="truncate text-[var(--st-text)]">{c.title}</span>
                <Badge tone="neutral">{c.messages}</Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function MessagesView({
  isLoading,
  data,
  topContacts,
}: {
  isLoading: boolean;
  data: MessagesTimeseriesResp | null;
  topContacts: { chatId: string; title: string; messages: number }[];
}) {
  const series = (data?.series ?? []).map((p) => ({
    ts: p.ts,
    in: p.in,
    out: p.out,
  }));
  return (
    <div className="flex flex-col gap-4">
      <ChartCard
        title="Message volume"
        isLoading={isLoading}
        empty={!series.length}
        height={340}
      >
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={series} stackOffset="sign">
            <defs>
              <linearGradient id="tgInLarge" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={ACCENT} stopOpacity={0.4} />
                <stop offset="100%" stopColor={ACCENT} stopOpacity={0} />
              </linearGradient>
              <linearGradient id="tgOutLarge" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--st-text-secondary)" stopOpacity={0.3} />
                <stop offset="100%" stopColor="var(--st-text-secondary)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--st-border)" />
            <XAxis dataKey="ts" stroke="var(--st-text-secondary)" tick={{ fontSize: 10 }} />
            <YAxis stroke="var(--st-text-secondary)" tick={{ fontSize: 10 }} />
            <Tooltip />
            <Legend />
            <Area
              type="monotone"
              dataKey="in"
              stackId="1"
              stroke={ACCENT}
              fill="url(#tgInLarge)"
              name="Incoming"
            />
            <Area
              type="monotone"
              dataKey="out"
              stackId="1"
              stroke="var(--st-text-secondary)"
              fill="url(#tgOutLarge)"
              name="Outgoing"
            />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

      <Card className="p-5">
        <h3 className="mb-3 text-[14px] text-[var(--st-text)]">Top contacts by volume</h3>
        {isLoading ? (
          <SkeletonRows />
        ) : topContacts.length === 0 ? (
          <p className="text-sm text-[var(--st-text-secondary)]">
            No message activity in this range.
          </p>
        ) : (
          <Table>
            <THead>
              <Tr>
                <Th>Contact</Th>
                <Th>Chat ID</Th>
                <Th className="text-right">Messages</Th>
              </Tr>
            </THead>
            <TBody>
              {topContacts.map((c) => (
                <Tr key={c.chatId}>
                  <Td className="font-medium">{c.title}</Td>
                  <Td className="text-[var(--st-text-secondary)]">
                    {c.chatId}
                  </Td>
                  <Td className="text-right tabular-nums">
                    {fmtNumber(c.messages)}
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        )}
      </Card>
    </div>
  );
}

function BroadcastsView({
  isLoading,
  data,
  topErrorCodes,
}: {
  isLoading: boolean;
  data: BroadcastsTimeseriesResp | null;
  topErrorCodes: { key: string; label: string; count: number }[];
}) {
  const series = data?.series ?? [];
  return (
    <div className="flex flex-col gap-4">
      <ChartCard
        title="Broadcast deliveries"
        isLoading={isLoading}
        empty={!series.length}
        height={320}
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={series}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--st-border)" />
            <XAxis dataKey="ts" stroke="var(--st-text-secondary)" tick={{ fontSize: 10 }} />
            <YAxis stroke="var(--st-text-secondary)" tick={{ fontSize: 10 }} />
            <Tooltip />
            <Legend />
            <Line
              type="monotone"
              dataKey="sent"
              stroke={ACCENT}
              strokeWidth={2}
              dot={false}
              name="Sent"
            />
            <Line
              type="monotone"
              dataKey="failed"
              stroke={DANGER}
              strokeWidth={2}
              dot={false}
              name="Failed"
            />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      <Card className="p-5">
        <h3 className="mb-3 text-[14px] text-[var(--st-text)]">Top error codes</h3>
        {isLoading ? (
          <SkeletonRows />
        ) : topErrorCodes.length === 0 ? (
          <p className="text-sm text-[var(--st-text-secondary)]">
            No broadcast errors recorded.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {topErrorCodes.map((c) => (
              <li
                key={c.key}
                className="flex items-center justify-between gap-3 text-sm"
              >
                <span className="truncate text-[var(--st-text)]">{c.label}</span>
                <Badge tone="danger">{c.count}</Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function CommandsView({
  isLoading,
  commands,
}: {
  isLoading: boolean;
  commands: { key: string; label: string; count: number }[];
}) {
  const chartData = commands.slice(0, 12).map((c) => ({
    name: `/${c.key}`,
    count: c.count,
  }));
  return (
    <div className="flex flex-col gap-4">
      <ChartCard title="Top commands" isLoading={isLoading} empty={!chartData.length} height={320}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="var(--st-border)" />
            <XAxis
              type="number"
              stroke="var(--st-text-secondary)"
              tick={{ fontSize: 10 }}
            />
            <YAxis
              dataKey="name"
              type="category"
              width={120}
              stroke="var(--st-text-secondary)"
              tick={{ fontSize: 11 }}
            />
            <Tooltip />
            <Bar dataKey="count" fill={ACCENT} radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
      <Card className="p-5">
        <h3 className="mb-3 text-[14px] text-[var(--st-text)]">Command catalogue</h3>
        {isLoading ? (
          <SkeletonRows />
        ) : commands.length === 0 ? (
          <p className="text-sm text-[var(--st-text-secondary)]">
            No commands have been declared yet.
          </p>
        ) : (
          <Table>
            <THead>
              <Tr>
                <Th>Command</Th>
                <Th>Description</Th>
                <Th className="text-right">Bots</Th>
              </Tr>
            </THead>
            <TBody>
              {commands.map((c) => (
                <Tr key={c.key}>
                  <Td className="font-medium">/{c.key}</Td>
                  <Td className="text-[var(--st-text-secondary)]">
                    {c.label}
                  </Td>
                  <Td className="text-right tabular-nums">
                    {fmtNumber(c.count)}
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        )}
      </Card>
    </div>
  );
}

function ContactsView({
  isLoading,
  byDay,
  contacts,
  chats,
}: {
  isLoading: boolean;
  byDay: { ts: string; in: number; out: number }[];
  contacts?: OverviewResp['contactsBreakdown'];
  chats?: OverviewResp['chatsBreakdown'];
}) {
  const growth = byDay.map((d) => ({
    ts: d.ts,
    // Rough proxy for engagement: inbound messages per bucket.
    engaged: d.in,
  }));
  const churnRate =
    contacts && contacts.total > 0
      ? contacts.lost / contacts.total
      : 0;
  return (
    <div className="flex flex-col gap-4">
      <ChartCard
        title="Contact engagement (incoming messages)"
        isLoading={isLoading}
        empty={!growth.length}
        height={300}
      >
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={growth}>
            <defs>
              <linearGradient id="tgEngaged" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={ACCENT} stopOpacity={0.4} />
                <stop offset="100%" stopColor={ACCENT} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--st-border)" />
            <XAxis dataKey="ts" stroke="var(--st-text-secondary)" tick={{ fontSize: 10 }} />
            <YAxis stroke="var(--st-text-secondary)" tick={{ fontSize: 10 }} />
            <Tooltip />
            <Area
              type="monotone"
              dataKey="engaged"
              stroke={ACCENT}
              fill="url(#tgEngaged)"
              name="Engaged"
            />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>
      <div className="grid gap-3 sm:grid-cols-3">
        <MetricTile
          label="Total contacts"
          value={contacts?.total ?? 0}
          isLoading={isLoading}
        />
        <MetricTile
          label="New this period"
          value={contacts?.newThisPeriod ?? 0}
          isLoading={isLoading}
        />
        <MetricTile
          label="Churn (30 d)"
          value={fmtPercent(churnRate)}
          isLoading={isLoading}
          asText
          hint={`${fmtNumber(contacts?.lost ?? 0)} lost`}
        />
        <MetricTile
          label="Active chats"
          value={chats?.activeThisPeriod ?? 0}
          isLoading={isLoading}
        />
        <MetricTile
          label="New chats"
          value={chats?.newThisPeriod ?? 0}
          isLoading={isLoading}
        />
      </div>
    </div>
  );
}

function FunnelView({
  isLoading,
  funnel,
}: {
  isLoading: boolean;
  funnel: FunnelResp | null;
}) {
  const stages = [
    { label: 'Contacted bot', value: funnel?.contactedBot ?? 0 },
    { label: 'Replied', value: funnel?.replied ?? 0 },
    { label: 'Completed flow', value: funnel?.completedFlow ?? 0 },
    { label: 'Paid', value: funnel?.paid ?? 0 },
  ];
  const top = Math.max(stages[0]?.value ?? 0, 1);
  return (
    <Card className="p-5">
      <h3 className="mb-4 text-[14px] text-[var(--st-text)]">Conversion funnel</h3>
      {isLoading ? (
        <SkeletonRows />
      ) : top === 1 && stages.every((s) => s.value === 0) ? (
        <p className="text-sm text-[var(--st-text-secondary)]">
          No funnel activity in this range.
        </p>
      ) : (
        <div className="space-y-3">
          {stages.map((s, i) => {
            const pct = (s.value / top) * 100;
            const conv =
              i > 0 && stages[i - 1].value > 0
                ? s.value / stages[i - 1].value
                : null;
            return (
              <div key={s.label} className="flex flex-col gap-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[var(--st-text)]">{s.label}</span>
                  <span className="flex items-center gap-2 text-[var(--st-text-secondary)]">
                    <span className="tabular-nums text-[var(--st-text)]">
                      {fmtNumber(s.value)}
                    </span>
                    {conv !== null && (
                      <Badge tone="neutral">
                        {fmtPercent(conv)}
                      </Badge>
                    )}
                  </span>
                </div>
                <div className="h-3 w-full overflow-hidden rounded-full bg-[var(--st-bg-secondary)]">
                  <div
                    className="h-full rounded-full bg-[var(--st-accent)] transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

// =========================================================================
//  Small reusable bits
// =========================================================================

function ChartCard({
  title,
  isLoading,
  empty,
  height = 280,
  children,
}: {
  title: string;
  isLoading: boolean;
  empty?: boolean;
  height?: number;
  children: React.ReactNode;
}) {
  return (
    <Card className="p-5">
      <h3 className="mb-3 text-[14px] text-[var(--st-text)]">{title}</h3>
      <div style={{ height }} className="w-full">
        {isLoading ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-[var(--st-text-secondary)]" aria-hidden />
          </div>
        ) : empty ? (
          <div className="flex h-full items-center justify-center text-sm text-[var(--st-text-secondary)]">
            No data in this range
          </div>
        ) : (
          children
        )}
      </div>
    </Card>
  );
}

function SkeletonRows() {
  return (
    <ul className="space-y-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <li key={i} className="flex items-center justify-between gap-2">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-4 w-10" />
        </li>
      ))}
    </ul>
  );
}

function MetricTile({
  label,
  value,
  isLoading,
  asText,
  hint,
}: {
  label: string;
  value: number | string;
  isLoading: boolean;
  asText?: boolean;
  hint?: string;
}) {
  return (
    <Card className="p-4">
      <TelegramProjectGate />
      <div className="text-[11.5px] text-[var(--st-text-secondary)]">{label}</div>
      <div className="text-[20px] leading-tight tabular-nums text-[var(--st-text)]">
        {isLoading ? (
          <Skeleton className="h-5 w-16" />
        ) : asText ? (
          (value as string)
        ) : (
          fmtNumber(value as number)
        )}
      </div>
      {hint && <div className="text-[11px] text-[var(--st-text-tertiary)]">{hint}</div>}
    </Card>
  );
}
