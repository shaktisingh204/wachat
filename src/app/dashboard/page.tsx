export const dynamic = "force-dynamic";

import React from "react";
import { getAccountHomeData } from "@/app/actions/home.actions";
import { getSession } from "@/app/actions/user.actions";
import { getOnboardingState } from "@/app/actions/onboarding-flow.actions";

import { DashboardHeader } from "./_components/DashboardHeader";
import { OnboardingBanner } from "./_components/OnboardingBanner";
import { StatsOverview } from "./_components/StatsOverview";
import { AppModulesGrid } from "./_components/AppModulesGrid";
import { SidebarCards } from "./_components/SidebarCards";

export const metadata = {
  title: "Home · SabNode"
};

export default async function HomePage() {
  const [data, session, obState] = await Promise.all([
    getAccountHomeData(),
    getSession(),
    getOnboardingState(),
  ]);

  const u = session?.user as any;
  const userName = u?.name || u?.email?.split("@")[0] || "there";

  const { stats, velocity } = data;
  const pct = (n: number, d: number) => (d ? Math.round((n / d) * 1000) / 10 : 0);
  const trend = (cur: number, prev: number) => {
    if (!prev) return { delta: cur > 0 ? 100 : 0, up: cur >= 0 };
    const delta = ((cur - prev) / prev) * 100;
    return { delta: Math.round(delta * 10) / 10, up: delta >= 0 };
  };

  const derived = {
    deliveryRate: pct(stats.totalDelivered, stats.totalSent),
    smsDeliveryRate: pct(stats.totalSmsDelivered, stats.totalSmsSent),
    messagesTrend: trend(velocity.messagesLast24h, velocity.messagesPrev24h),
    dealsWonRate: pct(stats.dealsWon, stats.totalDeals),
  };

  return (
    <div className="mx-auto w-full max-w-[1320px] px-6 pt-6 pb-10">
      <DashboardHeader 
        userName={userName} 
        totalProjects={stats.totalProjects} 
        planName={stats.planName}
        data={data}
      />

      {obState?.onboarding && obState.onboarding.status !== "complete" && (
        <OnboardingBanner status={obState.onboarding.status} />
      )}

      <StatsOverview data={data} derived={derived} />

      <AppModulesGrid data={data} derived={derived} />

      <SidebarCards data={data} />
    </div>
  );
}
