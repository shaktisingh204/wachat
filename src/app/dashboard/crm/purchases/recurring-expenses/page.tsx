'use client';

import { useCallback, useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { Plus, Repeat, LoaderCircle } from 'lucide-react';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ClayBadge, ClayButton, ClayCard } from '@/components/clay';
import { CrmPageHeader } from '../../_components/crm-page-header';
import { getRecurringExpenses } from '@/app/actions/worksuite/billing.actions';
import type { WsRecurringExpense } from '@/lib/worksuite/billing-types';

type Row = WsRecurringExpense & { _id: string };

const STATUS_TONES: Record<string, 'green' | 'amber' | 'red'> = {
  active: 'green',
  paused: 'amber',
  stopped: 'red',
};

const FREQUENCY_TONES: Record<string, 'blue' | 'rose-soft' | 'amber' | 'green'> = {
  days: 'blue',
  weeks: 'rose-soft',
  months: 'amber',
  years: 'green',
};

function fmtDate(v: unknown): string {
  if (!v) return '—';
  const d = new Date(v as any);
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

function fmtMoney(n: number | undefined, currency = 'INR'): string {
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency,
    }).format(n || 0);
  } catch {
    return `${currency} ${n || 0}`;
  }
}

export default function RecurringExpensesPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [isLoading, start] = useTransition();

  const load = useCallback(() => {
    start(async () => {
      const data = (await getRecurringExpenses()) as unknown as Row[];
      setRows(Array.isArray(data) ? data : []);
    });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="Recurring Expenses"
        subtitle="Templates that auto-generate expense entries on a schedule."
        icon={Repeat}
        actions={
          <Link href="/dashboard/crm/purchases/recurring-expenses/new">
            <ClayButton
              variant="obsidian"
              leading={<Plus className="h-4 w-4" strokeWidth={1.75} />}
            >
              New Recurring Expense
            </ClayButton>
          </Link>
        }
      />

      <ClayCard>
        <div className="mb-4">
          <h2 className="text-[16px] font-semibold text-clay-ink">Schedules</h2>
        </div>
        <div className="overflow-x-auto rounded-clay-md border border-clay-border">
          <Table>
            <TableHeader>
              <TableRow className="border-clay-border hover:bg-transparent">
                <TableHead className="text-clay-ink-muted">Name</TableHead>
                <TableHead className="text-clay-ink-muted">Vendor</TableHead>
                <TableHead className="text-clay-ink-muted">Frequency</TableHead>
                <TableHead className="text-clay-ink-muted">Next Run</TableHead>
                <TableHead className="text-clay-ink-muted">Status</TableHead>
                <TableHead className="text-clay-ink-muted text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow className="border-clay-border">
                  <TableCell colSpan={6} className="h-24 text-center">
                    <LoaderCircle className="mx-auto h-6 w-6 animate-spin text-clay-ink-muted" />
                  </TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow className="border-clay-border">
                  <TableCell
                    colSpan={6}
                    className="h-24 text-center text-[13px] text-clay-ink-muted"
                  >
                    No recurring expenses yet.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => (
                  <TableRow
                    key={String(row._id)}
                    className="cursor-pointer border-clay-border"
                  >
                    <TableCell className="text-clay-ink">
                      <Link
                        href={`/dashboard/crm/purchases/recurring-expenses/${row._id}`}
                        className="hover:underline"
                      >
                        {row.name || '—'}
                      </Link>
                    </TableCell>
                    <TableCell className="text-clay-ink">
                      {row.vendor || '—'}
                    </TableCell>
                    <TableCell>
                      <ClayBadge tone={FREQUENCY_TONES[row.frequency] || 'neutral'}>
                        Every {row.frequency_count} {row.frequency}
                      </ClayBadge>
                    </TableCell>
                    <TableCell className="text-clay-ink">
                      {fmtDate(row.next_run_date)}
                    </TableCell>
                    <TableCell>
                      <ClayBadge tone={STATUS_TONES[row.status] || 'neutral'} dot>
                        {row.status}
                      </ClayBadge>
                    </TableCell>
                    <TableCell className="text-right font-medium text-clay-ink">
                      {fmtMoney(row.amount, row.currency)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </ClayCard>
    </div>
  );
}
