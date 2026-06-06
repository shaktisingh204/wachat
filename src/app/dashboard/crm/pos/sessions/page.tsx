import { Button, Skeleton } from '@/components/sabcrm/20ui/compat';
import { Plus } from 'lucide-react';
import * as React from 'react';

import { EntityListShell } from '@/components/crm/entity-list-shell';

/**
 * POS sessions list — `/dashboard/crm/pos/sessions`.
 *
 * Server component. Filters via query string (`terminalId`, `status`).
 * KPIs (open/closed/avg duration/revenue today) + bulk-action + export
 * delegated to `<PosSessionsListClient>`.
 */

import Link from 'next/link';

import {
    getPosSessions,
    getPosTransactions,
    type PosSessionStatus,
} from '@/app/actions/crm-pos.actions';

import { PosSessionsListClient } from '../_components/pos-sessions-list-client';

export const dynamic = 'force-dynamic';

interface PageProps {
    searchParams: Promise<{ terminalId?: string; status?: string }>;
}

function asStatus(v: string | undefined): PosSessionStatus | 'all' {
    if (
        v === 'open' ||
        v === 'closed' ||
        v === 'reconciled' ||
        v === 'archived'
    ) {
        return v;
    }
    return 'all';
}

function PosSessionsListSkeleton() {
    return (
        <div className="flex flex-col gap-4">
            {/* KPI strip skeleton */}
            <div className="grid grid-cols-2 gap-2.5 md:grid-cols-5">
                {[...Array(5)].map((_, i) => (
                    <div key={i} className="rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-3.5 flex items-start justify-between gap-2">
                        <div className="min-w-0 space-y-2">
                            <Skeleton className="h-3 w-16" />
                            <Skeleton className="h-6 w-12" />
                        </div>
                        <Skeleton className="h-8 w-8 rounded-md" />
                    </div>
                ))}
            </div>

            {/* Filter row skeleton */}
            <div className="flex flex-wrap items-center gap-2">
                <Skeleton className="h-9 w-full max-w-sm rounded-md" />
                <Skeleton className="h-9 w-[160px] rounded-md" />
                <Skeleton className="h-9 w-[150px] rounded-md" />
                <Skeleton className="h-9 w-[150px] rounded-md" />
                <div className="ml-auto flex items-center gap-1">
                    <Skeleton className="h-9 w-14 rounded-md" />
                    <Skeleton className="h-9 w-16 rounded-md" />
                </div>
            </div>

            {/* Table Card skeleton */}
            <div className="rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                        <thead>
                            <tr className="border-b border-[var(--st-border)]">
                                <th className="p-3 w-8 text-left"><Skeleton className="h-4 w-4 rounded" /></th>
                                <th className="p-3 text-left"><Skeleton className="h-4 w-20" /></th>
                                <th className="p-3 text-left"><Skeleton className="h-4 w-16" /></th>
                                <th className="p-3 text-left"><Skeleton className="h-4 w-28" /></th>
                                <th className="p-3 text-left"><Skeleton className="h-4 w-24" /></th>
                                <th className="p-3 text-left"><Skeleton className="h-4 w-16" /></th>
                                <th className="p-3 text-left"><Skeleton className="h-4 w-16" /></th>
                                <th className="p-3 text-right"><Skeleton className="h-4 w-12 ml-auto" /></th>
                            </tr>
                        </thead>
                        <tbody>
                            {[...Array(5)].map((_, i) => (
                                <tr key={i} className="border-b border-[var(--st-border)] last:border-0">
                                    <td className="p-3"><Skeleton className="h-4 w-4 rounded" /></td>
                                    <td className="p-3">
                                        <div className="space-y-1">
                                            <Skeleton className="h-4 w-24" />
                                            <Skeleton className="h-3 w-16" />
                                        </div>
                                    </td>
                                    <td className="p-3"><Skeleton className="h-4 w-20" /></td>
                                    <td className="p-3"><Skeleton className="h-4 w-32" /></td>
                                    <td className="p-3"><Skeleton className="h-4 w-20" /></td>
                                    <td className="p-3"><Skeleton className="h-4 w-12" /></td>
                                    <td className="p-3"><Skeleton className="h-5 w-16 rounded-full" /></td>
                                    <td className="p-3 text-right">
                                        <div className="flex justify-end gap-1">
                                            <Skeleton className="h-8 w-12 rounded" />
                                            <Skeleton className="h-8 w-16 rounded" />
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

interface ContainerProps {
    terminalId: string | undefined;
    status: PosSessionStatus | 'all';
}

async function PosSessionsListContainer({ terminalId, status }: ContainerProps) {
    const [sessions, todaysTxns] = await Promise.all([
        getPosSessions({ terminalId }),
        getPosTransactions({ limit: 500 }),
    ]);

    return (
        <PosSessionsListClient
            sessions={sessions}
            transactions={todaysTxns}
            initialTerminalId={terminalId ?? ''}
            initialStatus={status}
        />
    );
}

export default async function PosSessionsPage({ searchParams }: PageProps) {
    const sp = await searchParams;
    const terminalId = (sp.terminalId ?? '').trim() || undefined;
    const status = asStatus(sp.status);

    return (
        <EntityListShell
            title="POS sessions"
            subtitle="Cashier shifts across every terminal."
            primaryAction={
                <Button size="sm" asChild>
                    <Link href="/dashboard/crm/pos/sessions/new">
                        <Plus className="h-4 w-4" /> Open session
                    </Link>
                </Button>
            }
        >
            <React.Suspense fallback={<PosSessionsListSkeleton />}>
                <PosSessionsListContainer
                    terminalId={terminalId}
                    status={status}
                />
            </React.Suspense>
        </EntityListShell>
    );
}

