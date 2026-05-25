import { Button } from '@/components/zoruui';
import { ShoppingCart } from 'lucide-react';
import Link from 'next/link';
import { Suspense } from 'react';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { getPosHolds } from '@/app/actions/crm-pos.actions';
import { PosHoldRecallClient } from '../_components/pos-hold-recall-client';
import { Skeleton } from '@/components/zoruui/skeleton';

/**
 * POS held tickets — `/dashboard/crm/pos/hold-recall`.
 *
 * Server component. Fetches held tickets and delegates all interactive
 * behaviour to `<PosHoldRecallClient>` inside a Suspense container.
 */

export const dynamic = 'force-dynamic';

async function HoldRecallContainer() {
    const holds = await getPosHolds({ status: 'held' });
    return <PosHoldRecallClient holds={holds} />;
}

function HoldRecallSkeleton() {
    return (
        <div className="rounded-xl border border-zoru-line bg-zoru-surface p-4">
            <div className="space-y-3">
                <Skeleton className="h-8 w-full animate-pulse" />
                <Skeleton className="h-12 w-full animate-pulse" />
                <Skeleton className="h-12 w-full animate-pulse" />
                <Skeleton className="h-12 w-full animate-pulse" />
            </div>
        </div>
    );
}

export default async function PosHoldRecallPage() {
    return (
        <EntityListShell
            title="Held tickets"
            subtitle="Parked transactions waiting to be recalled or voided."
            primaryAction={
                <Button size="sm" variant="outline" asChild>
                    <Link href="/dashboard/crm/pos/terminal">
                        <ShoppingCart className="h-4 w-4" /> Back to terminal
                    </Link>
                </Button>
            }
        >
            <Suspense fallback={<HoldRecallSkeleton />}>
                <HoldRecallContainer />
            </Suspense>
        </EntityListShell>
    );
}
