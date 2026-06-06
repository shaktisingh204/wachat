'use client';

import {
  Badge,
  Button,
  Card,
  Checkbox,
  Input,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  Table,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
  useZoruToast,
} from '@/components/sabcrm/20ui/compat';
import {
  useRouter,
  useSearchParams,
  usePathname } from 'next/navigation';
import {
  AlertCircle,
  ListChecks,
  Pencil,
  Search,
  Trash2,
  X,
  } from 'lucide-react';

/**
 * Client side of the Fixed Assets list — owns the search box, the
 * table, the bulk action bar, the KPI strip, and the hard-delete
 * confirmation dialog. Search input is debounced and writes back to
 * the URL so the server component re-fetches.
 */

import * as React from 'react';
import Link from 'next/link';

import { PaginationBar } from '@/components/crm/pagination-bar';
import { EntityPickerChip } from '@/components/crm/entity-picker';
import { EntityRowLink } from '@/components/crm/entity-row-link';
import { deleteFixedAssetAction } from '@/app/actions/crm/fixed-assets.actions';
import type { CrmFixedAssetDoc } from '@/lib/rust-client/crm-fixed-assets';

import {
  FixedAssetsKpiStrip,
  computeFixedAssetKpis,
} from './fixed-assets-kpi-strip';
import {
  FixedAssetBulkDeleteDialog,
  FixedAssetSingleDeleteDialog,
} from './fixed-asset-list-dialogs';

interface FixedAssetListClientProps {
  assets: CrmFixedAssetDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
  initialQuery: string;
  error?: string;
}

function fmtMoney(value?: number, currency?: string): string {
  if (typeof value !== 'number') return '—';
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: currency || 'INR',
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${currency || 'INR'} ${value}`;
  }
}

function fmtDate(v?: string): string {
  if (!v) return '—';
  const d = new Date(v);
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

export function FixedAssetListClient({
  assets,
  page,
  limit,
  hasMore,
  initialQuery,
  error,
}: FixedAssetListClientProps) {
  const { toast } = useZoruToast();
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const [query, setQuery] = React.useState(initialQuery);
  const [statusFilter, setStatusFilter] = React.useState<
    'all' | 'active' | 'retired'
  >('all');
  const [categoryFilter, setCategoryFilter] = React.useState<'all' | string>(
    'all',
  );
  const [custodianFilter, setCustodianFilter] = React.useState<'all' | string>(
    'all',
  );
  const [locationFilter, setLocationFilter] = React.useState<'all' | string>(
    'all',
  );
  const [purchaseFrom, setPurchaseFrom] = React.useState('');
  const [purchaseTo, setPurchaseTo] = React.useState('');

  const [pendingDelete, setPendingDelete] = React.useState<CrmFixedAssetDoc | null>(
    null,
  );
  const [deleting, startDelete] = React.useTransition();

  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [bulkDeleting, startBulkDelete] = React.useTransition();
  const [bulkConfirmOpen, setBulkConfirmOpen] = React.useState(false);

  // Debounce search → URL.
  React.useEffect(() => {
    if (query === initialQuery) return;
    const t = setTimeout(() => {
      const params = new URLSearchParams(sp?.toString() ?? '');
      if (query.trim()) params.set('q', query.trim());
      else params.delete('q');
      params.set('page', '1');
      const qs = params.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname);
    }, 300);
    return () => clearTimeout(t);
  }, [query, initialQuery, sp, pathname, router]);

  const categoryOptions = React.useMemo(() => {
    const s = new Set<string>();
    for (const a of assets) if (a.category) s.add(a.category);
    return Array.from(s).sort();
  }, [assets]);

  const custodianOptions = React.useMemo(() => {
    const s = new Set<string>();
    for (const a of assets) if (a.custodianEmployeeId) s.add(a.custodianEmployeeId);
    return Array.from(s);
  }, [assets]);

  const locationOptions = React.useMemo(() => {
    const s = new Set<string>();
    for (const a of assets) if (a.location) s.add(a.location);
    return Array.from(s).sort();
  }, [assets]);

  const kpis = React.useMemo(() => computeFixedAssetKpis(assets), [assets]);

  const filtered = React.useMemo(() => {
    const from = purchaseFrom ? new Date(purchaseFrom).getTime() : NaN;
    const to = purchaseTo ? new Date(purchaseTo).getTime() : NaN;
    return assets.filter((a) => {
      if (statusFilter === 'active' && a.archived === true) return false;
      if (statusFilter === 'retired' && a.archived !== true) return false;
      if (categoryFilter !== 'all' && a.category !== categoryFilter)
        return false;
      if (
        custodianFilter !== 'all' &&
        a.custodianEmployeeId !== custodianFilter
      )
        return false;
      if (locationFilter !== 'all' && a.location !== locationFilter)
        return false;
      if (Number.isFinite(from) || Number.isFinite(to)) {
        const t = a.purchaseDate ? new Date(a.purchaseDate).getTime() : NaN;
        if (!Number.isFinite(t)) return false;
        if (Number.isFinite(from) && t < from) return false;
        if (Number.isFinite(to) && t > to + 24 * 60 * 60 * 1000) return false;
      }
      return true;
    });
  }, [
    assets,
    statusFilter,
    categoryFilter,
    custodianFilter,
    locationFilter,
    purchaseFrom,
    purchaseTo,
  ]);

  const hasActiveFilters =
    !!query.trim() ||
    statusFilter !== 'all' ||
    categoryFilter !== 'all' ||
    custodianFilter !== 'all' ||
    locationFilter !== 'all' ||
    !!purchaseFrom ||
    !!purchaseTo;

  const clearFilters = () => {
    setQuery('');
    setStatusFilter('all');
    setCategoryFilter('all');
    setCustodianFilter('all');
    setLocationFilter('all');
    setPurchaseFrom('');
    setPurchaseTo('');
  };

  const confirmDelete = () => {
    if (!pendingDelete?._id) return;
    const id = String(pendingDelete._id);
    const name = pendingDelete.name || pendingDelete.code || 'Asset';
    startDelete(async () => {
      const res = await deleteFixedAssetAction(id);
      if (res.success) {
        toast({ title: 'Deleted', description: `${name} removed.` });
        setPendingDelete(null);
        router.refresh();
      } else {
        toast({ title: 'Delete failed', description: res.error, variant: 'destructive' });
      }
    });
  };

  const toggleOne = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleAll = (all: boolean) =>
    setSelected(
      all ? new Set(filtered.map((a) => String(a._id))) : new Set(),
    );

  const exportCsv = () => {
    const subset =
      selected.size > 0
        ? filtered.filter((a) => selected.has(String(a._id)))
        : filtered;
    const header = [
      'Code',
      'Name',
      'Category',
      'Purchase date',
      'Cost',
      'NBV',
      'Custodian',
      'Location',
      'Status',
    ];
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const csv = [
      header.join(','),
      ...subset.map((a) =>
        [
          esc(a.code),
          esc(a.name),
          esc(a.category),
          esc(a.purchaseDate),
          esc(a.cost),
          esc(a.netBookValue ?? ''),
          esc(a.custodianEmployeeId),
          esc(a.location),
          esc(a.archived ? 'retired' : 'active'),
        ].join(','),
      ),
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fixed-assets-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const runBulkDelete = () => {
    if (selected.size === 0) return;
    setBulkConfirmOpen(false);
    const ids = Array.from(selected);
    startBulkDelete(async () => {
      let ok = 0;
      let failed = 0;
      for (const id of ids) {
        const res = await deleteFixedAssetAction(id);
        if (res.success) ok += 1;
        else failed += 1;
      }
      toast({
        title:
          failed === 0
            ? `${ok} asset${ok === 1 ? '' : 's'} deleted`
            : `${ok} deleted · ${failed} failed`,
        variant: failed > 0 ? 'destructive' : undefined,
      });
      setSelected(new Set());
      router.refresh();
    });
  };

  const headChecked =
    filtered.length > 0 &&
    filtered.every((a) => selected.has(String(a._id)));

  return (
    <div className="flex flex-col gap-4">
      <FixedAssetsKpiStrip
        counts={kpis}
        active={statusFilter === 'all' ? 'all' : statusFilter}
        onPick={(k) => {
          if (k === 'all') setStatusFilter('all');
          else setStatusFilter(k);
        }}
      />

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--st-text-secondary)]" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by code, name, location…"
            className="h-9 pl-9 text-[13px]"
          />
        </div>
        <Select
          value={statusFilter}
          onValueChange={(v) =>
            setStatusFilter(v as 'all' | 'active' | 'retired')
          }
        >
          <ZoruSelectTrigger className="h-9 w-[140px] text-[13px]">
            <ZoruSelectValue placeholder="Status" />
          </ZoruSelectTrigger>
          <ZoruSelectContent>
            <ZoruSelectItem value="all">All statuses</ZoruSelectItem>
            <ZoruSelectItem value="active">Active</ZoruSelectItem>
            <ZoruSelectItem value="retired">Retired</ZoruSelectItem>
          </ZoruSelectContent>
        </Select>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <ZoruSelectTrigger className="h-9 w-[160px] text-[13px]">
            <ZoruSelectValue placeholder="Category" />
          </ZoruSelectTrigger>
          <ZoruSelectContent>
            <ZoruSelectItem value="all">All categories</ZoruSelectItem>
            {categoryOptions.map((c) => (
              <ZoruSelectItem key={c} value={c}>
                {c}
              </ZoruSelectItem>
            ))}
          </ZoruSelectContent>
        </Select>
        <Select value={custodianFilter} onValueChange={setCustodianFilter}>
          <ZoruSelectTrigger className="h-9 w-[180px] text-[13px]">
            <ZoruSelectValue placeholder="Custodian" />
          </ZoruSelectTrigger>
          <ZoruSelectContent>
            <ZoruSelectItem value="all">All custodians</ZoruSelectItem>
            {custodianOptions.map((c) => (
              <ZoruSelectItem key={c} value={c}>
                {c.slice(-6)}
              </ZoruSelectItem>
            ))}
          </ZoruSelectContent>
        </Select>
        <Select value={locationFilter} onValueChange={setLocationFilter}>
          <ZoruSelectTrigger className="h-9 w-[160px] text-[13px]">
            <ZoruSelectValue placeholder="Location" />
          </ZoruSelectTrigger>
          <ZoruSelectContent>
            <ZoruSelectItem value="all">All locations</ZoruSelectItem>
            {locationOptions.map((l) => (
              <ZoruSelectItem key={l} value={l}>
                {l}
              </ZoruSelectItem>
            ))}
          </ZoruSelectContent>
        </Select>
        <Input
          type="date"
          value={purchaseFrom}
          onChange={(e) => setPurchaseFrom(e.target.value)}
          className="h-9 w-[150px] text-[13px]"
          aria-label="Purchase from"
        />
        <Input
          type="date"
          value={purchaseTo}
          onChange={(e) => setPurchaseTo(e.target.value)}
          className="h-9 w-[150px] text-[13px]"
          aria-label="Purchase to"
        />
        {hasActiveFilters ? (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            <X className="h-3.5 w-3.5" /> Clear
          </Button>
        ) : null}
      </div>

      {selected.size > 0 ? (
        <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-2 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-3 py-2 shadow-[var(--st-shadow-sm)]">
          <div className="flex items-center gap-2 text-[12.5px] text-[var(--st-text)]">
            <ListChecks className="h-4 w-4 text-[var(--st-text)]" />
            {selected.size} selected
          </div>
          <div className="flex items-center gap-1">
            <Button size="sm" variant="outline" onClick={exportCsv}>
              Export CSV
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => setBulkConfirmOpen(true)}
              disabled={bulkDeleting}
            >
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setSelected(new Set())}
              aria-label="Clear selection"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      ) : null}

      <Card className="overflow-hidden p-0">
        {error ? (
          <div className="flex items-center gap-2 border-b border-[var(--st-border)]/40 bg-[var(--st-text)]/10 px-4 py-2.5 text-[13px] text-[var(--st-text)]">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        ) : null}

        <Table>
          <ZoruTableHeader>
            <ZoruTableRow>
              <ZoruTableHead className="w-8">
                <Checkbox
                  checked={headChecked}
                  onCheckedChange={(c) => toggleAll(Boolean(c))}
                  aria-label="Select all"
                />
              </ZoruTableHead>
              <ZoruTableHead>Code / Name</ZoruTableHead>
              <ZoruTableHead>Category</ZoruTableHead>
              <ZoruTableHead>Vendor</ZoruTableHead>
              <ZoruTableHead>Custodian</ZoruTableHead>
              <ZoruTableHead>Location</ZoruTableHead>
              <ZoruTableHead>Condition</ZoruTableHead>
              <ZoruTableHead>Cost</ZoruTableHead>
              <ZoruTableHead>Net Book Value</ZoruTableHead>
              <ZoruTableHead>Purchase Date</ZoruTableHead>
              <ZoruTableHead className="text-right">Actions</ZoruTableHead>
            </ZoruTableRow>
          </ZoruTableHeader>
          <ZoruTableBody>
            {filtered.length === 0 ? (
              <ZoruTableRow>
                <ZoruTableCell
                  colSpan={11}
                  className="h-24 text-center text-[13px] text-[var(--st-text-secondary)]"
                >
                  {initialQuery || hasActiveFilters
                    ? 'No fixed assets match these filters.'
                    : 'No fixed assets yet — click "New fixed asset" to add one.'}
                </ZoruTableCell>
              </ZoruTableRow>
            ) : (
              filtered.map((asset) => {
                const id = String(asset._id);
                const checked = selected.has(id);
                return (
                  <ZoruTableRow key={id}>
                    <ZoruTableCell>
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() => toggleOne(id)}
                        aria-label={`Select asset ${asset.code}`}
                      />
                    </ZoruTableCell>
                    <ZoruTableCell>
                      <EntityRowLink
                        href={`/dashboard/crm/fixed-assets/${id}`}
                        label={asset.code}
                        subtitle={asset.name || undefined}
                      />
                    </ZoruTableCell>
                    <ZoruTableCell className="text-[12.5px] text-[var(--st-text-secondary)]">
                      {asset.category || '—'}
                    </ZoruTableCell>
                    <ZoruTableCell className="text-[12.5px] text-[var(--st-text-secondary)]">
                      {asset.supplierId ? (
                        <EntityPickerChip entity="vendor" id={asset.supplierId} />
                      ) : (
                        '—'
                      )}
                    </ZoruTableCell>
                    <ZoruTableCell className="text-[12.5px] text-[var(--st-text-secondary)]">
                      {asset.custodianEmployeeId ? (
                        <EntityPickerChip
                          entity="employee"
                          id={asset.custodianEmployeeId}
                        />
                      ) : (
                        '—'
                      )}
                    </ZoruTableCell>
                    <ZoruTableCell className="text-[12.5px] text-[var(--st-text-secondary)]">
                      {asset.location || '—'}
                    </ZoruTableCell>
                    <ZoruTableCell>
                      {asset.condition ? (
                        <Badge variant="outline">{asset.condition}</Badge>
                      ) : (
                        <span className="text-[12.5px] text-[var(--st-text-secondary)]">—</span>
                      )}
                    </ZoruTableCell>
                    <ZoruTableCell className="text-[12.5px] tabular-nums text-[var(--st-text)]">
                      {fmtMoney(asset.cost, asset.currency)}
                    </ZoruTableCell>
                    <ZoruTableCell className="text-[12.5px] tabular-nums text-[var(--st-text)]">
                      {fmtMoney(asset.netBookValue, asset.currency)}
                    </ZoruTableCell>
                    <ZoruTableCell className="text-[12.5px] text-[var(--st-text-secondary)]">
                      {fmtDate(asset.purchaseDate)}
                    </ZoruTableCell>
                    <ZoruTableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="ghost" asChild>
                          <Link href={`/dashboard/crm/fixed-assets/${id}/edit`}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Link>
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setPendingDelete(asset)}
                          className="text-[var(--st-danger)]"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </ZoruTableCell>
                  </ZoruTableRow>
                );
              })
            )}
          </ZoruTableBody>
        </Table>

        <PaginationBar page={page} limit={limit} hasMore={hasMore} />
      </Card>

      <FixedAssetSingleDeleteDialog
        open={pendingDelete !== null}
        onOpenChange={(o) => !o && setPendingDelete(null)}
        label={pendingDelete ? pendingDelete.name || pendingDelete.code : ''}
        busy={deleting}
        onConfirm={confirmDelete}
      />

      <FixedAssetBulkDeleteDialog
        open={bulkConfirmOpen}
        onOpenChange={setBulkConfirmOpen}
        count={selected.size}
        busy={bulkDeleting}
        onConfirm={runBulkDelete}
      />
    </div>
  );
}
