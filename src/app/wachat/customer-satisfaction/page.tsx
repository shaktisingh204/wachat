'use client';

import { useEffect, useState, useTransition, useCallback, useMemo } from 'react';
import {
  CircleCheck,
  CircleX,
  Inbox,
  MessageSquare,
  RefreshCw,
  Star,
  TriangleAlert,
  Trophy,
  TrendingUp,
} from 'lucide-react';
import { m, useReducedMotion } from 'motion/react';

import { useProject } from '@/context/project-context';
import { getChatRatings } from '@/app/actions/wachat-features.actions';
import { fmtDate } from '@/lib/utils';
import {
  WaPage,
  PageHeader,
  WaButton,
  MetricTile,
  Section,
  EmptyState,
  StatusPill,
} from '@/components/wachat-ui';
import { EASE_OUT } from '@/components/dashboard-ui/module-theme';
import {
  useZoruToast,
  ZoruChart,
  ZoruChartContainer,
  ZoruChartTooltip,
  ZoruDrawer,
  ZoruDrawerContent,
  ZoruDrawerDescription,
  ZoruDrawerHeader,
  ZoruDrawerTitle,
} from '@/components/zoruui';

/**
 * Wachat Customer Satisfaction - NPS-style dashboard rebuilt on wachat-ui chrome.
 */

function Stars({ count }: { count: number }) {
  return (
    <span className="inline-flex gap-0.5" aria-label={`${count} of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`h-3.5 w-3.5 ${i <= count ? 'fill-amber-400 text-amber-400' : 'text-zinc-300'}`}
          strokeWidth={1.75}
        />
      ))}
    </span>
  );
}

export default function CustomerSatisfactionPage() {
  const { activeProject } = useProject();
  const { toast } = useZoruToast();
  const reduceMotion = useReducedMotion();
  const [isPending, startTransition] = useTransition();
  const [ratings, setRatings] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>({});
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);

  useEffect(() => {
    document.title = 'Customer satisfaction · Wachat';
  }, []);

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
      setLastSyncAt(new Date());
    });
  }, [activeProject?._id, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const total = summary.count || 0;
  const promoters = (summary.five || 0) + (summary.four || 0);
  const passives = summary.three || 0;
  const detractors = (summary.two || 0) + (summary.one || 0);
  const promPct = total ? Math.round((promoters / total) * 100) : 0;
  const passPct = total ? Math.round((passives / total) * 100) : 0;
  const detPct = total ? Math.round((detractors / total) * 100) : 0;
  const nps = promPct - detPct;

  const avgRating = useMemo(() => {
    if (!total) return 0;
    const sum =
      (summary.one || 0) * 1 +
      (summary.two || 0) * 2 +
      (summary.three || 0) * 3 +
      (summary.four || 0) * 4 +
      (summary.five || 0) * 5;
    return Math.round((sum / total) * 10) / 10;
  }, [summary, total]);

  const histogramData = useMemo(
    () => [
      { rating: '1', count: summary.one || 0, color: '#f43f5e' },
      { rating: '2', count: summary.two || 0, color: '#fb7185' },
      { rating: '3', count: summary.three || 0, color: '#f59e0b' },
      { rating: '4', count: summary.four || 0, color: '#10b981' },
      { rating: '5', count: summary.five || 0, color: '#059669' },
    ],
    [summary],
  );

  const lowRatings = useMemo(() => ratings.filter((r: any) => (r.rating ?? 5) <= 2), [ratings]);
  const highRatings = useMemo(() => ratings.filter((r: any) => (r.rating ?? 0) >= 4), [ratings]);

  // Latest ratings with text feedback
  const recentWithFeedback = useMemo(() => {
    return ratings.filter((r) => r.feedback && r.feedback.trim().length > 0).slice(0, 5);
  }, [ratings]);

  return (
    <WaPage>
      <PageHeader
        title="Customer satisfaction"
        kicker="CSAT"
        description="Track NPS scores and customer feedback from conversations."
        eyebrowIcon={Star}
        actions={
          <>
            {lastSyncAt && (
              <span className="hidden items-center gap-1.5 text-[11px] text-zinc-500 sm:inline-flex">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Synced {Math.max(0, Math.round((Date.now() - lastSyncAt.getTime()) / 1000))}s ago
              </span>
            )}
            <WaButton
              variant="outline"
              size="sm"
              onClick={() => setDrawerOpen(true)}
              disabled={lowRatings.length === 0}
              leftIcon={TriangleAlert}
            >
              Low ratings ({lowRatings.length})
            </WaButton>
            <WaButton variant="outline" size="sm" onClick={load} disabled={isPending} leftIcon={RefreshCw}>
              Refresh
            </WaButton>
          </>
        }
      />

      {isPending && total === 0 ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-[118px] animate-pulse rounded-xl border border-zinc-200 bg-white" />
          ))}
        </div>
      ) : (
        <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          <MetricTile
            label="NPS score"
            value={total ? nps.toString() : '--'}
            delta={
              total
                ? {
                    value: nps >= 50 ? 'Excellent' : nps >= 0 ? 'Good' : 'Needs work',
                    positive: nps >= 0,
                  }
                : undefined
            }
            icon={Trophy}
            delay={reduceMotion ? 0 : 0.02}
          />
          <MetricTile
            label="Avg rating"
            value={total ? `${avgRating.toFixed(1)}★` : '--'}
            icon={Star}
            delay={reduceMotion ? 0 : 0.04}
          />
          <MetricTile
            label="Responses"
            value={total.toLocaleString()}
            icon={MessageSquare}
            delay={reduceMotion ? 0 : 0.06}
          />
          <MetricTile
            label="Promoters (4-5)"
            value={`${promPct}%`}
            delta={
              promoters > 0 ? { value: promoters.toLocaleString(), positive: true } : undefined
            }
            icon={CircleCheck}
            delay={reduceMotion ? 0 : 0.08}
          />
          <MetricTile
            label="Passives (3)"
            value={`${passPct}%`}
            delta={passives > 0 ? { value: passives.toLocaleString(), positive: true } : undefined}
            icon={TriangleAlert}
            delay={reduceMotion ? 0 : 0.1}
          />
          <MetricTile
            label="Detractors (1-2)"
            value={`${detPct}%`}
            delta={detractors > 0 ? { value: detractors.toLocaleString(), positive: false } : undefined}
            icon={CircleX}
            delay={reduceMotion ? 0 : 0.12}
          />
        </div>
      )}

      {/* NPS gauge bar */}
      {total > 0 && (
        <div className="mb-4">
          <Section title="NPS composition" description="Promoters minus detractors = NPS.">
            <div className="flex h-3 overflow-hidden rounded-full">
              <m.div
                initial={{ width: 0 }}
                animate={{ width: `${promPct}%` }}
                transition={{ duration: 0.6, ease: EASE_OUT }}
                style={{ background: '#10b981' }}
                title={`Promoters ${promPct}%`}
              />
              <m.div
                initial={{ width: 0 }}
                animate={{ width: `${passPct}%` }}
                transition={{ duration: 0.6, ease: EASE_OUT, delay: 0.05 }}
                style={{ background: '#f59e0b' }}
                title={`Passives ${passPct}%`}
              />
              <m.div
                initial={{ width: 0 }}
                animate={{ width: `${detPct}%` }}
                transition={{ duration: 0.6, ease: EASE_OUT, delay: 0.1 }}
                style={{ background: '#f43f5e' }}
                title={`Detractors ${detPct}%`}
              />
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-[11.5px]">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                <span className="text-zinc-700">Promoters</span>
                <span className="font-semibold tabular-nums text-zinc-900">{promPct}%</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-amber-500" />
                <span className="text-zinc-700">Passives</span>
                <span className="font-semibold tabular-nums text-zinc-900">{passPct}%</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-rose-500" />
                <span className="text-zinc-700">Detractors</span>
                <span className="font-semibold tabular-nums text-zinc-900">{detPct}%</span>
              </span>
              <span className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-zinc-200 px-2 py-0.5 text-[11px] font-semibold text-zinc-700">
                {nps >= 50 ? 'World class' : nps >= 30 ? 'Strong' : nps >= 0 ? 'OK' : 'Below par'}
              </span>
            </div>
          </Section>
        </div>
      )}

      <div className="mb-4 grid grid-cols-1 gap-3 lg:grid-cols-3">
        <Section
          title="Rating distribution"
          description="Count of responses for each star rating."
          className="lg:col-span-2"
        >
          {total === 0 ? (
            <EmptyState
              icon={Star}
              title="No ratings yet"
              description="Once customers rate their conversations, the distribution will appear here."
            />
          ) : (
            <ZoruChartContainer height={220}>
              <ZoruChart.BarChart data={histogramData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <ZoruChart.CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" vertical={false} />
                <ZoruChart.XAxis
                  dataKey="rating"
                  tick={{ fontSize: 11, fill: '#71717a' }}
                  tickLine={false}
                  axisLine={{ stroke: '#e4e4e7' }}
                />
                <ZoruChart.YAxis
                  tick={{ fontSize: 11, fill: '#71717a' }}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <ZoruChart.Tooltip content={<ZoruChartTooltip />} />
                <ZoruChart.Bar dataKey="count" name="Responses" radius={[6, 6, 0, 0]}>
                  {histogramData.map((entry, i) => (
                    <ZoruChart.Cell key={i} fill={entry.color} />
                  ))}
                </ZoruChart.Bar>
              </ZoruChart.BarChart>
            </ZoruChartContainer>
          )}
        </Section>

        <Section title="Latest praise" description="High-rated feedback to share">
          {highRatings.length === 0 ? (
            <EmptyState
              icon={TrendingUp}
              title="No high ratings"
              description="Promoter feedback will surface here."
            />
          ) : (
            <ul className="space-y-2">
              {highRatings.slice(0, 4).map((r: any, i: number) => (
                <m.li
                  key={r._id || i}
                  initial={{ opacity: 0, x: -4 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.3, delay: i * 0.04, ease: EASE_OUT }}
                  className="rounded-lg border border-emerald-100 bg-emerald-50/50 px-3 py-2"
                >
                  <div className="flex items-center justify-between">
                    <Stars count={r.rating} />
                    <span className="text-[10.5px] text-zinc-500">
                      {r.createdAt ? fmtDate(r.createdAt) : ''}
                    </span>
                  </div>
                  {r.feedback && (
                    <p className="mt-1 line-clamp-2 text-[12px] leading-relaxed text-zinc-700">
                      {r.feedback}
                    </p>
                  )}
                </m.li>
              ))}
            </ul>
          )}
        </Section>
      </div>

      {/* Quoted feedback rail */}
      {recentWithFeedback.length > 0 && (
        <div className="mb-4">
          <Section title="Recent written feedback" description="What customers said" padded={false}>
            <ul className="divide-y divide-zinc-100">
              {recentWithFeedback.map((r: any, i: number) => (
                <m.li
                  key={r._id || i}
                  initial={{ opacity: 0, x: -4 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.3, delay: i * 0.03, ease: EASE_OUT }}
                  className="flex items-start gap-3 px-4 py-2.5"
                >
                  <Stars count={r.rating} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[12.5px] leading-relaxed text-zinc-700">"{r.feedback}"</p>
                    <p className="mt-1 text-[10.5px] text-zinc-500">
                      {r.createdAt ? fmtDate(r.createdAt) : ''}
                    </p>
                  </div>
                </m.li>
              ))}
            </ul>
          </Section>
        </div>
      )}

      <Section title={`Recent feedback (${ratings.length})`} description="Latest 20 responses." padded={false}>
        {ratings.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={Inbox}
              title="No feedback yet"
              description="Customer feedback will show up here as it arrives."
            />
          </div>
        ) : (
          <ul className="divide-y divide-zinc-100">
            {ratings.slice(0, 20).map((r: any, i: number) => {
              const tone =
                r.rating >= 4 ? 'sent' : r.rating === 3 ? 'queued' : 'failed';
              return (
                <li key={r._id || i} className="flex items-start gap-3 px-4 py-2">
                  <Stars count={r.rating} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <StatusPill tone={tone}>{r.rating}★</StatusPill>
                      <span className="text-[10.5px] text-zinc-500">
                        {r.createdAt ? fmtDate(r.createdAt) : ''}
                      </span>
                    </div>
                    {r.feedback && (
                      <p className="mt-0.5 text-[12.5px] leading-relaxed text-zinc-700">{r.feedback}</p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      {/* Low-rating drawer */}
      <ZoruDrawer open={drawerOpen} onOpenChange={setDrawerOpen}>
        <ZoruDrawerContent>
          <ZoruDrawerHeader>
            <ZoruDrawerTitle>Low ratings ({lowRatings.length})</ZoruDrawerTitle>
            <ZoruDrawerDescription>Conversations rated 1 or 2 stars. Review and follow up.</ZoruDrawerDescription>
          </ZoruDrawerHeader>
          <div className="max-h-[60vh] overflow-y-auto px-4 pb-6 sm:px-6">
            {lowRatings.length === 0 ? (
              <EmptyState
                icon={CircleCheck}
                title="No low ratings"
                description="Nothing to follow up on right now."
              />
            ) : (
              <ul className="divide-y divide-zinc-100">
                {lowRatings.map((r: any, i: number) => (
                  <li key={r._id || i} className="flex items-start gap-3 py-2.5">
                    <Stars count={r.rating} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <StatusPill tone="failed">{r.rating} stars</StatusPill>
                        <span className="text-[10.5px] text-zinc-500">{r.createdAt ? fmtDate(r.createdAt) : ''}</span>
                      </div>
                      {r.feedback && (
                        <p className="mt-1 text-[12.5px] leading-relaxed text-zinc-700">{r.feedback}</p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </ZoruDrawerContent>
      </ZoruDrawer>
    </WaPage>
  );
}
