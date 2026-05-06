'use client';

import { useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { Plus, Clock, Edit, Trash2, CalendarDays } from 'lucide-react';
import {
  ZoruBadge,
  ZoruButton,
  ZoruCard,
} from '@/components/zoruui';
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
              <ZoruButton variant="outline">
                <CalendarDays className="h-4 w-4" strokeWidth={1.75} />
                Schedule
              </ZoruButton>
            </Link>
            <Link href="/dashboard/hrm/payroll/shifts/new">
              <ZoruButton>
                <Plus className="h-4 w-4" strokeWidth={1.75} />
                Add Shift
              </ZoruButton>
            </Link>
          </>
        }
      />

      <ZoruCard className="p-6">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-[16px] text-zoru-ink">All Shifts</h2>
            <p className="mt-0.5 text-[12.5px] text-zoru-ink-muted">
              Each shift defines office hours, late-mark window and half-day rules.
            </p>
          </div>
        </div>
        <div className="overflow-x-auto rounded-lg border border-zoru-line">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-zoru-line bg-zoru-surface-2">
                <th className="px-4 py-2.5 text-left text-[12px] font-medium text-zoru-ink-muted">Shift</th>
                <th className="px-4 py-2.5 text-left text-[12px] font-medium text-zoru-ink-muted">Clock In / Out</th>
                <th className="px-4 py-2.5 text-left text-[12px] font-medium text-zoru-ink-muted">Office Hours</th>
                <th className="px-4 py-2.5 text-left text-[12px] font-medium text-zoru-ink-muted">Late Mark</th>
                <th className="px-4 py-2.5 text-left text-[12px] font-medium text-zoru-ink-muted">Open Days</th>
                <th className="px-4 py-2.5 text-left text-[12px] font-medium text-zoru-ink-muted">Days Off Type</th>
                <th className="px-4 py-2.5 text-right text-[12px] font-medium text-zoru-ink-muted">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr className="border-b border-zoru-line">
                  <td colSpan={7} className="h-24 text-center text-[13px] text-zoru-ink-muted">
                    Loading...
                  </td>
                </tr>
              ) : shifts.length > 0 ? (
                shifts.map((shift) => (
                  <tr key={String(shift._id)} className="border-b border-zoru-line last:border-0 hover:bg-zoru-surface-2/50">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <span
                          aria-hidden
                          className="inline-block h-4 w-4 rounded-[4px] border border-zoru-line"
                          style={{ backgroundColor: shift.color_code || '#EAB308' }}
                        />
                        <span className="font-medium text-zoru-ink">{shift.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-zoru-ink">
                      {shift.clock_in_time || '—'} – {shift.clock_out_time || '—'}
                    </td>
                    <td className="px-4 py-2.5 text-zoru-ink">
                      {shift.office_start_time} – {shift.office_end_time}
                    </td>
                    <td className="px-4 py-2.5 text-zoru-ink">
                      {shift.late_mark_after} min
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex flex-wrap gap-1">
                        {(shift.office_open_days || []).length
                          ? shift.office_open_days.map((d) => (
                              <ZoruBadge key={d} variant="info">
                                {d.slice(0, 3)}
                              </ZoruBadge>
                            ))
                          : <span className="text-zoru-ink-muted">—</span>}
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <ZoruBadge variant={shift.days_off_type === 'week-off' ? 'info' : 'secondary'}>
                        {shift.days_off_type}
                      </ZoruBadge>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Link href={`/dashboard/hrm/payroll/shifts/${shift._id}/edit`}>
                          <ZoruButton variant="outline" size="icon" aria-label="Edit shift">
                            <Edit className="h-4 w-4" />
                          </ZoruButton>
                        </Link>
                        <ZoruButton
                          variant="outline"
                          size="icon"
                          aria-label="Delete shift"
                          onClick={() => handleDelete(shift._id)}
                        >
                          <Trash2 className="h-4 w-4 text-zoru-danger-ink" />
                        </ZoruButton>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr className="border-b border-zoru-line">
                  <td
                    colSpan={7}
                    className="h-24 text-center text-[13px] text-zoru-ink-muted"
                  >
                    No shifts yet. Create your first shift.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </ZoruCard>
    </div>
  );
}
