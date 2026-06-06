'use client';

import { Badge, Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator, Button, Card, EmptyState, PageDescription, PageHeader, PageHeading, PageTitle, Skeleton } from '@/components/sabcrm/20ui/compat';
import {
  useEffect,
  useState,
  useTransition } from 'react';
import Link from 'next/link';
import { ArrowUpRight,
  Calendar,
  Download,
  Receipt } from 'lucide-react';

import { getSession } from '@/app/actions/user.actions';
import { useT } from '@/lib/i18n/client';
import type { User,
  WalletTransaction,
  WithId } from '@/lib/definitions';

export default function InvoicesPage() {
  const { t, locale } = useT();
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
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/dashboard/settings">{t('settings.overview.title')}</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{t('settings.invoices.title')}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <PageHeader>
          <PageHeading>
            <PageTitle>{t('settings.invoices.title')}</PageTitle>
            <PageDescription>
              {t('settings.invoices.subtitle')}
            </PageDescription>
          </PageHeading>
        </PageHeader>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard/user/billing">
            {t('settings.invoices.billingHome')} <ArrowUpRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>

      <Card className="p-0">
        {loading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<Receipt className="h-10 w-10" />}
            title={t('settings.invoices.empty.title')}
            description={t('settings.invoices.empty.description')}
          />
        ) : (
          <ul className="divide-y divide-[var(--st-border)]">
            {rows.map((tx, idx) => {
              const r = tx as any;
              const amount = Number(r.amount ?? 0) / 100;
              const currency = (r.currency ?? 'INR') as string;
              const status = (r.status ?? 'completed') as string;
              const type = (r.type ?? 'top_up') as string;
              return (
                <li
                  key={r._id?.toString?.() ?? idx}
                  className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm text-[var(--st-text)]">{prettyLabel(type)}</p>
                      <StatusBadge status={status} />
                    </div>
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-[var(--st-text-secondary)]">
                      <Calendar className="h-3 w-3" />
                      {formatDate(r.createdAt ?? r.date ?? new Date(), locale)}
                      {r.description && ` · ${r.description}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-[var(--st-text)]">
                      {formatCurrency(amount, currency, locale)}
                    </span>
                    <Button variant="ghost" size="sm">
                      <Download className="h-4 w-4" />
                      {t('settings.invoices.receipt')}
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const { t } = useT();
  const s = status.toLowerCase();
  if (s === 'completed' || s === 'paid' || s === 'success')
    return <Badge variant="success">{t('settings.invoices.status.paid')}</Badge>;
  if (s === 'pending' || s === 'processing')
    return <Badge variant="warning">{t('settings.invoices.status.pending')}</Badge>;
  if (s === 'failed' || s === 'declined')
    return <Badge variant="danger">{t('settings.invoices.status.failed')}</Badge>;
  return <Badge variant="ghost">{status}</Badge>;
}

function prettyLabel(key: string): string {
  return key
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\w/, (c) => c.toUpperCase());
}

function formatDate(d: Date | string, locale?: string): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleDateString(locale, { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatCurrency(value: number, currency = 'INR', locale?: string): string {
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${currency} ${value.toFixed(2)}`;
  }
}
