/**
 * SabSMS campaigns — server entry (V2.3).
 *
 * Reads the real `sabsms_campaigns` collection (status chips, progress
 * from `stats` vs the launched recipient count, throttle, schedule) and
 * hands fully-projected rows to the interactive `<CampaignsTable>`.
 * All mutations (launch / pause / resume / cancel / duplicate / …) are
 * server actions in `./actions.ts` that route through the Rust engine.
 */

import { getCachedSession } from "@/lib/server-cache";

import { CampaignsTable } from "./campaigns-table";
import {
  loadCampaigns,
  loadFilterOptions,
  type CampaignListFilters,
} from "./actions";
import { rollupCampaigns } from "./helpers";
import type { SabsmsCampaignStatus } from "@/lib/sabsms/types";

export const dynamic = "force-dynamic";

type SearchParamValue = string | string[] | undefined;

interface CampaignsPageProps {
  searchParams: Promise<Record<string, SearchParamValue>>;
}

function asArray(v: SearchParamValue): string[] | undefined {
  if (v === undefined) return undefined;
  const arr = Array.isArray(v) ? v : [v];
  const cleaned = arr.filter(Boolean);
  return cleaned.length > 0 ? cleaned : undefined;
}

function asString(v: SearchParamValue): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v || undefined;
}

export default async function CampaignsPage({
  searchParams,
}: CampaignsPageProps) {
  const sp = await searchParams;
  const session = await getCachedSession();
  const workspaceId = String(
    (session?.user as { _id?: unknown } | undefined)?._id ?? "",
  );

  if (!workspaceId) {
    return (
      <div className="20ui space-y-3 p-6">
        <h1 className="text-2xl font-semibold text-[var(--st-text)]">
          Campaigns
        </h1>
        <p className="text-sm text-[var(--st-text-secondary)]">
          Sign in to view your SabSMS campaigns.
        </p>
      </div>
    );
  }

  const filters: CampaignListFilters = {
    q: asString(sp.q),
    status: asArray(sp.status) as SabsmsCampaignStatus[] | undefined,
    createdBy: asArray(sp.createdBy),
    templateId: asArray(sp.template),
    tag: asArray(sp.tag),
    from: asString(sp.from),
    to: asString(sp.to),
    sort: asString(sp.sort) ?? "newest",
    archived: asString(sp.archived) === "true",
  };

  const [{ rows, total, chartSeries }, { creators, templates }] =
    await Promise.all([
      loadCampaigns(workspaceId, filters),
      loadFilterOptions(workspaceId),
    ]);

  return (
    <div className="20ui mx-auto w-full max-w-[1600px] space-y-4 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--st-text)]">
            Campaigns
          </h1>
          <p className="mt-1 text-sm text-[var(--st-text-secondary)]">
            Schedule, throttle, and observe outbound SMS campaigns. Launch
            drafts, pause or resume running sends, and duplicate past winners.
          </p>
        </div>
        <a
          href="/sabsms/campaigns/create"
          className="inline-flex h-9 items-center rounded-[var(--st-radius)] bg-[var(--st-accent)] px-4 text-sm font-medium text-[var(--st-accent-contrast,white)] hover:opacity-90"
        >
          New campaign
        </a>
      </div>
      <CampaignsTable
        rows={rows}
        total={total}
        chartSeries={chartSeries}
        creators={creators}
        templates={templates}
        rollup={rollupCampaigns(rows)}
      />
    </div>
  );
}
