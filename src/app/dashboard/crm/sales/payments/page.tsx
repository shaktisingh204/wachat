'use client';

import { useCallback, useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import {
  CreditCard,
  Plus,
  LoaderCircle,
  Filter as FilterIcon,
} from 'lucide-react';

import {
  ZoruBadge,
  ZoruButton,
  ZoruCard,
  ZoruInput,
  ZoruSelect,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  ZoruTable,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
} from '@/components/zoruui';
import { CrmPageHeader } from '../../_components/crm-page-header';
import { getPayments } from '@/app/actions/worksuite/payments.actions';
import type { ListPaymentsFilter } from '@/lib/worksuite/payments-types';

const STATUS_VARIANTS: Record<
  string,
  'success' | 'warning' | 'danger' | 'ghost'
> = {
  completed: 'success',
  pending: 'warning',
  failed: 'danger',
  refunded: 'ghost',
};

const GATEWAY_OPTIONS = [
  '', 'razorpay', 'stripe', 'paypal', 'manual',
  'bank-transfer', 'cash', 'cheque', 'upi', 'other',
];
const STATUS_OPTIONS = ['', 'completed', 'pending', 'failed', 'refunded'];

function formatMoney(amount: number, currency = 'INR') {
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency,
    }).format(amount || 0);
  } catch {
    return `${currency} ${amount || 0}`;
  }
}

export default function PaymentsPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [isLoading, startTransition] = useTransition();
  const [filter, setFilter] = useState<ListPaymentsFilter>({});

  const load = useCallback(() => {
    startTransition(async () => {
      const data = await getPayments(filter);
      setRows(data as any[]);
    });
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="Payments"
        subtitle="Invoice payments collected across all gateways and methods."
        icon={CreditCard}
        actions={
          <Link href="/dashboard/crm/sales/payments/new">
            <ZoruButton>
              <Plus className="h-4 w-4" strokeWidth={1.75} />
              Record Payment
            </ZoruButton>
          </Link>
        }
      />

      <ZoruCard className="p-6">
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <div className="flex items-center gap-2 text-[12px] text-zoru-ink-muted">
            <FilterIcon className="h-3.5 w-3.5" strokeWidth={1.75} />
            Filters
          </div>
          <ZoruSelect
            value={filter.gateway || 'all'}
            onValueChange={(v) =>
              setFilter((f) => ({ ...f, gateway: v === 'all' ? '' : v }))
            }
          >
            <ZoruSelectTrigger className="w-[150px]">
              <ZoruSelectValue placeholder="Gateway" />
            </ZoruSelectTrigger>
            <ZoruSelectContent>
              <ZoruSelectItem value="all">All gateways</ZoruSelectItem>
              {GATEWAY_OPTIONS.filter(Boolean).map((g) => (
                <ZoruSelectItem key={g} value={g}>
                  {g}
                </ZoruSelectItem>
              ))}
            </ZoruSelectContent>
          </ZoruSelect>
          <ZoruSelect
            value={filter.status || 'all'}
            onValueChange={(v) =>
              setFilter((f) => ({ ...f, status: v === 'all' ? '' : v }))
            }
          >
            <ZoruSelectTrigger className="w-[140px]">
              <ZoruSelectValue placeholder="Status" />
            </ZoruSelectTrigger>
            <ZoruSelectContent>
              <ZoruSelectItem value="all">All statuses</ZoruSelectItem>
              {STATUS_OPTIONS.filter(Boolean).map((s) => (
                <ZoruSelectItem key={s} value={s}>
                  {s}
                </ZoruSelectItem>
              ))}
            </ZoruSelectContent>
          </ZoruSelect>
          <ZoruInput
            type="date"
            value={filter.from || ''}
            onChange={(e) =>
              setFilter((f) => ({ ...f, from: e.target.value || '' }))
            }
            className="w-[150px]"
          />
          <ZoruInput
            type="date"
            value={filter.to || ''}
            onChange={(e) =>
              setFilter((f) => ({ ...f, to: e.target.value || '' }))
            }
            className="w-[150px]"
          />
        </div>

        {isLoading && rows.length === 0 ? (
          <div className="flex justify-center py-10">
            <LoaderCircle className="h-5 w-5 animate-spin text-zoru-ink-muted" />
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-zoru-surface-2">
              <CreditCard
                className="h-6 w-6 text-zoru-ink"
                strokeWidth={1.75}
              />
            </div>
            <p className="text-[13px] text-zoru-ink-muted">
              No payments recorded yet.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-zoru-line">
            <ZoruTable>
              <ZoruTableHeader>
                <ZoruTableRow className="border-zoru-line hover:bg-transparent">
                  <ZoruTableHead className="text-zoru-ink-muted">Date</ZoruTableHead>
                  <ZoruTableHead className="text-zoru-ink-muted">
                    Invoice
                  </ZoruTableHead>
                  <ZoruTableHead className="text-zoru-ink-muted">Client</ZoruTableHead>
                  <ZoruTableHead className="text-zoru-ink-muted">Gateway</ZoruTableHead>
                  <ZoruTableHead className="text-right text-zoru-ink-muted">
                    Amount
                  </ZoruTableHead>
                  <ZoruTableHead className="text-zoru-ink-muted">Status</ZoruTableHead>
                  <ZoruTableHead className="text-right text-zoru-ink-muted">
                    &nbsp;
                  </ZoruTableHead>
                </ZoruTableRow>
              </ZoruTableHeader>
              <ZoruTableBody>
                {rows.map((row) => (
                  <ZoruTableRow
                    key={String(row._id)}
                    className="border-zoru-line"
                  >
                    <ZoruTableCell className="text-[12.5px] text-zoru-ink">
                      {row.paid_on
                        ? new Date(row.paid_on).toLocaleDateString()
                        : '—'}
                    </ZoruTableCell>
                    <ZoruTableCell className="font-mono text-[12px] text-zoru-ink">
                      {row.invoice_number || '—'}
                    </ZoruTableCell>
                    <ZoruTableCell className="text-[12.5px] text-zoru-ink">
                      {row.client_name || '—'}
                    </ZoruTableCell>
                    <ZoruTableCell>
                      <ZoruBadge variant="ghost">{row.gateway}</ZoruBadge>
                    </ZoruTableCell>
                    <ZoruTableCell className="text-right text-zoru-ink">
                      {formatMoney(row.amount, row.currency)}
                    </ZoruTableCell>
                    <ZoruTableCell>
                      <ZoruBadge variant={STATUS_VARIANTS[row.status] || 'ghost'}>
                        {row.status}
                      </ZoruBadge>
                    </ZoruTableCell>
                    <ZoruTableCell className="text-right">
                      <Link
                        href={`/dashboard/crm/sales/payments/${String(row._id)}`}
                        className="text-[12px] text-zoru-ink hover:underline"
                      >
                        View
                      </Link>
                    </ZoruTableCell>
                  </ZoruTableRow>
                ))}
              </ZoruTableBody>
            </ZoruTable>
          </div>
        )}
      </ZoruCard>
    </div>
  );
}
