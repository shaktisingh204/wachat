"use client";

import * as React from "react";
import { Crown } from "lucide-react";

import { Badge } from "@/components/sabcrm/20ui";
import {
  SabsmsDataTable,
  SabsmsExportMenu,
  SabsmsFilterBar,
  rowsToCsv,
  type SabsmsColumn,
} from "@/components/sabsms/page-toolkit";
import { fmtDate } from "@/lib/utils";

import type { TeamMemberRow } from "./actions";

interface TeamTableProps {
  initialRows: TeamMemberRow[];
  total: number;
}

function formatRelative(iso?: string): string {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "—";
  const diff = Date.now() - t;
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return fmtDate(iso);
}

/**
 * Read-only roster of the real workspace members (owner + active agents +
 * pending invitations). Member management — invite, role change, removal — is
 * handled by the platform team settings against the single RBAC model; this
 * surface intentionally does not duplicate (and previously faked) those writes.
 */
export function TeamTable({ initialRows, total }: TeamTableProps) {
  const [rows, setRows] = React.useState(initialRows);

  React.useEffect(() => {
    setRows(initialRows);
  }, [initialRows]);

  const columns: SabsmsColumn<TeamMemberRow>[] = [
    {
      id: "user",
      header: "User",
      width: "240px",
      render: (r) => (
        <div className="flex items-center gap-2">
          {r.isOwner && <Crown className="h-3.5 w-3.5 text-[var(--st-warn)]" aria-label="Owner" />}
          <div className="flex flex-col">
            <span className="font-medium text-sm text-[var(--st-text)]">{r.name || r.email}</span>
            {r.name && <span className="text-xs text-[var(--st-text-secondary)]">{r.email}</span>}
          </div>
        </div>
      ),
    },
    {
      id: "status",
      header: "Status",
      width: "110px",
      render: (r) => (
        <Badge variant={r.status === "active" ? "outline" : "secondary"} className="text-[10px] uppercase">
          {r.status === "active" ? "Active" : "Invited"}
        </Badge>
      ),
    },
    {
      id: "role",
      header: "Role",
      width: "140px",
      render: (r) => (
        <Badge variant="outline" className="text-[10px]">
          {r.role}
        </Badge>
      ),
    },
    {
      id: "lastSeen",
      header: "Last Seen",
      width: "140px",
      render: (r) =>
        r.status === "invited" ? (
          <span className="text-xs text-[var(--st-text-secondary)]">
            {r.invitedExpiresAt ? `Expires ${fmtDate(r.invitedExpiresAt)}` : "Pending"}
          </span>
        ) : (
          <span className="text-xs text-[var(--st-text)]">{formatRelative(r.lastSeenAt)}</span>
        ),
    },
  ];

  return (
    <div className="space-y-4">
      <SabsmsFilterBar
        searchPlaceholder="Search email, name..."
        facets={[
          {
            key: "role",
            label: "Role",
            multi: true,
            options: [
              { value: "owner", label: "Owner" },
              { value: "admin", label: "Admin" },
              { value: "agent", label: "Agent" },
              { value: "marketer", label: "Marketer" },
              { value: "developer", label: "Developer" },
              { value: "member", label: "Member" },
            ],
          },
          {
            key: "status",
            label: "Status",
            multi: false,
            options: [
              { value: "active", label: "Active" },
              { value: "invited", label: "Pending Invite" },
            ],
          },
        ]}
        trailing={
          <SabsmsExportMenu
            filename="sabsms-team"
            toCsv={async () =>
              rowsToCsv(rows as unknown as Array<Record<string, unknown>>, [
                { key: "email", header: "email" },
                { key: "name", header: "name" },
                { key: "role", header: "role" },
                { key: "status", header: "status" },
              ])
            }
            toJson={async () => JSON.stringify(rows, null, 2)}
          />
        }
      />

      <SabsmsDataTable
        rows={rows}
        total={total}
        page={0}
        pageSize={50}
        columns={columns}
        rowKey={(r) => r.id}
        emptyTitle="No team members"
        emptyDescription="Invite members from your workspace team settings to collaborate on SabSMS."
      />

      <p className="text-xs text-[var(--st-text-secondary)]">
        This is your live workspace roster. To invite members, change roles, or
        remove access, use your{" "}
        <a className="underline" href="/dashboard/settings">
          workspace team settings
        </a>
        . Permissions there flow through to SabSMS automatically.
      </p>
    </div>
  );
}
