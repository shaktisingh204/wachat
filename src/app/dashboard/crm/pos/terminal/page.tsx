import { ZoruButton, ZoruCard, ZoruCardContent } from '@/components/zoruui';
import {
  Store,
  Plus } from 'lucide-react';

import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';

/**
 * POS terminal — `/dashboard/crm/pos/terminal`.
 *
 * Server Component shell that resolves the caller's active session
 * (or surfaces a "Open a session" affordance) and renders the live
 * terminal as a `<PosTerminalClient>` island. Also pre-warms the item
 * grid with the first 50 products.
 *
 * Optional `?holdId=<id>` query param pre-loads a held ticket for
 * recall. Per CRM_REBUILD_PLAN §6.3.
 */

import Link from 'next/link';

import {
    getPosSessions,
    getPosHolds,
    searchPosItems,
} from '@/app/actions/crm-pos.actions';

import { PosTerminalClient } from '../_components/pos-terminal-client';

export const dynamic = 'force-dynamic';

interface PageProps {
    searchParams: Promise<{ holdId?: string }>;
}

export default async function PosTerminalPage({ searchParams }: PageProps) {
    const sp = await searchParams;
    const sessions = await getPosSessions({ status: 'open' });
    const activeSession = sessions[0] ?? null;
    const items = await searchPosItems('', 50);

    let prefillHold = null;
    if (sp.holdId) {
        const holds = await getPosHolds({ status: 'held' });
        prefillHold = holds.find((h) => h._id === sp.holdId) ?? null;
    }

    if (!activeSession) {
        return (
            <div className="flex w-full flex-col gap-6">
                <CrmPageHeader
                    title="POS terminal"
                    subtitle="Ring up sales for an open cashier shift."
                    icon={Store}
                    breadcrumbs={[
                        { label: 'CRM', href: '/dashboard/crm' },
                        { label: 'POS', href: '/dashboard/crm/pos' },
                        { label: 'Terminal' },
                    ]}
                />
                <ZoruCard>
                    <ZoruCardContent className="flex flex-col items-center justify-center gap-3 p-10 text-center">
                        <p className="text-sm font-medium text-zoru-ink">
                            No open POS session
                        </p>
                        <p className="text-[13px] text-zoru-ink-muted">
                            Open a session before ringing up sales — that
                            ensures every transaction is auditable against
                            a cashier shift.
                        </p>
                        <ZoruButton size="sm" asChild>
                            <Link href="/dashboard/crm/pos/sessions/new">
                                <Plus className="h-4 w-4" /> Open session
                            </Link>
                        </ZoruButton>
                    </ZoruCardContent>
                </ZoruCard>
            </div>
        );
    }

    return (
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                title="POS terminal"
                subtitle={`Cashier shift on ${activeSession.terminalId} — open since ${new Date(activeSession.openedAt).toLocaleString()}.`}
                icon={Store}
                breadcrumbs={[
                    { label: 'CRM', href: '/dashboard/crm' },
                    { label: 'POS', href: '/dashboard/crm/pos' },
                    { label: 'Terminal' },
                ]}
                actions={
                    <ZoruButton size="sm" variant="outline" asChild>
                        <Link
                            href={`/dashboard/crm/pos/sessions/${activeSession._id}`}
                        >
                            View session
                        </Link>
                    </ZoruButton>
                }
            />
            <PosTerminalClient
                session={activeSession}
                initialItems={items}
                prefillHold={prefillHold}
            />
        </div>
    );
}
