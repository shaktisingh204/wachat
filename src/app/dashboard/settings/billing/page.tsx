'use client';

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
  ZoruPageDescription,
  ZoruPageHeader,
  ZoruPageHeading,
  ZoruPageTitle,
  ZoruSkeleton,
} from '@/components/zoruui';
import {
  useEffect,
  useState,
  useTransition } from 'react';
import Link from 'next/link';
import { ArrowUpRight,
  Check,
  CreditCard,
  Star,
  X } from 'lucide-react';

import { getSession } from '@/app/actions/user.actions';
import { useT } from '@/lib/i18n/client';
import type { User, Plan, WithId } from '@/lib/definitions';

type LoadedPlan = Partial<WithId<Plan>> | null;

export default function BillingPage() {
    const { t, locale } = useT();
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
    const featureEntries = Object.entries(features).filter(([, v]) => typeof v === 'boolean') as Array<
        [string, boolean]
    >;

    return (
        <div className="flex min-h-full flex-col gap-6">
            <ZoruBreadcrumb>
                <ZoruBreadcrumbList>
                    <ZoruBreadcrumbItem>
                        <ZoruBreadcrumbLink href="/dashboard/settings">{t('settings.overview.title')}</ZoruBreadcrumbLink>
                    </ZoruBreadcrumbItem>
                    <ZoruBreadcrumbSeparator />
                    <ZoruBreadcrumbItem>
                        <ZoruBreadcrumbPage>{t('settings.billing.title')}</ZoruBreadcrumbPage>
                    </ZoruBreadcrumbItem>
                </ZoruBreadcrumbList>
            </ZoruBreadcrumb>

            <div className="flex flex-wrap items-center justify-between gap-4">
                <ZoruPageHeader>
                    <ZoruPageHeading>
                        <ZoruPageTitle>{t('settings.billing.title')}</ZoruPageTitle>
                        <ZoruPageDescription>
                            {t('settings.billing.subtitle')}
                        </ZoruPageDescription>
                    </ZoruPageHeading>
                </ZoruPageHeader>
                <ZoruButton size="sm" asChild>
                    <Link href="/dashboard/user/billing">
                        {t('settings.billing.manageBilling')}
                        <ArrowUpRight className="h-4 w-4" />
                    </Link>
                </ZoruButton>
            </div>

            {/* Current plan card */}
            <ZoruCard className="p-6">
                {loading ? (
                    <ZoruSkeleton className="h-40 w-full" />
                ) : (
                    <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-zoru-surface-2 text-zoru-ink">
                                <Star className="h-6 w-6" />
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <p className="text-base text-zoru-ink">{planName}</p>
                                    <ZoruBadge variant="info">{t('settings.billing.currentPlan')}</ZoruBadge>
                                </div>
                                <p className="mt-1 text-xs text-zoru-ink-muted">
                                    {price > 0
                                        ? t('settings.billing.billedMonthly', { price: formatCurrency(price, currency, locale) })
                                        : t('settings.billing.freeUpgradeHint')}
                                </p>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <ZoruButton variant="outline" size="sm" asChild>
                                <Link href="/dashboard/user/billing">{t('settings.billing.changePlan')}</Link>
                            </ZoruButton>
                            <ZoruButton variant="ghost" size="sm" asChild>
                                <Link href="/dashboard/settings/invoices">{t('settings.billing.invoices')}</Link>
                            </ZoruButton>
                        </div>
                    </div>
                )}
            </ZoruCard>

            {/* Features */}
            <ZoruCard className="p-6">
                <div className="mb-4">
                    <p className="text-sm text-zoru-ink">{t('settings.billing.whatsIncluded')}</p>
                    <p className="text-xs text-zoru-ink-muted">
                        {t('settings.billing.featuresHint')}
                    </p>
                </div>
                {loading ? (
                    <ZoruSkeleton className="h-40 w-full" />
                ) : featureEntries.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-zoru-line bg-zoru-surface-2 p-6 text-center text-xs text-zoru-ink-muted">
                        {t('settings.billing.noFeatureMatrix')}
                    </div>
                ) : (
                    <div className="grid gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
                        {featureEntries.map(([name, on]) => (
                            <div key={name} className="flex items-center gap-2 text-[13px]">
                                <div
                                    className={
                                        on
                                            ? 'flex h-5 w-5 items-center justify-center rounded-full bg-zoru-success/10 text-zoru-success-ink'
                                            : 'flex h-5 w-5 items-center justify-center rounded-full bg-zoru-surface-2 text-zoru-ink-muted'
                                    }
                                >
                                    {on ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                                </div>
                                <span className={on ? 'text-zoru-ink' : 'text-zoru-ink-muted line-through'}>
                                    {prettyFeature(name)}
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </ZoruCard>

            {/* Payment method */}
            <ZoruCard className="p-6">
                <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-zoru-surface-2 text-zoru-ink">
                        <CreditCard className="h-4 w-4" />
                    </div>
                    <div className="flex-1">
                        <p className="text-sm text-zoru-ink">{t('settings.billing.paymentMethod')}</p>
                        <p className="text-xs text-zoru-ink-muted">
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
                    <ZoruButton variant="outline" size="sm" asChild>
                        <Link href="/dashboard/user/billing">{t('settings.billing.update')}</Link>
                    </ZoruButton>
                </div>
            </ZoruCard>
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
