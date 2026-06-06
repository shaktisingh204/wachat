'use client';

import * as React from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { RefreshCw, Download, ChevronDown } from 'lucide-react';
import { Button, DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/sabcrm/20ui/compat';

export interface ReportHeaderProps {
  defaultRangeDays?: number;
  onExportCsv: () => void;
  onExportXlsx: () => void | Promise<void>;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function fyRange(now: Date): { from: string; to: string } {
  const month = now.getMonth();
  const year = now.getFullYear();
  const fyStartYear = month >= 3 ? year : year - 1;
  return {
    from: isoDate(new Date(fyStartYear, 3, 1)),
    to: isoDate(new Date(fyStartYear + 1, 2, 31)),
  };
}

export function ReportHeader({
  defaultRangeDays = 90,
  onExportCsv,
  onExportXlsx,
}: ReportHeaderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const defaults = React.useMemo(() => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - defaultRangeDays);
    return { from: isoDate(start), to: isoDate(end) };
  }, [defaultRangeDays]);

  const from = sp?.get('from') ?? defaults.from;
  const to = sp?.get('to') ?? defaults.to;
  const [isPending, startTransition] = React.useTransition();

  const setRange = React.useCallback(
    (nextFrom: string, nextTo: string) => {
      const params = new URLSearchParams(sp?.toString() ?? '');
      params.set('from', nextFrom);
      params.set('to', nextTo);
      startTransition(() => {
        router.push(`${pathname}?${params.toString()}`);
      });
    },
    [router, pathname, sp],
  );

  const refresh = React.useCallback(() => {
    startTransition(() => {
      router.refresh();
    });
  }, [router]);

  const onFy = React.useCallback(() => {
    const fy = fyRange(new Date());
    setRange(fy.from, fy.to);
  }, [setRange]);

  return (
    <div className="flex flex-wrap items-end gap-2 rounded-lg border border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-3 py-2">
      <label className="flex flex-col gap-1">
        <span className="text-[11px] uppercase tracking-wide text-[var(--st-text-secondary)]">
          From
        </span>
        <input
          type="date"
          value={from}
          onChange={(e) => setRange(e.target.value, to)}
          className="h-9 rounded-lg border border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-2 text-[13px] text-[var(--st-text)]"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-[11px] uppercase tracking-wide text-[var(--st-text-secondary)]">
          To
        </span>
        <input
          type="date"
          value={to}
          onChange={(e) => setRange(from, e.target.value)}
          className="h-9 rounded-lg border border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-2 text-[13px] text-[var(--st-text)]"
        />
      </label>
      <Button variant="outline" size="sm" onClick={onFy} disabled={isPending}>
        Current FY
      </Button>
      <Button variant="outline" size="sm" onClick={refresh} disabled={isPending}>
        <RefreshCw className={`mr-1 h-3.5 w-3.5 ${isPending ? 'animate-spin' : ''}`} />
        Refresh
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">
            <Download className="mr-1 h-3.5 w-3.5" />
            Export
            <ChevronDown className="ml-1 h-3.5 w-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => onExportCsv()}>
            Export as CSV
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => void onExportXlsx()}>
            Export as XLSX
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
