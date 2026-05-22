'use client';

import {
  Badge,
  Breadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
  Button,
  Card,
  EmptyState,
  ZoruPageDescription,
  PageHeader,
  ZoruPageHeading,
  ZoruPageTitle,
  Skeleton,
} from '@/components/zoruui';
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
      <ZoruBreadcrumb>
        <ZoruBreadcrumbList>
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/dashboard/settings">{t('settings.overview.title')}</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbPage>{t('settings.invoices.title')}</ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
      </ZoruBreadcrumb>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <ZoruPageHeader>
          <ZoruPageHeading>
            <ZoruPageTitle>{t('settings.invoices.title')}</ZoruPageTitle>
            <ZoruPageDescription>
              {t('settings.invoices.subtitle')}
            </ZoruPageDescription>
          </ZoruPageHeading>
        </ZoruPageHeader>
        <ZoruButton variant="ghost" size="sm" asChild>
          <Link href="/dashboard/user/billing">
            {t('settings.invoices.billingHome')} <ArrowUpRight className="h-4 w-4" />
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
            title={t('settings.invoices.empty.title')}
            description={t('settings.invoices.empty.description')}
          />
        ) : (
          <ul className="divide-y divide-zoru-line">
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
                      <p className="truncate text-sm text-zoru-ink">{prettyLabel(type)}</p>
                      <StatusBadge status={status} />
                    </div>
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-zoru-ink-muted">
                      <Calendar className="h-3 w-3" />
                      {formatDate(r.createdAt ?? r.date ?? new Date(), locale)}
                      {r.description && ` · ${r.description}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-zoru-ink">
                      {formatCurrency(amount, currency, locale)}
                    </span>
                    <ZoruButton variant="ghost" size="sm">
                      <Download className="h-4 w-4" />
                      {t('settings.invoices.receipt')}
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
  const { t } = useT();
  const s = status.toLowerCase();
  if (s === 'completed' || s === 'paid' || s === 'success')
    return <ZoruBadge variant="success">{t('settings.invoices.status.paid')}</ZoruBadge>;
  if (s === 'pending' || s === 'processing')
    return <ZoruBadge variant="warning">{t('settings.invoices.status.pending')}</ZoruBadge>;
  if (s === 'failed' || s === 'declined')
    return <ZoruBadge variant="danger">{t('settings.invoices.status.failed')}</ZoruBadge>;
  return <ZoruBadge variant="ghost">{status}</ZoruBadge>;
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
