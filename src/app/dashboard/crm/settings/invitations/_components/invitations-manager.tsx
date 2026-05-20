'use client';

/**
 * InvitationsManager — deepened per §1D.4 bar:
 *  - KPI strip (Total · Pending · Accepted · Expired/Revoked)
 *  - Filter chips: All / Pending / Accepted / Expired / Revoked
 *  - Bulk resend (re-send as new) + bulk revoke
 *  - CSV export
 *  - Send invitation form
 */

import * as React from 'react';

import {
  ZoruBadge,
  ZoruButton,
  ZoruCard,
  ZoruCheckbox,
  ZoruInput,
  ZoruLabel,
  ZoruStatCard,
  ZoruTable,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
  cn,
  useZoruToast,
} from '@/components/zoruui';
import {
  Ban,
  CheckCircle2,
  Clock,
  Copy,
  Download,
  Loader2,
  Mail,
  Trash2,
  UserPlus,
  Users,
  X,
} from 'lucide-react';

import {
  sendUserInvitation,
  revokeInvitation,
  deleteInvitation,
  listInvitations,
} from '@/app/actions/worksuite/chat.actions';
import type {
  WsUserInvitation,
  WsUserInvitationStatus,
} from '@/lib/worksuite/chat-types';

type Row = WsUserInvitation & { _id: string };

export interface InvitationsManagerProps {
  initialInvitations: Row[];
}

type StatusFilter = 'all' | WsUserInvitationStatus;

const STATUS_BADGE: Record<WsUserInvitationStatus, 'warning' | 'success' | 'ghost' | 'danger'> = {
  pending: 'warning',
  accepted: 'success',
  expired: 'ghost',
  revoked: 'danger',
};

function formatStamp(value?: string | Date | null): string {
  if (!value) return '';
  const d = new Date(value as string);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function buildCsv(rows: Row[]): string {
  const header = ['Email', 'Role ID', 'Status', 'Sent', 'Accepted', 'Expires'];
  const escape = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  return [
    header.join(','),
    ...rows.map((r) =>
      [
        escape(r.email),
        escape(r.role_id ?? ''),
        escape(r.status),
        escape(formatStamp(r.createdAt)),
        escape(r.accepted_at ? formatStamp(r.accepted_at) : ''),
        escape(r.expires_at ? formatStamp(r.expires_at) : ''),
      ].join(','),
    ),
  ].join('\n');
}

export function InvitationsManager({ initialInvitations }: InvitationsManagerProps) {
  const { toast } = useZoruToast();
  const [rows, setRows] = React.useState<Row[]>(initialInvitations);
  const [email, setEmail] = React.useState('');
  const [roleId, setRoleId] = React.useState('');
  const [sending, setSending] = React.useState(false);
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>('all');
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [bulkPending, startBulk] = React.useTransition();

  const refresh = React.useCallback(async () => {
    const latest = (await listInvitations()) as Row[];
    setRows(latest);
  }, []);

  /* ── KPIs ─────────────────────────────────────────────────────── */

  const kpis = React.useMemo(() => ({
    total: rows.length,
    pending: rows.filter((r) => r.status === 'pending').length,
    accepted: rows.filter((r) => r.status === 'accepted').length,
    expiredOrRevoked: rows.filter(
      (r) => r.status === 'expired' || r.status === 'revoked',
    ).length,
  }), [rows]);

  /* ── Filter ───────────────────────────────────────────────────── */

  const filtered = React.useMemo(() => {
    if (statusFilter === 'all') return rows;
    return rows.filter((r) => r.status === statusFilter);
  }, [rows, statusFilter]);

  /* ── Selection ────────────────────────────────────────────────── */

  const allSelected =
    filtered.length > 0 && filtered.every((r) => selected.has(r._id));
  const someSelected =
    !allSelected && filtered.some((r) => selected.has(r._id));

  const toggleOne = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleAll = (v: boolean) =>
    setSelected(v ? new Set(filtered.map((r) => r._id)) : new Set());

  /* ── Bulk revoke ──────────────────────────────────────────────── */

  const handleBulkRevoke = () => {
    const ids = Array.from(selected);
    if (!ids.length) return;
    startBulk(async () => {
      let ok = 0;
      let failed = 0;
      for (const id of ids) {
        const res = await revokeInvitation(id);
        if (res.success) ok += 1;
        else failed += 1;
      }
      setSelected(new Set());
      toast({
        title: 'Bulk revoke',
        description: `${ok} revoked${failed ? `, ${failed} failed` : ''}.`,
        variant: failed > 0 ? 'destructive' : undefined,
      });
      await refresh();
    });
  };

  /* ── Bulk resend (creates fresh pending invitations) ─────────── */

  const handleBulkResend = () => {
    const targets = filtered.filter((r) => selected.has(r._id));
    if (!targets.length) return;
    startBulk(async () => {
      let ok = 0;
      let failed = 0;
      for (const inv of targets) {
        const res = await sendUserInvitation(inv.email, inv.role_id ?? undefined);
        if (res.message) ok += 1;
        else failed += 1;
      }
      setSelected(new Set());
      toast({
        title: 'Bulk resend',
        description: `${ok} resent${failed ? `, ${failed} failed` : ''}.`,
        variant: failed > 0 ? 'destructive' : undefined,
      });
      await refresh();
    });
  };

  /* ── CSV export ───────────────────────────────────────────────── */

  const handleExportCsv = () => {
    const src =
      selected.size > 0 ? filtered.filter((r) => selected.has(r._id)) : filtered;
    if (!src.length) {
      toast({ title: 'Nothing to export' });
      return;
    }
    const csv = buildCsv(src);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `invitations-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  /* ── Send form ────────────────────────────────────────────────── */

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setSending(true);
    const res = await sendUserInvitation(email, roleId || undefined);
    setSending(false);
    if (res.error) {
      toast({ title: 'Error', description: res.error, variant: 'destructive' });
      return;
    }
    toast({ title: 'Invitation sent', description: email });
    setEmail('');
    setRoleId('');
    await refresh();
  };

  /* ── Per-row actions ──────────────────────────────────────────── */

  const handleRevoke = async (id: string) => {
    const res = await revokeInvitation(id);
    if (res.success) {
      toast({ title: 'Invitation revoked' });
      await refresh();
    } else {
      toast({ title: 'Error', description: res.error, variant: 'destructive' });
    }
  };

  const handleDelete = async (id: string) => {
    const res = await deleteInvitation(id);
    if (res.success) {
      setRows((prev) => prev.filter((r) => r._id !== id));
    } else {
      toast({ title: 'Error', description: res.error, variant: 'destructive' });
    }
  };

  const copyToken = async (token: string) => {
    try {
      await navigator.clipboard.writeText(token);
      toast({ title: 'Token copied' });
    } catch {
      toast({ title: 'Copy failed', variant: 'destructive' });
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <button type="button" className="text-left" onClick={() => setStatusFilter('all')}>
          <ZoruStatCard
            label="Total"
            value={kpis.total.toLocaleString()}
            icon={<Users className="h-4 w-4" />}
            className={cn(statusFilter === 'all' && 'ring-1 ring-zoru-primary rounded-[var(--zoru-radius-lg)]')}
          />
        </button>
        <button type="button" className="text-left" onClick={() => setStatusFilter('pending')}>
          <ZoruStatCard
            label="Pending"
            value={kpis.pending.toLocaleString()}
            icon={<Clock className="h-4 w-4" />}
            className={cn(statusFilter === 'pending' && 'ring-1 ring-zoru-primary rounded-[var(--zoru-radius-lg)]')}
          />
        </button>
        <button type="button" className="text-left" onClick={() => setStatusFilter('accepted')}>
          <ZoruStatCard
            label="Accepted"
            value={kpis.accepted.toLocaleString()}
            icon={<CheckCircle2 className="h-4 w-4" />}
            className={cn(statusFilter === 'accepted' && 'ring-1 ring-zoru-primary rounded-[var(--zoru-radius-lg)]')}
          />
        </button>
        <ZoruStatCard
          label="Expired / Revoked"
          value={kpis.expiredOrRevoked.toLocaleString()}
          icon={<Ban className="h-4 w-4" />}
        />
      </div>

      {/* Send invitation form */}
      <ZoruCard className="p-5">
        <form
          onSubmit={handleSend}
          className="grid gap-3 md:grid-cols-[1fr_200px_auto]"
          aria-label="Send invitation"
        >
          <div>
            <ZoruLabel className="text-[11.5px] text-zoru-ink-muted" htmlFor="inv-email">
              Email
            </ZoruLabel>
            <ZoruInput
              id="inv-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="teammate@company.com"
              className="mt-1 h-9 text-[13px]"
            />
          </div>
          <div>
            <ZoruLabel className="text-[11.5px] text-zoru-ink-muted" htmlFor="inv-role">
              Role id (optional)
            </ZoruLabel>
            <ZoruInput
              id="inv-role"
              value={roleId}
              onChange={(e) => setRoleId(e.target.value)}
              placeholder="role id"
              className="mt-1 h-9 text-[13px]"
            />
          </div>
          <div className="flex items-end">
            <ZoruButton type="submit" disabled={sending || !email.trim()}>
              {sending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <UserPlus className="mr-2 h-4 w-4" />
              )}
              Send invitation
            </ZoruButton>
          </div>
        </form>
      </ZoruCard>

      {/* Filter chips + bulk bar */}
      <div className="flex flex-wrap items-center gap-2">
        {(['all', 'pending', 'accepted', 'expired', 'revoked'] as StatusFilter[]).map((s) => (
          <ZoruButton
            key={s}
            type="button"
            variant={statusFilter === s ? 'default' : 'outline'}
            size="sm"
            onClick={() => setStatusFilter(s)}
          >
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </ZoruButton>
        ))}
      </div>

      {/* Bulk bar */}
      {selected.size > 0 ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-zoru-line bg-zoru-surface px-3 py-2 text-[13px]">
          <span className="font-medium text-zoru-ink">{selected.size} selected</span>
          <span className="text-zoru-ink-muted">·</span>
          <ZoruButton
            variant="ghost"
            size="sm"
            disabled={bulkPending}
            onClick={handleBulkResend}
          >
            <Mail className="mr-1 h-3.5 w-3.5" />
            Resend
          </ZoruButton>
          <ZoruButton
            variant="ghost"
            size="sm"
            disabled={bulkPending}
            onClick={handleBulkRevoke}
          >
            <Ban className="mr-1 h-3.5 w-3.5 text-zoru-danger-ink" />
            Revoke
          </ZoruButton>
          <ZoruButton variant="ghost" size="sm" onClick={handleExportCsv}>
            <Download className="mr-1 h-3.5 w-3.5" />
            Export CSV
          </ZoruButton>
          <span className="ml-auto" />
          <ZoruButton
            variant="ghost"
            size="sm"
            onClick={() => setSelected(new Set())}
          >
            <X className="h-3.5 w-3.5" />
            Clear
          </ZoruButton>
        </div>
      ) : (
        <div className="flex justify-end">
          <ZoruButton
            variant="outline"
            size="sm"
            onClick={handleExportCsv}
            disabled={filtered.length === 0}
          >
            <Download className="mr-1 h-3.5 w-3.5" />
            Export CSV
          </ZoruButton>
        </div>
      )}

      {/* Table */}
      {filtered.length === 0 ? (
        <ZoruCard className="flex items-center justify-center py-12">
          <p className="text-[13px] text-zoru-ink-muted">No invitations match this filter.</p>
        </ZoruCard>
      ) : (
        <ZoruCard className="p-0 overflow-x-auto">
          <ZoruTable>
            <ZoruTableHeader>
              <ZoruTableRow className="hover:bg-transparent">
                <ZoruTableHead className="w-10">
                  <ZoruCheckbox
                    checked={allSelected ? true : someSelected ? 'indeterminate' : false}
                    onCheckedChange={(v) => toggleAll(v === true)}
                    aria-label="Select all on page"
                  />
                </ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Email</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Role</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Status</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Sent</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Expires</ZoruTableHead>
                <ZoruTableHead className="text-right text-zoru-ink-muted">Actions</ZoruTableHead>
              </ZoruTableRow>
            </ZoruTableHeader>
            <ZoruTableBody>
              {filtered.map((inv) => (
                <ZoruTableRow
                  key={inv._id}
                  className={cn(selected.has(inv._id) && 'bg-zoru-surface')}
                >
                  <ZoruTableCell>
                    <ZoruCheckbox
                      checked={selected.has(inv._id)}
                      onCheckedChange={() => toggleOne(inv._id)}
                      aria-label={`Select ${inv.email}`}
                    />
                  </ZoruTableCell>
                  <ZoruTableCell className="text-[13px] font-medium text-zoru-ink">
                    {inv.email}
                  </ZoruTableCell>
                  <ZoruTableCell className="text-[12px] text-zoru-ink-muted">
                    {inv.role_id || '—'}
                  </ZoruTableCell>
                  <ZoruTableCell>
                    <ZoruBadge variant={STATUS_BADGE[inv.status] ?? 'ghost'}>
                      {inv.status}
                    </ZoruBadge>
                  </ZoruTableCell>
                  <ZoruTableCell className="text-[12px] text-zoru-ink-muted">
                    {formatStamp(inv.createdAt)}
                  </ZoruTableCell>
                  <ZoruTableCell className="text-[12px] text-zoru-ink-muted">
                    {inv.expires_at ? formatStamp(inv.expires_at) : '—'}
                  </ZoruTableCell>
                  <ZoruTableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <ZoruButton
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToken(inv.token)}
                        aria-label="Copy token"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </ZoruButton>
                      {inv.status === 'pending' ? (
                        <ZoruButton
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRevoke(inv._id)}
                          aria-label="Revoke"
                        >
                          <Ban className="h-3.5 w-3.5" />
                        </ZoruButton>
                      ) : null}
                      <ZoruButton
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(inv._id)}
                        aria-label="Delete"
                      >
                        <Trash2 className="h-3.5 w-3.5 text-zoru-danger-ink" />
                      </ZoruButton>
                    </div>
                  </ZoruTableCell>
                </ZoruTableRow>
              ))}
            </ZoruTableBody>
          </ZoruTable>
        </ZoruCard>
      )}
    </div>
  );
}
