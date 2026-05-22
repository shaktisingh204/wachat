/**
 * SabSMS — `/sabsms/analytics/cohorts` (Page 40).
 *
 * Cohort retention analytics. Shows how groups of users (cohorts) behave over time.
 */

import { getCachedSession } from "@/lib/server-cache";
import { SabsmsPageShell } from "@/components/sabsms/page-toolkit";
import { CohortsDashboard } from "./cohorts-dashboard";
import { loadCohorts, loadFilterOptions, type CohortFilters } from "./actions";

export const dynamic = "force-dynamic";

type RawSearchParams = Record<string, string | string[] | undefined>;

function asOne(v: string | string[] | undefined): string | undefined {
  if (v === undefined) return undefined;
  return Array.isArray(v) ? v[0] : v;
}

export default async function SabsmsCohortsPage({
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
        title="Cohorts Analytics"
        breadcrumbs={[{ label: "Analytics", href: "/sabsms/analytics" }, { label: "Cohorts" }]}
        description="View your workspace's cohort retention."
      >
        <p className="text-sm text-zoru-ink-muted">No session.</p>
      </SabsmsPageShell>
    );
  }

  const filters: CohortFilters = {
    definition: (asOne(sp.definition) as any) || "first-message",
    metric: (asOne(sp.metric) as any) || "sends",
    source: asOne(sp.source),
    campaign: asOne(sp.campaign),
    splitBy: (asOne(sp.splitBy) as any) || "none",
    q: asOne(sp.q),
  };

  const [data, options] = await Promise.all([
    loadCohorts(workspaceId, filters),
    loadFilterOptions(workspaceId),
  ]);

  return (
    <SabsmsPageShell
      title="Cohort Retention"
      description="Analyse retention over time grouped by the user's first interaction date. View drop-offs, compare cohorts, and drill-down into raw contacts."
      breadcrumbs={[
        { label: "Analytics", href: "/sabsms/analytics" },
        { label: "Cohorts" },
      ]}
      primaryAction={{ label: "Export PDF", onSelectHref: "#" }}
      secondaryActions={[
        { label: "Funnel Reports", onSelectHref: "/sabsms/analytics/funnel" },
        { label: "Logs", onSelectHref: "/sabsms/logs" },
        { label: "Schedule periodic export", onSelectHref: "#" },
        { label: "Public share link", onSelectHref: "#" },
      ]}
      helpTitle="How cohorts work"
      helpBody={
        <>
          Cohorts group contacts based on a common characteristic (e.g., first message date). The matrix shows how their engagement (retention, replies) holds up over subsequent weeks or months.
        </>
      }
    >
      <CohortsDashboard
        data={data}
        options={options}
      />
    </SabsmsPageShell>
  );
}
