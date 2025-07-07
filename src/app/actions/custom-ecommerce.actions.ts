

'use server';

import { getProjectById } from '@/app/actions';
import { connectToDatabase } from '@/lib/mongodb';
import type { EcommProduct, EcommOrder, EcommShop, EcommSettings, AbandonedCartSettings } from '@/lib/definitions';
import { ObjectId, WithId } from 'mongodb';
import { revalidatePath } from 'next/cache';
import { getErrorMessage } from '@/lib/utils';
import axios from 'axios';

// --- Shop Actions ---

export async function getEcommShops(projectId: string): Promise<WithId<EcommShop>[]> {
    const hasAccess = await getProjectById(projectId);
    if (!hasAccess) return [];

    try {
        const { db } = await connectToDatabase();
        const shops = await db.collection<EcommShop>('ecomm_shops')
            .find({ projectId: new ObjectId(projectId) })
            .sort({ createdAt: -1 })
            .toArray();
        return JSON.parse(JSON.stringify(shops));
    } catch (e) {
        console.error("Failed to get e-commerce shops:", e);
        return [];
    }
}

export async function getEcommShopById(shopId: string): Promise<WithId<EcommShop> | null> {
    if (!ObjectId.isValid(shopId)) return null;

    const { db } = await connectToDatabase();
    const shop = await db.collection<EcommShop>('ecomm_shops').findOne({ _id: new ObjectId(shopId) });

    if (!shop) return null;
    const hasAccess = await getProjectById(shop.projectId.toString());
    if (!hasAccess) return null;

    return JSON.parse(JSON.stringify(shop));
}

export async function getEcommShopBySlug(slug: string): Promise<WithId<EcommShop> | null> {
    if (!slug) return null;

    try {
        const { db } = await connectToDatabase();
        const shop = await db.collection<EcommShop>('ecomm_shops').findOne({ slug });

        if (!shop) return null;
        
        // This is a public page, so we don't need to check for user session access.
        
        return JSON.parse(JSON.stringify(shop));
    } catch(e) {
        console.error("Failed to get shop by slug:", e);
        return null;
    }
}


export async function createEcommShop(prevState: any, formData: FormData): Promise<{ message?: string, error?: string, shopId?: string }> {
    const projectId = formData.get('projectId') as string;
    const name = formData.get('name') as string;
    const currency = formData.get('currency') as string;

    if (!projectId || !name || !currency) return { error: 'Project, Shop Name, and Currency are required.' };

    const project = await getProjectById(projectId);
    if (!project) return { error: 'Access denied or project not found.' };

    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

    try {
        const { db } = await connectToDatabase();
        
        const existingSlug = await db.collection('ecomm_shops').findOne({ slug });
        if (existingSlug) {
            return { error: 'A shop with this name already exists, resulting in a duplicate URL slug. Please choose a different name.' };
        }

        const newShop: Omit<EcommShop, '_id'> = {
            projectId: new ObjectId(projectId),
            name,
            slug,
            currency,
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        const result = await db.collection('ecomm_shops').insertOne(newShop as any);
        
        revalidatePath('/dashboard/facebook/custom-ecommerce');
        return { message: `Shop "${name}" created successfully.`, shopId: result.insertedId.toString() };

    } catch (e) {
        return { error: getErrorMessage(e) };
    }
}

export async function updateEcommShopSettings(prevState: any, formData: FormData): Promise<{ message?: string, error?: string }> {
    const shopId = formData.get('shopId') as string;
    if (!shopId || !ObjectId.isValid(shopId)) {
        return { error: 'Shop ID is missing or invalid.' };
    }

    const shop = await getEcommShopById(shopId);
    if (!shop) return { error: 'Access denied or shop not found.' };

    try {
        const { db } = await connectToDatabase();
        const updates: Partial<EcommShop> = {};
        
        const shopName = formData.get('name') as string;
        if(shopName) updates.name = shopName;
        
        const currency = formData.get('currency') as string;
        if(currency) updates.currency = currency;

        const domainValue = formData.get('customDomain') as string;
        updates.customDomain = (domainValue === 'none' || !domainValue) ? undefined : domainValue;
        
        if (formData.has('paymentLinkRazorpay')) updates.paymentLinkRazorpay = (formData.get('paymentLinkRazorpay') as string) || undefined;
        if (formData.has('paymentLinkPaytm')) updates.paymentLinkPaytm = (formData.get('paymentLinkPaytm') as string) || undefined;
        if (formData.has('paymentLinkGPay')) updates.paymentLinkGPay = (formData.get('paymentLinkGPay') as string) || undefined;

        if (formData.has('appearance_primaryColor') || formData.has('appearance_fontFamily') || formData.has('appearance_bannerImageUrl')) {
             updates.appearance = { ...shop.appearance };
             if(formData.has('appearance_primaryColor')) updates.appearance.primaryColor = formData.get('appearance_primaryColor') as string;
             if(formData.has('appearance_fontFamily')) updates.appearance.fontFamily = formData.get('appearance_fontFamily') as string;
             if(formData.has('appearance_bannerImageUrl')) updates.appearance.bannerImageUrl = formData.get('appearance_bannerImageUrl') as string;
        }

        if (formData.has('abandonedCart.enabled')) {
            updates.abandonedCart = { ...shop.abandonedCart } as AbandonedCartSettings;
            updates.abandonedCart.enabled = formData.get('abandonedCart.enabled') === 'on';
            updates.abandonedCart.delayMinutes = parseInt(formData.get('abandonedCart.delayMinutes') as string, 10);
            updates.abandonedCart.flowId = formData.get('abandonedCart.flowId') as string;
        }

        if (Object.keys(updates).length > 0) {
            await db.collection('ecomm_shops').updateOne(
                { _id: new ObjectId(shopId) },
                { $set: { ...updates, updatedAt: new Date() } }
            );
        }

        revalidatePath(`/dashboard/facebook/custom-ecommerce/manage/${shopId}/settings`);
        revalidatePath(`/dashboard/facebook/custom-ecommerce/manage/${shopId}/appearance`);
        return { message: 'Shop settings saved successfully!' };
    } catch (e: any) {
        return { error: 'Failed to save shop settings.' };
    }
}


// --- Product Actions ---

export async function getEcommProducts(shopId: string): Promise<WithId<EcommProduct>[]> {
    if (!ObjectId.isValid(shopId)) return [];
    const shop = await getEcommShopById(shopId);
    if (!shop) return [];
    
    try {
        const { db } = await connectToDatabase();
        const products = await db.collection('ecomm_products')
            .find({ shopId: new ObjectId(shopId) })
            .sort({ createdAt: -1 })
            .toArray();
        return JSON.parse(JSON.stringify(products));
    } catch (e) {
        console.error("Failed to get e-commerce products:", e);
        return [];
    }
}

export async function saveEcommProduct(prevState: any, formData: FormData): Promise<{ message?: string, error?: string }> {
    const shopId = formData.get('shopId') as string;
    const productId = formData.get('productId') as string | null;

    if (!shopId) return { error: 'Shop ID is missing.' };
    const shop = await getEcommShopById(shopId);
    if (!shop) return { error: 'Access denied or shop not found.' };

    try {
        const variantsString = formData.get('variants') as string;
        const variants = variantsString ? JSON.parse(variantsString) : [];

        const productData: Partial<EcommProduct> = {
            projectId: new ObjectId(shop.projectId),
            shopId: new ObjectId(shopId),
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
                { _id: new ObjectId(productId), shopId: new ObjectId(shopId) },
                { $set: productData }
            );
        } else {
            productData.createdAt = new Date();
            await db.collection('ecomm_products').insertOne(productData as EcommProduct);
        }
        
        revalidatePath(`/dashboard/facebook/custom-ecommerce/manage/${shopId}/products`);
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

    const shop = await getEcommShopById(product.shopId.toString());
    if(!shop) return { success: false, error: 'Access denied.' };

    try {
        await db.collection('ecomm_products').deleteOne({ _id: new ObjectId(productId) });
        revalidatePath(`/dashboard/facebook/custom-ecommerce/manage/${product.shopId.toString()}/products`);
        return { success: true };
    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
    }
}


export async function getEcommOrders(shopId: string): Promise<WithId<EcommOrder>[]> {
    if (!ObjectId.isValid(shopId)) return [];
    const shop = await getEcommShopById(shopId);
    if (!shop) return [];

    try {
        const { db } = await connectToDatabase();
        const orders = await db.collection('ecomm_orders')
            .find({ shopId: new ObjectId(shopId) })
            .sort({ createdAt: -1 })
            .limit(50)
            .toArray();
        return JSON.parse(JSON.stringify(orders));
    } catch (e) {
        console.error("Failed to get e-commerce orders:", e);
        return [];
    }
}

export async function syncProductsToMetaCatalog(projectId: string, shopId: string, metaCatalogId: string): Promise<{ message?: string; error?: string }> {
    const project = await getProjectById(projectId);
    if (!project || !project.accessToken) return { error: 'Project not found or access token missing.' };

    const shop = await getEcommShopById(shopId);
    if (!shop || !shop.currency) {
        return { error: 'E-commerce currency is not set in shop settings.' };
    }
    const { accessToken } = project;
    const currency = shop.currency;

    try {
        const { db } = await connectToDatabase();
        const products = await db.collection<EcommProduct>('ecomm_products')
            .find({ shopId: new ObjectId(shopId) })
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
                currency: currency,
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
