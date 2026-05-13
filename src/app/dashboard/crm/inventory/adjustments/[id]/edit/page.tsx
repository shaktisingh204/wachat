/**
 * Stock-adjustment edit route — server component.
 *
 * Fetches the adjustment by id and hands off to a small client form
 * that only mutates the editable fields (`reason`, `notes`). Quantity,
 * product, and warehouse are immutable post-creation because they are
 * tied to the atomic inventory mutation performed when the adjustment
 * was first written.
 */
import { notFound } from 'next/navigation';

import { CrmPageHeader } from '../../../../_components/crm-page-header';
import { getCrmStockAdjustmentById } from '@/app/actions/crm-inventory.actions';
import { AdjustmentEditForm } from './adjustment-edit-form';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditStockAdjustmentPage({ params }: PageProps) {
  const { id } = await params;
  const adj = await getCrmStockAdjustmentById(id);
  if (!adj) notFound();

  const initial = JSON.parse(JSON.stringify(adj)) as {
    _id: string;
    reason: string;
    notes?: string;
    quantity: number;
    productName?: string;
    warehouseName?: string;
  };

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="Edit Stock Adjustment"
        subtitle="Update the reason or notes for this adjustment."
      />
      <AdjustmentEditForm initial={initial} />
    </div>
  );
}
