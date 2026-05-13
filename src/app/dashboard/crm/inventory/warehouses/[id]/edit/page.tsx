/**
 * Warehouse edit route — server component.
 *
 * Fetches the warehouse by id and reuses the same `WarehouseForm` that
 * powers `/new`. The form detects edit-mode via a hidden `warehouseId`
 * field and routes the submission through `saveCrmWarehouse`.
 */
import { notFound } from 'next/navigation';
import { Warehouse as WarehouseIcon } from 'lucide-react';

import { CrmPageHeader } from '../../../../_components/crm-page-header';
import { getCrmWarehouseById } from '@/app/actions/crm-warehouses.actions';
import { WarehouseForm } from '../../new/warehouse-form';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditWarehousePage({ params }: PageProps) {
  const { id } = await params;
  const warehouse = await getCrmWarehouseById(id);
  if (!warehouse) notFound();

  // Serialize so the client form receives plain JS shapes.
  const initialData = JSON.parse(JSON.stringify(warehouse));

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="Edit Warehouse"
        subtitle={`Update details for ${warehouse.name}.`}
        icon={WarehouseIcon}
      />
      <WarehouseForm initialData={initialData} />
    </div>
  );
}
