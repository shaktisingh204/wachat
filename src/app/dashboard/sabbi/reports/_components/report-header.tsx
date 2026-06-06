'use client';

import * as React from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { RefreshCw, Download, ChevronDown } from 'lucide-react';
import {
  Button,
  Field,
  Input,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/sabcrm/20ui';

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
    <div className="flex flex-wrap items-end gap-2 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-3 py-2">
      <Field label="From" className="w-40">
        <Input
          type="date"
          inputSize="sm"
          value={from}
          onChange={(e) => setRange(e.target.value, to)}
        />
      </Field>
      <Field label="To" className="w-40">
        <Input
          type="date"
          inputSize="sm"
          value={to}
          onChange={(e) => setRange(from, e.target.value)}
        />
      </Field>
      <Button variant="outline" size="sm" onClick={onFy} disabled={isPending}>
        Current FY
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={refresh}
        disabled={isPending}
        iconLeft={RefreshCw}
        className={isPending ? '[&_svg]:animate-spin' : undefined}
      >
        Refresh
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" iconLeft={Download} iconRight={ChevronDown}>
            Export
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
