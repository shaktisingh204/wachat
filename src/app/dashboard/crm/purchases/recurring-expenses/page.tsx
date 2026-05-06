'use client';
import { ZoruBadge, ZoruButton, ZoruCard, ZoruTable, ZoruTableBody, ZoruTableCell, ZoruTableHead, ZoruTableHeader, ZoruTableRow } from '@/components/zoruui';
import { useCallback, useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { Plus, Repeat, LoaderCircle } from 'lucide-react';

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
            <ZoruButton
             
             
            >
              New Recurring Expense
            </ZoruButton>
          </Link>
        }
      />

      <ZoruCard>
        <div className="mb-4">
          <h2 className="text-[16px] font-semibold text-foreground">Schedules</h2>
        </div>
        <div className="overflow-x-auto rounded-lg border border-border">
          <ZoruTable>
            <ZoruTableHeader>
              <ZoruTableRow className="border-border hover:bg-transparent">
                <ZoruTableHead className="text-muted-foreground">Name</ZoruTableHead>
                <ZoruTableHead className="text-muted-foreground">Vendor</ZoruTableHead>
                <ZoruTableHead className="text-muted-foreground">Frequency</ZoruTableHead>
                <ZoruTableHead className="text-muted-foreground">Next Run</ZoruTableHead>
                <ZoruTableHead className="text-muted-foreground">Status</ZoruTableHead>
                <ZoruTableHead className="text-muted-foreground text-right">Amount</ZoruTableHead>
              </ZoruTableRow>
            </ZoruTableHeader>
            <ZoruTableBody>
              {isLoading ? (
                <ZoruTableRow className="border-border">
                  <ZoruTableCell colSpan={6} className="h-24 text-center">
                    <LoaderCircle className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                  </ZoruTableCell>
                </ZoruTableRow>
              ) : rows.length === 0 ? (
                <ZoruTableRow className="border-border">
                  <ZoruTableCell
                    colSpan={6}
                    className="h-24 text-center text-[13px] text-muted-foreground"
                  >
                    No recurring expenses yet.
                  </ZoruTableCell>
                </ZoruTableRow>
              ) : (
                rows.map((row) => (
                  <ZoruTableRow
                    key={String(row._id)}
                    className="cursor-pointer border-border"
                  >
                    <ZoruTableCell className="text-foreground">
                      <Link
                        href={`/dashboard/crm/purchases/recurring-expenses/${row._id}`}
                        className="hover:underline"
                      >
                        {row.name || '—'}
                      </Link>
                    </ZoruTableCell>
                    <ZoruTableCell className="text-foreground">
                      {row.vendor || '—'}
                    </ZoruTableCell>
                    <ZoruTableCell>
                      <ZoruBadge variant={(FREQUENCY_TONES[row.frequency] || 'neutral') as any}>
                        Every {row.frequency_count} {row.frequency}
                      </ZoruBadge>
                    </ZoruTableCell>
                    <ZoruTableCell className="text-foreground">
                      {fmtDate(row.next_run_date)}
                    </ZoruTableCell>
                    <ZoruTableCell>
                      <ZoruBadge variant={(STATUS_TONES[row.status] || 'neutral') as any}>
                        {row.status}
                      </ZoruBadge>
                    </ZoruTableCell>
                    <ZoruTableCell className="text-right font-medium text-foreground">
                      {fmtMoney(row.amount, row.currency)}
                    </ZoruTableCell>
                  </ZoruTableRow>
                ))
              )}
            </ZoruTableBody>
          </ZoruTable>
        </div>
      </ZoruCard>
    </div>
  );
}
