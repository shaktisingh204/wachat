'use client';

/**
 * Client Categories — Deep list page.
 *
 * Combines top-level Client Categories with their Sub-Categories. The
 * categories table is the primary list with full Deep-list chrome
 * (filters, bulk ops, export, KPIs). Sub-categories are linked from
 * each row via `<RowDrawer/>` since they don't warrant their own
 * detail page.
 *
 * KPIs (server-aggregated via `getClientCategoryKpis`):
 *   - Total categories
 *   - Total clients across categories (sub-category rows)
 *   - Top category (by sub-category count)
 *   - Last added
 *
 * Filters: search, status (active/archived), date range.
 * Bulk: delete, archive, CSV/XLSX export.
 *
 * Multi-tenant via `getSession()` in `hrList` / `hrSave` / `hrDelete`.
 */

import * as React from 'react';
import {
  Plus,
  Pencil,
  Trash2,
  LoaderCircle,
  X,
  Download,
  FileSpreadsheet,
  Archive,
  Tags,
  Users,
  Trophy,
  CalendarPlus,
  Layers,
} from 'lucide-react';

import {
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
  useZoruToast,
} from '@/components/zoruui';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { RowDrawer } from '@/components/crm/row-drawer';
import { ConfirmDialog } from '@/components/crm/confirm-dialog';

import {
  getClientCategories,
  saveClientCategory,
  deleteClientCategory,
  bulkDeleteClientCategories,
  bulkArchiveClientCategories,
  getClientSubCategories,
  saveClientSubCategory,
  deleteClientSubCategory,
  getClientCategoryKpis,
  type ClientCategoryKpis,
} from '@/app/actions/worksuite/crm-plus.actions';
import type {
  WsClientCategory,
  WsClientSubCategory,
} from '@/lib/worksuite/crm-types';
import {
  downloadCsv,
  downloadXlsx,
  dateStamp,
  type ExportRow,
} from '@/lib/crm-list-export';

const PAGE_SIZE = 25;

type Row = WsClientCategory & {
  _id: string;
  archived?: boolean;
  archivedAt?: string;
};
type SubRow = WsClientSubCategory & { _id: string };

export default function ClientCategoriesPage() {
  const { toast } = useZoruToast();

  const [rows, setRows] = React.useState<Row[]>([]);
  const [subs, setSubs] = React.useState<SubRow[]>([]);
  const [kpis, setKpis] = React.useState<ClientCategoryKpis | null>(null);
  const [isLoading, startLoad] = React.useTransition();
  const [isMutating, startMutate] = React.useTransition();

  // dialog state
  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Row | null>(null);
  const [name, setName] = React.useState('');

  // confirm dialog state
  const [confirmState, setConfirmState] = React.useState<
    | { kind: 'delete'; id: string; label: string }
    | { kind: 'bulkDelete' }
    | { kind: 'bulkArchive' }
    | null
  >(null);

  // filters
  const [q, setQ] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<
    'all' | 'active' | 'archived'
  >('active');
  const [from, setFrom] = React.useState('');
  const [to, setTo] = React.useState('');
  const [page, setPage] = React.useState(1);

  // selection
  const [selected, setSelected] = React.useState<Set<string>>(new Set());

  const loadAll = React.useCallback(() => {
    startLoad(async () => {
      const [cats, subList, k] = await Promise.all([
        getClientCategories(),
        getClientSubCategories(),
        getClientCategoryKpis(),
      ]);
      setRows(cats as unknown as Row[]);
      setSubs(subList as unknown as SubRow[]);
      setKpis(k);
    });
  }, []);

  React.useEffect(() => {
    loadAll();
  }, [loadAll]);

  const subCountByCategory = React.useMemo(() => {
    const m = new Map<string, number>();
    for (const s of subs) {
      const key = String(s.client_category_id ?? '');
      if (!key) continue;
      m.set(key, (m.get(key) ?? 0) + 1);
    }
    return m;
  }, [subs]);

  const filtered = React.useMemo(() => {
    const needle = q.trim().toLowerCase();
    const fromTs = from ? new Date(from).getTime() : null;
    const toTs = to ? new Date(`${to}T23:59:59`).getTime() : null;
    return rows.filter((r) => {
      if (needle && !r.category_name.toLowerCase().includes(needle))
        return false;
      const archived = Boolean(r.archived);
      if (statusFilter === 'active' && archived) return false;
      if (statusFilter === 'archived' && !archived) return false;
      if (fromTs || toTs) {
        const t = new Date(String(r.createdAt ?? 0)).getTime();
        if (fromTs && t < fromTs) return false;
        if (toTs && t > toTs) return false;
      }
      return true;
    });
  }, [rows, q, statusFilter, from, to]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageSafe = Math.min(page, totalPages);
  const pageRows = React.useMemo(
    () => filtered.slice((pageSafe - 1) * PAGE_SIZE, pageSafe * PAGE_SIZE),
    [filtered, pageSafe],
  );

  React.useEffect(() => {
    setPage(1);
  }, [q, statusFilter, from, to]);

  const openNew = () => {
    setEditing(null);
    setName('');
    setOpen(true);
  };
  const openEdit = (r: Row) => {
    setEditing(r);
    setName(r.category_name);
    setOpen(true);
  };

  const handleSave = () => {
    if (!name.trim()) return;
    const fd = new FormData();
    if (editing) fd.append('_id', editing._id);
    fd.append('category_name', name.trim());
    startMutate(async () => {
      const r = await saveClientCategory(undefined, fd);
      if (r.error) {
        toast({
          title: 'Error',
          description: r.error,
          variant: 'destructive',
        });
        return;
      }
      toast({ title: 'Saved' });
      setOpen(false);
      loadAll();
    });
  };

  const handleDelete = (id: string) => {
    startMutate(async () => {
      const r = await deleteClientCategory(id);
      if (r.success) {
        toast({ title: 'Deleted' });
        setSelected((s) => {
          const n = new Set(s);
          n.delete(id);
          return n;
        });
        loadAll();
      } else {
        toast({
          title: 'Error',
          description: r.error,
          variant: 'destructive',
        });
      }
    });
  };

  const handleBulkDelete = () => {
    if (selected.size === 0) return;
    const ids = Array.from(selected);
    startMutate(async () => {
      const r = await bulkDeleteClientCategories(ids);
      toast({
        title: r.success ? 'Deleted' : 'Error',
        description: r.success
          ? `${r.deleted} category(s) removed`
          : r.error,
        variant: r.success ? 'default' : 'destructive',
      });
      setSelected(new Set());
      loadAll();
    });
  };

  const handleBulkArchive = () => {
    if (selected.size === 0) return;
    const ids = Array.from(selected);
    startMutate(async () => {
      const r = await bulkArchiveClientCategories(ids);
      toast({
        title: r.success ? 'Archived' : 'Error',
        description: r.success
          ? `${r.archived} category(s) archived`
          : r.error,
        variant: r.success ? 'default' : 'destructive',
      });
      setSelected(new Set());
      loadAll();
    });
  };

  const toggleAllOnPage = (checked: boolean) => {
    setSelected((s) => {
      const next = new Set(s);
      for (const r of pageRows) {
        if (checked) next.add(r._id);
        else next.delete(r._id);
      }
      return next;
    });
  };
  const allOnPageSelected =
    pageRows.length > 0 && pageRows.every((r) => selected.has(r._id));

  const buildExport = (): { headers: string[]; rows: ExportRow[] } => {
    const headers = [
      'Category',
      'Sub-Categories',
      'Status',
      'Created At',
    ];
    const out: ExportRow[] = filtered.map((r) => ({
      Category: r.category_name,
      'Sub-Categories': subCountByCategory.get(r._id) ?? 0,
      Status: r.archived ? 'archived' : 'active',
      'Created At': r.createdAt ? String(r.createdAt).slice(0, 10) : '',
    }));
    return { headers, rows: out };
  };
  const onExportCsv = () => {
    const { headers, rows: out } = buildExport();
    downloadCsv(`client-categories-${dateStamp()}.csv`, headers, out);
  };
  const onExportXlsx = () => {
    const { headers, rows: out } = buildExport();
    void downloadXlsx(
      `client-categories-${dateStamp()}.xlsx`,
      headers,
      out,
      'Categories',
    );
  };

  return (
    <EntityListShell
      title="Client Categories"
      subtitle="Top-level grouping for client accounts — drill in to manage sub-categories."
      search={{
        value: q,
        onChange: setQ,
        placeholder: 'Search categories…',
      }}
      primaryAction={
        <div className="flex items-center gap-2">
          <ZoruButton variant="outline" size="sm" onClick={onExportCsv}>
            <Download className="h-3.5 w-3.5" strokeWidth={1.75} />
            CSV
          </ZoruButton>
          <ZoruButton variant="outline" size="sm" onClick={onExportXlsx}>
            <FileSpreadsheet className="h-3.5 w-3.5" strokeWidth={1.75} />
            XLSX
          </ZoruButton>
          <ZoruButton onClick={openNew}>
            <Plus className="h-4 w-4" strokeWidth={1.75} />
            Add Category
          </ZoruButton>
        </div>
      }
      filters={
        <>
          <div className="w-40">
            <ZoruSelect
              value={statusFilter}
              onValueChange={(v) =>
                setStatusFilter(v as typeof statusFilter)
              }
            >
              <ZoruSelectTrigger>
                <ZoruSelectValue placeholder="Status" />
              </ZoruSelectTrigger>
              <ZoruSelectContent>
                <ZoruSelectItem value="all">All statuses</ZoruSelectItem>
                <ZoruSelectItem value="active">Active</ZoruSelectItem>
                <ZoruSelectItem value="archived">Archived</ZoruSelectItem>
              </ZoruSelectContent>
            </ZoruSelect>
          </div>
          <div className="flex items-center gap-2">
            <ZoruLabel className="text-[12px] text-zoru-ink-muted">
              From
            </ZoruLabel>
            <ZoruInput
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="h-9 w-[160px]"
            />
            <ZoruLabel className="text-[12px] text-zoru-ink-muted">
              To
            </ZoruLabel>
            <ZoruInput
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="h-9 w-[160px]"
            />
          </div>
        </>
      }
      bulkBar={
        selected.size > 0 ? (
          <div className="flex items-center justify-between gap-3">
            <span className="text-[12.5px] text-zoru-ink-muted">
              {selected.size} selected
            </span>
            <div className="flex items-center gap-2">
              <ZoruButton
                variant="outline"
                size="sm"
                onClick={() => setSelected(new Set())}
              >
                Clear
              </ZoruButton>
              <ZoruButton
                variant="outline"
                size="sm"
                onClick={onExportCsv}
              >
                <Download
                  className="h-3.5 w-3.5"
                  strokeWidth={1.75}
                />
                Export CSV
              </ZoruButton>
              <ZoruButton
                variant="outline"
                size="sm"
                onClick={() => setConfirmState({ kind: 'bulkArchive' })}
                disabled={isMutating}
              >
                <Archive
                  className="h-3.5 w-3.5"
                  strokeWidth={1.75}
                />
                Archive
              </ZoruButton>
              <ZoruButton
                variant="outline"
                size="sm"
                onClick={() => setConfirmState({ kind: 'bulkDelete' })}
                disabled={isMutating}
              >
                <Trash2
                  className="h-3.5 w-3.5 text-red-500"
                  strokeWidth={1.75}
                />
                Delete
              </ZoruButton>
            </div>
          </div>
        ) : null
      }
    >
      <div className="flex flex-col gap-4">
        {/* KPI strip */}
        <div className="grid gap-3 md:grid-cols-4">
          <KpiCard
            icon={<Tags className="h-4 w-4" />}
            label="Total categories"
            value={(kpis?.total ?? 0).toLocaleString('en-IN')}
            hint="Including archived"
          />
          <KpiCard
            icon={<Users className="h-4 w-4" />}
            label="Clients across categories"
            value={(
              kpis?.totalClientsAcrossCategories ?? 0
            ).toLocaleString('en-IN')}
            hint="Total sub-categories defined"
          />
          <KpiCard
            icon={<Trophy className="h-4 w-4" />}
            label="Top category"
            value={kpis?.topCategory?.label ?? '—'}
            hint={
              kpis?.topCategory
                ? `${kpis.topCategory.count} sub-categories`
                : 'No sub-categories yet'
            }
          />
          <KpiCard
            icon={<CalendarPlus className="h-4 w-4" />}
            label="Last added"
            value={kpis?.lastAdded?.label ?? '—'}
            hint={
              kpis?.lastAdded?.at
                ? new Date(kpis.lastAdded.at).toLocaleDateString()
                : '—'
            }
          />
        </div>

        <ZoruCard className="p-0">
          {isLoading && rows.length === 0 ? (
            <div className="py-12 text-center text-[13px] text-zoru-ink-muted">
              Loading…
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-[13px] text-zoru-ink-muted">
              {rows.length === 0
                ? 'No categories yet. Add one above.'
                : 'No categories match the current filters.'}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-zoru-line">
              <table className="w-full text-left text-[13px]">
                <thead>
                  <tr className="border-b border-zoru-line bg-zoru-surface-2">
                    <th className="w-10 px-3 py-3">
                      <ZoruCheckbox
                        checked={allOnPageSelected}
                        onCheckedChange={(c) =>
                          toggleAllOnPage(Boolean(c))
                        }
                        aria-label="Select all on page"
                      />
                    </th>
                    <th className="px-4 py-3 font-medium text-zoru-ink-muted">
                      Category
                    </th>
                    <th className="px-4 py-3 font-medium text-zoru-ink-muted">
                      Sub-Categories
                    </th>
                    <th className="px-4 py-3 font-medium text-zoru-ink-muted">
                      Status
                    </th>
                    <th className="px-4 py-3 font-medium text-zoru-ink-muted">
                      Created
                    </th>
                    <th className="px-4 py-3 text-right font-medium text-zoru-ink-muted">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((r) => {
                    const isSel = selected.has(r._id);
                    const subCount = subCountByCategory.get(r._id) ?? 0;
                    const archived = Boolean(r.archived);
                    return (
                      <tr
                        key={r._id}
                        className="border-b border-zoru-line last:border-0"
                      >
                        <td className="px-3 py-3">
                          <ZoruCheckbox
                            checked={isSel}
                            onCheckedChange={(c) => {
                              setSelected((s) => {
                                const next = new Set(s);
                                if (c) next.add(r._id);
                                else next.delete(r._id);
                                return next;
                              });
                            }}
                            aria-label={`Select ${r.category_name}`}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <RowDrawer
                            label={r.category_name}
                            subtitle={`${subCount} sub-categor${
                              subCount === 1 ? 'y' : 'ies'
                            }`}
                            title={r.category_name}
                            description="Sub-categories under this parent"
                            width="md"
                          >
                            <SubCategoryDrawerPanel
                              parent={r}
                              parents={rows}
                              subs={subs.filter(
                                (s) =>
                                  String(s.client_category_id) === r._id,
                              )}
                              onChanged={loadAll}
                            />
                          </RowDrawer>
                        </td>
                        <td className="px-4 py-3 text-zoru-ink">{subCount}</td>
                        <td className="px-4 py-3">
                          <ZoruBadge
                            variant={archived ? 'warning' : 'success'}
                          >
                            {archived ? 'archived' : 'active'}
                          </ZoruBadge>
                        </td>
                        <td className="px-4 py-3 text-zoru-ink-muted">
                          {r.createdAt
                            ? new Date(
                                String(r.createdAt),
                              ).toLocaleDateString()
                            : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-1">
                            <ZoruButton
                              variant="outline"
                              size="sm"
                              onClick={() => openEdit(r)}
                            >
                              <Pencil
                                className="h-3.5 w-3.5"
                                strokeWidth={1.75}
                              />
                              Edit
                            </ZoruButton>
                            <ZoruButton
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                setConfirmState({
                                  kind: 'delete',
                                  id: r._id,
                                  label: r.category_name,
                                })
                              }
                              disabled={isMutating}
                            >
                              <Trash2
                                className="h-3.5 w-3.5 text-red-500"
                                strokeWidth={1.75}
                              />
                              Delete
                            </ZoruButton>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {filtered.length > PAGE_SIZE ? (
            <div className="flex items-center justify-between gap-3 border-t border-zoru-line px-3 py-2.5 text-[12.5px] text-zoru-ink-muted">
              <span>
                Page {pageSafe} of {totalPages} · {filtered.length} categories
              </span>
              <div className="flex items-center gap-1">
                <ZoruButton
                  variant="outline"
                  size="sm"
                  disabled={pageSafe <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Prev
                </ZoruButton>
                <ZoruButton
                  variant="outline"
                  size="sm"
                  disabled={pageSafe >= totalPages}
                  onClick={() =>
                    setPage((p) => Math.min(totalPages, p + 1))
                  }
                >
                  Next
                </ZoruButton>
              </div>
            </div>
          ) : null}
        </ZoruCard>
      </div>

      {/* Add/Edit modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <ZoruCard className="w-full max-w-md p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-[16px] text-zoru-ink">
                {editing ? 'Edit Category' : 'Add Category'}
              </h2>
              <ZoruButton
                variant="outline"
                size="sm"
                onClick={() => setOpen(false)}
              >
                <X className="h-4 w-4" strokeWidth={1.75} />
                Close
              </ZoruButton>
            </div>
            <div className="grid gap-3">
              <div>
                <ZoruLabel>Category Name *</ZoruLabel>
                <ZoruInput
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Enterprise"
                  className="mt-1.5"
                  autoFocus
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <ZoruButton
                  variant="outline"
                  onClick={() => setOpen(false)}
                >
                  Cancel
                </ZoruButton>
                <ZoruButton
                  onClick={handleSave}
                  disabled={isMutating || !name.trim()}
                >
                  {isMutating ? (
                    <LoaderCircle
                      className="h-4 w-4 animate-spin"
                      strokeWidth={1.75}
                    />
                  ) : null}
                  {editing ? 'Update' : 'Create'}
                </ZoruButton>
              </div>
            </div>
          </ZoruCard>
        </div>
      )}

      <ConfirmDialog
        open={confirmState?.kind === 'delete'}
        onOpenChange={(o) => {
          if (!o) setConfirmState(null);
        }}
        title="Delete category?"
        description={
          confirmState?.kind === 'delete'
            ? `Remove "${confirmState.label}". This action cannot be undone.`
            : ''
        }
        onConfirm={async () => {
          if (confirmState?.kind === 'delete') handleDelete(confirmState.id);
        }}
      />
      <ConfirmDialog
        open={confirmState?.kind === 'bulkDelete'}
        onOpenChange={(o) => {
          if (!o) setConfirmState(null);
        }}
        title={`Delete ${selected.size} categor${
          selected.size === 1 ? 'y' : 'ies'
        }?`}
        description="This permanently removes the selected categories. Their sub-categories will remain orphaned."
        requireTyped="DELETE"
        onConfirm={async () => handleBulkDelete()}
      />
      <ConfirmDialog
        open={confirmState?.kind === 'bulkArchive'}
        onOpenChange={(o) => {
          if (!o) setConfirmState(null);
        }}
        title={`Archive ${selected.size} categor${
          selected.size === 1 ? 'y' : 'ies'
        }?`}
        description="Archived categories stay in the database but hide from the default Active view."
        confirmLabel="Archive"
        confirmTone="primary"
        onConfirm={async () => handleBulkArchive()}
      />
    </EntityListShell>
  );
}

function KpiCard({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <ZoruCard className="p-5">
      <div className="flex items-center gap-2 text-zoru-ink-muted">
        {icon}
        <p className="text-[12.5px] font-medium">{label}</p>
      </div>
      <div className="mt-2 truncate text-2xl text-zoru-ink" title={value}>
        {value}
      </div>
      {hint ? (
        <p
          className="mt-1 truncate text-[11.5px] text-zoru-ink-muted"
          title={hint}
        >
          {hint}
        </p>
      ) : null}
    </ZoruCard>
  );
}

/* ─── Sub-category drawer panel ──────────────────────────────────────── */

function SubCategoryDrawerPanel({
  parent,
  parents,
  subs,
  onChanged,
}: {
  parent: WsClientCategory & { _id: string };
  parents: (WsClientCategory & { _id: string })[];
  subs: SubRow[];
  onChanged: () => void;
}) {
  const { toast } = useZoruToast();
  const [name, setName] = React.useState('');
  const [parentId, setParentId] = React.useState(parent._id);
  const [editingSub, setEditingSub] = React.useState<SubRow | null>(null);
  const [isPending, startTransition] = React.useTransition();

  const reset = () => {
    setName('');
    setParentId(parent._id);
    setEditingSub(null);
  };

  const handleSubmit = () => {
    if (!name.trim()) return;
    const fd = new FormData();
    if (editingSub) fd.append('_id', editingSub._id);
    fd.append('client_category_id', parentId);
    fd.append('name', name.trim());
    startTransition(async () => {
      const r = await saveClientSubCategory(undefined, fd);
      if (r.error) {
        toast({
          title: 'Error',
          description: r.error,
          variant: 'destructive',
        });
      } else {
        toast({ title: 'Saved' });
        reset();
        onChanged();
      }
    });
  };

  const handleDeleteSub = (id: string) => {
    startTransition(async () => {
      const r = await deleteClientSubCategory(id);
      if (r.success) {
        toast({ title: 'Deleted' });
        onChanged();
      } else {
        toast({
          title: 'Error',
          description: r.error,
          variant: 'destructive',
        });
      }
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg border border-zoru-line p-3">
        <ZoruLabel className="text-[12px] text-zoru-ink-muted">
          Parent category
        </ZoruLabel>
        <ZoruSelect value={parentId} onValueChange={setParentId}>
          <ZoruSelectTrigger className="mt-1.5">
            <ZoruSelectValue />
          </ZoruSelectTrigger>
          <ZoruSelectContent>
            {parents.map((p) => (
              <ZoruSelectItem key={p._id} value={p._id}>
                {p.category_name}
              </ZoruSelectItem>
            ))}
          </ZoruSelectContent>
        </ZoruSelect>

        <ZoruLabel className="mt-3 text-[12px] text-zoru-ink-muted">
          Sub-category name
        </ZoruLabel>
        <ZoruInput
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. SaaS"
          className="mt-1.5"
        />
        <div className="mt-3 flex justify-end gap-2">
          {editingSub ? (
            <ZoruButton variant="outline" size="sm" onClick={reset}>
              Cancel
            </ZoruButton>
          ) : null}
          <ZoruButton
            size="sm"
            onClick={handleSubmit}
            disabled={isPending || !name.trim()}
          >
            {isPending ? (
              <LoaderCircle
                className="h-3.5 w-3.5 animate-spin"
                strokeWidth={1.75}
              />
            ) : (
              <Plus className="h-3.5 w-3.5" strokeWidth={1.75} />
            )}
            {editingSub ? 'Update' : 'Add'}
          </ZoruButton>
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center gap-2 text-[12.5px] text-zoru-ink-muted">
          <Layers className="h-3.5 w-3.5" />
          <span>{subs.length} sub-categories</span>
        </div>
        {subs.length === 0 ? (
          <div className="rounded-lg border border-dashed border-zoru-line p-6 text-center text-[12.5px] text-zoru-ink-muted">
            No sub-categories yet.
          </div>
        ) : (
          <ul className="flex flex-col gap-1">
            {subs.map((s) => (
              <li
                key={s._id}
                className="flex items-center justify-between rounded-md border border-zoru-line px-3 py-2 text-[13px]"
              >
                <span className="truncate">{s.name}</span>
                <div className="flex gap-1">
                  <ZoruButton
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setEditingSub(s);
                      setName(s.name);
                      setParentId(String(s.client_category_id));
                    }}
                  >
                    <Pencil
                      className="h-3 w-3"
                      strokeWidth={1.75}
                    />
                  </ZoruButton>
                  <ZoruButton
                    variant="outline"
                    size="sm"
                    onClick={() => handleDeleteSub(s._id)}
                    disabled={isPending}
                  >
                    <Trash2
                      className="h-3 w-3 text-red-500"
                      strokeWidth={1.75}
                    />
                  </ZoruButton>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
