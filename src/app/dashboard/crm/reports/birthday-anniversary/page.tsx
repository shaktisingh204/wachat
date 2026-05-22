export const dynamic = 'force-dynamic';

import * as React from 'react';
import { Cake, Gift } from 'lucide-react';
import { format } from 'date-fns';

import {
  Badge,
  Card,
  Table,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
} from '@/components/zoruui';
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
            <Cake className="h-4 w-4 text-primary" />
            <h2 className="text-[16px] font-semibold text-foreground">
              Today
            </h2>
            <Badge variant="info">{today.length}</Badge>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {today.map((r) => (
              <div
                key={`${r.employeeId}-${r.kind}-today`}
                className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2"
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
            <Cake className="h-4 w-4 text-primary" />
            <h2 className="text-[16px] font-semibold text-foreground">
              Upcoming birthdays
            </h2>
            <Badge variant="outline">{birthdays.length}</Badge>
          </div>
          {birthdays.length === 0 ? (
            <div className="py-8 text-center text-[13px] text-muted-foreground">
              None in this window.
            </div>
          ) : (
            <ul className="flex flex-col divide-y divide-border">
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
                  <Badge variant="info">
                    {format(new Date(r.date), 'PP')}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-6">
          <div className="mb-3 flex items-center gap-2">
            <Gift className="h-4 w-4 text-primary" />
            <h2 className="text-[16px] font-semibold text-foreground">
              Upcoming anniversaries
            </h2>
            <Badge variant="outline">{anniversaries.length}</Badge>
          </div>
          {anniversaries.length === 0 ? (
            <div className="py-8 text-center text-[13px] text-muted-foreground">
              None in this window.
            </div>
          ) : (
            <ul className="flex flex-col divide-y divide-border">
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
                  <Badge variant="success">
                    {format(new Date(r.date), 'PP')}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card className="p-0">
        <div className="overflow-x-auto rounded-lg border border-border">
          <Table>
            <ZoruTableHeader>
              <ZoruTableRow className="border-border hover:bg-transparent">
                <ZoruTableHead className="text-muted-foreground">Employee</ZoruTableHead>
                <ZoruTableHead className="text-muted-foreground">Department</ZoruTableHead>
                <ZoruTableHead className="text-muted-foreground">Kind</ZoruTableHead>
                <ZoruTableHead className="text-right text-muted-foreground">Date</ZoruTableHead>
                <ZoruTableHead className="text-right text-muted-foreground">Years</ZoruTableHead>
              </ZoruTableRow>
            </ZoruTableHeader>
            <ZoruTableBody>
              {pageRows.length === 0 ? (
                <ZoruTableRow className="border-border">
                  <ZoruTableCell
                    colSpan={5}
                    className="h-20 text-center text-[13px] text-muted-foreground"
                  >
                    No upcoming events.
                  </ZoruTableCell>
                </ZoruTableRow>
              ) : (
                pageRows.map((r, i) => (
                  <ZoruTableRow
                    key={`${r.employeeId}-${r.kind}-${i}`}
                    className="border-border"
                  >
                    <ZoruTableCell>
                      <EntityRowLink
                        href={`/dashboard/crm/hr-payroll/employees/${r.employeeId}`}
                        label={r.employeeName}
                      />
                    </ZoruTableCell>
                    <ZoruTableCell className="text-[13px] text-foreground">
                      <Badge variant="outline">{r.department}</Badge>
                    </ZoruTableCell>
                    <ZoruTableCell>
                      <Badge variant={r.kind === 'birthday' ? 'info' : 'success'}>
                        {r.kind}
                      </Badge>
                    </ZoruTableCell>
                    <ZoruTableCell className="text-right text-[13px] text-foreground">
                      {format(new Date(r.date), 'PP')}
                    </ZoruTableCell>
                    <ZoruTableCell className="text-right text-[13px] text-muted-foreground">
                      {r.years ?? '—'}
                    </ZoruTableCell>
                  </ZoruTableRow>
                ))
              )}
            </ZoruTableBody>
          </Table>
        </div>
      </Card>
    </EntityListShell>
  );
}
