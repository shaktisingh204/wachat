
'use server';

import { revalidatePath } from 'next/cache';
import { type Db, ObjectId, type WithId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getProjectById } from '@/app/actions';
import type { CrmWarehouse } from '@/lib/definitions';
import { getErrorMessage } from '@/lib/utils';

export async function getCrmWarehouses(projectId: string): Promise<WithId<CrmWarehouse>[]> {
    const hasAccess = await getProjectById(projectId);
    if (!hasAccess) return [];

    try {
        const { db } = await connectToDatabase();
        const warehouses = await db.collection<CrmWarehouse>('crm_warehouses')
            .find({ projectId: new ObjectId(projectId) })
            .sort({ isDefault: -1, name: 1 })
            .toArray();
        return JSON.parse(JSON.stringify(warehouses));
    } catch (e) {
        console.error("Failed to fetch CRM warehouses:", e);
        return [];
    }
}

export async function saveCrmWarehouse(prevState: any, formData: FormData): Promise<{ message?: string; error?: string }> {
    const projectId = formData.get('projectId') as string;
    const warehouseId = formData.get('warehouseId') as string | null;
    const isEditing = !!warehouseId;

    if (!projectId) return { error: 'Project ID is missing.' };
    const project = await getProjectById(projectId);
    if (!project) return { error: 'Access denied or project not found.' };

    try {
        const warehouseData: Partial<CrmWarehouse> = {
            projectId: new ObjectId(projectId),
            name: formData.get('name') as string,
            location: formData.get('location') as string,
            isDefault: formData.get('isDefault') === 'on',
            updatedAt: new Date(),
        };

        if (!warehouseData.name) {
            return { error: 'Warehouse name is required.' };
        }

        const { db } = await connectToDatabase();

        // If setting this as default, unset other defaults
        if (warehouseData.isDefault) {
            await db.collection('crm_warehouses').updateMany(
                { projectId: new ObjectId(projectId) },
                { $set: { isDefault: false } }
            );
        }

        if (isEditing && ObjectId.isValid(warehouseId)) {
            await db.collection('crm_warehouses').updateOne({ _id: new ObjectId(warehouseId), projectId: new ObjectId(projectId) }, { $set: warehouseData });
        } else {
            warehouseData.createdAt = new Date();
            await db.collection('crm_warehouses').insertOne(warehouseData as CrmWarehouse);
        }
        
        revalidatePath('/dashboard/crm/inventory/warehouses');
        return { message: `Warehouse "${warehouseData.name}" saved successfully!` };
    } catch (e) {
        return { error: getErrorMessage(e) };
    }
}

export async function deleteCrmWarehouse(warehouseId: string): Promise<{ success: boolean; error?: string }> {
    if (!ObjectId.isValid(warehouseId)) return { success: false, error: 'Invalid Warehouse ID.' };
    
    const { db } = await connectToDatabase();
    const warehouse = await db.collection('crm_warehouses').findOne({ _id: new ObjectId(warehouseId) });
    if (!warehouse) return { success: false, error: 'Warehouse not found.' };
    
    if (warehouse.isDefault) {
        return { success: false, error: 'Cannot delete the default warehouse.' };
    }

    const hasAccess = await getProjectById(warehouse.projectId.toString());
    if(!hasAccess) return { success: false, error: 'Access denied.' };

    // Check if there's stock in this warehouse
    const stockCheck = await db.collection('crm_products').findOne({
        projectId: warehouse.projectId,
        'inventory.warehouseId': warehouse._id,
        'inventory.stock': { $gt: 0 }
    });

    if (stockCheck) {
        return { success: false, error: 'Cannot delete warehouse with stock. Please adjust inventory first.' };
    }

    try {
        await db.collection('crm_warehouses').deleteOne({ _id: new ObjectId(warehouseId) });
        // Also remove inventory tracking for this warehouse from all products
        await db.collection('crm_products').updateMany(
            { projectId: warehouse.projectId },
            { $pull: { inventory: { warehouseId: new ObjectId(warehouseId) } } }
        );
        revalidatePath(`/dashboard/crm/inventory/warehouses`);
        revalidatePath('/dashboard/crm/products');
        return { success: true };
    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
    }
}
