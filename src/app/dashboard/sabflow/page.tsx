import * as React from "react";
import { Suspense } from "react";
import { DashboardClient } from "./_components/dashboard-client";
import { getSabflowDashboardData } from "./actions";
import SabFlowLoading from "./loading";

export const dynamic = "force-dynamic";

async function DashboardData() {
  const initialData = await getSabflowDashboardData();
  return <DashboardClient initialData={initialData} />;
}

export default function SabFlowIndexPage() {
  return (
    <Suspense fallback={<SabFlowLoading />}>
      <DashboardData />
    </Suspense>
  );
}
