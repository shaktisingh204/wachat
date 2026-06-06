'use client';

import {
  Badge,
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
  Button,
  Card,
  EmptyState,
  PageDescription,
  PageHeader,
  PageHeading,
  PageTitle,
  Skeleton,
} from '@/components/sabcrm/20ui';
import { useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowUpRight, Check, CreditCard, Star, X } from 'lucide-react';

import { getSession } from '@/app/actions/user.actions';
import { useT } from '@/lib/i18n/client';
import type { User, Plan, WithId } from '@/lib/definitions';

type LoadedPlan = Partial<WithId<Plan>> | null;

export default function BillingPage() {
  const { t, locale } = useT();
  const router = useRouter();
  const [user, setUser] = useState<WithId<User> | null>(null);
  const [plan, setPlan] = useState<LoadedPlan>(null);
  const [loading, startLoading] = useTransition();

  useEffect(() => {
    startLoading(async () => {
      const session = await getSession();
      const sessionUser = session?.user ?? null;
      setUser(sessionUser);
      setPlan(((sessionUser as any)?.plan as LoadedPlan) ?? null);
    });
  }, []);

  const planName = plan?.name ?? t('settings.billing.freePlan');
  const price = plan?.price ?? 0;
  const currency = (plan as any)?.currency ?? 'USD';
  const features = (plan as any)?.features ?? {};
  const featureEntries = Object.entries(features).filter(
    ([, v]) => typeof v === 'boolean',
  ) as Array<[string, boolean]>;

  return (
    <div className="flex min-h-full flex-col gap-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href="/dashboard/settings">{t('settings.overview.title')}</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{t('settings.billing.title')}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <PageHeader bordered={false}>
          <PageHeading>
            <PageTitle>{t('settings.billing.title')}</PageTitle>
            <PageDescription>{t('settings.billing.subtitle')}</PageDescription>
          </PageHeading>
        </PageHeader>
        <Button
          variant="primary"
          size="sm"
          iconRight={ArrowUpRight}
          onClick={() => router.push('/dashboard/user/billing')}
        >
          {t('settings.billing.manageBilling')}
        </Button>
      </div>

      {/* Current plan card */}
      <Card padding="lg">
        {loading ? (
          <Skeleton height={160} width="100%" />
        ) : (
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <span
                className="flex h-12 w-12 items-center justify-center rounded-[var(--st-radius)] bg-[var(--st-bg-muted)] text-[var(--st-text)]"
                aria-hidden="true"
              >
                <Star className="h-6 w-6" />
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-base text-[var(--st-text)]">{planName}</p>
                  <Badge tone="info">{t('settings.billing.currentPlan')}</Badge>
                </div>
                <p className="mt-1 text-xs text-[var(--st-text-secondary)]">
                  {price > 0
                    ? t('settings.billing.billedMonthly', {
                        price: formatCurrency(price, currency, locale),
                      })
                    : t('settings.billing.freeUpgradeHint')}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push('/dashboard/user/billing')}
              >
                {t('settings.billing.changePlan')}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push('/dashboard/settings/invoices')}
              >
                {t('settings.billing.invoices')}
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Features */}
      <Card padding="lg">
        <div className="mb-4">
          <p className="text-sm text-[var(--st-text)]">{t('settings.billing.whatsIncluded')}</p>
          <p className="text-xs text-[var(--st-text-secondary)]">
            {t('settings.billing.featuresHint')}
          </p>
        </div>
        {loading ? (
          <Skeleton height={160} width="100%" />
        ) : featureEntries.length === 0 ? (
          <EmptyState size="sm" title={t('settings.billing.noFeatureMatrix')} />
        ) : (
          <div className="grid gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
            {featureEntries.map(([name, on]) => (
              <div key={name} className="flex items-center gap-2 text-[13px]">
                <span
                  className={
                    on
                      ? 'flex h-5 w-5 items-center justify-center rounded-full bg-[var(--st-status-ok)]/10 text-[var(--st-status-ok)]'
                      : 'flex h-5 w-5 items-center justify-center rounded-full bg-[var(--st-bg-muted)] text-[var(--st-text-secondary)]'
                  }
                  aria-hidden="true"
                >
                  {on ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                </span>
                <span
                  className={
                    on
                      ? 'text-[var(--st-text)]'
                      : 'text-[var(--st-text-secondary)] line-through'
                  }
                >
                  {prettyFeature(name)}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Payment method */}
      <Card padding="lg">
        <div className="flex items-center gap-3">
          <span
            className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--st-bg-muted)] text-[var(--st-text)]"
            aria-hidden="true"
          >
            <CreditCard className="h-4 w-4" />
          </span>
          <div className="flex-1">
            <p className="text-sm text-[var(--st-text)]">{t('settings.billing.paymentMethod')}</p>
            <p className="text-xs text-[var(--st-text-secondary)]">
              {user?.wallet?.balance
                ? t('settings.billing.walletBalance', {
                    balance: formatCurrency(
                      (user.wallet.balance ?? 0) / 100,
                      user.wallet.currency ?? 'INR',
                      locale,
                    ),
                  })
                : t('settings.billing.noSavedCard')}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push('/dashboard/user/billing')}
          >
            {t('settings.billing.update')}
          </Button>
        </div>
      </Card>
    </div>
  );
}

function formatCurrency(value: number, currency = 'USD', locale?: string): string {
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

function prettyFeature(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\w/, (c) => c.toUpperCase());
}
