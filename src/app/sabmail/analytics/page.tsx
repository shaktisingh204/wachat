import { redirect } from "next/navigation";

import { getSabmailWorkspaceId } from "@/lib/sabmail/workspace";

import { getSabmailAnalytics } from "./actions";
import { SabmailAnalyticsClient } from "./_client";

export const dynamic = "force-dynamic";

export default async function SabmailAnalyticsPage() {
  const workspaceId = await getSabmailWorkspaceId();
  if (!workspaceId) redirect("/sabmail/projects");

  const res = await getSabmailAnalytics();

  const kpis = res.ok
    ? res.kpis
    : { campaigns: 0, sent: 0, failed: 0, accounts: 0, contacts: 0 };
  const recentCampaigns = res.ok ? res.recentCampaigns : [];
  const loadError = res.ok ? null : res.error;

  return (
    <SabmailAnalyticsClient
      kpis={kpis}
      recentCampaigns={recentCampaigns}
      loadError={loadError}
    />
  );
}
