import { getSabsmsWorkspaceId } from "@/lib/sabsms/workspace";
import React from "react";

import { connectToDatabase } from "@/lib/mongodb";
import { getCachedSession } from "@/lib/server-cache";
import {
  queryDailyStats,
  kpisFromRows,
  seriesFromRows,
  utcDateKey,
} from "@/lib/sabsms/analytics/rollups";

import FunnelAnalyticsPage, { type FunnelStep, type FunnelTrendPoint } from "./client";

export const dynamic = "force-dynamic";

const WINDOW_DAYS = 30;

async function FunnelPageContent() {
  const session = await getCachedSession();
  const workspaceId = (await getSabsmsWorkspaceId()) ?? "";

  if (!workspaceId) {
    return <FunnelAnalyticsPage steps={[]} trend={[]} />;
  }

  const { db } = await connectToDatabase();
  const to = new Date();
  const from = new Date(to.getTime() - WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const range = {
    workspaceId,
    fromDate: utcDateKey(from.getTime()),
    toDate: utcDateKey(to.getTime()),
    dim: "total" as const,
  };

  const totalRows = await queryDailyStats(db, range);
  const kpi = kpisFromRows(totalRows);

  // Real funnel from the rollup totals: Sent → Delivered → Clicked → Replied.
  // `value` carries the customer-facing money proxy we have: none at the
  // step level, so we leave it 0 (the table just renders "-").
  const steps: FunnelStep[] = [
    { id: "sent", name: "Sent", count: kpi.sent, value: 0 },
    { id: "delivered", name: "Delivered", count: kpi.delivered, value: 0 },
    { id: "clicked", name: "Clicked", count: kpi.clicks, value: 0 },
    { id: "replied", name: "Replied", count: kpi.inbound, value: 0 },
  ];

  // Real daily conversion trend (clicked / sent per day).
  const series = seriesFromRows(totalRows, range.fromDate, range.toDate);
  const trend: FunnelTrendPoint[] = series.map((d) => ({
    date: d.date.slice(5), // MM-DD
    conversion: d.sent > 0 ? Math.round((d.clicks / d.sent) * 1000) / 10 : 0,
  }));

  return <FunnelAnalyticsPage steps={steps} trend={trend} />;
}

export default function Page() {
  return (
    <React.Suspense fallback={<div>Loading...</div>}>
      <FunnelPageContent />
    </React.Suspense>
  );
}
