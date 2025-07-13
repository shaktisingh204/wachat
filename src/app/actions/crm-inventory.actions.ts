
'use server';

import { revalidatePath } from 'next/cache';
import { type Db, ObjectId, type WithId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getProjectById } from '@/app/actions';
import type { CrmStockAdjustment } from '@/lib/definitions';
import { getErrorMessage } from '@/lib/utils';

export async function getCrmStockAdjustments(projectId: string): Promise<WithId<CrmStockAdjustment>[]> {
    const hasAccess = await getProjectById(projectId);
    if (!hasAccess) return [];

    try {
        const { db } = await connectToDatabase();
        const adjustments = await db.collection('crm_stock_adjustments')
            .aggregate([
                { $match: { projectId: new ObjectId(projectId) } },
                { $sort: { date: -1 } },
                { $lookup: { from: 'crm_products', localField: 'productId', foreignField: '_id', as: 'productInfo' } },
                { $lookup: { from: 'crm_warehouses', localField: 'warehouseId', foreignField: '_id', as: 'warehouseInfo' } },
                { $unwind: { path: '$productInfo', preserveNullAndEmptyArrays: true } },
                { $unwind: { path: '$warehouseInfo', preserveNullAndEmptyArrays: true } },
                { $addFields: { productName: '$productInfo.name', warehouseName: '$warehouseInfo.name' } },
                { $project: { productInfo: 0, warehouseInfo: 0 } }
            ]).toArray();
        return JSON.parse(JSON.stringify(adjustments));
    } catch (e) {
        console.error("Failed to fetch CRM stock adjustments:", e);
        return [];
    }
}

export async function saveCrmStockAdjustment(prevState: any, formData: FormData): Promise<{ message?: string; error?: string }> {
    const projectId = formData.get('projectId') as string;
    if (!projectId) return { error: 'Project ID is missing.' };
    const project = await getProjectById(projectId);
    if (!project) return { error: 'Access denied or project not found.' };

    try {
        const adjustmentData = {
            projectId: new ObjectId(projectId),
            productId: new ObjectId(formData.get('productId') as string),
            warehouseId: new ObjectId(formData.get('warehouseId') as string),
            date: new Date(),
            quantity: parseInt(formData.get('quantity') as string, 10),
            reason: formData.get('reason') as CrmStockAdjustment['reason'],
            notes: formData.get('notes') as string | undefined,
        };

        if (!adjustmentData.productId || !adjustmentData.warehouseId || isNaN(adjustmentData.quantity) || !adjustmentData.reason) {
            return { error: 'Missing required fields for stock adjustment.' };
        }

        const { db } = await connectToDatabase();

        // Use a transaction to ensure atomicity
        const session = db.client.startSession();
        let adjustmentResult;

        try {
            await session.withTransaction(async () => {
                // 1. Log the adjustment
                adjustmentResult = await db.collection('crm_stock_adjustments').insertOne(adjustmentData as CrmStockAdjustment, { session });

                // 2. Update the product's inventory for the specific warehouse
                const updateResult = await db.collection('crm_products').updateOne(
                    { _id: adjustmentData.productId, 'inventory.warehouseId': adjustmentData.warehouseId },
                    { $inc: { 'inventory.$.stock': adjustmentData.quantity } },
                    { session }
                );

                // If the warehouse inventory doesn't exist yet, create it
                if (updateResult.matchedCount === 0) {
                     await db.collection('crm_products').updateOne(
                        { _id: adjustmentData.productId },
                        { $push: { inventory: { warehouseId: adjustmentData.warehouseId, stock: adjustmentData.quantity } } },
                        { session }
                    );
                }
            });
        } finally {
            await session.endSession();
        }

        if (!adjustmentResult) {
            throw new Error("Failed to save stock adjustment due to a transaction error.");
        }
        
        revalidatePath('/dashboard/crm/inventory/adjustments');
        revalidatePath('/dashboard/crm/products');
        return { message: 'Stock adjustment saved successfully!' };
    } catch (e) {
        return { error: getErrorMessage(e) };
    }
}
