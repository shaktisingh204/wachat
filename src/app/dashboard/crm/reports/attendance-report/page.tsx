export const dynamic = 'force-dynamic';

import { CalendarDays } from 'lucide-react';
import { ClayButton, ClayCard } from '@/components/clay';
import { CrmPageHeader } from '../../_components/crm-page-header';
import { StatCard } from '../_components/report-toolbar';
import { getAttendanceMatrix } from '@/app/actions/worksuite/reports.actions';

function AttendanceFilter({ month, year }: { month: number; year: number }) {
  const months = [
    'January','February','March','April','May','June',
    'July','August','September','October','November','December',
  ];
  const years = Array.from({ length: 5 }, (_, i) => year - 2 + i);
  return (
    <form
      method="get"
      className="flex flex-wrap items-end gap-2 rounded-clay-md border border-clay-border bg-clay-surface px-3 py-2"
    >
      <label className="flex flex-col gap-1">
        <span className="text-[11px] uppercase tracking-wide text-clay-ink-muted">
          Month
        </span>
        <select
          name="month"
          defaultValue={String(month)}
          className="h-9 rounded-clay-md border border-clay-border bg-clay-surface px-2 text-[13px] text-clay-ink"
        >
          {months.map((m, i) => (
            <option key={m} value={i + 1}>
              {m}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-[11px] uppercase tracking-wide text-clay-ink-muted">
          Year
        </span>
        <select
          name="year"
          defaultValue={String(year)}
          className="h-9 rounded-clay-md border border-clay-border bg-clay-surface px-2 text-[13px] text-clay-ink"
        >
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </label>
      <ClayButton type="submit" variant="obsidian" size="sm">
        Apply
      </ClayButton>
    </form>
  );
}

const STATUS_GLYPH: Record<string, { char: string; cls: string; title: string }> = {
  Present: { char: 'P', cls: 'bg-clay-green-soft text-clay-green', title: 'Present' },
  Absent: { char: 'A', cls: 'bg-clay-red-soft text-clay-red', title: 'Absent' },
  'Half Day': { char: 'H', cls: 'bg-clay-amber-soft text-clay-amber', title: 'Half Day' },
  Leave: { char: 'L', cls: 'bg-clay-blue-soft text-clay-blue', title: 'Leave' },
};

export default async function AttendanceReportPage(props: {
  searchParams: Promise<{ month?: string; year?: string }>;
}) {
  const sp = await props.searchParams;
  const now = new Date();
  const month = sp.month ? parseInt(sp.month) : now.getMonth() + 1;
  const year = sp.year ? parseInt(sp.year) : now.getFullYear();

  const matrix = await getAttendanceMatrix(month, year);
  const daysInMonth = matrix[0]?.days.length || new Date(year, month, 0).getDate();

  const totalPresent = matrix.reduce((s, m) => s + m.summary.present, 0);
  const totalAbsent = matrix.reduce((s, m) => s + m.summary.absent, 0);
  const totalLeave = matrix.reduce((s, m) => s + m.summary.leave, 0);

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="Attendance Report"
        subtitle="Employee × day attendance matrix for the selected month."
        icon={CalendarDays}
        actions={<AttendanceFilter month={month} year={year} />}
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <StatCard label="Employees" value={String(matrix.length)} />
        <StatCard label="Present" value={String(totalPresent)} tone="green" />
        <StatCard label="Absent" value={String(totalAbsent)} tone="red" />
        <StatCard label="On leave" value={String(totalLeave)} tone="blue" />
      </div>

      <ClayCard>
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 bg-clay-surface px-3 py-2 text-left text-[12px] font-semibold text-clay-ink-muted">
                  Employee
                </th>
                {Array.from({ length: daysInMonth }, (_, i) => (
                  <th
                    key={i}
                    className="min-w-[26px] px-1 py-2 text-center text-[11px] font-medium text-clay-ink-muted"
                  >
                    {i + 1}
                  </th>
                ))}
                <th className="px-3 py-2 text-right text-[12px] font-semibold text-clay-ink-muted">
                  P
                </th>
                <th className="px-2 py-2 text-right text-[12px] font-semibold text-clay-ink-muted">
                  A
                </th>
                <th className="px-2 py-2 text-right text-[12px] font-semibold text-clay-ink-muted">
                  L
                </th>
              </tr>
            </thead>
            <tbody>
              {matrix.length === 0 ? (
                <tr>
                  <td
                    colSpan={daysInMonth + 4}
                    className="py-8 text-center text-[13px] text-clay-ink-muted"
                  >
                    No employees found.
                  </td>
                </tr>
              ) : (
                matrix.map((row) => (
                  <tr
                    key={row.employeeId}
                    className="border-t border-clay-border"
                  >
                    <td className="sticky left-0 z-10 bg-clay-surface px-3 py-2 text-[13px] text-clay-ink">
                      {row.employeeName}
                    </td>
                    {row.days.map((d, i) => {
                      const glyph = d.status ? STATUS_GLYPH[d.status] : null;
                      return (
                        <td
                          key={i}
                          className="px-1 py-1 text-center align-middle"
                        >
                          {glyph ? (
                            <span
                              title={`${d.date} — ${glyph.title}`}
                              className={`inline-flex h-5 w-5 items-center justify-center rounded text-[10px] font-semibold ${glyph.cls}`}
                            >
                              {glyph.char}
                            </span>
                          ) : (
                            <span className="text-clay-ink-soft">·</span>
                          )}
                        </td>
                      );
                    })}
                    <td className="px-3 py-2 text-right text-[12.5px] font-medium text-clay-green">
                      {row.summary.present}
                    </td>
                    <td className="px-2 py-2 text-right text-[12.5px] font-medium text-clay-red">
                      {row.summary.absent}
                    </td>
                    <td className="px-2 py-2 text-right text-[12.5px] font-medium text-clay-blue">
                      {row.summary.leave}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </ClayCard>
    </div>
  );
}
