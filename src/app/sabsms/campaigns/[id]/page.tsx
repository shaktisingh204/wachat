/**
 * SabSMS — `/sabsms/campaigns/[id]` (Page 8).
 *
 * Campaign detail / analytics. Server component resolves the workspace,
 * loads the per-campaign aggregation bundle (timeline / funnel /
 * providers / countries / sender rotation / replies / opt-outs /
 * recipients / webhook fires / cost+margin / A/B), and hands the bundle
 * to the client shell. All mutations (pause / resume / cancel / edit
 * schedule / clone / convert-to-drip / share / export) route through
 * server actions in `./actions.ts`.
 */

import { getCachedSession } from "@/lib/server-cache";

import { SabsmsPageShell } from "@/components/sabsms/page-toolkit";

import { CampaignDetailClient } from "./campaign-detail-client";
import { loadCampaignDetail } from "./actions";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function SabsmsCampaignDetailPage({ params }: PageProps) {
  const { id } = await params;
  const session = await getCachedSession();
  const workspaceId = String(
    (session?.user as { _id?: unknown } | undefined)?._id ?? "",
  );

  if (!workspaceId) {
    return (
      <SabsmsPageShell
        title="Campaign"
        breadcrumbs={[
          { label: "Campaigns", href: "/sabsms/campaigns" },
          { label: "Detail" },
        ]}
        description="Sign in to view this campaign."
      >
        <p className="text-sm text-zoru-ink-muted">No session.</p>
      </SabsmsPageShell>
    );
  }

  const bundle = await loadCampaignDetail(workspaceId, id);
  const title = bundle.detail?.name ?? "Campaign";

  return (
    <SabsmsPageShell
      title={title}
      eyebrow="Campaign"
      description={
        bundle.detail
          ? `Live status, per-minute velocity, funnel, A/B, recipients, and webhook fires for this campaign.`
          : "Campaign not found in this workspace."
      }
      breadcrumbs={[
        { label: "Campaigns", href: "/sabsms/campaigns" },
        { label: title },
      ]}
      secondaryActions={[
        { label: "All campaigns", onSelectHref: "/sabsms/campaigns" },
        {
          label: "Open logs",
          onSelectHref: `/sabsms/logs?campaignId=${encodeURIComponent(id)}`,
        },
        { label: "Templates", onSelectHref: "/sabsms/templates" },
      ]}
      helpTitle="What's on this page"
      helpBody={
        <>
          Every chart reads directly from{" "}
          <code className="rounded bg-zoru-surface-2 px-1">
            sabsms_messages
          </code>{" "}
          + friends (no precomputed views). Pause / resume / cancel
          mutate <code>sabsms_campaigns.status</code> — the Rust engine
          picks the new state up on its next worker tick.
        </>
      }
    >
      <CampaignDetailClient bundle={bundle} />
    </SabsmsPageShell>
  );
}
