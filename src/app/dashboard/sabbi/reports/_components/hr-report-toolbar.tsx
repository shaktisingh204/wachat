'use client';

import * as React from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import {
  Button,
  Field,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/sabcrm/20ui';
import { RefreshCw } from 'lucide-react';
import {
  ReportExportButton,
  type ReportExportButtonProps,
} from './report-export-button';

export interface DepartmentOption {
  id: string;
  name: string;
}

export interface HrReportToolbarProps {
  from?: string;
  to?: string;
  departmentId?: string;
  departments: DepartmentOption[];
  /** Hide the date range pair (used by leave-balance report). */
  hideDateRange?: boolean;
  /** Replace the date range with a month/year picker. */
  monthPicker?: { month: number; year: number };
  /** Window (days) selector, used by birthday/anniversary. */
  windowDays?: number;
  exportProps?: ReportExportButtonProps;
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const WINDOW_OPTIONS = [
  { value: 7, label: 'Next 7 days' },
  { value: 30, label: 'Next 30 days' },
  { value: 90, label: 'Next 90 days' },
];

/**
 * <HrReportToolbar /> is the canonical filter toolbar for HR / people report
 * pages. Renders a URL-driven form (`method="get"`) so the surrounding page can
 * stay a server component while still getting Refresh + Export client-side
 * affordances. The 20ui Select root mirrors its value into a hidden native
 * control, so GET submission keeps working unchanged.
 *
 * Sections (left to right):
 *   - Date range  (or Month picker, or Window-days picker)
 *   - Department select
 *   - Apply / Refresh
 *   - Export (CSV / XLSX), client-only
 */
export function HrReportToolbar({
  from,
  to,
  departmentId,
  departments,
  hideDateRange,
  monthPicker,
  windowDays,
  exportProps,
}: HrReportToolbarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const onRefresh = React.useCallback(() => {
    router.replace(`${pathname}?${sp.toString()}`, { scroll: false });
    router.refresh();
  }, [router, pathname, sp]);

  const thisYear = new Date().getFullYear();
  const years = React.useMemo(
    () => Array.from({ length: 5 }, (_, i) => thisYear - 2 + i),
    [thisYear],
  );

  // Radix Select reserves the empty string, so the "all departments" option
  // rides a sentinel value. A hidden field carries the resolved id (empty for
  // "all") so the GET form submits the same `departmentId` param as before.
  const ALL_DEPARTMENTS = '__all__';
  const [dept, setDept] = React.useState(departmentId || ALL_DEPARTMENTS);
  const resolvedDept = dept === ALL_DEPARTMENTS ? '' : dept;

  return (
    <form
      method="get"
      className="flex flex-wrap items-end gap-2 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-3 py-2"
    >
      {monthPicker ? (
        <>
          <Field label="Month" className="min-w-[140px]">
            <Select name="month" defaultValue={String(monthPicker.month)}>
              <SelectTrigger aria-label="Month">
                <SelectValue placeholder="Month" />
              </SelectTrigger>
              <SelectContent>
                {MONTHS.map((m, i) => (
                  <SelectItem key={m} value={String(i + 1)}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Year" className="min-w-[110px]">
            <Select name="year" defaultValue={String(monthPicker.year)}>
              <SelectTrigger aria-label="Year">
                <SelectValue placeholder="Year" />
              </SelectTrigger>
              <SelectContent>
                {years.map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </>
      ) : hideDateRange ? null : windowDays !== undefined ? (
        <Field label="Window" className="min-w-[150px]">
          <Select name="days" defaultValue={String(windowDays)}>
            <SelectTrigger aria-label="Window">
              <SelectValue placeholder="Window" />
            </SelectTrigger>
            <SelectContent>
              {WINDOW_OPTIONS.map((w) => (
                <SelectItem key={w.value} value={String(w.value)}>
                  {w.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      ) : (
        <>
          <Field label="From">
            <Input type="date" name="from" defaultValue={from} inputSize="sm" />
          </Field>
          <Field label="To">
            <Input type="date" name="to" defaultValue={to} inputSize="sm" />
          </Field>
        </>
      )}

      <input type="hidden" name="departmentId" value={resolvedDept} />
      <Field label="Department" className="min-w-[160px]">
        <Select value={dept} onValueChange={setDept}>
          <SelectTrigger aria-label="Department">
            <SelectValue placeholder="All departments" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_DEPARTMENTS}>All departments</SelectItem>
            {departments.map((d) => (
              <SelectItem key={d.id} value={d.id}>
                {d.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Button type="submit" variant="primary" size="sm">
        Apply
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        iconLeft={RefreshCw}
        onClick={onRefresh}
      >
        Refresh
      </Button>
      {exportProps ? <ReportExportButton {...exportProps} /> : null}
    </form>
  );
}
