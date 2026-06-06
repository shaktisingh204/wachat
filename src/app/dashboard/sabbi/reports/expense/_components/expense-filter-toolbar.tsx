'use client';

import * as React from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import {
  Button,
  Field,
  Input,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/sabcrm/20ui';
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
  category: string;
  vendor: string;
  expenseType: string;
  exportHeaders: string[];
  exportRows: ExportRow[];
}

// Radix Select forbids empty string item values, so "Custom" uses a sentinel.
const CUSTOM_FY = '__custom';

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

export function ExpenseFilterToolbar({
  from,
  to,
  category,
  vendor,
  expenseType,
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
  const [catVal, setCatVal] = React.useState(category);
  const [vendorVal, setVendorVal] = React.useState(vendor);
  const [typeVal, setTypeVal] = React.useState(expenseType);

  React.useEffect(() => {
    if (from) setFromVal(from);
    if (to) setToVal(to);
  }, [from, to]);

  const pushParams = React.useCallback(
    (overrides: Record<string, string>) => {
      const params = new URLSearchParams(sp?.toString() ?? '');
      params.set('from', fromVal);
      params.set('to', toVal);
      if (catVal) params.set('category', catVal);
      else params.delete('category');
      if (vendorVal) params.set('vendor', vendorVal);
      else params.delete('vendor');
      if (typeVal) params.set('expenseType', typeVal);
      else params.delete('expenseType');
      params.set('page', '1');
      for (const [k, v] of Object.entries(overrides)) {
        if (v) params.set(k, v);
        else params.delete(k);
      }
      startTransition(() => router.push(`${pathname}?${params.toString()}`));
    },
    [fromVal, toVal, catVal, vendorVal, typeVal, pathname, router, sp],
  );

  const onApply = (e: React.FormEvent) => {
    e.preventDefault();
    pushParams({});
  };

  const onFyChange = (value: string) => {
    const opt = fyOptions.find((o) => o.label === value);
    if (!opt) return;
    setFromVal(opt.from);
    setToVal(opt.to);
    pushParams({ from: opt.from, to: opt.to });
  };

  return (
    <form
      onSubmit={onApply}
      className="flex flex-wrap items-end gap-2 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-3 py-2"
    >
      <Field label="FY" className="w-40">
        <Select
          value={matchedFy?.label ?? CUSTOM_FY}
          onValueChange={onFyChange}
        >
          <SelectTrigger aria-label="Financial year">
            <SelectValue placeholder="Custom" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={CUSTOM_FY}>Custom</SelectItem>
            {fyOptions.map((o) => (
              <SelectItem key={o.label} value={o.label}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field label="From">
        <Input
          type="date"
          inputSize="sm"
          value={fromVal}
          onChange={(e) => setFromVal(e.target.value)}
        />
      </Field>

      <Field label="To">
        <Input
          type="date"
          inputSize="sm"
          value={toVal}
          onChange={(e) => setToVal(e.target.value)}
        />
      </Field>

      <Field label="Category" className="w-32">
        <Input
          type="text"
          inputSize="sm"
          value={catVal}
          onChange={(e) => setCatVal(e.target.value)}
          placeholder="Any"
        />
      </Field>

      <Field label="Vendor" className="w-32">
        <Input
          type="text"
          inputSize="sm"
          value={vendorVal}
          onChange={(e) => setVendorVal(e.target.value)}
          placeholder="Any"
        />
      </Field>

      <Field label="Type" className="w-28">
        <Input
          type="text"
          inputSize="sm"
          value={typeVal}
          onChange={(e) => setTypeVal(e.target.value)}
          placeholder="Any"
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
        onClick={() => startTransition(() => router.refresh())}
        disabled={isPending}
      >
        Refresh
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        iconLeft={FileDown}
        onClick={() =>
          downloadCsv(
            `expense-report-${dateStamp()}.csv`,
            exportHeaders,
            exportRows,
          )
        }
      >
        CSV
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        iconLeft={FileSpreadsheet}
        onClick={() =>
          void downloadXlsx(
            `expense-report-${dateStamp()}.xlsx`,
            exportHeaders,
            exportRows,
            'Expenses',
          )
        }
      >
        XLSX
      </Button>
    </form>
  );
}
