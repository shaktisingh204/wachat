'use client';

import * as React from 'react';
import {
  Download,
  ExternalLink,
  FileSpreadsheet,
  Link2,
  LoaderCircle,
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
} from '@/components/sabcrm/20ui/compat';
import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { RowDrawer } from '@/components/crm/row-drawer';
import { PaginationBar } from '@/components/crm/pagination-bar';
import { dateStamp, downloadCsv, downloadXlsx } from '@/lib/crm-list-export';

import {
  getCustomLinks,
  getCustomLinkKpis,
  saveCustomLink,
  deleteCustomLink,
  bulkDeleteCustomLinks,
} from '@/app/actions/worksuite/meta.actions';
import type { WsCustomLinkSetting } from '@/lib/worksuite/meta-types';

type Row = WsCustomLinkSetting & { _id: string };
type TabFilter = 'all' | 'new_tab' | 'same_tab';

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
  const [state, formAction] = useActionState(saveCustomLink, { message: '', error: '' });

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
            <ZoruDialogTitle>{isEditing ? 'Edit Custom Link' : 'New Custom Link'}</ZoruDialogTitle>
          </ZoruDialogHeader>
          <div className="grid grid-cols-1 gap-4 py-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="link_name">Name <span className="text-[var(--st-danger)]">*</span></Label>
              <Input id="link_name" name="link_name" required defaultValue={initial?.link_name ?? ''} placeholder="My Dashboard" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="position">Order</Label>
              <Input id="position" name="position" type="number" defaultValue={String(initial?.position ?? 0)} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="url">URL <span className="text-[var(--st-danger)]">*</span></Label>
              <Input id="url" name="url" required defaultValue={initial?.url ?? ''} placeholder="https://example.com" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="open_in_new_tab">Opens in</Label>
              <Select name="open_in_new_tab" defaultValue={initial?.open_in_new_tab ? 'true' : 'false'}>
                <ZoruSelectTrigger id="open_in_new_tab"><ZoruSelectValue /></ZoruSelectTrigger>
                <ZoruSelectContent>
                  <ZoruSelectItem value="false">Same tab</ZoruSelectItem>
                  <ZoruSelectItem value="true">New tab</ZoruSelectItem>
                </ZoruSelectContent>
              </Select>
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

export function CustomLinksClient(): React.JSX.Element {
  const { toast } = useZoruToast();

  const [rows, setRows] = React.useState<Row[]>([]);
  const [kpis, setKpis] = React.useState({ total: 0, newTab: 0, sameTab: 0 });
  const [loading, setLoading] = React.useState(true);

  const [search, setSearch] = React.useState('');
  const [tabFilter, setTabFilter] = React.useState<TabFilter>('all');
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(PAGE_SIZE);

  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [editing, setEditing] = React.useState<Row | null>(null);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [pendingDelete, setPendingDelete] = React.useState<Row | null>(null);
  const [pendingBulk, setPendingBulk] = React.useState(false);
  const [deletePending, startDelete] = React.useTransition();
  const [bulkPending, startBulk] = React.useTransition();

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const [list, snap] = await Promise.all([getCustomLinks(), getCustomLinkKpis()]);
      setRows(list as unknown as Row[]);
      setKpis(snap);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { void load(); }, [load]);
  React.useEffect(() => { setPage(1); }, [search, tabFilter, pageSize]);

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (tabFilter === 'new_tab' && !r.open_in_new_tab) return false;
      if (tabFilter === 'same_tab' && r.open_in_new_tab) return false;
      if (!q) return true;
      return (
        r.link_name.toLowerCase().includes(q) ||
        r.url.toLowerCase().includes(q)
      );
    });
  }, [rows, search, tabFilter]);

  const pageRows = React.useMemo(() => {
    const from = (page - 1) * pageSize;
    return filtered.slice(from, from + pageSize);
  }, [filtered, page, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));

  const toggleOne = (id: string) =>
    setSelected((prev) => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });

  const togglePage = (checked: boolean) =>
    setSelected((prev) => { const next = new Set(prev); for (const r of pageRows) checked ? next.add(r._id) : next.delete(r._id); return next; });

  const allSelected = pageRows.length > 0 && pageRows.every((r) => selected.has(r._id));
  const someSelected = !allSelected && pageRows.some((r) => selected.has(r._id));

  const HEADERS = ['Name', 'URL', 'Opens In', 'Order', 'Created'];
  const buildRows = React.useCallback((src: Row[]) =>
    src.map((r) => ({
      Name: r.link_name,
      URL: r.url,
      'Opens In': r.open_in_new_tab ? 'New tab' : 'Same tab',
      Order: r.position ?? 0,
      Created: r.createdAt ? new Date(r.createdAt as string).toLocaleDateString() : '',
    })), []);

  const exportSrc = React.useCallback(() =>
    selected.size > 0 ? rows.filter((r) => selected.has(r._id)) : filtered, [rows, filtered, selected]);

  const handleExportCsv = () => {
    const src = exportSrc();
    if (!src.length) { toast({ title: 'Nothing to export' }); return; }
    downloadCsv(`custom-links-${dateStamp()}.csv`, HEADERS, buildRows(src));
  };

  const handleExportXlsx = async () => {
    const src = exportSrc();
    if (!src.length) { toast({ title: 'Nothing to export' }); return; }
    await downloadXlsx(`custom-links-${dateStamp()}.xlsx`, HEADERS, buildRows(src), 'Custom Links');
  };

  const handleDeleteOne = () => {
    if (!pendingDelete) return;
    startDelete(async () => {
      const r = await deleteCustomLink(pendingDelete._id);
      if (r.success) {
        toast({ title: 'Link deleted' });
        setPendingDelete(null);
        setSelected((p) => { const n = new Set(p); n.delete(pendingDelete._id); return n; });
        await load();
      } else {
        toast({ title: 'Error', description: r.error, variant: 'destructive' });
      }
    });
  };

  const handleBulkDelete = () => {
    const ids = Array.from(selected);
    startBulk(async () => {
      const r = await bulkDeleteCustomLinks(ids);
      if (r.success) {
        toast({ title: `${r.deleted} link${r.deleted === 1 ? '' : 's'} deleted` });
        setSelected(new Set());
        setPendingBulk(false);
        await load();
      } else {
        toast({ title: 'Error', description: r.error, variant: 'destructive' });
      }
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
        title="Custom Links"
        subtitle="Extra links rendered in the workspace sidebar."
        primaryAction={
          <Button onClick={() => { setEditing(null); setDialogOpen(true); }}>
            <Link2 className="mr-1.5 h-3.5 w-3.5" /> New Link
          </Button>
        }
        search={{ value: search, onChange: setSearch, placeholder: 'Search by name or URL…' }}
        filters={
          <div className="flex flex-wrap items-center gap-2">
            <Select value={tabFilter} onValueChange={(v) => setTabFilter(v as TabFilter)}>
              <ZoruSelectTrigger className="h-9 w-[160px]"><ZoruSelectValue placeholder="Opens in" /></ZoruSelectTrigger>
              <ZoruSelectContent>
                <ZoruSelectItem value="all">All</ZoruSelectItem>
                <ZoruSelectItem value="new_tab">New tab</ZoruSelectItem>
                <ZoruSelectItem value="same_tab">Same tab</ZoruSelectItem>
              </ZoruSelectContent>
            </Select>
            {(search || tabFilter !== 'all') && (
              <Button variant="ghost" size="sm" onClick={() => { setSearch(''); setTabFilter('all'); }}>
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
                <button type="button" onClick={() => setSelected(new Set())} className="text-[var(--st-text-secondary)] hover:text-[var(--st-text)]">Clear</button>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" size="sm" onClick={handleExportCsv}><Download className="mr-1 h-3.5 w-3.5" /> Export CSV</Button>
                <Button variant="outline" size="sm" onClick={() => { void handleExportXlsx(); }}><FileSpreadsheet className="mr-1 h-3.5 w-3.5" /> Export XLSX</Button>
                <Button variant="destructive" size="sm" disabled={bulkPending} onClick={() => setPendingBulk(true)}>
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
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            <StatCard label="Total links" value={kpis.total.toLocaleString()} />
            <StatCard label="Opens new tab" value={kpis.newTab.toLocaleString()} icon={<ExternalLink className="h-4 w-4" />} />
            <StatCard label="Opens same tab" value={kpis.sameTab.toLocaleString()} />
          </div>

          {selected.size === 0 && (
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Button variant="outline" size="sm" onClick={handleExportCsv} disabled={filtered.length === 0}><Download className="mr-1 h-3.5 w-3.5" /> Export CSV</Button>
              <Button variant="outline" size="sm" onClick={() => { void handleExportXlsx(); }} disabled={filtered.length === 0}><FileSpreadsheet className="mr-1 h-3.5 w-3.5" /> Export XLSX</Button>
            </div>
          )}

          <Card className="p-0">
            <div className="overflow-x-auto rounded-[var(--st-radius)] border border-[var(--st-border)]">
              <Table>
                <ZoruTableHeader>
                  <ZoruTableRow className="border-[var(--st-border)] hover:bg-transparent">
                    <ZoruTableHead className="w-10">
                      <Checkbox checked={allSelected ? true : someSelected ? 'indeterminate' : false} onCheckedChange={(v) => togglePage(v === true)} aria-label="Select all on page" />
                    </ZoruTableHead>
                    <ZoruTableHead className="text-[var(--st-text-secondary)]">Name</ZoruTableHead>
                    <ZoruTableHead className="text-[var(--st-text-secondary)]">URL</ZoruTableHead>
                    <ZoruTableHead className="text-[var(--st-text-secondary)]">Opens In</ZoruTableHead>
                    <ZoruTableHead className="text-[var(--st-text-secondary)]">Order</ZoruTableHead>
                    <ZoruTableHead className="text-right text-[var(--st-text-secondary)]">Actions</ZoruTableHead>
                  </ZoruTableRow>
                </ZoruTableHeader>
                <ZoruTableBody>
                  {loading && rows.length === 0 ? (
                    Array.from({ length: 4 }).map((_, i) => (
                      <ZoruTableRow key={i}><ZoruTableCell colSpan={6}><Skeleton className="h-8 w-full" /></ZoruTableCell></ZoruTableRow>
                    ))
                  ) : pageRows.length === 0 ? (
                    <ZoruTableRow>
                      <ZoruTableCell colSpan={6} className="h-24 text-center text-[13px] text-[var(--st-text-secondary)]">No custom links match this filter.</ZoruTableCell>
                    </ZoruTableRow>
                  ) : (
                    pageRows.map((row) => (
                      <ZoruTableRow key={row._id} className="border-[var(--st-border)]">
                        <ZoruTableCell>
                          <Checkbox checked={selected.has(row._id)} onCheckedChange={() => toggleOne(row._id)} aria-label={`Select ${row.link_name}`} />
                        </ZoruTableCell>
                        <ZoruTableCell className="font-medium text-[var(--st-text)]">
                          <RowDrawer label={row.link_name} title={`Custom Link · ${row.link_name}`} description="Link details. Use Edit to modify.">
                            <div className="space-y-3 text-sm">
                              <div><div className="text-xs text-[var(--st-text-secondary)]">Name</div><div>{row.link_name}</div></div>
                              <div><div className="text-xs text-[var(--st-text-secondary)]">URL</div><div className="break-all">{row.url}</div></div>
                              <div><div className="text-xs text-[var(--st-text-secondary)]">Opens In</div><div>{row.open_in_new_tab ? 'New tab' : 'Same tab'}</div></div>
                              <div><div className="text-xs text-[var(--st-text-secondary)]">Order</div><div>{row.position ?? 0}</div></div>
                            </div>
                          </RowDrawer>
                        </ZoruTableCell>
                        <ZoruTableCell className="max-w-[240px] truncate text-[13px] text-[var(--st-text-secondary)]">
                          <a href={row.url} target="_blank" rel="noreferrer" className="hover:underline">{row.url}</a>
                        </ZoruTableCell>
                        <ZoruTableCell className="text-[13px]">
                          <Badge variant={row.open_in_new_tab ? 'warning' : 'ghost'}>
                            {row.open_in_new_tab ? 'New tab' : 'Same tab'}
                          </Badge>
                        </ZoruTableCell>
                        <ZoruTableCell className="text-[13px] text-[var(--st-text)]">{row.position ?? 0}</ZoruTableCell>
                        <ZoruTableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="sm" onClick={() => { setEditing(row); setDialogOpen(true); }} aria-label={`Edit ${row.link_name}`}>Edit</Button>
                            <Button variant="ghost" size="sm" onClick={() => setPendingDelete(row)} aria-label={`Delete ${row.link_name}`}>
                              <Trash2 className="h-3.5 w-3.5 text-[var(--st-danger)]" />
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
            <ZoruAlertDialogTitle>Delete custom link?</ZoruAlertDialogTitle>
            <ZoruAlertDialogDescription>
              {pendingDelete ? `"${pendingDelete.link_name}" will be permanently removed.` : 'This cannot be undone.'}
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

      <ZoruAlertDialog open={pendingBulk} onOpenChange={(o) => !o && setPendingBulk(false)}>
        <ZoruAlertDialogContent>
          <ZoruAlertDialogHeader>
            <ZoruAlertDialogTitle>Delete {selected.size} link{selected.size === 1 ? '' : 's'}?</ZoruAlertDialogTitle>
            <ZoruAlertDialogDescription>Selected links will be permanently removed.</ZoruAlertDialogDescription>
          </ZoruAlertDialogHeader>
          <ZoruAlertDialogFooter>
            <ZoruAlertDialogCancel>Cancel</ZoruAlertDialogCancel>
            <ZoruAlertDialogAction onClick={handleBulkDelete} disabled={bulkPending}>
              {bulkPending && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}Delete
            </ZoruAlertDialogAction>
          </ZoruAlertDialogFooter>
        </ZoruAlertDialogContent>
      </ZoruAlertDialog>
    </>
  );
}
