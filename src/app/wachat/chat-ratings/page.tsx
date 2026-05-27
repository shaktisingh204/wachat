'use client';

import * as React from 'react';
import { useEffect, useState, useTransition, useCallback } from 'react';
import { Star, Loader2, MessageSquare } from 'lucide-react';
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
 * /wachat/chat-ratings — Customer satisfaction stream + rating histogram,
 * rebuilt on wachat-ui primitives. Filled stars use the emerald accent
 * via --mt-accent.
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

  return (
    <WaPage>
      <PageHeader
        title="Chat ratings"
        description="Customer satisfaction scores and feedback collected after conversations close."
        kicker="Wachat · ratings"
        backHref="/wachat"
        eyebrowIcon={Star}
      />

      {/* Summary metrics */}
      <section aria-labelledby="ratings-summary" className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <h2 id="ratings-summary" className="sr-only">Ratings summary</h2>
        <MetricTile label="Average rating" value={avg} icon={Star} delay={0} />
        <MetricTile label="Total ratings" value={total.toLocaleString('en-IN')} icon={MessageSquare} delay={0.05} />
        <MetricTile
          label="Positive (4-5 star)"
          value={total > 0 ? `${positiveShare}%` : '--'}
          delta={total > 0 ? { value: `${dist[0].count + dist[1].count}`, positive: true } : undefined}
          delay={0.1}
        />
      </section>

      {isPending && ratings.length === 0 && (
        <div className="mb-6 flex h-32 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        {/* Distribution */}
        <Section title="Rating distribution" description={`Across ${total.toLocaleString('en-IN')} ratings.`}>
          <div className="space-y-3">
            {dist.map((d, i) => {
              const pct = (d.count / maxDist) * 100;
              return (
                <m.div
                  key={d.stars}
                  initial={{ opacity: 0, x: -4 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay: i * 0.04, ease: EASE_OUT }}
                  className="flex items-center gap-3"
                >
                  <span className="flex w-14 items-center gap-1 text-[12.5px] font-medium text-zinc-700 tabular-nums">
                    {d.stars}
                    <Star className="h-3 w-3 fill-current" style={{ color: 'var(--mt-accent)' }} aria-hidden />
                  </span>
                  <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-zinc-100">
                    <m.div
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.5, delay: 0.1 + i * 0.04, ease: EASE_OUT }}
                      className="h-full rounded-full"
                      style={{ background: 'var(--mt-accent)' }}
                    />
                  </div>
                  <span className="w-10 text-right text-[12px] text-zinc-500 tabular-nums">
                    {d.count.toLocaleString('en-IN')}
                  </span>
                </m.div>
              );
            })}
          </div>
        </Section>

        {/* Recent ratings */}
        <Section
          title="Recent ratings"
          description="The latest 20 customer responses."
        >
          {ratings.length === 0 && !isPending ? (
            <EmptyState
              icon={Star}
              title="No ratings yet"
              description="Once customers rate their conversations, their feedback will show up here."
            />
          ) : (
            <ul className="divide-y divide-zinc-100">
              {ratings.slice(0, 20).map((r, i) => (
                <m.li
                  key={r._id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: i * 0.03, ease: EASE_OUT }}
                  className="flex items-start gap-3 py-3 first:pt-1"
                >
                  <Stars count={r.rating} />
                  <div className="min-w-0 flex-1">
                    {r.feedback ? (
                      <p className="text-[13px] leading-relaxed text-zinc-800">{r.feedback}</p>
                    ) : (
                      <p className="text-[12.5px] italic text-zinc-400">No feedback provided</p>
                    )}
                  </div>
                  <span className="shrink-0 text-[11px] text-zinc-400 tabular-nums">
                    {r.createdAt ? fmtDate(r.createdAt) : '--'}
                  </span>
                </m.li>
              ))}
            </ul>
          )}
        </Section>
      </div>
    </WaPage>
  );
}
