import * as React from "react";
import { Suspense } from "react";
import { SabflowPage } from "./_components/sabflow-page";
import { DashboardClient } from "./_components/dashboard-client";
import { getSabflowDashboardData } from "./actions";
import SabFlowLoading from "./loading";

export const dynamic = "force-dynamic";

async function DashboardData() {
  const initialData = await getSabflowDashboardData();
  return <DashboardClient initialData={initialData} />;
}

export default function SabFlowIndexPage() {
  // `variant="app"`: the dashboard client owns its own header + padding
  // (p-6 md:p-8), so the frame only contributes the .ui20 token scope and
  // background — a default frame here would double the gutters.
  return (
    <SabflowPage variant="app">
      <Suspense fallback={<SabFlowLoading />}>
        <DashboardData />
      </Suspense>
    </SabflowPage>
  );
}
