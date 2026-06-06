'use client';

import * as React from 'react';
import Link from 'next/link';
import { Card, StatCard } from '@/components/sabcrm/20ui/compat';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import {
  Phone,
  Workflow,
  Layers,
  PhoneCall,
  Voicemail,
  Users,
  ChevronRight,
  ScreenShare,
} from 'lucide-react';
import { getVoiceLiveKpis } from '@/app/actions/sabvoice.actions';

type Kpis = {
  agentsAvailable: number;
  agentsBusy: number;
  agentsAway: number;
  agentsOffline: number;
  activeQueues: number;
  callsToday: number;
  activeCalls: number;
};

const SECTIONS: Array<{
  href: string;
  title: string;
  description: string;
  icon: React.ReactNode;
}> = [
  {
    href: '/dashboard/sabvoice/dids',
    title: 'Phone Numbers',
    description: 'Buy, route, and release DIDs.',
    icon: <Phone className="h-5 w-5" />,
  },
  {
    href: '/dashboard/sabvoice/ivr',
    title: 'IVR Flows',
    description: 'Visual menu / forward / voicemail builder.',
    icon: <Workflow className="h-5 w-5" />,
  },
  {
    href: '/dashboard/sabvoice/queues',
    title: 'Call Queues',
    description: 'Round-robin / least-busy / simul-ring.',
    icon: <Layers className="h-5 w-5" />,
  },
  {
    href: '/dashboard/sabvoice/calls',
    title: 'Call Log',
    description: 'CDR with playback and filters.',
    icon: <PhoneCall className="h-5 w-5" />,
  },
  {
    href: '/dashboard/sabvoice/voicemail',
    title: 'Voicemail',
    description: 'Inbox, transcripts, read receipts.',
    icon: <Voicemail className="h-5 w-5" />,
  },
  {
    href: '/dashboard/sabvoice/agent-dashboard',
    title: 'Agent Dashboard',
    description: 'Live presence, active calls, queue depth.',
    icon: <Users className="h-5 w-5" />,
  },
  {
    href: '/dashboard/sabvoice/assist',
    title: 'Remote Assist',
    description: 'SabAssist screen-share sessions linked to live calls.',
    icon: <ScreenShare className="h-5 w-5" />,
  },
];

export default function VoiceCallHubPage() {
  const [kpis, setKpis] = React.useState<Kpis | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await getVoiceLiveKpis();
        if (!cancelled && res.success) setKpis(res.data);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <EntityListShell
      title="SabVoice"
      subtitle="Cloud PBX — manage numbers, IVRs, queues, agents, and recordings."
      loading={loading}
    >
      {kpis && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <StatCard label="Agents Online" value={kpis.agentsAvailable + kpis.agentsBusy} icon={<Users className="h-4 w-4" />} />
          <StatCard label="Active Calls" value={kpis.activeCalls} icon={<PhoneCall className="h-4 w-4" />} />
          <StatCard label="Calls Today" value={kpis.callsToday} icon={<Phone className="h-4 w-4" />} />
          <StatCard label="Active Queues" value={kpis.activeQueues} icon={<Layers className="h-4 w-4" />} />
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {SECTIONS.map((s) => (
          <Link key={s.href} href={s.href} className="group">
            <Card className="p-5 h-full hover:border-zoru-brand transition-colors">
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-lg bg-zoru-surface-2 flex items-center justify-center text-zoru-brand">
                  {s.icon}
                </div>
                <ChevronRight className="h-4 w-4 text-zoru-ink-muted group-hover:text-zoru-brand transition-colors" />
              </div>
              <div className="font-medium">{s.title}</div>
              <div className="text-sm text-zoru-ink-muted mt-1">
                {s.description}
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </EntityListShell>
  );
}
