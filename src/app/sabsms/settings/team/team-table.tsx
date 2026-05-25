"use client";

import * as React from "react";
import {
  Key,
  LogOut,
  Mail,
  MoreHorizontal,
  Pencil,
  RefreshCw,
  Shield,
  Trash2,
  Users,
} from "lucide-react";

import { SabFilePicker } from "@/components/sabfiles";
import {
  Badge,
  Button,
  Dialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/zoruui";
import {
  SabsmsDataTable,
  SabsmsDetailDrawer,
  SabsmsExportMenu,
  SabsmsFilterBar,
  SabsmsRefreshButton,
  rowsToCsv,
  type SabsmsColumn,
} from "@/components/sabsms/page-toolkit";

import {
  bulkInviteCsv,
  bulkReassignRole,
  forceLogout,
  inviteMember,
  loadMemberAudit,
  removeMember,
  resendInvite,
  revokeInvite,
  updateMemberCaps,
  updateMemberDataAccess,
  updateMemberRole,
  type MemberAuditEntry,
  type Role,
  type TeamMemberRow,
} from "./actions";

interface TeamTableProps {
  initialRows: TeamMemberRow[];
  total: number;
}

function formatRelative(iso?: string): string {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  const diff = Date.now() - t;
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return fmtDate(iso);
}

export function TeamTable({ initialRows, total }: TeamTableProps) {
  const [rows, setRows] = React.useState(initialRows);
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [feedback, setFeedback] = React.useState<{ kind: "ok" | "err"; msg: string } | null>(null);

  React.useEffect(() => {
    setRows(initialRows);
    setSelectedIds([]);
  }, [initialRows]);

  const [inviteOpen, setInviteOpen] = React.useState(false);
  const [inviteDraft, setInviteDraft] = React.useState<{ email: string; role: Role }>({
    email: "",
    role: "agent",
  });

  const [roleEditor, setRoleEditor] = React.useState<{ open: boolean; member?: TeamMemberRow; role: Role }>({
    open: false,
    role: "agent",
  });

  const [capsEditor, setCapsEditor] = React.useState<{ open: boolean; member?: TeamMemberRow; rateLimit: string; dailyCap: string }>({
    open: false,
    rateLimit: "",
    dailyCap: "",
  });

  const [dataAccessEditor, setDataAccessEditor] = React.useState<{ open: boolean; member?: TeamMemberRow; allowedCampaigns: string; allowedTags: string }>({
    open: false,
    allowedCampaigns: "",
    allowedTags: "",
  });

  const [bulkRoleEditor, setBulkRoleEditor] = React.useState<{ open: boolean; role: Role }>({
    open: false,
    role: "agent",
  });

  const [auditDrawer, setAuditDrawer] = React.useState<{ open: boolean; member?: TeamMemberRow; entries: MemberAuditEntry[]; loading: boolean }>({
    open: false,
    entries: [],
    loading: false,
  });

  const [importOpen, setImportOpen] = React.useState(false);

  function feedbackResult(res: { ok: boolean; error?: string }, okMsg: string) {
    if (res.ok) {
      setFeedback({ kind: "ok", msg: okMsg });
    } else {
      setFeedback({ kind: "err", msg: res.error ?? "Action failed" });
    }
    setTimeout(() => setFeedback(null), 4000);
  }

  async function withBusy<T>(label: string, fn: () => Promise<T>): Promise<T> {
    setBusy(label);
    try {
      return await fn();
    } finally {
      setBusy(null);
    }
  }

  // Actions
  async function handleInvite() {
    if (!inviteDraft.email) return;
    await withBusy("invite", async () => {
      const res = await inviteMember(inviteDraft);
      feedbackResult(res, `Invited ${inviteDraft.email}`);
      if (res.ok) setInviteOpen(false);
    });
  }

  async function handleCsvPicked(file: { url: string; name: string }) {
    setImportOpen(false);
    await withBusy("import", async () => {
      const res = await bulkInviteCsv({ csv: "" });
      feedbackResult(res, `Imported ${res.sent} invites`);
    });
  }

  async function handleUpdateRole() {
    if (!roleEditor.member) return;

    if (roleEditor.member.role === "sabsms_admin" && roleEditor.role !== "sabsms_admin") {
      const adminCount = rows.filter(r => r.status === "active" && r.role === "sabsms_admin").length;
      if (adminCount <= 1) {
        feedbackResult({ ok: false, error: "Cannot downgrade the last active admin." }, "");
        return;
      }
    }

    await withBusy("role", async () => {
      const res = await updateMemberRole({ memberId: roleEditor.member!.id, role: roleEditor.role });
      feedbackResult(res, "Role updated");
      if (res.ok) {
        setRows((prev) => prev.map((r) => (r.id === roleEditor.member!.id ? { ...r, role: roleEditor.role } : r)));
        setRoleEditor({ open: false, role: "agent" });
      }
    });
  }

  async function handleBulkRole() {
    if (selectedIds.length === 0) return;

    if (bulkRoleEditor.role !== "sabsms_admin") {
      const activeAdmins = rows.filter(r => r.status === "active" && r.role === "sabsms_admin");
      const adminsToDowngrade = activeAdmins.filter(r => selectedIds.includes(r.id));
      if (activeAdmins.length > 0 && adminsToDowngrade.length === activeAdmins.length) {
        feedbackResult({ ok: false, error: "Cannot downgrade the last active admin(s)." }, "");
        return;
      }
    }

    await withBusy("bulkRole", async () => {
      const res = await bulkReassignRole({ memberIds: selectedIds, role: bulkRoleEditor.role });
      feedbackResult(res, "Roles updated");
      if (res.ok) {
        setRows((prev) => prev.map((r) => (selectedIds.includes(r.id) ? { ...r, role: bulkRoleEditor.role } : r)));
        setBulkRoleEditor({ open: false, role: "agent" });
        setSelectedIds([]);
      }
    });
  }

  async function handleUpdateCaps() {
    if (!capsEditor.member) return;
    await withBusy("caps", async () => {
      const rateLimitOverride = capsEditor.rateLimit ? parseInt(capsEditor.rateLimit, 10) : undefined;
      const dailySendCap = capsEditor.dailyCap ? parseInt(capsEditor.dailyCap, 10) : undefined;
      const res = await updateMemberCaps({ memberId: capsEditor.member!.id, rateLimitOverride, dailySendCap });
      feedbackResult(res, "Caps updated");
      if (res.ok) {
        setRows((prev) => prev.map((r) => (r.id === capsEditor.member!.id ? { ...r, rateLimitOverride, dailySendCap } : r)));
        setCapsEditor({ open: false, rateLimit: "", dailyCap: "" });
      }
    });
  }

  async function handleUpdateDataAccess() {
    if (!dataAccessEditor.member) return;
    await withBusy("dataAccess", async () => {
      const res = await updateMemberDataAccess({ memberId: dataAccessEditor.member!.id, allowedCampaigns: dataAccessEditor.allowedCampaigns, allowedTags: dataAccessEditor.allowedTags });
      feedbackResult(res, "Data access updated");
      if (res.ok) {
        setRows((prev) => prev.map((r) => (r.id === dataAccessEditor.member!.id ? { ...r, allowedCampaigns: dataAccessEditor.allowedCampaigns, allowedTags: dataAccessEditor.allowedTags } : r)));
        setDataAccessEditor({ open: false, allowedCampaigns: "", allowedTags: "" });
      }
    });
  }

  async function openAuditDrawer(row: TeamMemberRow) {
    setAuditDrawer({ open: true, member: row, entries: [], loading: true });
    const entries = await loadMemberAudit({ memberId: row.id });
    setAuditDrawer((prev) => ({ ...prev, entries, loading: false }));
  }

  const columns: SabsmsColumn<TeamMemberRow>[] = [
    {
      id: "user",
      header: "User",
      width: "220px",
      render: (r) => (
        <div className="flex flex-col">
          <span className="font-medium text-sm text-zoru-ink">{r.name || r.email}</span>
          {r.name && <span className="text-xs text-slate-500">{r.email}</span>}
        </div>
      ),
    },
    {
      id: "status",
      header: "Status",
      width: "100px",
      render: (r) => (
        <Badge variant={r.status === "active" ? "outline" : "secondary"} className="text-[10px] uppercase">
          {r.status}
        </Badge>
      ),
    },
    {
      id: "role",
      header: "Role",
      width: "120px",
      render: (r) => (
        <Badge variant="outline" className="text-[10px]">
          {r.role}
        </Badge>
      ),
    },
    {
      id: "apiUsage",
      header: "API Usage",
      width: "100px",
      align: "right",
      render: (r) => <span className="text-xs text-slate-600">{fmtQty(r.apiKeyUsage)} reqs</span>,
    },
    {
      id: "flags",
      header: "Flags",
      width: "120px",
      render: (r) => (
        <div className="flex gap-1">
          {r.twoFactorEnabled && <Badge variant="outline" className="text-[10px] border-emerald-200 text-emerald-700 bg-emerald-50">2FA</Badge>}
          {r.outOfOffice && <Badge variant="outline" className="text-[10px]">OOO</Badge>}
        </div>
      ),
    },
    {
      id: "lastSeen",
      header: "Last Seen",
      width: "120px",
      render: (r) => <span className="text-xs text-slate-500">{formatRelative(r.lastSeenAt)}</span>,
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
              { value: "sabsms_admin", label: "Admin" },
              { value: "agent", label: "Agent" },
              { value: "marketer", label: "Marketer" },
              { value: "developer", label: "Developer" },
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
          <div className="flex items-center gap-2">
            <SabsmsRefreshButton />
            <SabsmsExportMenu
              filename="sabsms-team"
              toCsv={async () =>
                rowsToCsv(
                  rows as unknown as Array<Record<string, unknown>>,
                  [
                    { key: "email", header: "email" },
                    { key: "name", header: "name" },
                    { key: "role", header: "role" },
                    { key: "status", header: "status" },
                    { key: "apiKeyUsage", header: "apiUsage" },
                  ]
                )
              }
              toJson={async () => rows.map((r) => JSON.stringify(r)).join("\n")}
            />
            <Button variant="outline" size="sm" onClick={() => setImportOpen(true)} disabled={busy !== null}>
              Bulk Invite CSV
            </Button>
            <Button size="sm" onClick={() => setInviteOpen(true)} disabled={busy !== null}>
              Invite Member
            </Button>
          </div>
        }
      />

      {feedback && (
        <div className={feedback.kind === "ok" ? "rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700" : "rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700"} role="status">
          {feedback.msg}
        </div>
      )}

      <SabsmsDataTable
        rows={rows}
        total={total}
        page={0}
        pageSize={50}
        columns={columns}
        rowKey={(r) => r.id}
        selectable
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
        bulkActions={[
          {
            label: "Re-assign role",
            icon: <Shield className="h-3.5 w-3.5" />,
            onSelect: () => setBulkRoleEditor({ open: true, role: "agent" }),
          },
        ]}
        rowActions={[
          {
            label: "Edit role",
            icon: <Shield className="h-4 w-4" />,
            onSelect: (r) => setRoleEditor({ open: true, member: r, role: r.role }),
          },
          {
            label: "Edit caps / limits",
            icon: <Pencil className="h-4 w-4" />,
            onSelect: (r) => setCapsEditor({ open: true, member: r, rateLimit: String(r.rateLimitOverride || ""), dailyCap: String(r.dailySendCap || "") }),
          },
          {
            label: "Edit data access",
            icon: <Shield className="h-4 w-4" />,
            onSelect: (r) => setDataAccessEditor({ open: true, member: r, allowedCampaigns: r.allowedCampaigns || "", allowedTags: r.allowedTags || "" }),
          },
          {
            label: "View audit log",
            icon: <Users className="h-4 w-4" />,
            onSelect: openAuditDrawer,
          },
          {
            label: "Resend invite",
            icon: <Mail className="h-4 w-4" />,
            onSelect: async (r) => {
              if (r.status !== "invited") return feedbackResult({ ok: false, error: "Member already active" }, "");
              const res = await resendInvite({ memberId: r.id });
              feedbackResult(res, "Invite resent");
            },
          },
          {
            label: "Force logout everywhere",
            icon: <LogOut className="h-4 w-4" />,
            onSelect: async (r) => {
              const res = await forceLogout({ memberId: r.id });
              feedbackResult(res, "Forced logout");
            },
          },
          {
            label: "Revoke invite",
            icon: <Trash2 className="h-4 w-4 text-rose-500" />,
            destructive: true,
            onSelect: async (r) => {
              if (r.status !== "invited") return feedbackResult({ ok: false, error: "Member already active" }, "");
              const res = await revokeInvite({ memberId: r.id });
              feedbackResult(res, "Invite revoked");
              if (res.ok) setRows((prev) => prev.filter((row) => row.id !== r.id));
            },
          },
          {
            label: "Remove member",
            icon: <Trash2 className="h-4 w-4 text-rose-500" />,
            destructive: true,
            onSelect: async (r) => {
              if (r.role === "sabsms_admin" && r.status === "active") {
                const adminCount = rows.filter(row => row.status === "active" && row.role === "sabsms_admin").length;
                if (adminCount <= 1) {
                  return feedbackResult({ ok: false, error: "Cannot remove the last active admin." }, "");
                }
              }
              const res = await removeMember({ memberId: r.id });
              feedbackResult(res, "Member removed");
              if (res.ok) {
                setRows((prev) => prev.filter((row) => row.id !== r.id));
                setSelectedIds((prev) => prev.filter((id) => id !== r.id));
              }
            },
          },
        ]}
        emptyTitle="No team members"
        emptyDescription="Invite members to collaborate on SabSMS."
      />

      {/* Invite dialog */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <ZoruDialogContent>
          <ZoruDialogHeader>
            <ZoruDialogTitle>Invite Member</ZoruDialogTitle>
            <ZoruDialogDescription>Send an email invitation to join the workspace.</ZoruDialogDescription>
          </ZoruDialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label>Email address</Label>
              <Input type="email" value={inviteDraft.email} onChange={(e) => setInviteDraft((p) => ({ ...p, email: e.target.value }))} placeholder="alice@example.com" />
            </div>
            <div className="space-y-1">
              <Label>Role</Label>
              <Select value={inviteDraft.role} onValueChange={(v) => setInviteDraft((p) => ({ ...p, role: v as Role }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sabsms_admin">Admin (Full Access)</SelectItem>
                  <SelectItem value="agent">Agent (Inbox & Contacts)</SelectItem>
                  <SelectItem value="marketer">Marketer (Campaigns)</SelectItem>
                  <SelectItem value="developer">Developer (API & Webhooks)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <ZoruDialogFooter>
            <Button variant="outline" onClick={() => setInviteOpen(false)}>Cancel</Button>
            <Button onClick={handleInvite} disabled={busy !== null || !inviteDraft.email}>Send Invite</Button>
          </ZoruDialogFooter>
        </ZoruDialogContent>
      </Dialog>

      {/* Role Editor */}
      <Dialog open={roleEditor.open} onOpenChange={(o) => setRoleEditor((p) => ({ ...p, open: o }))}>
        <ZoruDialogContent>
          <ZoruDialogHeader>
            <ZoruDialogTitle>Edit Role</ZoruDialogTitle>
            <ZoruDialogDescription>Change the role for {roleEditor.member?.email}. Note: custom roles are configured via the CRM RBAC screen.</ZoruDialogDescription>
          </ZoruDialogHeader>
          <div className="space-y-1">
            <Label>Role</Label>
            <Select value={roleEditor.role} onValueChange={(v) => setRoleEditor((p) => ({ ...p, role: v as Role }))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sabsms_admin">Admin</SelectItem>
                <SelectItem value="agent">Agent</SelectItem>
                <SelectItem value="marketer">Marketer</SelectItem>
                <SelectItem value="developer">Developer</SelectItem>
                <SelectItem value="custom">Custom (Read-only here)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <ZoruDialogFooter>
            <Button variant="outline" onClick={() => setRoleEditor({ open: false, role: "agent" })}>Cancel</Button>
            <Button onClick={handleUpdateRole} disabled={busy !== null}>Save</Button>
          </ZoruDialogFooter>
        </ZoruDialogContent>
      </Dialog>

      {/* Bulk Role Editor */}
      <Dialog open={bulkRoleEditor.open} onOpenChange={(o) => setBulkRoleEditor((p) => ({ ...p, open: o }))}>
        <ZoruDialogContent>
          <ZoruDialogHeader>
            <ZoruDialogTitle>Re-assign Roles</ZoruDialogTitle>
            <ZoruDialogDescription>Change the role for {selectedIds.length} members.</ZoruDialogDescription>
          </ZoruDialogHeader>
          <div className="space-y-1">
            <Label>Role</Label>
            <Select value={bulkRoleEditor.role} onValueChange={(v) => setBulkRoleEditor((p) => ({ ...p, role: v as Role }))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sabsms_admin">Admin</SelectItem>
                <SelectItem value="agent">Agent</SelectItem>
                <SelectItem value="marketer">Marketer</SelectItem>
                <SelectItem value="developer">Developer</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <ZoruDialogFooter>
            <Button variant="outline" onClick={() => setBulkRoleEditor({ open: false, role: "agent" })}>Cancel</Button>
            <Button onClick={handleBulkRole} disabled={busy !== null}>Save {selectedIds.length}</Button>
          </ZoruDialogFooter>
        </ZoruDialogContent>
      </Dialog>

      {/* Caps Editor */}
      <Dialog open={capsEditor.open} onOpenChange={(o) => setCapsEditor((p) => ({ ...p, open: o }))}>
        <ZoruDialogContent>
          <ZoruDialogHeader>
            <ZoruDialogTitle>Edit Limits</ZoruDialogTitle>
            <ZoruDialogDescription>Override global rate limits and daily send caps for {capsEditor.member?.email}.</ZoruDialogDescription>
          </ZoruDialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label>Rate Limit Override (req/sec)</Label>
              <Input type="number" value={capsEditor.rateLimit} onChange={(e) => setCapsEditor((p) => ({ ...p, rateLimit: e.target.value }))} placeholder="Leave blank for default" />
            </div>
            <div className="space-y-1">
              <Label>Daily Send Cap</Label>
              <Input type="number" value={capsEditor.dailyCap} onChange={(e) => setCapsEditor((p) => ({ ...p, dailyCap: e.target.value }))} placeholder="Leave blank for no limit" />
            </div>
          </div>
          <ZoruDialogFooter>
            <Button variant="outline" onClick={() => setCapsEditor({ open: false, rateLimit: "", dailyCap: "" })}>Cancel</Button>
            <Button onClick={handleUpdateCaps} disabled={busy !== null}>Save</Button>
          </ZoruDialogFooter>
        </ZoruDialogContent>
      </Dialog>

      {/* Data Access Editor */}
      <Dialog open={dataAccessEditor.open} onOpenChange={(o) => setDataAccessEditor((p) => ({ ...p, open: o }))}>
        <ZoruDialogContent>
          <ZoruDialogHeader>
            <ZoruDialogTitle>Granular Data Access</ZoruDialogTitle>
            <ZoruDialogDescription>Restrict {dataAccessEditor.member?.email}&apos;s access to specific campaigns or data by tags/IDs.</ZoruDialogDescription>
          </ZoruDialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label>Allowed Campaigns (Comma separated IDs)</Label>
              <Input type="text" value={dataAccessEditor.allowedCampaigns} onChange={(e) => setDataAccessEditor((p) => ({ ...p, allowedCampaigns: e.target.value }))} placeholder="e.g. camp_123, camp_456 (Leave blank for all)" />
            </div>
            <div className="space-y-1">
              <Label>Allowed Contact Tags (Comma separated)</Label>
              <Input type="text" value={dataAccessEditor.allowedTags} onChange={(e) => setDataAccessEditor((p) => ({ ...p, allowedTags: e.target.value }))} placeholder="e.g. VIP, EU-Region (Leave blank for all)" />
            </div>
          </div>
          <ZoruDialogFooter>
            <Button variant="outline" onClick={() => setDataAccessEditor({ open: false, allowedCampaigns: "", allowedTags: "" })}>Cancel</Button>
            <Button onClick={handleUpdateDataAccess} disabled={busy !== null}>Save Restrictions</Button>
          </ZoruDialogFooter>
        </ZoruDialogContent>
      </Dialog>

      {/* Audit drawer */}
      <SabsmsDetailDrawer
        open={auditDrawer.open}
        onOpenChange={(o) => setAuditDrawer((prev) => ({ ...prev, open: o }))}
        title={`Audit — ${auditDrawer.member?.email ?? ""}`}
        description="Role changes, logins, and settings updates for this member."
      >
        {auditDrawer.loading ? (
          <div className="text-sm text-slate-500">Loading…</div>
        ) : auditDrawer.entries.length === 0 ? (
          <div className="text-sm text-slate-500">No audit entries yet.</div>
        ) : (
          <ul className="space-y-3">
            {auditDrawer.entries.map((e) => (
              <li key={e.id} className="rounded-md border border-slate-200 bg-white p-3">
                <div className="flex justify-between text-xs text-slate-500">
                  <span>{e.actor}</span>
                  <span>{formatUTC(e.at, true)}</span>
                </div>
                <div className="mt-1 font-medium">{e.kind}</div>
                {e.detail && <div className="mt-1 text-sm text-slate-600">{e.detail}</div>}
              </li>
            ))}
          </ul>
        )}
      </SabsmsDetailDrawer>

      <SabFilePicker open={importOpen} onOpenChange={setImportOpen} accept="document" title="Pick a CSV from SabFiles" onPick={(p) => handleCsvPicked({ url: p.url, name: p.name })} />
    </div>
  );
}
