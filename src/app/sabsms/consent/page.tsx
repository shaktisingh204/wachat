/**
 * SabSMS consent log — server entry.
 *
 * Catalog: `plans/sabsms-pages-catalog.md` Page 21 §B.3.
 *
 * Resolves the workspace, hydrates the consent event list + jurisdiction
 * badges + cohort chart + reason taxonomy, then hands them to the
 * interactive `<ConsentTable>` client surface.
 */

import { SabsmsPageShell } from "@/components/sabsms/page-toolkit";
import { getCachedSession } from "@/lib/server-cache";
import type {
  SabsmsConsentEvent,
  SabsmsConsentKind,
} from "@/lib/sabsms/types";

import {
  type ConsentFilters,
  loadCohortRetention,
  loadConsentEvents,
  loadConsentReasonTaxonomy,
  loadJurisdictionStatus,
} from "./actions";
import { ConsentTable } from "./consent-table";

export const dynamic = "force-dynamic";

interface ConsentPageProps {
  searchParams: Promise<{
    q?: string;
    kind?: string | string[];
    captureMethod?: string | string[];
    sourceQuery?: string;
    sort?: string;
    from?: string;
    to?: string;
    page?: string;
    pageSize?: string;
  }>;
}

function asArray(v: string | string[] | undefined): string[] | undefined {
  if (!v) return undefined;
  return Array.isArray(v) ? v : [v];
}

export default async function SabsmsConsentPage({
  searchParams,
}: ConsentPageProps) {
  const sp = await searchParams;
  const session = await getCachedSession();
  const workspaceId = String(
    (session?.user as { _id?: unknown } | undefined)?._id ?? "",
  );
  const role = String(
    (session?.user as { role?: unknown } | undefined)?.role ?? "",
  );
  const isAdmin = role === "admin";

  if (!workspaceId) {
    return (
      <SabsmsPageShell
        title="Consent log"
        description="Sign in to view your workspace's consent log."
        breadcrumbs={[{ label: "Compliance" }, { label: "Consent log" }]}
      >
        <></>
      </SabsmsPageShell>
    );
  }

  const page = Math.max(0, parseInt(sp.page ?? "0", 10) || 0);
  const pageSize = Math.max(
    1,
    Math.min(250, parseInt(sp.pageSize ?? "50", 10) || 50),
  );

  const filters: ConsentFilters = {
    q: sp.q,
    kind: asArray(sp.kind) as SabsmsConsentKind[] | undefined,
    captureMethod: asArray(sp.captureMethod) as
      | SabsmsConsentEvent["captureMethod"][]
      | undefined,
    sourceQuery: sp.sourceQuery,
    sort: (sp.sort as ConsentFilters["sort"]) ?? "newest",
    from: sp.from,
    to: sp.to,
    page,
    pageSize,
  };

  const [{ rows, total }, jurisdictions, cohort, reasonTaxonomy] =
    await Promise.all([
      loadConsentEvents(workspaceId, filters),
      loadJurisdictionStatus(workspaceId),
      loadCohortRetention(workspaceId),
      loadConsentReasonTaxonomy(workspaceId),
    ]);

  return (
    <SabsmsPageShell
      eyebrow="Compliance"
      title="Consent log"
      description={
        <>
          Every opt-in and opt-out — audit-ready, hash-only, signed
          exports. <span className="text-slate-500">
            · {total.toLocaleString()} events
          </span>
        </>
      }
      breadcrumbs={[{ label: "Compliance" }, { label: "Consent log" }]}
      helpTitle="What lives in the consent log?"
      helpBody={
        <>
          Every consent state change — opt-in (single or double), STOP /
          complaint / carrier-block opt-outs, and START / UNSTOP
          restarts. Exports are signed with a SHA-256 footer hash so
          downstream auditors can verify integrity.
        </>
      }
    >
      <ConsentTable
        rows={rows}
        total={total}
        page={page}
        pageSize={pageSize}
        jurisdictions={jurisdictions}
        cohort={cohort}
        reasonTaxonomy={reasonTaxonomy}
        isAdmin={isAdmin}
      />
    </SabsmsPageShell>
  );
}
