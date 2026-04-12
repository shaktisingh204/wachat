'use client';

/**
 * Wachat Response Time Tracker — view response time metrics per agent.
 */

import * as React from 'react';
import { LuClock, LuZap, LuTrendingDown, LuTrendingUp } from 'react-icons/lu';
import { useProject } from '@/context/project-context';
import { useToast } from '@/hooks/use-toast';
import { ClayBreadcrumbs, ClayCard } from '@/components/clay';

const AGENTS = [
  { name: 'Rahul S.', avgFirst: '1m 12s', avgResolution: '8m 30s', handled: 142 },
  { name: 'Priya P.', avgFirst: '45s', avgResolution: '6m 15s', handled: 198 },
  { name: 'Amit K.', avgFirst: '2m 05s', avgResolution: '12m 45s', handled: 87 },
  { name: 'Sneha G.', avgFirst: '55s', avgResolution: '7m 20s', handled: 165 },
  { name: 'Vikram J.', avgFirst: '1m 30s', avgResolution: '10m 10s', handled: 112 },
];

const STATS = [
  { label: 'Avg First Response', value: '1m 18s', icon: LuClock, tone: 'blue' },
  { label: 'Avg Resolution Time', value: '8m 56s', icon: LuTrendingDown, tone: 'green' },
  { label: 'Fastest Response', value: '12s', icon: LuZap, tone: 'amber' },
  { label: 'Slowest Response', value: '5m 42s', icon: LuTrendingUp, tone: 'rose' },
];

export default function ResponseTimeTrackerPage() {
  const { activeProject } = useProject();
  const { toast } = useToast();

  return (
    <div className="clay-enter flex min-h-full flex-col gap-6">
      <ClayBreadcrumbs items={[
        { label: 'Wachat', href: '/home' },
        { label: activeProject?.name || 'Project', href: '/dashboard' },
        { label: 'Response Time Tracker' },
      ]} />

      <div>
        <h1 className="text-[30px] font-semibold tracking-[-0.015em] text-clay-ink leading-[1.1]">Response Time Tracker</h1>
        <p className="mt-1.5 text-[13px] text-clay-ink-muted">Monitor how quickly your team responds to customer messages.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {STATS.map((s) => (
          <ClayCard key={s.label} padded={false} className="flex items-center gap-4 p-5">
            <span className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-clay-surface-2">
              <s.icon className="h-5 w-5 text-clay-ink-muted" strokeWidth={1.75} />
            </span>
            <div>
              <div className="text-[12px] text-clay-ink-muted">{s.label}</div>
              <div className="text-[22px] font-semibold text-clay-ink leading-tight">{s.value}</div>
            </div>
          </ClayCard>
        ))}
      </div>

      <ClayCard padded={false} className="overflow-x-auto">
        <div className="px-5 py-4 border-b border-clay-border">
          <h2 className="text-[15px] font-semibold text-clay-ink">Per-Agent Breakdown</h2>
        </div>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-clay-border text-[11px] font-semibold uppercase tracking-wide text-clay-ink-muted">
              <th className="px-5 py-3">Agent</th>
              <th className="px-5 py-3">Avg First Response</th>
              <th className="px-5 py-3">Avg Resolution</th>
              <th className="px-5 py-3 text-right">Handled</th>
            </tr>
          </thead>
          <tbody>
            {AGENTS.map((a) => (
              <tr key={a.name} className="border-b border-clay-border last:border-0">
                <td className="px-5 py-3 font-medium text-[13px] text-clay-ink">{a.name}</td>
                <td className="px-5 py-3 text-[13px] text-clay-ink tabular-nums">{a.avgFirst}</td>
                <td className="px-5 py-3 text-[13px] text-clay-ink tabular-nums">{a.avgResolution}</td>
                <td className="px-5 py-3 text-right text-[13px] text-clay-ink tabular-nums">{a.handled}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </ClayCard>
      <div className="h-6" />
    </div>
  );
}
