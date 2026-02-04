
'use server';

import { revalidatePath } from 'next/cache';
import { type Db, ObjectId, type WithId, Filter } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
import type { CrmProduct } from '@/lib/definitions';
import { getErrorMessage } from '@/lib/utils';

export async function getCrmProducts(
    page: number = 1,
    limit: number = 20,
    query?: string
): Promise<{ products: WithId<CrmProduct>[], total: number }> {
    const session = await getSession();
    if (!session?.user) return { products: [], total: 0 };

    try {
        const { db } = await connectToDatabase();
        const userObjectId = new ObjectId(session.user._id);

        const filter: Filter<CrmProduct> = { userId: userObjectId };
        if (query) {
            filter.$or = [
                { name: { $regex: query, $options: 'i' } },
                { sku: { $regex: query, $options: 'i' } }
            ];
        }

        const skip = (page - 1) * limit;

        const [products, total] = await Promise.all([
            db.collection<CrmProduct>('crm_products')
                .find(filter)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .toArray(),
            db.collection<CrmProduct>('crm_products').countDocuments(filter)
        ]);

        return {
            products: JSON.parse(JSON.stringify(products)),
            total
        };
    } catch (e: any) {
        console.error("Failed to fetch CRM products:", e);
        return { products: [], total: 0 };
    }
}

export async function saveCrmProduct(prevState: any, formData: FormData): Promise<{ message?: string; error?: string; newProduct?: any }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Access denied' };

    try {
        const { db } = await connectToDatabase();
        const userObjectId = new ObjectId(session.user._id);

        const productId = formData.get('productId') as string; // Look for 'productId' hidden field
        const isEditing = !!productId && productId !== '';

        // Extract basic fields
        const name = formData.get('name') as string;
        const sku = formData.get('sku') as string;
        const description = formData.get('description') as string;
        const currency = formData.get('currency') as string || 'INR';

        // Pricing
        const costPrice = parseFloat(formData.get('costPrice') as string) || 0;
        const sellingPrice = parseFloat(formData.get('sellingPrice') as string) || 0;
        const taxRate = parseFloat(formData.get('taxRate') as string) || 0;

        // Inventory
        const isTrackInventory = formData.get('isTrackInventory') === 'on';
        const reorderPoint = parseInt(formData.get('reorderPoint') as string, 10) || 0;

        // Physical
        const length = parseFloat(formData.get('length') as string) || 0;
        const breadth = parseFloat(formData.get('breadth') as string) || 0;
        const height = parseFloat(formData.get('height') as string) || 0;
        const volume = parseFloat(formData.get('volume') as string) || 0;
        const grossWeight = parseFloat(formData.get('grossWeight') as string) || 0;
        const netWeight = parseFloat(formData.get('netWeight') as string) || 0;

        const productData: Partial<CrmProduct> = {
            userId: userObjectId,
            name,
            sku,
            description,
            currency,
            costPrice,
            sellingPrice,
            taxRate,
            isTrackInventory,
            updatedAt: new Date(),
            hsnSac: formData.get('hsnSac') as string,
            itemType: formData.get('itemType') as 'goods' | 'service',
            dimensions: { length, breadth, height, volume },
            weight: { gross: grossWeight, net: netWeight },
            batchTracking: formData.get('batchTracking') === 'on',
        };

        // Relations
        const categoryId = formData.get('categoryId') as string;
        if (categoryId && categoryId !== 'none') productData.categoryId = new ObjectId(categoryId);

        const brandId = formData.get('brandId') as string;
        if (brandId && brandId !== 'none') productData.brandId = new ObjectId(brandId);

        const unitId = formData.get('unitId') as string;
        if (unitId && unitId !== 'none') productData.unitId = new ObjectId(unitId);

        // Images (Single image legacy support + array)
        /* 
        // Logic for image upload would go here. For now, assuming image handling is done via separate upload or simplified.
        // If imageUrl was passed:
        const imageUrl = formData.get('imageUrl') as string;
        if(imageUrl) productData.images = [imageUrl];
        */
        // Handling base64 image if present (similar to existing code)
        const imageFile = formData.get('imageFile') as File | null;
        if (imageFile && imageFile.size > 0) {
            const buffer = Buffer.from(await imageFile.arrayBuffer());
            const dataUri = `data:${imageFile.type};base64,${buffer.toString('base64')}`;
            productData.images = [dataUri];
        } else {
            // If editing and no new file, keep existing? Need logic. 
            // Ideally we shouldn't overwrite images unless explicit.
            // But for now let's just not set it if null.
        }


        if (!productData.name) {
            return { error: 'Product name is required.' };
        }

        if (isEditing) {
            await db.collection('crm_products').updateOne(
                { _id: new ObjectId(productId), userId: userObjectId },
                { $set: productData }
            );
        } else {
            // Check SKU uniqueness
            if (productData.sku) {
                const existing = await db.collection('crm_products').findOne({ userId: userObjectId, sku: productData.sku });
                if (existing) {
                    return { error: 'SKU already exists.' };
                }
            }

            productData.createdAt = new Date();
            // Initialize default inventory if tracking
            if (productData.isTrackInventory) {
                const warehouses = await db.collection('crm_warehouses').find({ userId: userObjectId }).toArray();
                const stockInHand = parseInt(formData.get('stockInHand') as string, 10) || 0;

                if (warehouses.length > 0) {
                    const defaultWarehouse = warehouses.find(w => w.isDefault) || warehouses[0];
                    productData.inventory = warehouses.map(w => ({
                        warehouseId: w._id,
                        stock: w._id.equals(defaultWarehouse._id) ? stockInHand : 0,
                        reorderPoint // Apply reorder point to all or just default? applied to all structure for now
                    }));
                } else {
                    // No warehouse? Just store totalStock or create a default warehouse implicitly?
                    // Better to just have empty inventory array if no warehouse.
                    productData.inventory = [];
                }
                productData.totalStock = stockInHand;
            } else {
                productData.inventory = [];
                productData.totalStock = 0;
            }

            const result = await db.collection('crm_products').insertOne(productData as CrmProduct);
            return { message: 'Product saved successfully.', newProduct: { ...productData, _id: result.insertedId } };
        }

        revalidatePath('/dashboard/crm/inventory/items');
        return { message: 'Product saved successfully.' }; // Fallback for edit, though typically we might want updated product too. For now QuickAdd is only for new.
    } catch (e) {
        return { error: getErrorMessage(e) };
    }
}

export async function deleteCrmProduct(productId: string): Promise<{ success: boolean; error?: string }> {
    if (!ObjectId.isValid(productId)) return { success: false, error: 'Invalid ID.' };

    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Access denied.' };

    try {
        const { db } = await connectToDatabase();
        const result = await db.collection('crm_products').deleteOne({
            _id: new ObjectId(productId),
            userId: new ObjectId(session.user._id)
        });

        if (result.deletedCount === 0) {
            return { success: false, error: 'Product not found.' };
        }

        // Cleanup stock adjustments 
        await db.collection('crm_stock_adjustments').deleteMany({ productId: new ObjectId(productId) });

        revalidatePath('/dashboard/crm/inventory/items');
        return { success: true };
    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
    }
}
