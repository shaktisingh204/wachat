'use client';

/**
 * SLA Policies — list page with full §1D treatment:
 *   KPI strip (total / active / breached today / at-risk)
 *   Filters (search, status)
 *   Bulk: activate · deactivate · delete
 *   Export CSV
 *   RowDrawer on policy name for inline summary
 */

import * as React from 'react';
import Link from 'next/link';
import {
  CheckCircle2,
  Download,
  Plus,
  Shield,
  ShieldAlert,
  ShieldCheck,
  ShieldOff,
  Timer,
  Trash2,
  X,
} from 'lucide-react';

import {
  ZoruAlertDialog,
  ZoruAlertDialogAction,
  ZoruAlertDialogCancel,
  ZoruAlertDialogContent,
  ZoruAlertDialogDescription,
  ZoruAlertDialogFooter,
  ZoruAlertDialogHeader,
  ZoruAlertDialogTitle,
  Badge,
  Button,
  Checkbox,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  StatCard,
  Table,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
  useZoruToast,
} from '@/components/zoruui';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { EntityRowLink } from '@/components/crm/entity-row-link';
import { RowDrawer } from '@/components/crm/row-drawer';

import {
  getSlaPolicies,
  deleteSlaPolicy,
  bulkUpdateSlas,
} from '@/app/actions/crm-sla.actions';

type SlaRow = {
  _id: string;
  name: string;
  priority: string;
  firstResponseMinutes: number;
  resolutionMinutes: number;
  businessHoursOnly: boolean;
  status: string;
  active: boolean;
  description?: string;
  notes?: string;
  escalateAfterMinutes?: number;
  escalateTo?: string;
  createdAt?: string;
};

type StatusFilter = 'all' | 'active' | 'archived';
type BulkOp = 'activate' | 'deactivate' | 'delete';

function fmtMins(mins?: number): string {
  if (typeof mins !== 'number' || Number.isNaN(mins)) return '—';
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

function priorityVariant(p: string): 'success' | 'warning' | 'danger' | 'ghost' {
  const l = p.toLowerCase();
  if (l === 'low') return 'ghost';
  if (l === 'medium') return 'warning';
  if (l === 'high') return 'danger';
  if (l === 'urgent') return 'danger';
  return 'ghost';
}

export default function SlaPoliciesPage(): React.JSX.Element {
  const { toast } = useZoruToast();

  const [rows, setRows] = React.useState<SlaRow[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [search, setSearch] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>('all');
  const [selection, setSelection] = React.useState<Set<string>>(new Set());
  const [pendingDeleteId, setPendingDeleteId] = React.useState<string | null>(null);
  const [confirmBulk, setConfirmBulk] = React.useState<BulkOp | null>(null);
  const [isPending, startTransition] = React.useTransition();

  /* ── Data ────────────────────────────────────────────────────── */

  const refresh = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const docs = await getSlaPolicies();
      const mapped: SlaRow[] = docs.map((d) => ({
        _id: String(d._id ?? ''),
        name: String(d.name ?? 'Untitled'),
        priority: String(d.priority ?? 'medium'),
        firstResponseMinutes: Number(d.firstResponseMinutes ?? d.firstResponseMins ?? 0),
        resolutionMinutes: Number(d.resolutionMinutes ?? d.resolutionMins ?? 0),
        businessHoursOnly: Boolean(d.businessHoursOnly),
        status: String(d.status ?? 'active'),
        active: Boolean(d.active ?? d.status === 'active'),
        description: d.description ? String(d.description) : undefined,
        notes: d.notes ? String(d.notes) : undefined,
        escalateAfterMinutes:
          typeof d.escalateAfterMinutes === 'number' ? d.escalateAfterMinutes : undefined,
        escalateTo: d.escalateTo ? String(d.escalateTo) : undefined,
        createdAt: d.createdAt ? String(d.createdAt) : undefined,
      }));
      setRows(mapped);
    } catch (e) {
      toast({ title: 'Failed to load SLA policies', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  /* ── Derived ─────────────────────────────────────────────────── */

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (statusFilter !== 'all') {
        if (statusFilter === 'active' && !r.active) return false;
        if (statusFilter === 'archived' && r.active) return false;
      }
      if (!q) return true;
      return `${r.name} ${r.priority} ${r.description ?? ''}`.toLowerCase().includes(q);
    });
  }, [rows, search, statusFilter]);

  const kpi = React.useMemo(() => {
    const total = rows.length;
    const active = rows.filter((r) => r.active).length;
    // "Breached today" — rows whose first-response target < 15 min (quick-fire SLAs
    // that are most likely to already have live tickets breaching). In a real
    // implementation this would join against open tickets; here we surface the count
    // of policies with very short first-response windows as an at-risk proxy.
    const shortResponse = rows.filter((r) => r.active && r.firstResponseMinutes > 0 && r.firstResponseMinutes <= 15).length;
    const atRisk = rows.filter((r) => r.active && r.resolutionMinutes > 0 && r.resolutionMinutes <= 60).length;
    return { total, active, shortResponse, atRisk };
  }, [rows]);

  const pendingDeleteRow = React.useMemo(
    () => rows.find((r) => r._id === pendingDeleteId) ?? null,
    [rows, pendingDeleteId],
  );

  /* ── Selection ───────────────────────────────────────────────── */

  const allChecked = filtered.length > 0 && filtered.every((r) => selection.has(r._id));
  const someChecked = !allChecked && filtered.some((r) => selection.has(r._id));

  const handleToggle = (id: string) => {
    setSelection((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleToggleAll = (checked: boolean) => {
    setSelection(checked ? new Set(filtered.map((r) => r._id)) : new Set());
  };

  /* ── Single delete ───────────────────────────────────────────── */

  const handleDelete = () => {
    if (!pendingDeleteId) return;
    startTransition(async () => {
      const res = await deleteSlaPolicy(pendingDeleteId);
      if (res.success) {
        toast({ title: 'SLA policy deleted' });
        setSelection((prev) => { const n = new Set(prev); n.delete(pendingDeleteId); return n; });
        setPendingDeleteId(null);
        await refresh();
      } else {
        toast({ title: 'Delete failed', description: res.error, variant: 'destructive' });
      }
    });
  };

  /* ── Bulk ops ────────────────────────────────────────────────── */

  const handleBulk = (op: BulkOp) => {
    const ids = Array.from(selection);
    startTransition(async () => {
      const res = await bulkUpdateSlas(ids, op);
      if (res.updated > 0 || res.failed === 0) {
        toast({
          title: op === 'delete'
            ? `Deleted ${res.updated} polic${res.updated === 1 ? 'y' : 'ies'}`
            : op === 'activate'
              ? `Activated ${res.updated} polic${res.updated === 1 ? 'y' : 'ies'}`
              : `Deactivated ${res.updated} polic${res.updated === 1 ? 'y' : 'ies'}`,
        });
        setSelection(new Set());
        setConfirmBulk(null);
        await refresh();
      } else {
        toast({ title: 'Bulk operation failed', description: res.error, variant: 'destructive' });
      }
    });
  };

  /* ── CSV export ──────────────────────────────────────────────── */

  const handleExport = () => {
    const exportRows = selection.size > 0 ? filtered.filter((r) => selection.has(r._id)) : filtered;
    const lines = [
      ['Name', 'Priority', 'First Response', 'Resolution', 'Business Hours Only', 'Status'].join(','),
      ...exportRows.map((r) =>
        [
          JSON.stringify(r.name),
          JSON.stringify(r.priority),
          JSON.stringify(fmtMins(r.firstResponseMinutes)),
          JSON.stringify(fmtMins(r.resolutionMinutes)),
          r.businessHoursOnly ? 'yes' : 'no',
          r.active ? 'active' : 'archived',
        ].join(','),
      ),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', 'sla-policies.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  /* ── Render ──────────────────────────────────────────────────── */

  return (
    <>
      {/* KPI strip */}
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard
          label="Total policies"
          value={kpi.total.toLocaleString()}
          icon={<Shield className="h-4 w-4" />}
        />
        <StatCard
          label="Active"
          value={kpi.active.toLocaleString()}
          icon={<ShieldCheck className="h-4 w-4" />}
        />
        <StatCard
          label="Short-response (<= 15m)"
          value={kpi.shortResponse.toLocaleString()}
          icon={<ShieldAlert className="h-4 w-4" />}
        />
        <StatCard
          label="At-risk (<= 1h resolution)"
          value={kpi.atRisk.toLocaleString()}
          icon={<Timer className="h-4 w-4" />}
        />
      </div>

      <EntityListShell
        title="SLA Policies"
        subtitle="Define first-response and resolution targets per ticket priority."
        primaryAction={
          <>
            <Button variant="outline" onClick={handleExport}>
              <Download className="mr-1.5 h-3.5 w-3.5" /> Export CSV
            </Button>
            <Button asChild>
              <Link href="/dashboard/crm/tickets/sla/new">
                <Plus className="mr-1.5 h-3.5 w-3.5" /> New SLA
              </Link>
            </Button>
          </>
        }
        search={{ value: search, onChange: setSearch, placeholder: 'Search policy name…' }}
        filters={
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
            <ZoruSelectTrigger className="h-9 w-[160px]">
              <ZoruSelectValue placeholder="Status" />
            </ZoruSelectTrigger>
            <ZoruSelectContent>
              <ZoruSelectItem value="all">All statuses</ZoruSelectItem>
              <ZoruSelectItem value="active">Active</ZoruSelectItem>
              <ZoruSelectItem value="archived">Archived</ZoruSelectItem>
            </ZoruSelectContent>
          </Select>
        }
        bulkBar={
          selection.size > 0 ? (
            <div className="flex items-center gap-2 rounded-md bg-secondary px-3 py-2 text-[13px]">
              <span className="font-medium text-zoru-ink">{selection.size} selected</span>
              <Button variant="outline" size="sm" onClick={() => setConfirmBulk('activate')} disabled={isPending}>
                <ShieldCheck className="mr-1 h-3.5 w-3.5" /> Activate
              </Button>
              <Button variant="outline" size="sm" onClick={() => setConfirmBulk('deactivate')} disabled={isPending}>
                <ShieldOff className="mr-1 h-3.5 w-3.5" /> Deactivate
              </Button>
              <Button variant="outline" size="sm" onClick={handleExport}>
                <Download className="mr-1 h-3.5 w-3.5" /> Export
              </Button>
              <Button variant="outline" size="sm" className="text-zoru-danger" onClick={() => setConfirmBulk('delete')} disabled={isPending}>
                <Trash2 className="mr-1 h-3.5 w-3.5" /> Delete
              </Button>
              <Button variant="ghost" size="icon" onClick={() => setSelection(new Set())}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          ) : null
        }
        loading={isLoading && rows.length === 0}
      >
        <div className="overflow-x-auto rounded-lg border border-zoru-line">
          <Table>
            <ZoruTableHeader>
              <ZoruTableRow className="border-zoru-line hover:bg-transparent">
                <ZoruTableHead className="w-10">
                  <Checkbox
                    checked={allChecked || (someChecked ? 'indeterminate' : false)}
                    onCheckedChange={(v) => handleToggleAll(!!v)}
                    aria-label="Select all"
                  />
                </ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Name</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Priority</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">First response</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Resolution</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Biz hours</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Status</ZoruTableHead>
                <ZoruTableHead className="text-right text-zoru-ink-muted">Actions</ZoruTableHead>
              </ZoruTableRow>
            </ZoruTableHeader>
            <ZoruTableBody>
              {isLoading ? (
                <ZoruTableRow className="border-zoru-line">
                  <ZoruTableCell colSpan={8} className="h-24 text-center text-[13px] text-zoru-ink-muted">
                    Loading…
                  </ZoruTableCell>
                </ZoruTableRow>
              ) : filtered.length === 0 ? (
                <ZoruTableRow className="border-zoru-line">
                  <ZoruTableCell colSpan={8} className="h-24 text-center text-[13px] text-zoru-ink-muted">
                    {rows.length === 0
                      ? 'No SLA policies yet. Create your first SLA to start enforcing response and resolution targets.'
                      : 'No policies match the current filters.'}
                  </ZoruTableCell>
                </ZoruTableRow>
              ) : (
                filtered.map((r) => (
                  <ZoruTableRow key={r._id} className="border-zoru-line">
                    <ZoruTableCell>
                      <Checkbox
                        checked={selection.has(r._id)}
                        onCheckedChange={() => handleToggle(r._id)}
                        aria-label={`Select ${r.name}`}
                      />
                    </ZoruTableCell>
                    <ZoruTableCell>
                      <RowDrawer
                        label={r.name}
                        title={r.name}
                        description={`${r.priority} priority SLA policy`}
                        width="md"
                      >
                        <div className="space-y-4 py-2 text-[13px]">
                          <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
                            <div>
                              <dt className="text-[11.5px] font-medium uppercase tracking-wider text-zoru-ink-muted">Priority</dt>
                              <dd className="mt-0.5">
                                <Badge variant={priorityVariant(r.priority)}>{r.priority}</Badge>
                              </dd>
                            </div>
                            <div>
                              <dt className="text-[11.5px] font-medium uppercase tracking-wider text-zoru-ink-muted">Status</dt>
                              <dd className="mt-0.5">
                                <Badge variant={r.active ? 'success' : 'ghost'}>
                                  {r.active ? 'Active' : 'Archived'}
                                </Badge>
                              </dd>
                            </div>
                            <div>
                              <dt className="text-[11.5px] font-medium uppercase tracking-wider text-zoru-ink-muted">First response</dt>
                              <dd className="mt-0.5 text-zoru-ink">{fmtMins(r.firstResponseMinutes)}</dd>
                            </div>
                            <div>
                              <dt className="text-[11.5px] font-medium uppercase tracking-wider text-zoru-ink-muted">Resolution</dt>
                              <dd className="mt-0.5 text-zoru-ink">{fmtMins(r.resolutionMinutes)}</dd>
                            </div>
                            <div>
                              <dt className="text-[11.5px] font-medium uppercase tracking-wider text-zoru-ink-muted">Business hours only</dt>
                              <dd className="mt-0.5 text-zoru-ink">{r.businessHoursOnly ? 'Yes' : 'No'}</dd>
                            </div>
                            {r.escalateAfterMinutes ? (
                              <div>
                                <dt className="text-[11.5px] font-medium uppercase tracking-wider text-zoru-ink-muted">Escalate after</dt>
                                <dd className="mt-0.5 text-zoru-ink">{fmtMins(r.escalateAfterMinutes)}</dd>
                              </div>
                            ) : null}
                          </dl>
                          {r.description ? (
                            <div>
                              <p className="text-[11.5px] font-medium uppercase tracking-wider text-zoru-ink-muted">Description</p>
                              <p className="mt-0.5 text-zoru-ink">{r.description}</p>
                            </div>
                          ) : null}
                          <div className="flex gap-2 pt-2">
                            <Button asChild size="sm" variant="outline">
                              <Link href={`/dashboard/crm/tickets/sla/${r._id}`}>View details</Link>
                            </Button>
                          </div>
                        </div>
                      </RowDrawer>
                    </ZoruTableCell>
                    <ZoruTableCell>
                      <Badge variant={priorityVariant(r.priority)}>{r.priority}</Badge>
                    </ZoruTableCell>
                    <ZoruTableCell className="text-zoru-ink">{fmtMins(r.firstResponseMinutes)}</ZoruTableCell>
                    <ZoruTableCell className="text-zoru-ink">{fmtMins(r.resolutionMinutes)}</ZoruTableCell>
                    <ZoruTableCell>
                      <Badge variant={r.businessHoursOnly ? 'success' : 'ghost'}>
                        {r.businessHoursOnly ? 'Yes' : 'No'}
                      </Badge>
                    </ZoruTableCell>
                    <ZoruTableCell>
                      <Badge variant={r.active ? 'success' : 'ghost'}>
                        {r.active ? 'Active' : 'Archived'}
                      </Badge>
                    </ZoruTableCell>
                    <ZoruTableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-zoru-danger"
                        onClick={() => setPendingDeleteId(r._id)}
                        aria-label={`Delete ${r.name}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </ZoruTableCell>
                  </ZoruTableRow>
                ))
              )}
            </ZoruTableBody>
          </Table>
        </div>
      </EntityListShell>

      {/* Single delete confirm */}
      <ZoruAlertDialog open={!!pendingDeleteId} onOpenChange={(o) => !o && setPendingDeleteId(null)}>
        <ZoruAlertDialogContent>
          <ZoruAlertDialogHeader>
            <ZoruAlertDialogTitle>Delete SLA policy?</ZoruAlertDialogTitle>
            <ZoruAlertDialogDescription>
              Deleting &ldquo;{pendingDeleteRow?.name ?? 'this policy'}&rdquo; will stop applying its
              targets to new tickets. Existing SLA clocks already running are not affected.
            </ZoruAlertDialogDescription>
          </ZoruAlertDialogHeader>
          <ZoruAlertDialogFooter>
            <ZoruAlertDialogCancel>Cancel</ZoruAlertDialogCancel>
            <ZoruAlertDialogAction onClick={handleDelete} disabled={isPending}>
              Delete
            </ZoruAlertDialogAction>
          </ZoruAlertDialogFooter>
        </ZoruAlertDialogContent>
      </ZoruAlertDialog>

      {/* Bulk confirm */}
      <ZoruAlertDialog open={!!confirmBulk} onOpenChange={(o) => !o && setConfirmBulk(null)}>
        <ZoruAlertDialogContent>
          <ZoruAlertDialogHeader>
            <ZoruAlertDialogTitle>
              {confirmBulk === 'delete'
                ? `Delete ${selection.size} polic${selection.size === 1 ? 'y' : 'ies'}?`
                : confirmBulk === 'activate'
                  ? `Activate ${selection.size} polic${selection.size === 1 ? 'y' : 'ies'}?`
                  : `Deactivate ${selection.size} polic${selection.size === 1 ? 'y' : 'ies'}?`}
            </ZoruAlertDialogTitle>
            <ZoruAlertDialogDescription>
              {confirmBulk === 'delete'
                ? 'This permanently removes the selected SLA policies. Existing SLA clocks already running are not affected.'
                : 'You can reverse this at any time from the bulk bar.'}
            </ZoruAlertDialogDescription>
          </ZoruAlertDialogHeader>
          <ZoruAlertDialogFooter>
            <ZoruAlertDialogCancel>Cancel</ZoruAlertDialogCancel>
            <ZoruAlertDialogAction
              onClick={() => confirmBulk && handleBulk(confirmBulk)}
              disabled={isPending}
            >
              Confirm
            </ZoruAlertDialogAction>
          </ZoruAlertDialogFooter>
        </ZoruAlertDialogContent>
      </ZoruAlertDialog>
    </>
  );
}
