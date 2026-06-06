'use client';

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

import { Badge, Button, Card, DateRangePicker, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, StatCard, Table, TBody, Td, Th, THead, Tr, useToast } from '@/components/sabcrm/20ui/compat';

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

import { formatValue, formatValidity } from './utils';

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
  const { toast } = useToast();

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
        try {
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
        } catch (error) {
          console.error('Failed to export to Excel:', error);
          toast({
            title: 'Export failed',
            description: 'Could not load Excel export module.',
            variant: 'destructive',
          });
        }
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
                <SelectTrigger>
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s === 'all' ? 'All statuses' : s[0].toUpperCase() + s.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-64">
              <DateRangePicker
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
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Download className="h-4 w-4" /> Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => exportFile('csv')}>
                  <FileText className="h-4 w-4" /> CSV
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => exportFile('xlsx')}>
                  <FileSpreadsheet className="h-4 w-4" /> XLSX
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        }
        bulkBar={
          selected.size > 0 ? (
            <div className="flex flex-wrap items-center gap-2 text-sm text-[var(--st-text)]">
              <span className="font-medium">{selected.size} selected</span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    Set status
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => runBulk('status', 'active')}>
                    Active
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => runBulk('status', 'draft')}>
                    Draft
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => runBulk('status', 'expired')}>
                    Expired
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => runBulk('status', 'cancelled')}>
                    Cancelled
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Download className="h-4 w-4" /> Export selected
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => exportFile('csv')}>
                    <FileText className="h-4 w-4" /> CSV
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => exportFile('xlsx')}>
                    <FileSpreadsheet className="h-4 w-4" /> XLSX
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <DropdownMenuSeparator className="hidden" />
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
              <Tag className="h-8 w-8 text-[var(--st-text-secondary)]" />
              <h3 className="text-base font-medium text-[var(--st-text)]">No coupons yet</h3>
              <p className="max-w-sm text-sm text-[var(--st-text-secondary)]">
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
                <THead>
                  <Tr className="border-[var(--st-border)] hover:bg-transparent">
                    <Th className="w-10">
                      <input
                        type="checkbox"
                        aria-label="Select all"
                        checked={allSelected}
                        onChange={(e) => handleToggleAll(e.target.checked)}
                      />
                    </Th>
                    <Th className="text-[var(--st-text-secondary)]">Code</Th>
                    <Th className="text-[var(--st-text-secondary)]">Type</Th>
                    <Th className="text-[var(--st-text-secondary)]">Value</Th>
                    <Th className="text-[var(--st-text-secondary)]">Min cart</Th>
                    <Th className="text-[var(--st-text-secondary)]">Max uses</Th>
                    <Th className="text-[var(--st-text-secondary)]">Used</Th>
                    <Th className="text-[var(--st-text-secondary)]">Validity</Th>
                    <Th className="text-[var(--st-text-secondary)]">Status</Th>
                  </Tr>
                </THead>
                <TBody>
                  {rows.length === 0 ? (
                    <Tr className="border-[var(--st-border)]">
                      <Td
                        colSpan={9}
                        className="h-24 text-center text-[13px] text-[var(--st-text-secondary)]"
                      >
                        {isPending ? 'Loading…' : 'No coupons match these filters.'}
                      </Td>
                    </Tr>
                  ) : (
                    rows.map((c, idx) => {
                      const id = getId(c, idx);
                      const checked = selected.has(id);
                      return (
                        <Tr key={id} className="border-[var(--st-border)]">
                          <Td>
                            <input
                              type="checkbox"
                              aria-label={`Select ${c.code ?? id}`}
                              checked={checked}
                              onChange={() => handleToggleOne(id)}
                            />
                          </Td>
                          <Td className="text-[var(--st-text)]">
                            <EntityRowLink
                              href={`/dashboard/crm/sales/coupons/${id}`}
                              label={c.code || 'Untitled coupon'}
                            />
                          </Td>
                          <Td className="text-[var(--st-text)]">
                            {c.type || '—'}
                          </Td>
                          <Td className="text-[var(--st-text)]">
                            {formatValue(c.type, c.value)}
                          </Td>
                          <Td className="text-[var(--st-text)]">
                            {c.minCart?.toLocaleString() || '—'}
                          </Td>
                          <Td className="text-[var(--st-text)]">
                            {c.maxUses?.toLocaleString() || '—'}
                          </Td>
                          <Td className="text-[var(--st-text)]">
                            {c.usedCount?.toLocaleString() || '—'}
                          </Td>
                          <Td className="text-[var(--st-text)]">
                            {formatValidity(c.validFrom, c.validTo)}
                          </Td>
                          <Td>
                            <Badge variant={getStatusVariant(c.status)}>
                              {c.status || 'draft'}
                            </Badge>
                          </Td>
                        </Tr>
                      );
                    })
                  )}
                </TBody>
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
