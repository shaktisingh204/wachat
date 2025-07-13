
'use server';

import { revalidatePath } from 'next/cache';
import { type Db, ObjectId, type WithId, Filter } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getProjectById } from '@/app/actions';
import type { EcommProduct } from '@/lib/definitions';
import { getErrorMessage } from '@/lib/utils';
import { v4 as uuidv4 } from 'uuid';

export async function getCrmProducts(projectId: string): Promise<WithId<EcommProduct>[]> {
    const hasAccess = await getProjectById(projectId);
    if (!hasAccess) return [];
    
    try {
        const { db } = await connectToDatabase();
        const filter: any = { projectId: new ObjectId(projectId) };
        
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
    const projectId = formData.get('projectId') as string;
    const productId = formData.get('productId') as string | null;
    const isEditing = !!productId;

    if (!projectId) return { error: 'Project ID is missing.' };
    const project = await getProjectById(projectId);
    if (!project) return { error: 'Access denied or project not found.' };

    try {
        const variantsString = formData.get('variants') as string;
        const variants = variantsString ? JSON.parse(variantsString) : [];

        const productData: Partial<EcommProduct> = {
            projectId: new ObjectId(projectId),
            name: formData.get('name') as string,
            description: formData.get('description') as string,
            price: parseFloat(formData.get('price') as string),
            stock: formData.get('stock') ? parseInt(formData.get('stock') as string, 10) : undefined,
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
                { _id: new ObjectId(productId), projectId: new ObjectId(projectId) },
                { $set: productData }
            );
        } else {
            productData.createdAt = new Date();
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
    
    const { db } = await connectToDatabase();
    const product = await db.collection('crm_products').findOne({ _id: new ObjectId(productId) });
    if (!product) return { success: false, error: 'Product not found.' };

    const hasAccess = await getProjectById(product.projectId.toString());
    if(!hasAccess) return { success: false, error: 'Access denied.' };

    try {
        await db.collection('crm_products').deleteOne({ _id: new ObjectId(productId) });
        revalidatePath(`/dashboard/crm/products`);
        return { success: true };
    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
    }
}
