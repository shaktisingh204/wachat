'use client';

import * as React from 'react';
import {
  Download,
  FileSpreadsheet,
  LoaderCircle,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Wallet,
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
  getOfflinePaymentMethods,
  getOfflinePaymentMethodKpis,
  saveOfflinePaymentMethod,
  deleteOfflinePaymentMethod,
  bulkDeleteOfflinePaymentMethods,
  bulkToggleOfflinePaymentMethods,
} from '@/app/actions/worksuite/payments.actions';
import type { WsOfflinePaymentMethod } from '@/lib/worksuite/payments-types';

type Row = Omit<WsOfflinePaymentMethod, '_id' | 'userId'> & { _id: string; userId?: string };
type StatusFilter = 'all' | 'enabled' | 'disabled';
type BulkAction = 'delete' | 'enable' | 'disable' | null;

const PAGE_SIZE = 20;

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
  const [state, formAction] = useActionState(saveOfflinePaymentMethod, { message: '', error: '' });

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
            <ZoruDialogTitle>{isEditing ? 'Edit Payment Method' : 'New Payment Method'}</ZoruDialogTitle>
          </ZoruDialogHeader>
          <div className="grid grid-cols-1 gap-4 py-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Name <span className="text-zoru-danger-ink">*</span></Label>
              <Input id="name" name="name" required defaultValue={initial?.name ?? ''} placeholder="Cash / Cheque / UPI" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="is_active">Status</Label>
              <Select name="is_active" defaultValue={initial ? (initial.is_active ? 'true' : 'false') : 'true'}>
                <ZoruSelectTrigger id="is_active"><ZoruSelectValue /></ZoruSelectTrigger>
                <ZoruSelectContent>
                  <ZoruSelectItem value="true">Enabled</ZoruSelectItem>
                  <ZoruSelectItem value="false">Disabled</ZoruSelectItem>
                </ZoruSelectContent>
              </Select>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="description">Description</Label>
              <textarea
                id="description"
                name="description"
                rows={3}
                defaultValue={initial?.description ?? ''}
                className="flex min-h-[60px] w-full rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-bg px-3 py-2 text-sm text-zoru-ink"
              />
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

export function OfflinePaymentMethodsClient(): React.JSX.Element {
  const { toast } = useZoruToast();

  const [rows, setRows] = React.useState<Row[]>([]);
  const [kpis, setKpis] = React.useState({ total: 0, enabled: 0, disabled: 0, defaultName: '—' });
  const [loading, setLoading] = React.useState(true);

  const [search, setSearch] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>('all');
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
      const [list, snap] = await Promise.all([getOfflinePaymentMethods(), getOfflinePaymentMethodKpis()]);
      setRows(list as unknown as Row[]);
      setKpis(snap);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { void load(); }, [load]);
  React.useEffect(() => { setPage(1); }, [search, statusFilter, pageSize]);

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (statusFilter === 'enabled' && !r.is_active) return false;
      if (statusFilter === 'disabled' && r.is_active) return false;
      if (!q) return true;
      return (
        r.name.toLowerCase().includes(q) ||
        (r.description ?? '').toLowerCase().includes(q)
      );
    });
  }, [rows, search, statusFilter]);

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

  const HEADERS = ['Name', 'Description', 'Status', 'Created'];
  const buildRows = React.useCallback((src: Row[]) =>
    src.map((r) => ({
      Name: r.name,
      Description: r.description ?? '',
      Status: r.is_active ? 'Enabled' : 'Disabled',
      Created: r.createdAt ? new Date(r.createdAt as string).toLocaleDateString() : '',
    })), []);

  const exportSrc = React.useCallback(() =>
    selected.size > 0 ? rows.filter((r) => selected.has(r._id)) : filtered, [rows, filtered, selected]);

  const handleExportCsv = () => {
    const src = exportSrc();
    if (!src.length) { toast({ title: 'Nothing to export' }); return; }
    downloadCsv(`offline-payment-methods-${dateStamp()}.csv`, HEADERS, buildRows(src));
  };

  const handleExportXlsx = async () => {
    const src = exportSrc();
    if (!src.length) { toast({ title: 'Nothing to export' }); return; }
    await downloadXlsx(`offline-payment-methods-${dateStamp()}.xlsx`, HEADERS, buildRows(src), 'Offline Methods');
  };

  const handleDeleteOne = () => {
    if (!pendingDelete) return;
    startDelete(async () => {
      const r = await deleteOfflinePaymentMethod(pendingDelete._id);
      if (r.success) {
        toast({ title: 'Method deleted' });
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
      let label = '';
      if (pendingBulk === 'delete') {
        const r = await bulkDeleteOfflinePaymentMethods(ids);
        label = r.success ? `${r.deleted} method${r.deleted === 1 ? '' : 's'} deleted` : '';
        if (!r.success) { toast({ title: 'Error', description: r.error, variant: 'destructive' }); return; }
      } else {
        const active = pendingBulk === 'enable';
        const r = await bulkToggleOfflinePaymentMethods(ids, active);
        label = r.success ? `${r.updated} method${r.updated === 1 ? '' : 's'} ${active ? 'enabled' : 'disabled'}` : '';
        if (!r.success) { toast({ title: 'Error', description: r.error, variant: 'destructive' }); return; }
      }
      toast({ title: label });
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
        title="Offline Payment Methods"
        subtitle="Cash, cheque, UPI, bank transfer and other non-gateway methods."
        primaryAction={
          <Button onClick={() => { setEditing(null); setDialogOpen(true); }}>
            <Wallet className="mr-1.5 h-3.5 w-3.5" /> New Method
          </Button>
        }
        search={{ value: search, onChange: setSearch, placeholder: 'Search by name or description…' }}
        filters={
          <div className="flex flex-wrap items-center gap-2">
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
              <ZoruSelectTrigger className="h-9 w-[150px]"><ZoruSelectValue placeholder="Status" /></ZoruSelectTrigger>
              <ZoruSelectContent>
                <ZoruSelectItem value="all">All statuses</ZoruSelectItem>
                <ZoruSelectItem value="enabled">Enabled</ZoruSelectItem>
                <ZoruSelectItem value="disabled">Disabled</ZoruSelectItem>
              </ZoruSelectContent>
            </Select>
            {(search || statusFilter !== 'all') && (
              <Button variant="ghost" size="sm" onClick={() => { setSearch(''); setStatusFilter('all'); }}>
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
                <Button variant="outline" size="sm" disabled={bulkPending} onClick={() => setPendingBulk('enable')}>
                  <ToggleRight className="mr-1 h-3.5 w-3.5" /> Enable
                </Button>
                <Button variant="outline" size="sm" disabled={bulkPending} onClick={() => setPendingBulk('disable')}>
                  <ToggleLeft className="mr-1 h-3.5 w-3.5" /> Disable
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
            <StatCard label="Total methods" value={kpis.total.toLocaleString()} />
            <StatCard label="Enabled" value={kpis.enabled.toLocaleString()} />
            <StatCard label="Disabled" value={kpis.disabled.toLocaleString()} />
            <StatCard label="First active" value={kpis.defaultName} icon={<Wallet className="h-4 w-4" />} />
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
                    <ZoruTableHead className="text-zoru-ink-muted">Description</ZoruTableHead>
                    <ZoruTableHead className="text-zoru-ink-muted">Status</ZoruTableHead>
                    <ZoruTableHead className="text-right text-zoru-ink-muted">Actions</ZoruTableHead>
                  </ZoruTableRow>
                </ZoruTableHeader>
                <ZoruTableBody>
                  {loading && rows.length === 0 ? (
                    Array.from({ length: 4 }).map((_, i) => (
                      <ZoruTableRow key={i}><ZoruTableCell colSpan={5}><Skeleton className="h-8 w-full" /></ZoruTableCell></ZoruTableRow>
                    ))
                  ) : pageRows.length === 0 ? (
                    <ZoruTableRow>
                      <ZoruTableCell colSpan={5} className="h-24 text-center text-[13px] text-zoru-ink-muted">No methods match this filter.</ZoruTableCell>
                    </ZoruTableRow>
                  ) : (
                    pageRows.map((row) => (
                      <ZoruTableRow key={row._id} className="border-zoru-line">
                        <ZoruTableCell>
                          <Checkbox checked={selected.has(row._id)} onCheckedChange={() => toggleOne(row._id)} aria-label={`Select ${row.name}`} />
                        </ZoruTableCell>
                        <ZoruTableCell className="font-medium text-zoru-ink">
                          <RowDrawer label={row.name} title={`Payment Method · ${row.name}`} description="Method details. Use Edit to modify.">
                            <div className="space-y-3 text-sm">
                              <div><div className="text-xs text-zoru-ink-muted">Name</div><div>{row.name}</div></div>
                              <div><div className="text-xs text-zoru-ink-muted">Description</div><div>{row.description || '—'}</div></div>
                              <div><div className="text-xs text-zoru-ink-muted">Status</div><Badge variant={row.is_active ? 'success' : 'ghost'}>{row.is_active ? 'Enabled' : 'Disabled'}</Badge></div>
                            </div>
                          </RowDrawer>
                        </ZoruTableCell>
                        <ZoruTableCell className="max-w-[240px] truncate text-[13px] text-zoru-ink-muted">{row.description || '—'}</ZoruTableCell>
                        <ZoruTableCell className="text-[13px]">
                          <Badge variant={row.is_active ? 'success' : 'ghost'}>{row.is_active ? 'Enabled' : 'Disabled'}</Badge>
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
            <ZoruAlertDialogTitle>Delete payment method?</ZoruAlertDialogTitle>
            <ZoruAlertDialogDescription>
              {pendingDelete ? `"${pendingDelete.name}" will be permanently removed.` : 'This cannot be undone.'}
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
                ? `Delete ${selected.size} method${selected.size === 1 ? '' : 's'}?`
                : pendingBulk === 'enable'
                ? `Enable ${selected.size} method${selected.size === 1 ? '' : 's'}?`
                : `Disable ${selected.size} method${selected.size === 1 ? '' : 's'}?`}
            </ZoruAlertDialogTitle>
            <ZoruAlertDialogDescription>
              {pendingBulk === 'delete'
                ? 'Selected methods will be permanently removed.'
                : 'Selected methods will be updated.'}
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
