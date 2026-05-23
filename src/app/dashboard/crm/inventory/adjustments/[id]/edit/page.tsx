/**
 * Stock-adjustment edit route — server entry point.
 *
 * Hands off to the §1D `<AdjustmentEditForm>` which only mutates
 * `reason`, `referenceNumber`, and `notes` (the other fields are tied
 * to the inventory mutation written at creation time).
 */

import { notFound } from 'next/navigation';

import { getCrmStockAdjustmentById } from '@/app/actions/crm-inventory.actions';
import { mapToStockAdjustmentDto } from '../../types';
import { AdjustmentEditForm } from './adjustment-edit-form';

interface PageProps {
    params: Promise<{ id: string }>;
}

export default async function EditStockAdjustmentPage({ params }: PageProps) {
    const { id } = await params;
    const adj = await getCrmStockAdjustmentById(id);
    if (!adj) notFound();

    const initial = mapToStockAdjustmentDto(adj) as any;

    return <AdjustmentEditForm initial={initial} />;
}
