import { Button } from '@/components/zoruui';
import { Plus } from 'lucide-react';

/**
 * CRM Bookings list — `/dashboard/crm/bookings`.
 *
 * Server component shell. Reads search/page/limit/status from the URL,
 * fetches via the Rust-backed `listBookings` action + `getBookingKpis`
 * in parallel, and hands off to `<BookingListClient>` for KPI strip,
 * filters, bulk actions, and export.
 */

import Link from 'next/link';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import {
  listBookings,
  getBookingKpis,
} from '@/app/actions/crm/bookings.actions';
import { BookingListClient } from './_components/booking-list-client';

import { Suspense } from 'react';
import { Skeleton } from '@/components/zoruui';

export const dynamic = 'force-dynamic';

interface SearchParams {
  page?: string;
  limit?: string;
  q?: string;
  status?: string;
}

async function BookingsData({ sp }: { sp: SearchParams }) {
  const page = Math.max(1, Number(sp.page) || 1);
  const limit = Math.min(Math.max(1, Number(sp.limit) || 20), 100);
  const q = (sp.q ?? '').trim();

  const [{ bookings, hasMore, error }, kpis] = await Promise.all([
    listBookings({ page, limit }),
    getBookingKpis(),
  ]);

  return (
    <BookingListClient
      bookings={bookings}
      page={page}
      limit={limit}
      hasMore={hasMore}
      initialQuery={q}
      error={error}
      kpis={kpis}
    />
  );
}

export default async function BookingsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;

  return (
    <EntityListShell
      title="Bookings"
      subtitle="Reserve resources, rooms, or staff slots for your customers."
      primaryAction={
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <Link href="/dashboard/crm/bookings/sync-settings">
              Sync Settings
            </Link>
          </Button>
          <Button asChild>
            <Link href="/dashboard/crm/bookings/new">
              <Plus className="h-4 w-4" />
              New booking
            </Link>
          </Button>
        </div>
      }
    >
      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <BookingsData sp={sp} />
      </Suspense>
    </EntityListShell>
  );
}
