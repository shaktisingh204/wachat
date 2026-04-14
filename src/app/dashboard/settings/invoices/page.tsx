'use client';

import { useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { LuReceipt, LuDownload, LuArrowUpRight, LuCalendar } from 'react-icons/lu';

import {
    ClayBadge,
    ClayBreadcrumbs,
    ClayButton,
    ClayCard,
    ClaySectionHeader,
} from '@/components/clay';
import { Skeleton } from '@/components/ui/skeleton';
import { getSession } from '@/app/actions/user.actions';
import type { User, WalletTransaction, WithId } from '@/lib/definitions';

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
        <div className="clay-enter flex min-h-full flex-col gap-6">
            <ClayBreadcrumbs
                items={[
                    { label: 'Settings', href: '/dashboard/settings' },
                    { label: 'Invoices' },
                ]}
            />

            <ClaySectionHeader
                size="lg"
                title="Invoices"
                subtitle="Download receipts and past billing statements."
                actions={
                    <Link href="/dashboard/user/billing">
                        <ClayButton
                            variant="ghost"
                            size="sm"
                            trailing={<LuArrowUpRight className="h-4 w-4" />}
                        >
                            Billing home
                        </ClayButton>
                    </Link>
                }
            />

            <ClayCard padded={false}>
                {loading ? (
                    <div className="space-y-2 p-4">
                        {Array.from({ length: 4 }).map((_, i) => (
                            <Skeleton key={i} className="h-14 w-full" />
                        ))}
                    </div>
                ) : rows.length === 0 ? (
                    <div className="p-10 text-center">
                        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-clay-surface-subtle text-clay-ink-muted">
                            <LuReceipt className="h-5 w-5" />
                        </div>
                        <p className="text-[13px] font-semibold text-clay-ink">No invoices yet</p>
                        <p className="mt-1 text-[12.5px] text-clay-ink-muted">
                            Invoices appear here after your first plan purchase or wallet top-up.
                        </p>
                    </div>
                ) : (
                    <ul className="divide-y divide-clay-border">
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
                                            <p className="truncate text-[13.5px] font-semibold text-clay-ink">
                                                {prettyLabel(type)}
                                            </p>
                                            <StatusBadge status={status} />
                                        </div>
                                        <p className="mt-1 flex items-center gap-1.5 text-[12px] text-clay-ink-muted">
                                            <LuCalendar className="h-3 w-3" />
                                            {formatDate(t.createdAt ?? t.date ?? new Date())}
                                            {t.description && ` · ${t.description}`}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className="text-[14px] font-semibold text-clay-ink">
                                            {formatCurrency(amount, currency)}
                                        </span>
                                        <ClayButton
                                            variant="ghost"
                                            size="sm"
                                            leading={<LuDownload className="h-4 w-4" />}
                                        >
                                            Receipt
                                        </ClayButton>
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </ClayCard>
        </div>
    );
}

function StatusBadge({ status }: { status: string }) {
    const s = status.toLowerCase();
    if (s === 'completed' || s === 'paid' || s === 'success')
        return <ClayBadge tone="green">Paid</ClayBadge>;
    if (s === 'pending' || s === 'processing') return <ClayBadge tone="amber">Pending</ClayBadge>;
    if (s === 'failed' || s === 'declined') return <ClayBadge tone="red">Failed</ClayBadge>;
    return <ClayBadge tone="neutral">{status}</ClayBadge>;
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
    return date.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    });
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
