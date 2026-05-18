'use client';

import {
  ZoruBadge,
  ZoruButton,
  ZoruCard,
  ZoruTable,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
} from '@/components/zoruui';
import {
  useCallback,
  useEffect,
  useState,
  useTransition } from 'react';
import Link from 'next/link';
import { Plus,
  Repeat,
  LoaderCircle } from 'lucide-react';

import { CrmPageHeader } from '../../_components/crm-page-header';
import { getRecurringInvoices } from '@/app/actions/worksuite/billing.actions';
import type { WsRecurringInvoice } from '@/lib/worksuite/billing-types';

type Row = WsRecurringInvoice & { _id: string };

const STATUS_VARIANTS: Record<string, 'success' | 'warning' | 'danger'> = {
  active: 'success',
  paused: 'warning',
  stopped: 'danger',
};

const FREQUENCY_VARIANTS: Record<string, 'ghost' | 'danger' | 'warning' | 'success'> = {
  days: 'ghost',
  weeks: 'danger',
  months: 'warning',
  years: 'success',
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

export default function RecurringInvoicesPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [isLoading, start] = useTransition();

  const load = useCallback(() => {
    start(async () => {
      const data = (await getRecurringInvoices()) as unknown as Row[];
      setRows(Array.isArray(data) ? data : []);
    });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="Recurring Invoices"
        subtitle="Templates that automatically generate invoices on a schedule."
        icon={Repeat}
        actions={
          <Link href="/dashboard/crm/sales/recurring-invoices/new">
            <ZoruButton>
              <Plus className="h-4 w-4" strokeWidth={1.75} />
              New Recurring
            </ZoruButton>
          </Link>
        }
      />

      <ZoruCard className="p-6">
        <div className="mb-4">
          <h2 className="text-[16px] text-zoru-ink">Schedules</h2>
        </div>
        <div className="overflow-x-auto rounded-lg border border-zoru-line">
          <ZoruTable>
            <ZoruTableHeader>
              <ZoruTableRow className="border-zoru-line hover:bg-transparent">
                <ZoruTableHead className="text-zoru-ink-muted">Client</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Frequency</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Next Issue</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Issued</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Status</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted text-right">Total</ZoruTableHead>
              </ZoruTableRow>
            </ZoruTableHeader>
            <ZoruTableBody>
              {isLoading ? (
                <ZoruTableRow className="border-zoru-line">
                  <ZoruTableCell colSpan={6} className="h-24 text-center">
                    <LoaderCircle className="mx-auto h-6 w-6 animate-spin text-zoru-ink-muted" />
                  </ZoruTableCell>
                </ZoruTableRow>
              ) : rows.length === 0 ? (
                <ZoruTableRow className="border-zoru-line">
                  <ZoruTableCell
                    colSpan={6}
                    className="h-24 text-center text-[13px] text-zoru-ink-muted"
                  >
                    No recurring invoices yet.
                  </ZoruTableCell>
                </ZoruTableRow>
              ) : (
                rows.map((row) => (
                  <ZoruTableRow
                    key={String(row._id)}
                    className="cursor-pointer border-zoru-line"
                  >
                    <ZoruTableCell className="text-zoru-ink">
                      <Link
                        href={`/dashboard/crm/sales/recurring-invoices/${row._id}`}
                        className="hover:underline"
                      >
                        {row.client_name || '—'}
                      </Link>
                    </ZoruTableCell>
                    <ZoruTableCell>
                      <ZoruBadge variant={FREQUENCY_VARIANTS[row.frequency] || 'ghost'}>
                        Every {row.frequency_count} {row.frequency}
                      </ZoruBadge>
                    </ZoruTableCell>
                    <ZoruTableCell className="text-zoru-ink">
                      {fmtDate(row.next_issue_date)}
                    </ZoruTableCell>
                    <ZoruTableCell className="text-zoru-ink">
                      {row.issued_count || 0}
                      {row.stop_at_count ? ` / ${row.stop_at_count}` : ''}
                    </ZoruTableCell>
                    <ZoruTableCell>
                      <ZoruBadge variant={STATUS_VARIANTS[row.status] || 'ghost'}>
                        {row.status}
                      </ZoruBadge>
                    </ZoruTableCell>
                    <ZoruTableCell className="text-right text-zoru-ink">
                      {fmtMoney(row.total, row.currency)}
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
