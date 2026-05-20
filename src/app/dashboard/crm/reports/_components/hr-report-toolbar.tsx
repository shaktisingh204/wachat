'use client';

import * as React from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { ZoruButton } from '@/components/zoruui';
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
  /** Window (days) selector — used by birthday/anniversary. */
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
 * <HrReportToolbar /> — canonical filter toolbar for HR / people report
 * pages. Renders a URL-driven form (`method="get"`) so the surrounding
 * page can stay a server component while still getting Refresh + Export
 * client-side affordances.
 *
 * Sections (left → right):
 *   • Date range  (or Month picker, or Window-days picker)
 *   • Department select
 *   • Apply / Refresh
 *   • Export (CSV / XLSX) — client-only
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

  return (
    <form
      method="get"
      className="flex flex-wrap items-end gap-2 rounded-lg border border-border bg-card px-3 py-2"
    >
      {monthPicker ? (
        <>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Month
            </span>
            <select
              name="month"
              defaultValue={String(monthPicker.month)}
              className="h-9 rounded-lg border border-border bg-card px-2 text-[13px] text-foreground"
            >
              {MONTHS.map((m, i) => (
                <option key={m} value={i + 1}>
                  {m}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Year
            </span>
            <select
              name="year"
              defaultValue={String(monthPicker.year)}
              className="h-9 rounded-lg border border-border bg-card px-2 text-[13px] text-foreground"
            >
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </label>
        </>
      ) : hideDateRange ? null : windowDays !== undefined ? (
        <label className="flex flex-col gap-1">
          <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Window
          </span>
          <select
            name="days"
            defaultValue={String(windowDays)}
            className="h-9 rounded-lg border border-border bg-card px-2 text-[13px] text-foreground"
          >
            {WINDOW_OPTIONS.map((w) => (
              <option key={w.value} value={w.value}>
                {w.label}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
              From
            </span>
            <input
              type="date"
              name="from"
              defaultValue={from}
              className="h-9 rounded-lg border border-border bg-card px-2 text-[13px] text-foreground"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
              To
            </span>
            <input
              type="date"
              name="to"
              defaultValue={to}
              className="h-9 rounded-lg border border-border bg-card px-2 text-[13px] text-foreground"
            />
          </label>
        </>
      )}

      <label className="flex flex-col gap-1">
        <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
          Department
        </span>
        <select
          name="departmentId"
          defaultValue={departmentId || ''}
          className="h-9 min-w-[160px] rounded-lg border border-border bg-card px-2 text-[13px] text-foreground"
        >
          <option value="">All departments</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </label>

      <ZoruButton type="submit" size="sm">
        Apply
      </ZoruButton>
      <ZoruButton
        type="button"
        size="sm"
        variant="outline"
        onClick={onRefresh}
      >
        <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
        Refresh
      </ZoruButton>
      {exportProps ? <ReportExportButton {...exportProps} /> : null}
    </form>
  );
}
