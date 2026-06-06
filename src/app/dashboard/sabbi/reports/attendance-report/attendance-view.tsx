'use client';

import * as React from 'react';
import { useState } from 'react';
import { Calendar as CalendarIcon, List } from 'lucide-react';
import {
  Card,
  Table,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
  Badge,
  Button,
} from '@/components/sabcrm/20ui/compat';
import { EntityRowLink } from '@/components/crm/entity-row-link';
import { PaginationBar } from '@/components/crm/pagination-bar';

export function AttendanceView({
  pageRows,
  daily,
  page,
  limit,
  total,
  month,
  year,
}: {
  pageRows: any[];
  daily: any[];
  page: number;
  limit: number;
  total: number;
  month: number;
  year: number;
}) {
  const [view, setView] = useState<'list' | 'calendar'>('list');
  const hasMore = page * limit < total;

  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDay = new Date(year, month - 1, 1).getDay();
  const calendarCells = Array.from({ length: firstDay }).map(() => null).concat(
    Array.from({ length: daysInMonth }).map((_, i) => {
      const day = String(i + 1).padStart(2, '0');
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${day}`;
      const dayData = daily.find((d) => d.date === dateStr);
      return { day: i + 1, data: dayData };
    })
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end gap-2">
        <Button
          variant={view === 'list' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setView('list')}
        >
          <List className="mr-2 h-4 w-4" />
          List View
        </Button>
        <Button
          variant={view === 'calendar' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setView('calendar')}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          Calendar View
        </Button>
      </div>

      {view === 'list' ? (
        <Card className="p-0">
          <div className="overflow-x-auto rounded-lg border border-zoru-line">
            <Table>
              <ZoruTableHeader>
                <ZoruTableRow className="border-zoru-line hover:bg-transparent">
                  <ZoruTableHead className="text-zoru-ink-muted">Employee</ZoruTableHead>
                  <ZoruTableHead className="text-zoru-ink-muted">Department</ZoruTableHead>
                  <ZoruTableHead className="text-right text-zoru-ink-muted">Present</ZoruTableHead>
                  <ZoruTableHead className="text-right text-zoru-ink-muted">Absent</ZoruTableHead>
                  <ZoruTableHead className="text-right text-zoru-ink-muted">Late</ZoruTableHead>
                  <ZoruTableHead className="text-right text-zoru-ink-muted">Leave</ZoruTableHead>
                  <ZoruTableHead className="text-right text-zoru-ink-muted">Attendance %</ZoruTableHead>
                </ZoruTableRow>
              </ZoruTableHeader>
              <ZoruTableBody>
                {pageRows.length === 0 ? (
                  <ZoruTableRow className="border-zoru-line">
                    <ZoruTableCell
                      colSpan={7}
                      className="h-20 text-center text-[13px] text-zoru-ink-muted"
                    >
                      No attendance data.
                    </ZoruTableCell>
                  </ZoruTableRow>
                ) : (
                  pageRows.map((r) => (
                    <ZoruTableRow key={r.employeeId} className="border-zoru-line">
                      <ZoruTableCell>
                        <EntityRowLink
                          href={`/dashboard/crm/hr-payroll/employees/${r.employeeId}`}
                          label={r.employeeName}
                        />
                      </ZoruTableCell>
                      <ZoruTableCell className="text-[13px] text-zoru-ink">
                        <Badge variant="outline">{r.department}</Badge>
                      </ZoruTableCell>
                      <ZoruTableCell className="text-right text-[13px] text-zoru-ink">
                        {r.present}
                      </ZoruTableCell>
                      <ZoruTableCell className="text-right text-[13px] text-zoru-ink">
                        {r.absent}
                      </ZoruTableCell>
                      <ZoruTableCell className="text-right text-[13px] text-zoru-ink">
                        {r.late}
                      </ZoruTableCell>
                      <ZoruTableCell className="text-right text-[13px] text-zoru-ink">
                        {r.leave}
                      </ZoruTableCell>
                      <ZoruTableCell
                        className={`text-right text-[13px] font-medium ${r.attendancePct >= 90 ? 'text-zoru-ink' : r.attendancePct >= 75 ? 'text-zoru-ink' : 'text-zoru-ink'}`}
                      >
                        {r.attendancePct.toFixed(1)}%
                      </ZoruTableCell>
                    </ZoruTableRow>
                  ))
                )}
              </ZoruTableBody>
            </Table>
            <PaginationBar
              page={page}
              limit={limit}
              hasMore={hasMore}
              total={total}
            />
          </div>
        </Card>
      ) : (
        <Card className="p-6">
          <div className="grid grid-cols-7 gap-px rounded-lg bg-border overflow-hidden">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
              <div key={d} className="bg-zoru-surface-2 p-2 text-center text-[12px] font-medium text-zoru-ink-muted">
                {d}
              </div>
            ))}
            {calendarCells.map((cell, i) => (
              <div key={i} className="min-h-[100px] bg-zoru-surface p-2">
                {cell && (
                  <div className="flex h-full flex-col">
                    <span className="text-[13px] font-medium text-zoru-ink">{cell.day}</span>
                    {cell.data && (
                      <div className="mt-auto flex flex-col gap-1 text-[11px]">
                        <div className="flex justify-between text-zoru-ink">
                          <span>Present</span>
                          <span>{cell.data.present}</span>
                        </div>
                        <div className="flex justify-between text-zoru-ink">
                          <span>Absent</span>
                          <span>{cell.data.absent}</span>
                        </div>
                        <div className="flex justify-between text-zoru-ink">
                          <span>Leave</span>
                          <span>{cell.data.leave}</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
