'use client';

import { useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { Plus, Clock, Edit, Trash2, CalendarDays } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
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
          <Table>
            <TableHeader>
              <TableRow className="border-clay-border hover:bg-transparent">
                <TableHead className="text-clay-ink-muted">Shift</TableHead>
                <TableHead className="text-clay-ink-muted">Office Hours</TableHead>
                <TableHead className="text-clay-ink-muted">Days Off</TableHead>
                <TableHead className="text-clay-ink-muted">Late Mark</TableHead>
                <TableHead className="text-clay-ink-muted">Open Days</TableHead>
                <TableHead className="text-right text-clay-ink-muted">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow className="border-clay-border">
                  <TableCell colSpan={6} className="h-24 text-center text-[13px] text-clay-ink-muted">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : shifts.length > 0 ? (
                shifts.map((shift) => (
                  <TableRow key={String(shift._id)} className="border-clay-border">
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span
                          aria-hidden
                          className="inline-block h-4 w-4 rounded-[4px] border border-clay-border"
                          style={{ backgroundColor: shift.color_code || '#EAB308' }}
                        />
                        <span className="text-[13px] font-medium text-clay-ink">
                          {shift.name}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-[13px] text-clay-ink">
                      {shift.office_start_time} – {shift.office_end_time}
                    </TableCell>
                    <TableCell>
                      <ClayBadge tone={shift.days_off_type === 'week-off' ? 'blue' : 'neutral'}>
                        {shift.days_off_type}
                      </ClayBadge>
                    </TableCell>
                    <TableCell className="text-[13px] text-clay-ink">
                      {shift.late_mark_after} min
                    </TableCell>
                    <TableCell className="text-[12px] text-clay-ink-muted">
                      {(shift.office_open_days || []).length
                        ? shift.office_open_days.map((d) => d.slice(0, 3)).join(', ')
                        : '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" asChild>
                          <Link href={`/dashboard/hrm/payroll/shifts/${shift._id}/edit`}>
                            <Edit className="h-4 w-4" />
                          </Link>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(shift._id)}
                        >
                          <Trash2 className="h-4 w-4 text-clay-red" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow className="border-clay-border">
                  <TableCell
                    colSpan={6}
                    className="h-24 text-center text-[13px] text-clay-ink-muted"
                  >
                    No shifts yet. Create your first shift.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </ClayCard>
    </div>
  );
}
