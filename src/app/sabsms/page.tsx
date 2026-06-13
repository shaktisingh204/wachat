import { getSabsmsWorkspaceId } from "@/lib/sabsms/workspace";
import Link from "next/link";

import { Badge, Button, Card, CardBody, CardDescription, CardHeader, CardTitle, EmptyState, Table, THead, Tr, Th, TBody, Td } from '@/components/sabcrm/20ui';

import { SabsmsPageShell } from "@/components/sabsms/page-toolkit";
import { connectToDatabase } from "@/lib/mongodb";
import { getCachedSession } from "@/lib/server-cache";
import {
  kpisFromRows,
  queryDailyStats,
  utcDateKey,
  type SabsmsStatsKpis,
} from "@/lib/sabsms/analytics/rollups";
import { loadCampaigns, type CampaignRow } from "./campaigns/actions";
import { SabsmsDashboardWidgets, type MetricData } from "./_components/sabsms-dashboard-widgets";

export const dynamic = "force-dynamic";

const DAY_MS = 24 * 60 * 60 * 1000;
const REDIS_TTL_SECONDS = 60;

/** Percentage change of `now` vs `prev`, 1dp. `undefined` when no prior data. */
function pctDelta(now: number, prev: number): number | undefined {
  if (prev <= 0) return undefined;
  return Math.round(((now - prev) / prev) * 1000) / 10;
}

function moneyFromCents(cents: number): string {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(cents / 100);
}

/**
 * Real module KPIs from the `sabsms_stats_daily` rollups — the same source
 * as /sabsms/analytics. Compares the trailing 30 days against the prior 30
 * for the MoM deltas. No fabricated numbers; an empty workspace shows zeros.
 */
async function computeDashboardMetrics(workspaceId: string): Promise<MetricData[]> {
  const { db } = await connectToDatabase();

  const now = Date.now();
  const fromDate = utcDateKey(now - 30 * DAY_MS);
  const toDate = utcDateKey(now);
  const prevFromDate = utcDateKey(now - 60 * DAY_MS);
  const prevToDate = utcDateKey(now - 31 * DAY_MS);

  const [rows, prevRows] = await Promise.all([
    queryDailyStats(db, { workspaceId, fromDate, toDate, dim: "total" }),
    queryDailyStats(db, { workspaceId, fromDate: prevFromDate, toDate: prevToDate, dim: "total" }),
  ]);

  const kpi: SabsmsStatsKpis = kpisFromRows(rows);
  const prev: SabsmsStatsKpis = kpisFromRows(prevRows);

  const avgCostCents = kpi.sent > 0 ? kpi.costCents / kpi.sent : 0;
  const prevAvgCostCents = prev.sent > 0 ? prev.costCents / prev.sent : 0;

  return [
    {
      id: "totalSent",
      label: "Sent (30d)",
      value: kpi.sent.toLocaleString(),
      delta: pctDelta(kpi.sent, prev.sent),
      period: "vs prior 30d",
      iconName: "Activity",
    },
    {
      id: "deliveryRate",
      label: "Delivery rate",
      value: `${kpi.deliveryRatePct.toFixed(1)}%`,
      delta: pctDelta(kpi.deliveryRatePct, prev.deliveryRatePct),
      period: "vs prior 30d",
      iconName: "CheckCircle2",
    },
    {
      id: "delivered",
      label: "Delivered (30d)",
      value: kpi.delivered.toLocaleString(),
      delta: pctDelta(kpi.delivered, prev.delivered),
      period: "vs prior 30d",
      iconName: "PlayCircle",
    },
    {
      id: "failedDeliveries",
      label: "Failed (30d)",
      value: kpi.failed.toLocaleString(),
      delta: pctDelta(kpi.failed, prev.failed),
      invertDelta: true,
      period: "vs prior 30d",
      iconName: "AlertCircle",
    },
    {
      id: "avgCost",
      label: "Avg cost / SMS",
      value: moneyFromCents(avgCostCents),
      delta: pctDelta(avgCostCents, prevAvgCostCents),
      invertDelta: true,
      period: "vs prior 30d",
      iconName: "DollarSign",
    },
    {
      id: "clicks",
      label: "Clicks (30d)",
      value: kpi.clicks.toLocaleString(),
      delta: pctDelta(kpi.clicks, prev.clicks),
      period: "vs prior 30d",
      iconName: "TrendingUp",
    },
    {
      id: "optOuts",
      label: "Opt-outs (30d)",
      value: kpi.optOuts.toLocaleString(),
      delta: pctDelta(kpi.optOuts, prev.optOuts),
      invertDelta: true,
      period: "vs prior 30d",
      iconName: "UserMinus",
    },
  ];
}

type RedisLike = {
  get: (k: string) => Promise<string | null>;
  set: (k: string, v: string, o: { EX: number }) => Promise<unknown>;
};

/** Read the cached metrics, computing + caching the real values on a miss. */
async function getDashboardMetrics(workspaceId: string): Promise<MetricData[]> {
  const cacheKey = `sabsms:dashboard_metrics:${workspaceId}`;
  // `@/lib/redis` is a CommonJS module — load it loosely and narrow.
  const redisModule = (await import("@/lib/redis")) as unknown as {
    getRedisClient: () => Promise<RedisLike>;
  };
  let redis: RedisLike | undefined;
  try {
    redis = await redisModule.getRedisClient();
    const cached = await redis?.get(cacheKey);
    if (cached) return JSON.parse(cached) as MetricData[];
  } catch (e) {
    console.error("[sabsms] dashboard cache read error:", e);
  }

  const metrics = await computeDashboardMetrics(workspaceId);

  if (redis) {
    try {
      await redis.set(cacheKey, JSON.stringify(metrics), { EX: REDIS_TTL_SECONDS });
    } catch (e) {
      console.error("[sabsms] dashboard cache write error:", e);
    }
  }
  return metrics;
}

/** Real running/scheduled campaigns for this workspace. */
async function getActiveCampaigns(workspaceId: string): Promise<CampaignRow[]> {
  const { rows } = await loadCampaigns(workspaceId, {
    status: ["running", "scheduled"],
    sort: "newest",
  });
  return rows.slice(0, 8);
}

function statusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  if (status === "running") return "default";
  if (status === "scheduled") return "outline";
  return "secondary";
}

export default async function SabsmsOverviewPage() {
  const session = await getCachedSession();
  const workspaceId = (await getSabsmsWorkspaceId()) ?? "";

  const [metrics, activeCampaigns] = workspaceId
    ? await Promise.all([
        getDashboardMetrics(workspaceId),
        getActiveCampaigns(workspaceId),
      ])
    : [[] as MetricData[], [] as CampaignRow[]];

  return (
    <SabsmsPageShell
      title="Overview"
      description="SabSMS Dashboard: High-throughput, multi-provider messaging engine."
      primaryAction={{
        label: "New Campaign",
        href: "/sabsms/campaigns/create",
      }}
      secondaryActions={[
        { label: "System Logs", onSelectHref: "/sabsms/logs" }
      ]}
    >
      <SabsmsDashboardWidgets allMetrics={metrics} />

      <div className="grid gap-6 xl:grid-cols-3 mt-6">
        <Card className="shadow-sm flex flex-col xl:col-span-3">
          <CardHeader className="pb-4 border-b border-[var(--st-border)]">
            <CardTitle className="text-lg">Active Campaigns</CardTitle>
            <CardDescription>Currently running or scheduled.</CardDescription>
          </CardHeader>
          <CardBody className="p-0 flex-1">
            {activeCampaigns.length === 0 ? (
              <div className="p-10">
                <EmptyState
                  title="No active campaigns"
                  description="Running and scheduled campaigns appear here. Launch one to get started."
                  action={
                    <Button asChild>
                      <Link href="/sabsms/campaigns/create">New campaign</Link>
                    </Button>
                  }
                />
              </div>
            ) : (
              <div className="w-full overflow-hidden">
                <Table className="border-0 shadow-none rounded-none w-full">
                  <THead className="bg-[var(--st-bg-muted)]/50 border-b border-[var(--st-border)]">
                    <Tr className="border-none hover:bg-transparent">
                      <Th className="h-9">Campaign</Th>
                      <Th className="h-9">Status</Th>
                      <Th className="h-9 text-right">Sent / Audience</Th>
                    </Tr>
                  </THead>
                  <TBody>
                    {activeCampaigns.map((camp) => {
                      const sent = camp.stats?.sent ?? 0;
                      return (
                        <Tr key={camp.id} className="group">
                          <Td className="font-medium text-[var(--st-text)] text-sm">
                            <Link
                              href={`/sabsms/campaigns/${camp.id}`}
                              className="hover:underline"
                            >
                              {camp.name}
                            </Link>
                          </Td>
                          <Td>
                            <Badge
                              variant={statusVariant(camp.status)}
                              className="text-xs px-2 py-0.5 capitalize"
                            >
                              {camp.status}
                            </Badge>
                          </Td>
                          <Td className="text-right text-sm text-[var(--st-text-secondary)] group-hover:text-[var(--st-text)] transition-colors">
                            {sent.toLocaleString()} / {camp.audienceSize.toLocaleString()}
                          </Td>
                        </Tr>
                      );
                    })}
                  </TBody>
                </Table>
              </div>
            )}
          </CardBody>
          <div className="p-4 border-t border-[var(--st-border)] bg-[var(--st-bg-muted)]/30">
            <Button variant="ghost" className="w-full text-xs font-medium" asChild>
              <Link href="/sabsms/campaigns">View all campaigns →</Link>
            </Button>
          </div>
        </Card>
      </div>
    </SabsmsPageShell>
  );
}
