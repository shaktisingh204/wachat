'use client';

import * as React from 'react';
import {
  Button,
  Badge,
  Card,
  CardHeader,
  CardTitle,
  StatCard,
  Avatar,
  Dot,
  EmptyState,
  Skeleton,
  PageHeader,
  PageHeaderHeading,
  PageEyebrow,
  PageTitle,
  PageDescription,
  PageActions,
} from '@/components/sabcrm/20ui';
import { PhoneCall, Users, Layers, Activity, RefreshCw } from 'lucide-react';
import { listAgentPresence, getVoiceLiveKpis } from '@/app/actions/sabcall.actions';

type Agent = {
  _id?: string;
  agentUserId: string;
  status: 'available' | 'busy' | 'away' | 'offline';
  activeCallId?: string | null;
  queueIds?: string[];
  displayName?: string | null;
  lastChangeAt: string;
};

type Kpis = {
  agentsAvailable: number;
  agentsBusy: number;
  agentsAway: number;
  agentsOffline: number;
  activeQueues: number;
  callsToday: number;
  activeCalls: number;
};

const STATUS_TONE: Record<Agent['status'], React.ComponentProps<typeof Dot>['tone']> = {
  available: 'success',
  busy: 'danger',
  away: 'warning',
  offline: 'neutral',
};

export default function VoiceAgentDashboardPage() {
  const [agents, setAgents] = React.useState<Agent[]>([]);
  const [kpis, setKpis] = React.useState<Kpis | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);

  const load = React.useCallback(async (manual = false) => {
    if (manual) setRefreshing(true);
    try {
      const [a, k] = await Promise.all([listAgentPresence(), getVoiceLiveKpis()]);
      if (a.success) setAgents(a.data as Agent[]);
      if (k.success) setKpis(k.data);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
    const i = setInterval(() => void load(), 10000); // live-poll every 10s
    return () => clearInterval(i);
  }, [load]);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-[var(--st-space-5)]">
      <PageHeader>
        <PageHeaderHeading>
          <PageEyebrow>SabCall</PageEyebrow>
          <PageTitle>Agent dashboard</PageTitle>
          <PageDescription>
            Real-time agent availability, active calls, and queue depth. Refreshes every 10 seconds.
          </PageDescription>
        </PageHeaderHeading>
        <PageActions>
          <Button
            variant="outline"
            iconLeft={RefreshCw}
            loading={refreshing}
            onClick={() => load(true)}
            className="sc-press"
          >
            Refresh
          </Button>
        </PageActions>
      </PageHeader>

      <section aria-label="Live metrics">
        {loading ? (
          <div className="grid grid-cols-2 gap-[var(--st-space-3)] md:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-[88px] w-full" />
            ))}
          </div>
        ) : kpis ? (
          <div className="grid grid-cols-2 gap-[var(--st-space-3)] md:grid-cols-4">
            <StatCard label="Available" value={kpis.agentsAvailable} icon={Users} accent="#1f9d55" />
            <StatCard label="On call" value={kpis.agentsBusy} icon={PhoneCall} accent="#e0484e" />
            <StatCard label="Active calls" value={kpis.activeCalls} icon={Activity} accent="#3b7af5" />
            <StatCard label="Calls today" value={kpis.callsToday} icon={PhoneCall} accent="#0ea5e9" />
          </div>
        ) : null}
      </section>

      {kpis ? (
        <section aria-label="Secondary metrics" className="grid grid-cols-1 gap-[var(--st-space-3)] md:grid-cols-3">
          <StatCard label="Away" value={kpis.agentsAway} icon={Users} accent="#d97706" />
          <StatCard label="Offline" value={kpis.agentsOffline} icon={Users} accent="#64748b" />
          <StatCard label="Active queues" value={kpis.activeQueues} icon={Layers} accent="#7c3aed" />
        </section>
      ) : null}

      <Card variant="outlined">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-4 w-4 text-[var(--st-accent)]" aria-hidden="true" />
            Agents
          </CardTitle>
        </CardHeader>
        {loading ? (
          <div className="grid grid-cols-1 gap-[var(--st-space-3)] md:grid-cols-2 lg:grid-cols-3" aria-busy="true">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : agents.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No agent presence yet"
            description="Agents appear here as they sign in to the softphone."
          />
        ) : (
          <div className="grid grid-cols-1 gap-[var(--st-space-3)] md:grid-cols-2 lg:grid-cols-3">
            {agents.map((a) => (
              <div
                key={a.agentUserId}
                className="flex items-center gap-3 rounded-[var(--st-radius)] border border-[var(--st-border)] p-3"
              >
                <Avatar name={a.displayName ?? a.agentUserId} shape="round" />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium text-[var(--st-text)]">
                    {a.displayName ?? a.agentUserId}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-[var(--st-text-secondary)]">
                    <Dot tone={STATUS_TONE[a.status]} pulse={a.status === 'busy'} />
                    <span className="capitalize">{a.status}</span>
                    {a.activeCallId ? (
                      <Badge tone="danger" kind="soft" className="ml-1">
                        on call
                      </Badge>
                    ) : null}
                  </div>
                  {a.queueIds && a.queueIds.length > 0 ? (
                    <div className="text-xs tabular-nums text-[var(--st-text-tertiary)]">
                      {a.queueIds.length} queue(s)
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </main>
  );
}
