'use client';

/**
 * SabCRM Finance — statement export + print buttons (spec §4.3).
 *
 * The statement pages are fully server-rendered; the table data is
 * already on the page, so CSV export serialises CLIENT-SIDE from the
 * `rows` prop — no server round-trip, no action call. Each page maps
 * its report rows into flat `Record<string, string | number>` objects
 * (key order = column order) and mounts these in the `ReportShell`
 * `actions` slot next to the PeriodSwitcher.
 *
 * Print relies on the `@media print` block in `finance-report.css`
 * (copied from the doc-surface paper pattern): everything outside the
 * `.fin-report` shell is hidden, and the `[data-print-hide]` actions
 * row is dropped, so `window.print()` yields a clean statement.
 *
 * ONLY `@/components/sabcrm/20ui` barrel imports (repo rule).
 */

import * as React from 'react';
import { Download, Printer } from 'lucide-react';

import { Button } from '@/components/sabcrm/20ui';

/** One CSV row; insertion order of the FIRST row defines the columns. */
export type StatementCsvRow = Record<string, string | number>;

function csvEscape(s: string): string {
  return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}

function toCsv(rows: StatementCsvRow[]): string {
  const headers = Object.keys(rows[0] ?? {});
  const head = headers.map(csvEscape).join(',');
  const body = rows.map((row) =>
    headers.map((h) => csvEscape(String(row[h] ?? ''))).join(','),
  );
  return `${[head, ...body].join('\n')}\n`;
}

export interface StatementExportButtonProps {
  /** Flat, display-ready rows (already formatted/rounded by the page). */
  rows: StatementCsvRow[];
  /** Download name, e.g. `pnl-fy2026-27.csv`. */
  fileName: string;
  /** Button caption; defaults to "Export CSV". */
  label?: string;
}

/** Client-side CSV download of the statement rows on the page. */
export function StatementExportButton({
  rows,
  fileName,
  label = 'Export CSV',
}: StatementExportButtonProps): React.JSX.Element {
  const onExport = (): void => {
    if (rows.length === 0) return;
    const blob = new Blob([toCsv(rows)], {
      type: 'text/csv;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Button
      variant="secondary"
      size="sm"
      iconLeft={Download}
      onClick={onExport}
      disabled={rows.length === 0}
    >
      {label}
    </Button>
  );
}

/** Print the statement (print CSS isolates the report body). */
export function StatementPrintButton(): React.JSX.Element {
  return (
    <Button
      variant="ghost"
      size="sm"
      iconLeft={Printer}
      onClick={() => window.print()}
      aria-label="Print this statement"
    >
      Print
    </Button>
  );
}
