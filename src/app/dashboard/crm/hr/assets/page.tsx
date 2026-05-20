'use client';

/**
 * HR Assets — Deep list page (§1D).
 *
 * KPI strip: total · assigned · in-store (available) · under maintenance
 * Filters: search · status · category · assigned-to (free text on filter)
 * Bulk: assign status → retired · delete · export CSV / XLSX
 * Multi-tenant via getSession() in server actions.
 */

import * as React from 'react';
import Link from 'next/link';
import {
  Download,
  Edit,
  FileSpreadsheet,
  Plus,
  Trash2,
  X,
} from 'lucide-react';

import {
  ZoruButton,
  ZoruCard,
  ZoruCheckbox,
  ZoruDropdownMenu,
  ZoruDropdownMenuContent,
  ZoruDropdownMenuItem,
  ZoruDropdownMenuTrigger,
  ZoruSelect,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  ZoruTable,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
  useZoruToast,
} from '@/components/zoruui';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { EntityRowLink } from '@/components/crm/entity-row-link';
import { ConfirmDialog } from '@/components/crm/confirm-dialog';
import { PaginationBar } from '@/components/crm/pagination-bar';
import { StatusPill, type StatusTone } from '@/components/crm/status-pill';
import { downloadCsv, downloadXlsx, dateStamp } from '@/lib/crm-list-export';

import {
  bulkDeleteAssets,
  bulkRetireAssets,
  deleteAsset,
  getAssetKpis,
  getAssets,
  type CrmAssetKpis,
} from '@/app/actions/crm-assets.actions';
import type {
  CrmAssetCategory,
  CrmAssetDoc,
  CrmAssetStatus,
} from '@/lib/rust-client/crm-assets';

const BASE = '/dashboard/crm/hr/assets';
const PAGE_SIZE = 20;

const STATUS_OPTIONS: Array<{ value: CrmAssetStatus | 'all'; label: string }> = [
  { value: 'all', label: 'All statuses' },
  { value: 'available', label: 'Available' },
  { value: 'assigned', label: 'Assigned' },
  { value: 'in_repair', label: 'In repair' },
  { value: 'retired', label: 'Retired' },
  { value: 'archived', label: 'Archived' },
];

const CATEGORY_OPTIONS: Array<{ value: CrmAssetCategory | 'all'; label: string }> = [
  { value: 'all', label: 'All categories' },
  { value: 'laptop', label: 'Laptop' },
  { value: 'phone', label: 'Phone' },
  { value: 'monitor', label: 'Monitor' },
  { value: 'badge', label: 'Badge' },
  { value: 'keys', label: 'Keys' },
  { value: 'vehicle', label: 'Vehicle' },
  { value: 'other', label: 'Other' },
];

const STATUS_TONE: Record<CrmAssetStatus, StatusTone> = {
  available: 'green',
  assigned: 'blue',
  in_repair: 'amber',
  retired: 'neutral',
  archived: 'neutral',
};

const EMPTY_KPIS: CrmAssetKpis = {
  total: 0,
  assigned: 0,
  inStore: 0,
  underMaintenance: 0,
};

function statusLabel(s: string): string {
  return s.replace(/_/g, ' ');
}

function fmtDate(v: unknown): string {
  if (!v) return '—';
  const d = new Date(v as string);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

export default function AssetsListPage(): React.JSX.Element {
  const { toast } = useZoruToast();

  const [assets, setAssets] = React.useState<CrmAssetDoc[]>([]);
  const [kpis, setKpis] = React.useState<CrmAssetKpis>(EMPTY_KPIS);
  const [isLoading, setIsLoading] = React.useState(true);

  const [search, setSearch] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<CrmAssetStatus | 'all'>('all');
  const [categoryFilter, setCategoryFilter] = React.useState<CrmAssetCategory | 'all'>('all');

  const [page, setPage] = React.useState(1);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());

  const [pendingDeleteId, setPendingDeleteId] = React.useState<string | null>(null);
  const [pendingBulk, setPendingBulk] = React.useState<'delete' | 'retire' | null>(null);
  const [bulkPending, startBulkTransition] = React.useTransition();

  const refresh = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const [res, k] = await Promise.all([
        getAssets({
          q: search.trim() || undefined,
          status: statusFilter === 'all' ? undefined : statusFilter,
          category: categoryFilter === 'all' ? undefined : categoryFilter,
          limit: 500,
        }),
        getAssetKpis(),
      ]);
      setAssets(res.items ?? []);
      setKpis(k);
    } catch {
      setAssets([]);
      setKpis(EMPTY_KPIS);
    } finally {
      setIsLoading(false);
    }
  }, [search, statusFilter, categoryFilter]);

  React.useEffect(() => {
    const t = window.setTimeout(() => {
      void refresh();
    }, 250);
    return () => window.clearTimeout(t);
  }, [refresh]);

  const pageRows = React.useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return assets.slice(start, start + PAGE_SIZE);
  }, [assets, page]);

  const allOnPageSelected =
    pageRows.length > 0 && pageRows.every((r) => selected.has(r._id));

  const toggleAll = (check: boolean): void => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (check) for (const r of pageRows) next.add(r._id);
      else for (const r of pageRows) next.delete(r._id);
      return next;
    });
  };

  const toggleOne = (id: string): void => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const exportRows = React.useCallback(() => {
    const source =
      selected.size > 0
        ? assets.filter((r) => selected.has(r._id))
        : assets;
    return source.map((a) => ({
      assetTag: a.assetTag,
      name: a.name,
      category: a.category ?? '',
      assignee: a.currentAssigneeName ?? a.currentAssigneeId ?? '',
      condition: a.condition ?? '',
      status: statusLabel(a.status ?? 'available'),
      purchaseDate: fmtDate(a.purchaseDate),
      location: a.location ?? '',
    }));
  }, [assets, selected]);

  const handleCsv = (): void => {
    downloadCsv(
      `assets-${dateStamp()}.csv`,
      ['assetTag', 'name', 'category', 'assignee', 'condition', 'status', 'purchaseDate', 'location'],
      exportRows(),
    );
  };

  const handleXlsx = (): void => {
    void downloadXlsx(
      `assets-${dateStamp()}.xlsx`,
      ['assetTag', 'name', 'category', 'assignee', 'condition', 'status', 'purchaseDate', 'location'],
      exportRows(),
      'Assets',
    );
  };

  const handleSingleDelete = (): void => {
    if (!pendingDeleteId) return;
    startBulkTransition(async () => {
      const r = await deleteAsset(pendingDeleteId);
      if (r.success) {
        toast({ title: 'Asset deleted' });
        setPendingDeleteId(null);
        setSelected((prev) => {
          const next = new Set(prev);
          next.delete(pendingDeleteId);
          return next;
        });
        await refresh();
      } else {
        toast({ title: 'Delete failed', description: r.error, variant: 'destructive' });
      }
    });
  };

  const runBulk = (op: 'delete' | 'retire'): void => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    startBulkTransition(async () => {
      const r =
        op === 'delete'
          ? await bulkDeleteAssets(ids)
          : await bulkRetireAssets(ids);
      if (r.success) {
        toast({
          title: `${r.affected} ${op === 'delete' ? 'deleted' : 'retired'}`,
        });
        setSelected(new Set());
        setPendingBulk(null);
        await refresh();
      } else {
        toast({ title: 'Bulk action failed', description: r.error, variant: 'destructive' });
      }
    });
  };

  const resetFilters = (): void => {
    setSearch('');
    setStatusFilter('all');
    setCategoryFilter('all');
    setPage(1);
  };

  const hasFilters =
    !!search || statusFilter !== 'all' || categoryFilter !== 'all';

  return (
    <>
      <EntityListShell
        title="Assets"
        subtitle="Operational IT and office asset register."
        primaryAction={
          <div className="flex items-center gap-2">
            <ZoruDropdownMenu>
              <ZoruDropdownMenuTrigger asChild>
                <ZoruButton variant="outline" size="sm">
                  <Download className="h-3.5 w-3.5" />
                  Export
                </ZoruButton>
              </ZoruDropdownMenuTrigger>
              <ZoruDropdownMenuContent align="end">
                <ZoruDropdownMenuItem onSelect={handleCsv}>
                  <FileSpreadsheet className="h-3.5 w-3.5" />
                  Download CSV
                </ZoruDropdownMenuItem>
                <ZoruDropdownMenuItem onSelect={handleXlsx}>
                  <FileSpreadsheet className="h-3.5 w-3.5" />
                  Download XLSX
                </ZoruDropdownMenuItem>
              </ZoruDropdownMenuContent>
            </ZoruDropdownMenu>
            <ZoruButton asChild>
              <Link href={`${BASE}/new`}>
                <Plus className="h-3.5 w-3.5" /> New asset
              </Link>
            </ZoruButton>
          </div>
        }
        search={{
          value: search,
          onChange: (v) => {
            setSearch(v);
            setPage(1);
          },
          placeholder: 'Search assets…',
        }}
        filters={
          <div className="flex flex-wrap items-center gap-2">
            <ZoruSelect
              value={statusFilter}
              onValueChange={(v) => {
                setStatusFilter(v as CrmAssetStatus | 'all');
                setPage(1);
              }}
            >
              <ZoruSelectTrigger className="h-9 w-[180px]">
                <ZoruSelectValue placeholder="Status" />
              </ZoruSelectTrigger>
              <ZoruSelectContent>
                {STATUS_OPTIONS.map((o) => (
                  <ZoruSelectItem key={o.value} value={o.value}>
                    {o.label}
                  </ZoruSelectItem>
                ))}
              </ZoruSelectContent>
            </ZoruSelect>
            <ZoruSelect
              value={categoryFilter}
              onValueChange={(v) => {
                setCategoryFilter(v as CrmAssetCategory | 'all');
                setPage(1);
              }}
            >
              <ZoruSelectTrigger className="h-9 w-[180px]">
                <ZoruSelectValue placeholder="Category" />
              </ZoruSelectTrigger>
              <ZoruSelectContent>
                {CATEGORY_OPTIONS.map((o) => (
                  <ZoruSelectItem key={o.value} value={o.value}>
                    {o.label}
                  </ZoruSelectItem>
                ))}
              </ZoruSelectContent>
            </ZoruSelect>
            {hasFilters ? (
              <ZoruButton variant="ghost" size="sm" onClick={resetFilters}>
                <X className="h-3.5 w-3.5" /> Reset
              </ZoruButton>
            ) : null}
          </div>
        }
        bulkBar={
          selected.size > 0 ? (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm text-zoru-ink">{selected.size} selected</span>
              <div className="flex flex-wrap gap-2">
                <ZoruButton
                  size="sm"
                  variant="outline"
                  onClick={() => setSelected(new Set())}
                >
                  Clear
                </ZoruButton>
                <ZoruButton size="sm" variant="outline" onClick={handleCsv}>
                  <Download className="h-3.5 w-3.5" /> Export selected
                </ZoruButton>
                <ZoruButton
                  size="sm"
                  variant="outline"
                  onClick={() => setPendingBulk('retire')}
                  disabled={bulkPending}
                >
                  Retire
                </ZoruButton>
                <ZoruButton
                  size="sm"
                  variant="destructive"
                  onClick={() => setPendingBulk('delete')}
                  disabled={bulkPending}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete
                </ZoruButton>
              </div>
            </div>
          ) : null
        }
        loading={isLoading && assets.length === 0}
        pagination={
          <PaginationBar
            page={page}
            limit={PAGE_SIZE}
            hasMore={assets.length > page * PAGE_SIZE}
            total={assets.length}
            controlled={{ onChange: ({ page: p }) => setPage(p) }}
          />
        }
      >
        <div className="flex flex-col gap-4">
          {/* KPI strip */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <ZoruCard className="p-3">
              <p className="text-xs text-zoru-ink-muted">Total assets</p>
              <p className="mt-1 text-xl font-semibold text-zoru-ink">{kpis.total}</p>
            </ZoruCard>
            <ZoruCard className="p-3">
              <p className="text-xs text-zoru-ink-muted">Assigned</p>
              <p className="mt-1 text-xl font-semibold text-zoru-ink">{kpis.assigned}</p>
            </ZoruCard>
            <ZoruCard className="p-3">
              <p className="text-xs text-zoru-ink-muted">In store</p>
              <p className="mt-1 text-xl font-semibold text-zoru-ink">{kpis.inStore}</p>
            </ZoruCard>
            <ZoruCard className="p-3">
              <p className="text-xs text-zoru-ink-muted">Under maintenance</p>
              <p className="mt-1 text-xl font-semibold text-zoru-ink">{kpis.underMaintenance}</p>
            </ZoruCard>
          </div>

          {/* Table */}
          <ZoruCard className="p-0">
            <div className="overflow-x-auto rounded-[var(--zoru-radius)]">
              <ZoruTable>
                <ZoruTableHeader>
                  <ZoruTableRow className="border-zoru-line hover:bg-transparent">
                    <ZoruTableHead className="w-10">
                      <ZoruCheckbox
                        aria-label="Select all"
                        checked={allOnPageSelected}
                        onCheckedChange={(v) => toggleAll(Boolean(v))}
                      />
                    </ZoruTableHead>
                    <ZoruTableHead className="text-zoru-ink-muted">Tag</ZoruTableHead>
                    <ZoruTableHead className="text-zoru-ink-muted">Name</ZoruTableHead>
                    <ZoruTableHead className="text-zoru-ink-muted">Category</ZoruTableHead>
                    <ZoruTableHead className="text-zoru-ink-muted">Assignee</ZoruTableHead>
                    <ZoruTableHead className="text-zoru-ink-muted">Condition</ZoruTableHead>
                    <ZoruTableHead className="text-zoru-ink-muted">Status</ZoruTableHead>
                    <ZoruTableHead className="text-right text-zoru-ink-muted">Actions</ZoruTableHead>
                  </ZoruTableRow>
                </ZoruTableHeader>
                <ZoruTableBody>
                  {pageRows.length === 0 ? (
                    <ZoruTableRow className="border-zoru-line">
                      <ZoruTableCell
                        colSpan={8}
                        className="h-24 text-center text-zoru-ink-muted"
                      >
                        No assets match this filter.
                      </ZoruTableCell>
                    </ZoruTableRow>
                  ) : (
                    pageRows.map((a) => {
                      const status = (a.status ?? 'available') as CrmAssetStatus;
                      const tone = STATUS_TONE[status] ?? 'neutral';
                      const isSelected = selected.has(a._id);
                      return (
                        <ZoruTableRow key={a._id} className="border-zoru-line">
                          <ZoruTableCell>
                            <ZoruCheckbox
                              aria-label={`Select asset ${a.assetTag}`}
                              checked={isSelected}
                              onCheckedChange={() => toggleOne(a._id)}
                            />
                          </ZoruTableCell>
                          <ZoruTableCell className="font-mono text-[12px] text-zoru-ink">
                            <EntityRowLink
                              href={`${BASE}/${a._id}`}
                              label={a.assetTag}
                              subtitle={a.name}
                            />
                          </ZoruTableCell>
                          <ZoruTableCell className="font-medium text-zoru-ink">
                            {a.name}
                          </ZoruTableCell>
                          <ZoruTableCell className="capitalize text-zoru-ink">
                            {a.category ?? '—'}
                          </ZoruTableCell>
                          <ZoruTableCell className="text-zoru-ink">
                            {a.currentAssigneeName ?? a.currentAssigneeId ?? '—'}
                          </ZoruTableCell>
                          <ZoruTableCell className="capitalize text-zoru-ink">
                            {a.condition ?? '—'}
                          </ZoruTableCell>
                          <ZoruTableCell>
                            <StatusPill label={statusLabel(status)} tone={tone} />
                          </ZoruTableCell>
                          <ZoruTableCell className="text-right">
                            <ZoruButton variant="ghost" size="icon" asChild>
                              <Link href={`${BASE}/${a._id}/edit`}>
                                <Edit className="h-4 w-4" />
                              </Link>
                            </ZoruButton>
                            <ZoruButton
                              variant="ghost"
                              size="icon"
                              onClick={() => setPendingDeleteId(a._id)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </ZoruButton>
                          </ZoruTableCell>
                        </ZoruTableRow>
                      );
                    })
                  )}
                </ZoruTableBody>
              </ZoruTable>
            </div>
          </ZoruCard>
        </div>
      </EntityListShell>

      <ConfirmDialog
        open={!!pendingDeleteId}
        onOpenChange={(o) => !o && setPendingDeleteId(null)}
        title="Delete asset?"
        description="Deleting removes the asset from the active register. Assignment history remains in audit."
        confirmLabel={bulkPending ? 'Deleting…' : 'Delete'}
        onConfirm={handleSingleDelete}
      />

      <ConfirmDialog
        open={pendingBulk === 'retire'}
        onOpenChange={(o) => !o && setPendingBulk(null)}
        title={`Retire ${selected.size} assets?`}
        description="Retired assets are marked inactive and removed from the available pool."
        confirmTone="primary"
        confirmLabel="Retire"
        onConfirm={() => runBulk('retire')}
      />

      <ConfirmDialog
        open={pendingBulk === 'delete'}
        onOpenChange={(o) => !o && setPendingBulk(null)}
        title={`Delete ${selected.size} assets?`}
        description="This action cannot be undone."
        requireTyped="DELETE"
        confirmLabel="Delete all"
        onConfirm={() => runBulk('delete')}
      />
    </>
  );
}
