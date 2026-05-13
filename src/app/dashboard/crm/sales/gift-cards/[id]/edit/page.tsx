/**
 * Edit gift card — `/dashboard/crm/sales/gift-cards/[id]/edit`.
 *
 * Server component: fetches the gift card and passes it to the client
 * form, which submits `updateGiftCard`. Edit surface is intentionally
 * narrow (non-financial fields only — value/balance stay immutable on
 * edit per the same reasoning as payment receipts).
 */

import { notFound } from 'next/navigation';

import { CrmPageHeader } from '../../../../_components/crm-page-header';
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
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                title={`Edit ${card.code ?? 'gift card'}`}
                subtitle="Update recipient, expiry, and status."
            />
            <EditGiftCardForm giftCardId={id} initial={card} />
        </div>
    );
}
