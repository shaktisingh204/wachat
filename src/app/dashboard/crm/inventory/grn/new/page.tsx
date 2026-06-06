/**
 * Create GRN — `/dashboard/crm/inventory/grn/new`.
 *
 * Server component shell that hands off to the shared `<GrnForm>`
 * (also used by Edit). When invoked with
 * `?fromKind=purchaseOrder&fromId=…` (the canonical PO→GRN
 * conversion path) it hydrates the parent PO and seeds the form with
 * vendor + warehouse + line items.
 *
 * GRNs have no custom-field panel (`'grn'` is not registered as a
 * `WsCustomFieldBelongsTo` key), so this route does no extra
 * pre-fetching beyond the seed.
 */

import { Suspense } from 'react';
import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { GrnForm, type GrnFormSeed } from '../_components/grn-form';
import { getGrnSeedFromPo } from '@/app/actions/crm/grns.actions';
import { Skeleton } from '@/components/sabcrm/20ui';

export const dynamic = 'force-dynamic';

interface NewGrnSearch {
    fromKind?: string;
    fromId?: string;
}

export default async function NewGrnPage({
    searchParams,
}: {
    searchParams: Promise<NewGrnSearch>;
}) {
    const sp = await searchParams;
    const fromKind = (sp.fromKind ?? '').trim();
    const fromId = (sp.fromId ?? '').trim();

    return (
        <EntityDetailShell
            eyebrow="GRN"
            title="New GRN"
            back={{ href: '/dashboard/crm/inventory/grn', label: 'GRNs' }}
        >
            <Suspense fallback={<GrnFormSkeleton />}>
                <GrnFormHydrator fromKind={fromKind} fromId={fromId} />
            </Suspense>
        </EntityDetailShell>
    );
}

async function GrnFormHydrator({
    fromKind,
    fromId,
}: {
    fromKind: string;
    fromId: string;
}) {
    let seed: GrnFormSeed | undefined;

    if (fromKind === 'purchaseOrder' && fromId) {
        const built = await getGrnSeedFromPo(fromId);
        if (built) {
            seed = {
                vendorId: built.vendorId,
                warehouseId: built.warehouseId,
                poId: built.poId,
                items: built.items,
            };
        }
    }

    return <GrnForm seed={seed} />;
}

function GrnFormSkeleton() {
    return (
        <div className="space-y-6 rounded-lg border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-10 w-full" />
                </div>
                <div className="space-y-2">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-10 w-full" />
                </div>
                <div className="space-y-2 md:col-span-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-10 w-full" />
                </div>
            </div>
            <div className="mt-8 space-y-4">
                <Skeleton className="h-6 w-[200px]" />
                <Skeleton className="h-24 w-full" />
            </div>
            <div className="flex justify-end gap-2 pt-4 border-t border-[var(--st-border)] mt-8">
                <Skeleton className="h-10 w-24" />
                <Skeleton className="h-10 w-32" />
            </div>
        </div>
    );
}

