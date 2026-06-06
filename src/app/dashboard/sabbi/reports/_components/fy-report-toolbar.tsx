'use client';

/**
 * FyReportToolbar — date range + FY toggle + Refresh + Export.
 *
 * Used by the finance report pages (income, expense, profit-loss, tax,
 * invoice-aging, payment-report). Pure client component so the export
 * helpers (`downloadCsv`/`downloadXlsx`) — which need `document` and
 * `Blob` — run in the browser.
 *
 * State strategy: URL-driven via `next/navigation`. The toolbar reads
 * the current `from`/`to` from `useSearchParams`, mutates a local copy,
 * and pushes back to the URL on Apply / FY change. Server components
 * downstream re-render with the new range.
 */

import * as React from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { Button, Select, ZoruSelectContent, ZoruSelectItem, ZoruSelectTrigger, ZoruSelectValue } from '@/components/sabcrm/20ui/compat';
import { RefreshCcw, FileDown, FileSpreadsheet } from 'lucide-react';
import { downloadCsv, downloadXlsx, dateStamp, type ExportRow } from '@/lib/crm-list-export';

export interface FyOption {
  label: string;
  /** ISO anchor inside the FY (any day works). */
  anchor: string;
  /** April 1st date as ISO. */
  from: string;
  /** March 31st date as ISO. */
  to: string;
}

export interface FyReportToolbarProps {
  from?: string;
  to?: string;
  exportFilename: string;
  exportHeaders: string[];
  exportRows: ExportRow[];
  /** Override list of selectable FYs. Defaults to current + 2 prior. */
  fyOptions?: FyOption[];
}

function buildFyOptions(): FyOption[] {
  const now = new Date();
  const startYear = now.getMonth() < 3 ? now.getFullYear() - 1 : now.getFullYear();
  const opts: FyOption[] = [];
  for (let i = 0; i < 3; i += 1) {
    const y = startYear - i;
    const from = new Date(y, 3, 1).toISOString().slice(0, 10);
    const to = new Date(y + 1, 2, 31).toISOString().slice(0, 10);
    opts.push({
      label: `FY ${y}-${String((y + 1) % 100).padStart(2, '0')}`,
      anchor: new Date(y, 5, 1).toISOString().slice(0, 10),
      from,
      to,
    });
  }
  return opts;
}

export function FyReportToolbar({
  from,
  to,
  exportFilename,
  exportHeaders,
  exportRows,
  fyOptions,
}: FyReportToolbarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const options = React.useMemo(() => fyOptions ?? buildFyOptions(), [fyOptions]);

  const [fromVal, setFromVal] = React.useState(from ?? options[0]?.from ?? '');
  const [toVal, setToVal] = React.useState(to ?? options[0]?.to ?? '');
  const [isPending, startTransition] = React.useTransition();

  React.useEffect(() => {
    if (from) setFromVal(from);
    if (to) setToVal(to);
  }, [from, to]);

  const pushRange = React.useCallback(
    (nextFrom: string, nextTo: string) => {
      const params = new URLSearchParams(sp?.toString() ?? '');
      params.set('from', nextFrom);
      params.set('to', nextTo);
      params.set('page', '1');
      startTransition(() => {
        router.push(`${pathname}?${params.toString()}`);
      });
    },
    [pathname, router, sp],
  );

  const onApply = (e: React.FormEvent) => {
    e.preventDefault();
    pushRange(fromVal, toVal);
  };

  const onFyChange = (value: string) => {
    const fy = options.find((o) => o.anchor === value);
    if (!fy) return;
    setFromVal(fy.from);
    setToVal(fy.to);
    pushRange(fy.from, fy.to);
  };

  const onRefresh = () => {
    startTransition(() => {
      router.refresh();
    });
  };

  const onCsv = () => {
    downloadCsv(`${exportFilename}-${dateStamp()}.csv`, exportHeaders, exportRows);
  };
  const onXlsx = () => {
    void downloadXlsx(`${exportFilename}-${dateStamp()}.xlsx`, exportHeaders, exportRows, exportFilename);
  };

  const matchedFy = options.find((o) => o.from === fromVal && o.to === toVal);

  return (
    <form
      onSubmit={onApply}
      className="flex flex-wrap items-end gap-2 rounded-lg border border-zoru-line bg-zoru-surface px-3 py-2"
    >
      <label className="flex flex-col gap-1">
        <span className="text-[11px] uppercase tracking-wide text-zoru-ink-muted">FY</span>
        <Select value={matchedFy?.anchor ?? ''} onValueChange={onFyChange}>
          <ZoruSelectTrigger className="h-9 w-[140px] text-[13px]">
            <ZoruSelectValue placeholder="Custom range" />
          </ZoruSelectTrigger>
          <ZoruSelectContent>
            {options.map((o) => (
              <ZoruSelectItem key={o.anchor} value={o.anchor}>
                {o.label}
              </ZoruSelectItem>
            ))}
          </ZoruSelectContent>
        </Select>
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-[11px] uppercase tracking-wide text-zoru-ink-muted">From</span>
        <input
          type="date"
          value={fromVal}
          onChange={(e) => setFromVal(e.target.value)}
          className="h-9 rounded-lg border border-zoru-line bg-zoru-surface px-2 text-[13px] text-zoru-ink"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-[11px] uppercase tracking-wide text-zoru-ink-muted">To</span>
        <input
          type="date"
          value={toVal}
          onChange={(e) => setToVal(e.target.value)}
          className="h-9 rounded-lg border border-zoru-line bg-zoru-surface px-2 text-[13px] text-zoru-ink"
        />
      </label>

      <Button type="submit" size="sm" disabled={isPending}>
        Apply
      </Button>
      <Button type="button" size="sm" variant="outline" onClick={onRefresh} disabled={isPending} aria-label="Refresh">
        <RefreshCcw className="h-3.5 w-3.5" />
        Refresh
      </Button>
      <Button type="button" size="sm" variant="outline" onClick={onCsv} aria-label="Export CSV">
        <FileDown className="h-3.5 w-3.5" />
        CSV
      </Button>
      <Button type="button" size="sm" variant="outline" onClick={onXlsx} aria-label="Export XLSX">
        <FileSpreadsheet className="h-3.5 w-3.5" />
        XLSX
      </Button>
    </form>
  );
}
