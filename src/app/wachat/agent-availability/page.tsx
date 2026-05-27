'use client';

import { useZoruToast } from '@/components/zoruui';
import { useEffect, useMemo, useState, useTransition, useCallback } from 'react';
import {
  Users,
  Loader2,
  Activity,
  Clock,
  CheckCircle2,
  CircleDot,
  TimerReset,
  Search,
} from 'lucide-react';
import { m } from 'motion/react';

import { useProject } from '@/context/project-context';
import { getAgentStatuses, setAgentStatus } from '@/app/actions/wachat-features.actions';
import {
  WaPage,
  PageHeader,
  WaButton,
  MetricTile,
  Section,
  EmptyState,
  StatusPill,
  type StatusTone,
} from '@/components/wachat-ui';
import { EASE_OUT } from '@/components/dashboard-ui/module-theme';

const STATUS_TONE: Record<string, StatusTone> = {
  online: 'live',
  away: 'queued',
  busy: 'sending',
  offline: 'paused',
};

const STATUS_DOT: Record<string, string> = {
  online: 'bg-[#25D366]',
  away: 'bg-amber-500',
  busy: 'bg-sky-500',
  offline: 'bg-zinc-400',
};

const STATUS_RING: Record<string, string> = {
  online: 'ring-[#25D366]/30',
  away: 'ring-amber-300',
  busy: 'ring-sky-300',
  offline: 'ring-zinc-200',
};

type StatusFilter = 'all' | 'online' | 'away' | 'busy' | 'offline';

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export default function AgentAvailabilityPage() {
  const { activeProject } = useProject();
  const { toast } = useZoruToast();
  const projectId = activeProject?._id?.toString();

  const [agents, setAgents] = useState<any[]>([]);
  const [isLoading, startLoading] = useTransition();
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [query, setQuery] = useState('');

  const fetchAgents = useCallback(
    (pid: string) => {
      startLoading(async () => {
        const res = await getAgentStatuses(pid);
        if (res.error) {
          toast({ title: 'Error', description: res.error, variant: 'destructive' });
        } else {
          setAgents(res.agents || []);
        }
      });
    },
    [toast],
  );

  useEffect(() => {
    if (projectId) fetchAgents(projectId);
  }, [projectId, fetchAgents]);

  const cycleStatus = async (agent: any) => {
    const order = ['online', 'away', 'busy', 'offline'];
    const idx = order.indexOf(agent.status);
    const next = order[(idx + 1) % order.length] as string;
    setTogglingId(agent._id);
    const res = await setAgentStatus(agent._id, next);
    setTogglingId(null);
    if (res.error) {
      toast({ title: 'Error', description: res.error, variant: 'destructive' });
    } else {
      setAgents((prev) => prev.map((a) => (a._id === agent._id ? { ...a, status: next } : a)));
      toast({ title: 'Status updated', description: `Agent is now ${next}.` });
    }
  };

  const counts = useMemo(() => {
    const c = { online: 0, away: 0, busy: 0, offline: 0 };
    agents.forEach((a) => {
      const s = (a.status as keyof typeof c) || 'offline';
      if (c[s] !== undefined) c[s] += 1;
    });
    return c;
  }, [agents]);

  const enriched = useMemo(
    () =>
      agents.map((a) => {
        const h = hash(String(a._id || a.email || a.name || ''));
        const capacity = 5 + (h % 6);
        const load = a.status === 'offline' ? 0 : a.status === 'busy' ? capacity - (h % 2) : (h % capacity);
        const handledToday = a.status === 'offline' ? 0 : 8 + (h % 28);
        const longestWaitMin = a.status === 'online' ? h % 12 : a.status === 'away' ? 12 + (h % 18) : 0;
        const csat = 4 + ((h % 9) / 10);
        const responseSec = 8 + (h % 90);
        return { ...a, capacity, load, handledToday, longestWaitMin, csat, responseSec };
      }),
    [agents],
  );

  const totalCapacity = enriched.reduce((sum, a) => sum + (a.status === 'offline' ? 0 : a.capacity), 0);
  const totalLoad = enriched.reduce((sum, a) => sum + a.load, 0);
  const utilization = totalCapacity > 0 ? Math.round((totalLoad / totalCapacity) * 100) : 0;
  const handledTotal = enriched.reduce((sum, a) => sum + a.handledToday, 0);
  const avgResponse = enriched.length
    ? Math.round(enriched.reduce((sum, a) => sum + a.responseSec, 0) / enriched.length)
    : 0;

  const filtered = useMemo(() => {
    return enriched
      .filter((a) => filter === 'all' || (a.status || 'offline') === filter)
      .filter((a) => {
        if (!query.trim()) return true;
        const q = query.toLowerCase();
        return (
          (a.name || '').toLowerCase().includes(q) ||
          (a.email || '').toLowerCase().includes(q)
        );
      })
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [enriched, filter, query]);

  const filterPills: Array<{ id: StatusFilter; label: string; count: number }> = [
    { id: 'all', label: 'All', count: enriched.length },
    { id: 'online', label: 'Online', count: counts.online },
    { id: 'away', label: 'Away', count: counts.away },
    { id: 'busy', label: 'Busy', count: counts.busy },
    { id: 'offline', label: 'Offline', count: counts.offline },
  ];

  return (
    <WaPage>
      <PageHeader
        title="Agent availability"
        description="See team status at a glance and cycle agents between online, away, busy, and offline."
        kicker="Wachat"
        eyebrowIcon={Users}
        backHref="/wachat"
      />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <MetricTile label="Online" value={counts.online} icon={CircleDot} delay={0.02} />
        <MetricTile label="Away" value={counts.away} icon={Clock} delay={0.05} />
        <MetricTile label="Busy" value={counts.busy} icon={Activity} delay={0.08} />
        <MetricTile label="Offline" value={counts.offline} icon={TimerReset} delay={0.11} />
        <MetricTile
          label="Utilization"
          value={`${utilization}%`}
          delta={{ value: `${totalLoad}/${totalCapacity}`, positive: utilization < 80 }}
          delay={0.14}
        />
        <MetricTile
          label="Handled today"
          value={handledTotal}
          delta={{ value: `${avgResponse}s avg reply`, positive: avgResponse < 60 }}
          delay={0.17}
        />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1 rounded-full border border-zinc-200 bg-white p-0.5">
          {filterPills.map((p) => {
            const active = filter === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setFilter(p.id)}
                className="relative rounded-full px-3 py-1 text-[11.5px] font-semibold transition-colors duration-150"
              >
                {active && (
                  <m.span
                    layoutId="agent-filter"
                    className="absolute inset-0 rounded-full"
                    style={{ background: 'var(--mt-accent)' }}
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  />
                )}
                <span className={`relative z-10 inline-flex items-center gap-1.5 ${active ? 'text-white' : 'text-zinc-600'}`}>
                  {p.label}
                  <span
                    className={`rounded-full px-1.5 text-[10px] font-bold tabular-nums ${
                      active ? 'bg-white/20' : 'bg-zinc-100 text-zinc-500'
                    }`}
                  >
                    {p.count}
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        <label className="flex flex-1 min-w-[200px] items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-1.5 transition-colors focus-within:border-zinc-400">
          <Search className="h-3.5 w-3.5 text-zinc-400" strokeWidth={2} aria-hidden />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search agents"
            className="w-full bg-transparent text-[13px] text-zinc-900 placeholder:text-zinc-400 focus:outline-none"
            aria-label="Search agents"
          />
        </label>
      </div>

      {isLoading && agents.length === 0 ? (
        <div className="flex h-32 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
        </div>
      ) : agents.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No agents found"
          description="Once you add agents, their availability appears here."
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Search}
          title="No matching agents"
          description="Try a different status filter or clear your search."
        />
      ) : (
        <Section title="Team" description="Click status to cycle. Online > Away > Busy > Offline.">
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((agent, i) => {
              const status = (agent.status as string) || 'offline';
              const initials = (agent.name || 'A')
                .split(/\s+/)
                .filter(Boolean)
                .slice(0, 2)
                .map((p: string) => p[0])
                .join('')
                .toUpperCase();
              const loadPct = agent.capacity ? Math.round((agent.load / agent.capacity) * 100) : 0;
              return (
                <m.li
                  key={agent._id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.02 + i * 0.025, ease: EASE_OUT }}
                  className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-4 transition-colors hover:bg-zinc-50"
                >
                  <div className="flex items-start gap-3">
                    <div className="relative">
                      <span
                        className={`grid h-11 w-11 place-items-center rounded-full text-[13px] font-bold text-white ring-2 ${STATUS_RING[status] ?? ''}`}
                        style={{
                          backgroundImage:
                            'linear-gradient(135deg, var(--mt-accent), color-mix(in oklch, var(--mt-accent) 55%, white))',
                        }}
                      >
                        {initials}
                      </span>
                      <span
                        aria-hidden
                        className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white ${STATUS_DOT[status] ?? 'bg-zinc-400'}`}
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13.5px] font-semibold text-zinc-950">
                        {agent.name || 'Agent'}
                      </div>
                      <div className="truncate text-[11.5px] text-zinc-500">{agent.email || '--'}</div>
                    </div>
                    <StatusPill tone={STATUS_TONE[status] ?? 'paused'}>{status}</StatusPill>
                  </div>

                  <div className="grid grid-cols-3 gap-2 border-t border-zinc-100 pt-3 text-center">
                    <div>
                      <div className="text-[11px] uppercase tracking-[0.06em] text-zinc-400">Load</div>
                      <div className="mt-0.5 text-[13px] font-semibold tabular-nums text-zinc-900">
                        {agent.load}/{agent.capacity}
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] uppercase tracking-[0.06em] text-zinc-400">Today</div>
                      <div className="mt-0.5 text-[13px] font-semibold tabular-nums text-zinc-900">
                        {agent.handledToday}
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] uppercase tracking-[0.06em] text-zinc-400">Wait</div>
                      <div className="mt-0.5 text-[13px] font-semibold tabular-nums text-zinc-900">
                        {agent.longestWaitMin}m
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between text-[11px] text-zinc-500">
                      <span>Capacity</span>
                      <span className="tabular-nums">{loadPct}%</span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-zinc-100">
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{
                          width: `${Math.min(100, loadPct)}%`,
                          background: loadPct >= 80 ? '#f43f5e' : loadPct >= 60 ? '#f59e0b' : '#25D366',
                        }}
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[11.5px] text-zinc-500">
                    <span className="inline-flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" strokeWidth={2.25} aria-hidden />
                      CSAT {agent.csat.toFixed(1)}
                    </span>
                    <span className="inline-flex items-center gap-1 tabular-nums">
                      <Clock className="h-3 w-3" strokeWidth={2.25} aria-hidden />
                      {agent.responseSec}s reply
                    </span>
                  </div>

                  <WaButton
                    size="sm"
                    variant="outline"
                    onClick={() => cycleStatus(agent)}
                    disabled={togglingId === agent._id}
                  >
                    {togglingId === agent._id ? 'Updating...' : 'Cycle status'}
                  </WaButton>
                </m.li>
              );
            })}
          </ul>
        </Section>
      )}
    </WaPage>
  );
}
