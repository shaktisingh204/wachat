/**
 * Edit gift card — `/dashboard/crm/sales/gift-cards/[id]/edit`.
 *
 * Server component: fetches the gift card and passes it to the client
 * form, which submits `updateGiftCard`. Edit surface is intentionally
 * narrow (non-financial fields only — value/balance stay immutable on
 * edit per the same reasoning as payment receipts).
 */

import { notFound } from 'next/navigation';

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { getGiftCardById } from '@/app/actions/crm-gift-cards.actions';
import { EditGiftCardForm } from './edit-form';

export const dynamic = 'force-dynamic';

export default async function EditGiftCardPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    const result = await getGiftCardById(id);
    if (!result) notFound();
    const card: Record<string, any> = result!;

    return (
        <EntityDetailShell
            eyebrow="GIFT CARD"
            title={`Edit ${card.code ?? 'gift card'}`}
            back={{ href: '/dashboard/crm/sales/gift-cards', label: 'Gift Cards' }}
        >
            <EditGiftCardForm giftCardId={id} initial={card} />
        </EntityDetailShell>
    );
}
