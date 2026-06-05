'use client';
import { fmtDate } from "@/lib/utils";

import {
  useToast,
  Badge,
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardBody,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  EmptyState,
  Skeleton,
  StatCard,
} from '@/components/sabcrm/20ui';
import { WachatPage } from '@/app/wachat/_components/wachat-page';
import {
  useEffect,
  useState,
  useTransition,
  useCallback,
  useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
} from 'recharts';
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

/**
 * Wachat Customer Satisfaction — 20ui rebuild.
 *
 * NPS-style dashboard: CSAT score card + rating histogram (neutral bars)
 * + recent low-rating drawer.
 */

function Stars({ count }: { count: number }) {
  return (
    <span className="inline-flex gap-0.5" aria-label={`${count} of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className="h-3.5 w-3.5"
          style={{
            fill: i <= count ? 'var(--st-accent)' : 'transparent',
            color: i <= count ? 'var(--st-accent)' : 'var(--st-text-tertiary)',
          }}
          strokeWidth={1.75}
          aria-hidden="true"
        />
      ))}
    </span>
  );
}

const CHART_CONFIG: ChartConfig = {
  count: { label: 'Responses', color: 'var(--st-accent)' },
};

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
        toast({ title: 'Error', description: res.error, tone: 'danger' });
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

  const npsPeriod = total
    ? nps >= 50
      ? 'Excellent'
      : nps >= 0
        ? 'Good'
        : 'Needs work'
    : 'No ratings yet';

  return (
    <WachatPage
      breadcrumb={[
        { label: 'SabNode', href: '/dashboard' },
        { label: 'WaChat', href: '/wachat' },
        { label: 'Customer Satisfaction' },
      ]}
      title="Customer Satisfaction"
      description="Track NPS scores and customer feedback from conversations."
      actions={
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            iconLeft={TriangleAlert}
            onClick={() => setDrawerOpen(true)}
            disabled={lowRatings.length === 0}
          >
            Low ratings ({lowRatings.length})
          </Button>
          <Button
            variant="outline"
            size="sm"
            iconLeft={RefreshCw}
            onClick={load}
            loading={isPending}
          >
            Refresh
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-6">
        {isPending && total === 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-[120px]" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="NPS Score"
              value={total ? nps.toString() : '--'}
              delta={{
                value: npsPeriod,
                tone:
                  !total || nps < 0 ? 'down' : nps >= 50 ? 'up' : 'neutral',
              }}
            />
            <StatCard
              label="Promoters (4-5)"
              value={`${promPct}%`}
              icon={CircleCheck}
            />
            <StatCard
              label="Passives (3)"
              value={`${passPct}%`}
              icon={TriangleAlert}
            />
            <StatCard
              label="Detractors (1-2)"
              value={`${detPct}%`}
              icon={CircleX}
            />
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Rating Distribution</CardTitle>
            <CardDescription>
              Count of responses for each star rating.
            </CardDescription>
          </CardHeader>
          <CardBody>
            {total === 0 ? (
              <EmptyState
                icon={Star}
                title="No ratings yet"
                description="Once customers rate their conversations, the distribution will appear here."
              />
            ) : (
              <ChartContainer
                config={CHART_CONFIG}
                style={{ height: 240, aspectRatio: 'auto' }}
              >
                <BarChart
                  data={histogramData}
                  margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="rating"
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar
                    dataKey="count"
                    name="Responses"
                    fill="var(--st-accent)"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ChartContainer>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Feedback ({ratings.length})</CardTitle>
          </CardHeader>
          <CardBody>
            {ratings.length === 0 ? (
              <EmptyState
                icon={Inbox}
                title="No feedback yet"
                description="Customer feedback will show up here as it arrives."
              />
            ) : (
              <ul className="divide-y divide-[var(--st-border)] border-t border-t-[var(--st-border)]">
                {ratings.slice(0, 20).map((r: any, i: number) => (
                  <li
                    key={r._id || i}
                    className="flex items-start gap-4 py-3"
                  >
                    <Stars count={r.rating} />
                    <div className="min-w-0 flex-1">
                      <span className="text-[11px] [color:var(--st-text-tertiary)]">
                        {r.createdAt ? fmtDate(r.createdAt) : ''}
                      </span>
                      {r.feedback && (
                        <p className="mt-0.5 text-[12.5px] leading-relaxed [color:var(--st-text-secondary)]">
                          {r.feedback}
                        </p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>

      {/* Low-rating drawer */}
      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Low ratings ({lowRatings.length})</DrawerTitle>
            <DrawerDescription>
              Conversations rated 1 or 2 stars — review and follow up.
            </DrawerDescription>
          </DrawerHeader>
          <div className="max-h-[60vh] overflow-y-auto px-4 pb-6 sm:px-6">
            {lowRatings.length === 0 ? (
              <EmptyState
                icon={CircleCheck}
                title="No low ratings"
                description="Nothing to follow up on right now."
                size="sm"
              />
            ) : (
              <ul className="divide-y divide-[var(--st-border)] border-t border-t-[var(--st-border)]">
                {lowRatings.map((r: any, i: number) => (
                  <li
                    key={r._id || i}
                    className="flex items-start gap-4 py-3"
                  >
                    <Stars count={r.rating} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <Badge tone="danger">{r.rating} stars</Badge>
                        <span className="text-[11px] [color:var(--st-text-tertiary)]">
                          {r.createdAt ? fmtDate(r.createdAt) : ''}
                        </span>
                      </div>
                      {r.feedback && (
                        <p className="mt-1 text-[12.5px] leading-relaxed [color:var(--st-text-secondary)]">
                          {r.feedback}
                        </p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </DrawerContent>
      </Drawer>
    </WachatPage>
  );
}
