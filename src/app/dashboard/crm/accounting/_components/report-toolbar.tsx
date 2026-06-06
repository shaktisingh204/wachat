'use client';

import { Button, DatePicker, Label } from '@/components/sabcrm/20ui';
import {
  useRouter,
  usePathname,
  useSearchParams } from 'next/navigation';
import { Download } from 'lucide-react';

/**
 * ReportToolbar — date filter + CSV export bar shared by every read-only
 * accounting report page (day-book, trial-balance, pnl, cash-flow,
 * balance-sheet, income-statement).
 *
 * The toolbar is intentionally URL-driven: it pushes `from` / `to`
 * (or `asOf` for balance-sheet) into the search params so the server
 * component handles the data fetch. CSV export is purely client-side and
 * operates on the rows the server already rendered (passed in via props).
 */

import * as React from 'react';

export interface ReportToolbarProps {
  /** Initial "from" date (ISO yyyy-MM-dd). */
  initialFrom?: string;
  /** Initial "to" date (ISO yyyy-MM-dd). */
  initialTo?: string;
  /** Show as a single "as of" picker (balance sheet) instead of a range. */
  mode?: 'range' | 'asOf';
  /** Initial "asOf" date (ISO yyyy-MM-dd) — only used when mode === 'asOf'. */
  initialAsOf?: string;
  /** CSV filename (without the .csv suffix). */
  csvFilename: string;
  /** Header row for CSV. */
  csvHeaders: string[];
  /**
   * Rows for CSV. Each cell is coerced to string and CSV-escaped. Passed
   * in from the server-rendered table so we don't have to re-fetch.
   */
  csvRows: ReadonlyArray<ReadonlyArray<string | number>>;
}

function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function parseISODate(s: string | undefined): Date | undefined {
  if (!s) return undefined;
  const d = new Date(`${s}T00:00:00`);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function csvEscape(v: string | number): string {
  const s = String(v ?? '');
  if (/[",\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function ReportToolbar({
  initialFrom,
  initialTo,
  mode = 'range',
  initialAsOf,
  csvFilename,
  csvHeaders,
  csvRows,
}: ReportToolbarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [from, setFrom] = React.useState<Date | undefined>(
    parseISODate(initialFrom),
  );
  const [to, setTo] = React.useState<Date | undefined>(parseISODate(initialTo));
  const [asOf, setAsOf] = React.useState<Date | undefined>(
    parseISODate(initialAsOf),
  );

  const apply = () => {
    const params = new URLSearchParams(searchParams.toString());
    if (mode === 'asOf') {
      if (asOf) params.set('asOf', toISODate(asOf));
      else params.delete('asOf');
    } else {
      if (from) params.set('from', toISODate(from));
      else params.delete('from');
      if (to) params.set('to', toISODate(to));
      else params.delete('to');
    }
    router.push(`${pathname}?${params.toString()}`);
  };

  const handleExport = () => {
    const lines: string[] = [];
    lines.push(csvHeaders.map(csvEscape).join(','));
    for (const row of csvRows) {
      lines.push(row.map(csvEscape).join(','));
    }
    const blob = new Blob([lines.join('\n')], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${csvFilename}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-wrap items-end gap-3">
      {mode === 'asOf' ? (
        <div className="flex flex-col gap-1.5">
          <Label className="text-[11.5px] text-[var(--st-text-secondary)]">As of</Label>
          <DatePicker value={asOf} onChange={setAsOf} className="w-[180px]" />
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-1.5">
            <Label className="text-[11.5px] text-[var(--st-text-secondary)]">From</Label>
            <DatePicker value={from} onChange={setFrom} className="w-[180px]" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-[11.5px] text-[var(--st-text-secondary)]">To</Label>
            <DatePicker value={to} onChange={setTo} className="w-[180px]" />
          </div>
        </>
      )}
      <Button variant="outline" onClick={apply}>
        Apply
      </Button>
      <Button variant="outline" onClick={handleExport}>
        <Download className="mr-1.5 h-3.5 w-3.5" />
        Export CSV
      </Button>
    </div>
  );
}
