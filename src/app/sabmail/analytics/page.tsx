import { redirect } from "next/navigation";

import { getSabmailWorkspaceId } from "@/lib/sabmail/workspace";

import {
  getSabmailAnalytics,
  getSabmailDeliverabilityStats,
  type SabmailDeliverabilityStats,
} from "./actions";
import { SabmailAnalyticsClient } from "./_client";

export const dynamic = "force-dynamic";

const EMPTY_COUNTS = {
  delivered: 0,
  open: 0,
  click: 0,
  bounce: 0,
  complaint: 0,
  unsubscribe: 0,
  deferred: 0,
  dropped: 0,
  other: 0,
} as const;

const EMPTY_RATES = {
  deliveryRate: 0,
  openRate: 0,
  clickRate: 0,
  bounceRate: 0,
  complaintRate: 0,
  unsubRate: 0,
} as const;

const EMPTY_DELIVERABILITY: SabmailDeliverabilityStats = {
  overall: { counts: { ...EMPTY_COUNTS }, rates: { ...EMPTY_RATES }, total: 0 },
  last30d: { counts: { ...EMPTY_COUNTS }, rates: { ...EMPTY_RATES }, total: 0 },
  series: [],
  topCampaigns: [],
  hasEvents: false,
};

export default async function SabmailAnalyticsPage() {
  const workspaceId = await getSabmailWorkspaceId();
  if (!workspaceId) redirect("/sabmail/projects");

  const [res, deliverabilityRes] = await Promise.all([
    getSabmailAnalytics(),
    getSabmailDeliverabilityStats(),
  ]);

  const kpis = res.ok
    ? res.kpis
    : { campaigns: 0, sent: 0, failed: 0, accounts: 0, contacts: 0 };
  const recentCampaigns = res.ok ? res.recentCampaigns : [];
  const deliverability = deliverabilityRes.ok
    ? deliverabilityRes.stats
    : EMPTY_DELIVERABILITY;
  const loadError = res.ok
    ? deliverabilityRes.ok
      ? null
      : deliverabilityRes.error
    : res.error;

  return (
    <SabmailAnalyticsClient
      kpis={kpis}
      recentCampaigns={recentCampaigns}
      deliverability={deliverability}
      loadError={loadError}
    />
  );
}
