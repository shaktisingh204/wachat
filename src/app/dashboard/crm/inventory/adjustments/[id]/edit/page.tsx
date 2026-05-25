/**
 * Stock-adjustment edit route — server entry point.
 *
 * Hands off to the §1D `<AdjustmentEditForm>` which only mutates
 * `reason`, `referenceNumber`, and `notes` (the other fields are tied
 * to the inventory mutation written at creation time).
 */

import { notFound } from 'next/navigation';
import { Suspense } from 'react';

import { getCrmStockAdjustmentById } from '@/app/actions/crm-inventory.actions';
import { mapToStockAdjustmentDto } from '../../types';
import { AdjustmentEditForm } from './adjustment-edit-form';
import { FormSkeleton } from '@/components/crm/form-skeleton';

interface PageProps {
    params: Promise<{ id: string }>;
}

async function EditorContent({ id }: { id: string }) {
    const adj = await getCrmStockAdjustmentById(id);
    if (!adj) notFound();

    const initial = mapToStockAdjustmentDto(adj);

    return <AdjustmentEditForm initial={initial} />;
}

export default async function EditStockAdjustmentPage({ params }: PageProps) {
    const { id } = await params;

    return (
        <Suspense fallback={<FormSkeleton title="Edit Stock Adjustment" />}>
            <EditorContent id={id} />
        </Suspense>
    );
}
