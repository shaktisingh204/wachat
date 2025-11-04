

'use server';

import { revalidatePath } from 'next/cache';
import { type Db, ObjectId, type WithId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/index.ts';
import type { CrmWarehouse } from '@/lib/definitions';
import { getErrorMessage } from '@/lib/utils';

export async function getCrmWarehouses(): Promise<WithId<CrmWarehouse>[]> {
    const session = await getSession();
    if (!session?.user) return [];

    try {
        const { db } = await connectToDatabase();
        const warehouses = await db.collection<CrmWarehouse>('crm_warehouses')
            .find({ userId: new ObjectId(session.user._id) })
            .sort({ isDefault: -1, name: 1 })
            .toArray();
        return JSON.parse(JSON.stringify(warehouses));
    } catch (e) {
        console.error("Failed to fetch CRM warehouses:", e);
        return [];
    }
}

export async function saveCrmWarehouse(prevState: any, formData: FormData): Promise<{ message?: string; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Access denied.' };

    const warehouseId = formData.get('warehouseId') as string | null;
    const isEditing = !!warehouseId;

    try {
        const warehouseData: Partial<CrmWarehouse> = {
            userId: new ObjectId(session.user._id),
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
                { userId: new ObjectId(session.user._id) },
                { $set: { isDefault: false } }
            );
        }

        if (isEditing && ObjectId.isValid(warehouseId)) {
            await db.collection('crm_warehouses').updateOne({ _id: new ObjectId(warehouseId), userId: new ObjectId(session.user._id) }, { $set: warehouseData });
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
    
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Access denied.' };

    const { db } = await connectToDatabase();
    const warehouse = await db.collection('crm_warehouses').findOne({ _id: new ObjectId(warehouseId), userId: new ObjectId(session.user._id) });
    if (!warehouse) return { success: false, error: 'Warehouse not found or you do not have permission.' };
    
    if (warehouse.isDefault) {
        return { success: false, error: 'Cannot delete the default warehouse.' };
    }

    // Check if there's stock in this warehouse
    const stockCheck = await db.collection('crm_products').findOne({
        userId: new ObjectId(session.user._id),
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
            { userId: new ObjectId(session.user._id) },
            { $pull: { inventory: { warehouseId: new ObjectId(warehouseId) } } }
        );
        revalidatePath(`/dashboard/crm/inventory/warehouses`);
        revalidatePath('/dashboard/crm/products');
        return { success: true };
    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
    }
}
