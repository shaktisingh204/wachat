import { ZoruButton } from '@/components/zoruui';
import {
  Store,
  Plus } from 'lucide-react';

import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';

/**
 * POS sessions list — `/dashboard/crm/pos/sessions`.
 *
 * Server component. Filters via query string (`terminalId`, `status`).
 * Per-row actions wired through `<PosSessionsListClient>`.
 */

import Link from 'next/link';

import {
    getPosSessions,
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

    const sessions = await getPosSessions({ terminalId, status });

    return (
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                title="POS sessions"
                subtitle="Cashier shifts across every terminal."
                icon={Store}
                breadcrumbs={[
                    { label: 'CRM', href: '/dashboard/crm' },
                    { label: 'POS', href: '/dashboard/crm/pos' },
                    { label: 'Sessions' },
                ]}
                actions={
                    <ZoruButton size="sm" asChild>
                        <Link href="/dashboard/crm/pos/sessions/new">
                            <Plus className="h-4 w-4" /> Open session
                        </Link>
                    </ZoruButton>
                }
            />
            <PosSessionsListClient
                sessions={sessions}
                initialTerminalId={terminalId ?? ''}
                initialStatus={status}
            />
        </div>
    );
}
