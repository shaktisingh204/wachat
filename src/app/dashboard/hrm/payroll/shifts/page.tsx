'use client';

import { useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { Plus, Clock, Edit, Trash2, CalendarDays } from 'lucide-react';
import { ClayCard, ClayBadge, ClayButton } from '@/components/clay';
import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';
import {
  getEmployeeShifts,
  deleteEmployeeShift,
} from '@/app/actions/worksuite/shifts.actions';
import type { WsEmployeeShift } from '@/lib/worksuite/shifts-types';

export default function EmployeeShiftsPage() {
  const [shifts, setShifts] = useState<WsEmployeeShift[]>([]);
  const [isLoading, startTransition] = useTransition();

  const load = () => {
    startTransition(async () => {
      const rows = await getEmployeeShifts();
      setShifts(rows);
    });
  };

  useEffect(() => {
    load();
  }, []);

  const handleDelete = (id?: string) => {
    if (!id) return;
    if (!confirm('Delete this shift?')) return;
    startTransition(async () => {
      await deleteEmployeeShift(id);
      load();
    });
  };

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="Employee Shifts"
        subtitle="Configure shift timings, breaks and half-day rules."
        icon={Clock}
        actions={
          <>
            <Link href="/dashboard/hrm/payroll/shifts/schedule">
              <ClayButton
                variant="pill"
                leading={<CalendarDays className="h-4 w-4" strokeWidth={1.75} />}
              >
                Schedule
              </ClayButton>
            </Link>
            <Link href="/dashboard/hrm/payroll/shifts/new">
              <ClayButton
                variant="obsidian"
                leading={<Plus className="h-4 w-4" strokeWidth={1.75} />}
              >
                Add Shift
              </ClayButton>
            </Link>
          </>
        }
      />

      <ClayCard>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-[16px] font-semibold text-clay-ink">All Shifts</h2>
            <p className="mt-0.5 text-[12.5px] text-clay-ink-muted">
              Each shift defines office hours, late-mark window and half-day rules.
            </p>
          </div>
        </div>
        <div className="overflow-x-auto rounded-clay-md border border-clay-border">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-clay-border bg-clay-surface-2">
                <th className="px-4 py-2.5 text-left text-[12px] font-medium text-clay-ink-muted">Shift</th>
                <th className="px-4 py-2.5 text-left text-[12px] font-medium text-clay-ink-muted">Clock In / Out</th>
                <th className="px-4 py-2.5 text-left text-[12px] font-medium text-clay-ink-muted">Office Hours</th>
                <th className="px-4 py-2.5 text-left text-[12px] font-medium text-clay-ink-muted">Late Mark</th>
                <th className="px-4 py-2.5 text-left text-[12px] font-medium text-clay-ink-muted">Open Days</th>
                <th className="px-4 py-2.5 text-left text-[12px] font-medium text-clay-ink-muted">Days Off Type</th>
                <th className="px-4 py-2.5 text-right text-[12px] font-medium text-clay-ink-muted">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr className="border-b border-clay-border">
                  <td colSpan={7} className="h-24 text-center text-[13px] text-clay-ink-muted">
                    Loading...
                  </td>
                </tr>
              ) : shifts.length > 0 ? (
                shifts.map((shift) => (
                  <tr key={String(shift._id)} className="border-b border-clay-border last:border-0 hover:bg-clay-surface-2/50">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <span
                          aria-hidden
                          className="inline-block h-4 w-4 rounded-[4px] border border-clay-border"
                          style={{ backgroundColor: shift.color_code || '#EAB308' }}
                        />
                        <span className="font-medium text-clay-ink">{shift.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-clay-ink">
                      {shift.clock_in_time || '—'} – {shift.clock_out_time || '—'}
                    </td>
                    <td className="px-4 py-2.5 text-clay-ink">
                      {shift.office_start_time} – {shift.office_end_time}
                    </td>
                    <td className="px-4 py-2.5 text-clay-ink">
                      {shift.late_mark_after} min
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex flex-wrap gap-1">
                        {(shift.office_open_days || []).length
                          ? shift.office_open_days.map((d) => (
                              <ClayBadge key={d} tone="blue">
                                {d.slice(0, 3)}
                              </ClayBadge>
                            ))
                          : <span className="text-clay-ink-muted">—</span>}
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <ClayBadge tone={shift.days_off_type === 'week-off' ? 'blue' : 'neutral'}>
                        {shift.days_off_type}
                      </ClayBadge>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Link href={`/dashboard/hrm/payroll/shifts/${shift._id}/edit`}>
                          <ClayButton variant="pill" size="icon" aria-label="Edit shift">
                            <Edit className="h-4 w-4" />
                          </ClayButton>
                        </Link>
                        <ClayButton
                          variant="pill"
                          size="icon"
                          aria-label="Delete shift"
                          onClick={() => handleDelete(shift._id)}
                        >
                          <Trash2 className="h-4 w-4 text-clay-red" />
                        </ClayButton>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr className="border-b border-clay-border">
                  <td
                    colSpan={7}
                    className="h-24 text-center text-[13px] text-clay-ink-muted"
                  >
                    No shifts yet. Create your first shift.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </ClayCard>
    </div>
  );
}
