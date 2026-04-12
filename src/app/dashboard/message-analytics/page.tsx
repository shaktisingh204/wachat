'use client';

import * as React from 'react';
import { useEffect, useState, useTransition, useCallback } from 'react';
import { LuChartBar, LuArrowUpRight, LuArrowDownLeft, LuClock, LuLoader } from 'react-icons/lu';
import { useProject } from '@/context/project-context';
import { useToast } from '@/hooks/use-toast';
import { ClayBreadcrumbs, ClayButton, ClayCard, ClayBadge } from '@/components/clay';
import { getMessageAnalytics } from '@/app/actions/wachat-features.actions';

type DailyRow = { date: string; outgoing: number; incoming: number };

export default function MessageAnalyticsPage() {
  const { activeProject } = useProject();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [period, setPeriod] = useState<number>(7);
  const [rows, setRows] = useState<DailyRow[]>([]);
  const [totals, setTotals] = useState({ out: 0, inc: 0, avgMs: 0 });

  const load = useCallback(() => {
    if (!activeProject?._id) return;
    startTransition(async () => {
      const res = await getMessageAnalytics(String(activeProject._id), period);
      if (res.error) { toast({ title: 'Error', description: res.error, variant: 'destructive' }); return; }
      const map = new Map<string, { out: number; inc: number }>();
      (res.dailyData ?? []).forEach((d: any) => {
        const key = d._id.date;
        const cur = map.get(key) || { out: 0, inc: 0 };
        if (d._id.direction === 'out') cur.out += d.count;
        else cur.inc += d.count;
        map.set(key, cur);
      });
      const built: DailyRow[] = Array.from(map.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, v]) => ({ date, outgoing: v.out, incoming: v.inc }));
      const totalOut = built.reduce((s, r) => s + r.outgoing, 0);
      const totalInc = built.reduce((s, r) => s + r.incoming, 0);
      const avgMs = res.responseMetrics?.avgResponseMs ?? 0;
      setRows(built);
      setTotals({ out: totalOut, inc: totalInc, avgMs });
    });
  }, [activeProject?._id, period, toast]);

  useEffect(() => { load(); }, [load]);

  const maxTotal = Math.max(...rows.map((r) => r.outgoing + r.incoming), 1);

  const fmtTime = (ms: number) => {
    if (!ms) return '--';
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  const periods = [7, 14, 30] as const;

  return (
    <div className="clay-enter flex min-h-full flex-col gap-6">
      <ClayBreadcrumbs items={[
        { label: 'Wachat', href: '/home' },
        { label: activeProject?.name || 'Project', href: '/dashboard' },
        { label: 'Message Analytics' },
      ]} />

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[30px] font-semibold tracking-[-0.015em] text-clay-ink leading-[1.1]">Message Analytics</h1>
          <p className="mt-1.5 text-[13px] text-clay-ink-muted">Track outgoing and incoming message volume over time.</p>
        </div>
        <div className="flex gap-2">
          {periods.map((d) => (
            <ClayButton key={d} variant={period === d ? 'obsidian' : 'pill'} size="sm" onClick={() => setPeriod(d)}>
              {d} days
            </ClayButton>
          ))}
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          { label: 'Total Outgoing', value: totals.out, icon: LuArrowUpRight, tone: 'blue' as const },
          { label: 'Total Incoming', value: totals.inc, icon: LuArrowDownLeft, tone: 'green' as const },
          { label: 'Avg Response Time', value: fmtTime(totals.avgMs), icon: LuClock, tone: 'amber' as const },
        ].map((s) => (
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

      {/* Daily breakdown */}
      <ClayCard padded={false} className="p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-[15px] font-semibold text-clay-ink">Daily Breakdown</h2>
          {isPending && <LuLoader className="h-4 w-4 animate-spin text-clay-ink-muted" />}
        </div>
        {rows.length === 0 && !isPending && (
          <p className="py-8 text-center text-[13px] text-clay-ink-muted">No data for this period.</p>
        )}
        {rows.length > 0 && (
          <div className="space-y-2">
            {/* Header */}
            <div className="grid grid-cols-[110px_80px_80px_80px_1fr] gap-2 text-[11.5px] font-medium text-clay-ink-muted">
              <span>Date</span><span className="text-right">Out</span><span className="text-right">In</span><span className="text-right">Total</span><span />
            </div>
            {rows.map((r) => {
              const total = r.outgoing + r.incoming;
              return (
                <div key={r.date} className="grid grid-cols-[110px_80px_80px_80px_1fr] items-center gap-2 text-[13px] text-clay-ink">
                  <span className="font-medium">{r.date}</span>
                  <span className="text-right">{r.outgoing}</span>
                  <span className="text-right">{r.incoming}</span>
                  <span className="text-right font-semibold">{total}</span>
                  <div className="h-5 w-full overflow-hidden rounded-full bg-clay-surface-2">
                    <div className="h-full rounded-full bg-clay-rose transition-all" style={{ width: `${(total / maxTotal) * 100}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </ClayCard>
      <div className="h-6" />
    </div>
  );
}
