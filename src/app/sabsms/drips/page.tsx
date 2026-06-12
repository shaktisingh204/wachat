/**
 * `/sabsms/drips` — journeys list (V2.9).
 *
 * Backed by `sabsms_journeys` + live-run counts from
 * `sabsms_journey_runs`. The executor that advances these runs lives in
 * the `sabsms-events` PM2 worker (5 s tick).
 */

import { Activity, GitBranch, PlayCircle, Send, Users } from "lucide-react";

import { Card, CardBody, CardHeader, CardTitle } from "@/components/sabcrm/20ui";
import { SabsmsPageShell } from "@/components/sabsms/page-toolkit";
import { getCachedSession } from "@/lib/server-cache";
import type { JourneyStatus } from "@/lib/sabsms/journeys/types";

import { loadJourneys, type JourneyListFilters } from "./actions";
import { DripsTable } from "./drips-table";
import { PinpointImportButton } from "./pinpoint-import";

export const dynamic = "force-dynamic";

interface SabsmsDripsPageProps {
  searchParams: Promise<{
    q?: string;
    status?: string;
    sort?: string;
  }>;
}

const STATUSES: ReadonlyArray<JourneyStatus> = ["draft", "active", "paused", "archived"];

export default async function SabsmsDripsPage({ searchParams }: SabsmsDripsPageProps) {
  const sp = await searchParams;
  const session = await getCachedSession();
  const workspaceId = String(
    (session?.user as { _id?: unknown } | undefined)?._id ?? "",
  );

  if (!workspaceId) {
    return (
      <SabsmsPageShell
        eyebrow="SabSMS"
        title="Drips & journeys"
        description="Sign in to view your journeys."
        breadcrumbs={[{ label: "Drips" }]}
      >
        <div className="rounded-md border border-dashed border-[var(--st-border)] bg-white p-10 text-center text-sm text-[var(--st-text)]">
          Workspace not resolved.
        </div>
      </SabsmsPageShell>
    );
  }

  const filters: JourneyListFilters = {
    q: sp.q,
    status: STATUSES.includes(sp.status as JourneyStatus)
      ? (sp.status as JourneyStatus)
      : "all",
    sort: (sp.sort as JourneyListFilters["sort"]) ?? "newest",
  };

  const rows = await loadJourneys(workspaceId, filters);

  const activeJourneys = rows.filter((r) => r.status === "active").length;
  const totalActiveRuns = rows.reduce((sum, r) => sum + r.activeRuns, 0);
  const totalSends = rows.reduce((sum, r) => sum + r.stats.sends, 0);
  const totalReplies = rows.reduce((sum, r) => sum + r.stats.replies, 0);
  const replyRate = totalSends > 0 ? (totalReplies / totalSends) * 100 : 0;

  return (
    <SabsmsPageShell
      eyebrow="SabSMS · Outbound"
      title="Drips & journeys"
      description="Multi-step messaging journeys driven by the event stream: timed waits, reply/click branches, A/B arms with auto-winner, and always-on unsubscribe exits."
      breadcrumbs={[{ label: "Drips" }]}
      primaryAction={{ label: "New drip", href: "/sabsms/drips/create" }}
      toolbar={<PinpointImportButton />}
      helpTitle="What is a journey?"
      helpBody={
        <div className="space-y-2">
          <p>
            A journey enrols a contact and walks them through send / wait /
            wait-for-event / branch steps. Runs survive worker restarts —
            every step executes exactly once per contact.
          </p>
          <p>
            Unsubscribes always exit a contact immediately. Optional exit-on-reply
            stops a sequence the moment someone answers.
          </p>
        </div>
      }
    >
      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={<PlayCircle className="h-4 w-4" />}
          label="Active journeys"
          value={activeJourneys.toLocaleString()}
          hint={`${rows.length} total`}
        />
        <StatCard
          icon={<Users className="h-4 w-4" />}
          label="Contacts in flight"
          value={totalActiveRuns.toLocaleString()}
          hint="Live runs right now"
        />
        <StatCard
          icon={<Send className="h-4 w-4" />}
          label="Journey sends"
          value={totalSends.toLocaleString()}
          hint="All time"
        />
        <StatCard
          icon={<Activity className="h-4 w-4" />}
          label="Reply rate"
          value={`${replyRate.toFixed(1)}%`}
          hint={`${totalReplies.toLocaleString()} replies`}
        />
      </div>

      {rows.length === 0 && !sp.q && !sp.status ? <EmptyHero /> : <DripsTable rows={rows} />}
    </SabsmsPageShell>
  );
}

function StatCard({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-medium text-[var(--st-text)]">
          {icon}
          {label}
        </CardTitle>
      </CardHeader>
      <CardBody>
        <div className="text-3xl font-bold tracking-tight text-[var(--st-text)]">{value}</div>
        <p className="mt-1 text-xs text-[var(--st-text-secondary)]">{hint}</p>
      </CardBody>
    </Card>
  );
}

function EmptyHero() {
  return (
    <div className="rounded-2xl border border-dashed border-[var(--st-border)] bg-white p-12 text-center shadow-sm">
      <div className="mx-auto mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full border border-[var(--st-border)] bg-[var(--st-bg-muted)] text-[var(--st-text-secondary)] shadow-sm">
        <GitBranch className="h-6 w-6" />
      </div>
      <h2 className="text-lg font-semibold tracking-tight text-[var(--st-text)]">
        No journeys yet
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-[var(--st-text)]">
        Build a welcome series, a reply-branch nurture, or a win-back drip — or
        bring an existing journey over from AWS Pinpoint before it sunsets.
      </p>
      <div className="mt-6 flex items-center justify-center gap-3">
        <a
          href="/sabsms/drips/create"
          className="inline-flex items-center rounded-lg bg-[var(--st-text)] px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors"
        >
          <PlayCircle className="mr-2 h-4 w-4" /> Create your first drip
        </a>
        <PinpointImportButton />
      </div>
    </div>
  );
}
