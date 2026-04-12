'use client';

/**
 * Wachat Credit Usage — billing and credit usage dashboard.
 */

import * as React from 'react';
import { LuCoins, LuTrendingUp, LuCalendar, LuTriangleAlert } from 'react-icons/lu';
import { useProject } from '@/context/project-context';
import { useToast } from '@/hooks/use-toast';
import { ClayBreadcrumbs, ClayCard } from '@/components/clay';

const CREDITS_REMAINING = 4250;
const CREDITS_USED = 15750;
const DAILY_AVG = 525;
const LOW_THRESHOLD = 5000;

const DAILY_USAGE = [
  { date: '2026-04-12', used: 620, type: 'Session + Template' },
  { date: '2026-04-11', used: 540, type: 'Template' },
  { date: '2026-04-10', used: 480, type: 'Session + Template' },
  { date: '2026-04-09', used: 510, type: 'Session' },
  { date: '2026-04-08', used: 590, type: 'Template' },
  { date: '2026-04-07', used: 320, type: 'Session' },
  { date: '2026-04-06', used: 410, type: 'Session + Template' },
  { date: '2026-04-05', used: 550, type: 'Template' },
  { date: '2026-04-04', used: 470, type: 'Session' },
  { date: '2026-04-03', used: 530, type: 'Session + Template' },
];

const maxUsed = Math.max(...DAILY_USAGE.map((d) => d.used), 1);

const STATS = [
  { label: 'Credits Remaining', value: CREDITS_REMAINING.toLocaleString(), icon: LuCoins },
  { label: 'Used This Month', value: CREDITS_USED.toLocaleString(), icon: LuTrendingUp },
  { label: 'Daily Average', value: DAILY_AVG.toLocaleString(), icon: LuCalendar },
];

export default function CreditUsagePage() {
  const { activeProject } = useProject();
  const { toast } = useToast();

  const isLow = CREDITS_REMAINING < LOW_THRESHOLD;
  const daysLeft = DAILY_AVG > 0 ? Math.floor(CREDITS_REMAINING / DAILY_AVG) : 0;

  return (
    <div className="clay-enter flex min-h-full flex-col gap-6">
      <ClayBreadcrumbs items={[
        { label: 'Wachat', href: '/home' },
        { label: activeProject?.name || 'Project', href: '/dashboard' },
        { label: 'Credit Usage' },
      ]} />

      <div>
        <h1 className="text-[30px] font-semibold tracking-[-0.015em] text-clay-ink leading-[1.1]">Credit Usage</h1>
        <p className="mt-1.5 text-[13px] text-clay-ink-muted">Monitor your messaging credit balance and daily usage.</p>
      </div>

      {isLow && (
        <div className="rounded-[12px] border border-amber-200 bg-amber-50 p-4 flex items-start gap-3">
          <LuTriangleAlert className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-[13px] font-semibold text-amber-800">Low credit balance</p>
            <p className="text-[12.5px] text-amber-700">
              You have approximately {daysLeft} days of credits remaining at current usage. Consider topping up soon.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {STATS.map((s) => (
          <ClayCard key={s.label} padded={false} className="flex items-center gap-4 p-5">
            <span className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-clay-surface-2">
              <s.icon className="h-5 w-5 text-clay-ink-muted" strokeWidth={1.75} />
            </span>
            <div>
              <div className="text-[12px] text-clay-ink-muted">{s.label}</div>
              <div className="text-[22px] font-semibold text-clay-ink leading-tight tabular-nums">{s.value}</div>
            </div>
          </ClayCard>
        ))}
      </div>

      <ClayCard padded={false} className="p-5">
        <h2 className="text-[15px] font-semibold text-clay-ink mb-4">Daily Usage</h2>
        <div className="space-y-2">
          <div className="grid grid-cols-[100px_80px_1fr_120px] gap-2 text-[11.5px] font-medium text-clay-ink-muted">
            <span>Date</span><span className="text-right">Credits</span><span /><span>Type</span>
          </div>
          {DAILY_USAGE.map((d) => (
            <div key={d.date} className="grid grid-cols-[100px_80px_1fr_120px] items-center gap-2 text-[13px] text-clay-ink">
              <span className="font-medium">{d.date}</span>
              <span className="text-right tabular-nums">{d.used}</span>
              <div className="h-5 w-full overflow-hidden rounded-full bg-clay-surface-2">
                <div className="h-full rounded-full bg-clay-rose transition-all" style={{ width: `${(d.used / maxUsed) * 100}%` }} />
              </div>
              <span className="text-[11.5px] text-clay-ink-muted">{d.type}</span>
            </div>
          ))}
        </div>
      </ClayCard>
      <div className="h-6" />
    </div>
  );
}
