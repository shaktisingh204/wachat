'use client';

import * as React from 'react';
import {
  Card,
  StatCard,
  PageHeader,
  PageHeaderHeading,
  PageEyebrow,
  PageTitle,
  PageDescription,
  Skeleton,
} from '@/components/sabcrm/20ui';
import { PhoneCall, PhoneIncoming, PhoneOutgoing, PercentCircle, Clock } from 'lucide-react';
import { getCallAnalytics, type CallAnalytics } from './actions';

/** `83` (secs) → `1m 23s`; `45` → `45s`. */
function formatDuration(secs: number): string {
  if (secs <= 0) return '0s';
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

/** `2026-06-14` → `Jun 14` for the per-day rows. */
function formatDay(date: string): string {
  const d = new Date(`${date}T00:00:00`);
  if (Number.isNaN(d.getTime())) return date;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function SabCallAnalyticsPage() {
  const [data, setData] = React.useState<CallAnalytics | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await getCallAnalytics();
        if (cancelled) return;
        if (res.ok) setData(res.data);
        else setError(res.error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const maxCount = data ? Math.max(1, ...data.byDay.map((d) => d.count)) : 1;

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-[var(--st-space-6)]">
      <PageHeader>
        <PageHeaderHeading>
          <PageEyebrow>SabCall</PageEyebrow>
          <PageTitle>Analytics</PageTitle>
          <PageDescription>
            Call volume, answer rate, and direction trends from the last 14 days of CDRs.
          </PageDescription>
        </PageHeaderHeading>
      </PageHeader>

      <section aria-label="Call metrics">
        {loading ? (
          <div className="grid grid-cols-2 gap-[var(--st-space-3)] md:grid-cols-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-[88px] w-full" />
            ))}
          </div>
        ) : error ? (
          <Card>
            <div className="text-sm text-[var(--st-text-secondary)]">{error}</div>
          </Card>
        ) : data ? (
          <div className="grid grid-cols-2 gap-[var(--st-space-3)] md:grid-cols-5">
            <StatCard label="Total calls" value={data.total} icon={PhoneCall} accent="#0ea5e9" />
            <StatCard
              label="Answer rate"
              value={`${Math.round(data.answerRate * 100)}%`}
              icon={PercentCircle}
              accent="#1f9d55"
            />
            <StatCard label="Inbound" value={data.inbound} icon={PhoneIncoming} accent="#3b7af5" />
            <StatCard
              label="Outbound"
              value={data.outbound}
              icon={PhoneOutgoing}
              accent="#7c3aed"
            />
            <StatCard
              label="Avg duration"
              value={formatDuration(data.avgDurationSecs)}
              icon={Clock}
              accent="#d97706"
            />
          </div>
        ) : null}
      </section>

      <section aria-label="Calls per day" className="flex flex-col gap-[var(--st-space-3)]">
        <h2 className="text-sm font-medium text-[var(--st-text-secondary)]">Calls per day</h2>
        {loading ? (
          <Skeleton className="h-[320px] w-full" />
        ) : data ? (
          <Card className="flex flex-col gap-[var(--st-space-3)]">
            {data.total === 0 ? (
              <div className="text-sm text-[var(--st-text-secondary)]">
                No calls recorded in this window yet.
              </div>
            ) : (
              data.byDay.map((d) => (
                <div key={d.date} className="flex items-center gap-[var(--st-space-3)]">
                  <div className="w-14 shrink-0 text-xs text-[var(--st-text-tertiary)]">
                    {formatDay(d.date)}
                  </div>
                  <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-[var(--st-surface-2)]">
                    <div
                      className="h-full rounded-full bg-[var(--st-accent)] transition-[width]"
                      style={{ width: `${(d.count / maxCount) * 100}%` }}
                    />
                  </div>
                  <div className="w-8 shrink-0 text-right text-xs font-medium tabular-nums text-[var(--st-text-secondary)]">
                    {d.count}
                  </div>
                </div>
              ))
            )}
          </Card>
        ) : null}
      </section>
    </main>
  );
}
