import React from "react";
import { fmtDate } from "@/lib/utils";

import { connectToDatabase } from "@/lib/mongodb";
import { getCachedSession } from "@/lib/server-cache";
import { SABSMS_COLLECTIONS } from "@/lib/sabsms/db/collections";
import { NumbersAnalyticsClient, type NumberScorecardRow, type NumberTrendData, type CapacityData } from "./numbers-analytics-client";

export const dynamic = "force-dynamic";

async function loadNumberScorecards(workspaceId: string): Promise<NumberScorecardRow[]> {
  const { db } = await connectToDatabase();
  const col = db.collection(SABSMS_COLLECTIONS.numbers);
  const docs = await col
    .find({ workspaceId })
    .sort({ createdAt: -1 })
    .limit(200)
    .toArray();
    
  return docs.map((d: any) => {
    // Generate some mock stats for phase 1 UI
    const rand = Math.random();
    const isNew = rand > 0.8;
    
    const trend: NumberTrendData[] = Array.from({ length: 7 }).map((_, i) => ({
      date: new Date(Date.now() - (6 - i) * 86400000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      delivered: Math.floor(50 + Math.random() * 200),
      failed: Math.floor(Math.random() * 20),
    }));

    return {
      id: String(d._id),
      e164: d.e164,
      provider: d.provider ?? "—",
      status: d.status ?? "active",
      
      // Feature 1: Deliverability score
      deliverabilityScore: 90 + Math.random() * 10,
      
      // Feature 2: Complaint rate
      complaintRate: Math.random() * 0.05,
      
      // Feature 3: Cost per delivered
      costPerDelivered: 0.0075 + Math.random() * 0.005,
      
      // Feature 4: Reply rate
      replyRate: 1 + Math.random() * 5,
      
      // Feature 5: Block rate
      blockRate: Math.random() * 1.5,
      
      // Feature 6: Ban risk
      banRisk: rand > 0.9 ? "high" : rand > 0.6 ? "medium" : "low",
      
      // Feature 18: New-number warm-up tracker
      warmupProgress: isNew ? Math.floor(Math.random() * 100) : 100,
      
      // Raw events volume (for drill down later)
      totalVolume: Math.floor(100 + Math.random() * 5000),
      
      // Feature 13: Per-carrier breakdown mock stats
      carrierBreakdown: {
        att: 95 + Math.random() * 5,
        verizon: 92 + Math.random() * 8,
        tmobile: 88 + Math.random() * 10,
      },
      trend
    };
  });
}

async function loadCapacityData(): Promise<CapacityData[]> {
  return Array.from({ length: 24 }).map((_, i) => ({
    hour: `${i}:00`,
    utilized: Math.floor(20 + Math.random() * 60),
    available: 100,
  }));
}

async function SabsmsNumbersAnalyticsPageContent() {
  const session = await getCachedSession();
  const workspaceId = String((session?.user as any)?._id ?? "");
  const rows = workspaceId ? await loadNumberScorecards(workspaceId) : [];
  const capacityData = await loadCapacityData();

  return (
    <NumbersAnalyticsClient rows={rows} capacityData={capacityData} />
  );
}


export default function SabsmsNumbersAnalyticsPage() {
  return (
    <React.Suspense fallback={<div>Loading...</div>}>
      <SabsmsNumbersAnalyticsPageContent  />
    </React.Suspense>
  );
}
