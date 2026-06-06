/**
 * Edit Warehouse route — fetches the row and hands it to the §1D
 * `<WarehouseForm>` so the same shell drives both create + edit.
 */

import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import { Suspense } from 'react';

import { getCrmWarehouseById } from '@/app/actions/crm-warehouses.actions';
import { WarehouseForm } from '../../new/warehouse-form';

interface PageProps {
    params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const { id } = await params;
    const warehouse = await getCrmWarehouseById(id);
    
    if (!warehouse) {
        return {
            title: 'Warehouse Not Found',
        };
    }

    return {
        title: `Edit ${warehouse.name} | SabNode`,
        description: `Edit settings and details for warehouse ${warehouse.name}`,
    };
}

export const dynamic = 'force-dynamic';

export default async function EditWarehousePage({ params }: PageProps) {
    const { id } = await params;
    const warehouse = await getCrmWarehouseById(id);
    if (!warehouse) notFound();

    const initialData = JSON.parse(JSON.stringify(warehouse));
    return (
        <Suspense fallback={<div className="p-8 flex justify-center"><div className="animate-spin h-8 w-8 border-4 border-[var(--st-text)] border-t-transparent rounded-full"></div></div>}>
            <WarehouseForm initialData={initialData} />
        </Suspense>
    );
}
