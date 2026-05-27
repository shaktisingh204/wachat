'use client';

import { useEffect, useState, useTransition, useCallback, useMemo } from 'react';
import {
  CircleCheck,
  CircleX,
  Inbox,
  RefreshCw,
  Star,
  TriangleAlert,
} from 'lucide-react';

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
  const [isPending, startTransition] = useTransition();
  const [ratings, setRatings] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>({});
  const [drawerOpen, setDrawerOpen] = useState(false);

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

  const histogramData = useMemo(
    () => [
      { rating: '1', count: summary.one || 0 },
      { rating: '2', count: summary.two || 0 },
      { rating: '3', count: summary.three || 0 },
      { rating: '4', count: summary.four || 0 },
      { rating: '5', count: summary.five || 0 },
    ],
    [summary],
  );

  const lowRatings = useMemo(() => ratings.filter((r: any) => (r.rating ?? 5) <= 2), [ratings]);

  return (
    <WaPage>
      <PageHeader
        title="Customer satisfaction"
        kicker="CSAT"
        description="Track NPS scores and customer feedback from conversations."
        eyebrowIcon={Star}
        actions={
          <>
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
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-[118px] animate-pulse rounded-2xl border border-zinc-200 bg-white" />
          ))}
        </div>
      ) : (
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
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
            delay={0.02}
          />
          <MetricTile label="Promoters (4-5)" value={`${promPct}%`} icon={CircleCheck} delay={0.06} />
          <MetricTile label="Passives (3)" value={`${passPct}%`} icon={TriangleAlert} delay={0.1} />
          <MetricTile label="Detractors (1-2)" value={`${detPct}%`} icon={CircleX} delay={0.14} />
        </div>
      )}

      <div className="mb-6">
        <Section title="Rating distribution" description="Count of responses for each star rating.">
          {total === 0 ? (
            <EmptyState
              icon={Star}
              title="No ratings yet"
              description="Once customers rate their conversations, the distribution will appear here."
            />
          ) : (
            <ZoruChartContainer height={240}>
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
                <ZoruChart.Bar dataKey="count" name="Responses" fill="#10b981" radius={[6, 6, 0, 0]} />
              </ZoruChart.BarChart>
            </ZoruChartContainer>
          )}
        </Section>
      </div>

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
            {ratings.slice(0, 20).map((r: any, i: number) => (
              <li key={r._id || i} className="flex items-start gap-4 px-5 py-3">
                <Stars count={r.rating} />
                <div className="min-w-0 flex-1">
                  <span className="text-[11px] text-zinc-500">{r.createdAt ? fmtDate(r.createdAt) : ''}</span>
                  {r.feedback && (
                    <p className="mt-0.5 text-[12.5px] leading-relaxed text-zinc-700">{r.feedback}</p>
                  )}
                </div>
              </li>
            ))}
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
                  <li key={r._id || i} className="flex items-start gap-4 py-3">
                    <Stars count={r.rating} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <StatusPill tone="failed">{r.rating} stars</StatusPill>
                        <span className="text-[11px] text-zinc-500">{r.createdAt ? fmtDate(r.createdAt) : ''}</span>
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
