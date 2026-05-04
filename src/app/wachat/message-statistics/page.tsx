'use client';

import * as React from 'react';
import { useEffect, useState, useTransition, useCallback } from 'react';
import { LuChartBar, LuMessageSquare, LuArrowDownLeft, LuArrowUpRight, LuImage, LuLoader } from 'react-icons/lu';
import { useProject } from '@/context/project-context';
import { useToast } from '@/hooks/use-toast';
import { ClayBreadcrumbs, ClayCard } from '@/components/clay';
import { getMessageStatistics } from '@/app/actions/wachat-features.actions';

type Period = 'daily' | 'weekly' | 'monthly';

export default function MessageStatisticsPage() {
  const { activeProject } = useProject();
  const { toast } = useToast();
  const projectId = activeProject?._id?.toString();
  const [period, setPeriod] = useState<Period>('daily');
  const [stats, setStats] = useState({ total: 0, incoming: 0, outgoing: 0, media: 0 });
  const [isLoading, startTransition] = useTransition();

  const fetchData = useCallback(() => {
    if (!projectId) return;
    startTransition(async () => {
      const res = await getMessageStatistics(projectId, period);
      if (res.error) { toast({ title: 'Error', description: res.error, variant: 'destructive' }); return; }
      if (res.stats) setStats(res.stats);
    });
  }, [projectId, period]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const cards = [
    { label: 'Total Messages', value: stats.total, icon: LuMessageSquare, color: 'text-blue-500' },
    { label: 'Incoming', value: stats.incoming, icon: LuArrowDownLeft, color: 'text-green-500' },
    { label: 'Outgoing', value: stats.outgoing, icon: LuArrowUpRight, color: 'text-amber-500' },
    { label: 'Media Messages', value: stats.media, icon: LuImage, color: 'text-purple-500' },
  ];

  const barValues = [stats.incoming, stats.outgoing, stats.media];
  const barLabels = ['Incoming', 'Outgoing', 'Media'];
  const barColors = ['bg-emerald-400', 'bg-amber-400', 'bg-violet-400'];
  const maxVal = Math.max(...barValues, 1);

  return (
    <div className="clay-enter flex min-h-full flex-col gap-6">
      <ClayBreadcrumbs items={[
        { label: 'Wachat', href: '/dashboard' },
        { label: activeProject?.name || 'Project', href: '/wachat' },
        { label: 'Message Statistics' },
      ]} />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[30px] font-semibold tracking-[-0.015em] text-foreground leading-[1.1]">Message Statistics</h1>
          <p className="mt-1.5 text-[13px] text-muted-foreground">Monitor your message volume and engagement metrics.</p>
        </div>
        <div className="flex rounded-lg border border-border overflow-hidden">
          {(['daily', 'weekly', 'monthly'] as const).map((p) => (
            <button key={p} onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 text-[12px] font-medium capitalize transition-colors ${period === p ? 'bg-foreground text-white' : 'bg-background text-muted-foreground hover:bg-muted'}`}>
              {p}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="flex min-h-[200px] items-center justify-center">
          <LuLoader className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {cards.map((c) => (
              <ClayCard key={c.label} padded={false} className="p-5">
                <div className="flex items-center gap-3">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-full bg-muted ${c.color}`}>
                    <c.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-[11px] text-muted-foreground uppercase tracking-wide">{c.label}</p>
                    <p className="text-[22px] font-semibold text-foreground">{c.value.toLocaleString()}</p>
                  </div>
                </div>
              </ClayCard>
            ))}
          </div>

          <ClayCard padded={false} className="p-5">
            <h2 className="text-[15px] font-semibold text-foreground mb-4">
              <LuChartBar className="inline mr-2 h-4 w-4" />Volume Breakdown
            </h2>
            <div className="flex items-end gap-6 h-48">
              {barValues.map((val, i) => (
                <div key={barLabels[i]} className="flex flex-1 flex-col items-center gap-1">
                  <span className="text-[13px] font-semibold text-foreground tabular-nums">{val.toLocaleString()}</span>
                  <div
                    className={`w-full max-w-[80px] rounded-t-md ${barColors[i]} transition-all`}
                    style={{ height: `${(val / maxVal) * 100}%`, minHeight: 4 }}
                  />
                  <span className="text-[11px] text-muted-foreground">{barLabels[i]}</span>
                </div>
              ))}
            </div>
          </ClayCard>
        </>
      )}
      <div className="h-6" />
    </div>
  );
}
