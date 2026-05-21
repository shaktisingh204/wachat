'use client';

/**
 * Loyalty programs — Deep list page.
 *
 *   • KPI strip  (total members · points outstanding · top-tier members · redemption rate)
 *   • Filters row (status select · date range · clear)
 *   • Bulk action bar (delete · set status · export selected)
 *   • Programs table (EntityRowLink on the name cell)
 *   • Pagination via <PaginationBar />
 */

import * as React from 'react';
import Link from 'next/link';
import { useDebouncedCallback } from 'use-debounce';
import type { DateRange } from 'react-day-picker';
import {
  Award,
  Crown,
  Coins,
  Download,
  FileSpreadsheet,
  FileText,
  Plus,
  RefreshCcw,
  Users,
} from 'lucide-react';

import {
  ZoruBadge,
  ZoruButton,
  ZoruCard,
  ZoruDateRangePicker,
  ZoruDropdownMenu,
  ZoruDropdownMenuContent,
  ZoruDropdownMenuItem,
  ZoruDropdownMenuTrigger,
  ZoruSelect,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  ZoruStatCard,
  ZoruTable,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
  useZoruToast,
} from '@/components/zoruui';

import { ConfirmDialog } from '@/components/crm/confirm-dialog';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import { EntityRowLink } from '@/components/crm/entity-row-link';
import { PaginationBar } from '@/components/crm/pagination-bar';
import {
  bulkLoyaltyAction,
  getLoyaltyKpis,
  listLoyaltyPrograms,
  type CrmLoyaltyKpis,
  type CrmLoyaltyListFilters,
} from '@/app/actions/crm-loyalty.actions';

const PER_PAGE = 20;

const EMPTY_KPIS: CrmLoyaltyKpis = {
  totalMembers: 0,
  pointsOutstanding: 0,
  topTierMembers: 0,
  redemptionRate: 0,
};

const STATUS_OPTIONS = ['all', 'draft', 'active', 'paused', 'cancelled'] as const;
type StatusFilter = (typeof STATUS_OPTIONS)[number];

type AnyLoyaltyProgram = {
  _id?: { toString(): string } | string;
  name?: string;
  tiers?: unknown[];
  pointsPerCurrencyUnit?: number;
  redemptionRatio?: number;
  expiryDays?: number;
  status?: string;
  createdAt?: string | Date;
};

function getId(p: AnyLoyaltyProgram, idx: number): string {
  return typeof p._id === 'string'
    ? p._id
    : (p._id as { toString(): string } | undefined)?.toString?.() ?? String(idx);
}

function getStatusVariant(
  status?: string,
): 'success' | 'warning' | 'danger' | 'ghost' {
  const s = (status || '').toLowerCase();
  if (s === 'active') return 'success';
  if (s === 'draft' || s === 'pending') return 'ghost';
  if (s === 'cancelled' || s === 'voided') return 'danger';
  return 'warning';
}

function formatPointsRate(value: number | undefined | null): string {
  if (typeof value !== 'number' || Number.isNaN(value)) return '—';
  return value.toLocaleString();
}

function formatExpiryRule(days: number | undefined | null): string {
  if (typeof days !== 'number' || Number.isNaN(days)) return '—';
  if (days <= 0) return 'Never expires';
  return `${days.toLocaleString()} days`;
}

export default function SalesLoyaltyPage(): React.JSX.Element {
  const { toast } = useZoruToast();

  const [rows, setRows] = React.useState<AnyLoyaltyProgram[]>([]);
  const [total, setTotal] = React.useState(0);
  const [page, setPage] = React.useState(1);
  const [kpis, setKpis] = React.useState<CrmLoyaltyKpis>(EMPTY_KPIS);
  const [isPending, startTransition] = React.useTransition();

  const [search, setSearch] = React.useState('');
  const [searchInput, setSearchInput] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>('all');
  const [dateRange, setDateRange] = React.useState<DateRange | undefined>();

  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [deleteOpen, setDeleteOpen] = React.useState(false);

  const filters = React.useMemo<CrmLoyaltyListFilters>(() => {
    const f: CrmLoyaltyListFilters = {};
    if (statusFilter !== 'all') f.status = statusFilter;
    if (search) f.search = search;
    if (dateRange?.from) f.createdAfter = dateRange.from;
    if (dateRange?.to) f.createdBefore = dateRange.to;
    return f;
  }, [statusFilter, search, dateRange]);

  const fetchData = React.useCallback(() => {
    startTransition(async () => {
      const [list, kpiData] = await Promise.all([
        listLoyaltyPrograms(page, PER_PAGE, filters),
        getLoyaltyKpis(),
      ]);
      setRows(list.rows as AnyLoyaltyProgram[]);
      setTotal(list.total);
      setKpis(kpiData ?? EMPTY_KPIS);
    });
  }, [page, filters]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  const debouncedSearch = useDebouncedCallback((next: string) => {
    setSearch(next);
    setPage(1);
  }, 300);

  const handleSearchChange = React.useCallback(
    (v: string) => {
      setSearchInput(v);
      debouncedSearch(v);
    },
    [debouncedSearch],
  );

  const clearFilters = React.useCallback(() => {
    setStatusFilter('all');
    setDateRange(undefined);
    setSearch('');
    setSearchInput('');
    setPage(1);
  }, []);

  const hasActiveFilters =
    statusFilter !== 'all' ||
    !!search ||
    !!dateRange?.from ||
    !!dateRange?.to;

  const handleToggleOne = React.useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleToggleAll = React.useCallback(
    (all: boolean) => {
      setSelected(all ? new Set(rows.map((r, i) => getId(r, i))) : new Set());
    },
    [rows],
  );

  const runBulk = React.useCallback(
    async (op: 'delete' | 'status', payload?: string) => {
      if (selected.size === 0) return;
      const res = await bulkLoyaltyAction(Array.from(selected), op, payload);
      if (res.success) {
        toast({
          title: `${res.processed} program${res.processed === 1 ? '' : 's'} updated`,
        });
        setSelected(new Set());
        fetchData();
      } else {
        toast({
          title: 'Bulk action failed',
          description: res.error,
          variant: 'destructive',
        });
      }
    },
    [selected, fetchData, toast],
  );

  const handleConfirmDelete = React.useCallback(async () => {
    await runBulk('delete');
    setDeleteOpen(false);
  }, [runBulk]);

  const exportRows = React.useMemo(() => {
    if (selected.size === 0) return rows;
    return rows.filter((r, i) => selected.has(getId(r, i)));
  }, [rows, selected]);

  const exportFile = React.useCallback(
    async (format: 'csv' | 'xlsx') => {
      const header = [
        'Program',
        'Tiers',
        'Points / unit',
        'Redemption ratio',
        'Expiry rule',
        'Status',
        'Created At',
      ];
      const records = exportRows.map((p) => {
        const tiers = Array.isArray(p.tiers) ? p.tiers.length : 0;
        return {
          Program: p.name ?? '',
          Tiers: tiers,
          'Points / unit': p.pointsPerCurrencyUnit ?? '',
          'Redemption ratio': p.redemptionRatio ?? '',
          'Expiry rule': formatExpiryRule(p.expiryDays),
          Status: p.status ?? 'draft',
          'Created At': p.createdAt ? new Date(p.createdAt).toISOString() : '',
        };
      });

      const stamp = new Date().toISOString().slice(0, 10);
      if (format === 'csv') {
        const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
        const csv = [header.map(esc).join(','), ...records.map(r => header.map(h => esc(r[h])).join(','))].join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `loyalty-${stamp}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        const ExcelJS = (await import('exceljs')).default;
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Loyalty');
        worksheet.columns = header.map(h => ({ header: h, key: h, width: 15 }));
        records.forEach(r => worksheet.addRow(r));
        const out = await workbook.xlsx.writeBuffer();
        const blob = new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `loyalty-${stamp}.xlsx`;
        a.click();
        URL.revokeObjectURL(url);
      }
    },
    [exportRows],
  );

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));
  const allSelected = rows.length > 0 && rows.every((r, i) => selected.has(getId(r, i)));

  return (
    <>
      <EntityListShell
        title="Loyalty"
        subtitle="Reward repeat customers with tiered points programs and expiry rules."
        search={{
          value: searchInput,
          onChange: handleSearchChange,
          placeholder: 'Search by program name…',
        }}
        primaryAction={
          <ZoruButton asChild>
            <Link href="/dashboard/crm/sales/loyalty/new">
              <Plus className="h-4 w-4" /> New program
            </Link>
          </ZoruButton>
        }
        filters={
          <div className="flex flex-wrap items-center gap-2">
            <div className="w-40">
              <ZoruSelect
                value={statusFilter}
                onValueChange={(v) => {
                  setStatusFilter(v as StatusFilter);
                  setPage(1);
                }}
              >
                <ZoruSelectTrigger>
                  <ZoruSelectValue placeholder="Status" />
                </ZoruSelectTrigger>
                <ZoruSelectContent>
                  {STATUS_OPTIONS.map((s) => (
                    <ZoruSelectItem key={s} value={s}>
                      {s === 'all' ? 'All statuses' : s[0].toUpperCase() + s.slice(1)}
                    </ZoruSelectItem>
                  ))}
                </ZoruSelectContent>
              </ZoruSelect>
            </div>
            <div className="w-64">
              <ZoruDateRangePicker
                value={dateRange}
                onChange={(r) => {
                  setDateRange(r);
                  setPage(1);
                }}
                placeholder="Created between…"
              />
            </div>
            {hasActiveFilters ? (
              <ZoruButton variant="ghost" size="sm" onClick={clearFilters}>
                Clear filters
              </ZoruButton>
            ) : null}
            <ZoruDropdownMenu>
              <ZoruDropdownMenuTrigger asChild>
                <ZoruButton variant="outline" size="sm">
                  <Download className="h-4 w-4" /> Export
                </ZoruButton>
              </ZoruDropdownMenuTrigger>
              <ZoruDropdownMenuContent align="end">
                <ZoruDropdownMenuItem onClick={() => exportFile('csv')}>
                  <FileText className="h-4 w-4" /> CSV
                </ZoruDropdownMenuItem>
                <ZoruDropdownMenuItem onClick={() => exportFile('xlsx')}>
                  <FileSpreadsheet className="h-4 w-4" /> XLSX
                </ZoruDropdownMenuItem>
              </ZoruDropdownMenuContent>
            </ZoruDropdownMenu>
          </div>
        }
        bulkBar={
          selected.size > 0 ? (
            <div className="flex flex-wrap items-center gap-2 text-sm text-zoru-ink">
              <span className="font-medium">{selected.size} selected</span>
              <ZoruDropdownMenu>
                <ZoruDropdownMenuTrigger asChild>
                  <ZoruButton variant="outline" size="sm">
                    Set status
                  </ZoruButton>
                </ZoruDropdownMenuTrigger>
                <ZoruDropdownMenuContent>
                  <ZoruDropdownMenuItem onClick={() => runBulk('status', 'active')}>
                    Active
                  </ZoruDropdownMenuItem>
                  <ZoruDropdownMenuItem onClick={() => runBulk('status', 'paused')}>
                    Paused
                  </ZoruDropdownMenuItem>
                  <ZoruDropdownMenuItem onClick={() => runBulk('status', 'draft')}>
                    Draft
                  </ZoruDropdownMenuItem>
                  <ZoruDropdownMenuItem onClick={() => runBulk('status', 'cancelled')}>
                    Cancelled
                  </ZoruDropdownMenuItem>
                </ZoruDropdownMenuContent>
              </ZoruDropdownMenu>
              <ZoruDropdownMenu>
                <ZoruDropdownMenuTrigger asChild>
                  <ZoruButton variant="outline" size="sm">
                    <Download className="h-4 w-4" /> Export selected
                  </ZoruButton>
                </ZoruDropdownMenuTrigger>
                <ZoruDropdownMenuContent align="end">
                  <ZoruDropdownMenuItem onClick={() => exportFile('csv')}>
                    <FileText className="h-4 w-4" /> CSV
                  </ZoruDropdownMenuItem>
                  <ZoruDropdownMenuItem onClick={() => exportFile('xlsx')}>
                    <FileSpreadsheet className="h-4 w-4" /> XLSX
                  </ZoruDropdownMenuItem>
                </ZoruDropdownMenuContent>
              </ZoruDropdownMenu>
              <ZoruButton variant="destructive" size="sm" onClick={() => setDeleteOpen(true)}>
                Delete
              </ZoruButton>
              <ZoruButton variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
                Clear
              </ZoruButton>
            </div>
          ) : null
        }
        empty={
          !isPending && rows.length === 0 ? (
            <div className="flex flex-col items-center gap-3 p-4">
              <Award className="h-8 w-8 text-zoru-ink-muted" />
              <h3 className="text-base font-medium text-zoru-ink">No loyalty programs yet</h3>
              <p className="max-w-sm text-sm text-zoru-ink-muted">
                Launch your first program to reward repeat customers.
              </p>
              <ZoruButton asChild>
                <Link href="/dashboard/crm/sales/loyalty/new">
                  <Plus className="h-4 w-4" /> New program
                </Link>
              </ZoruButton>
            </div>
          ) : null
        }
        loading={isPending && rows.length === 0}
        pagination={
          rows.length > 0 ? (
            <PaginationBar
              page={page}
              limit={PER_PAGE}
              hasMore={page < totalPages}
              total={total}
              controlled={{ onChange: (next) => setPage(next.page) }}
            />
          ) : null
        }
      >
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <ZoruStatCard
              label="Total members"
              value={kpis.totalMembers.toLocaleString()}
              icon={<Users />}
            />
            <ZoruStatCard
              label="Points outstanding"
              value={kpis.pointsOutstanding.toLocaleString()}
              icon={<Coins />}
            />
            <ZoruStatCard
              label="Top-tier members"
              value={kpis.topTierMembers.toLocaleString()}
              icon={<Crown />}
            />
            <ZoruStatCard
              label="Redemption rate"
              value={`${kpis.redemptionRate.toLocaleString()}%`}
              icon={<RefreshCcw />}
            />
          </div>

          <ZoruCard className="p-0">
            <div className="overflow-x-auto rounded-lg">
              <ZoruTable>
                <ZoruTableHeader>
                  <ZoruTableRow className="border-zoru-line hover:bg-transparent">
                    <ZoruTableHead className="w-10">
                      <input
                        type="checkbox"
                        aria-label="Select all"
                        checked={allSelected}
                        onChange={(e) => handleToggleAll(e.target.checked)}
                      />
                    </ZoruTableHead>
                    <ZoruTableHead className="text-zoru-ink-muted">Program name</ZoruTableHead>
                    <ZoruTableHead className="text-zoru-ink-muted">Tiers</ZoruTableHead>
                    <ZoruTableHead className="text-zoru-ink-muted">Points/unit</ZoruTableHead>
                    <ZoruTableHead className="text-zoru-ink-muted">Expiry rule</ZoruTableHead>
                    <ZoruTableHead className="text-zoru-ink-muted">Status</ZoruTableHead>
                  </ZoruTableRow>
                </ZoruTableHeader>
                <ZoruTableBody>
                  {rows.length === 0 ? (
                    <ZoruTableRow className="border-zoru-line">
                      <ZoruTableCell
                        colSpan={6}
                        className="h-24 text-center text-[13px] text-zoru-ink-muted"
                      >
                        {isPending ? 'Loading…' : 'No loyalty programs match these filters.'}
                      </ZoruTableCell>
                    </ZoruTableRow>
                  ) : (
                    rows.map((p, idx) => {
                      const id = getId(p, idx);
                      const checked = selected.has(id);
                      const tiers = Array.isArray(p.tiers) ? p.tiers.length : 0;
                      return (
                        <ZoruTableRow key={id} className="border-zoru-line">
                          <ZoruTableCell>
                            <input
                              type="checkbox"
                              aria-label={`Select ${p.name ?? id}`}
                              checked={checked}
                              onChange={() => handleToggleOne(id)}
                            />
                          </ZoruTableCell>
                          <ZoruTableCell className="text-zoru-ink">
                            <EntityRowLink
                              href={`/dashboard/crm/sales/loyalty/${id}`}
                              label={p.name || 'Untitled program'}
                              subtitle={tiers ? `${tiers} tier${tiers === 1 ? '' : 's'}` : undefined}
                            />
                          </ZoruTableCell>
                          <ZoruTableCell className="text-zoru-ink">{tiers}</ZoruTableCell>
                          <ZoruTableCell className="text-zoru-ink">
                            {formatPointsRate(p.pointsPerCurrencyUnit)}
                          </ZoruTableCell>
                          <ZoruTableCell className="text-zoru-ink">
                            {formatExpiryRule(p.expiryDays)}
                          </ZoruTableCell>
                          <ZoruTableCell>
                            <ZoruBadge variant={getStatusVariant(p.status)}>
                              {p.status || 'draft'}
                            </ZoruBadge>
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
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={`Delete ${selected.size} program${selected.size === 1 ? '' : 's'}?`}
        description="This permanently removes the selected loyalty programs. This action cannot be undone."
        requireTyped="DELETE"
        confirmLabel="Delete"
        onConfirm={handleConfirmDelete}
      />
    </>
  );
}
