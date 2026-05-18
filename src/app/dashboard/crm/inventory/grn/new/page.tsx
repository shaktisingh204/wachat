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

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
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
        <EntityDetailShell
            eyebrow="GRN"
            title="New GRN"
            back={{ href: '/dashboard/crm/inventory/grn', label: 'GRNs' }}
        >
            <GrnForm seed={seed} />
        </EntityDetailShell>
    );
}
