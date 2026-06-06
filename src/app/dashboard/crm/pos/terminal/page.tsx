import * as React from 'react';
import Link from 'next/link';
import { ObjectId } from 'mongodb';
import { Plus, ShoppingCart, Store } from 'lucide-react';

import {
    Button,
    Card,
    ZoruCardContent,
} from '@/components/sabcrm/20ui/compat';

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { EntityListShell } from '@/components/crm/entity-list-shell';

import {
    getPosHolds,
    getPosSessions,
    getPosTransactions,
    searchPosItems,
    PosTerminalDoc,
} from '@/app/actions/crm-pos.actions';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';

import { PosTerminalClient } from '../_components/pos-terminal-client';
import { PosTerminalManagerClient } from '../_components/pos-terminal-manager-client';

export const dynamic = 'force-dynamic';

interface PageProps {
    searchParams: Promise<{ holdId?: string; live?: string }>;
}

/**
 * Deterministic UTC-based date/time formatter helper.
 * Formats a date reliably to YYYY-MM-DD HH:mm:ss UTC to avoid timezone mismatch
 * during hydration on the client side.
 */
function formatUtcDateTime(dateInput: Date | string | number | null | undefined): string {
    if (!dateInput) return '—';
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return '—';
    
    const pad = (n: number) => String(n).padStart(2, '0');
    
    const year = d.getUTCFullYear();
    const month = pad(d.getUTCMonth() + 1);
    const day = pad(d.getUTCDate());
    const hours = pad(d.getUTCHours());
    const minutes = pad(d.getUTCMinutes());
    const seconds = pad(d.getUTCSeconds());
    
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds} UTC`;
}

/* ─── Skeleton Fallbacks for React Suspense ────────────────────────── */

function LiveTerminalSkeleton() {
    return (
        <EntityDetailShell
            eyebrow="POS TERMINAL"
            title="Live · Loading..."
            back={{ href: '/dashboard/crm/pos/terminal', label: 'Terminals' }}
        >
            <div className="grid grid-cols-1 gap-4 md:grid-cols-5 animate-pulse">
                {/* Left 60% — item picker skeleton */}
                <Card className="md:col-span-3">
                    <ZoruCardContent className="flex flex-col gap-3 p-4">
                        <div className="h-10 bg-zoru-surface-2 dark:bg-zoru-ink rounded w-full animate-pulse" />
                        <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-4">
                            {[...Array(8)].map((_, i) => (
                                <div key={i} className="h-[90px] rounded-md border border-zoru-line bg-zoru-surface p-3 flex flex-col justify-between">
                                    <div className="h-3 bg-zoru-surface-2 dark:bg-zoru-ink rounded w-5/6 animate-pulse" />
                                    <div className="h-2 bg-zoru-surface-2 dark:bg-zoru-ink rounded w-1/2 animate-pulse" />
                                    <div className="h-3 bg-zoru-surface-2 dark:bg-zoru-ink rounded w-2/3 animate-pulse" />
                                </div>
                            ))}
                        </div>
                    </ZoruCardContent>
                </Card>

                {/* Right 40% — cart panel skeleton */}
                <Card className="md:col-span-2">
                    <ZoruCardContent className="flex flex-col gap-4 p-4">
                        <div className="flex items-center justify-between">
                            <div className="h-4 bg-zoru-surface-2 dark:bg-zoru-ink rounded w-1/4 animate-pulse" />
                            <div className="h-4 bg-zoru-surface-2 dark:bg-zoru-ink rounded w-12 animate-pulse" />
                        </div>
                        <div className="space-y-1.5">
                            <div className="h-3 bg-zoru-surface-2 dark:bg-zoru-ink rounded w-16 animate-pulse" />
                            <div className="h-9 bg-zoru-surface-2 dark:bg-zoru-ink rounded w-full animate-pulse" />
                        </div>
                        <div className="h-[120px] rounded-md border border-dashed border-zoru-line p-6 flex items-center justify-center">
                            <div className="h-3 bg-zoru-surface-2 dark:bg-zoru-ink rounded w-1/2 animate-pulse" />
                        </div>
                        <div className="space-y-2 border-t border-zoru-line pt-3">
                            <div className="flex justify-between">
                                <div className="h-3 bg-zoru-surface-2 dark:bg-zoru-ink rounded w-12 animate-pulse" />
                                <div className="h-3 bg-zoru-surface-2 dark:bg-zoru-ink rounded w-16 animate-pulse" />
                            </div>
                            <div className="flex justify-between">
                                <div className="h-3 bg-zoru-surface-2 dark:bg-zoru-ink rounded w-10 animate-pulse" />
                                <div className="h-3 bg-zoru-surface-2 dark:bg-zoru-ink rounded w-16 animate-pulse" />
                            </div>
                            <div className="flex justify-between">
                                <div className="h-4 bg-zoru-surface-2 dark:bg-zoru-ink rounded w-12 animate-pulse" />
                                <div className="h-4 bg-zoru-surface-2 dark:bg-zoru-ink rounded w-20 animate-pulse" />
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <div className="h-3 bg-zoru-surface-2 dark:bg-zoru-ink rounded w-24 animate-pulse" />
                            <div className="grid grid-cols-4 gap-1">
                                {[...Array(4)].map((_, i) => (
                                    <div key={i} className="h-12 bg-zoru-surface-2 dark:bg-zoru-ink rounded animate-pulse" />
                                ))}
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <div className="h-3 bg-zoru-surface-2 dark:bg-zoru-ink rounded w-32 animate-pulse" />
                            <div className="h-12 bg-zoru-surface-2 dark:bg-zoru-ink rounded animate-pulse" />
                        </div>
                        <div className="flex gap-2 pt-2">
                            <div className="h-10 bg-zoru-surface-2 dark:bg-zoru-ink rounded flex-1 animate-pulse" />
                            <div className="h-10 bg-zoru-surface-2 dark:bg-zoru-ink rounded flex-1 animate-pulse" />
                        </div>
                    </ZoruCardContent>
                </Card>
            </div>
        </EntityDetailShell>
    );
}

function TerminalManagerSkeleton() {
    return (
        <div className="flex flex-col gap-6">
            {/* KPI Cards Skeleton */}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4 border-none shadow-none">
                {[...Array(4)].map((_, i) => (
                    <Card key={i}>
                        <ZoruCardContent className="flex items-start justify-between p-3.5 h-[68px]">
                            <div className="space-y-1.5 w-full">
                                <div className="h-3 bg-zoru-surface-2 dark:bg-zoru-ink rounded w-16 animate-pulse" />
                                <div className="h-5 bg-zoru-surface-2 dark:bg-zoru-ink rounded w-8 animate-pulse" />
                            </div>
                            <div className="h-4 w-4 rounded bg-zoru-surface-2 dark:bg-zoru-ink animate-pulse" />
                        </ZoruCardContent>
                    </Card>
                ))}
            </div>

            {/* Filter and table skeleton */}
            <div className="flex flex-col gap-4">
                <div className="flex flex-wrap items-center gap-2">
                    <div className="h-9 bg-zoru-surface-2 dark:bg-zoru-ink rounded max-w-sm flex-1 animate-pulse" />
                    <div className="h-9 bg-zoru-surface-2 dark:bg-zoru-ink rounded w-[150px] animate-pulse" />
                    <div className="ml-auto flex items-center gap-1">
                        <div className="h-8 bg-zoru-surface-2 dark:bg-zoru-ink rounded w-20 animate-pulse" />
                        <div className="h-8 bg-zoru-surface-2 dark:bg-zoru-ink rounded w-14 animate-pulse" />
                        <div className="h-8 bg-zoru-surface-2 dark:bg-zoru-ink rounded w-16 animate-pulse" />
                    </div>
                </div>

                <Card className="p-0">
                    <div className="overflow-x-auto">
                        <div className="min-w-full divide-y divide-zoru-line">
                            {/* Table Header */}
                            <div className="flex items-center px-4 py-3 bg-zoru-surface-2 text-zoru-ink-muted">
                                <div className="h-4 w-4 rounded bg-zoru-surface-2 dark:bg-zoru-ink mr-4 animate-pulse" />
                                <div className="flex-1 grid grid-cols-6 gap-4">
                                    <div className="h-4 bg-zoru-surface-2 dark:bg-zoru-ink rounded w-16 animate-pulse" />
                                    <div className="h-4 bg-zoru-surface-2 dark:bg-zoru-ink rounded w-12 animate-pulse" />
                                    <div className="h-4 bg-zoru-surface-2 dark:bg-zoru-ink rounded w-24 animate-pulse" />
                                    <div className="h-4 bg-zoru-surface-2 dark:bg-zoru-ink rounded w-28 animate-pulse" />
                                    <div className="h-4 bg-zoru-surface-2 dark:bg-zoru-ink rounded w-16 text-right justify-self-end animate-pulse" />
                                    <div className="h-4 bg-zoru-surface-2 dark:bg-zoru-ink rounded w-20 text-right justify-self-end animate-pulse" />
                                </div>
                                <div className="h-4 w-20 rounded bg-zoru-surface-2 dark:bg-zoru-ink ml-4 animate-pulse" />
                            </div>

                            {/* Table Rows */}
                            {[...Array(5)].map((_, rowIndex) => (
                                <div key={rowIndex} className="flex items-center px-4 py-4 border-t border-zoru-line">
                                    <div className="h-4 w-4 rounded bg-zoru-surface-2 dark:bg-zoru-ink mr-4 animate-pulse" />
                                    <div className="flex-1 grid grid-cols-6 gap-4">
                                        <div className="space-y-1">
                                            <div className="h-4 bg-zoru-surface-2 dark:bg-zoru-ink rounded w-20 animate-pulse" />
                                            <div className="h-3 bg-zoru-surface-2 dark:bg-zoru-ink rounded w-12 animate-pulse" />
                                        </div>
                                        <div className="h-5 bg-zoru-surface-2 dark:bg-zoru-ink rounded-full w-14 animate-pulse" />
                                        <div className="h-4 bg-zoru-surface-2 dark:bg-zoru-ink rounded w-24 animate-pulse" />
                                        <div className="h-4 bg-zoru-surface-2 dark:bg-zoru-ink rounded w-16 animate-pulse" />
                                        <div className="h-4 bg-zoru-surface-2 dark:bg-zoru-ink rounded w-8 text-right justify-self-end animate-pulse" />
                                        <div className="h-4 bg-zoru-surface-2 dark:bg-zoru-ink rounded w-16 text-right justify-self-end animate-pulse" />
                                    </div>
                                    <div className="h-8 w-24 bg-zoru-surface-2 dark:bg-zoru-ink rounded ml-4 animate-pulse" />
                                </div>
                            ))}
                        </div>
                    </div>
                </Card>
            </div>
        </div>
    );
}

/* ─── Containers for Suspense loading ───────────────────────────────── */

async function LiveTerminalContainer({ sp }: { sp: { holdId?: string; live?: string } }) {
    const openSessions = await getPosSessions({ status: 'open' });
    const activeSession = openSessions[0] ?? null;
    const items = await searchPosItems('', 50);

    let prefillHold = null;
    if (sp.holdId) {
        const holds = await getPosHolds({ status: 'held' });
        prefillHold = holds.find((h) => h._id === sp.holdId) ?? null;
    }

    if (!activeSession) {
        return (
            <EntityDetailShell
                eyebrow="POS TERMINAL"
                title="POS terminal"
                back={{ href: '/dashboard/crm/pos', label: 'POS' }}
            >
                <Card>
                    <ZoruCardContent className="flex flex-col items-center justify-center gap-3 p-10 text-center">
                        <p className="text-sm font-medium text-zoru-ink">
                            No open POS session
                        </p>
                        <p className="text-[13px] text-zoru-ink-muted">
                            Open a session before ringing up sales — that
                            ensures every transaction is auditable against
                            a cashier shift.
                        </p>
                        <Button size="sm" asChild>
                            <Link href="/dashboard/crm/pos/sessions/new">
                                <Plus className="h-4 w-4" /> Open session
                            </Link>
                        </Button>
                    </ZoruCardContent>
                </Card>
            </EntityDetailShell>
        );
    }

    return (
        <EntityDetailShell
            eyebrow="POS TERMINAL"
            title={`Live · ${activeSession.terminalId}`}
            back={{ href: '/dashboard/crm/pos/terminal', label: 'Terminals' }}
            actions={
                <Button size="sm" variant="outline" asChild>
                    <Link href={`/dashboard/crm/pos/sessions/${activeSession._id}`}>
                        View session
                    </Link>
                </Button>
            }
        >
            <PosTerminalClient
                session={activeSession}
                initialItems={items}
                prefillHold={prefillHold}
            />
        </EntityDetailShell>
    );
}

async function TerminalManagerContainer() {
    const dbSession = await getSession();
    let registryTerminals: PosTerminalDoc[] = [];
    if (dbSession?.user?._id) {
        const { db } = await connectToDatabase();
        registryTerminals = await db.collection('crm_pos_terminals').find({
            userId: new ObjectId(String(dbSession.user._id))
        }).toArray() as any[];
    }

    const [allSessions, allTxns] = await Promise.all([
        getPosSessions({}),
        getPosTransactions({ limit: 500 }),
    ]);

    // Derive distinct terminals from session history + lookup registry.
    // For each terminal we compute: most-recent activity, current open
    // session (if any), today's revenue & txn count.
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    interface TerminalRow {
        terminalId: string;
        status: 'online' | 'offline';
        lastHeartbeat: string | null;
        openSessionId: string | null;
        openedByName: string | null;
        sessionsCount: number;
        revenueToday: number;
        txnsToday: number;
    }

    const byTerminal = new Map<string, TerminalRow>();
    for (const s of allSessions) {
        const cur = byTerminal.get(s.terminalId) ?? {
            terminalId: s.terminalId,
            status: 'offline' as const,
            lastHeartbeat: null,
            openSessionId: null,
            openedByName: null,
            sessionsCount: 0,
            revenueToday: 0,
            txnsToday: 0,
        };
        cur.sessionsCount += 1;
        const sessionTime = s.openedAt;
        if (
            sessionTime &&
            (!cur.lastHeartbeat ||
                new Date(sessionTime).getTime() >
                    new Date(cur.lastHeartbeat).getTime())
        ) {
            cur.lastHeartbeat = sessionTime;
        }
        if (s.status === 'open') {
            cur.status = 'online';
            cur.openSessionId = s._id;
            cur.openedByName = s.openedByName ?? null;
        }
        byTerminal.set(s.terminalId, cur);
    }
    
    // Override with registry data for explicit heartbeat/status
    for (const rt of registryTerminals) {
        const cur = byTerminal.get(rt.terminalId) ?? {
            terminalId: rt.terminalId,
            status: rt.status,
            lastHeartbeat: rt.lastHeartbeat,
            openSessionId: rt.openSessionId,
            openedByName: null,
            sessionsCount: 0,
            revenueToday: 0,
            txnsToday: 0,
        };
        // Heartbeats from registry shouldn't override if session/txns have more recent activity
        if (!cur.lastHeartbeat || (rt.lastHeartbeat && new Date(rt.lastHeartbeat).getTime() > new Date(cur.lastHeartbeat).getTime())) {
            cur.lastHeartbeat = rt.lastHeartbeat;
        }
        // If 5 mins passed without heartbeat, mark offline
        if (rt.lastHeartbeat && (Date.now() - new Date(rt.lastHeartbeat).getTime()) > 5 * 60 * 1000) {
            cur.status = 'offline';
        } else {
            cur.status = rt.status;
        }
        byTerminal.set(rt.terminalId, cur);
    }

    // Apply today's txn rollups against each session's terminal
    const sessionToTerminal = new Map<string, string>();
    for (const s of allSessions) sessionToTerminal.set(s._id, s.terminalId);
    for (const t of allTxns) {
        if (!t.createdAt) continue;
        if (new Date(t.createdAt).getTime() < startOfDay.getTime()) continue;
        const terminalId = sessionToTerminal.get(t.sessionId);
        if (!terminalId) continue;
        const row = byTerminal.get(terminalId);
        if (!row) continue;
        if (t.status === 'completed' || t.status === 'partially_refunded') {
            row.revenueToday += t.total ?? 0;
        }
        row.txnsToday += 1;
        // Heartbeat = latest of (last session opened, last txn made)
        if (
            !row.lastHeartbeat ||
            new Date(t.createdAt).getTime() >
                new Date(row.lastHeartbeat).getTime()
        ) {
            row.lastHeartbeat = t.createdAt;
        }
    }

    const terminals = Array.from(byTerminal.values()).sort((a, b) => {
        // Online first, then by recency
        if (a.status !== b.status) return a.status === 'online' ? -1 : 1;
        const at = a.lastHeartbeat ? new Date(a.lastHeartbeat).getTime() : 0;
        const bt = b.lastHeartbeat ? new Date(b.lastHeartbeat).getTime() : 0;
        return bt - at;
    });

    const onlineCount = terminals.filter((t) => t.status === 'online').length;
    const lastSync =
        terminals
            .map((t) => (t.lastHeartbeat ? new Date(t.lastHeartbeat).getTime() : 0))
            .reduce((acc, t) => (t > acc ? t : acc), 0) || null;

    return (
        <div className="flex flex-col gap-6">
            {/* Manager KPIs */}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <Card>
                    <ZoruCardContent className="flex items-start justify-between p-3.5">
                        <div>
                            <p className="text-[10.5px] uppercase tracking-wide text-zoru-ink-muted">
                                Total terminals
                            </p>
                            <p className="mt-0.5 text-xl font-semibold text-zoru-ink">
                                {terminals.length}
                            </p>
                        </div>
                        <Store className="h-4 w-4 text-zoru-ink-muted" />
                    </ZoruCardContent>
                </Card>
                <Card>
                    <ZoruCardContent className="flex items-start justify-between p-3.5">
                        <div>
                            <p className="text-[10.5px] uppercase tracking-wide text-zoru-ink-muted">
                                Online
                            </p>
                            <p className="mt-0.5 text-xl font-semibold text-zoru-ink">
                                {onlineCount}
                            </p>
                        </div>
                        <span className="inline-block h-2.5 w-2.5 rounded-full bg-zoru-ink" />
                    </ZoruCardContent>
                </Card>
                <Card>
                    <ZoruCardContent className="flex items-start justify-between p-3.5">
                        <div>
                            <p className="text-[10.5px] uppercase tracking-wide text-zoru-ink-muted">
                                Offline
                            </p>
                            <p className="mt-0.5 text-xl font-semibold text-zoru-ink">
                                {terminals.length - onlineCount}
                            </p>
                        </div>
                        <span className="inline-block h-2.5 w-2.5 rounded-full bg-zoru-surface-2" />
                    </ZoruCardContent>
                </Card>
                <Card>
                    <ZoruCardContent className="flex items-start justify-between p-3.5">
                        <div>
                            <p className="text-[10.5px] uppercase tracking-wide text-zoru-ink-muted">
                                Last sync
                            </p>
                            <p className="mt-0.5 text-[13px] font-medium text-zoru-ink">
                                {lastSync
                                    ? formatUtcDateTime(lastSync)
                                    : 'No activity yet'}
                            </p>
                        </div>
                        <Store className="h-4 w-4 text-zoru-ink-muted" />
                    </ZoruCardContent>
                </Card>
            </div>

            <PosTerminalManagerClient terminals={terminals} />
        </div>
    );
}

/* ─── Main Page Component ───────────────────────────────────────────── */

export default async function PosTerminalPage({ searchParams }: PageProps) {
    const sp = await searchParams;
    const isLive = sp.live === '1' || !!sp.holdId;

    if (isLive) {
        return (
            <React.Suspense fallback={<LiveTerminalSkeleton />}>
                <LiveTerminalContainer sp={sp} />
            </React.Suspense>
        );
    }

    return (
        <EntityListShell
            title="Terminals"
            subtitle="POS devices and their current status."
            primaryAction={
                <div className="flex flex-wrap items-center gap-2">
                    <Button size="sm" variant="outline" asChild>
                        <Link href="/dashboard/crm/pos/sessions/new">
                            <Plus className="h-4 w-4" /> New session
                        </Link>
                    </Button>
                    <Button size="sm" asChild>
                        <Link href="/dashboard/crm/pos/terminal?live=1">
                            <ShoppingCart className="h-4 w-4" /> Open live
                            terminal
                        </Link>
                    </Button>
                </div>
            }
        >
            <React.Suspense fallback={<TerminalManagerSkeleton />}>
                <TerminalManagerContainer />
            </React.Suspense>
        </EntityListShell>
    );
}
