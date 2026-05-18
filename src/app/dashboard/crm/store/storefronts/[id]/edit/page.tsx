/**
 * Edit storefront — `/dashboard/crm/store/storefronts/[id]/edit`.
 */

import { notFound } from 'next/navigation';

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { StorefrontForm } from '../../_components/storefront-form';
import { getStorefrontById } from '@/app/actions/crm-store.actions';

export const dynamic = 'force-dynamic';

export default async function EditStorefrontPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    const sf = await getStorefrontById(id);
    if (!sf) notFound();
    const name = (sf.name as string) || `Storefront ${id.slice(-6)}`;

    return (
        <EntityDetailShell
            eyebrow="STOREFRONT"
            title={`Edit · ${name}`}
            back={{ href: `/dashboard/crm/store/storefronts/${id}`, label: 'Back to storefront' }}
        >
            <StorefrontForm initial={sf} storefrontId={id} />
        </EntityDetailShell>
    );
}
