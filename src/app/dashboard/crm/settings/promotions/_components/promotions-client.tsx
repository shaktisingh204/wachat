'use client';

import * as React from 'react';
import {
  BadgePercent,
  Download,
  FileSpreadsheet,
  LoaderCircle,
  Trash2,
  X,
  BanIcon,
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
  Card,
  Checkbox,
  Input,
  Label,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  Skeleton,
  StatCard,
  Table,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
  useZoruToast,
  Dialog,
  ZoruDialogContent,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
} from '@/components/zoruui';
import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { RowDrawer } from '@/components/crm/row-drawer';
import { PaginationBar } from '@/components/crm/pagination-bar';
import { dateStamp, downloadCsv, downloadXlsx } from '@/lib/crm-list-export';

import {
  getPromotionsExt,
  getPromotionExtKpis,
  savePromotionExt,
  deletePromotionExt,
  bulkDeletePromotionsExt,
  bulkDeactivatePromotionsExt,
} from '@/app/actions/worksuite/meta.actions';
import type { WsPromotionExt } from '@/lib/worksuite/meta-types';

type Row = WsPromotionExt & { _id: string };
type StatusFilter = 'all' | 'active' | 'inactive';
type BulkAction = 'delete' | 'deactivate' | null;

const PAGE_SIZE = 20;

function fmtDate(v: unknown): string {
  if (!v) return '—';
  try {
    const d = new Date(v as string);
    if (isNaN(d.getTime())) return '—';
    return d.toISOString().slice(0, 10);
  } catch { return '—'; }
}

function isExpired(row: Row): boolean {
  if (!row.end_date) return false;
  return new Date(row.end_date as string) < new Date();
}

function statusVariant(row: Row): 'success' | 'ghost' | 'destructive' {
  if (isExpired(row)) return 'destructive';
  if (row.status === 'active') return 'success';
  return 'ghost';
}

function statusLabel(row: Row): string {
  if (isExpired(row)) return 'expired';
  return row.status;
}

function SubmitBtn({ isEditing }: { isEditing: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}
      {isEditing ? 'Save changes' : 'Create'}
    </Button>
  );
}

function EditDialog({
  open,
  onOpenChange,
  onSaved,
  initial,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSaved: () => void;
  initial: Row | null;
}) {
  const isEditing = !!initial;
  const { toast } = useZoruToast();
  const [state, formAction] = useActionState(savePromotionExt, { message: '', error: '' });

  React.useEffect(() => {
    if (state?.message) { toast({ title: 'Saved', description: state.message }); onSaved(); onOpenChange(false); }
    if (state?.error) { toast({ title: 'Error', description: state.error, variant: 'destructive' }); }
  }, [state, toast, onSaved, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <ZoruDialogContent className="sm:max-w-xl">
        <form action={formAction}>
          {isEditing && <input type="hidden" name="_id" value={initial!._id} />}
          <ZoruDialogHeader>
            <ZoruDialogTitle>{isEditing ? 'Edit Promotion' : 'New Promotion'}</ZoruDialogTitle>
          </ZoruDialogHeader>
          <div className="grid grid-cols-1 gap-4 py-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Name <span className="text-zoru-danger-ink">*</span></Label>
              <Input id="name" name="name" required defaultValue={initial?.name ?? ''} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="code">Code <span className="text-zoru-danger-ink">*</span></Label>
              <Input id="code" name="code" required placeholder="SUMMER25" defaultValue={initial?.code ?? ''} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="type">Type <span className="text-zoru-danger-ink">*</span></Label>
              <Select name="type" defaultValue={initial?.type ?? 'percent'}>
                <ZoruSelectTrigger id="type"><ZoruSelectValue /></ZoruSelectTrigger>
                <ZoruSelectContent>
                  <ZoruSelectItem value="percent">Percent</ZoruSelectItem>
                  <ZoruSelectItem value="fixed">Fixed amount</ZoruSelectItem>
                </ZoruSelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="value">Value <span className="text-zoru-danger-ink">*</span></Label>
              <Input id="value" name="value" type="number" required defaultValue={String(initial?.value ?? '')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="usage_limit">Usage limit</Label>
              <Input id="usage_limit" name="usage_limit" type="number" defaultValue={String(initial?.usage_limit ?? '')} placeholder="Unlimited" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select name="status" defaultValue={initial?.status ?? 'active'}>
                <ZoruSelectTrigger id="status"><ZoruSelectValue /></ZoruSelectTrigger>
                <ZoruSelectContent>
                  <ZoruSelectItem value="active">Active</ZoruSelectItem>
                  <ZoruSelectItem value="inactive">Inactive</ZoruSelectItem>
                </ZoruSelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="start_date">Start date</Label>
              <Input id="start_date" name="start_date" type="date" defaultValue={fmtDate(initial?.start_date) === '—' ? '' : fmtDate(initial?.start_date)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end_date">End date</Label>
              <Input id="end_date" name="end_date" type="date" defaultValue={fmtDate(initial?.end_date) === '—' ? '' : fmtDate(initial?.end_date)} />
            </div>
          </div>
          <ZoruDialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <SubmitBtn isEditing={isEditing} />
          </ZoruDialogFooter>
        </form>
      </ZoruDialogContent>
    </Dialog>
  );
}

export function PromotionsClient(): React.JSX.Element {
  const { toast } = useZoruToast();

  const [rows, setRows] = React.useState<Row[]>([]);
  const [kpis, setKpis] = React.useState({ total: 0, active: 0, expired: 0, totalDiscountValue: 0 });
  const [loading, setLoading] = React.useState(true);

  const [search, setSearch] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>('all');
  const [dateFrom, setDateFrom] = React.useState('');
  const [dateTo, setDateTo] = React.useState('');
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(PAGE_SIZE);

  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [editing, setEditing] = React.useState<Row | null>(null);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [pendingDelete, setPendingDelete] = React.useState<Row | null>(null);
  const [pendingBulk, setPendingBulk] = React.useState<BulkAction>(null);
  const [deletePending, startDelete] = React.useTransition();
  const [bulkPending, startBulk] = React.useTransition();

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const [list, snap] = await Promise.all([getPromotionsExt(), getPromotionExtKpis()]);
      setRows(list as unknown as Row[]);
      setKpis(snap);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { void load(); }, [load]);
  React.useEffect(() => { setPage(1); }, [search, statusFilter, dateFrom, dateTo, pageSize]);

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (statusFilter !== 'all') {
        const lbl = statusLabel(r);
        if (statusFilter === 'active' && lbl !== 'active') return false;
        if (statusFilter === 'inactive' && lbl === 'active') return false;
      }
      if (dateFrom) {
        if (!r.end_date || new Date(r.end_date as string) < new Date(dateFrom)) return false;
      }
      if (dateTo) {
        if (!r.start_date || new Date(r.start_date as string) > new Date(dateTo)) return false;
      }
      if (!q) return true;
      return (
        r.name.toLowerCase().includes(q) ||
        r.code.toLowerCase().includes(q)
      );
    });
  }, [rows, search, statusFilter, dateFrom, dateTo]);

  const pageRows = React.useMemo(() => {
    const from = (page - 1) * pageSize;
    return filtered.slice(from, from + pageSize);
  }, [filtered, page, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));

  const toggleOne = (id: string) =>
    setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const togglePage = (checked: boolean) =>
    setSelected((prev) => { const n = new Set(prev); for (const r of pageRows) checked ? n.add(r._id) : n.delete(r._id); return n; });

  const allSelected = pageRows.length > 0 && pageRows.every((r) => selected.has(r._id));
  const someSelected = !allSelected && pageRows.some((r) => selected.has(r._id));

  const hasFilters = search || statusFilter !== 'all' || dateFrom || dateTo;

  const HEADERS = ['Name', 'Code', 'Type', 'Value', 'Start', 'End', 'Usage Limit', 'Status'];
  const buildRows = React.useCallback((src: Row[]) =>
    src.map((r) => ({
      Name: r.name,
      Code: r.code,
      Type: r.type,
      Value: r.type === 'percent' ? `${r.value}%` : r.value,
      Start: fmtDate(r.start_date),
      End: fmtDate(r.end_date),
      'Usage Limit': r.usage_limit ?? 'Unlimited',
      Status: statusLabel(r),
    })), []);

  const exportSrc = React.useCallback(() =>
    selected.size > 0 ? rows.filter((r) => selected.has(r._id)) : filtered, [rows, filtered, selected]);

  const handleExportCsv = () => {
    const src = exportSrc();
    if (!src.length) { toast({ title: 'Nothing to export' }); return; }
    downloadCsv(`promotions-${dateStamp()}.csv`, HEADERS, buildRows(src));
  };

  const handleExportXlsx = async () => {
    const src = exportSrc();
    if (!src.length) { toast({ title: 'Nothing to export' }); return; }
    await downloadXlsx(`promotions-${dateStamp()}.xlsx`, HEADERS, buildRows(src), 'Promotions');
  };

  const handleDeleteOne = () => {
    if (!pendingDelete) return;
    startDelete(async () => {
      const r = await deletePromotionExt(pendingDelete._id);
      if (r.success) {
        toast({ title: 'Promotion deleted' });
        setPendingDelete(null);
        setSelected((p) => { const n = new Set(p); n.delete(pendingDelete._id); return n; });
        await load();
      } else {
        toast({ title: 'Error', description: r.error, variant: 'destructive' });
      }
    });
  };

  const handleBulkAction = () => {
    const ids = Array.from(selected);
    if (!pendingBulk) return;
    startBulk(async () => {
      if (pendingBulk === 'delete') {
        const r = await bulkDeletePromotionsExt(ids);
        if (!r.success) { toast({ title: 'Error', description: r.error, variant: 'destructive' }); return; }
        toast({ title: `${r.deleted} promotion${r.deleted === 1 ? '' : 's'} deleted` });
      } else {
        const r = await bulkDeactivatePromotionsExt(ids);
        if (!r.success) { toast({ title: 'Error', description: r.error, variant: 'destructive' }); return; }
        toast({ title: `${r.updated} promotion${r.updated === 1 ? '' : 's'} deactivated` });
      }
      setSelected(new Set());
      setPendingBulk(null);
      await load();
    });
  };

  return (
    <>
      <EditDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSaved={() => { void load(); }}
        initial={editing}
      />

      <EntityListShell
        title="Promotions"
        subtitle="Promo codes for percentage or fixed-amount discounts."
        primaryAction={
          <Button onClick={() => { setEditing(null); setDialogOpen(true); }}>
            <BadgePercent className="mr-1.5 h-3.5 w-3.5" /> New Promotion
          </Button>
        }
        search={{ value: search, onChange: setSearch, placeholder: 'Search by code or name…' }}
        filters={
          <div className="flex flex-wrap items-center gap-2">
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
              <ZoruSelectTrigger className="h-9 w-[150px]"><ZoruSelectValue placeholder="Status" /></ZoruSelectTrigger>
              <ZoruSelectContent>
                <ZoruSelectItem value="all">All statuses</ZoruSelectItem>
                <ZoruSelectItem value="active">Active</ZoruSelectItem>
                <ZoruSelectItem value="inactive">Inactive / Expired</ZoruSelectItem>
              </ZoruSelectContent>
            </Select>
            <div className="flex items-center gap-1.5">
              <label className="text-[12px] text-zoru-ink-muted">From</label>
              <Input
                type="date"
                className="h-9 w-[140px]"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-1.5">
              <label className="text-[12px] text-zoru-ink-muted">To</label>
              <Input
                type="date"
                className="h-9 w-[140px]"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={() => { setSearch(''); setStatusFilter('all'); setDateFrom(''); setDateTo(''); }}>
                <X className="mr-1 h-3.5 w-3.5" /> Clear
              </Button>
            )}
          </div>
        }
        bulkBar={
          selected.size > 0 ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-[12.5px]">
                <Badge variant="default">{selected.size} selected</Badge>
                <button type="button" onClick={() => setSelected(new Set())} className="text-zoru-ink-muted hover:text-zoru-ink">Clear</button>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" size="sm" onClick={handleExportCsv}><Download className="mr-1 h-3.5 w-3.5" /> Export CSV</Button>
                <Button variant="outline" size="sm" onClick={() => { void handleExportXlsx(); }}><FileSpreadsheet className="mr-1 h-3.5 w-3.5" /> Export XLSX</Button>
                <Button variant="outline" size="sm" disabled={bulkPending} onClick={() => setPendingBulk('deactivate')}>
                  <BanIcon className="mr-1 h-3.5 w-3.5" /> Deactivate {selected.size}
                </Button>
                <Button variant="destructive" size="sm" disabled={bulkPending} onClick={() => setPendingBulk('delete')}>
                  <Trash2 className="mr-1 h-3.5 w-3.5" /> Delete {selected.size}
                </Button>
              </div>
            </div>
          ) : null
        }
        loading={loading && rows.length === 0}
        pagination={
          filtered.length > 0 ? (
            <PaginationBar page={page} limit={pageSize} hasMore={page < totalPages} total={filtered.length}
              controlled={{ onChange: (n) => { setPage(n.page); setPageSize(n.limit); } }} />
          ) : null
        }
      >
        <div className="flex flex-col gap-4">
          {/* KPI strip */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatCard label="Total promotions" value={kpis.total.toLocaleString()} />
            <StatCard label="Active" value={kpis.active.toLocaleString()} />
            <StatCard label="Expired / inactive" value={kpis.expired.toLocaleString()} />
            <StatCard label="Total discount value" value={kpis.totalDiscountValue.toLocaleString()} icon={<BadgePercent className="h-4 w-4" />} />
          </div>

          {selected.size === 0 && (
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Button variant="outline" size="sm" onClick={handleExportCsv} disabled={filtered.length === 0}><Download className="mr-1 h-3.5 w-3.5" /> Export CSV</Button>
              <Button variant="outline" size="sm" onClick={() => { void handleExportXlsx(); }} disabled={filtered.length === 0}><FileSpreadsheet className="mr-1 h-3.5 w-3.5" /> Export XLSX</Button>
            </div>
          )}

          <Card className="p-0">
            <div className="overflow-x-auto rounded-[var(--zoru-radius)] border border-zoru-line">
              <Table>
                <ZoruTableHeader>
                  <ZoruTableRow className="border-zoru-line hover:bg-transparent">
                    <ZoruTableHead className="w-10">
                      <Checkbox checked={allSelected ? true : someSelected ? 'indeterminate' : false} onCheckedChange={(v) => togglePage(v === true)} aria-label="Select all on page" />
                    </ZoruTableHead>
                    <ZoruTableHead className="text-zoru-ink-muted">Name</ZoruTableHead>
                    <ZoruTableHead className="text-zoru-ink-muted">Code</ZoruTableHead>
                    <ZoruTableHead className="text-zoru-ink-muted">Discount</ZoruTableHead>
                    <ZoruTableHead className="text-zoru-ink-muted">Usage limit</ZoruTableHead>
                    <ZoruTableHead className="text-zoru-ink-muted">Valid until</ZoruTableHead>
                    <ZoruTableHead className="text-zoru-ink-muted">Status</ZoruTableHead>
                    <ZoruTableHead className="text-right text-zoru-ink-muted">Actions</ZoruTableHead>
                  </ZoruTableRow>
                </ZoruTableHeader>
                <ZoruTableBody>
                  {loading && rows.length === 0 ? (
                    Array.from({ length: 4 }).map((_, i) => (
                      <ZoruTableRow key={i}><ZoruTableCell colSpan={8}><Skeleton className="h-8 w-full" /></ZoruTableCell></ZoruTableRow>
                    ))
                  ) : pageRows.length === 0 ? (
                    <ZoruTableRow>
                      <ZoruTableCell colSpan={8} className="h-24 text-center text-[13px] text-zoru-ink-muted">
                        No promotions match this filter.
                      </ZoruTableCell>
                    </ZoruTableRow>
                  ) : (
                    pageRows.map((row) => (
                      <ZoruTableRow key={row._id} className="border-zoru-line">
                        <ZoruTableCell>
                          <Checkbox checked={selected.has(row._id)} onCheckedChange={() => toggleOne(row._id)} aria-label={`Select ${row.name}`} />
                        </ZoruTableCell>
                        <ZoruTableCell className="font-medium text-zoru-ink">
                          <RowDrawer label={row.name} title={`Promotion · ${row.name}`} description="Promotion details. Use Edit to modify.">
                            <div className="space-y-3 text-sm">
                              <div><div className="text-xs text-zoru-ink-muted">Name</div><div>{row.name}</div></div>
                              <div><div className="text-xs text-zoru-ink-muted">Code</div><Badge>{row.code}</Badge></div>
                              <div><div className="text-xs text-zoru-ink-muted">Discount</div><div>{row.type === 'percent' ? `${row.value}%` : `${row.value} (fixed)`}</div></div>
                              <div><div className="text-xs text-zoru-ink-muted">Start</div><div>{fmtDate(row.start_date)}</div></div>
                              <div><div className="text-xs text-zoru-ink-muted">End</div><div>{fmtDate(row.end_date)}</div></div>
                              <div><div className="text-xs text-zoru-ink-muted">Usage limit</div><div>{row.usage_limit ?? 'Unlimited'}</div></div>
                              <div><div className="text-xs text-zoru-ink-muted">Status</div><Badge variant={statusVariant(row)}>{statusLabel(row)}</Badge></div>
                            </div>
                          </RowDrawer>
                        </ZoruTableCell>
                        <ZoruTableCell className="text-[13px]">
                          <Badge>{row.code}</Badge>
                        </ZoruTableCell>
                        <ZoruTableCell className="text-[13px] text-zoru-ink">
                          {row.type === 'percent' ? `${row.value}%` : row.value}
                        </ZoruTableCell>
                        <ZoruTableCell className="text-[13px] text-zoru-ink">
                          {row.usage_limit ?? 'Unlimited'}
                        </ZoruTableCell>
                        <ZoruTableCell className="text-[13px] text-zoru-ink">
                          {fmtDate(row.end_date)}
                        </ZoruTableCell>
                        <ZoruTableCell className="text-[13px]">
                          <Badge variant={statusVariant(row)}>{statusLabel(row)}</Badge>
                        </ZoruTableCell>
                        <ZoruTableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="sm" onClick={() => { setEditing(row); setDialogOpen(true); }} aria-label={`Edit ${row.name}`}>Edit</Button>
                            <Button variant="ghost" size="sm" onClick={() => setPendingDelete(row)} aria-label={`Delete ${row.name}`}>
                              <Trash2 className="h-3.5 w-3.5 text-zoru-danger-ink" />
                            </Button>
                          </div>
                        </ZoruTableCell>
                      </ZoruTableRow>
                    ))
                  )}
                </ZoruTableBody>
              </Table>
            </div>
          </Card>
        </div>
      </EntityListShell>

      <ZoruAlertDialog open={!!pendingDelete} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <ZoruAlertDialogContent>
          <ZoruAlertDialogHeader>
            <ZoruAlertDialogTitle>Delete promotion?</ZoruAlertDialogTitle>
            <ZoruAlertDialogDescription>
              {pendingDelete ? `"${pendingDelete.name}" (${pendingDelete.code}) will be permanently removed.` : 'This cannot be undone.'}
            </ZoruAlertDialogDescription>
          </ZoruAlertDialogHeader>
          <ZoruAlertDialogFooter>
            <ZoruAlertDialogCancel>Cancel</ZoruAlertDialogCancel>
            <ZoruAlertDialogAction onClick={handleDeleteOne} disabled={deletePending}>
              {deletePending && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}Delete
            </ZoruAlertDialogAction>
          </ZoruAlertDialogFooter>
        </ZoruAlertDialogContent>
      </ZoruAlertDialog>

      <ZoruAlertDialog open={!!pendingBulk} onOpenChange={(o) => !o && setPendingBulk(null)}>
        <ZoruAlertDialogContent>
          <ZoruAlertDialogHeader>
            <ZoruAlertDialogTitle>
              {pendingBulk === 'delete'
                ? `Delete ${selected.size} promotion${selected.size === 1 ? '' : 's'}?`
                : `Deactivate ${selected.size} promotion${selected.size === 1 ? '' : 's'}?`}
            </ZoruAlertDialogTitle>
            <ZoruAlertDialogDescription>
              {pendingBulk === 'delete'
                ? 'Selected promotions will be permanently removed.'
                : 'Selected promotions will be set to inactive.'}
            </ZoruAlertDialogDescription>
          </ZoruAlertDialogHeader>
          <ZoruAlertDialogFooter>
            <ZoruAlertDialogCancel>Cancel</ZoruAlertDialogCancel>
            <ZoruAlertDialogAction onClick={handleBulkAction} disabled={bulkPending}>
              {bulkPending && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}Confirm
            </ZoruAlertDialogAction>
          </ZoruAlertDialogFooter>
        </ZoruAlertDialogContent>
      </ZoruAlertDialog>
    </>
  );
}
