'use client';

import { Button, Card, Checkbox, Input, Table, TBody, Td, Th, THead, Tr, useToast } from '@/components/sabcrm/20ui/compat';
import { EnumFilterField } from '@/components/crm/enum-filter-field';
import {
  useRouter,
  useSearchParams,
  usePathname } from 'next/navigation';
import {
  AlertCircle,
  CalendarDays,
  ListChecks,
  Pencil,
  Search,
  Table2,
  Trash2,
  X,
  } from 'lucide-react';

/**
 * Client side of the Bookings list — owns the search box, the table,
 * the bulk action bar, the KPI strip, the calendar view switcher, and
 * the hard-delete confirmation dialog.
 *
 * The Rust list endpoint doesn't currently support free-text search,
 * so the query is only used for client-side filtering of the in-memory
 * page; it still round-trips to the URL so the navigation state is
 * preserved on refresh.
 */

import * as React from 'react';
import Link from 'next/link';

import { EntityPickerChip } from '@/components/crm/entity-picker';
import { EntityRowLink } from '@/components/crm/entity-row-link';
import { PaginationBar } from '@/components/crm/pagination-bar';
import { StatusPill, statusToTone } from '@/components/crm/status-pill';
import { deleteBookingAction } from '@/app/actions/crm/bookings.actions';
import type {
  CrmBookingDoc,
  CrmBookingPaymentStatus,
  CrmBookingStatus,
} from '@/lib/rust-client/crm-bookings';

import {
  BookingsKpiStrip,
  computeBookingKpis,
  type BookingsKpiKey,
} from './bookings-kpi-strip';
import { BookingsCalendar } from './bookings-calendar';
import {
  BookingBulkDeleteDialog,
  BookingSingleDeleteDialog,
} from './booking-list-dialogs';

import type { BookingKpis } from '@/app/actions/crm/bookings.actions.types';
import { downloadCsv, downloadXlsx, dateStamp } from '@/lib/crm-list-export';

interface BookingListClientProps {
  bookings: CrmBookingDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
  initialQuery: string;
  error?: string;
  kpis?: BookingKpis;
}


function fmtDateTime(v?: string): string {
  if (!v) return '—';
  const d = new Date(v);
  return isNaN(d.getTime()) ? '—' : d.toLocaleString();
}

function bookingLabel(b: CrmBookingDoc): string {
  return b.service || `Booking ${String(b._id).slice(-6)}`;
}

function inThisWeek(slotStart?: string): boolean {
  if (!slotStart) return false;
  const t = new Date(slotStart).getTime();
  if (!Number.isFinite(t)) return false;
  const now = new Date();
  const day = now.getDay();
  const diff = (day + 6) % 7;
  const start = new Date(now);
  start.setDate(now.getDate() - diff);
  start.setHours(0, 0, 0, 0);
  const end = start.getTime() + 7 * 24 * 60 * 60 * 1000;
  return t >= start.getTime() && t < end;
}

function inToday(slotStart?: string): boolean {
  if (!slotStart) return false;
  const t = new Date(slotStart).getTime();
  if (!Number.isFinite(t)) return false;
  const s = new Date();
  s.setHours(0, 0, 0, 0);
  return t >= s.getTime() && t < s.getTime() + 24 * 60 * 60 * 1000;
}

type ViewMode = 'table' | 'calendar';

const BOOKING_CSV_HEADERS = [
  'Id',
  'Customer',
  'Service',
  'Slot Start',
  'Slot End',
  'Status',
  'Payment',
  'Amount',
  'Notes',
];

function bookingToExportRow(b: CrmBookingDoc): Record<string, unknown> {
  return {
    Id: String(b._id),
    Customer: b.customerId ?? '',
    Service: b.service ?? '',
    'Slot Start': b.slotStart ?? '',
    'Slot End': b.slotEnd ?? '',
    Status: b.status ?? '',
    Payment: b.paymentStatus ?? '',
    Amount: b.totalAmount ?? '',
    Notes: b.notes ?? '',
  };
}

export function BookingListClient({
  bookings,
  page,
  limit,
  hasMore,
  initialQuery,
  error,
  kpis,
}: BookingListClientProps) {
  const { toast } = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const [query, setQuery] = React.useState(initialQuery);
  const [statusFilter, setStatusFilter] = React.useState<'all' | CrmBookingStatus>(
    'all',
  );
  const [paymentFilter, setPaymentFilter] = React.useState<
    'all' | CrmBookingPaymentStatus
  >('all');
  const [kpiKey, setKpiKey] = React.useState<BookingsKpiKey>('all');
  const [view, setView] = React.useState<ViewMode>('table');

  const [pendingDelete, setPendingDelete] = React.useState<CrmBookingDoc | null>(
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

  const kpiCounts = React.useMemo(
    () => computeBookingKpis(bookings),
    [bookings],
  );

  const filtered = React.useMemo(() => {
    const needle = query.trim().toLowerCase();
    return bookings.filter((b) => {
      if (needle) {
        const hay = [
          b.service ?? '',
          b.notes ?? '',
          b.cancellationPolicy ?? '',
          b.status ?? '',
        ]
          .join(' ')
          .toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      if (statusFilter !== 'all' && b.status !== statusFilter) return false;
      if (paymentFilter !== 'all' && b.paymentStatus !== paymentFilter)
        return false;
      switch (kpiKey) {
        case 'today':
          if (!inToday(b.slotStart)) return false;
          break;
        case 'week':
          if (!inThisWeek(b.slotStart)) return false;
          break;
        case 'pendingPayment':
          if (
            b.paymentStatus !== 'unpaid' &&
            b.paymentStatus !== 'partial'
          )
            return false;
          break;
        case 'cancelled':
          if (b.status !== 'cancelled') return false;
          break;
        case 'noShow':
          if (b.status !== 'no_show' && b.noShow !== true) return false;
          break;
      }
      return true;
    });
  }, [bookings, query, statusFilter, paymentFilter, kpiKey]);

  const hasActiveFilters =
    !!query.trim() ||
    statusFilter !== 'all' ||
    paymentFilter !== 'all' ||
    kpiKey !== 'all';

  const clearFilters = () => {
    setQuery('');
    setStatusFilter('all');
    setPaymentFilter('all');
    setKpiKey('all');
  };

  const confirmDelete = () => {
    if (!pendingDelete?._id) return;
    const id = String(pendingDelete._id);
    const label = bookingLabel(pendingDelete);
    startDelete(async () => {
      const res = await deleteBookingAction(id);
      if (res.success) {
        toast({ title: 'Deleted', description: `${label} removed.` });
        setPendingDelete(null);
        router.refresh();
      } else {
        toast({
          title: 'Delete failed',
          description: res.error,
          variant: 'destructive',
        });
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
    setSelected(all ? new Set(filtered.map((b) => String(b._id))) : new Set());

  const exportCsv = () => {
    const rows =
      selected.size > 0
        ? filtered.filter((b) => selected.has(String(b._id)))
        : filtered;
    downloadCsv(
      `bookings-${dateStamp()}.csv`,
      BOOKING_CSV_HEADERS,
      rows.map(bookingToExportRow),
    );
  };

  const exportXlsx = () => {
    const rows =
      selected.size > 0
        ? filtered.filter((b) => selected.has(String(b._id)))
        : filtered;
    void downloadXlsx(
      `bookings-${dateStamp()}.xlsx`,
      BOOKING_CSV_HEADERS,
      rows.map(bookingToExportRow),
      'Bookings',
    );
  };

  const runBulkDelete = () => {
    if (selected.size === 0) return;
    setBulkConfirmOpen(false);
    const ids = Array.from(selected);
    startBulkDelete(async () => {
      let ok = 0;
      let failed = 0;
      for (const id of ids) {
        const res = await deleteBookingAction(id);
        if (res.success) ok += 1;
        else failed += 1;
      }
      toast({
        title:
          failed === 0
            ? `${ok} booking${ok === 1 ? '' : 's'} deleted`
            : `${ok} deleted · ${failed} failed`,
        variant: failed > 0 ? 'destructive' : undefined,
      });
      setSelected(new Set());
      router.refresh();
    });
  };

  const headChecked =
    filtered.length > 0 &&
    filtered.every((b) => selected.has(String(b._id)));

  return (
    <div className="flex flex-col gap-4">
      {/* Server-side absolute KPI strip */}
      {kpis ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          {[
            { label: 'Total bookings', value: kpis.total },
            { label: 'Confirmed', value: kpis.confirmed },
            { label: 'Pending', value: kpis.pending },
            { label: 'Cancelled', value: kpis.cancelled },
            { label: "Today's bookings", value: kpis.today },
          ].map(({ label, value }) => (
            <div
              key={label}
              className="rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-muted)] px-4 py-3"
            >
              <p className="text-xl font-semibold tabular-nums text-[var(--st-text)]">
                {value.toLocaleString()}
              </p>
              <p className="text-[11.5px] text-[var(--st-text-secondary)]">{label}</p>
            </div>
          ))}
        </div>
      ) : null}

      <BookingsKpiStrip counts={kpiCounts} active={kpiKey} onPick={setKpiKey} />

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--st-text-secondary)]" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by service, notes, status…"
            className="h-9 pl-9 text-[13px]"
          />
        </div>
        <EnumFilterField
          enumName="bookingStatus"
          value={statusFilter}
          onChange={(v) =>
            setStatusFilter(v === 'all' ? 'all' : (v as CrmBookingStatus))
          }
          allLabel="All statuses"
        />
        <EnumFilterField
          enumName="bookingPaymentStatus"
          value={paymentFilter}
          onChange={(v) =>
            setPaymentFilter(
              v === 'all' ? 'all' : (v as CrmBookingPaymentStatus),
            )
          }
          allLabel="All payments"
        />
        {hasActiveFilters ? (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            <X className="h-3.5 w-3.5" /> Clear
          </Button>
        ) : null}
        <div className="ml-auto inline-flex rounded-[var(--st-radius)] border border-[var(--st-border)] p-0.5">
          <Button
            size="sm"
            variant={view === 'table' ? 'default' : 'ghost'}
            onClick={() => setView('table')}
            aria-pressed={view === 'table'}
          >
            <Table2 className="h-3.5 w-3.5" /> Table
          </Button>
          <Button
            size="sm"
            variant={view === 'calendar' ? 'default' : 'ghost'}
            onClick={() => setView('calendar')}
            aria-pressed={view === 'calendar'}
          >
            <CalendarDays className="h-3.5 w-3.5" /> Calendar
          </Button>
        </div>
      </div>

      {/* Bulk bar */}
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
            <Button size="sm" variant="outline" onClick={exportXlsx}>
              Export XLSX
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

        {view === 'calendar' ? (
          <div className="p-3">
            <BookingsCalendar bookings={filtered} />
          </div>
        ) : (
          <Table>
            <THead>
              <Tr>
                <Th className="w-8">
                  <Checkbox
                    checked={headChecked}
                    onCheckedChange={(c) => toggleAll(Boolean(c))}
                    aria-label="Select all"
                  />
                </Th>
                <Th>Customer</Th>
                <Th>Service</Th>
                <Th>Slot start</Th>
                <Th>Slot end</Th>
                <Th>Payment</Th>
                <Th>Status</Th>
                <Th className="text-right">Actions</Th>
              </Tr>
            </THead>
            <TBody>
              {filtered.length === 0 ? (
                <Tr>
                  <Td
                    colSpan={8}
                    className="h-24 text-center text-[13px] text-[var(--st-text-secondary)]"
                  >
                    {hasActiveFilters
                      ? 'No bookings match these filters.'
                      : 'No bookings yet — click "New booking" to add one.'}
                  </Td>
                </Tr>
              ) : (
                filtered.map((b) => {
                  const id = String(b._id);
                  const checked = selected.has(id);
                  return (
                    <Tr key={id}>
                      <Td>
                        <Checkbox
                          checked={checked}
                          onCheckedChange={() => toggleOne(id)}
                          aria-label={`Select booking ${bookingLabel(b)}`}
                        />
                      </Td>
                      <Td>
                        <EntityPickerChip entity="client" id={b.customerId} />
                      </Td>
                      <Td>
                        <EntityRowLink
                          href={`/dashboard/crm/bookings/${id}`}
                          label={bookingLabel(b)}
                        />
                      </Td>
                      <Td className="text-[12.5px] text-[var(--st-text-secondary)]">
                        {fmtDateTime(b.slotStart)}
                      </Td>
                      <Td className="text-[12.5px] text-[var(--st-text-secondary)]">
                        {fmtDateTime(b.slotEnd)}
                      </Td>
                      <Td className="text-[12.5px] text-[var(--st-text-secondary)]">
                        {b.paymentStatus ?? 'unpaid'}
                      </Td>
                      <Td>
                        <StatusPill
                          label={b.status ?? 'pending'}
                          tone={statusToTone(b.status)}
                        />
                      </Td>
                      <Td className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button size="sm" variant="ghost" asChild>
                            <Link href={`/dashboard/crm/bookings/${id}/edit`}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Link>
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setPendingDelete(b)}
                            className="text-[var(--st-danger)]"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </Td>
                    </Tr>
                  );
                })
              )}
            </TBody>
          </Table>
        )}

        {view === 'table' ? (
          <PaginationBar page={page} limit={limit} hasMore={hasMore} />
        ) : null}
      </Card>

      <BookingSingleDeleteDialog
        open={pendingDelete !== null}
        onOpenChange={(o) => !o && setPendingDelete(null)}
        label={pendingDelete ? bookingLabel(pendingDelete) : ''}
        busy={deleting}
        onConfirm={confirmDelete}
      />

      <BookingBulkDeleteDialog
        open={bulkConfirmOpen}
        onOpenChange={setBulkConfirmOpen}
        count={selected.size}
        busy={bulkDeleting}
        onConfirm={runBulkDelete}
      />
    </div>
  );
}

