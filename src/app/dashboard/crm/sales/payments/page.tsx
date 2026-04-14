'use client';

import { useCallback, useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import {
  CreditCard,
  Plus,
  LoaderCircle,
  Filter as FilterIcon,
} from 'lucide-react';

import { ClayCard, ClayBadge, ClayButton } from '@/components/clay';
import { CrmPageHeader } from '../../_components/crm-page-header';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  getPayments,
  type ListPaymentsFilter,
} from '@/app/actions/worksuite/payments.actions';

const STATUS_TONES: Record<
  string,
  'green' | 'amber' | 'red' | 'neutral'
> = {
  completed: 'green',
  pending: 'amber',
  failed: 'red',
  refunded: 'neutral',
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
            <ClayButton
              variant="obsidian"
              leading={<Plus className="h-4 w-4" strokeWidth={1.75} />}
            >
              Record Payment
            </ClayButton>
          </Link>
        }
      />

      <ClayCard>
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <div className="flex items-center gap-2 text-[12px] text-clay-ink-muted">
            <FilterIcon className="h-3.5 w-3.5" strokeWidth={1.75} />
            Filters
          </div>
          <Select
            value={filter.gateway || 'all'}
            onValueChange={(v) =>
              setFilter((f) => ({ ...f, gateway: v === 'all' ? '' : v }))
            }
          >
            <SelectTrigger className="h-9 w-[150px] rounded-clay-md border-clay-border bg-clay-surface text-[12.5px]">
              <SelectValue placeholder="Gateway" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All gateways</SelectItem>
              {GATEWAY_OPTIONS.filter(Boolean).map((g) => (
                <SelectItem key={g} value={g}>
                  {g}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={filter.status || 'all'}
            onValueChange={(v) =>
              setFilter((f) => ({ ...f, status: v === 'all' ? '' : v }))
            }
          >
            <SelectTrigger className="h-9 w-[140px] rounded-clay-md border-clay-border bg-clay-surface text-[12.5px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {STATUS_OPTIONS.filter(Boolean).map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            type="date"
            value={filter.from || ''}
            onChange={(e) =>
              setFilter((f) => ({ ...f, from: e.target.value || '' }))
            }
            className="h-9 w-[150px] rounded-clay-md border-clay-border bg-clay-surface text-[12.5px]"
          />
          <Input
            type="date"
            value={filter.to || ''}
            onChange={(e) =>
              setFilter((f) => ({ ...f, to: e.target.value || '' }))
            }
            className="h-9 w-[150px] rounded-clay-md border-clay-border bg-clay-surface text-[12.5px]"
          />
        </div>

        {isLoading && rows.length === 0 ? (
          <div className="flex justify-center py-10">
            <LoaderCircle className="h-5 w-5 animate-spin text-clay-ink-muted" />
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-clay-md bg-clay-rose-soft">
              <CreditCard
                className="h-6 w-6 text-clay-rose-ink"
                strokeWidth={1.75}
              />
            </div>
            <p className="text-[13px] text-clay-ink-muted">
              No payments recorded yet.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-clay-md border border-clay-border">
            <Table>
              <TableHeader>
                <TableRow className="border-clay-border hover:bg-transparent">
                  <TableHead className="text-clay-ink-muted">Date</TableHead>
                  <TableHead className="text-clay-ink-muted">
                    Invoice
                  </TableHead>
                  <TableHead className="text-clay-ink-muted">Client</TableHead>
                  <TableHead className="text-clay-ink-muted">Gateway</TableHead>
                  <TableHead className="text-right text-clay-ink-muted">
                    Amount
                  </TableHead>
                  <TableHead className="text-clay-ink-muted">Status</TableHead>
                  <TableHead className="text-right text-clay-ink-muted">
                    &nbsp;
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow
                    key={String(row._id)}
                    className="border-clay-border"
                  >
                    <TableCell className="text-[12.5px] text-clay-ink">
                      {row.paid_on
                        ? new Date(row.paid_on).toLocaleDateString()
                        : '—'}
                    </TableCell>
                    <TableCell className="font-mono text-[12px] text-clay-ink">
                      {row.invoice_number || '—'}
                    </TableCell>
                    <TableCell className="text-[12.5px] text-clay-ink">
                      {row.client_name || '—'}
                    </TableCell>
                    <TableCell>
                      <ClayBadge tone="neutral">{row.gateway}</ClayBadge>
                    </TableCell>
                    <TableCell className="text-right font-semibold text-clay-ink">
                      {formatMoney(row.amount, row.currency)}
                    </TableCell>
                    <TableCell>
                      <ClayBadge
                        tone={STATUS_TONES[row.status] || 'neutral'}
                        dot
                      >
                        {row.status}
                      </ClayBadge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Link
                        href={`/dashboard/crm/sales/payments/${String(row._id)}`}
                        className="text-[12px] font-medium text-clay-rose-ink hover:underline"
                      >
                        View
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </ClayCard>
    </div>
  );
}
