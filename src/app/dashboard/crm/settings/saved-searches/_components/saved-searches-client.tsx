'use client';

import * as React from 'react';
import {
  Download,
  FileSpreadsheet,
  Search,
  Trash2,
  X,
  LoaderCircle,
} from 'lucide-react';

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, Badge, Button, Card, Checkbox, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Skeleton, StatCard, Table, TBody, Td, Th, THead, Tr, useToast } from '@/components/sabcrm/20ui/compat';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { RowDrawer } from '@/components/crm/row-drawer';
import { PaginationBar } from '@/components/crm/pagination-bar';
import {
  dateStamp,
  downloadCsv,
  downloadXlsx,
} from '@/lib/crm-list-export';

import {
  getSavedSearches,
  getSavedSearchKpis,
  deleteSavedSearch,
  bulkDeleteSavedSearches,
} from '@/app/actions/worksuite/meta.actions';
import type { WsSavedSearch } from '@/lib/worksuite/meta-types';

type Row = WsSavedSearch & { _id: string };

type ModuleFilter = 'all' | 'leads' | 'contacts' | 'deals' | 'tickets';

const MODULE_OPTIONS: { value: ModuleFilter; label: string }[] = [
  { value: 'all', label: 'All modules' },
  { value: 'leads', label: 'Leads' },
  { value: 'contacts', label: 'Contacts' },
  { value: 'deals', label: 'Deals' },
  { value: 'tickets', label: 'Tickets' },
];

const PAGE_SIZE = 20;

function fmt(v: unknown): string {
  if (!v) return '—';
  try {
    return new Date(v as string).toLocaleDateString();
  } catch {
    return String(v);
  }
}

export function SavedSearchesClient(): React.JSX.Element {
  const { toast } = useToast();

  const [rows, setRows] = React.useState<Row[]>([]);
  const [kpis, setKpis] = React.useState({ total: 0, usedToday: 0, avgFilters: 0 });
  const [loading, setLoading] = React.useState(true);

  const [search, setSearch] = React.useState('');
  const [moduleFilter, setModuleFilter] = React.useState<ModuleFilter>('all');
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(PAGE_SIZE);

  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [pendingDelete, setPendingDelete] = React.useState<Row | null>(null);
  const [pendingBulk, setPendingBulk] = React.useState(false);
  const [deletePending, startDelete] = React.useTransition();
  const [bulkPending, startBulk] = React.useTransition();

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const [list, snap] = await Promise.all([getSavedSearches(), getSavedSearchKpis()]);
      setRows(list as unknown as Row[]);
      setKpis(snap);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { void load(); }, [load]);
  React.useEffect(() => { setPage(1); }, [search, moduleFilter, pageSize]);

  /* ── filtering ─────────────────────────────────────────────── */

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (moduleFilter !== 'all' && r.module !== moduleFilter) return false;
      if (!q) return true;
      return (
        r.search_term.toLowerCase().includes(q) ||
        (r.module ?? '').toLowerCase().includes(q)
      );
    });
  }, [rows, search, moduleFilter]);

  const pageRows = React.useMemo(() => {
    const from = (page - 1) * pageSize;
    return filtered.slice(from, from + pageSize);
  }, [filtered, page, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));

  /* ── selection ─────────────────────────────────────────────── */

  const toggleOne = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const togglePage = (checked: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      for (const r of pageRows) checked ? next.add(r._id) : next.delete(r._id);
      return next;
    });

  const allSelected = pageRows.length > 0 && pageRows.every((r) => selected.has(r._id));
  const someSelected = !allSelected && pageRows.some((r) => selected.has(r._id));

  /* ── export ────────────────────────────────────────────────── */

  const HEADERS = ['Search Term', 'Module', 'Results', 'Last Used', 'Created'];

  const buildRows = React.useCallback((src: Row[]) =>
    src.map((r) => ({
      'Search Term': r.search_term,
      'Module': r.module ?? '',
      'Results': r.result_count ?? '',
      'Last Used': r.last_used_at ? new Date(r.last_used_at as string).toLocaleDateString() : '',
      'Created': r.createdAt ? new Date(r.createdAt as string).toLocaleDateString() : '',
    })), []);

  const exportSrc = React.useCallback(() =>
    selected.size > 0 ? rows.filter((r) => selected.has(r._id)) : filtered,
    [rows, filtered, selected]);

  const handleExportCsv = () => {
    const src = exportSrc();
    if (src.length === 0) { toast({ title: 'Nothing to export' }); return; }
    downloadCsv(`saved-searches-${dateStamp()}.csv`, HEADERS, buildRows(src));
  };

  const handleExportXlsx = async () => {
    const src = exportSrc();
    if (src.length === 0) { toast({ title: 'Nothing to export' }); return; }
    await downloadXlsx(`saved-searches-${dateStamp()}.xlsx`, HEADERS, buildRows(src), 'Saved Searches');
  };

  /* ── delete ────────────────────────────────────────────────── */

  const handleDeleteOne = () => {
    if (!pendingDelete) return;
    startDelete(async () => {
      const r = await deleteSavedSearch(pendingDelete._id);
      if (r.success) {
        toast({ title: 'Deleted' });
        setPendingDelete(null);
        setSelected((prev) => { const next = new Set(prev); next.delete(pendingDelete._id); return next; });
        await load();
      } else {
        toast({ title: 'Error', description: r.error, variant: 'destructive' });
      }
    });
  };

  const handleBulkDelete = () => {
    const ids = Array.from(selected);
    startBulk(async () => {
      const r = await bulkDeleteSavedSearches(ids);
      if (r.success) {
        toast({ title: `${r.deleted} search${r.deleted === 1 ? '' : 'es'} deleted` });
        setSelected(new Set());
        setPendingBulk(false);
        await load();
      } else {
        toast({ title: 'Error', description: r.error, variant: 'destructive' });
      }
    });
  };

  /* ── render ────────────────────────────────────────────────── */

  return (
    <>
      <EntityListShell
        title="Saved Searches"
        subtitle="Reusable search queries pinned across CRM modules."
        search={{ value: search, onChange: setSearch, placeholder: 'Search by term or module…' }}
        filters={
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={moduleFilter}
              onValueChange={(v) => setModuleFilter(v as ModuleFilter)}
            >
              <SelectTrigger className="h-9 w-[170px]">
                <SelectValue placeholder="Module" />
              </SelectTrigger>
              <SelectContent>
                {MODULE_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {(search || moduleFilter !== 'all') && (
              <Button variant="ghost" size="sm" onClick={() => { setSearch(''); setModuleFilter('all'); }}>
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
                <Button variant="outline" size="sm" onClick={handleExportCsv}>
                  <Download className="mr-1 h-3.5 w-3.5" /> Export CSV
                </Button>
                <Button variant="outline" size="sm" onClick={() => { void handleExportXlsx(); }}>
                  <FileSpreadsheet className="mr-1 h-3.5 w-3.5" /> Export XLSX
                </Button>
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
            <PaginationBar
              page={page}
              limit={pageSize}
              hasMore={page < totalPages}
              total={filtered.length}
              controlled={{ onChange: (n) => { setPage(n.page); setPageSize(n.limit); } }}
            />
          ) : null
        }
      >
        <div className="flex flex-col gap-4">
          {/* KPI strip */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            <StatCard label="Total saved searches" value={kpis.total.toLocaleString()} />
            <StatCard label="Used today" value={kpis.usedToday.toLocaleString()} icon={<Search className="h-4 w-4" />} />
            <StatCard label="Avg results" value={kpis.avgFilters.toLocaleString()} />
          </div>

          {/* Export toolbar when no selection */}
          {selected.size === 0 && (
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Button variant="outline" size="sm" onClick={handleExportCsv} disabled={filtered.length === 0}>
                <Download className="mr-1 h-3.5 w-3.5" /> Export CSV
              </Button>
              <Button variant="outline" size="sm" onClick={() => { void handleExportXlsx(); }} disabled={filtered.length === 0}>
                <FileSpreadsheet className="mr-1 h-3.5 w-3.5" /> Export XLSX
              </Button>
            </div>
          )}

          {/* Table */}
          <Card className="p-0">
            <div className="overflow-x-auto rounded-[var(--st-radius)] border border-[var(--st-border)]">
              <Table>
                <THead>
                  <Tr className="border-[var(--st-border)] hover:bg-transparent">
                    <Th className="w-10">
                      <Checkbox
                        checked={allSelected ? true : someSelected ? 'indeterminate' : false}
                        onCheckedChange={(v) => togglePage(v === true)}
                        aria-label="Select all on page"
                      />
                    </Th>
                    <Th className="text-[var(--st-text-secondary)]">Name / Term</Th>
                    <Th className="text-[var(--st-text-secondary)]">Module</Th>
                    <Th className="text-[var(--st-text-secondary)]">Results</Th>
                    <Th className="text-[var(--st-text-secondary)]">Last Used</Th>
                    <Th className="text-[var(--st-text-secondary)]">Created</Th>
                    <Th className="text-right text-[var(--st-text-secondary)]">Actions</Th>
                  </Tr>
                </THead>
                <TBody>
                  {loading && rows.length === 0 ? (
                    Array.from({ length: 4 }).map((_, i) => (
                      <Tr key={i}>
                        <Td colSpan={7}><Skeleton className="h-8 w-full" /></Td>
                      </Tr>
                    ))
                  ) : pageRows.length === 0 ? (
                    <Tr>
                      <Td colSpan={7} className="h-24 text-center text-[13px] text-[var(--st-text-secondary)]">
                        No saved searches match this filter.
                      </Td>
                    </Tr>
                  ) : (
                    pageRows.map((row) => (
                      <Tr key={row._id} className="border-[var(--st-border)]">
                        <Td>
                          <Checkbox
                            checked={selected.has(row._id)}
                            onCheckedChange={() => toggleOne(row._id)}
                            aria-label={`Select ${row.search_term}`}
                          />
                        </Td>
                        <Td className="font-medium text-[var(--st-text)]">
                          <RowDrawer
                            label={row.search_term || '—'}
                            title={`Saved Search · ${row.search_term}`}
                            description="Read-only saved search summary."
                          >
                            <div className="space-y-3 text-sm">
                              <div>
                                <div className="text-xs text-[var(--st-text-secondary)]">Search Term</div>
                                <div>{row.search_term}</div>
                              </div>
                              <div>
                                <div className="text-xs text-[var(--st-text-secondary)]">Module</div>
                                <div>{row.module ?? '—'}</div>
                              </div>
                              <div>
                                <div className="text-xs text-[var(--st-text-secondary)]">Result Count</div>
                                <div>{row.result_count ?? '—'}</div>
                              </div>
                              <div>
                                <div className="text-xs text-[var(--st-text-secondary)]">Last Used</div>
                                <div>{fmt(row.last_used_at)}</div>
                              </div>
                              <div>
                                <div className="text-xs text-[var(--st-text-secondary)]">Created</div>
                                <div>{fmt(row.createdAt)}</div>
                              </div>
                            </div>
                          </RowDrawer>
                        </Td>
                        <Td className="text-[13px]">
                          <Badge variant="ghost">{row.module ?? '—'}</Badge>
                        </Td>
                        <Td className="text-[13px] text-[var(--st-text)]">
                          {row.result_count ?? '—'}
                        </Td>
                        <Td className="text-[13px] text-[var(--st-text)]">
                          {fmt(row.last_used_at)}
                        </Td>
                        <Td className="text-[13px] text-[var(--st-text)]">
                          {fmt(row.createdAt)}
                        </Td>
                        <Td className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setPendingDelete(row)}
                            aria-label={`Delete ${row.search_term}`}
                          >
                            <Trash2 className="h-3.5 w-3.5 text-[var(--st-danger)]" />
                          </Button>
                        </Td>
                      </Tr>
                    ))
                  )}
                </TBody>
              </Table>
            </div>
          </Card>
        </div>
      </EntityListShell>

      {/* Single delete confirm */}
      <AlertDialog open={!!pendingDelete} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete saved search?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete ? `"${pendingDelete.search_term}" will be permanently removed.` : 'This cannot be undone.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteOne} disabled={deletePending}>
              {deletePending && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk delete confirm */}
      <AlertDialog open={pendingBulk} onOpenChange={(o) => !o && setPendingBulk(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selected.size} saved {selected.size === 1 ? 'search' : 'searches'}?</AlertDialogTitle>
            <AlertDialogDescription>Selected searches will be permanently removed. This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkDelete} disabled={bulkPending}>
              {bulkPending && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
