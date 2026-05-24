"use client";

import React, { useMemo, useState } from "react";
import { DashboardHeader } from "./DashboardHeader";
import { KpiGrid } from "./KpiGrid";
import { ModuleGrid } from "./ModuleGrid";
import { BigCardsRow } from "./BigCardsRow";
import { SidebarCards } from "./SidebarCards";
import { OnboardingBanner } from "./OnboardingBanner";

export function DashboardContent({ initialData, userName, onboardingStatus }: { initialData: any, userName: string, onboardingStatus: any }) {
  const [data, setData] = useState(initialData);

  const derived = useMemo(() => {
    if (!data) return null;
    const { stats, velocity } = data;
    const pct = (n: number, d: number) => (d ? Math.round((n / d) * 1000) / 10 : 0);
    const trend = (cur: number, prev: number) => {
      if (!prev) return { delta: cur > 0 ? 100 : 0, up: cur >= 0 };
      const delta = ((cur - prev) / prev) * 100;
      return { delta: Math.round(delta * 10) / 10, up: delta >= 0 };
    };

    return {
      deliveryRate: pct(stats.totalDelivered, stats.totalSent),
      smsDeliveryRate: pct(stats.totalSmsDelivered, stats.totalSmsSent),
      messagesTrend: trend(velocity.messagesLast24h, velocity.messagesPrev24h),
      dealsWonRate: pct(stats.dealsWon, stats.totalDeals),
    };
  }, [data]);

  const handleExport = (timeRange: string = "7d") => {
    if (!data) return;
    const payload = {
      generatedAt: new Date().toISOString(),
      timeRange,
      userName,
      ...data,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sabnode-home-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleRefresh = async () => {
    // Ideally this could re-fetch data, but for now we just use the initialData
    const { getAccountHomeData } = await import("@/app/actions/home.actions");
    const newData = await getAccountHomeData();
    setData(newData);
  };

  return (
    <>
      <DashboardHeader 
        userName={userName} 
        totalProjects={data.stats.totalProjects} 
        planName={data.stats.planName}
        onRefresh={handleRefresh}
        onExport={() => handleExport("7d")}
      />

      {onboardingStatus && onboardingStatus.status !== "complete" && (
        <OnboardingBanner status={onboardingStatus.status} />
      )}

      <BigCardsRow data={data} derived={derived} />

      <ModuleGrid data={data} derived={derived} />

      <KpiGrid 
        stats={data.stats} 
        velocity={data.velocity} 
        derived={derived} 
        currency={data.currency} 
        onExport={handleExport} 
      />

      <SidebarCards data={data} />
    </>
  );
}
