import * as React from "react";
import { DashboardClient } from "./_components/dashboard-client";
import { getSabflowDashboardData } from "./actions";

export const dynamic = "force-dynamic";

export default async function SabFlowIndexPage() {
  const initialData = await getSabflowDashboardData();
  
  return <DashboardClient initialData={initialData} />;
}
