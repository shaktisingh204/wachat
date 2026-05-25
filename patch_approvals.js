const fs = require('fs');
const file = '/Users/harshkhandelwal/Downloads/sabnode/src/app/sabsms/templates/approvals/page.tsx';

let code = `import React, { Suspense } from "react";
import { getCachedSession } from "@/lib/server-cache";
import { SabsmsPageShell } from "@/components/sabsms/page-toolkit";
import { StatCard } from "@/components/zoruui";
import { fmtQty } from "@/lib/utils";

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

async function ApprovalsDataLoader({ searchParams }: PageProps) {
  const sp = await searchParams;
  const session = await getCachedSession();
  const workspaceId = String(
    (session?.user as { _id?: unknown } | undefined)?._id ?? "",
  );

  if (!workspaceId) return null;

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
    <>
      <section className="grid grid-cols-1 gap-3 md:grid-cols-4 mb-6">
        <StatCard label="Pending" value={fmtQty(stats.pending)} />
        <StatCard
          label="Approved today"
          value={fmtQty(stats.approvedToday)}
        />
        <StatCard
          label="Rejected today"
          value={fmtQty(stats.rejectedToday)}
        />
        <StatCard
          label="Avg time-to-approval"
          value={avgMinutesOverall > 0 ? \`\${avgMinutesOverall} min\` : "—"}
          period={
            categoryDecisions > 0
              ? \`from \${categoryDecisions} recent decisions\`
              : "no decisions yet"
          }
        />
      </section>

      <ApprovalsTable
        workspaceId={workspaceId}
        initialRows={rows}
        perCategoryAvg={stats.avgTimeToApprovalMin}
      />
    </>
  );
}

export default async function SabsmsApprovalsPage(props: PageProps) {
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
      <Suspense fallback={<div className="h-96 w-full bg-slate-100 animate-pulse rounded-xl" />}>
        <ApprovalsDataLoader {...props} />
      </Suspense>
    </SabsmsPageShell>
  );
}
`;
fs.writeFileSync(file, code);
