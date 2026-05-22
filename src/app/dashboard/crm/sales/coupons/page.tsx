'use client';

export const dynamic = 'force-dynamic';

/**
 * Coupons — Deep list page.
 *
 * Composition (per the all-leads reference):
 *   • <EntityListShell />
 *     – KPI strip  (total · active · expired · total redemptions)
 *     – Filters row (status select · date range · clear)
 *     – Bulk action bar (delete · set status · export selected)
 *     – Coupons table (EntityRowLink on the code cell)
 *     – Pagination via <PaginationBar />
 */

import * as React from 'react';
import Link from 'next/link';
import { useDebouncedCallback } from 'use-debounce';
import type { DateRange } from 'react-day-picker';
import { CheckCircle2, Download, FileSpreadsheet, FileText, Plus, Tag, Timer, XCircle } from 'lucide-react';

import {
  Badge,
  Button,
  Card,
  ZoruDateRangePicker,
  DropdownMenu,
  ZoruDropdownMenuContent,
  ZoruDropdownMenuItem,
  ZoruDropdownMenuSeparator,
  ZoruDropdownMenuTrigger,
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

import { ConfirmDialog } from '@/components/crm/confirm-dialog';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import { EntityRowLink } from '@/components/crm/entity-row-link';
import { PaginationBar } from '@/components/crm/pagination-bar';
import {
  bulkCouponAction,
  getCouponKpis,
  listCoupons,
  type CrmCouponKpis,
  type CrmCouponListFilters,
} from '@/app/actions/crm-coupons.actions';

const PER_PAGE = 20;

const EMPTY_KPIS: CrmCouponKpis = { total: 0, active: 0, expired: 0, totalRedemptions: 0 };

const STATUS_OPTIONS = ['all', 'draft', 'active', 'expired', 'cancelled'] as const;
type StatusFilter = (typeof STATUS_OPTIONS)[number];

type AnyCoupon = {
  _id?: { toString(): string } | string;
  code?: string;
  type?: string;
  value?: number;
  minCart?: number;
  maxUses?: number;
  usedCount?: number;
  validFrom?: string | Date;
  validTo?: string | Date;
  status?: string;
  createdAt?: string | Date;
};

function getId(c: AnyCoupon, idx: number): string {
  return typeof c._id === 'string'
    ? c._id
    : (c._id as { toString(): string } | undefined)?.toString?.() ?? String(idx);
}

function formatDate(value: string | Date | undefined | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString();
}

function formatNumber(value: number | undefined | null): string {
  if (typeof value !== 'number' || Number.isNaN(value)) return '—';
  return value.toLocaleString();
}

function formatValue(type: string | undefined, value: number | undefined): string {
  if (typeof value !== 'number' || Number.isNaN(value)) return '—';
  const t = (type || '').toLowerCase();
  if (t === 'percent' || t === 'percentage') return `${value}%`;
  return value.toLocaleString();
}

function formatValidity(
  from: string | Date | undefined,
  to: string | Date | undefined,
): string {
  const f = formatDate(from);
  const t = formatDate(to);
  if (f === '—' && t === '—') return '—';
  return `${f} → ${t}`;
}

function getStatusVariant(
  status?: string,
): 'success' | 'warning' | 'danger' | 'ghost' {
  const s = (status || '').toLowerCase();
  if (s === 'active' || s === 'redeemed') return 'success';
  if (s === 'draft' || s === 'pending' || s === 'issued') return 'ghost';
  if (s === 'expired' || s === 'cancelled' || s === 'voided') return 'danger';
  return 'warning';
}

export default function SalesCouponsPage(): React.JSX.Element {
  const { toast } = useZoruToast();

  const [rows, setRows] = React.useState<AnyCoupon[]>([]);
  const [total, setTotal] = React.useState(0);
  const [page, setPage] = React.useState(1);
  const [kpis, setKpis] = React.useState<CrmCouponKpis>(EMPTY_KPIS);
  const [isPending, startTransition] = React.useTransition();

  const [search, setSearch] = React.useState('');
  const [searchInput, setSearchInput] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>('all');
  const [dateRange, setDateRange] = React.useState<DateRange | undefined>();

  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [deleteOpen, setDeleteOpen] = React.useState(false);

  const filters = React.useMemo<CrmCouponListFilters>(() => {
    const f: CrmCouponListFilters = {};
    if (statusFilter !== 'all') f.status = statusFilter;
    if (search) f.search = search;
    if (dateRange?.from) f.createdAfter = dateRange.from;
    if (dateRange?.to) f.createdBefore = dateRange.to;
    return f;
  }, [statusFilter, search, dateRange]);

  const fetchData = React.useCallback(() => {
    startTransition(async () => {
      const [list, kpiData] = await Promise.all([
        listCoupons(page, PER_PAGE, filters),
        getCouponKpis(),
      ]);
      setRows(list.rows as AnyCoupon[]);
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
      const res = await bulkCouponAction(Array.from(selected), op, payload);
      if (res.success) {
        toast({
          title: `${res.processed} coupon${res.processed === 1 ? '' : 's'} updated`,
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
        'Code',
        'Type',
        'Value',
        'Min Cart',
        'Max Uses',
        'Used',
        'Valid From',
        'Valid To',
        'Status',
        'Created At',
      ];
      const records = exportRows.map((c) => ({
        Code: c.code ?? '',
        Type: c.type ?? '',
        Value: formatValue(c.type, c.value),
        'Min Cart': c.minCart ?? '',
        'Max Uses': c.maxUses ?? '',
        Used: c.usedCount ?? 0,
        'Valid From': c.validFrom ? new Date(c.validFrom).toISOString() : '',
        'Valid To': c.validTo ? new Date(c.validTo).toISOString() : '',
        Status: c.status ?? 'draft',
        'Created At': c.createdAt ? new Date(c.createdAt).toISOString() : '',
      }));

      const stamp = new Date().toISOString().slice(0, 10);
      if (format === 'csv') {
        const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
        const csv = [header.map(esc).join(','), ...records.map(r => header.map(h => esc(r[h])).join(','))].join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `coupons-${stamp}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        const ExcelJS = (await import('exceljs')).default;
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Coupons');
        worksheet.columns = header.map(h => ({ header: h, key: h, width: 15 }));
        records.forEach(r => worksheet.addRow(r));
        const out = await workbook.xlsx.writeBuffer();
        const blob = new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `coupons-${stamp}.xlsx`;
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
        title="Coupons"
        subtitle="Create and track promo codes, BOGO offers and free-shipping vouchers."
        search={{
          value: searchInput,
          onChange: handleSearchChange,
          placeholder: 'Search by coupon code…',
        }}
        primaryAction={
          <Button asChild>
            <Link href="/dashboard/crm/sales/coupons/new">
              <Plus className="h-4 w-4" /> New coupon
            </Link>
          </Button>
        }
        filters={
          <div className="flex flex-wrap items-center gap-2">
            <div className="w-40">
              <Select
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
              </Select>
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
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                Clear filters
              </Button>
            ) : null}
            <DropdownMenu>
              <ZoruDropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Download className="h-4 w-4" /> Export
                </Button>
              </ZoruDropdownMenuTrigger>
              <ZoruDropdownMenuContent align="end">
                <ZoruDropdownMenuItem onClick={() => exportFile('csv')}>
                  <FileText className="h-4 w-4" /> CSV
                </ZoruDropdownMenuItem>
                <ZoruDropdownMenuItem onClick={() => exportFile('xlsx')}>
                  <FileSpreadsheet className="h-4 w-4" /> XLSX
                </ZoruDropdownMenuItem>
              </ZoruDropdownMenuContent>
            </DropdownMenu>
          </div>
        }
        bulkBar={
          selected.size > 0 ? (
            <div className="flex flex-wrap items-center gap-2 text-sm text-zoru-ink">
              <span className="font-medium">{selected.size} selected</span>
              <DropdownMenu>
                <ZoruDropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    Set status
                  </Button>
                </ZoruDropdownMenuTrigger>
                <ZoruDropdownMenuContent>
                  <ZoruDropdownMenuItem onClick={() => runBulk('status', 'active')}>
                    Active
                  </ZoruDropdownMenuItem>
                  <ZoruDropdownMenuItem onClick={() => runBulk('status', 'draft')}>
                    Draft
                  </ZoruDropdownMenuItem>
                  <ZoruDropdownMenuItem onClick={() => runBulk('status', 'expired')}>
                    Expired
                  </ZoruDropdownMenuItem>
                  <ZoruDropdownMenuItem onClick={() => runBulk('status', 'cancelled')}>
                    Cancelled
                  </ZoruDropdownMenuItem>
                </ZoruDropdownMenuContent>
              </DropdownMenu>
              <DropdownMenu>
                <ZoruDropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Download className="h-4 w-4" /> Export selected
                  </Button>
                </ZoruDropdownMenuTrigger>
                <ZoruDropdownMenuContent align="end">
                  <ZoruDropdownMenuItem onClick={() => exportFile('csv')}>
                    <FileText className="h-4 w-4" /> CSV
                  </ZoruDropdownMenuItem>
                  <ZoruDropdownMenuItem onClick={() => exportFile('xlsx')}>
                    <FileSpreadsheet className="h-4 w-4" /> XLSX
                  </ZoruDropdownMenuItem>
                </ZoruDropdownMenuContent>
              </DropdownMenu>
              <ZoruDropdownMenuSeparator className="hidden" />
              <Button variant="destructive" size="sm" onClick={() => setDeleteOpen(true)}>
                Delete
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
                Clear
              </Button>
            </div>
          ) : null
        }
        empty={
          !isPending && rows.length === 0 ? (
            <div className="flex flex-col items-center gap-3 p-4">
              <Tag className="h-8 w-8 text-zoru-ink-muted" />
              <h3 className="text-base font-medium text-zoru-ink">No coupons yet</h3>
              <p className="max-w-sm text-sm text-zoru-ink-muted">
                Create your first promo code to start running campaigns.
              </p>
              <Button asChild>
                <Link href="/dashboard/crm/sales/coupons/new">
                  <Plus className="h-4 w-4" /> New coupon
                </Link>
              </Button>
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
          {/* KPI strip */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatCard label="Total coupons" value={kpis.total.toLocaleString()} icon={<Tag />} />
            <StatCard
              label="Active"
              value={kpis.active.toLocaleString()}
              icon={<CheckCircle2 />}
            />
            <StatCard
              label="Expired"
              value={kpis.expired.toLocaleString()}
              icon={<XCircle />}
            />
            <StatCard
              label="Total redemptions"
              value={kpis.totalRedemptions.toLocaleString()}
              icon={<Timer />}
            />
          </div>

          <Card className="p-0">
            <div className="overflow-x-auto rounded-lg">
              <Table>
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
                    <ZoruTableHead className="text-zoru-ink-muted">Code</ZoruTableHead>
                    <ZoruTableHead className="text-zoru-ink-muted">Type</ZoruTableHead>
                    <ZoruTableHead className="text-zoru-ink-muted">Value</ZoruTableHead>
                    <ZoruTableHead className="text-zoru-ink-muted">Min cart</ZoruTableHead>
                    <ZoruTableHead className="text-zoru-ink-muted">Max uses</ZoruTableHead>
                    <ZoruTableHead className="text-zoru-ink-muted">Used</ZoruTableHead>
                    <ZoruTableHead className="text-zoru-ink-muted">Validity</ZoruTableHead>
                    <ZoruTableHead className="text-zoru-ink-muted">Status</ZoruTableHead>
                  </ZoruTableRow>
                </ZoruTableHeader>
                <ZoruTableBody>
                  {rows.length === 0 ? (
                    <ZoruTableRow className="border-zoru-line">
                      <ZoruTableCell
                        colSpan={9}
                        className="h-24 text-center text-[13px] text-zoru-ink-muted"
                      >
                        {isPending ? 'Loading…' : 'No coupons match these filters.'}
                      </ZoruTableCell>
                    </ZoruTableRow>
                  ) : (
                    rows.map((c, idx) => {
                      const id = getId(c, idx);
                      const checked = selected.has(id);
                      return (
                        <ZoruTableRow key={id} className="border-zoru-line">
                          <ZoruTableCell>
                            <input
                              type="checkbox"
                              aria-label={`Select ${c.code ?? id}`}
                              checked={checked}
                              onChange={() => handleToggleOne(id)}
                            />
                          </ZoruTableCell>
                          <ZoruTableCell className="text-zoru-ink">
                            <EntityRowLink
                              href={`/dashboard/crm/sales/coupons/${id}`}
                              label={c.code || 'Untitled coupon'}
                            />
                          </ZoruTableCell>
                          <ZoruTableCell className="text-zoru-ink">
                            {c.type || '—'}
                          </ZoruTableCell>
                          <ZoruTableCell className="text-zoru-ink">
                            {formatValue(c.type, c.value)}
                          </ZoruTableCell>
                          <ZoruTableCell className="text-zoru-ink">
                            {formatNumber(c.minCart)}
                          </ZoruTableCell>
                          <ZoruTableCell className="text-zoru-ink">
                            {formatNumber(c.maxUses)}
                          </ZoruTableCell>
                          <ZoruTableCell className="text-zoru-ink">
                            {formatNumber(c.usedCount)}
                          </ZoruTableCell>
                          <ZoruTableCell className="text-zoru-ink">
                            {formatValidity(c.validFrom, c.validTo)}
                          </ZoruTableCell>
                          <ZoruTableCell>
                            <Badge variant={getStatusVariant(c.status)}>
                              {c.status || 'draft'}
                            </Badge>
                          </ZoruTableCell>
                        </ZoruTableRow>
                      );
                    })
                  )}
                </ZoruTableBody>
              </Table>
            </div>
          </Card>
        </div>
      </EntityListShell>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={`Delete ${selected.size} coupon${selected.size === 1 ? '' : 's'}?`}
        description="This permanently removes the selected coupons. This action cannot be undone."
        requireTyped="DELETE"
        confirmLabel="Delete"
        onConfirm={handleConfirmDelete}
      />
    </>
  );
}
