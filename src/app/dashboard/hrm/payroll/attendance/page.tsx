/**
 * Canonical Attendance list — `/dashboard/hrm/payroll/attendance`.
 *
 * Server component. Reads page/limit/q from the URL, hands the data to
 * `<AttendanceListClient>` for the §1D experience (KPI strip, filters,
 * view switcher, bulk bar, calendars).
 *
 * Pulls a wider window for the KPI strip so the aggregate isn't capped
 * by `limit`. The Rust BFF (`crmAttendanceApi`) is the source of truth;
 * we never touch Mongo from this page.
 *
 * Per CRM_REBUILD_PLAN §1D.
 */

import { CheckSquare } from 'lucide-react';

import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';
import { listAttendance } from '@/app/actions/crm/attendance.actions';
import {
  crmAttendanceApi,
  type CrmAttendanceDoc,
} from '@/lib/rust-client/crm-attendance';

import { AttendanceListClient } from './_components/attendance-list-client';
import { computeAttendanceKpis } from './_components/kpi';
import type { AttendanceListRow } from './_components/types';

export const dynamic = 'force-dynamic';

interface SearchParams {
  page?: string;
  limit?: string;
  q?: string;
}

interface PageProps {
  searchParams: Promise<SearchParams>;
}

function toRow(doc: CrmAttendanceDoc): AttendanceListRow {
  return {
    _id: String(doc._id),
    employeeId: doc.employeeId,
    date: doc.date,
    shiftId: doc.shiftId,
    punchInAt: doc.punchIn?.at,
    punchOutAt: doc.punchOut?.at,
    punchInLat: doc.punchIn?.lat,
    punchInLng: doc.punchIn?.lng,
    totalHours: doc.totalHours,
    overtimeHours: doc.overtimeHours,
    lateByMinutes: doc.lateByMinutes,
    earlyOutByMinutes: doc.earlyOutByMinutes,
    status: doc.status,
    source: doc.source,
    approverId: doc.approverId,
    notes: doc.notes,
    createdAt: doc.createdAt ?? doc.audit?.createdAt,
    updatedAt: doc.updatedAt ?? doc.audit?.updatedAt,
  };
}

export default async function AttendancePage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const limit = Math.min(Math.max(1, Number(sp.limit) || 20), 100);
  const q = (sp.q ?? '').trim();

  const [{ records: pageRecords, hasMore, error }, kpiSource] = await Promise.all([
    listAttendance({ page, limit }),
    crmAttendanceApi
      .list({ page: 1, limit: 200 })
      .catch(() => [] as CrmAttendanceDoc[]),
  ]);

  const rows: AttendanceListRow[] = pageRecords.map(toRow);
  const kpi = computeAttendanceKpis(kpiSource);

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="Attendance"
        subtitle="Track punches, leaves, and shift compliance across the workforce."
        icon={CheckSquare}
        breadcrumbs={[
          { label: 'HRM', href: '/dashboard/hrm' },
          { label: 'Payroll', href: '/dashboard/hrm/payroll' },
          { label: 'Attendance' },
        ]}
      />

      <AttendanceListClient
        rows={rows}
        page={page}
        limit={limit}
        hasMore={hasMore}
        initialQuery={q}
        kpi={kpi}
        error={error}
      />
    </div>
  );
}
