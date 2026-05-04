'use client';

/**
 * Wachat Customer Satisfaction — ZoruUI rebuild.
 *
 * NPS-style dashboard: CSAT score card + rating histogram (greyscale bars)
 * + recent low-rating drawer. Differentiation by neutral fill, no hue.
 */

import * as React from 'react';
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
import { useToast } from '@/hooks/use-toast';
import { getChatRatings } from '@/app/actions/wachat-features.actions';

import {
  ZORU_CHART_PALETTE,
  ZoruBadge,
  ZoruBreadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
  ZoruButton,
  ZoruCard,
  ZoruCardContent,
  ZoruCardDescription,
  ZoruCardHeader,
  ZoruCardTitle,
  ZoruChart,
  ZoruChartContainer,
  ZoruChartTooltip,
  ZoruDrawer,
  ZoruDrawerContent,
  ZoruDrawerDescription,
  ZoruDrawerHeader,
  ZoruDrawerTitle,
  ZoruEmptyState,
  ZoruSkeleton,
  ZoruStatCard,
} from '@/components/zoruui';

function Stars({ count }: { count: number }) {
  return (
    <span className="inline-flex gap-0.5" aria-label={`${count} of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`h-3.5 w-3.5 ${i <= count ? 'fill-zoru-ink text-zoru-ink' : 'text-zoru-line-strong'}`}
          strokeWidth={1.75}
        />
      ))}
    </span>
  );
}

export default function CustomerSatisfactionPage() {
  const { activeProject } = useProject();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [ratings, setRatings] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>({});
  const [drawerOpen, setDrawerOpen] = useState(false);

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

  const lowRatings = useMemo(
    () => ratings.filter((r: any) => (r.rating ?? 5) <= 2),
    [ratings],
  );

  return (
    <div className="flex min-h-full flex-col gap-6">
      <ZoruBreadcrumb>
        <ZoruBreadcrumbList>
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/dashboard">SabNode</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/wachat">WaChat</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbPage>Customer Satisfaction</ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
      </ZoruBreadcrumb>

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[30px] font-semibold tracking-[-0.015em] text-zoru-ink leading-[1.1]">
            Customer Satisfaction
          </h1>
          <p className="mt-1.5 text-[13px] text-zoru-ink-muted">
            Track NPS scores and customer feedback from conversations.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ZoruButton
            variant="outline"
            size="sm"
            onClick={() => setDrawerOpen(true)}
            disabled={lowRatings.length === 0}
          >
            <TriangleAlert /> Low ratings ({lowRatings.length})
          </ZoruButton>
          <ZoruButton variant="outline" size="sm" onClick={load} disabled={isPending}>
            <RefreshCw className={isPending ? 'animate-spin' : ''} /> Refresh
          </ZoruButton>
        </div>
      </div>

      {isPending && total === 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <ZoruSkeleton key={i} className="h-[120px]" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <ZoruStatCard
            label="NPS Score"
            value={total ? nps.toString() : '--'}
            period={
              total
                ? nps >= 50
                  ? 'Excellent'
                  : nps >= 0
                    ? 'Good'
                    : 'Needs work'
                : 'No ratings yet'
            }
          />
          <ZoruStatCard
            label="Promoters (4-5)"
            value={`${promPct}%`}
            icon={<CircleCheck />}
          />
          <ZoruStatCard
            label="Passives (3)"
            value={`${passPct}%`}
            icon={<TriangleAlert />}
          />
          <ZoruStatCard
            label="Detractors (1-2)"
            value={`${detPct}%`}
            icon={<CircleX />}
          />
        </div>
      )}

      <ZoruCard>
        <ZoruCardHeader>
          <ZoruCardTitle>Rating Distribution</ZoruCardTitle>
          <ZoruCardDescription>
            Count of responses for each star rating.
          </ZoruCardDescription>
        </ZoruCardHeader>
        <ZoruCardContent>
          {total === 0 ? (
            <ZoruEmptyState
              icon={<Star />}
              title="No ratings yet"
              description="Once customers rate their conversations, the distribution will appear here."
            />
          ) : (
            <ZoruChartContainer height={240}>
              <ZoruChart.BarChart
                data={histogramData}
                margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
              >
                <ZoruChart.CartesianGrid
                  strokeDasharray="3 3"
                  stroke="hsl(var(--zoru-line))"
                  vertical={false}
                />
                <ZoruChart.XAxis
                  dataKey="rating"
                  tick={{ fontSize: 11, fill: 'hsl(var(--zoru-ink-muted))' }}
                  tickLine={false}
                  axisLine={{ stroke: 'hsl(var(--zoru-line))' }}
                />
                <ZoruChart.YAxis
                  tick={{ fontSize: 11, fill: 'hsl(var(--zoru-ink-muted))' }}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <ZoruChart.Tooltip content={<ZoruChartTooltip />} />
                <ZoruChart.Bar
                  dataKey="count"
                  name="Responses"
                  fill={ZORU_CHART_PALETTE[1]}
                  radius={[4, 4, 0, 0]}
                />
              </ZoruChart.BarChart>
            </ZoruChartContainer>
          )}
        </ZoruCardContent>
      </ZoruCard>

      <ZoruCard>
        <ZoruCardHeader>
          <ZoruCardTitle>Recent Feedback ({ratings.length})</ZoruCardTitle>
        </ZoruCardHeader>
        <ZoruCardContent>
          {ratings.length === 0 ? (
            <ZoruEmptyState
              icon={<Inbox />}
              title="No feedback yet"
              description="Customer feedback will show up here as it arrives."
            />
          ) : (
            <ul className="divide-y divide-zoru-line">
              {ratings.slice(0, 20).map((r: any, i: number) => (
                <li key={r._id || i} className="flex items-start gap-4 py-3">
                  <Stars count={r.rating} />
                  <div className="min-w-0 flex-1">
                    <span className="text-[11px] text-zoru-ink-subtle">
                      {r.createdAt ? new Date(r.createdAt).toLocaleDateString() : ''}
                    </span>
                    {r.feedback && (
                      <p className="mt-0.5 text-[12.5px] leading-relaxed text-zoru-ink-muted">
                        {r.feedback}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </ZoruCardContent>
      </ZoruCard>

      {/* Low-rating drawer */}
      <ZoruDrawer open={drawerOpen} onOpenChange={setDrawerOpen}>
        <ZoruDrawerContent>
          <ZoruDrawerHeader>
            <ZoruDrawerTitle>Low ratings ({lowRatings.length})</ZoruDrawerTitle>
            <ZoruDrawerDescription>
              Conversations rated 1 or 2 stars — review and follow up.
            </ZoruDrawerDescription>
          </ZoruDrawerHeader>
          <div className="max-h-[60vh] overflow-y-auto px-4 pb-6 sm:px-6">
            {lowRatings.length === 0 ? (
              <ZoruEmptyState
                icon={<CircleCheck />}
                title="No low ratings"
                description="Nothing to follow up on right now."
                compact
              />
            ) : (
              <ul className="divide-y divide-zoru-line">
                {lowRatings.map((r: any, i: number) => (
                  <li key={r._id || i} className="flex items-start gap-4 py-3">
                    <Stars count={r.rating} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <ZoruBadge variant="danger">{r.rating} stars</ZoruBadge>
                        <span className="text-[11px] text-zoru-ink-subtle">
                          {r.createdAt
                            ? new Date(r.createdAt).toLocaleString()
                            : ''}
                        </span>
                      </div>
                      {r.feedback && (
                        <p className="mt-1 text-[12.5px] leading-relaxed text-zoru-ink-muted">
                          {r.feedback}
                        </p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </ZoruDrawerContent>
      </ZoruDrawer>

      <div className="h-6" />
    </div>
  );
}
