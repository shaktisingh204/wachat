'use client';

import { useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { ArrowUpRight, Globe, Mail, MessageSquare, Send, Star, Zap } from 'lucide-react';

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
import { getSession } from '@/app/actions/user.actions';
import type { User, WithId } from '@/lib/definitions';

type CreditRow = {
    id: keyof NonNullable<User['credits']>;
    label: string;
    description: string;
    icon: React.ComponentType<{ className?: string }>;
};

const CREDIT_ROWS: CreditRow[] = [
    { id: 'broadcast', label: 'Broadcast', description: 'WhatsApp broadcast messages', icon: Send },
    { id: 'sms', label: 'SMS', description: 'SMS messages sent through any gateway', icon: MessageSquare },
    { id: 'meta', label: 'Meta', description: 'Meta ads, FB/IG messaging', icon: Zap },
    { id: 'email', label: 'Email', description: 'Transactional + marketing email', icon: Mail },
    { id: 'seo', label: 'SEO', description: 'Site audits, rank checks, embeddings', icon: Globe },
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
        <div className="flex min-h-full flex-col gap-6">
            <ZoruBreadcrumb>
                <ZoruBreadcrumbList>
                    <ZoruBreadcrumbItem>
                        <ZoruBreadcrumbLink href="/dashboard/settings">Settings</ZoruBreadcrumbLink>
                    </ZoruBreadcrumbItem>
                    <ZoruBreadcrumbSeparator />
                    <ZoruBreadcrumbItem>
                        <ZoruBreadcrumbPage>Credits</ZoruBreadcrumbPage>
                    </ZoruBreadcrumbItem>
                </ZoruBreadcrumbList>
            </ZoruBreadcrumb>

            <div className="flex flex-wrap items-center justify-between gap-4">
                <ZoruPageHeader>
                    <ZoruPageHeading>
                        <ZoruPageTitle>Credits</ZoruPageTitle>
                        <ZoruPageDescription>
                            Per-module credit balances and wallet top-ups.
                        </ZoruPageDescription>
                    </ZoruPageHeading>
                </ZoruPageHeader>
                <ZoruButton size="sm" asChild>
                    <Link href="/dashboard/user/billing">
                        <Star className="h-4 w-4" />
                        Top up
                    </Link>
                </ZoruButton>
            </div>

            {/* Wallet summary */}
            <ZoruCard className="p-6">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-zoru-surface-2 text-zoru-ink">
                            <Star className="h-6 w-6" />
                        </div>
                        <div>
                            <p className="text-xs uppercase tracking-wide text-zoru-ink-muted">
                                Wallet balance
                            </p>
                            {loading ? (
                                <ZoruSkeleton className="mt-1 h-8 w-40" />
                            ) : (
                                <p className="mt-0.5 text-[24px] text-zoru-ink">
                                    {formatCurrency((wallet?.balance ?? 0) / 100, wallet?.currency ?? 'INR')}
                                </p>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <ZoruBadge variant="ghost">
                            {total.toLocaleString()} credits remaining
                        </ZoruBadge>
                        <ZoruButton variant="outline" size="sm" asChild>
                            <Link href="/dashboard/user/billing">
                                View billing
                                <ArrowUpRight className="h-4 w-4" />
                            </Link>
                        </ZoruButton>
                    </div>
                </div>
            </ZoruCard>

            {/* Per-module credits */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {CREDIT_ROWS.map((row) => {
                    const value = Number(credits[row.id] ?? 0);
                    return (
                        <ZoruCard key={row.id} className="p-6">
                            <div className="mb-3 flex items-start justify-between">
                                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zoru-surface-2 text-zoru-ink">
                                    <row.icon className="h-5 w-5" />
                                </div>
                                {value === 0 && <ZoruBadge variant="danger">Empty</ZoruBadge>}
                                {value > 0 && value < 100 && <ZoruBadge variant="warning">Low</ZoruBadge>}
                            </div>
                            <p className="text-xs text-zoru-ink-muted">{row.label}</p>
                            {loading ? (
                                <ZoruSkeleton className="mt-1 h-8 w-24" />
                            ) : (
                                <p className="mt-0.5 text-[26px] leading-none text-zoru-ink">
                                    {value.toLocaleString()}
                                </p>
                            )}
                            <p className="mt-2 text-xs text-zoru-ink-muted">{row.description}</p>
                        </ZoruCard>
                    );
                })}
            </div>

            <ZoruCard className="p-6">
                <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-zoru-surface-2 text-zoru-ink">
                        <Zap className="h-4 w-4" />
                    </div>
                    <div>
                        <p className="text-sm text-zoru-ink">How credits are consumed</p>
                        <p className="mt-1 text-xs text-zoru-ink-muted">
                            Credits are deducted when messages are delivered. Your plan grants a monthly
                            allotment, and unused credits roll over while your plan is active.
                        </p>
                    </div>
                </div>
            </ZoruCard>
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
