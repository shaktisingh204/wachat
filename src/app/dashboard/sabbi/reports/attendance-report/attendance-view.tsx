'use client';

import * as React from 'react';
import { useState } from 'react';
import { Calendar as CalendarIcon, List } from 'lucide-react';
import { Card, Table, TBody, Td, Th, THead, Tr, Badge, Button } from '@/components/sabcrm/20ui/compat';
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
          <div className="overflow-x-auto rounded-lg border border-[var(--st-border)]">
            <Table>
              <THead>
                <Tr className="border-[var(--st-border)] hover:bg-transparent">
                  <Th className="text-[var(--st-text-secondary)]">Employee</Th>
                  <Th className="text-[var(--st-text-secondary)]">Department</Th>
                  <Th className="text-right text-[var(--st-text-secondary)]">Present</Th>
                  <Th className="text-right text-[var(--st-text-secondary)]">Absent</Th>
                  <Th className="text-right text-[var(--st-text-secondary)]">Late</Th>
                  <Th className="text-right text-[var(--st-text-secondary)]">Leave</Th>
                  <Th className="text-right text-[var(--st-text-secondary)]">Attendance %</Th>
                </Tr>
              </THead>
              <TBody>
                {pageRows.length === 0 ? (
                  <Tr className="border-[var(--st-border)]">
                    <Td
                      colSpan={7}
                      className="h-20 text-center text-[13px] text-[var(--st-text-secondary)]"
                    >
                      No attendance data.
                    </Td>
                  </Tr>
                ) : (
                  pageRows.map((r) => (
                    <Tr key={r.employeeId} className="border-[var(--st-border)]">
                      <Td>
                        <EntityRowLink
                          href={`/dashboard/crm/hr-payroll/employees/${r.employeeId}`}
                          label={r.employeeName}
                        />
                      </Td>
                      <Td className="text-[13px] text-[var(--st-text)]">
                        <Badge variant="outline">{r.department}</Badge>
                      </Td>
                      <Td className="text-right text-[13px] text-[var(--st-text)]">
                        {r.present}
                      </Td>
                      <Td className="text-right text-[13px] text-[var(--st-text)]">
                        {r.absent}
                      </Td>
                      <Td className="text-right text-[13px] text-[var(--st-text)]">
                        {r.late}
                      </Td>
                      <Td className="text-right text-[13px] text-[var(--st-text)]">
                        {r.leave}
                      </Td>
                      <Td
                        className={`text-right text-[13px] font-medium ${r.attendancePct >= 90 ? 'text-[var(--st-text)]' : r.attendancePct >= 75 ? 'text-[var(--st-text)]' : 'text-[var(--st-text)]'}`}
                      >
                        {r.attendancePct.toFixed(1)}%
                      </Td>
                    </Tr>
                  ))
                )}
              </TBody>
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
              <div key={d} className="bg-[var(--st-bg-muted)] p-2 text-center text-[12px] font-medium text-[var(--st-text-secondary)]">
                {d}
              </div>
            ))}
            {calendarCells.map((cell, i) => (
              <div key={i} className="min-h-[100px] bg-[var(--st-bg-secondary)] p-2">
                {cell && (
                  <div className="flex h-full flex-col">
                    <span className="text-[13px] font-medium text-[var(--st-text)]">{cell.day}</span>
                    {cell.data && (
                      <div className="mt-auto flex flex-col gap-1 text-[11px]">
                        <div className="flex justify-between text-[var(--st-text)]">
                          <span>Present</span>
                          <span>{cell.data.present}</span>
                        </div>
                        <div className="flex justify-between text-[var(--st-text)]">
                          <span>Absent</span>
                          <span>{cell.data.absent}</span>
                        </div>
                        <div className="flex justify-between text-[var(--st-text)]">
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
