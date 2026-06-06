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
      className="flex flex-wrap items-end gap-2 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-3 py-2"
    >
      <Field label="FY" className="gap-1">
        <Select value={matchedFy?.anchor ?? ''} onValueChange={onFyChange}>
          <SelectTrigger aria-label="Financial year" className="h-9 w-[140px] text-[13px]">
            <SelectValue placeholder="Custom range" />
          </SelectTrigger>
          <SelectContent>
            {options.map((o) => (
              <SelectItem key={o.anchor} value={o.anchor}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field label="From" className="gap-1">
        <Input
          type="date"
          inputSize="sm"
          value={fromVal}
          onChange={(e) => setFromVal(e.target.value)}
          className="h-9 w-[150px] text-[13px]"
        />
      </Field>

      <Field label="To" className="gap-1">
        <Input
          type="date"
          inputSize="sm"
          value={toVal}
          onChange={(e) => setToVal(e.target.value)}
          className="h-9 w-[150px] text-[13px]"
        />
      </Field>

      <Button type="submit" size="sm" disabled={isPending}>
        Apply
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        iconLeft={RefreshCcw}
        onClick={onRefresh}
        disabled={isPending}
      >
        Refresh
      </Button>
      <Button type="button" size="sm" variant="outline" iconLeft={FileDown} onClick={onCsv}>
        CSV
      </Button>
      <Button type="button" size="sm" variant="outline" iconLeft={FileSpreadsheet} onClick={onXlsx}>
        XLSX
      </Button>
    </form>
  );
}
