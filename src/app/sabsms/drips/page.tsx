import { GitBranch, PlayCircle, Users, Zap, Activity, BarChart3, Workflow } from "lucide-react";
import { getCachedSession } from "@/lib/server-cache";
import { getSabsmsCollections } from "@/lib/sabsms/db/collections";
import { SabsmsPageShell } from "@/components/sabsms/page-toolkit";
import { Card, CardBody, CardHeader, CardTitle } from '@/components/sabcrm/20ui';

import { DripsTable } from "./drips-table";
import {
  loadDrips,
  loadTemplateFacetOptions,
  type DripListFilters,
} from "./actions";

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
        <div className="rounded-md border border-dashed border-[var(--st-border)] bg-white p-10 text-center text-sm text-[var(--st-text)]">
          Workspace not resolved.
        </div>
      </SabsmsPageShell>
    );
  }

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

  // Success Metrics & Active Nodes calculations
  const totalDrips = rows.length;
  const activeDrips = rows.filter((r) => r.enabled).length;
  const totalActiveNodes = rows.reduce((sum, r) => sum + r.stepCount + r.branchCount, 0);
  const totalActiveRecipients = rows.reduce((sum, r) => sum + r.activeRecipients, 0);
  const avgConversion = totalDrips > 0 
    ? rows.reduce((sum, r) => sum + r.conversionRate, 0) / totalDrips 
    : 0;
  const totalThroughput = rows.reduce((sum, r) => sum + r.throughputPerMin, 0);

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
      {/* BULKY DATA-RICH DASHBOARD HEADER */}
      <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-gradient-to-br from-[var(--st-text)] to-[var(--st-text)] text-white shadow-xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-white text-sm font-medium flex items-center gap-2">
              <Workflow className="h-4 w-4 text-[var(--st-text-secondary)]" />
              Active Nodes
            </CardTitle>
          </CardHeader>
          <CardBody>
            <div className="text-4xl font-bold tracking-tight">{totalActiveNodes}</div>
            <p className="mt-1 text-xs text-[var(--st-text-secondary)] flex items-center gap-1">
              Across {activeDrips} running drips
            </p>
          </CardBody>
        </Card>

        <Card className="shadow-md border-[var(--st-border)]/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-[var(--st-text)] text-sm font-medium flex items-center gap-2">
              <Users className="h-4 w-4 text-[var(--st-text)]" />
              Active Enrolments
            </CardTitle>
          </CardHeader>
          <CardBody>
            <div className="text-4xl font-bold tracking-tight text-[var(--st-text)]">{totalActiveRecipients.toLocaleString()}</div>
            <p className="mt-1 text-xs text-[var(--st-text)] flex items-center gap-1">
              Contacts currently flowing
            </p>
          </CardBody>
        </Card>

        <Card className="shadow-md border-[var(--st-border)]/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-[var(--st-text)] text-sm font-medium flex items-center gap-2">
              <Activity className="h-4 w-4 text-[var(--st-text)]" />
              Global Throughput
            </CardTitle>
          </CardHeader>
          <CardBody>
            <div className="text-4xl font-bold tracking-tight text-[var(--st-text)]">{totalThroughput.toFixed(1)}</div>
            <p className="mt-1 text-xs text-[var(--st-text)] flex items-center gap-1">
              Messages per minute
            </p>
          </CardBody>
        </Card>

        <Card className="shadow-md border-[var(--st-border)]/60 bg-gradient-to-br from-[var(--st-bg-muted)]/50 to-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-[var(--st-text)] text-sm font-medium flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-[var(--st-text)]" />
              Avg Conversion
            </CardTitle>
          </CardHeader>
          <CardBody>
            <div className="text-4xl font-bold tracking-tight text-[var(--st-text)]">
              {(avgConversion * 100).toFixed(1)}%
            </div>
            <p className="mt-1 text-xs text-[var(--st-text)]/70 flex items-center gap-1">
              End-to-end success rate
            </p>
          </CardBody>
        </Card>
      </div>

      {rows.length === 0 && Object.values(filters).every((v) => !v || v === "all") ? (
        <EmptyHero />
      ) : (
        <div className="rounded-xl border border-[var(--st-border)] bg-white shadow-sm overflow-hidden">
          <div className="p-1 border-b border-[var(--st-border)] bg-[var(--st-bg-muted)]/50">
            <DripsTable rows={rows} templateOptions={templateOptions} />
          </div>
        </div>
      )}
    </SabsmsPageShell>
  );
}

function EmptyHero() {
  return (
    <div className="rounded-2xl border border-dashed border-[var(--st-border)] bg-white p-12 text-center shadow-sm">
      <div className="mx-auto mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full bg-[var(--st-bg-muted)] text-[var(--st-text-secondary)] border border-[var(--st-border)] shadow-sm">
        <GitBranch className="h-6 w-6" />
      </div>
      <h2 className="text-lg font-semibold text-[var(--st-text)] tracking-tight">No drips yet</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-[var(--st-text)] leading-relaxed">
        Build your first drip to nudge replies, recover abandoned carts, or
        send a welcome series. The visual builder ships with templates,
        branches, and a dry-run mode.
      </p>
      <a
        href="/sabsms/drips/new"
        className="mt-6 inline-flex items-center rounded-lg bg-[var(--st-text)] px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-[var(--st-text)] transition-colors"
      >
        <PlayCircle className="mr-2 h-4 w-4" /> Create First Drip
      </a>
    </div>
  );
}
