'use client';

/**
 * Client side of the Bookings list — owns the search box, the table,
 * and the hard-delete confirmation dialog. Search input is debounced
 * and writes back to the URL so the server component re-fetches. The
 * Rust list endpoint doesn't currently support free-text search, so
 * the query is only used for client-side filtering of the in-memory
 * page; it still round-trips to the URL so the navigation state is
 * preserved on refresh.
 */

import * as React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import {
  AlertCircle,
  Pencil,
  Search,
  Trash2,
  LoaderCircle,
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
  ZoruBadge,
  ZoruButton,
  ZoruCard,
  ZoruInput,
  ZoruTable,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
  useZoruToast,
} from '@/components/zoruui';
import { EntityPickerChip } from '@/components/crm/entity-picker';
import { PaginationBar } from '@/components/crm/pagination-bar';
import { deleteBookingAction } from '@/app/actions/crm/bookings.actions';
import type {
  CrmBookingDoc,
  CrmBookingStatus,
} from '@/lib/rust-client/crm-bookings';

interface BookingListClientProps {
  bookings: CrmBookingDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
  initialQuery: string;
  error?: string;
}

function fmtDateTime(v?: string): string {
  if (!v) return '—';
  const d = new Date(v);
  return isNaN(d.getTime()) ? '—' : d.toLocaleString();
}

function statusBadgeVariant(
  status?: CrmBookingStatus,
): 'success' | 'warning' | 'danger' | 'ghost' | 'outline' {
  switch (status) {
    case 'confirmed':
    case 'completed':
      return 'success';
    case 'cancelled':
    case 'no_show':
      return 'danger';
    case 'pending':
      return 'warning';
    default:
      return 'outline';
  }
}

function bookingLabel(b: CrmBookingDoc): string {
  return b.service || `Booking ${String(b._id).slice(-6)}`;
}

export function BookingListClient({
  bookings,
  page,
  limit,
  hasMore,
  initialQuery,
  error,
}: BookingListClientProps) {
  const { toast } = useZoruToast();
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const [query, setQuery] = React.useState(initialQuery);
  const [pendingDelete, setPendingDelete] = React.useState<CrmBookingDoc | null>(
    null,
  );
  const [deleting, startDelete] = React.useTransition();

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

  // Client-side filter on the current page (Rust list lacks `q` today).
  const filtered = React.useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return bookings;
    return bookings.filter((b) => {
      const hay = [
        b.service ?? '',
        b.notes ?? '',
        b.cancellationPolicy ?? '',
        b.status ?? '',
      ]
        .join(' ')
        .toLowerCase();
      return hay.includes(needle);
    });
  }, [bookings, query]);

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

  return (
    <ZoruCard className="overflow-hidden p-0">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zoru-line p-3">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zoru-ink-muted" />
          <ZoruInput
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by service, notes, status…"
            className="h-9 pl-9 text-[13px]"
          />
        </div>
      </div>

      {error ? (
        <div className="flex items-center gap-2 border-b border-amber-500/40 bg-amber-500/10 px-4 py-2.5 text-[13px] text-amber-600">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      ) : null}

      <ZoruTable>
        <ZoruTableHeader>
          <ZoruTableRow>
            <ZoruTableHead>Customer</ZoruTableHead>
            <ZoruTableHead>Service</ZoruTableHead>
            <ZoruTableHead>Slot start</ZoruTableHead>
            <ZoruTableHead>Slot end</ZoruTableHead>
            <ZoruTableHead>Status</ZoruTableHead>
            <ZoruTableHead>Payment</ZoruTableHead>
            <ZoruTableHead className="text-right">Actions</ZoruTableHead>
          </ZoruTableRow>
        </ZoruTableHeader>
        <ZoruTableBody>
          {filtered.length === 0 ? (
            <ZoruTableRow>
              <ZoruTableCell
                colSpan={7}
                className="h-24 text-center text-[13px] text-zoru-ink-muted"
              >
                {initialQuery || query
                  ? 'No bookings match this search.'
                  : 'No bookings yet — click "New booking" to add one.'}
              </ZoruTableCell>
            </ZoruTableRow>
          ) : (
            filtered.map((b) => {
              const id = String(b._id);
              return (
                <ZoruTableRow key={id}>
                  <ZoruTableCell>
                    <EntityPickerChip entity="client" id={b.customerId} />
                  </ZoruTableCell>
                  <ZoruTableCell>
                    <Link
                      href={`/dashboard/crm/bookings/${id}`}
                      className="font-medium text-zoru-ink hover:underline"
                    >
                      {bookingLabel(b)}
                    </Link>
                  </ZoruTableCell>
                  <ZoruTableCell className="text-[12.5px] text-zoru-ink-muted">
                    {fmtDateTime(b.slotStart)}
                  </ZoruTableCell>
                  <ZoruTableCell className="text-[12.5px] text-zoru-ink-muted">
                    {fmtDateTime(b.slotEnd)}
                  </ZoruTableCell>
                  <ZoruTableCell>
                    <ZoruBadge variant={statusBadgeVariant(b.status)}>
                      {b.status ?? 'pending'}
                    </ZoruBadge>
                  </ZoruTableCell>
                  <ZoruTableCell className="text-[12.5px] text-zoru-ink-muted">
                    {b.paymentStatus ?? 'unpaid'}
                  </ZoruTableCell>
                  <ZoruTableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <ZoruButton size="sm" variant="ghost" asChild>
                        <Link href={`/dashboard/crm/bookings/${id}/edit`}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Link>
                      </ZoruButton>
                      <ZoruButton
                        size="sm"
                        variant="ghost"
                        onClick={() => setPendingDelete(b)}
                        className="text-zoru-danger-ink"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </ZoruButton>
                    </div>
                  </ZoruTableCell>
                </ZoruTableRow>
              );
            })
          )}
        </ZoruTableBody>
      </ZoruTable>

      <PaginationBar page={page} limit={limit} hasMore={hasMore} />

      <ZoruAlertDialog
        open={pendingDelete !== null}
        onOpenChange={(o) => !o && setPendingDelete(null)}
      >
        <ZoruAlertDialogContent>
          <ZoruAlertDialogHeader>
            <ZoruAlertDialogTitle>Delete booking?</ZoruAlertDialogTitle>
            <ZoruAlertDialogDescription>
              This permanently removes{' '}
              <strong>{pendingDelete ? bookingLabel(pendingDelete) : ''}</strong>{' '}
              from the database. The action cannot be undone.
            </ZoruAlertDialogDescription>
          </ZoruAlertDialogHeader>
          <ZoruAlertDialogFooter>
            <ZoruAlertDialogCancel disabled={deleting}>Cancel</ZoruAlertDialogCancel>
            <ZoruAlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                confirmDelete();
              }}
              disabled={deleting}
              className="bg-zoru-danger text-white hover:bg-zoru-danger/90"
            >
              {deleting ? (
                <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
              ) : null}
              Delete permanently
            </ZoruAlertDialogAction>
          </ZoruAlertDialogFooter>
        </ZoruAlertDialogContent>
      </ZoruAlertDialog>
    </ZoruCard>
  );
}
