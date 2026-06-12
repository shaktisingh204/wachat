'use client';

/**
 * SabCRM People — Employees list client (`/sabcrm/people/employees`).
 *
 * People-suite flagship adopter of the doc-surface kit: KPI strip
 * (headcount / active / on-leave / joiners-this-month), config-driven
 * list (typed columns, search + status + department + joining-date
 * filters, server pagination, CSV export). "New employee" routes to
 * the full-page grouped create form (`/new`) — the create-DTO field
 * set is far too large for a dialog.
 *
 * Every row is display-ready: departments render as RESOLVED labels —
 * never a raw ObjectId — and the kit's empty/error states handle the
 * first-run and engine-down cases.
 */

import * as React from 'react';
import Link from 'next/link';
import {
  CalendarOff,
  Plus,
  UserCheck,
  UserPlus,
  Users,
} from 'lucide-react';

import { Button } from '@/components/sabcrm/20ui';
import { KpiCard } from '@/components/sabcrm/20ui/composites/charts';

import {
  DocListPage,
  type DocListColumn,
  type DocListPageConfig,
} from '../../finance/_components/doc-surface';
import {
  EMPLOYEE_STATUSES,
  PEOPLE_EMPLOYEES_PATH,
  employeeDetailHref,
  employmentTypeLabel,
  toEmployeeFilters,
} from './employees-config';

import {
  exportSabcrmEmployeeRows,
  listSabcrmEmployeesPage,
  searchSabcrmDepartments,
} from '@/app/actions/sabcrm-people-employees.actions';
import type {
  SabcrmEmployeeKpis,
  SabcrmEmployeeListRow,
} from '@/app/actions/sabcrm-people-employees.actions.types';

/* ─── Columns ─────────────────────────────────────────────────── */

const COLUMNS: DocListColumn<SabcrmEmployeeListRow>[] = [
  {
    key: 'employeeCode',
    header: 'Employee ID',
    kind: 'text',
    value: (r) => r.employeeCode,
  },
  {
    key: 'employee',
    header: 'Employee',
    kind: 'party',
    value: (r) => r.name,
    csv: (r) => `${r.name}${r.workEmail ? ` <${r.workEmail}>` : ''}`,
  },
  {
    key: 'designation',
    header: 'Designation',
    kind: 'text',
    value: (r) => r.designation,
  },
  {
    key: 'department',
    header: 'Department',
    kind: 'party',
    value: (r) => r.departmentLabel,
  },
  {
    key: 'employmentType',
    header: 'Type',
    kind: 'badge',
    value: (r) => employmentTypeLabel(r.employmentType),
  },
  {
    key: 'joiningDate',
    header: 'Joined',
    kind: 'date',
    value: (r) => r.joiningDate,
  },
  {
    key: 'ctc',
    header: 'CTC',
    kind: 'money',
    value: (r) => r.ctc,
    currency: (r) => r.currency,
  },
  {
    key: 'status',
    header: 'Status',
    kind: 'status',
    value: (r) => r.status,
  },
];

/* ─── Component ───────────────────────────────────────────────── */

export interface EmployeesClientProps {
  initialRows: SabcrmEmployeeListRow[];
  initialHasMore: boolean;
  initialError: string | null;
  kpis: SabcrmEmployeeKpis | null;
}

export function EmployeesClient({
  initialRows,
  initialHasMore,
  initialError,
  kpis,
}: EmployeesClientProps): React.JSX.Element {
  const config = React.useMemo<DocListPageConfig<SabcrmEmployeeListRow>>(
    () => ({
      title: 'Employees',
      description:
        'The workspace roster — search, filter, onboard and export your people directory.',
      icon: Users,
      entity: { singular: 'employee', plural: 'employees' },
      columns: COLUMNS,
      statuses: EMPLOYEE_STATUSES,
      fetchPage: async (filters) => {
        const res = await listSabcrmEmployeesPage(toEmployeeFilters(filters));
        return res.ok
          ? { ok: true, data: { rows: res.data.rows, hasMore: res.data.hasMore } }
          : res;
      },
      fetchAllForCsv: (filters) =>
        exportSabcrmEmployeeRows(toEmployeeFilters(filters)),
      csvFileName: 'employees.csv',
      rowHref: (row) => employeeDetailHref(row.id),
      rowLabel: (row) => `employee ${row.name}`,
      partyFilter: {
        placeholder: 'Any department',
        search: async (q) => {
          const res = await searchSabcrmDepartments(q);
          return res.ok ? res.data : [];
        },
      },
    }),
    [],
  );

  const kpiStrip = kpis ? (
    <>
      <KpiCard
        label="Headcount"
        icon={Users}
        value={String(kpis.headcount)}
        delta={
          kpis.sampled
            ? 'Across the latest 500 records'
            : kpis.headcount === 1
              ? 'employee on the roster'
              : 'employees on the roster'
        }
      />
      <KpiCard
        label="Active"
        icon={UserCheck}
        value={String(kpis.active)}
        delta="Currently employed and working"
        deltaTone={kpis.active > 0 ? 'up' : 'neutral'}
      />
      <KpiCard
        label="On leave"
        icon={CalendarOff}
        value={String(kpis.onLeave)}
        delta={kpis.onLeave === 1 ? 'employee away' : 'employees away'}
        deltaTone={kpis.onLeave > 0 ? 'down' : 'neutral'}
      />
      <KpiCard
        label="Joiners this month"
        icon={UserPlus}
        value={String(kpis.joinersThisMonth)}
        delta="New joining dates this month"
        deltaTone={kpis.joinersThisMonth > 0 ? 'up' : 'neutral'}
      />
    </>
  ) : null;

  return (
    <DocListPage
      config={config}
      kpis={kpiStrip}
      primaryAction={
        <Button variant="primary" iconLeft={Plus} asChild>
          <Link href={`${PEOPLE_EMPLOYEES_PATH}/new`}>New employee</Link>
        </Button>
      }
      initialRows={initialRows}
      initialHasMore={initialHasMore}
      initialError={initialError}
    />
  );
}
