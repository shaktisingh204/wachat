/**
 * Edit Warehouse route — fetches the row and hands it to the §1D
 * `<WarehouseForm>` so the same shell drives both create + edit.
 */

import { notFound } from 'next/navigation';

import { getCrmWarehouseById } from '@/app/actions/crm-warehouses.actions';
import { WarehouseForm } from '../../new/warehouse-form';

interface PageProps {
    params: Promise<{ id: string }>;
}

export default async function EditWarehousePage({ params }: PageProps) {
    const { id } = await params;
    const warehouse = await getCrmWarehouseById(id);
    if (!warehouse) notFound();

    const initialData = JSON.parse(JSON.stringify(warehouse));
    return <WarehouseForm initialData={initialData} />;
}
