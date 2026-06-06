'use client';

import { Badge, Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator, Button, Card, PageDescription, PageHeader, PageHeading, PageTitle, Skeleton } from '@/components/sabcrm/20ui';
import {
  useEffect,
  useState,
  useTransition } from 'react';
import Link from 'next/link';
import { ArrowUpRight,
  Globe,
  Mail,
  MessageSquare,
  Send,
  Star,
  Zap } from 'lucide-react';

import { getSession } from '@/app/actions/user.actions';
import { useT } from '@/lib/i18n/client';
import type { User, WithId } from '@/lib/definitions';

type CreditRow = {
    id: keyof NonNullable<User['credits']>;
    labelKey: string;
    descriptionKey: string;
    icon: React.ComponentType<{ className?: string }>;
};

const CREDIT_ROWS: CreditRow[] = [
    { id: 'broadcast', labelKey: 'settings.credits.rows.broadcast.label', descriptionKey: 'settings.credits.rows.broadcast.description', icon: Send },
    { id: 'sms', labelKey: 'settings.credits.rows.sms.label', descriptionKey: 'settings.credits.rows.sms.description', icon: MessageSquare },
    { id: 'meta', labelKey: 'settings.credits.rows.meta.label', descriptionKey: 'settings.credits.rows.meta.description', icon: Zap },
    { id: 'email', labelKey: 'settings.credits.rows.email.label', descriptionKey: 'settings.credits.rows.email.description', icon: Mail },
    { id: 'seo', labelKey: 'settings.credits.rows.seo.label', descriptionKey: 'settings.credits.rows.seo.description', icon: Globe },
];

export default function CreditsSettingsPage() {
    const { t, locale } = useT();
    const [user, setUser] = useState<WithId<User> | null>(null);
    const [loading, startLoading] = useTransition();

    useEffect(() => {
        startLoading(async () => {
            const session = await getSession();
            setUser(session?.user ?? null);
        });
    }, []);

    const credits = user?.credits ?? ({} as NonNullable<User['credits']>);
    const total = CREDIT_ROWS.reduce((sum, r) => sum + Number(credits[r.id] ?? 0), 0);
    const wallet = user?.wallet;

    return (
        <div className="flex min-h-full flex-col gap-6">
            <Breadcrumb>
                <BreadcrumbList>
                    <BreadcrumbItem>
                        <BreadcrumbLink href="/dashboard/settings">{t('settings.overview.title')}</BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                        <BreadcrumbPage>{t('settings.credits.title')}</BreadcrumbPage>
                    </BreadcrumbItem>
                </BreadcrumbList>
            </Breadcrumb>

            <div className="flex flex-wrap items-center justify-between gap-4">
                <PageHeader>
                    <PageHeading>
                        <PageTitle>{t('settings.credits.title')}</PageTitle>
                        <PageDescription>
                            {t('settings.credits.subtitle')}
                        </PageDescription>
                    </PageHeading>
                </PageHeader>
                <Button size="sm" asChild>
                    <Link href="/dashboard/user/billing">
                        <Star className="h-4 w-4" />
                        {t('settings.credits.topUp')}
                    </Link>
                </Button>
            </div>

            {/* Wallet summary */}
            <Card className="p-6">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--st-bg-muted)] text-[var(--st-text)]">
                            <Star className="h-6 w-6" />
                        </div>
                        <div>
                            <p className="text-xs uppercase tracking-wide text-[var(--st-text-secondary)]">
                                {t('settings.credits.walletBalance')}
                            </p>
                            {loading ? (
                                <Skeleton className="mt-1 h-8 w-40" />
                            ) : (
                                <p className="mt-0.5 text-[24px] text-[var(--st-text)]">
                                    {formatCurrency((wallet?.balance ?? 0) / 100, wallet?.currency ?? 'INR', locale)}
                                </p>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Badge variant="ghost">
                            {t('settings.credits.creditsRemaining', { count: total.toLocaleString(locale) })}
                        </Badge>
                        <Button variant="outline" size="sm" asChild>
                            <Link href="/dashboard/user/billing">
                                {t('settings.credits.viewBilling')}
                                <ArrowUpRight className="h-4 w-4" />
                            </Link>
                        </Button>
                    </div>
                </div>
            </Card>

            {/* Per-module credits */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {CREDIT_ROWS.map((row) => {
                    const value = Number(credits[row.id] ?? 0);
                    return (
                        <Card key={row.id} className="p-6">
                            <div className="mb-3 flex items-start justify-between">
                                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--st-bg-muted)] text-[var(--st-text)]">
                                    <row.icon className="h-5 w-5" />
                                </div>
                                {value === 0 && <Badge variant="danger">{t('settings.credits.badges.empty')}</Badge>}
                                {value > 0 && value < 100 && <Badge variant="warning">{t('settings.credits.badges.low')}</Badge>}
                            </div>
                            <p className="text-xs text-[var(--st-text-secondary)]">{t(row.labelKey)}</p>
                            {loading ? (
                                <Skeleton className="mt-1 h-8 w-24" />
                            ) : (
                                <p className="mt-0.5 text-[26px] leading-none text-[var(--st-text)]">
                                    {value.toLocaleString(locale)}
                                </p>
                            )}
                            <p className="mt-2 text-xs text-[var(--st-text-secondary)]">{t(row.descriptionKey)}</p>
                        </Card>
                    );
                })}
            </div>

            <Card className="p-6">
                <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--st-bg-muted)] text-[var(--st-text)]">
                        <Zap className="h-4 w-4" />
                    </div>
                    <div>
                        <p className="text-sm text-[var(--st-text)]">{t('settings.credits.howConsumed.title')}</p>
                        <p className="mt-1 text-xs text-[var(--st-text-secondary)]">
                            {t('settings.credits.howConsumed.description')}
                        </p>
                    </div>
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
