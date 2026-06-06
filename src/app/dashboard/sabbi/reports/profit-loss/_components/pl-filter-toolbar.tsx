'use client';

import * as React from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { Button } from '@/components/sabcrm/20ui';
import { RefreshCcw, FileDown, FileSpreadsheet } from 'lucide-react';
import {
  downloadCsv,
  downloadXlsx,
  dateStamp,
  type ExportRow,
} from '@/lib/crm-list-export';

interface Props {
  from?: string;
  to?: string;
  granularity: string;
  department: string;
  exportHeaders: string[];
  exportRows: ExportRow[];
}

function buildFyOptions() {
  const now = new Date();
  const startYear =
    now.getMonth() < 3 ? now.getFullYear() - 1 : now.getFullYear();
  return Array.from({ length: 3 }, (_, i) => {
    const y = startYear - i;
    return {
      label: `FY ${y}-${String((y + 1) % 100).padStart(2, '0')}`,
      from: new Date(y, 3, 1).toISOString().slice(0, 10),
      to: new Date(y + 1, 2, 31).toISOString().slice(0, 10),
    };
  });
}

export function PlFilterToolbar({
  from,
  to,
  granularity,
  department,
  exportHeaders,
  exportRows,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [isPending, startTransition] = React.useTransition();

  const fyOptions = React.useMemo(() => buildFyOptions(), []);
  const matchedFy = fyOptions.find((o) => o.from === from && o.to === to);

  const [fromVal, setFromVal] = React.useState(from ?? fyOptions[0]?.from ?? '');
  const [toVal, setToVal] = React.useState(to ?? fyOptions[0]?.to ?? '');
  const [granularityVal, setGranularityVal] = React.useState(
    granularity || 'monthly',
  );
  const [deptVal, setDeptVal] = React.useState(department);

  React.useEffect(() => {
    if (from) setFromVal(from);
    if (to) setToVal(to);
  }, [from, to]);

  const pushParams = React.useCallback(
    (overrides: Record<string, string>) => {
      const params = new URLSearchParams(sp?.toString() ?? '');
      params.set('from', fromVal);
      params.set('to', toVal);
      params.set('granularity', granularityVal);
      if (deptVal) params.set('department', deptVal);
      else params.delete('department');
      params.set('page', '1');
      for (const [k, v] of Object.entries(overrides)) {
        if (v) params.set(k, v);
        else params.delete(k);
      }
      startTransition(() => router.push(`${pathname}?${params.toString()}`));
    },
    [fromVal, toVal, granularityVal, deptVal, pathname, router, sp],
  );

  const onApply = (e: React.FormEvent) => {
    e.preventDefault();
    pushParams({});
  };

  const onFyChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const opt = fyOptions.find((o) => o.label === e.target.value);
    if (!opt) return;
    setFromVal(opt.from);
    setToVal(opt.to);
    pushParams({ from: opt.from, to: opt.to });
  };

  return (
    <form
      onSubmit={onApply}
      className="flex flex-wrap items-end gap-2 rounded-lg border border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-3 py-2"
    >
      <label className="flex flex-col gap-1">
        <span className="text-[11px] uppercase tracking-wide text-[var(--st-text-secondary)]">
          FY
        </span>
        <select
          value={matchedFy?.label ?? ''}
          onChange={onFyChange}
          className="h-9 rounded-lg border border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-2 text-[13px] text-[var(--st-text)]"
        >
          <option value="">Custom</option>
          {fyOptions.map((o) => (
            <option key={o.label} value={o.label}>
              {o.label}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-[11px] uppercase tracking-wide text-[var(--st-text-secondary)]">
          From
        </span>
        <input
          type="date"
          value={fromVal}
          onChange={(e) => setFromVal(e.target.value)}
          className="h-9 rounded-lg border border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-2 text-[13px] text-[var(--st-text)]"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-[11px] uppercase tracking-wide text-[var(--st-text-secondary)]">
          To
        </span>
        <input
          type="date"
          value={toVal}
          onChange={(e) => setToVal(e.target.value)}
          className="h-9 rounded-lg border border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-2 text-[13px] text-[var(--st-text)]"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-[11px] uppercase tracking-wide text-[var(--st-text-secondary)]">
          Period
        </span>
        <select
          value={granularityVal}
          onChange={(e) => setGranularityVal(e.target.value)}
          className="h-9 rounded-lg border border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-2 text-[13px] text-[var(--st-text)]"
        >
          <option value="monthly">Monthly</option>
          <option value="quarterly">Quarterly</option>
        </select>
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-[11px] uppercase tracking-wide text-[var(--st-text-secondary)]">
          Department
        </span>
        <input
          type="text"
          value={deptVal}
          onChange={(e) => setDeptVal(e.target.value)}
          placeholder="Any"
          className="h-9 w-28 rounded-lg border border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-2 text-[13px] text-[var(--st-text)]"
        />
      </label>

      <Button type="submit" size="sm" disabled={isPending}>
        Apply
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => startTransition(() => router.refresh())}
        disabled={isPending}
        aria-label="Refresh"
      >
        <RefreshCcw className="h-3.5 w-3.5" />
        Refresh
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() =>
          downloadCsv(
            `profit-loss-${dateStamp()}.csv`,
            exportHeaders,
            exportRows,
          )
        }
        aria-label="Export CSV"
      >
        <FileDown className="h-3.5 w-3.5" />
        CSV
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() =>
          void downloadXlsx(
            `profit-loss-${dateStamp()}.xlsx`,
            exportHeaders,
            exportRows,
            'P&L',
          )
        }
        aria-label="Export XLSX"
      >
        <FileSpreadsheet className="h-3.5 w-3.5" />
        XLSX
      </Button>
    </form>
  );
}
