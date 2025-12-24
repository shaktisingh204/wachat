
'use server';

import { getProjectById } from '@/app/actions/index.ts';
import { getErrorMessage } from '@/lib/utils';
import axios from 'axios';
import { revalidatePath } from 'next/cache';
import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId, type WithId } from 'mongodb';
import type { Catalog, Product } from '@/lib/definitions';

const API_VERSION = 'v24.0';

export async function syncCatalogs(projectId: string): Promise<{ catalogs: WithId<Catalog>[], error?: string }> {
    const project = await getProjectById(projectId);
    if (!project) return { catalogs: [], error: 'Project not found or access denied.' };
    
    const accessToken = process.env.META_ADMIN_TOKEN;
    const { wabaId } = project;

    if (!wabaId) return { catalogs: [], error: 'Project WABA ID not found.' };
    if (!accessToken) {
        console.error("META_ADMIN_TOKEN is not set in environment variables.");
        return { catalogs: [], error: 'Server configuration error: Admin token not set.' };
    }

    try {
        const response = await axios.get(`https://graph.facebook.com/${API_VERSION}/${wabaId}/product_catalogs`, {
            params: { access_token: accessToken }
        });
        
        const fetchedCatalogs = response.data.data;
        if (!fetchedCatalogs || fetchedCatalogs.length === 0) {
            return { catalogs: [], error: "No catalogs found for this WABA." };
        }

        const { db } = await connectToDatabase();
        const bulkOps = fetchedCatalogs.map((catalog: any) => ({
            updateOne: {
                filter: { metaCatalogId: catalog.id, projectId: new ObjectId(projectId) },
                update: {
                    $set: { name: catalog.name },
                    $setOnInsert: {
                        projectId: new ObjectId(projectId),
                        metaCatalogId: catalog.id,
                        createdAt: new Date(),
                    }
                },
                upsert: true,
            }
        }));
        
        if (bulkOps.length > 0) {
            await db.collection('catalogs').bulkWrite(bulkOps);
        }

        const updatedCatalogs = await db.collection<Catalog>('catalogs').find({ projectId: new ObjectId(projectId) }).toArray();
        
        // Auto-assign first catalog if none is connected
        if (updatedCatalogs.length > 0 && !project.connectedCatalogId) {
             await db.collection('projects').updateOne(
                { _id: project._id },
                { $set: { connectedCatalogId: updatedCatalogs[0].metaCatalogId } }
            );
        }

        revalidatePath('/dashboard/catalog');
        revalidatePath('/dashboard/facebook/commerce/products');
        
        return { catalogs: JSON.parse(JSON.stringify(updatedCatalogs)) };
    } catch (e: any) {
        console.error("Catalog sync error:", getErrorMessage(e));
        return { catalogs: [], error: getErrorMessage(e) };
    }
}

export async function getCatalogs(projectId: string): Promise<WithId<Catalog>[]> {
    if (!projectId) return [];
    try {
        const { db } = await connectToDatabase();
        const catalogs = await db.collection<Catalog>('catalogs').find({ projectId: new ObjectId(projectId) }).toArray();
        return JSON.parse(JSON.stringify(catalogs));
    } catch (e) {
        console.error("Failed to get catalogs:", e);
        return [];
    }
}

export async function getProductsForCatalog(catalogId: string, projectId: string) {
    const project = await getProjectById(projectId);
    if (!project) return [];

    const accessToken = process.env.META_ADMIN_TOKEN;
    if (!accessToken) {
        console.error("META_ADMIN_TOKEN is not set in environment variables.");
        return [];
    }

    try {
        const response = await axios.get(`https://graph.facebook.com/${API_VERSION}/${catalogId}/products`, {
            params: {
                access_token: accessToken,
                fields: 'id,name,description,category,product_type,image_url,price,currency,availability,condition,retailer_id,inventory,item_group_id'
            }
        });
        return response.data.data;
    } catch (e) {
        console.error(`Failed to get products for catalog ${catalogId}:`, getErrorMessage(e));
        return [];
    }
}


export async function addProductToCatalog(prevState: any, formData: FormData): Promise<{ success: boolean; error?: string; message?: string }> {
    const projectId = formData.get('projectId') as string;
    const catalogId = formData.get('catalogId') as string;
    const project = await getProjectById(projectId);
    if (!project) return { success: false, error: 'Project not found.' };

    const accessToken = process.env.META_ADMIN_TOKEN;
    if (!accessToken) return { success: false, error: 'Server configuration error.' };
    
    const priceString = formData.get('price') as string;
    const [priceValue, currency] = priceString.split(' ');

    const payload = {
        name: formData.get('title'),
        description: formData.get('description'),
        availability: formData.get('availability'),
        condition: formData.get('condition'),
        price: Number(priceValue) * 100, // Convert to cents
        currency: currency || 'USD',
        inventory: Number(formData.get('inventory')),
        link: formData.get('link'),
        image_url: formData.get('image_link'),
        brand: formData.get('brand'),
        retailer_id: formData.get('retailer_id'),
    };

    try {
        await axios.post(`https://graph.facebook.com/${API_VERSION}/${catalogId}/products`, {
            ...payload,
            access_token: accessToken
        });
        return { success: true, message: "Product added successfully." };
    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
    }
}

export async function deleteProductFromCatalog(productId: string, projectId: string): Promise<{ success: boolean; error?: string }> {
    const project = await getProjectById(projectId);
    if (!project) return { success: false, error: 'Project not found.' };

    const accessToken = process.env.META_ADMIN_TOKEN;
    if (!accessToken) return { success: false, error: 'Server configuration error.' };

    try {
        await axios.delete(`https://graph.facebook.com/${API_VERSION}/${productId}`, {
            params: { access_token: accessToken }
        });
        return { success: true };
    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
    }
}

export async function createCatalog(prevState: any, formData: FormData): Promise<{ success: boolean; error?: string; message?: string }> {
     const projectId = formData.get('projectId') as string;
     const project = await getProjectById(projectId);
    if (!project || !project.businessId) return { success: false, error: 'Project not found or business ID is missing.' };

    const accessToken = process.env.META_ADMIN_TOKEN;
    if (!accessToken) return { success: false, error: 'Server configuration error.' };

    const payload = {
        name: formData.get('catalogName'),
    };
    
    try {
        const response = await axios.post(`https://graph.facebook.com/${API_VERSION}/${project.businessId}/product_catalogs`, {
            ...payload,
            access_token: accessToken
        });
        
        await syncCatalogs(projectId);
        
        return { success: true, message: `Catalog "${payload.name}" created successfully with ID: ${response.data.id}` };
    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
    }
}

export async function listProductSets(catalogId: string, projectId: string): Promise<any[]> {
    const project = await getProjectById(projectId);
    if (!project) return [];

    const accessToken = process.env.META_ADMIN_TOKEN;
    if (!accessToken) return [];

    try {
        const response = await axios.get(`https://graph.facebook.com/${API_VERSION}/${catalogId}/product_sets`, {
            params: { access_token: accessToken, fields: 'id,name,product_count' }
        });
        return response.data.data || [];
    } catch (e) {
        console.error("Failed to list product sets:", getErrorMessage(e));
        return [];
    }
}

export async function createProductSet(prevState: any, formData: FormData): Promise<{ success: boolean; error?: string; message?: string }> {
     const projectId = formData.get('projectId') as string;
     const project = await getProjectById(projectId);
    if (!project) return { success: false, error: 'Project not found.' };

    const accessToken = process.env.META_ADMIN_TOKEN;
    if (!accessToken) return { success: false, error: 'Server configuration error.' };

    const catalogId = formData.get('catalogId') as string;
    const payload = { name: formData.get('name') };
    
    try {
        await axios.post(`https://graph.facebook.com/${API_VERSION}/${catalogId}/product_sets`, {
            ...payload,
            access_token: accessToken
        });
        return { success: true, message: `Collection "${payload.name}" created successfully.` };
    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
    }
}


export async function deleteProductSet(setId: string, projectId: string): Promise<{ success: boolean; error?: string }> {
    const project = await getProjectById(projectId);
    if (!project) return { success: false, error: 'Project not found.' };

    const accessToken = process.env.META_ADMIN_TOKEN;
    if (!accessToken) return { success: false, error: 'Server configuration error.' };

    try {
        await axios.delete(`https://graph.facebook.com/${API_VERSION}/${setId}`, {
            params: { access_token: accessToken }
        });
        return { success: true };
    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
    }
}


export async function getTaggedMediaForProduct(productId: string, projectId: string): Promise<{ media?: any[], error?: string }> {
    const project = await getProjectById(projectId);
    if (!project) return { error: 'Project not found.' };

    const accessToken = process.env.META_ADMIN_TOKEN;
    if (!accessToken) return { error: 'Server configuration error.' };

    try {
         const response = await axios.get(`https://graph.facebook.com/${API_VERSION}/${productId}/tagged_media`, {
            params: { access_token: accessToken, fields: 'id,media_url,permalink,thumbnail_url' }
        });
        return { media: response.data.data };
    } catch(e) {
        return { error: getErrorMessage(e) };
    }
}

export async function updateProductInCatalog(prevState: any, formData: FormData): Promise<{ success: boolean; error?: string; message?: string }> {
    const projectId = formData.get('projectId') as string;
    const productId = formData.get('productId') as string;
    const project = await getProjectById(projectId);
    if (!project) return { success: false, error: 'Project not found.' };

    const accessToken = process.env.META_ADMIN_TOKEN;
    if (!accessToken) return { success: false, error: 'Server configuration error.' };
    
    const priceString = formData.get('price') as string;
    const [priceValue, currency] = priceString.split(' ');

    const payload: any = {
        name: formData.get('title'),
        description: formData.get('description'),
        availability: formData.get('availability'),
        condition: formData.get('condition'),
        price: Number(priceValue) * 100,
        inventory: Number(formData.get('inventory')),
        link: formData.get('link'),
        image_url: formData.get('image_link'),
        brand: formData.get('brand'),
    };
    
    // Clean up empty fields
    for (const key in payload) {
        if (payload[key] === undefined || payload[key] === null || payload[key] === '') {
            delete payload[key];
        }
    }

    try {
        await axios.post(`https://graph.facebook.com/${API_VERSION}/${productId}`, {
            ...payload,
            access_token: accessToken
        });
        return { success: true, message: "Product updated successfully." };
    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
    }
}
