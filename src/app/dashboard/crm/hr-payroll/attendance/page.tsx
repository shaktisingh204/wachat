/**
 * CRM Attendance list — `/dashboard/crm/hr-payroll/attendance`.
 *
 * Server component shell. Reads page/limit from the URL, fetches via
 * the Rust-backed `listAttendance` action, and hands off to
 * `<AttendanceListClient>` for interactive bits (delete dialog).
 *
 * Pagination is hasMore-driven (the Rust endpoint doesn't return a
 * total count) — see `<PaginationBar>`.
 */

import Link from 'next/link';
import { CalendarCheck, Plus } from 'lucide-react';

import { ZoruButton } from '@/components/zoruui';
import { CrmPageHeader } from '../../_components/crm-page-header';
import { listAttendance } from '@/app/actions/crm/attendance.actions';
import { AttendanceListClient } from './_components/attendance-list-client';

export const dynamic = 'force-dynamic';

interface SearchParams {
  page?: string;
  limit?: string;
}

export default async function AttendancePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const limit = Math.min(Math.max(1, Number(sp.limit) || 20), 100);

  const { records, hasMore, error } = await listAttendance({ page, limit });

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="Attendance"
        subtitle="Track daily punches, hours worked, and approvals."
        icon={CalendarCheck}
        actions={
          <ZoruButton asChild>
            <Link href="/dashboard/crm/hr-payroll/attendance/new">
              <Plus className="h-4 w-4" />
              New record
            </Link>
          </ZoruButton>
        }
      />

      <AttendanceListClient
        records={records}
        page={page}
        limit={limit}
        hasMore={hasMore}
        error={error}
      />
    </div>
  );
}
