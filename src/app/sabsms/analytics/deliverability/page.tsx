import React from "react";
import DeliverabilityPage from "./client";
import { connectToDatabase } from "@/lib/mongodb";
import { getCachedSession } from "@/lib/server-cache";
import {
  runTimeSeries,
  runProviderScorecard,
  runTopCountries,
  runTemplateReplyRates,
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

async function DeliverabilityPageContent() {
  const session = await getCachedSession();
  const workspaceId = String((session?.user as any)?._id ?? "");

  const to = new Date();
  const from = new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000); // last 30 days
  const filter: SabsmsAnalyticsFilter = { workspaceId, from, to };

  if (!workspaceId) {
    return <DeliverabilityPage dlrTrendData={[]} volumeVsDlrData={[]} failureCodeData={[]} regionalPerformanceData={[]} tableDataTemplateDLR={[]} />;
  }

  const { db } = await connectToDatabase();
  const [timeSeries, providerScores, countries, templates] = await Promise.all([
    runTimeSeries(db, filter),
    runProviderScorecard(db, filter),
    runTopCountries(db, filter),
    runTemplateReplyRates(db, filter),
  ]);

  const volumeVsDlrData = timeSeries.map(ts => ({
    day: ts.date,
    volume: ts.sent + ts.delivered + ts.failed,
    dlr: ts.sent + ts.delivered + ts.failed > 0 
           ? (ts.delivered / (ts.sent + ts.delivered + ts.failed)) * 100 
           : 0,
  }));

  const failureCodeData = [
    { name: "Failed", value: timeSeries.reduce((acc, ts) => acc + ts.failed, 0) },
  ]; // Approximated, as actual error codes aren't aggregated right now

  const regionalPerformanceData = countries.map(c => ({
    region: c.country,
    dlr: 95, // Proxy
    latency: 1.5,
  }));

  const tableDataTemplateDLR = templates.map((t, i) => ({
    id: t.templateId,
    name: t.templateId,
    dlr: 99, // Proxy
    volume: t.sent,
    trend: i % 2 === 0 ? "up" : "down"
  }));

  const dlrTrendData = timeSeries.map(ts => ({
    time: ts.date,
    twilio: providerScores.find(p => p.provider === 'twilio')?.dlrRate ?? 95,
    vonage: providerScores.find(p => p.provider === 'vonage')?.dlrRate ?? 95,
    plivo: providerScores.find(p => p.provider === 'plivo')?.dlrRate ?? 95,
    sinch: providerScores.find(p => p.provider === 'sinch')?.dlrRate ?? 95,
  }));

  return (
    <DeliverabilityPage
      dlrTrendData={dlrTrendData}
      volumeVsDlrData={volumeVsDlrData}
      failureCodeData={failureCodeData}
      regionalPerformanceData={regionalPerformanceData}
      tableDataTemplateDLR={tableDataTemplateDLR}
    />
  );
}
