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

import { PackageCheck } from 'lucide-react';

import { CrmPageHeader } from '../../../_components/crm-page-header';
import { GrnForm, type GrnFormSeed } from '../_components/grn-form';
import { getGrnSeedFromPo } from '@/app/actions/crm/grns.actions';

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

    return (
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                title="New GRN"
                subtitle={
                    seed?.poId
                        ? 'Pre-filled from a purchase order — confirm and save.'
                        : 'Record goods received from a vendor against a purchase order.'
                }
                icon={PackageCheck}
            />
            <GrnForm seed={seed} />
        </div>
    );
}
