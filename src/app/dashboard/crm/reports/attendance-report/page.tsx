import { ZoruButton, ZoruCard } from '@/components/zoruui';

export const dynamic = 'force-dynamic';

import { EntityListShell } from '@/components/crm/entity-list-shell';
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
      className="flex flex-wrap items-end gap-2 rounded-lg border border-zoru-line bg-zoru-bg px-3 py-2"
    >
      <label className="flex flex-col gap-1">
        <span className="text-[11px] uppercase tracking-wide text-zoru-ink-muted">
          Month
        </span>
        <select
          name="month"
          defaultValue={String(month)}
          className="h-9 rounded-lg border border-zoru-line bg-zoru-bg px-2 text-[13px] text-zoru-ink"
        >
          {months.map((m, i) => (
            <option key={m} value={i + 1}>
              {m}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-[11px] uppercase tracking-wide text-zoru-ink-muted">
          Year
        </span>
        <select
          name="year"
          defaultValue={String(year)}
          className="h-9 rounded-lg border border-zoru-line bg-zoru-bg px-2 text-[13px] text-zoru-ink"
        >
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </label>
      <ZoruButton type="submit" size="sm">
        Apply
      </ZoruButton>
    </form>
  );
}

const STATUS_GLYPH: Record<string, { char: string; cls: string; title: string }> = {
  Present: { char: 'P', cls: 'bg-emerald-50 text-zoru-success-ink', title: 'Present' },
  Absent: { char: 'A', cls: 'bg-rose-50 text-zoru-danger-ink', title: 'Absent' },
  'Half Day': { char: 'H', cls: 'bg-amber-50 text-zoru-warning-ink', title: 'Half Day' },
  Leave: { char: 'L', cls: 'bg-sky-50 text-zoru-info-ink', title: 'Leave' },
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
    <EntityListShell
      title="Attendance Report"
      subtitle="Employee × day attendance matrix for the selected month."
      primaryAction={<AttendanceFilter month={month} year={year} />}
    >

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <StatCard label="Employees" value={String(matrix.length)} />
        <StatCard label="Present" value={String(totalPresent)} tone="green" />
        <StatCard label="Absent" value={String(totalAbsent)} tone="red" />
        <StatCard label="On leave" value={String(totalLeave)} tone="blue" />
      </div>

      <ZoruCard className="p-6">
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 bg-zoru-bg px-3 py-2 text-left text-[12px] font-semibold text-zoru-ink-muted">
                  Employee
                </th>
                {Array.from({ length: daysInMonth }, (_, i) => (
                  <th
                    key={i}
                    className="min-w-[26px] px-1 py-2 text-center text-[11px] font-medium text-zoru-ink-muted"
                  >
                    {i + 1}
                  </th>
                ))}
                <th className="px-3 py-2 text-right text-[12px] font-semibold text-zoru-ink-muted">
                  P
                </th>
                <th className="px-2 py-2 text-right text-[12px] font-semibold text-zoru-ink-muted">
                  A
                </th>
                <th className="px-2 py-2 text-right text-[12px] font-semibold text-zoru-ink-muted">
                  L
                </th>
              </tr>
            </thead>
            <tbody>
              {matrix.length === 0 ? (
                <tr>
                  <td
                    colSpan={daysInMonth + 4}
                    className="py-8 text-center text-[13px] text-zoru-ink-muted"
                  >
                    No employees found.
                  </td>
                </tr>
              ) : (
                matrix.map((row) => (
                  <tr
                    key={row.employeeId}
                    className="border-t border-zoru-line"
                  >
                    <td className="sticky left-0 z-10 bg-zoru-bg px-3 py-2 text-[13px] text-zoru-ink">
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
                            <span className="text-zoru-ink-muted">·</span>
                          )}
                        </td>
                      );
                    })}
                    <td className="px-3 py-2 text-right text-[12.5px] font-medium text-zoru-success-ink">
                      {row.summary.present}
                    </td>
                    <td className="px-2 py-2 text-right text-[12.5px] font-medium text-zoru-danger-ink">
                      {row.summary.absent}
                    </td>
                    <td className="px-2 py-2 text-right text-[12.5px] font-medium text-zoru-info-ink">
                      {row.summary.leave}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </ZoruCard>
    </EntityListShell>
  );
}
