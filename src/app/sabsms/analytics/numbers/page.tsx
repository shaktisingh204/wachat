import React from "react";

import { connectToDatabase } from "@/lib/mongodb";
import { getCachedSession } from "@/lib/server-cache";
import { SABSMS_COLLECTIONS } from "@/lib/sabsms/db/collections";
import {
  NumbersAnalyticsClient,
  type NumberScorecardRow,
  type NumberTrendData,
} from "./numbers-analytics-client";

export const dynamic = "force-dynamic";

const WINDOW_DAYS = 7;

/** Per-`from` (sender number) aggregate over the last WINDOW_DAYS. */
interface SenderAgg {
  sent: number;
  delivered: number;
  failed: number;
  inbound: number;
  costCents: number;
}

/**
 * Real per-number scorecards. Each `sabsms_numbers` doc is joined to its
 * outbound/inbound message activity (grouped by `from` = the sender e164)
 * over the last 7 days. Only fields we can actually measure are populated;
 * carrier-level breakdown and a synthetic "ban risk" are NOT fabricated.
 */
async function loadNumberScorecards(workspaceId: string): Promise<NumberScorecardRow[]> {
  const { db } = await connectToDatabase();
  const numbersCol = db.collection(SABSMS_COLLECTIONS.numbers);
  const messagesCol = db.collection(SABSMS_COLLECTIONS.messages);

  const numbers = await numbersCol
    .find({ workspaceId })
    .sort({ createdAt: -1 })
    .limit(200)
    .toArray();

  if (numbers.length === 0) return [];

  const since = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000);

  // Outbound activity per sender, bucketed by day for the sparkline.
  const outbound = new Map<string, SenderAgg>();
  const trendBySender = new Map<string, Map<string, NumberTrendData>>();
  for await (const row of messagesCol.aggregate([
    {
      $match: {
        workspaceId,
        direction: "outbound",
        from: { $nin: [null, ""] },
        createdAt: { $gte: since },
      },
    },
    {
      $group: {
        _id: {
          from: "$from",
          day: { $dateToString: { format: "%m-%d", date: "$createdAt", timezone: "UTC" } },
          status: "$status",
        },
        n: { $sum: 1 },
        cost: { $sum: { $ifNull: ["$cost", 0] } },
      },
    },
    { $limit: 50_000 },
  ])) {
    const from = String((row._id as any)?.from ?? "");
    const day = String((row._id as any)?.day ?? "");
    const status = String((row._id as any)?.status ?? "");
    const n = Number(row.n ?? 0);
    const cost = Number(row.cost ?? 0);
    if (!from) continue;

    let agg = outbound.get(from);
    if (!agg) {
      agg = { sent: 0, delivered: 0, failed: 0, inbound: 0, costCents: 0 };
      outbound.set(from, agg);
    }
    agg.sent += n;
    agg.costCents += cost;
    const delivered = status === "delivered";
    const failed = status === "failed" || status === "undelivered" || status === "rejected";
    if (delivered) agg.delivered += n;
    if (failed) agg.failed += n;

    let trend = trendBySender.get(from);
    if (!trend) {
      trend = new Map();
      trendBySender.set(from, trend);
    }
    const point = trend.get(day) ?? { date: day, delivered: 0, failed: 0 };
    if (delivered) point.delivered += n;
    if (failed) point.failed += n;
    trend.set(day, point);
  }

  // Inbound (replies) per recipient number — the contact replied TO our `to`,
  // which is the workspace number, surfaced on the inbound doc as `to`.
  const inbound = new Map<string, number>();
  for await (const row of messagesCol.aggregate([
    {
      $match: {
        workspaceId,
        direction: "inbound",
        to: { $nin: [null, ""] },
        createdAt: { $gte: since },
      },
    },
    { $group: { _id: "$to", n: { $sum: 1 } } },
    { $limit: 50_000 },
  ])) {
    const to = String(row._id ?? "");
    if (to) inbound.set(to, Number(row.n ?? 0));
  }

  return numbers.map((d) => {
    const e164 = String((d as { e164?: unknown }).e164 ?? "");
    const senderId = String((d as { senderId?: unknown }).senderId ?? "");
    const agg =
      outbound.get(e164) ?? (senderId ? outbound.get(senderId) : undefined) ?? {
        sent: 0,
        delivered: 0,
        failed: 0,
        inbound: 0,
        costCents: 0,
      };
    const replies = inbound.get(e164) ?? (senderId ? inbound.get(senderId) ?? 0 : 0);
    const totalVolume = agg.sent;
    const deliverabilityScore = agg.sent > 0 ? (agg.delivered / agg.sent) * 100 : 0;
    const blockRate = agg.sent > 0 ? (agg.failed / agg.sent) * 100 : 0;
    const replyRate = agg.delivered > 0 ? (replies / agg.delivered) * 100 : 0;
    const costPerDelivered = agg.delivered > 0 ? agg.costCents / 100 / agg.delivered : 0;

    const trend = Array.from(
      (trendBySender.get(e164) ?? (senderId ? trendBySender.get(senderId) : undefined) ?? new Map<string, NumberTrendData>()).values(),
    ).sort((a, b) => (a.date < b.date ? -1 : 1));

    return {
      id: String(d._id),
      e164: e164 || senderId || "—",
      provider: String((d as { provider?: unknown }).provider ?? "—"),
      status: String((d as { status?: unknown }).status ?? "active"),
      deliverabilityScore,
      costPerDelivered,
      replyRate,
      blockRate,
      totalVolume,
      hasData: agg.sent > 0,
      trend,
    };
  });
}

async function SabsmsNumbersAnalyticsPageContent() {
  const session = await getCachedSession();
  const workspaceId = String((session?.user as { _id?: unknown } | undefined)?._id ?? "");
  const rows = workspaceId ? await loadNumberScorecards(workspaceId) : [];

  return <NumbersAnalyticsClient rows={rows} />;
}

export default function SabsmsNumbersAnalyticsPage() {
  return (
    <React.Suspense fallback={<div>Loading...</div>}>
      <SabsmsNumbersAnalyticsPageContent />
    </React.Suspense>
  );
}
