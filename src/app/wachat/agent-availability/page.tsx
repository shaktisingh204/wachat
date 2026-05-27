'use client';

import { useZoruToast } from '@/components/zoruui';
import { useEffect, useState, useTransition, useCallback } from 'react';
import { Users, Loader2 } from 'lucide-react';
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
  offline: 'paused',
};

const STATUS_DOT: Record<string, string> = {
  online: 'bg-emerald-500',
  away: 'bg-amber-500',
  offline: 'bg-zinc-400',
};

export default function AgentAvailabilityPage() {
  const { activeProject } = useProject();
  const { toast } = useZoruToast();
  const projectId = activeProject?._id?.toString();

  const [agents, setAgents] = useState<any[]>([]);
  const [isLoading, startLoading] = useTransition();
  const [togglingId, setTogglingId] = useState<string | null>(null);

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
    const next =
      agent.status === 'online'
        ? 'away'
        : agent.status === 'away'
          ? 'offline'
          : 'online';
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

  const counts = { online: 0, away: 0, offline: 0 };
  agents.forEach((a) => {
    counts[a.status as keyof typeof counts] = (counts[a.status as keyof typeof counts] || 0) + 1;
  });

  return (
    <WaPage>
      <PageHeader
        title="Agent availability"
        description="See team status at a glance and toggle agents between online, away, and offline."
        kicker="Wachat"
        eyebrowIcon={Users}
        backHref="/wachat"
      />

      <div className="mb-8 grid grid-cols-3 gap-3">
        <MetricTile label="Online" value={counts.online} delay={0.02} />
        <MetricTile label="Away" value={counts.away} delay={0.06} />
        <MetricTile label="Offline" value={counts.offline} delay={0.1} />
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
      ) : (
        <Section title="Team" description="Cycle status with one click. Order is alphabetical.">
          <ul className="space-y-2">
            {agents.map((agent, i) => {
              const status = (agent.status as string) || 'offline';
              const initials = (agent.name || 'A')
                .split(/\s+/)
                .filter(Boolean)
                .slice(0, 2)
                .map((p: string) => p[0])
                .join('')
                .toUpperCase();
              return (
                <m.li
                  key={agent._id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.28, delay: 0.02 + i * 0.03, ease: EASE_OUT }}
                  className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3 transition-colors hover:bg-zinc-50"
                >
                  <div className="relative">
                    <span
                      className="grid h-9 w-9 place-items-center rounded-full text-[12px] font-bold text-white"
                      style={{
                        backgroundImage:
                          'linear-gradient(135deg, var(--mt-accent), color-mix(in oklch, var(--mt-accent) 55%, white))',
                      }}
                    >
                      {initials}
                    </span>
                    <span
                      aria-hidden
                      className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white ${STATUS_DOT[status] ?? 'bg-zinc-400'}`}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13.5px] font-semibold text-zinc-950">
                      {agent.name || 'Agent'}
                    </div>
                    <div className="truncate text-[11.5px] text-zinc-500">{agent.email || '--'}</div>
                  </div>
                  <StatusPill tone={STATUS_TONE[status] ?? 'paused'}>{status}</StatusPill>
                  <WaButton
                    size="sm"
                    variant="outline"
                    onClick={() => cycleStatus(agent)}
                    disabled={togglingId === agent._id}
                  >
                    {togglingId === agent._id ? 'Updating...' : 'Toggle'}
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
