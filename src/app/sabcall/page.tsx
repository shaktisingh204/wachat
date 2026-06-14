'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  Card,
  StatCard,
  PageHeader,
  PageHeaderHeading,
  PageEyebrow,
  PageTitle,
  PageDescription,
  PageActions,
  Button,
  Skeleton,
} from '@/components/sabcrm/20ui';
import {
  Phone,
  Workflow,
  Layers,
  PhoneCall,
  Voicemail,
  Users,
  ChevronRight,
  Plus,
} from 'lucide-react';
import { getVoiceLiveKpis } from '@/app/actions/sabcall.actions';

type Kpis = {
  agentsAvailable: number;
  agentsBusy: number;
  agentsAway: number;
  agentsOffline: number;
  activeQueues: number;
  callsToday: number;
  activeCalls: number;
};

type Section = {
  href: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  accent: string;
};

const SECTIONS: Section[] = [
  {
    href: '/sabcall/dids',
    title: 'Phone numbers',
    description: 'Buy, route, and release DIDs across providers.',
    icon: <Phone className="h-5 w-5" aria-hidden="true" />,
    accent: '#3b7af5',
  },
  {
    href: '/sabcall/ivr',
    title: 'IVR flows',
    description: 'Build menu, playback, forward, and voicemail trees.',
    icon: <Workflow className="h-5 w-5" aria-hidden="true" />,
    accent: '#7c3aed',
  },
  {
    href: '/sabcall/queues',
    title: 'Call queues',
    description: 'Distribute calls with round-robin, least-busy, or ring-all.',
    icon: <Layers className="h-5 w-5" aria-hidden="true" />,
    accent: '#1f9d55',
  },
  {
    href: '/sabcall/calls',
    title: 'Call log',
    description: 'Browse the CDR with playback, filters, and status.',
    icon: <PhoneCall className="h-5 w-5" aria-hidden="true" />,
    accent: '#0ea5e9',
  },
  {
    href: '/sabcall/voicemail',
    title: 'Voicemail',
    description: 'Triage the inbox with transcripts and read receipts.',
    icon: <Voicemail className="h-5 w-5" aria-hidden="true" />,
    accent: '#d97706',
  },
  {
    href: '/sabcall/agent-dashboard',
    title: 'Agent dashboard',
    description: 'Watch live presence, active calls, and queue depth.',
    icon: <Users className="h-5 w-5" aria-hidden="true" />,
    accent: '#db2777',
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
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-[var(--st-space-6)]">
      <PageHeader>
        <PageHeaderHeading>
          <PageEyebrow>SabCall</PageEyebrow>
          <PageTitle>Cloud PBX</PageTitle>
          <PageDescription>
            Manage numbers, routing, queues, agents, and recordings from one console.
          </PageDescription>
        </PageHeaderHeading>
        <PageActions>
          <Button asChild variant="primary">
            <Link href="/sabcall/dids">
              <Plus className="h-4 w-4" aria-hidden="true" />
              Buy a number
            </Link>
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
            <StatCard
              label="Agents online"
              value={kpis.agentsAvailable + kpis.agentsBusy}
              icon={Users}
              accent="#1f9d55"
            />
            <StatCard
              label="Active calls"
              value={kpis.activeCalls}
              icon={PhoneCall}
              accent="#3b7af5"
            />
            <StatCard
              label="Calls today"
              value={kpis.callsToday}
              icon={Phone}
              accent="#0ea5e9"
            />
            <StatCard
              label="Active queues"
              value={kpis.activeQueues}
              icon={Layers}
              accent="#7c3aed"
            />
          </div>
        ) : null}
      </section>

      <section aria-label="Modules" className="flex flex-col gap-[var(--st-space-3)]">
        <h2 className="text-sm font-medium text-[var(--st-text-secondary)]">Modules</h2>
        <div className="grid grid-cols-1 gap-[var(--st-space-3)] sm:grid-cols-2 lg:grid-cols-3">
          {SECTIONS.map((s) => (
            <Link key={s.href} href={s.href} className="group block focus:outline-none">
              <Card
                variant="interactive"
                className="flex h-full flex-col gap-[var(--st-space-2)] group-focus-visible:ring-2 group-focus-visible:ring-[var(--st-accent)]"
              >
                <div className="flex items-start justify-between">
                  <span
                    className="flex h-10 w-10 items-center justify-center rounded-[var(--st-radius)]"
                    style={{ background: `${s.accent}1a`, color: s.accent }}
                  >
                    {s.icon}
                  </span>
                  <ChevronRight
                    className="h-4 w-4 text-[var(--st-text-tertiary)] transition-transform group-hover:translate-x-0.5 group-hover:text-[var(--st-accent)]"
                    aria-hidden="true"
                  />
                </div>
                <div className="font-medium text-[var(--st-text)]">{s.title}</div>
                <div className="text-sm text-[var(--st-text-secondary)]">{s.description}</div>
              </Card>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
