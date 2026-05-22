import { GitBranch } from "lucide-react";

import { getCachedSession } from "@/lib/server-cache";
import { getSabsmsCollections } from "@/lib/sabsms/db/collections";
import { SabsmsPageShell } from "@/components/sabsms/page-toolkit";

import { DripsTable } from "./drips-table";
import {
  loadDrips,
  loadTemplateFacetOptions,
  type DripListFilters,
} from "./actions";

/**
 * Drips list page (Page 12 of `plans/sabsms-pages-catalog.md`).
 *
 * Server entry — resolves the workspace, reads URL search params into
 * a typed `DripListFilters`, hydrates the rows + template facet, then
 * hands control to the client `<DripsTable>` for the interactive
 * filter / bulk-action UI.
 *
 * Page-specific features (20 from §B.2) live in `drips-table.tsx`;
 * shared features (the 30 from §A) come from `@/components/sabsms/page-toolkit`.
 */

export const dynamic = "force-dynamic";

interface SabsmsDripsPageProps {
  searchParams: Promise<{
    q?: string;
    enabled?: string;
    trigger?: string | string[];
    templateId?: string;
    withErrors?: string;
    sort?: string;
  }>;
}

function asArray(v: string | string[] | undefined): string[] | undefined {
  if (!v) return undefined;
  return Array.isArray(v) ? v : [v];
}

export default async function SabsmsDripsPage({
  searchParams,
}: SabsmsDripsPageProps) {
  const sp = await searchParams;
  const session = await getCachedSession();
  const workspaceId = String(
    (session?.user as { _id?: unknown } | undefined)?._id ?? "",
  );

  if (!workspaceId) {
    return (
      <SabsmsPageShell
        eyebrow="SabSMS"
        title="Drip sequences"
        description="Sign in to view your drip sequences."
        breadcrumbs={[{ label: "Drips" }]}
      >
        <div className="rounded-md border border-dashed border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
          Workspace not resolved.
        </div>
      </SabsmsPageShell>
    );
  }

  // Surface side-effect: ensure indexes get touched once.
  await getSabsmsCollections();

  const filters: DripListFilters = {
    q: sp.q,
    enabled:
      sp.enabled === "enabled"
        ? "enabled"
        : sp.enabled === "disabled"
          ? "disabled"
          : "all",
    trigger: asArray(sp.trigger)?.filter(
      (t): t is "manual" | "segment_join" | "event" =>
        t === "manual" || t === "segment_join" || t === "event",
    ),
    templateId: sp.templateId,
    withErrors: sp.withErrors === "1",
    sort: (sp.sort as DripListFilters["sort"]) ?? "newest",
  };

  const [rows, templateOptions] = await Promise.all([
    loadDrips(workspaceId, filters),
    loadTemplateFacetOptions(workspaceId),
  ]);

  return (
    <SabsmsPageShell
      eyebrow="SabSMS · Outbound"
      title="Drip sequences"
      description="Time-based and event-driven messaging journeys. Filter by status, trigger, template, or error state — then build new drips with the visual canvas."
      breadcrumbs={[{ label: "Drips" }]}
      primaryAction={{ label: "New drip", href: "/sabsms/drips/new" }}
      helpTitle="What is a drip?"
      helpBody={
        <div className="space-y-2">
          <p>
            A drip is a multi-step messaging journey that auto-advances on a
            timer or in response to contact activity (replied / clicked /
            opened).
          </p>
          <p>
            Use the table to pause noisy drips, duplicate winners, or run a
            test enrolment without affecting your real audience.
          </p>
        </div>
      }
    >
      {rows.length === 0 && Object.values(filters).every((v) => !v || v === "all") ? (
        <EmptyHero />
      ) : (
        <DripsTable rows={rows} templateOptions={templateOptions} />
      )}
    </SabsmsPageShell>
  );
}

function EmptyHero() {
  return (
    <div className="rounded-md border border-dashed border-slate-200 bg-white p-12 text-center">
      <div className="mx-auto mb-3 inline-flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-500">
        <GitBranch className="h-5 w-5" />
      </div>
      <h2 className="text-base font-semibold text-slate-900">No drips yet</h2>
      <p className="mx-auto mt-1 max-w-md text-sm text-slate-600">
        Build your first drip to nudge replies, recover abandoned carts, or
        send a welcome series. The visual builder ships with templates,
        branches, and a dry-run mode.
      </p>
      <a
        href="/sabsms/drips/new"
        className="mt-4 inline-flex items-center rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-slate-800"
      >
        New drip
      </a>
    </div>
  );
}
