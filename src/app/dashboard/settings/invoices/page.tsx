'use client';

import { useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { ArrowUpRight, Calendar, Download, Receipt } from 'lucide-react';

import { getSession } from '@/app/actions/user.actions';
import type { User, WalletTransaction, WithId } from '@/lib/definitions';
import {
  ZoruBadge,
  ZoruBreadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
  ZoruButton,
  ZoruCard,
  ZoruEmptyState,
  ZoruPageDescription,
  ZoruPageHeader,
  ZoruPageHeading,
  ZoruPageTitle,
  ZoruSkeleton,
} from '@/components/zoruui';

export default function InvoicesPage() {
  const [rows, setRows] = useState<WalletTransaction[]>([]);
  const [loading, startLoading] = useTransition();

  useEffect(() => {
    startLoading(async () => {
      const session = await getSession();
      const user = session?.user as WithId<User> | undefined;
      const txns = (user?.wallet?.transactions ?? []) as WalletTransaction[];
      setRows(txns.slice(0, 100));
    });
  }, []);

  return (
    <div className="flex min-h-full flex-col gap-6">
      <ZoruBreadcrumb>
        <ZoruBreadcrumbList>
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/dashboard/settings">Settings</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbPage>Invoices</ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
      </ZoruBreadcrumb>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <ZoruPageHeader>
          <ZoruPageHeading>
            <ZoruPageTitle>Invoices</ZoruPageTitle>
            <ZoruPageDescription>
              Download receipts and past billing statements.
            </ZoruPageDescription>
          </ZoruPageHeading>
        </ZoruPageHeader>
        <ZoruButton variant="ghost" size="sm" asChild>
          <Link href="/dashboard/user/billing">
            Billing home <ArrowUpRight className="h-4 w-4" />
          </Link>
        </ZoruButton>
      </div>

      <ZoruCard className="p-0">
        {loading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <ZoruSkeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <ZoruEmptyState
            icon={<Receipt className="h-10 w-10" />}
            title="No invoices yet"
            description="Invoices appear here after your first plan purchase or wallet top-up."
          />
        ) : (
          <ul className="divide-y divide-zoru-line">
            {rows.map((tx, idx) => {
              const t = tx as any;
              const amount = Number(t.amount ?? 0) / 100;
              const currency = (t.currency ?? 'INR') as string;
              const status = (t.status ?? 'completed') as string;
              const type = (t.type ?? 'top_up') as string;
              return (
                <li
                  key={t._id?.toString?.() ?? idx}
                  className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm text-zoru-ink">{prettyLabel(type)}</p>
                      <StatusBadge status={status} />
                    </div>
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-zoru-ink-muted">
                      <Calendar className="h-3 w-3" />
                      {formatDate(t.createdAt ?? t.date ?? new Date())}
                      {t.description && ` · ${t.description}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-zoru-ink">
                      {formatCurrency(amount, currency)}
                    </span>
                    <ZoruButton variant="ghost" size="sm">
                      <Download className="h-4 w-4" />
                      Receipt
                    </ZoruButton>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </ZoruCard>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const s = status.toLowerCase();
  if (s === 'completed' || s === 'paid' || s === 'success')
    return <ZoruBadge variant="success">Paid</ZoruBadge>;
  if (s === 'pending' || s === 'processing')
    return <ZoruBadge variant="warning">Pending</ZoruBadge>;
  if (s === 'failed' || s === 'declined')
    return <ZoruBadge variant="danger">Failed</ZoruBadge>;
  return <ZoruBadge variant="ghost">{status}</ZoruBadge>;
}

function prettyLabel(key: string): string {
  return key
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\w/, (c) => c.toUpperCase());
}

function formatDate(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatCurrency(value: number, currency = 'INR'): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${currency} ${value.toFixed(2)}`;
  }
}
