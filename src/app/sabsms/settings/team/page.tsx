import React, { Suspense } from "react";
import { getCachedSession } from "@/lib/server-cache";
import { SabsmsPageShell } from "@/components/sabsms/page-toolkit";
import { TeamTable } from "./team-table";
import { loadTeamMembers } from "./actions";
import { RbacMatrixClient } from "./rbac-matrix-client";
import { StatCard } from "@/components/sabcrm/20ui";
import { Users, ShieldCheck, MailWarning } from "lucide-react";

export const dynamic = "force-dynamic";

const ADMIN_ROLES = new Set(["owner", "admin", "sabsms_admin"]);

async function TeamDataLoader() {
  const session = await getCachedSession();
  const user = session?.user as { _id?: unknown } | undefined;
  const workspaceId = String(user?._id ?? "");

  if (!workspaceId) {
    return <div className="text-sm text-[var(--st-text)]">Please sign in to continue.</div>;
  }

  const { rows, total } = await loadTeamMembers(workspaceId);
  const activeCount = rows.filter((r) => r.status === "active").length;
  const adminCount = rows.filter((r) => ADMIN_ROLES.has(String(r.role))).length;
  const pendingCount = rows.filter((r) => r.status === "invited").length;

  return (
    <div className="space-y-10 pb-12">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          label="Total Members"
          value={total}
          icon={<Users className="w-4 h-4" />}
        />
        <StatCard
          label="Admins & Owners"
          value={adminCount}
          icon={<ShieldCheck className="w-4 h-4" />}
        />
        <StatCard
          label="Pending Invites"
          value={pendingCount}
          icon={<MailWarning className="w-4 h-4" />}
        />
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-[var(--st-border)]">
        <div className="mb-6">
          <h3 className="text-xl font-semibold tracking-tight text-[var(--st-text)]">Workspace Members</h3>
          <p className="text-sm text-[var(--st-text)] mt-1">
            The {activeCount} active {activeCount === 1 ? "person" : "people"} with access to this workspace, plus any pending invites.
          </p>
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
      description="The people who have access to this SabSMS workspace and their roles."
      breadcrumbs={[{ label: "Settings", href: "/sabsms/settings" }, { label: "Team" }]}
      helpTitle="Team & RBAC"
      helpBody={
        <>
          This is your live workspace roster, resolved from the platform RBAC
          model. Roles and access are managed in your workspace team settings and
          flow through to SabSMS automatically.
        </>
      }
      secondaryActions={[
        { label: "Workspace Settings", onSelectHref: "/sabsms/settings" },
        { label: "Billing", onSelectHref: "/sabsms/settings/billing" },
      ]}
      primaryAction={{
        label: "Manage members",
        href: "/dashboard/settings",
      }}
    >
      <Suspense fallback={<div className="h-64 w-full bg-[var(--st-bg-muted)] animate-pulse rounded-xl" />}>
        <TeamDataLoader />
      </Suspense>
    </SabsmsPageShell>
  );
}
