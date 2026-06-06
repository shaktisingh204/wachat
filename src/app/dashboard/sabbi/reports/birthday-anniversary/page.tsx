export const dynamic = 'force-dynamic';

import * as React from 'react';
import { Cake, Gift, Mail } from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/components/sabcrm/20ui';

function safeFormatDate(isoString: string) {
  if (!isoString) return '—';
  const [y, m, d] = isoString.split('T')[0].split('-').map(Number);
  const currentYear = new Date().getFullYear();
  const isLeapYear = (year: number) => (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  
  let displayDay = d;
  if (m === 2 && d === 29 && !isLeapYear(currentYear)) {
    displayDay = 28;
  }
  
  return format(new Date(y, m - 1, displayDay), 'PP');
}

import { Badge, Card, Table, TBody, Td, Th, THead, Tr } from '@/components/sabcrm/20ui';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import { EntityRowLink } from '@/components/crm/entity-row-link';
import { PaginationBar } from '@/components/crm/pagination-bar';

import { StatCard, fmtNumber } from '../_components/report-toolbar';
import { HrReportToolbar } from '../_components/hr-report-toolbar';
import {
  getHrReportDepartments,
  getBirthdayAnniversaryDeep,
} from '@/app/actions/crm-reports.actions';

interface PageProps {
  searchParams: Promise<{
    days?: string;
    departmentId?: string;
    page?: string;
    limit?: string;
  }>;
}

export default async function BirthdayAnniversaryPage(props: PageProps) {
  const sp = await props.searchParams;
  const days = sp.days ? Math.max(1, parseInt(sp.days, 10)) : 30;
  const page = Math.max(1, sp.page ? parseInt(sp.page, 10) : 1);
  const limit = Math.min(100, Math.max(5, sp.limit ? parseInt(sp.limit, 10) : 20));

  const [departments, report] = await Promise.all([
    getHrReportDepartments(),
    getBirthdayAnniversaryDeep(days, sp.departmentId),
  ]);

  const { rows, today, totals } = report;
  const birthdays = rows.filter((r) => r.kind === 'birthday');
  const anniversaries = rows.filter((r) => r.kind === 'anniversary');

  const pageRows = rows.slice((page - 1) * limit, page * limit);
  const hasMore = page * limit < rows.length;

  const exportHeaders = [
    'Employee',
    'Department',
    'Kind',
    'Date',
    'Years',
  ];
  const exportRows = rows.map((r) => ({
    Employee: r.employeeName,
    Department: r.department,
    Kind: r.kind,
    Date: r.date.slice(0, 10),
    Years: r.years ?? '',
  }));

  return (
    <EntityListShell
      title="Birthdays & Anniversaries"
      subtitle={`Upcoming events in the next ${days} days.`}
      primaryAction={
        <HrReportToolbar
          windowDays={days}
          departmentId={sp.departmentId}
          departments={departments}
          exportProps={{
            filename: 'birthdays-anniversaries',
            headers: exportHeaders,
            rows: exportRows,
            sheetName: 'Events',
          }}
        />
      }
      pagination={
        <PaginationBar
          page={page}
          limit={limit}
          hasMore={hasMore}
          total={rows.length}
        />
      }
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Today"
          value={fmtNumber(totals.todayBirthdays)}
          tone="blue"
          hint="birthdays"
        />
        <StatCard
          label="This week"
          value={fmtNumber(totals.weekBirthdays)}
          tone="blue"
          hint="birthdays"
        />
        <StatCard
          label="This month"
          value={fmtNumber(totals.monthBirthdays)}
          tone="green"
          hint="birthdays"
        />
        <StatCard
          label="Anniversaries"
          value={fmtNumber(totals.monthAnniversaries)}
          tone="amber"
          hint="this month"
        />
      </div>

      {today.length > 0 ? (
        <Card className="p-6">
          <div className="mb-3 flex items-center gap-2">
            <Cake className="h-4 w-4 text-[var(--st-text)]" />
            <h2 className="text-[16px] font-semibold text-[var(--st-text)]">
              Today
            </h2>
            <Badge variant="info">{today.length}</Badge>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {today.map((r) => (
              <div
                key={`${r.employeeId}-${r.kind}-today`}
                className="flex items-center justify-between rounded-lg border border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-3 py-2"
              >
                <EntityRowLink
                  href={`/dashboard/crm/hr-payroll/employees/${r.employeeId}`}
                  label={r.employeeName}
                  subtitle={r.department}
                />
                <Badge variant={r.kind === 'birthday' ? 'info' : 'success'}>
                  {r.kind === 'birthday' ? 'Birthday' : `${r.years ?? ''}y`}
                </Badge>
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="p-6">
          <div className="mb-3 flex items-center gap-2">
            <Cake className="h-4 w-4 text-[var(--st-text)]" />
            <h2 className="text-[16px] font-semibold text-[var(--st-text)]">
              Upcoming birthdays
            </h2>
            <Badge variant="outline">{birthdays.length}</Badge>
          </div>
          {birthdays.length === 0 ? (
            <div className="py-8 text-center text-[13px] text-[var(--st-text-secondary)]">
              None in this window.
            </div>
          ) : (
            <ul className="flex flex-col divide-y divide-[var(--st-border)]">
              {birthdays.slice(0, 10).map((r) => (
                <li
                  key={`${r.employeeId}-b`}
                  className="flex items-center justify-between py-2.5"
                >
                  <EntityRowLink
                    href={`/dashboard/crm/hr-payroll/employees/${r.employeeId}`}
                    label={r.employeeName}
                    subtitle={r.department}
                  />
                  <div className="flex items-center gap-2">
                    <Badge variant="info">
                      {safeFormatDate(r.date)}
                    </Badge>
                    <Button variant="ghost" size="icon" className="h-6 w-6" title="Send Email Greeting">
                      <Mail className="h-3 w-3" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-6">
          <div className="mb-3 flex items-center gap-2">
            <Gift className="h-4 w-4 text-[var(--st-text)]" />
            <h2 className="text-[16px] font-semibold text-[var(--st-text)]">
              Upcoming anniversaries
            </h2>
            <Badge variant="outline">{anniversaries.length}</Badge>
          </div>
          {anniversaries.length === 0 ? (
            <div className="py-8 text-center text-[13px] text-[var(--st-text-secondary)]">
              None in this window.
            </div>
          ) : (
            <ul className="flex flex-col divide-y divide-[var(--st-border)]">
              {anniversaries.slice(0, 10).map((r) => (
                <li
                  key={`${r.employeeId}-a`}
                  className="flex items-center justify-between gap-3 py-2.5"
                >
                  <EntityRowLink
                    href={`/dashboard/crm/hr-payroll/employees/${r.employeeId}`}
                    label={r.employeeName}
                    subtitle={`${r.department} · ${r.years ?? '—'} ${r.years === 1 ? 'year' : 'years'}`}
                  />
                  <div className="flex items-center gap-2">
                    <Badge variant="success">
                      {safeFormatDate(r.date)}
                    </Badge>
                    <Button variant="ghost" size="icon" className="h-6 w-6" title="Send Email Greeting">
                      <Mail className="h-3 w-3" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card className="p-0">
        <div className="overflow-x-auto rounded-lg border border-[var(--st-border)]">
          <Table>
            <THead>
              <Tr className="border-[var(--st-border)] hover:bg-transparent">
                <Th className="text-[var(--st-text-secondary)]">Employee</Th>
                <Th className="text-[var(--st-text-secondary)]">Department</Th>
                <Th className="text-[var(--st-text-secondary)]">Kind</Th>
                <Th className="text-right text-[var(--st-text-secondary)]">Date</Th>
                <Th className="text-right text-[var(--st-text-secondary)]">Years</Th>
              </Tr>
            </THead>
            <TBody>
              {pageRows.length === 0 ? (
                <Tr className="border-[var(--st-border)]">
                  <Td
                    colSpan={5}
                    className="h-20 text-center text-[13px] text-[var(--st-text-secondary)]"
                  >
                    No upcoming events.
                  </Td>
                </Tr>
              ) : (
                pageRows.map((r, i) => (
                  <Tr
                    key={`${r.employeeId}-${r.kind}-${i}`}
                    className="border-[var(--st-border)]"
                  >
                    <Td>
                      <EntityRowLink
                        href={`/dashboard/crm/hr-payroll/employees/${r.employeeId}`}
                        label={r.employeeName}
                      />
                    </Td>
                    <Td className="text-[13px] text-[var(--st-text)]">
                      <Badge variant="outline">{r.department}</Badge>
                    </Td>
                    <Td>
                      <Badge variant={r.kind === 'birthday' ? 'info' : 'success'}>
                        {r.kind}
                      </Badge>
                    </Td>
                    <Td className="text-right text-[13px] text-[var(--st-text)]">
                      <div className="flex items-center justify-end gap-2">
                        <span>{safeFormatDate(r.date)}</span>
                        <Button variant="ghost" size="icon" className="h-6 w-6" title="Send Email Greeting">
                          <Mail className="h-3 w-3" />
                        </Button>
                      </div>
                    </Td>
                    <Td className="text-right text-[13px] text-[var(--st-text-secondary)]">
                      {r.years ?? '—'}
                    </Td>
                  </Tr>
                ))
              )}
            </TBody>
          </Table>
        </div>
      </Card>
    </EntityListShell>
  );
}
