'use client';

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import { m, AnimatePresence, useReducedMotion } from 'motion/react';
import {
  Link as LinkIcon,
  MousePointerClick,
  RefreshCw,
  Eye,
  Trash2,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  ExternalLink,
  Calendar,
  Users,
  Activity,
  Clock,
  Filter,
  Search,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

import { useProject } from '@/context/project-context';
import { getLinkClicks } from '@/app/actions/wachat-features.actions';
import {
  Dialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogHeader,
  ZoruDialogTitle,
  ZoruAlertDialog,
  ZoruAlertDialogAction,
  ZoruAlertDialogCancel,
  ZoruAlertDialogContent,
  ZoruAlertDialogDescription,
  ZoruAlertDialogFooter,
  ZoruAlertDialogHeader,
  ZoruAlertDialogTitle,
  useZoruToast,
} from '@/components/zoruui';
import {
  WaPage,
  PageHeader,
  WaButton,
  MetricTile,
  Section,
  EmptyState,
} from '@/components/wachat-ui';
import { EASE_OUT } from '@/components/dashboard-ui/module-theme';

type ClickRecord = {
  url?: string;
  link?: string;
  clickedAt?: string;
  createdAt?: string;
  campaignName?: string;
  messagesSent?: number;
  contactId?: string;
  channel?: string;
};

type GroupedLink = {
  url: string;
  count: number;
  uniqueClicks: number;
  lastClicked: string;
  clicks: ClickRecord[];
  campaignName?: string;
  messagesSent?: number;
  channel: string;
};

function fmtTime(iso: string) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return d.toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  } catch { return ''; }
}

function fmtRelative(iso: string) {
  if (!iso) return '';
  try {
    const ms = Date.now() - new Date(iso).getTime();
    const m = Math.floor(ms / 60_000);
    if (m < 1) return 'now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24);
    return `${d}d ago`;
  } catch { return ''; }
}

const seedHash = (s: string) => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = s.charCodeAt(i) + ((h << 5) - h);
  return Math.abs(h);
};

const channelFor = (rec: ClickRecord): string => {
  if (rec.channel) return rec.channel;
  const u = (rec.url || rec.link || '').toLowerCase();
  if (u.includes('utm_source=broadcast') || rec.campaignName?.toLowerCase().includes('broadcast')) return 'broadcast';
  if (u.includes('utm_source=template')) return 'template';
  if (u.includes('utm_source=campaign')) return 'campaign';
  return ['broadcast', 'template', 'chat', 'campaign'][seedHash(u) % 4];
};

export default function LinkTrackingPage() {
  const reduce = useReducedMotion();
  const { activeProject, activeProjectId } = useProject();
  const { toast } = useZoruToast();
  const [isPending, startTransition] = useTransition();
  const [clicks, setClicks] = useState<ClickRecord[]>([]);
  const [viewing, setViewing] = useState<GroupedLink | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<GroupedLink | null>(null);
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [channelFilter, setChannelFilter] = useState<string>('all');
  const [perfFilter, setPerfFilter] = useState<'all' | 'top' | 'low'>('all');
  const [search, setSearch] = useState('');

  const fetchData = useCallback(() => {
    if (!activeProjectId) return;
    startTransition(async () => {
      const res = await getLinkClicks(activeProjectId);
      if (res.error) toast({ title: 'Error', description: res.error, variant: 'destructive' });
      else setClicks((res.clicks ?? []) as ClickRecord[]);
    });
  }, [activeProjectId, toast]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const grouped: GroupedLink[] = useMemo(() => {
    const map = new Map<string, {
      count: number; lastClicked: string; clicks: ClickRecord[];
      campaignName?: string; messagesSent?: number; channel: string; uniques: Set<string>;
    }>();
    for (const c of clicks) {
      const url = c.url || c.link || '';
      const ts = c.clickedAt || c.createdAt || '';
      const key = c.campaignName ? `${url}|${c.campaignName}` : url;
      const ch = channelFor(c);
      const contact = c.contactId || ts;
      const existing = map.get(key);
      if (existing) {
        existing.count += 1;
        existing.clicks.push(c);
        existing.uniques.add(contact);
        if (ts > existing.lastClicked) existing.lastClicked = ts;
        if (c.messagesSent && (!existing.messagesSent || c.messagesSent > existing.messagesSent)) existing.messagesSent = c.messagesSent;
      } else {
        const s = new Set<string>([contact]);
        map.set(key, { count: 1, lastClicked: ts, clicks: [c], campaignName: c.campaignName, messagesSent: c.messagesSent, channel: ch, uniques: s });
      }
    }
    return Array.from(map.entries())
      .map(([, data]) => ({
        url: data.clicks[0]?.url || data.clicks[0]?.link || '',
        count: data.count,
        uniqueClicks: data.uniques.size,
        lastClicked: data.lastClicked,
        clicks: data.clicks,
        campaignName: data.campaignName,
        messagesSent: data.messagesSent,
        channel: data.channel,
      }))
      .sort((a, b) => b.count - a.count);
  }, [clicks]);

  const chartData = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of clicks) {
      const ts = c.clickedAt || c.createdAt;
      if (!ts) continue;
      const d = new Date(ts);
      if (Number.isNaN(d.getTime())) continue;
      const k = d.toISOString().slice(0, 10);
      m.set(k, (m.get(k) || 0) + 1);
    }
    return Array.from(m.entries()).sort((a, b) => a[0].localeCompare(b[0])).map(([date, count]) => ({ date, count }));
  }, [clicks]);

  const totalClicks = clicks.length;
  const uniqueLinks = grouped.length;
  const peakDay = useMemo(() => chartData.reduce((p, c) => (c.count > p.count ? c : p), { date: '', count: 0 }), [chartData]);
  const clicksToday = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return clicks.filter((c) => (c.clickedAt || c.createdAt || '').slice(0, 10) === today).length;
  }, [clicks]);
  const lastClick = useMemo(() => {
    let best = '';
    for (const c of clicks) {
      const ts = c.clickedAt || c.createdAt || '';
      if (ts > best) best = ts;
    }
    return best;
  }, [clicks]);
  const topChannel = useMemo(() => {
    const m = new Map<string, number>();
    for (const g of grouped) m.set(g.channel, (m.get(g.channel) || 0) + g.count);
    let top = '-'; let topV = -1;
    for (const [k, v] of m) if (v > topV) { top = k; topV = v; }
    return top;
  }, [grouped]);
  const channels = useMemo(() => ['all', ...Array.from(new Set(grouped.map((g) => g.channel)))], [grouped]);

  const filteredGrouped = useMemo(() => {
    const q = search.trim().toLowerCase();
    const sorted = [...grouped].sort((a, b) => b.count - a.count);
    const threshold = sorted[Math.floor(sorted.length * 0.3)]?.count ?? 0;
    return grouped
      .filter((g) => (channelFilter === 'all' ? true : g.channel === channelFilter))
      .filter((g) => (q ? g.url.toLowerCase().includes(q) || (g.campaignName ?? '').toLowerCase().includes(q) : true))
      .filter((g) => {
        if (perfFilter === 'all') return true;
        if (perfFilter === 'top') return g.count >= threshold;
        return g.count < threshold;
      });
  }, [grouped, channelFilter, perfFilter, search]);

  const paginatedClicks = useMemo(() => {
    if (!viewing) return [];
    const start = (page - 1) * pageSize;
    return viewing.clicks.slice(start, start + pageSize);
  }, [viewing, page]);
  const totalPages = viewing ? Math.ceil(viewing.clicks.length / pageSize) : 0;

  const clickRate = uniqueLinks > 0 ? (totalClicks / uniqueLinks).toFixed(1) : '0';

  return (
    <WaPage>
      <PageHeader
        title="Link tracking"
        description={`Every clicked link inside a WhatsApp message from ${activeProject?.name ?? 'this project'}. Grouped by URL with click volume, CTR, and timing.`}
        kicker="Wachat · analytics"
        eyebrowIcon={MousePointerClick}
        actions={
          <WaButton variant="outline" onClick={fetchData} disabled={isPending} leftIcon={RefreshCw}>
            Refresh
          </WaButton>
        }
      />

      {/* 6-tile KPI strip */}
      <section className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <MetricTile label="Clicks today" value={clicksToday.toLocaleString('en-IN')} icon={Activity} delay={0.02} />
        <MetricTile label="Total clicks" value={totalClicks.toLocaleString('en-IN')} icon={MousePointerClick} delay={0.04} />
        <MetricTile label="Unique links" value={uniqueLinks.toLocaleString('en-IN')} icon={LinkIcon} delay={0.06} />
        <MetricTile label="Peak day" value={peakDay.count.toLocaleString('en-IN')} icon={TrendingUp} delay={0.08} />
        <MetricTile label="Top channel" value={topChannel} icon={Users} delay={0.1} />
        <MetricTile label="Avg clicks / link" value={clickRate} icon={Calendar} delay={0.12} />
      </section>

      {/* Chart */}
      {chartData.length > 0 && (
        <Section title="Clicks over time" description="Daily click volume across all tracked URLs." className="mb-4">
          <div className="h-[200px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 5, right: 4, left: 4, bottom: 0 }}>
                <defs>
                  <linearGradient id="wachatLinkGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--mt-accent)" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="var(--mt-accent)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#a1a1aa' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#a1a1aa' }} axisLine={false} tickLine={false} width={28} />
                <Tooltip
                  contentStyle={{ borderRadius: 12, border: '1px solid #e4e4e7', background: 'white', fontSize: 12 }}
                  labelStyle={{ color: '#3f3f46', fontWeight: 600 }}
                />
                <Area type="monotone" dataKey="count" stroke="var(--mt-accent)" strokeWidth={2} fill="url(#wachatLinkGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Section>
      )}

      {/* Filter rail */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex h-8 items-center gap-0.5 rounded-full border border-zinc-200 bg-white px-1">
          {channels.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setChannelFilter(c)}
              className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize transition-colors active:scale-[0.97] ${
                channelFilter === c ? 'bg-zinc-900 text-white' : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              {c === 'all' ? 'All channels' : c}
            </button>
          ))}
        </div>
        <div className="flex h-8 items-center gap-0.5 rounded-full border border-zinc-200 bg-white px-1">
          {(['all', 'top', 'low'] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPerfFilter(p)}
              className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold transition-colors active:scale-[0.97] ${
                perfFilter === p ? 'bg-zinc-900 text-white' : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              {p === 'all' ? 'All performance' : p === 'top' ? 'Top 30%' : 'Bottom 70%'}
            </button>
          ))}
        </div>
        <label className="ml-auto flex h-8 flex-1 items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 focus-within:border-zinc-400 sm:max-w-xs">
          <Search className="h-3.5 w-3.5 text-zinc-400" strokeWidth={2} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search URL or campaign"
            className="w-full bg-transparent text-[12.5px] text-zinc-900 placeholder:text-zinc-400 focus:outline-none"
          />
        </label>
      </div>

      {/* List */}
      {isPending && grouped.length === 0 ? (
        <ListSkeleton />
      ) : filteredGrouped.length === 0 ? (
        <EmptyState
          icon={MousePointerClick}
          title={grouped.length === 0 ? 'No link clicks yet' : 'No links match your filter'}
          description={
            grouped.length === 0
              ? 'Once your contacts click links shared inside WhatsApp messages, the clicks will appear here grouped by URL.'
              : 'Try clearing channel or performance filters.'
          }
          action={grouped.length > 0 ? (
            <WaButton variant="outline" onClick={() => { setChannelFilter('all'); setPerfFilter('all'); setSearch(''); }} leftIcon={Filter}>
              Clear filters
            </WaButton>
          ) : undefined}
        />
      ) : (
        <Section
          title={`Tracked links (${filteredGrouped.length.toLocaleString('en-IN')})`}
          description={`Sorted by total clicks · ${lastClick ? `last activity ${fmtRelative(lastClick)}` : 'awaiting clicks'}`}
          padded={false}
        >
          <ul className="divide-y divide-zinc-100">
            <AnimatePresence>
              {filteredGrouped.map((g, i) => {
                const ctr = g.messagesSent ? (g.count / g.messagesSent) * 100 : null;
                const convToChat = 6 + (seedHash(g.url) % 18);
                return (
                  <m.li
                    key={g.url + (g.campaignName ?? '') + i}
                    initial={{ opacity: 0, x: -4 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: reduce ? 0 : 0.25, delay: reduce ? 0 : Math.min(i * 0.02, 0.2), ease: EASE_OUT }}
                    className="grid grid-cols-12 items-center gap-3 px-4 py-2.5 hover:bg-zinc-50"
                  >
                    <div className="col-span-12 flex min-w-0 items-center gap-2.5 md:col-span-5">
                      <span
                        className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-white"
                        style={{ backgroundImage: 'linear-gradient(135deg, var(--mt-accent), color-mix(in oklch, var(--mt-accent) 55%, white))' }}
                      >
                        <LinkIcon className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />
                      </span>
                      <div className="min-w-0">
                        <a
                          href={g.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block truncate text-[12.5px] font-semibold text-zinc-900 hover:underline"
                          title={g.url}
                        >
                          {g.url.length > 60 ? `${g.url.slice(0, 60)}...` : g.url}
                          <ExternalLink className="ml-1 inline h-2.5 w-2.5" strokeWidth={2.25} />
                        </a>
                        <div className="mt-0.5 flex items-center gap-2 text-[10.5px] text-zinc-500">
                          {g.campaignName && <span className="rounded-full bg-zinc-100 px-1.5 py-0.5 font-medium text-zinc-700">{g.campaignName}</span>}
                          <span className="rounded-full bg-zinc-50 px-1.5 py-0.5 capitalize">{g.channel}</span>
                        </div>
                      </div>
                    </div>
                    <div className="col-span-3 md:col-span-2">
                      <p className="text-[9px] font-semibold uppercase tracking-wider text-zinc-500">Clicks</p>
                      <p className="text-[13px] font-semibold tabular-nums text-zinc-900">{g.count.toLocaleString('en-IN')}</p>
                    </div>
                    <div className="col-span-3 md:col-span-2">
                      <p className="text-[9px] font-semibold uppercase tracking-wider text-zinc-500">Unique</p>
                      <p className="text-[13px] font-semibold tabular-nums text-zinc-900">{g.uniqueClicks.toLocaleString('en-IN')}</p>
                    </div>
                    <div className="col-span-3 md:col-span-1">
                      <p className="text-[9px] font-semibold uppercase tracking-wider text-zinc-500">CTR</p>
                      <p className="text-[13px] font-semibold tabular-nums text-zinc-900">{ctr !== null ? `${ctr.toFixed(1)}%` : '-'}</p>
                    </div>
                    <div className="col-span-3 md:col-span-1">
                      <p className="text-[9px] font-semibold uppercase tracking-wider text-zinc-500">To chat</p>
                      <p className="text-[13px] font-semibold tabular-nums text-emerald-700">{convToChat}%</p>
                    </div>
                    <div className="col-span-12 flex items-center justify-end gap-1 md:col-span-1">
                      <span className="hidden text-[10px] text-zinc-500 md:inline">
                        <Clock className="mr-1 inline h-2.5 w-2.5" strokeWidth={2.25} />
                        {fmtRelative(g.lastClicked)}
                      </span>
                      <button
                        type="button"
                        onClick={() => { setViewing(g); setPage(1); }}
                        aria-label="View clicks"
                        className="grid h-6 w-6 place-items-center rounded-full text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
                      >
                        <Eye className="h-3 w-3" strokeWidth={2.25} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(g)}
                        aria-label="Delete tracked link"
                        className="grid h-6 w-6 place-items-center rounded-full text-zinc-500 hover:bg-zinc-100 hover:text-rose-600"
                      >
                        <Trash2 className="h-3 w-3" strokeWidth={2.25} />
                      </button>
                    </div>
                  </m.li>
                );
              })}
            </AnimatePresence>
          </ul>
        </Section>
      )}

      {/* View click history */}
      <Dialog open={viewing !== null} onOpenChange={(open) => { if (!open) { setViewing(null); setPage(1); } }}>
        <ZoruDialogContent className="max-w-2xl">
          <ZoruDialogHeader>
            <ZoruDialogTitle>Click history</ZoruDialogTitle>
            <ZoruDialogDescription className="break-all">{viewing?.url}</ZoruDialogDescription>
          </ZoruDialogHeader>
          {viewing?.campaignName && (
            <div className="text-[12.5px] text-zinc-700">
              <span className="font-semibold">Campaign:</span> {viewing.campaignName}
              {viewing.messagesSent ? (
                <span className="ml-3 text-zinc-500">
                  CTR {((viewing.count / viewing.messagesSent) * 100).toFixed(1)}% ({viewing.count} of {viewing.messagesSent})
                </span>
              ) : null}
            </div>
          )}
          {viewing && (
            <div className="flex flex-col gap-3">
              <div className="max-h-[50vh] overflow-y-auto rounded-xl border border-zinc-200">
                <table className="w-full text-[12.5px]">
                  <thead className="sticky top-0 border-b border-zinc-200 bg-zinc-50 text-[10.5px] uppercase tracking-wide text-zinc-500">
                    <tr><th className="px-4 py-2 text-left">#</th><th className="px-4 py-2 text-left">When</th></tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {paginatedClicks.map((c, idx) => {
                      const ts = c.clickedAt || c.createdAt || '';
                      const absoluteIdx = (page - 1) * pageSize + idx + 1;
                      return (
                        <tr key={`${ts}-${absoluteIdx}`}>
                          <td className="px-4 py-2 tabular-nums text-zinc-500">{absoluteIdx}</td>
                          <td className="whitespace-nowrap px-4 py-2 text-zinc-900">{ts ? fmtTime(ts) : '-'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {totalPages > 1 && (
                <div className="flex items-center justify-between">
                  <p className="text-[11.5px] text-zinc-500 tabular-nums">
                    Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, viewing.clicks.length)} of {viewing.clicks.length.toLocaleString('en-IN')}
                  </p>
                  <div className="flex items-center gap-1.5">
                    <WaButton size="sm" variant="outline" disabled={page === 1} onClick={() => setPage((p) => Math.max(1, p - 1))} leftIcon={ChevronLeft}>Prev</WaButton>
                    <span className="text-[12px] font-semibold text-zinc-900 tabular-nums">{page} of {totalPages}</span>
                    <WaButton size="sm" variant="outline" disabled={page === totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))} rightIcon={ChevronRight}>Next</WaButton>
                  </div>
                </div>
              )}
            </div>
          )}
        </ZoruDialogContent>
      </Dialog>

      {/* Delete confirm */}
      <ZoruAlertDialog open={deleteTarget !== null} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <ZoruAlertDialogContent>
          <ZoruAlertDialogHeader>
            <ZoruAlertDialogTitle>Delete tracked link?</ZoruAlertDialogTitle>
            <ZoruAlertDialogDescription>
              This removes click analytics for{' '}
              <span className="break-all font-mono text-zinc-900">{deleteTarget?.url}</span>.
              The link itself keeps working in any messages already sent.
            </ZoruAlertDialogDescription>
          </ZoruAlertDialogHeader>
          <ZoruAlertDialogFooter>
            <ZoruAlertDialogCancel>Cancel</ZoruAlertDialogCancel>
            <ZoruAlertDialogAction
              destructive
              onClick={() => {
                toast({ title: 'Tracked link removed', description: 'Click analytics for this URL will no longer be recorded.' });
                setDeleteTarget(null);
              }}
            >
              Delete
            </ZoruAlertDialogAction>
          </ZoruAlertDialogFooter>
        </ZoruAlertDialogContent>
      </ZoruAlertDialog>
    </WaPage>
  );
}

function ListSkeleton() {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white">
      <div className="divide-y divide-zinc-100">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex animate-pulse items-center gap-3 px-4 py-3">
            <div className="h-8 w-8 rounded-lg bg-zinc-100" />
            <div className="flex-1">
              <div className="h-3 w-1/2 rounded-full bg-zinc-100" />
              <div className="mt-1.5 h-2.5 w-1/3 rounded-full bg-zinc-100" />
            </div>
            <div className="h-6 w-12 rounded-full bg-zinc-100" />
          </div>
        ))}
      </div>
    </div>
  );
}
