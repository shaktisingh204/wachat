
'use server';

import { getProjectById } from '@/app/actions';
import { connectToDatabase } from '@/lib/mongodb';
import type { EcommProduct, EcommOrder, EcommSettings } from '@/lib/definitions';
import { ObjectId, WithId } from 'mongodb';
import { revalidatePath } from 'next/cache';
import { getErrorMessage } from '@/lib/utils';
import axios from 'axios';

export async function getEcommProducts(projectId: string): Promise<WithId<EcommProduct>[]> {
    const hasAccess = await getProjectById(projectId);
    if (!hasAccess) return [];
    
    try {
        const { db } = await connectToDatabase();
        const products = await db.collection('ecomm_products')
            .find({ projectId: new ObjectId(projectId) })
            .sort({ createdAt: -1 })
            .toArray();
        return JSON.parse(JSON.stringify(products));
    } catch (e) {
        console.error("Failed to get e-commerce products:", e);
        return [];
    }
}

export async function saveEcommProduct(prevState: any, formData: FormData): Promise<{ message?: string, error?: string }> {
    const projectId = formData.get('projectId') as string;
    const productId = formData.get('productId') as string | null;

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
            imageUrl: formData.get('imageUrl') as string,
            variants: variants,
            updatedAt: new Date(),
        };

        if (!productData.name || isNaN(productData.price)) {
            return { error: 'Product name and price are required.' };
        }
        
        const { db } = await connectToDatabase();

        if (productId && ObjectId.isValid(productId)) {
            await db.collection('ecomm_products').updateOne(
                { _id: new ObjectId(productId), projectId: new ObjectId(projectId) },
                { $set: productData }
            );
        } else {
            productData.createdAt = new Date();
            await db.collection('ecomm_products').insertOne(productData as EcommProduct);
        }
        
        revalidatePath('/dashboard/custom-ecommerce/products');
        return { message: `Product "${productData.name}" saved successfully!` };
    } catch (e) {
        return { error: getErrorMessage(e) };
    }
}

export async function deleteEcommProduct(productId: string): Promise<{ success: boolean; error?: string }> {
    if (!ObjectId.isValid(productId)) return { success: false, error: 'Invalid Product ID.' };
    
    const { db } = await connectToDatabase();
    const product = await db.collection('ecomm_products').findOne({ _id: new ObjectId(productId) });
    if (!product) return { success: false, error: 'Product not found.' };

    const hasAccess = await getProjectById(product.projectId.toString());
    if (!hasAccess) return { success: false, error: 'Access denied.' };

    try {
        await db.collection('ecomm_products').deleteOne({ _id: new ObjectId(productId) });
        revalidatePath('/dashboard/custom-ecommerce/products');
        return { success: true };
    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
    }
}


export async function getEcommOrders(projectId: string): Promise<WithId<EcommOrder>[]> {
    const hasAccess = await getProjectById(projectId);
    if (!hasAccess) return [];

    try {
        const { db } = await connectToDatabase();
        const orders = await db.collection('ecomm_orders')
            .find({ projectId: new ObjectId(projectId) })
            .sort({ createdAt: -1 })
            .limit(50) // Add a limit for performance
            .toArray();
        return JSON.parse(JSON.stringify(orders));
    } catch (e) {
        console.error("Failed to get e-commerce orders:", e);
        return [];
    }
}

export async function getEcommSettings(projectId: string): Promise<EcommSettings | null> {
    const project = await getProjectById(projectId);
    if (!project || !project.ecommSettings) {
        return null;
    }
    return project.ecommSettings;
}

export async function saveEcommShopSettings(prevState: any, formData: FormData): Promise<{ message?: string, error?: string }> {
    const projectId = formData.get('projectId') as string;
    if (!projectId) return { error: 'Project ID is missing.' };

    const project = await getProjectById(projectId);
    if (!project) return { error: 'Access denied or project not found.' };

    try {
        const settings: EcommSettings = {
            shopName: formData.get('shopName') as string,
            currency: formData.get('currency') as string,
            customDomain: formData.get('customDomain') as string || undefined,
            paymentLinkRazorpay: formData.get('paymentLinkRazorpay') as string || undefined,
            paymentLinkPaytm: formData.get('paymentLinkPaytm') as string || undefined,
            paymentLinkGPay: formData.get('paymentLinkGPay') as string || undefined,
            abandonedCart: {
                enabled: formData.get('abandonedCart.enabled') === 'on',
                delayMinutes: parseInt(formData.get('abandonedCart.delayMinutes') as string, 10) || 60,
                flowId: formData.get('abandonedCart.flowId') as string,
            }
        };

        if (!settings.shopName || !settings.currency) {
            return { error: 'Shop Name and Currency are required.' };
        }

        const { db } = await connectToDatabase();
        
        await db.collection('projects').updateOne(
            { _id: new ObjectId(projectId) },
            { $set: { ecommSettings: settings } }
        );

        revalidatePath('/dashboard/custom-ecommerce/settings');
        return { message: 'Shop settings saved successfully!' };
    } catch (e: any) {
        return { error: 'Failed to save shop settings.' };
    }
}

export async function syncProductsToMetaCatalog(projectId: string, metaCatalogId: string): Promise<{ message?: string; error?: string }> {
    const project = await getProjectById(projectId);
    if (!project || !project.accessToken) return { error: 'Project not found or access token missing.' };

    const { accessToken, ecommSettings } = project;
    if (!ecommSettings?.currency) {
        return { error: 'E-commerce currency is not set in project settings.' };
    }

    try {
        const { db } = await connectToDatabase();
        const products = await db.collection<EcommProduct>('ecomm_products')
            .find({ projectId: new ObjectId(projectId) })
            .toArray();
        
        if (products.length === 0) {
            return { message: 'No custom products to sync.' };
        }

        const batchOps = products.map(product => {
            const body = new URLSearchParams({
                retailer_id: product._id.toString(),
                name: product.name,
                description: product.description || '',
                price: String(product.price * 100), // Price in cents
                currency: ecommSettings.currency,
                image_url: product.imageUrl || 'https://placehold.co/600x600.png',
                availability: (product.stock ?? 1) > 0 ? 'in_stock' : 'out_of_stock',
                inventory: String(product.stock ?? 100),
                condition: 'new'
            }).toString();

            return {
                method: 'POST',
                relative_url: `${metaCatalogId}/products`,
                body: body
            };
        });
        
        // The API supports up to 50 operations per batch call.
        const BATCH_SIZE = 50;
        let successfulSyncs = 0;
        let errors: string[] = [];

        for (let i = 0; i < batchOps.length; i += BATCH_SIZE) {
            const batch = batchOps.slice(i, i + BATCH_SIZE);
            const response = await axios.post(`https://graph.facebook.com/v23.0/`, {
                access_token: accessToken,
                batch: JSON.stringify(batch),
            });

            if (response.data.error) {
                throw new Error(getErrorMessage({ response }));
            }

            // Process batch response
            response.data.forEach((res: any, index: number) => {
                if (res.code === 200) {
                    successfulSyncs++;
                } else {
                    const errorBody = JSON.parse(res.body);
                    errors.push(`Product #${i+index}: ${errorBody.error?.message || 'Unknown error'}`);
                }
            });
        }
        
        let message = `Successfully synced ${successfulSyncs} of ${products.length} products.`;
        if (errors.length > 0) {
            message += `\nErrors on ${errors.length} products.`;
        }

        return { message, error: errors.length > 0 ? errors.join('\n') : undefined };

    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}
