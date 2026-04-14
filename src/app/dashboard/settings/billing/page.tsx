'use client';

import { useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { LuCreditCard, LuCheck, LuX, LuStar, LuArrowUpRight } from 'react-icons/lu';

import {
    ClayBadge,
    ClayBreadcrumbs,
    ClayButton,
    ClayCard,
    ClaySectionHeader,
} from '@/components/clay';
import { Skeleton } from '@/components/ui/skeleton';
import { getSession } from '@/app/actions/user.actions';
import type { User, Plan, WithId } from '@/lib/definitions';

type LoadedPlan = Partial<WithId<Plan>> | null;

export default function BillingPage() {
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

    const planName = plan?.name ?? 'Free';
    const price = plan?.price ?? 0;
    const currency = (plan as any)?.currency ?? 'USD';
    const features = (plan as any)?.features ?? {};
    const featureEntries = Object.entries(features).filter(([, v]) => typeof v === 'boolean') as Array<
        [string, boolean]
    >;

    return (
        <div className="clay-enter flex min-h-full flex-col gap-6">
            <ClayBreadcrumbs
                items={[
                    { label: 'Settings', href: '/dashboard/settings' },
                    { label: 'Billing & Plan' },
                ]}
            />

            <ClaySectionHeader
                size="lg"
                title="Billing & Plan"
                subtitle="Your active plan, included features, and upgrade path."
                actions={
                    <Link href="/dashboard/user/billing">
                        <ClayButton
                            variant="obsidian"
                            size="sm"
                            trailing={<LuArrowUpRight className="h-4 w-4" />}
                        >
                            Manage billing
                        </ClayButton>
                    </Link>
                }
            />

            {/* Current plan card */}
            <ClayCard padded>
                {loading ? (
                    <Skeleton className="h-40 w-full" />
                ) : (
                    <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-fuchsia-400 to-fuchsia-600 text-white">
                                <LuStar className="h-6 w-6" />
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <p className="text-[16px] font-semibold text-clay-ink">{planName}</p>
                                    <ClayBadge tone="blue">Current plan</ClayBadge>
                                </div>
                                <p className="mt-1 text-[12.5px] text-clay-ink-muted">
                                    {price > 0
                                        ? `${formatCurrency(price, currency)} billed monthly`
                                        : 'Free — upgrade anytime to unlock more seats and features.'}
                                </p>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <Link href="/dashboard/user/billing">
                                <ClayButton variant="pill" size="sm">
                                    Change plan
                                </ClayButton>
                            </Link>
                            <Link href="/dashboard/settings/invoices">
                                <ClayButton variant="ghost" size="sm">
                                    Invoices
                                </ClayButton>
                            </Link>
                        </div>
                    </div>
                )}
            </ClayCard>

            {/* Features */}
            <ClayCard padded>
                <div className="mb-4">
                    <p className="text-[13.5px] font-semibold text-clay-ink">What&apos;s included</p>
                    <p className="text-[12.5px] text-clay-ink-muted">
                        Feature entitlements that come with your current plan.
                    </p>
                </div>
                {loading ? (
                    <Skeleton className="h-40 w-full" />
                ) : featureEntries.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-clay-border bg-clay-surface-subtle p-6 text-center text-[12.5px] text-clay-ink-muted">
                        Your plan does not expose a feature matrix. Contact sales for custom entitlements.
                    </div>
                ) : (
                    <div className="grid gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
                        {featureEntries.map(([name, on]) => (
                            <div key={name} className="flex items-center gap-2 text-[13px]">
                                <div
                                    className={
                                        on
                                            ? 'flex h-5 w-5 items-center justify-center rounded-full bg-clay-green-soft text-clay-green'
                                            : 'flex h-5 w-5 items-center justify-center rounded-full bg-clay-surface-subtle text-clay-ink-muted'
                                    }
                                >
                                    {on ? <LuCheck className="h-3 w-3" /> : <LuX className="h-3 w-3" />}
                                </div>
                                <span className={on ? 'text-clay-ink' : 'text-clay-ink-muted line-through'}>
                                    {prettyFeature(name)}
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </ClayCard>

            {/* Payment method */}
            <ClayCard padded>
                <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-clay-rose-soft text-clay-rose">
                        <LuCreditCard className="h-4 w-4" />
                    </div>
                    <div className="flex-1">
                        <p className="text-[13.5px] font-semibold text-clay-ink">Payment method</p>
                        <p className="text-[12.5px] text-clay-ink-muted">
                            {user?.wallet?.balance
                                ? `Wallet balance ${formatCurrency(
                                      (user.wallet.balance ?? 0) / 100,
                                      user.wallet.currency ?? 'INR',
                                  )} — auto-debit enabled`
                                : 'No saved card. You\u2019ll be prompted on your next upgrade.'}
                        </p>
                    </div>
                    <Link href="/dashboard/user/billing">
                        <ClayButton variant="pill" size="sm">
                            Update
                        </ClayButton>
                    </Link>
                </div>
            </ClayCard>
        </div>
    );
}

function formatCurrency(value: number, currency = 'USD'): string {
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

function prettyFeature(key: string): string {
    return key
        .replace(/([A-Z])/g, ' $1')
        .replace(/[_-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/^\w/, (c) => c.toUpperCase());
}
