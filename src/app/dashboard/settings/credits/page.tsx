'use client';

import { useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { LuStar, LuZap, LuMail, LuMessageSquare, LuSend, LuGlobe, LuArrowUpRight } from 'react-icons/lu';

import {
    ClayBadge,
    ClayBreadcrumbs,
    ClayButton,
    ClayCard,
    ClaySectionHeader,
} from '@/components/clay';
import { Skeleton } from '@/components/ui/skeleton';
import { getSession } from '@/app/actions/user.actions';
import type { User, WithId } from '@/lib/definitions';

type CreditRow = {
    id: keyof NonNullable<User['credits']>;
    label: string;
    description: string;
    icon: React.ComponentType<{ className?: string }>;
    tone: string;
};

const CREDIT_ROWS: CreditRow[] = [
    { id: 'broadcast', label: 'Broadcast', description: 'WhatsApp broadcast messages', icon: LuSend, tone: 'from-emerald-400 to-emerald-600' },
    { id: 'sms', label: 'SMS', description: 'SMS messages sent through any gateway', icon: LuMessageSquare, tone: 'from-sky-400 to-sky-600' },
    { id: 'meta', label: 'Meta', description: 'Meta ads, FB/IG messaging', icon: LuZap, tone: 'from-indigo-400 to-indigo-600' },
    { id: 'email', label: 'Email', description: 'Transactional + marketing email', icon: LuMail, tone: 'from-amber-400 to-amber-600' },
    { id: 'seo', label: 'SEO', description: 'Site audits, rank checks, embeddings', icon: LuGlobe, tone: 'from-rose-400 to-rose-600' },
];

export default function CreditsSettingsPage() {
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
        <div className="clay-enter flex min-h-full flex-col gap-6">
            <ClayBreadcrumbs
                items={[
                    { label: 'Settings', href: '/dashboard/settings' },
                    { label: 'Credits' },
                ]}
            />

            <ClaySectionHeader
                size="lg"
                title="Credits"
                subtitle="Per-module credit balances and wallet top-ups."
                actions={
                    <Link href="/dashboard/user/billing">
                        <ClayButton variant="obsidian" size="sm" leading={<LuStar className="h-4 w-4" />}>
                            Top up
                        </ClayButton>
                    </Link>
                }
            />

            {/* Wallet summary */}
            <ClayCard padded>
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-yellow-400 to-yellow-600 text-white">
                            <LuStar className="h-6 w-6" />
                        </div>
                        <div>
                            <p className="text-[12.5px] font-medium uppercase tracking-wide text-clay-ink-muted">
                                Wallet balance
                            </p>
                            {loading ? (
                                <Skeleton className="mt-1 h-8 w-40" />
                            ) : (
                                <p className="mt-0.5 text-[24px] font-semibold text-clay-ink">
                                    {formatCurrency((wallet?.balance ?? 0) / 100, wallet?.currency ?? 'INR')}
                                </p>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <ClayBadge tone="neutral" dot>
                            {total.toLocaleString()} credits remaining
                        </ClayBadge>
                        <Link href="/dashboard/user/billing">
                            <ClayButton
                                variant="pill"
                                size="sm"
                                trailing={<LuArrowUpRight className="h-4 w-4" />}
                            >
                                View billing
                            </ClayButton>
                        </Link>
                    </div>
                </div>
            </ClayCard>

            {/* Per-module credits */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {CREDIT_ROWS.map((row) => {
                    const value = Number(credits[row.id] ?? 0);
                    return (
                        <ClayCard key={row.id} padded>
                            <div className="mb-3 flex items-start justify-between">
                                <div
                                    className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br text-white ${row.tone}`}
                                >
                                    <row.icon className="h-5 w-5" />
                                </div>
                                {value === 0 && <ClayBadge tone="red">Empty</ClayBadge>}
                                {value > 0 && value < 100 && <ClayBadge tone="amber">Low</ClayBadge>}
                            </div>
                            <p className="text-[12.5px] font-medium text-clay-ink-muted">{row.label}</p>
                            {loading ? (
                                <Skeleton className="mt-1 h-8 w-24" />
                            ) : (
                                <p className="mt-0.5 text-[26px] font-semibold leading-none text-clay-ink">
                                    {value.toLocaleString()}
                                </p>
                            )}
                            <p className="mt-2 text-[12px] text-clay-ink-muted">{row.description}</p>
                        </ClayCard>
                    );
                })}
            </div>

            <ClayCard variant="soft" padded>
                <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-clay-obsidian text-white">
                        <LuZap className="h-4 w-4" />
                    </div>
                    <div>
                        <p className="text-[13px] font-semibold text-clay-ink">How credits are consumed</p>
                        <p className="mt-1 text-[12.5px] text-clay-ink-muted">
                            Credits are deducted when messages are delivered. Your plan grants a monthly
                            allotment, and unused credits roll over while your plan is active.
                        </p>
                    </div>
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
