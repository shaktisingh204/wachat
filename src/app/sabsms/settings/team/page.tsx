import React, { Suspense } from "react";
import { getCachedSession } from "@/lib/server-cache";
import { SabsmsPageShell } from "@/components/sabsms/page-toolkit";
import { TeamTable } from "./team-table";
import { loadTeamMembers } from "./actions";
import { RbacMatrixClient } from "./rbac-matrix-client";
import { StatCard } from '@/components/sabcrm/20ui';
import { Users, ShieldCheck, MailWarning, Activity } from "lucide-react";
import { fmtQty } from "@/lib/utils";

export const dynamic = "force-dynamic";

async function TeamDataLoader() {
  const session = await getCachedSession();
  const user = session?.user as { _id?: unknown; name?: string; workspaceName?: string } | undefined;
  const workspaceId = String(user?._id ?? "");

  if (!workspaceId) {
    return <div className="text-sm text-[var(--st-text)]">Please sign in to continue.</div>;
  }

  const { rows, total } = await loadTeamMembers(workspaceId);
  const activeCount = rows.filter((r) => r.status === "active").length;
  const adminCount = rows.filter((r) => r.role === "sabsms_admin").length;
  const totalApiUsage = rows.reduce((acc, r) => acc + (r.apiKeyUsage || 0), 0);

  return (
    <div className="space-y-10 pb-12">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Members"
          value={total}
          delta={12}
          period="vs last month"
          icon={<Users className="w-4 h-4" />}
        />
        <StatCard
          label="Active Admins"
          value={adminCount}
          icon={<ShieldCheck className="w-4 h-4" />}
        />
        <StatCard
          label="Pending Invites"
          value={total - activeCount}
          delta={-2}
          period="vs last month"
          icon={<MailWarning className="w-4 h-4" />}
          invertDelta
        />
        <StatCard
          label="Total API Usage"
          value={fmtQty(totalApiUsage)}
          delta={24}
          period="vs last month"
          icon={<Activity className="w-4 h-4" />}
        />
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-[var(--st-border)]">
        <div className="mb-6">
          <h3 className="text-xl font-semibold tracking-tight text-[var(--st-text)]">Workspace Members</h3>
          <p className="text-sm text-[var(--st-text)] mt-1">View and manage the people who have access to this workspace.</p>
        </div>
        <TeamTable initialRows={rows} total={total} />
      </div>

      <RbacMatrixClient />
    </div>
  );
}

export default function TeamSettingsPage() {
  return (
    <SabsmsPageShell
      title="Team"
      eyebrow="Settings"
      description="Manage workspace members, role assignments, and API rate limits."
      breadcrumbs={[{ label: "Settings", href: "/sabsms/settings" }, { label: "Team" }]}
      helpTitle="Team & RBAC"
      helpBody={
        <>
          Manage team members, roles, and security settings for the SabSMS workspace. 
          You can override global rate limits and daily send caps per member.
        </>
      }
      primaryAction={{
        label: "SSO Connection",
        onSelectHref: "/sabsms/settings/team", // Self link just for mocking SSO click
      }}
      secondaryActions={[
        { label: "Workspace Settings", onSelectHref: "/sabsms/settings" },
        { label: "Billing", onSelectHref: "/sabsms/settings/billing" },
      ]}
    >
      <Suspense fallback={<div className="h-64 w-full bg-[var(--st-bg-muted)] animate-pulse rounded-xl" />}>
        <TeamDataLoader />
      </Suspense>
    </SabsmsPageShell>
  );
}
