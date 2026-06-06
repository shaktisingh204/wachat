'use client';

/**
 * PaymentReportFilters - payment mode / client / currency / status filter row.
 *
 * Pure 20ui. URL-driven via `next/navigation` (the same strategy as
 * `FyReportToolbar`): the form mutates a local copy of the search params and
 * pushes back to the URL on Apply, so the server `PaymentReportPage` re-renders
 * with the new filter set. Extracted to a client component so the canonical
 * Radix `Select` compound (which drives its value through React state, not a
 * native form field) can submit cleanly.
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
import { RotateCcw } from 'lucide-react';

export interface PaymentReportFiltersProps {
  mode?: string;
  client?: string;
  currency?: string;
  status?: string;
}

const ALL = '__all__';

export function PaymentReportFilters({
  mode,
  client,
  currency,
  status,
}: PaymentReportFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const [modeVal, setModeVal] = React.useState(mode || ALL);
  const [clientVal, setClientVal] = React.useState(client ?? '');
  const [currencyVal, setCurrencyVal] = React.useState(currency || ALL);
  const [statusVal, setStatusVal] = React.useState(status || ALL);
  const [isPending, startTransition] = React.useTransition();

  React.useEffect(() => {
    setModeVal(mode || ALL);
    setClientVal(client ?? '');
    setCurrencyVal(currency || ALL);
    setStatusVal(status || ALL);
  }, [mode, client, currency, status]);

  const apply = React.useCallback(() => {
    const params = new URLSearchParams(sp?.toString() ?? '');
    const setOrDelete = (key: string, value: string) => {
      if (value && value !== ALL) params.set(key, value);
      else params.delete(key);
    };
    setOrDelete('mode', modeVal);
    setOrDelete('client', clientVal.trim());
    setOrDelete('currency', currencyVal);
    setOrDelete('status', statusVal);
    params.set('page', '1');
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  }, [pathname, router, sp, modeVal, clientVal, currencyVal, statusVal]);

  const reset = React.useCallback(() => {
    const params = new URLSearchParams(sp?.toString() ?? '');
    for (const key of ['mode', 'client', 'currency', 'status']) params.delete(key);
    params.set('page', '1');
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  }, [pathname, router, sp]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    apply();
  };

  return (
    <form
      onSubmit={onSubmit}
      className="flex flex-wrap items-end gap-2 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-3 py-2"
    >
      <Field label="Payment mode" className="gap-1">
        <Select value={modeVal} onValueChange={setModeVal}>
          <SelectTrigger aria-label="Payment mode" className="h-9 w-[150px] text-[13px]">
            <SelectValue placeholder="All modes" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All modes</SelectItem>
            <SelectItem value="cash">Cash</SelectItem>
            <SelectItem value="bank">Bank transfer</SelectItem>
            <SelectItem value="upi">UPI</SelectItem>
            <SelectItem value="card">Card</SelectItem>
            <SelectItem value="cheque">Cheque</SelectItem>
          </SelectContent>
        </Select>
      </Field>

      <Field label="Client search" className="gap-1">
        <Input
          inputSize="sm"
          value={clientVal}
          onChange={(e) => setClientVal(e.target.value)}
          placeholder="Client name..."
          className="h-9 w-44 text-[13px]"
        />
      </Field>

      <Field label="Currency" className="gap-1">
        <Select value={currencyVal} onValueChange={setCurrencyVal}>
          <SelectTrigger aria-label="Currency" className="h-9 w-[140px] text-[13px]">
            <SelectValue placeholder="INR (default)" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>INR (default)</SelectItem>
            <SelectItem value="USD">USD</SelectItem>
            <SelectItem value="EUR">EUR</SelectItem>
            <SelectItem value="GBP">GBP</SelectItem>
          </SelectContent>
        </Select>
      </Field>

      <Field label="Status" className="gap-1">
        <Select value={statusVal} onValueChange={setStatusVal}>
          <SelectTrigger aria-label="Status" className="h-9 w-[130px] text-[13px]">
            <SelectValue placeholder="All" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All</SelectItem>
            <SelectItem value="received">Received</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
          </SelectContent>
        </Select>
      </Field>

      <Button type="submit" variant="primary" size="sm" disabled={isPending}>
        Apply
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        iconLeft={RotateCcw}
        onClick={reset}
        disabled={isPending}
      >
        Reset
      </Button>
    </form>
  );
}
