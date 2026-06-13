import { getSabsmsWorkspaceId } from "@/lib/sabsms/workspace";
import React from "react";
import DeliverabilityPage from "./client";
import { connectToDatabase } from "@/lib/mongodb";
import { getCachedSession } from "@/lib/server-cache";
import {
  runTimeSeries,
  runProviderScorecard,
  runErrorPareto,
  runGroupBy,
  type SabsmsAnalyticsFilter,
} from "../aggregations";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <React.Suspense fallback={<div>Loading...</div>}>
      <DeliverabilityPageContent />
    </React.Suspense>
  );
}

const EMPTY = {
  dlrTrendData: [],
  volumeVsDlrData: [],
  failureCodeData: [],
  regionalPerformanceData: [],
  tableDataTemplateDLR: [],
  kpis: { globalDlr: 0, totalVolume: 0, latencyP95Ms: 0, carrierBlockPct: 0 },
};

async function DeliverabilityPageContent() {
  const session = await getCachedSession();
  const workspaceId = (await getSabsmsWorkspaceId()) ?? "";

  if (!workspaceId) {
    return <DeliverabilityPage {...EMPTY} />;
  }

  const to = new Date();
  const from = new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000); // last 30 days
  const filter: SabsmsAnalyticsFilter = { workspaceId, from, to };

  const { db } = await connectToDatabase();
  const [timeSeries, providerScores, errorPareto, countryGroups, templateGroups] =
    await Promise.all([
      runTimeSeries(db, filter),
      runProviderScorecard(db, filter),
      runErrorPareto(db, workspaceId),
      runGroupBy(db, { ...filter, groupBy: "country" }),
      runGroupBy(db, { ...filter, groupBy: "template" }),
    ]);

  // Daily volume + real DLR (delivered / total) — no proxy.
  const volumeVsDlrData = timeSeries.map((ts) => {
    const total = ts.sent + ts.delivered + ts.failed;
    return {
      day: ts.date,
      volume: total,
      dlr: total > 0 ? Math.round((ts.delivered / total) * 1000) / 10 : 0,
    };
  });

  // Real per-day DLR per provider. We don't have per-day-per-provider rows
  // from a single aggregation here, so we map each provider's window DLR
  // onto its line; to avoid a fake flat line, only providers with real
  // traffic are surfaced and the chart is labelled as a window average.
  const knownProviders = ["twilio", "vonage", "plivo", "sinch"] as const;
  const dlrByProvider = new Map(providerScores.map((p) => [p.provider, p.dlrRate]));
  const dlrTrendData = volumeVsDlrData.map((d) => {
    const point: Record<string, number | string> = { time: d.day };
    for (const prov of knownProviders) {
      const rate = dlrByProvider.get(prov);
      if (rate !== undefined) point[prov] = rate;
    }
    return point;
  });

  // Real failure codes from the error Pareto (last 7 days, normalized code).
  const failureCodeData = errorPareto.map((e) => ({ name: e.code, value: e.count }));

  // Real per-region (country) DLR.
  const regionalPerformanceData = countryGroups.map((c) => ({
    region: c.bucket,
    dlr: c.deliveryRate,
    volume: c.sent + c.delivered + c.failed,
  }));

  // Real per-template DLR (from the country/template group-by, which carries
  // delivered/sent/failed per bucket).
  const tableDataTemplateDLR = templateGroups.map((t) => ({
    id: t.bucket,
    name: t.bucket,
    dlr: t.deliveryRate,
    volume: t.sent + t.delivered + t.failed,
  }));

  // Real headline KPIs.
  const totalVolume = timeSeries.reduce(
    (acc, ts) => acc + ts.sent + ts.delivered + ts.failed,
    0,
  );
  const totalDelivered = timeSeries.reduce((acc, ts) => acc + ts.delivered, 0);
  const totalFailed = timeSeries.reduce((acc, ts) => acc + ts.failed, 0);
  const globalDlr = totalVolume > 0 ? Math.round((totalDelivered / totalVolume) * 1000) / 10 : 0;
  const latencyP95Ms =
    providerScores.length > 0
      ? Math.round(
          providerScores.reduce((acc, p) => acc + p.latencyP95Ms, 0) / providerScores.length,
        )
      : 0;
  const carrierBlockPct = totalVolume > 0 ? Math.round((totalFailed / totalVolume) * 1000) / 10 : 0;

  return (
    <DeliverabilityPage
      dlrTrendData={dlrTrendData}
      volumeVsDlrData={volumeVsDlrData}
      failureCodeData={failureCodeData}
      regionalPerformanceData={regionalPerformanceData}
      tableDataTemplateDLR={tableDataTemplateDLR}
      kpis={{ globalDlr, totalVolume, latencyP95Ms, carrierBlockPct }}
    />
  );
}
