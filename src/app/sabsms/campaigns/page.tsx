/**
 * SabSMS — `/sabsms/campaigns` (Page 6).
 *
 * Outbound campaign list. Server component that resolves the workspace
 * from the cached session, queries `sabsms_campaigns` with the URL
 * filter state, and hands a fully-projected `CampaignRow[]` to the
 * client table. The 30 shared toolkit features (S1-S30) ride on top
 * of `SabsmsPageShell` + `SabsmsFilterBar` + `SabsmsDataTable`; the 20
 * page-unique features are in `campaigns-table.tsx`.
 */

import { getCachedSession } from "@/lib/server-cache";

import { SabsmsPageShell } from "@/components/sabsms/page-toolkit";

import { CampaignsTableWithRollup } from "./campaigns-table";
import {
  loadCampaigns,
  loadFilterOptions,
  type CampaignListFilters,
} from "./actions";
import type { SabsmsCampaignStatus } from "@/lib/sabsms/types";

export const dynamic = "force-dynamic";

type RawSearchParams = Record<string, string | string[] | undefined>;

function asArray(v: string | string[] | undefined): string[] {
  if (v === undefined) return [];
  return Array.isArray(v) ? v : [v];
}

function asOne(v: string | string[] | undefined): string | undefined {
  if (v === undefined) return undefined;
  return Array.isArray(v) ? v[0] : v;
}

const STATUS_VALUES: SabsmsCampaignStatus[] = [
  "draft",
  "scheduled",
  "running",
  "paused",
  "completed",
  "cancelled",
  "failed",
];

function parseStatuses(raw: string[]): SabsmsCampaignStatus[] {
  return raw.filter((s): s is SabsmsCampaignStatus =>
    (STATUS_VALUES as string[]).includes(s),
  );
}

export default async function SabsmsCampaignsPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const sp = await searchParams;
  const session = await getCachedSession();
  const workspaceId = String(
    (session?.user as { _id?: unknown } | undefined)?._id ?? "",
  );

  if (!workspaceId) {
    return (
      <SabsmsPageShell
        title="Campaigns"
        breadcrumbs={[{ label: "Campaigns" }]}
        description="Sign in to view your SabSMS campaigns."
      >
        <p className="text-sm text-zoru-ink-muted">No session.</p>
      </SabsmsPageShell>
    );
  }

  const filters: CampaignListFilters = {
    q: asOne(sp.q),
    status: parseStatuses(asArray(sp.status)),
    createdBy: asArray(sp.createdBy),
    templateId: asArray(sp.template),
    tag: asArray(sp.tag),
    from: asOne(sp.from),
    to: asOne(sp.to),
    sort: asOne(sp.sort),
    archived: asOne(sp.archived) === "true",
  };

  const [{ rows, total, chartSeries }, options] = await Promise.all([
    loadCampaigns(workspaceId, filters),
    loadFilterOptions(workspaceId),
  ]);

  return (
    <SabsmsPageShell
      title="Campaigns"
      description="Schedule, throttle, and observe outbound SMS campaigns. Pause, duplicate, or convert any campaign into a drip or reusable template from the row menu."
      breadcrumbs={[{ label: "Campaigns" }]}
      primaryAction={{ label: "New campaign", href: "/sabsms/campaigns/new" }}
      secondaryActions={[
        { label: "Templates", onSelectHref: "/sabsms/templates" },
        { label: "Drips", onSelectHref: "/sabsms/drips" },
        { label: "Logs", onSelectHref: "/sabsms/logs" },
      ]}
      helpTitle="How campaigns work"
      helpBody={
        <>
          Each row is one entry in{" "}
          <code className="rounded bg-zoru-surface-2 px-1">
            sabsms_campaigns
          </code>
          . Running campaigns expose pause / resume / cancel from the row
          menu; completed campaigns expose duplicate, archive, and
          convert-to-drip. Select two rows then use{" "}
          <em>Compare two</em> in the bulk bar for a side-by-side stat
          block.
        </>
      }
    >
      <CampaignsTableWithRollup
        rows={rows}
        total={total}
        chartSeries={chartSeries}
        creators={options.creators}
        templates={options.templates}
      />
    </SabsmsPageShell>
  );
}
