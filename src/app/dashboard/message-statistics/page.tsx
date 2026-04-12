'use client';

/**
 * Wachat Message Statistics — daily/weekly/monthly message volume dashboard.
 */

import * as React from 'react';
import { useState } from 'react';
import { LuChartBar, LuMessageSquare, LuArrowDownLeft, LuArrowUpRight, LuImage } from 'react-icons/lu';
import { useProject } from '@/context/project-context';
import { ClayBreadcrumbs, ClayCard } from '@/components/clay';

type Period = 'daily' | 'weekly' | 'monthly';

const MOCK_STATS: Record<Period, { total: number; incoming: number; outgoing: number; media: number; daily: number[] }> = {
  daily:   { total: 142, incoming: 87, outgoing: 55, media: 23, daily: [18, 22, 15, 28, 20, 24, 15] },
  weekly:  { total: 983, incoming: 612, outgoing: 371, media: 148, daily: [120, 155, 138, 142, 160, 148, 120] },
  monthly: { total: 4210, incoming: 2580, outgoing: 1630, media: 720, daily: [980, 1120, 1050, 1060] },
};

const LABELS: Record<Period, string[]> = {
  daily: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
  weekly: ['W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7'],
  monthly: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
};

export default function MessageStatisticsPage() {
  const { activeProject } = useProject();
  const [period, setPeriod] = useState<Period>('daily');
  const stats = MOCK_STATS[period];
  const maxVal = Math.max(...stats.daily);

  const cards = [
    { label: 'Total Messages', value: stats.total, icon: LuMessageSquare, color: 'text-blue-500' },
    { label: 'Incoming', value: stats.incoming, icon: LuArrowDownLeft, color: 'text-green-500' },
    { label: 'Outgoing', value: stats.outgoing, icon: LuArrowUpRight, color: 'text-amber-500' },
    { label: 'Media Messages', value: stats.media, icon: LuImage, color: 'text-purple-500' },
  ];

  return (
    <div className="clay-enter flex min-h-full flex-col gap-6">
      <ClayBreadcrumbs
        items={[
          { label: 'Wachat', href: '/home' },
          { label: activeProject?.name || 'Project', href: '/dashboard' },
          { label: 'Message Statistics' },
        ]}
      />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[30px] font-semibold tracking-[-0.015em] text-clay-ink leading-[1.1]">
            Message Statistics
          </h1>
          <p className="mt-1.5 text-[13px] text-clay-ink-muted">
            Monitor your message volume and engagement metrics.
          </p>
        </div>
        <div className="flex rounded-lg border border-clay-border overflow-hidden">
          {(['daily', 'weekly', 'monthly'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 text-[12px] font-medium capitalize transition-colors ${
                period === p ? 'bg-clay-ink text-white' : 'bg-clay-bg text-clay-ink-muted hover:bg-clay-bg-2'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <ClayCard key={c.label} padded={false} className="p-5">
            <div className="flex items-center gap-3">
              <div className={`flex h-10 w-10 items-center justify-center rounded-full bg-clay-bg-2 ${c.color}`}>
                <c.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[11px] text-clay-ink-muted uppercase tracking-wide">{c.label}</p>
                <p className="text-[22px] font-semibold text-clay-ink">{c.value.toLocaleString()}</p>
              </div>
            </div>
          </ClayCard>
        ))}
      </div>

      {/* Bar chart */}
      <ClayCard padded={false} className="p-5">
        <h2 className="text-[15px] font-semibold text-clay-ink mb-4">
          <LuChartBar className="inline mr-2 h-4 w-4" />Volume Breakdown
        </h2>
        <div className="flex items-end gap-3 h-48">
          {stats.daily.map((val, i) => (
            <div key={i} className="flex flex-1 flex-col items-center gap-1">
              <span className="text-[11px] text-clay-ink-muted">{val}</span>
              <div
                className="w-full rounded-t-md bg-clay-rose transition-all"
                style={{ height: `${(val / maxVal) * 100}%`, minHeight: 4 }}
              />
              <span className="text-[10px] text-clay-ink-muted">{LABELS[period][i]}</span>
            </div>
          ))}
        </div>
      </ClayCard>
      <div className="h-6" />
    </div>
  );
}
