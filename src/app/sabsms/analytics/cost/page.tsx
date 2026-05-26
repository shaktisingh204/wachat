import React from "react";
import CostAnalyticsPage from "./client";
import { connectToDatabase } from "@/lib/mongodb";
import { getCachedSession } from "@/lib/server-cache";
import {
  runCostVsRevenue,
  runProviderScorecard,
  runTopCountries,
  runGroupBy,
  type SabsmsAnalyticsFilter,
} from "../aggregations";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <React.Suspense fallback={<div>Loading...</div>}>
      <CostPageContent />
    </React.Suspense>
  );
}

async function CostPageContent() {
  const session = await getCachedSession();
  const workspaceId = String((session?.user as any)?._id ?? "");

  const to = new Date();
  const from = new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000); // last 30 days
  const filter: SabsmsAnalyticsFilter = { workspaceId, from, to };

  if (!workspaceId) {
    return <CostAnalyticsPage spendTrendsData={[]} providerPerformance={[]} providerSpendPie={[]} countrySpend={[]} campaignSpend={[]} />;
  }

  const { db } = await connectToDatabase();
  const [costSeries, providerScores, countries, groupedByCampaign] = await Promise.all([
    runCostVsRevenue(db, filter),
    runProviderScorecard(db, filter),
    runTopCountries(db, filter),
    runGroupBy(db, { ...filter, groupBy: "campaign" }),
  ]);

  const spendTrendsData = costSeries.map(c => ({
    date: c.date,
    spend: c.cost,
    revenue: c.revenue,
    margin: c.margin,
    messages: 1, // Optional: proxy messages or map real
    cpc: c.cost > 0 ? c.cost : 0,
  }));

  const providerPerformance = providerScores.map(p => ({
    provider: p.provider,
    spend: 0, // Placeholder as provider score has total messages but not total cost, could map if needed
    delivery: p.dlrRate,
    latency: p.latencyP95Ms,
    support: 85,
    features: 90,
    cost: p.errorRate,
  }));

  const providerSpendPie = providerScores.map((p, i) => ({
    name: p.provider,
    value: p.total,
    fill: `hsl(var(--chart-${(i % 5) + 1}))`,
  }));

  const countrySpend = countries.map(c => ({
    name: c.country,
    spend: c.sent * 0.05, // Approximation, not real cost
    messages: c.sent,
  }));

  const campaignSpend = groupedByCampaign.map(c => ({
    name: c.bucket,
    sms: c.sent * 0.05,
    mms: 0,
    conversions: c.delivered, // placeholder
    cpc: 0.05,
  }));

  return (
    <CostAnalyticsPage
      spendTrendsData={spendTrendsData}
      providerPerformance={providerPerformance}
      providerSpendPie={providerSpendPie}
      countrySpend={countrySpend}
      campaignSpend={campaignSpend}
    />
  );
}
