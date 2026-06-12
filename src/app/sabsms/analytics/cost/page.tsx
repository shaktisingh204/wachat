import React from "react";

import { ObjectId } from "mongodb";

import { connectToDatabase } from "@/lib/mongodb";
import { getCachedSession } from "@/lib/server-cache";

// V2.10 — the cost page reads the `sabsms_stats_daily` rollups
// (costCents + creditsSpent, written live by the events consumer and
// kept honest by the backfill/reconcile path). Revenue (`price`) is not
// on the rollups, so the margin column reads one bounded raw
// aggregation (`runCampaignMoney`) + the day-level `runCostVsRevenue`.
import {
  groupRowsByDim,
  queryDailyStats,
  seriesFromRows,
  sumCounters,
  utcDateKey,
} from "@/lib/sabsms/analytics/rollups";

import {
  runCampaignMoney,
  runCostVsRevenue,
  type SabsmsAnalyticsFilter,
} from "../aggregations";

import CostAnalyticsClient, {
  type CampaignCostRow,
  type CostDayPoint,
  type CostKpis,
  type ProviderCostRow,
} from "./client";

export const dynamic = "force-dynamic";

type RawSearchParams = Record<string, string | string[] | undefined>;

function presetDays(sp: RawSearchParams): number {
  const raw = Array.isArray(sp.preset) ? sp.preset[0] : sp.preset;
  if (raw === "7d") return 7;
  if (raw === "90d") return 90;
  return 30;
}

/** Hydrate campaign-id buckets into names (single `$in` roundtrip). */
async function campaignNames(
  db: Awaited<ReturnType<typeof connectToDatabase>>["db"],
  workspaceId: string,
  ids: string[],
): Promise<Map<string, string>> {
  const objectIds = ids
    .filter((id) => ObjectId.isValid(id))
    .map((id) => new ObjectId(id));
  if (objectIds.length === 0) return new Map();
  const docs = await db
    .collection<{ _id: ObjectId; name?: string }>("sabsms_campaigns")
    .find({ _id: { $in: objectIds }, workspaceId } as never)
    .project<{ _id: ObjectId; name?: string }>({ name: 1 })
    .toArray();
  return new Map(docs.map((d) => [String(d._id), d.name ?? String(d._id)]));
}

const EMPTY_KPIS: CostKpis = {
  costUsd: 0,
  creditsSpent: 0,
  sent: 0,
  segments: 0,
  avgCostPerMessageUsd: 0,
  revenueUsd: 0,
  marginUsd: 0,
};

export default function Page({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  return (
    <React.Suspense fallback={<div>Loading...</div>}>
      <CostPageContent searchParams={searchParams} />
    </React.Suspense>
  );
}

async function CostPageContent({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const sp = await searchParams;
  const session = await getCachedSession();
  const workspaceId = String((session?.user as any)?._id ?? "");

  const days = presetDays(sp);
  const to = new Date();
  const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000);

  if (!workspaceId) {
    return (
      <CostAnalyticsClient
        days={days}
        kpis={EMPTY_KPIS}
        daySeries={[]}
        providerRows={[]}
        campaignRows={[]}
      />
    );
  }

  const { db } = await connectToDatabase();
  const range = {
    workspaceId,
    fromDate: utcDateKey(from.getTime()),
    toDate: utcDateKey(to.getTime()),
  };
  const filter: SabsmsAnalyticsFilter = { workspaceId, from, to };

  const [totalRows, providerDimRows, campaignDimRows, costVsRevenue, campaignMoney] =
    await Promise.all([
      queryDailyStats(db, { ...range, dim: "total" }),
      queryDailyStats(db, { ...range, dim: "provider" }),
      queryDailyStats(db, { ...range, dim: "campaignId" }),
      runCostVsRevenue(db, filter),
      runCampaignMoney(db, filter),
    ]);

  // ── KPI block (rollup totals + raw revenue) ─────────────────────────
  const totals = sumCounters(totalRows);
  const revenueUsd = costVsRevenue.reduce((acc, p) => acc + p.revenue, 0);
  const costUsd = totals.costCents / 100;
  const kpis: CostKpis = {
    costUsd,
    creditsSpent: totals.creditsSpent,
    sent: totals.sent,
    segments: totals.segments,
    avgCostPerMessageUsd: totals.sent > 0 ? costUsd / totals.sent : 0,
    revenueUsd,
    marginUsd: revenueUsd - costUsd,
  };

  // ── Day series — costCents + creditsSpent per UTC day (dense). ──────
  const revenueByDate = new Map(costVsRevenue.map((p) => [p.date, p.revenue]));
  const daySeries: CostDayPoint[] = seriesFromRows(
    totalRows,
    range.fromDate,
    range.toDate,
  ).map((p) => ({
    date: p.date,
    costUsd: p.costCents / 100,
    creditsSpent: p.creditsSpent,
    sent: p.sent,
    revenueUsd: revenueByDate.get(p.date) ?? 0,
  }));

  // ── Per-provider rollup table. ──────────────────────────────────────
  const providerRows: ProviderCostRow[] = groupRowsByDim(
    providerDimRows,
    "provider",
  ).map(({ bucket, counters }) => ({
    provider: bucket,
    sent: counters.sent,
    delivered: counters.delivered,
    segments: counters.segments,
    creditsSpent: counters.creditsSpent,
    costUsd: counters.costCents / 100,
  }));

  // ── Per-campaign cost + margin column. ──────────────────────────────
  const campaignBuckets = groupRowsByDim(campaignDimRows, "campaignId");
  const moneyById = new Map(campaignMoney.map((m) => [m.campaignId, m]));
  const allCampaignIds = Array.from(
    new Set([
      ...campaignBuckets.map((b) => b.bucket),
      ...campaignMoney.map((m) => m.campaignId),
    ]),
  );
  const names = await campaignNames(db, workspaceId, allCampaignIds);
  const bucketById = new Map(campaignBuckets.map((b) => [b.bucket, b.counters]));
  const campaignRows: CampaignCostRow[] = allCampaignIds
    .map((id) => {
      const counters = bucketById.get(id);
      const money = moneyById.get(id);
      const costUsd = money ? money.cost : (counters?.costCents ?? 0) / 100;
      const revenue = money?.revenue ?? 0;
      return {
        campaignId: id,
        name: names.get(id) ?? id,
        sent: counters?.sent ?? 0,
        delivered: counters?.delivered ?? 0,
        creditsSpent: counters?.creditsSpent ?? 0,
        costUsd,
        revenueUsd: revenue,
        marginUsd: revenue - costUsd,
      };
    })
    .sort((a, b) => b.costUsd - a.costUsd || b.sent - a.sent)
    .slice(0, 50);

  return (
    <CostAnalyticsClient
      days={days}
      kpis={kpis}
      daySeries={daySeries}
      providerRows={providerRows}
      campaignRows={campaignRows}
    />
  );
}
