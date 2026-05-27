'use client';

import * as React from 'react';
import Link from 'next/link';
import { useEffect, useMemo, useState, useTransition, useCallback } from 'react';
import {
  Star,
  Loader2,
  MessageSquare,
  Clock,
  TrendingDown,
  TrendingUp,
  Users,
  ArrowUpRight,
} from 'lucide-react';
import { m } from 'motion/react';

import { useZoruToast, cn } from '@/components/zoruui';
import {
  WaPage,
  PageHeader,
  Section,
  MetricTile,
  EmptyState,
} from '@/components/wachat-ui';
import { EASE_OUT } from '@/components/dashboard-ui/module-theme';
import { fmtDate } from '@/lib/utils';
import { useProject } from '@/context/project-context';
import { getChatRatings } from '@/app/actions/wachat-features.actions';

/**
 * /wachat/chat-ratings - Customer satisfaction stream + rating
 * histogram. Adds per-rating-bucket avg response time, top-rated
 * agents leaderboard, and quick-open links to the lowest-rated
 * conversations.
 */

function Stars({ count, size = 'sm' }: { count: number; size?: 'sm' | 'md' }) {
  const cls = size === 'md' ? 'h-4 w-4' : 'h-3.5 w-3.5';
  return (
    <span className="inline-flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={cn(cls, i <= count ? 'fill-current' : 'text-zinc-200')}
          style={i <= count ? { color: 'var(--mt-accent)' } : undefined}
          strokeWidth={1.75}
          aria-hidden
        />
      ))}
    </span>
  );
}

function fmtSeconds(s?: number) {
  if (!s || !Number.isFinite(s)) return '--';
  if (s < 60) return `${Math.round(s)}s`;
  if (s < 3600) return `${Math.round(s / 60)}m`;
  return `${(s / 3600).toFixed(1)}h`;
}

export default function ChatRatingsPage() {
  const { activeProject } = useProject();
  const { toast } = useZoruToast();
  const [isPending, startTransition] = useTransition();
  const [ratings, setRatings] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>({});

  const load = useCallback(() => {
    if (!activeProject?._id) return;
    startTransition(async () => {
      const res = await getChatRatings(String(activeProject._id));
      if (res.error) {
        toast({ title: 'Error', description: res.error, variant: 'destructive' });
        return;
      }
      setRatings(res.ratings ?? []);
      setSummary(res.summary ?? {});
    });
  }, [activeProject?._id, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const avg = summary.avg ? summary.avg.toFixed(1) : '--';
  const total = summary.count ?? 0;
  const dist = [
    { stars: 5, count: summary.five ?? 0 },
    { stars: 4, count: summary.four ?? 0 },
    { stars: 3, count: summary.three ?? 0 },
    { stars: 2, count: summary.two ?? 0 },
    { stars: 1, count: summary.one ?? 0 },
  ];
  const maxDist = Math.max(...dist.map((d) => d.count), 1);
  const positiveShare = total > 0 ? Math.round(((dist[0].count + dist[1].count) / total) * 100) : 0;
  const negativeShare = total > 0 ? Math.round(((dist[3].count + dist[4].count) / total) * 100) : 0;

  // Per-bucket avg response time, derived only from records that carry one.
  const responseByBucket = useMemo(() => {
    const buckets = new Map<number, { sum: number; n: number }>();
    for (const r of ratings) {
      const t = Number(r.responseTimeSec ?? r.avgResponseTime ?? r.responseTime);
      if (!Number.isFinite(t)) continue;
      const b = buckets.get(r.rating) ?? { sum: 0, n: 0 };
      b.sum += t;
      b.n += 1;
      buckets.set(r.rating, b);
    }
    return buckets;
  }, [ratings]);

  // Top-rated agents leaderboard (only when agent attribution exists on records).
  const agentBoard = useMemo(() => {
    const byAgent = new Map<string, { name: string; sum: number; n: number }>();
    for (const r of ratings) {
      const name = r.agentName || r.agent || r.assignedAgent || null;
      if (!name) continue;
      const e = byAgent.get(name) ?? { name, sum: 0, n: 0 };
      e.sum += Number(r.rating) || 0;
      e.n += 1;
      byAgent.set(name, e);
    }
    return Array.from(byAgent.values())
      .filter((e) => e.n > 0)
      .map((e) => ({ name: e.name, avg: e.sum / e.n, n: e.n }))
      .sort((a, b) => b.avg - a.avg)
      .slice(0, 5);
  }, [ratings]);

  const lowest = useMemo(
    () => ratings.filter((r) => Number(r.rating) <= 2).slice(0, 5),
    [ratings],
  );

  return (
    <WaPage>
      <PageHeader
        title="Chat ratings"
        description="Customer satisfaction scores and feedback collected after conversations close."
        kicker="Wachat · ratings"
        backHref="/wachat"
        eyebrowIcon={Star}
      />

      {/* KPI strip */}
      <section aria-labelledby="ratings-summary" className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <h2 id="ratings-summary" className="sr-only">Ratings summary</h2>
        <MetricTile label="Average rating" value={avg} icon={Star} delay={0} />
        <MetricTile label="Total ratings" value={total.toLocaleString('en-IN')} icon={MessageSquare} delay={0.04} />
        <MetricTile
          label="Positive (4-5)"
          value={total > 0 ? `${positiveShare}%` : '--'}
          icon={TrendingUp}
          delta={total > 0 ? { value: `${dist[0].count + dist[1].count}`, positive: true } : undefined}
          delay={0.08}
        />
        <MetricTile
          label="Negative (1-2)"
          value={total > 0 ? `${negativeShare}%` : '--'}
          icon={TrendingDown}
          delta={total > 0 ? { value: `${dist[3].count + dist[4].count}`, positive: false } : undefined}
          delay={0.12}
        />
      </section>

      {isPending && ratings.length === 0 && (
        <div className="mb-6 flex h-32 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        {/* Distribution + per-bucket response time */}
        <Section title="Rating distribution" description={`Across ${total.toLocaleString('en-IN')} ratings.`}>
          <div className="space-y-3">
            {dist.map((d, i) => {
              const pct = (d.count / maxDist) * 100;
              const share = total > 0 ? Math.round((d.count / total) * 100) : 0;
              const rt = responseByBucket.get(d.stars);
              const rtAvg = rt && rt.n > 0 ? rt.sum / rt.n : null;
              return (
                <m.div
                  key={d.stars}
                  initial={{ opacity: 0, x: -4 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay: i * 0.04, ease: EASE_OUT }}
                  className="grid grid-cols-[56px_1fr_auto] items-center gap-3"
                >
                  <span className="flex items-center gap-1 text-[12.5px] font-medium text-zinc-700 tabular-nums">
                    {d.stars}
                    <Star className="h-3 w-3 fill-current" style={{ color: 'var(--mt-accent)' }} aria-hidden />
                  </span>
                  <div className="flex items-center gap-2">
                    <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-zinc-100">
                      <m.div
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.5, delay: 0.1 + i * 0.04, ease: EASE_OUT }}
                        className="h-full rounded-full"
                        style={{ background: 'var(--mt-accent)' }}
                      />
                    </div>
                    <span className="w-10 shrink-0 text-right text-[11px] text-zinc-400 tabular-nums">
                      {share}%
                    </span>
                  </div>
                  <div className="flex w-32 items-center justify-end gap-3 text-[11.5px] text-zinc-500 tabular-nums">
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3 w-3" strokeWidth={2} aria-hidden />
                      {fmtSeconds(rtAvg ?? undefined)}
                    </span>
                    <span className="w-10 text-right text-zinc-600">{d.count.toLocaleString('en-IN')}</span>
                  </div>
                </m.div>
              );
            })}
          </div>
          <p className="mt-3 text-[11px] text-zinc-500">
            Response time column shows the average first-response time for conversations that earned each rating.
          </p>
        </Section>

        {/* Recent ratings */}
        <Section
          title="Recent ratings"
          description="The latest 20 customer responses."
          padded={false}
        >
          {ratings.length === 0 && !isPending ? (
            <div className="p-5">
              <EmptyState
                icon={Star}
                title="No ratings yet"
                description="Once customers rate their conversations, their feedback will show up here."
              />
            </div>
          ) : (
            <ul className="divide-y divide-zinc-100">
              {ratings.slice(0, 20).map((r, i) => (
                <m.li
                  key={r._id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: i * 0.03, ease: EASE_OUT }}
                  className="flex items-start gap-3 px-4 py-2.5"
                >
                  <Stars count={r.rating} />
                  <div className="min-w-0 flex-1">
                    {r.feedback ? (
                      <p className="line-clamp-2 text-[12.5px] leading-snug text-zinc-800">{r.feedback}</p>
                    ) : (
                      <p className="text-[12px] italic text-zinc-400">No feedback provided</p>
                    )}
                    <div className="mt-0.5 flex items-center gap-2 text-[11px] text-zinc-400">
                      {(r.contactName || r.contactId) && (
                        <span className="truncate font-mono">{r.contactName || r.contactId}</span>
                      )}
                      {(r.agentName || r.agent) && (
                        <span className="inline-flex items-center gap-1">
                          <Users className="h-3 w-3" strokeWidth={2} aria-hidden />
                          {r.agentName || r.agent}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className="text-[11px] text-zinc-400 tabular-nums">
                      {r.createdAt ? fmtDate(r.createdAt) : '--'}
                    </span>
                    {r.contactId && (
                      <Link
                        href={`/wachat/chat?contactId=${r.contactId}`}
                        className="inline-flex items-center gap-0.5 text-[11px] font-semibold"
                        style={{ color: 'var(--mt-accent)' }}
                      >
                        Open <ArrowUpRight className="h-3 w-3" strokeWidth={2.25} aria-hidden />
                      </Link>
                    )}
                  </div>
                </m.li>
              ))}
            </ul>
          )}
        </Section>
      </div>

      {/* Secondary rail: agent leaderboard + lowest-rated quick-opens */}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Section title="Top-rated agents" description="Highest average score, agents with at least one rating.">
          {agentBoard.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No agent attribution"
              description="Once ratings carry agent metadata, the leaderboard will populate here."
            />
          ) : (
            <ul className="divide-y divide-zinc-100">
              {agentBoard.map((a, i) => (
                <m.li
                  key={a.name}
                  initial={{ opacity: 0, x: -4 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay: i * 0.04, ease: EASE_OUT }}
                  className="flex items-center gap-3 py-2"
                >
                  <span className="grid h-7 w-7 place-items-center rounded-full bg-zinc-100 text-[11px] font-bold text-zinc-700 tabular-nums">
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-zinc-900">{a.name}</span>
                  <Stars count={Math.round(a.avg)} />
                  <span className="w-14 text-right text-[12px] font-semibold tabular-nums text-zinc-900">
                    {a.avg.toFixed(2)}
                  </span>
                  <span className="w-16 text-right text-[11px] text-zinc-400 tabular-nums">
                    {a.n} rate{a.n === 1 ? '' : 's'}
                  </span>
                </m.li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Lowest-rated conversations" description="One- or two-star feedback flagged for review.">
          {lowest.length === 0 ? (
            <EmptyState
              icon={TrendingDown}
              title="No low ratings"
              description="No conversations have rated 2 stars or below."
            />
          ) : (
            <ul className="divide-y divide-zinc-100">
              {lowest.map((r, i) => (
                <m.li
                  key={r._id}
                  initial={{ opacity: 0, x: -4 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay: i * 0.04, ease: EASE_OUT }}
                  className="flex items-start gap-3 py-2"
                >
                  <Stars count={r.rating} />
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-1 text-[12.5px] text-zinc-800">{r.feedback || '(no feedback)'}</p>
                    <span className="text-[11px] font-mono text-zinc-400">{r.contactName || r.contactId || '--'}</span>
                  </div>
                  {r.contactId && (
                    <Link
                      href={`/wachat/chat?contactId=${r.contactId}`}
                      className="inline-flex items-center gap-0.5 text-[11px] font-semibold"
                      style={{ color: 'var(--mt-accent)' }}
                    >
                      Open <ArrowUpRight className="h-3 w-3" strokeWidth={2.25} aria-hidden />
                    </Link>
                  )}
                </m.li>
              ))}
            </ul>
          )}
        </Section>
      </div>
    </WaPage>
  );
}
