import { ZoruButton } from '@/components/zoruui';
import { Plus } from 'lucide-react';

/**
 * CRM Bookings list — `/dashboard/crm/bookings`.
 *
 * Server component shell. Reads search/page/limit from the URL,
 * fetches via the Rust-backed `listBookings` action, and hands off to
 * `<BookingListClient>` for interactive bits (search, delete dialog).
 *
 * Pagination is hasMore-driven (the Rust endpoint doesn't return a
 * total count) — see `<PaginationBar>`.
 */

import Link from 'next/link';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { listBookings } from '@/app/actions/crm/bookings.actions';
import { BookingListClient } from './_components/booking-list-client';

export const dynamic = 'force-dynamic';

interface SearchParams {
  page?: string;
  limit?: string;
  q?: string;
}

export default async function BookingsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const limit = Math.min(Math.max(1, Number(sp.limit) || 20), 100);
  const q = (sp.q ?? '').trim();

  // The Rust list endpoint doesn't support free-text search yet — `q`
  // is passed through to the client as the initial value of the local
  // filter box so the URL still round-trips when the user navigates.
  const { bookings, hasMore, error } = await listBookings({ page, limit });

  return (
    <EntityListShell
      title="Bookings"
      subtitle="Reserve resources, rooms, or staff slots for your customers."
      primaryAction={
        <ZoruButton asChild>
          <Link href="/dashboard/crm/bookings/new">
            <Plus className="h-4 w-4" />
            New booking
          </Link>
        </ZoruButton>
      }
    >
      <BookingListClient
        bookings={bookings}
        page={page}
        limit={limit}
        hasMore={hasMore}
        initialQuery={q}
        error={error}
      />
    </EntityListShell>
  );
}
