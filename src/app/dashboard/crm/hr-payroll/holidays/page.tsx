/**
 * CRM Holidays list — `/dashboard/crm/hr-payroll/holidays`.
 *
 * Server component shell. Reads page/limit/year/holidayType from the
 * URL, fetches via the Rust-backed `listHolidays` action, and hands
 * off to `<HolidayListClient>` for interactive bits (filters, delete
 * dialog).
 *
 * Pagination is hasMore-driven (the Rust endpoint doesn't return a
 * total count) — see `<PaginationBar>`.
 */

import Link from 'next/link';
import { CalendarDays, Plus } from 'lucide-react';

import { ZoruButton } from '@/components/zoruui';
import { CrmPageHeader } from '../../_components/crm-page-header';
import { listHolidays } from '@/app/actions/crm/holidays.actions';
import type { CrmHolidayType } from '@/lib/rust-client/crm-holidays';
import { HolidayListClient } from './_components/holiday-list-client';

export const dynamic = 'force-dynamic';

interface SearchParams {
  page?: string;
  limit?: string;
  year?: string;
  holidayType?: string;
}

const VALID_TYPES: ReadonlySet<CrmHolidayType> = new Set([
  'national',
  'regional',
  'religious',
  'optional',
  'restricted',
]);

export default async function HolidaysPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const limit = Math.min(Math.max(1, Number(sp.limit) || 20), 100);

  const yearRaw = (sp.year ?? '').trim();
  const year = /^\d{4}$/.test(yearRaw) ? Number(yearRaw) : undefined;

  const typeRaw = (sp.holidayType ?? '').trim();
  const holidayType = VALID_TYPES.has(typeRaw as CrmHolidayType)
    ? (typeRaw as CrmHolidayType)
    : undefined;

  const { holidays, hasMore, error } = await listHolidays({
    page,
    limit,
    year,
    holidayType,
  });

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="Holidays"
        subtitle="Calendar entries that block leave accrual and attendance."
        icon={CalendarDays}
        actions={
          <ZoruButton asChild>
            <Link href="/dashboard/crm/hr-payroll/holidays/new">
              <Plus className="h-4 w-4" />
              New holiday
            </Link>
          </ZoruButton>
        }
      />

      <HolidayListClient
        holidays={holidays}
        page={page}
        limit={limit}
        hasMore={hasMore}
        initialYear={yearRaw}
        initialType={typeRaw}
        error={error}
      />
    </div>
  );
}
