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
import { getPayments } from '@/app/actions/worksuite/payments.actions';
import type { ListPaymentsFilter } from '@/lib/worksuite/payments-types';

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
          <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
            <FilterIcon className="h-3.5 w-3.5" strokeWidth={1.75} />
            Filters
          </div>
          <Select
            value={filter.gateway || 'all'}
            onValueChange={(v) =>
              setFilter((f) => ({ ...f, gateway: v === 'all' ? '' : v }))
            }
          >
            <SelectTrigger className="h-9 w-[150px] rounded-lg border-border bg-card text-[12.5px]">
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
            <SelectTrigger className="h-9 w-[140px] rounded-lg border-border bg-card text-[12.5px]">
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
            className="h-9 w-[150px] rounded-lg border-border bg-card text-[12.5px]"
          />
          <Input
            type="date"
            value={filter.to || ''}
            onChange={(e) =>
              setFilter((f) => ({ ...f, to: e.target.value || '' }))
            }
            className="h-9 w-[150px] rounded-lg border-border bg-card text-[12.5px]"
          />
        </div>

        {isLoading && rows.length === 0 ? (
          <div className="flex justify-center py-10">
            <LoaderCircle className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-accent">
              <CreditCard
                className="h-6 w-6 text-accent-foreground"
                strokeWidth={1.75}
              />
            </div>
            <p className="text-[13px] text-muted-foreground">
              No payments recorded yet.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="text-muted-foreground">Date</TableHead>
                  <TableHead className="text-muted-foreground">
                    Invoice
                  </TableHead>
                  <TableHead className="text-muted-foreground">Client</TableHead>
                  <TableHead className="text-muted-foreground">Gateway</TableHead>
                  <TableHead className="text-right text-muted-foreground">
                    Amount
                  </TableHead>
                  <TableHead className="text-muted-foreground">Status</TableHead>
                  <TableHead className="text-right text-muted-foreground">
                    &nbsp;
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow
                    key={String(row._id)}
                    className="border-border"
                  >
                    <TableCell className="text-[12.5px] text-foreground">
                      {row.paid_on
                        ? new Date(row.paid_on).toLocaleDateString()
                        : '—'}
                    </TableCell>
                    <TableCell className="font-mono text-[12px] text-foreground">
                      {row.invoice_number || '—'}
                    </TableCell>
                    <TableCell className="text-[12.5px] text-foreground">
                      {row.client_name || '—'}
                    </TableCell>
                    <TableCell>
                      <ClayBadge tone="neutral">{row.gateway}</ClayBadge>
                    </TableCell>
                    <TableCell className="text-right font-semibold text-foreground">
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
                        className="text-[12px] font-medium text-accent-foreground hover:underline"
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
