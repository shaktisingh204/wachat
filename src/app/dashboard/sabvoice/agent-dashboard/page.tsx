'use client';

import * as React from 'react';
import {
  Button,
  Badge,
  Card,
  StatCard,
  Avatar,
  AvatarFallback,
} from '@/components/zoruui';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import {
  PhoneCall,
  Users,
  Layers,
  Activity,
  Circle,
} from 'lucide-react';
import {
  listAgentPresence,
  getVoiceLiveKpis,
} from '@/app/actions/voice.actions';

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

const STATUS_COLOR: Record<Agent['status'], string> = {
  available: 'text-green-500',
  busy: 'text-amber-500',
  away: 'text-blue-500',
  offline: 'text-zoru-ink-muted',
};

export default function VoiceAgentDashboardPage() {
  const [agents, setAgents] = React.useState<Agent[]>([]);
  const [kpis, setKpis] = React.useState<Kpis | null>(null);
  const [loading, setLoading] = React.useState(true);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const [a, k] = await Promise.all([listAgentPresence(), getVoiceLiveKpis()]);
      if (a.success) setAgents(a.data as Agent[]);
      if (k.success) setKpis(k.data);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
    const i = setInterval(load, 10000); // live-poll every 10s
    return () => clearInterval(i);
  }, [load]);

  return (
    <EntityListShell
      title="Live Agent Dashboard"
      subtitle="Real-time agent availability, active calls, and queue depth."
      primaryAction={
        <Button variant="outline" onClick={load}>
          <Activity className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      }
      loading={loading}
    >
      {kpis && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <StatCard
            label="Available"
            value={kpis.agentsAvailable}
            icon={<Circle className="h-4 w-4 fill-green-500 text-green-500" />}
          />
          <StatCard
            label="On Call"
            value={kpis.agentsBusy}
            icon={<PhoneCall className="h-4 w-4 text-amber-500" />}
          />
          <StatCard
            label="Active Calls"
            value={kpis.activeCalls}
            icon={<Activity className="h-4 w-4 text-zoru-brand" />}
          />
          <StatCard
            label="Calls Today"
            value={kpis.callsToday}
            icon={<PhoneCall className="h-4 w-4" />}
          />
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {kpis && (
          <>
            <StatCard
              label="Away"
              value={kpis.agentsAway}
              icon={<Circle className="h-4 w-4 fill-blue-500 text-blue-500" />}
            />
            <StatCard
              label="Offline"
              value={kpis.agentsOffline}
              icon={<Circle className="h-4 w-4 fill-zoru-ink-muted text-zoru-ink-muted" />}
            />
            <StatCard
              label="Active Queues"
              value={kpis.activeQueues}
              icon={<Layers className="h-4 w-4" />}
            />
          </>
        )}
      </div>

      <Card className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Users className="h-4 w-4 text-zoru-brand" />
          <span className="font-medium">Agents</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {agents.map((a) => (
            <div
              key={a.agentUserId}
              className="border border-zoru-line rounded-lg p-3 flex items-center gap-3"
            >
              <Avatar>
                <AvatarFallback>
                  {(a.displayName ?? a.agentUserId).slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">
                  {a.displayName ?? a.agentUserId}
                </div>
                <div className="flex items-center gap-1 text-xs">
                  <Circle className={`h-2 w-2 fill-current ${STATUS_COLOR[a.status]}`} />
                  <span className={`capitalize ${STATUS_COLOR[a.status]}`}>
                    {a.status}
                  </span>
                  {a.activeCallId && (
                    <Badge variant="secondary" className="ml-2 text-[10px]">
                      on call
                    </Badge>
                  )}
                </div>
                {a.queueIds && a.queueIds.length > 0 && (
                  <div className="text-[10px] text-zoru-ink-muted">
                    {a.queueIds.length} queue(s)
                  </div>
                )}
              </div>
            </div>
          ))}
          {agents.length === 0 && (
            <div className="col-span-full text-center text-zoru-ink-muted py-6">
              No agent presence data yet. Agents will appear as they log in.
            </div>
          )}
        </div>
      </Card>
    </EntityListShell>
  );
}
