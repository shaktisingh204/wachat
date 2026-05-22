/**
 * SabSMS template approvals — Page 11 (`/sabsms/templates/approvals`).
 *
 * Admin-flavoured review queue. Server entry loads the pending queue +
 * roll-up stats; the client `<ApprovalsTable>` owns the decision UI
 * (approve / reject dialogs, side-by-side diff, taxonomy editor, rotation
 * config, etc).
 *
 * Workspace scope is the caller's own workspace; the cross-workspace
 * admin scope is stubbed (see `./actions.ts` TODO) until a typed
 * "global admin" session helper lands.
 */

import { getCachedSession } from "@/lib/server-cache";
import { SabsmsPageShell } from "@/components/sabsms/page-toolkit";
import { StatCard } from "@/components/zoruui";

import {
  loadApprovalQueue,
  loadQueueStats,
  type ApprovalListFilters,
} from "./actions";
import { ApprovalsTable } from "./approvals-table";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{
    q?: string;
    category?: string | string[];
    submitterId?: string;
    age?: string;
    workspaceId?: string;
  }>;
}

function toArray(v: string | string[] | undefined): string[] | undefined {
  if (!v) return undefined;
  return Array.isArray(v) ? v : [v];
}

export default async function SabsmsApprovalsPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const session = await getCachedSession();
  const workspaceId = String(
    (session?.user as { _id?: unknown } | undefined)?._id ?? "",
  );

  if (!workspaceId) {
    return (
      <SabsmsPageShell
        title="Approval queue"
        breadcrumbs={[
          { label: "Templates", href: "/sabsms/templates" },
          { label: "Approvals" },
        ]}
        eyebrow="SabSMS · Admin"
      >
        <p className="text-sm text-slate-600">
          Sign in with reviewer access to use the approval queue.
        </p>
      </SabsmsPageShell>
    );
  }

  const filters: ApprovalListFilters = {
    q: sp.q,
    category: toArray(sp.category),
    submitterId: sp.submitterId,
    ageBucket: sp.age as ApprovalListFilters["ageBucket"],
    workspaceId: sp.workspaceId,
  };

  const [rows, stats] = await Promise.all([
    loadApprovalQueue(filters),
    loadQueueStats(),
  ]);

  const categoryDecisions = stats.avgTimeToApprovalMin.reduce(
    (sum, c) => sum + c.decisions,
    0,
  );
  const avgMinutesOverall =
    categoryDecisions > 0
      ? Math.round(
          stats.avgTimeToApprovalMin.reduce(
            (sum, c) => sum + c.minutes * c.decisions,
            0,
          ) / categoryDecisions,
        )
      : 0;

  return (
    <SabsmsPageShell
      eyebrow="SabSMS · Admin"
      title="Approval queue"
      description="Review template submissions, leave reviewer notes, and ship decisions. Bulk-approve same-category drafts; auto-rules apply per category when enabled."
      breadcrumbs={[
        { label: "Templates", href: "/sabsms/templates" },
        { label: "Approvals" },
      ]}
      primaryAction={{
        label: "Open templates list",
        href: "/sabsms/templates",
      }}
      secondaryActions={[
        {
          label: "Reject reasons taxonomy",
          onSelectAction: undefined,
          // The taxonomy editor is rendered inline below — secondary
          // actions stay as quick deep-links only.
          onSelectHref: "/sabsms/templates/approvals?taxonomy=open",
        },
      ]}
      helpTitle="Reviewer workflow"
      helpBody={
        <ul className="list-disc space-y-1 pl-4">
          <li>
            SLA window is 4h from submission; rows breach the SLA after that
            and surface with a red badge.
          </li>
          <li>
            Bulk-approving by category is a fast path for known-clean
            categories such as OTP.
          </li>
          <li>
            AI verdict and compliance score are advisory only — every
            decision still requires reviewer notes.
          </li>
        </ul>
      }
    >
      <section className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <ZoruStatCard label="Pending" value={stats.pending.toLocaleString()} />
        <ZoruStatCard
          label="Approved today"
          value={stats.approvedToday.toLocaleString()}
        />
        <ZoruStatCard
          label="Rejected today"
          value={stats.rejectedToday.toLocaleString()}
        />
        <ZoruStatCard
          label="Avg time-to-approval"
          value={avgMinutesOverall > 0 ? `${avgMinutesOverall} min` : "—"}
          period={
            categoryDecisions > 0
              ? `from ${categoryDecisions} recent decisions`
              : "no decisions yet"
          }
        />
      </section>

      <ApprovalsTable
        workspaceId={workspaceId}
        initialRows={rows}
        perCategoryAvg={stats.avgTimeToApprovalMin}
      />
    </SabsmsPageShell>
  );
}
