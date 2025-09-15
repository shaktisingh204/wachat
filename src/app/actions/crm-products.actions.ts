

'use server';

import { revalidatePath } from 'next/cache';
import { type Db, ObjectId, type WithId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions';
import type { EcommProduct } from '@/lib/definitions';
import { getErrorMessage } from '@/lib/utils';
import { v4 as uuidv4 } from 'uuid';

export async function getCrmProducts(): Promise<WithId<EcommProduct>[]> {
    const session = await getSession();
    if (!session?.user) return [];
    
    try {
        const { db } = await connectToDatabase();
        const filter: any = { userId: new ObjectId(session.user._id) };
        
        const products = await db.collection('crm_products')
            .find(filter)
            .sort({ createdAt: -1 })
            .toArray();
        return JSON.parse(JSON.stringify(products));
    } catch (e) {
        console.error("Failed to get CRM products:", e);
        return [];
    }
}

export async function saveCrmProduct(prevState: any, formData: FormData): Promise<{ message?: string, error?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Access denied or project not found.' };

    const productId = formData.get('productId') as string | null;
    const isEditing = !!productId;

    try {
        const variantsString = formData.get('variants') as string;
        const variants = variantsString ? JSON.parse(variantsString) : [];

        const productData: Partial<EcommProduct> = {
            userId: new ObjectId(session.user._id),
            name: formData.get('name') as string,
            description: formData.get('description') as string,
            price: parseFloat(formData.get('price') as string),
            sku: formData.get('sku') as string,
            category: formData.get('category') as string,
            subcategory: formData.get('subcategory') as string,
            variants: variants,
            updatedAt: new Date(),
        };

        if (!productData.name || isNaN(productData.price)) {
            return { error: 'Product name and price are required.' };
        }
        
        const imageFile = formData.get('imageFile') as File | null;
        if (imageFile && imageFile.size > 0) {
            const buffer = Buffer.from(await imageFile.arrayBuffer());
            const dataUri = `data:${imageFile.type};base64,${buffer.toString('base64')}`;
            productData.imageUrl = dataUri;
        } else if (isEditing) {
            productData.imageUrl = formData.get('imageUrl') as string;
        }

        const { db } = await connectToDatabase();

        if (productId && ObjectId.isValid(productId)) {
            await db.collection('crm_products').updateOne(
                { _id: new ObjectId(productId), userId: new ObjectId(session.user._id) },
                { $set: productData }
            );
        } else {
            productData.createdAt = new Date();
            // When creating a new product, we also initialize its inventory across all warehouses for this user
            const warehouses = await db.collection('crm_warehouses').find({ userId: new ObjectId(session.user._id) }).toArray();
            productData.inventory = warehouses.map(w => ({ warehouseId: w._id, stock: 0 }));

            await db.collection('crm_products').insertOne(productData as EcommProduct);
        }
        
        revalidatePath('/dashboard/crm/products');
        return { message: `Product "${productData.name}" saved successfully!` };
    } catch (e) {
        return { error: getErrorMessage(e) };
    }
}

export async function deleteCrmProduct(productId: string): Promise<{ success: boolean; error?: string }> {
    if (!ObjectId.isValid(productId)) return { success: false, error: 'Invalid Product ID.' };
    
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Access denied.' };

    const { db } = await connectToDatabase();
    const product = await db.collection('crm_products').findOne({ _id: new ObjectId(productId), userId: new ObjectId(session.user._id) });
    if (!product) return { success: false, error: 'Product not found or you do not have permission to delete it.' };

    try {
        await db.collection('crm_products').deleteOne({ _id: new ObjectId(productId) });
        // Also delete any related stock adjustments
        await db.collection('crm_stock_adjustments').deleteMany({ productId: new ObjectId(productId) });

        revalidatePath(`/dashboard/crm/products`);
        revalidatePath('/dashboard/crm/inventory/adjustments');
        return { success: true };
    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
    }
}
