import { Button } from '@/components/zoruui';
import { Plus } from 'lucide-react';

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

export default async function PosSessionsPage({ searchParams }: PageProps) {
    const sp = await searchParams;
    const terminalId = (sp.terminalId ?? '').trim() || undefined;
    const status = asStatus(sp.status);

    // Fetch ALL sessions (filters applied client-side for instant feedback
    // on the bulk-select + KPI strip). Then pull today's txns for revenue.
    const [sessions, todaysTxns] = await Promise.all([
        getPosSessions({ terminalId }),
        getPosTransactions({ limit: 500 }),
    ]);

    return (
        <EntityListShell
            title="POS sessions"
            subtitle="Cashier shifts across every terminal."
            primaryAction={
                <ZoruButton size="sm" asChild>
                    <Link href="/dashboard/crm/pos/sessions/new">
                        <Plus className="h-4 w-4" /> Open session
                    </Link>
                </ZoruButton>
            }
        >
            <PosSessionsListClient
                sessions={sessions}
                transactions={todaysTxns}
                initialTerminalId={terminalId ?? ''}
                initialStatus={status}
            />
        </EntityListShell>
    );
}
