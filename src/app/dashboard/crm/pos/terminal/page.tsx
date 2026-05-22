import {
    Button,
    Card,
    ZoruCardContent,
} from '@/components/zoruui';
import { Plus, ShoppingCart, Store } from 'lucide-react';

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { EntityListShell } from '@/components/crm/entity-list-shell';

/**
 * POS terminal — `/dashboard/crm/pos/terminal`.
 *
 * Dual-mode page:
 *   • `?live=1` (or `?holdId=…`) drops the user into the live register
 *     for the currently-open session, just like before.
 *   • Default view is the **Terminal manager** — device list derived
 *     from observed `terminalId`s across sessions, with status
 *     indicator (online if there's an open session, offline otherwise),
 *     last-heartbeat (latest session activity), and quick actions
 *     (open live · open new session · close active).
 */

import Link from 'next/link';

import {
    getPosHolds,
    getPosSessions,
    getPosTransactions,
    searchPosItems,
} from '@/app/actions/crm-pos.actions';

import { PosTerminalClient } from '../_components/pos-terminal-client';
import { PosTerminalManagerClient } from '../_components/pos-terminal-manager-client';

export const dynamic = 'force-dynamic';

interface PageProps {
    searchParams: Promise<{ holdId?: string; live?: string }>;
}

export default async function PosTerminalPage({ searchParams }: PageProps) {
    const sp = await searchParams;
    const isLive = sp.live === '1' || !!sp.holdId;

    /* ─── Live mode: register the cashier into the open session ──── */
    if (isLive) {
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

    /* ─── Manager mode: device list ────────────────────────────── */
    const [allSessions, allTxns] = await Promise.all([
        getPosSessions({}),
        getPosTransactions({ limit: 500 }),
    ]);

    // Derive distinct terminals from session history.
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
                            <p className="mt-0.5 text-xl font-semibold text-emerald-500">
                                {onlineCount}
                            </p>
                        </div>
                        <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500" />
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
                        <span className="inline-block h-2.5 w-2.5 rounded-full bg-zinc-400" />
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
                                    ? new Date(lastSync).toLocaleString()
                                    : 'No activity yet'}
                            </p>
                        </div>
                        <Store className="h-4 w-4 text-zoru-ink-muted" />
                    </ZoruCardContent>
                </Card>
            </div>

            <PosTerminalManagerClient terminals={terminals} />
        </EntityListShell>
    );
}
