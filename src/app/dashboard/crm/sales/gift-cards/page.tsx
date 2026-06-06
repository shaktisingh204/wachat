'use client';

/**
 * Gift cards — Deep list page.
 *
 *   • KPI strip  (total issued · active · redeemed value · expiring soon)
 *   • Filters row (status select · date range · clear)
 *   • Bulk action bar (delete · set status · export selected)
 *   • Gift cards table (EntityRowLink on the code cell)
 *   • Pagination via <PaginationBar />
 */

import * as React from 'react';
import Link from 'next/link';
import { useDebouncedCallback } from 'use-debounce';
import type { DateRange } from 'react-day-picker';
import {
  CalendarClock,
  CheckCircle2,
  CreditCard,
  Download,
  FileSpreadsheet,
  FileText,
  Gift,
  Plus,
} from 'lucide-react';

import {
  Badge,
  Button,
  Card,
  ZoruDateRangePicker,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  StatCard,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  useZoruToast,
} from '@/components/sabcrm/20ui/compat';

import { ConfirmDialog } from '@/components/crm/confirm-dialog';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import { EntityRowLink } from '@/components/crm/entity-row-link';
import { PaginationBar } from '@/components/crm/pagination-bar';
import {
  bulkGiftCardAction,
  getGiftCardKpis,
  listGiftCards,
  type CrmGiftCardKpis,
  type CrmGiftCardListFilters,
} from '@/app/actions/crm-gift-cards.actions';

const PER_PAGE = 20;

const EMPTY_KPIS: CrmGiftCardKpis = {
  totalIssued: 0,
  active: 0,
  redeemedValue: 0,
  expiringSoon: 0,
};

const STATUS_OPTIONS = ['all', 'draft', 'active', 'redeemed', 'expired', 'cancelled'] as const;
type StatusFilter = (typeof STATUS_OPTIONS)[number];

type AnyGiftCard = {
  _id?: { toString(): string } | string;
  code?: string;
  issuedTo?: string;
  issuedToEmail?: string;
  issuedToId?: { toString(): string } | string;
  issuedToName?: string;
  value?: number;
  balance?: number;
  expiryDate?: string | Date;
  transferable?: boolean;
  status?: string;
  createdAt?: string | Date;
};

import { fmtDate, fmtINR } from '@/lib/utils';

function getId(c: AnyGiftCard, idx: number): string {
  return typeof c._id === 'string'
    ? c._id
    : (c._id as { toString(): string } | undefined)?.toString?.() ?? String(idx);
}

function resolveIssuedTo(card: AnyGiftCard): string {
  if (!card) return '—';
  if (card.issuedToName) return card.issuedToName;
  
  if (card.issuedTo) {
    if (typeof card.issuedTo === 'string') {
      return card.issuedTo;
    }
    if (typeof card.issuedTo === 'object') {
       if ('name' in card.issuedTo && typeof (card.issuedTo as any).name === 'string') {
           return (card.issuedTo as any).name;
       }
       if ('displayName' in card.issuedTo && typeof (card.issuedTo as any).displayName === 'string') {
           return (card.issuedTo as any).displayName;
       }
       if ('firstName' in card.issuedTo && typeof (card.issuedTo as any).firstName === 'string') {
           const first = (card.issuedTo as any).firstName;
           const last = (card.issuedTo as any).lastName || '';
           return `${first} ${last}`.trim();
       }
       if ('_id' in card.issuedTo) {
           return `Client ${(card.issuedTo as any)._id.toString().slice(-6)}`;
       }
       if (typeof (card.issuedTo as any).toString === 'function' && (card.issuedTo as any).toString() !== '[object Object]') {
           return (card.issuedTo as any).toString();
       }
    }
  }

  if (card.issuedToId) {
    if (typeof card.issuedToId === 'string') return card.issuedToId;
    if (typeof card.issuedToId === 'object' && '_id' in card.issuedToId) {
        return (card.issuedToId as any)._id.toString();
    }
    if (typeof (card.issuedToId as any).toString === 'function') {
        return (card.issuedToId as any).toString();
    }
  }
  
  return '—';
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

export default function SalesGiftCardsPage(): React.JSX.Element {
  const { toast } = useZoruToast();

  const [rows, setRows] = React.useState<AnyGiftCard[]>([]);
  const [total, setTotal] = React.useState(0);
  const [page, setPage] = React.useState(1);
  const [kpis, setKpis] = React.useState<CrmGiftCardKpis>(EMPTY_KPIS);
  const [isPending, startTransition] = React.useTransition();

  const [search, setSearch] = React.useState('');
  const [searchInput, setSearchInput] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>('all');
  const [dateRange, setDateRange] = React.useState<DateRange | undefined>();

  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [deleteOpen, setDeleteOpen] = React.useState(false);

  const filters = React.useMemo<CrmGiftCardListFilters>(() => {
    const f: CrmGiftCardListFilters = {};
    if (statusFilter !== 'all') f.status = statusFilter;
    if (search) f.search = search;
    if (dateRange?.from) f.createdAfter = dateRange.from;
    if (dateRange?.to) f.createdBefore = dateRange.to;
    return f;
  }, [statusFilter, search, dateRange]);

  const fetchData = React.useCallback(() => {
    startTransition(async () => {
      const [list, kpiData] = await Promise.all([
        listGiftCards(page, PER_PAGE, filters),
        getGiftCardKpis(),
      ]);
      setRows(list.rows as AnyGiftCard[]);
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
      const res = await bulkGiftCardAction(Array.from(selected), op, payload);
      if (res.success) {
        toast({
          title: `${res.processed} gift card${res.processed === 1 ? '' : 's'} updated`,
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
        'Issued To',
        'Email',
        'Value',
        'Balance',
        'Expiry',
        'Transferable',
        'Status',
        'Created At',
      ];
      const records = exportRows.map((c) => ({
        Code: c.code ?? '',
        'Issued To': resolveIssuedTo(c),
        Email: c.issuedToEmail ?? '',
        Value: c.value ?? '',
        Balance: c.balance ?? '',
        Expiry: c.expiryDate ? new Date(c.expiryDate).toISOString() : '',
        Transferable: c.transferable === true ? 'Yes' : c.transferable === false ? 'No' : '',
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
        a.download = `gift-cards-${stamp}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        try {
          let ExcelJS: any = await import('exceljs');
          if (ExcelJS.default) ExcelJS = ExcelJS.default;
          const workbook = new ExcelJS.Workbook();
          const worksheet = workbook.addWorksheet('Gift cards');
          worksheet.columns = header.map(h => ({ header: h, key: h, width: 15 }));
          records.forEach(r => worksheet.addRow(r));
          const out = await workbook.xlsx.writeBuffer();
          const blob = new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `gift-cards-${stamp}.xlsx`;
          a.click();
          URL.revokeObjectURL(url);
        } catch (err) {
          console.error('Failed to export to XLSX:', err);
          // Fallback or ignore
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
        title="Gift cards"
        subtitle="Issue, track and redeem gift cards with balance and expiry controls."
        search={{
          value: searchInput,
          onChange: handleSearchChange,
          placeholder: 'Search by code, recipient or email…',
        }}
        primaryAction={
          <Button asChild>
            <Link href="/dashboard/crm/sales/gift-cards/new">
              <Plus className="h-4 w-4" /> New gift card
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
              <ZoruDateRangePicker
                value={dateRange}
                onChange={(r) => {
                  setDateRange(r);
                  setPage(1);
                }}
                placeholder="Issued between…"
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
                  <DropdownMenuItem onClick={() => runBulk('status', 'redeemed')}>
                    Redeemed
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
              <Gift className="h-8 w-8 text-[var(--st-text-secondary)]" />
              <h3 className="text-base font-medium text-[var(--st-text)]">No gift cards yet</h3>
              <p className="max-w-sm text-sm text-[var(--st-text-secondary)]">
                Issue your first gift card to start tracking balances and redemptions.
              </p>
              <Button asChild>
                <Link href="/dashboard/crm/sales/gift-cards/new">
                  <Plus className="h-4 w-4" /> New gift card
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
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatCard
              label="Total issued"
              value={kpis.totalIssued.toLocaleString()}
              icon={<Gift />}
            />
            <StatCard
              label="Active"
              value={kpis.active.toLocaleString()}
              icon={<CheckCircle2 />}
            />
            <StatCard
              label="Redeemed value"
              value={fmtINR(kpis.redeemedValue)}
              icon={<CreditCard />}
            />
            <StatCard
              label="Expiring (30d)"
              value={kpis.expiringSoon.toLocaleString()}
              icon={<CalendarClock />}
            />
          </div>

          <Card className="p-0">
            <div className="overflow-x-auto rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow className="border-[var(--st-border)] hover:bg-transparent">
                    <TableHead className="w-10">
                      <input
                        type="checkbox"
                        aria-label="Select all"
                        checked={allSelected}
                        onChange={(e) => handleToggleAll(e.target.checked)}
                      />
                    </TableHead>
                    <TableHead className="text-[var(--st-text-secondary)]">Code</TableHead>
                    <TableHead className="text-[var(--st-text-secondary)]">Issued to</TableHead>
                    <TableHead className="text-[var(--st-text-secondary)]">Value</TableHead>
                    <TableHead className="text-[var(--st-text-secondary)]">Balance</TableHead>
                    <TableHead className="text-[var(--st-text-secondary)]">Expiry</TableHead>
                    <TableHead className="text-[var(--st-text-secondary)]">Transferable</TableHead>
                    <TableHead className="text-[var(--st-text-secondary)]">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.length === 0 ? (
                    <TableRow className="border-[var(--st-border)]">
                      <TableCell
                        colSpan={8}
                        className="h-24 text-center text-[13px] text-[var(--st-text-secondary)]"
                      >
                        {isPending ? 'Loading…' : 'No gift cards match these filters.'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    rows.map((card, idx) => {
                      const id = getId(card, idx);
                      const checked = selected.has(id);
                      const issuedTo = resolveIssuedTo(card);
                      return (
                        <TableRow key={id} className="border-[var(--st-border)]">
                          <TableCell>
                            <input
                              type="checkbox"
                              aria-label={`Select ${card.code ?? id}`}
                              checked={checked}
                              onChange={() => handleToggleOne(id)}
                            />
                          </TableCell>
                          <TableCell className="text-[var(--st-text)]">
                            <EntityRowLink
                              href={`/dashboard/crm/sales/gift-cards/${id}`}
                              label={card.code || 'Untitled card'}
                              subtitle={issuedTo !== '—' ? issuedTo : undefined}
                            />
                          </TableCell>
                          <TableCell className="text-[var(--st-text)]">{issuedTo}</TableCell>
                          <TableCell className="text-[var(--st-text)]">
                            {fmtINR(card.value)}
                          </TableCell>
                          <TableCell className="text-[var(--st-text)]">
                            {fmtINR(card.balance)}
                          </TableCell>
                          <TableCell className="text-[var(--st-text)]">
                            {fmtDate(card.expiryDate)}
                          </TableCell>
                          <TableCell className="text-[var(--st-text)]">
                            {card.transferable === true
                              ? 'Yes'
                              : card.transferable === false
                                ? 'No'
                                : '—'}
                          </TableCell>
                          <TableCell>
                            <Badge variant={getStatusVariant(card.status)}>
                              {card.status || 'draft'}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </div>
      </EntityListShell>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={`Delete ${selected.size} gift card${selected.size === 1 ? '' : 's'}?`}
        description="This permanently removes the selected gift cards. This action cannot be undone."
        requireTyped="DELETE"
        confirmLabel="Delete"
        onConfirm={handleConfirmDelete}
      />
    </>
  );
}
