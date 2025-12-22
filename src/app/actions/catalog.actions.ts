
'use server';

import { revalidatePath } from 'next/cache';
import { ObjectId, type WithId, Filter } from 'mongodb';
import axios from 'axios';
import FormData from 'form-data';

import { connectToDatabase } from '@/lib/mongodb';
import { getProjectById } from '@/app/actions/index.ts';
import { getErrorMessage } from '@/lib/utils';
import type { Catalog, Project } from '@/lib/definitions';

const API_VERSION = 'v24.0';

export async function syncCatalogs(projectId: string): Promise<{ message?: string; error?: string, count?: number }> {
    console.log(`[syncCatalogs] Starting sync for project: ${projectId}`);
    const project = await getProjectById(projectId);
    if (!project || !project.wabaId) return { error: 'Project not found or is not a WhatsApp project.' };

    const token = process.env.META_ADMIN_TOKEN || project.accessToken;

    try {
        const response = await axios.get(`https://graph.facebook.com/${API_VERSION}/${project.wabaId}/product_catalogs`, {
            params: { access_token: token }
        });
        
        console.log('[syncCatalogs] API Response:', response.data);

        const catalogsFromMeta = response.data.data;
        if (!catalogsFromMeta || catalogsFromMeta.length === 0) {
            return { message: "No product catalogs found for this WABA." };
        }

        const { db } = await connectToDatabase();
        const bulkOps = catalogsFromMeta.map((catalog: any) => ({
            updateOne: {
                filter: { metaCatalogId: catalog.id, projectId: new ObjectId(projectId) },
                update: {
                    $set: { name: catalog.name },
                    $setOnInsert: {
                        projectId: new ObjectId(projectId),
                        metaCatalogId: catalog.id,
                        createdAt: new Date(),
                    },
                },
                upsert: true,
            },
        }));

        const result = await db.collection('catalogs').bulkWrite(bulkOps);
        const syncedCount = result.upsertedCount + result.modifiedCount;
        
        revalidatePath('/dashboard/catalog');
        return { message: `Successfully synced ${syncedCount} catalog(s).`, count: syncedCount };

    } catch (e: any) {
        console.error('[syncCatalogs] Error:', getErrorMessage(e));
        return { error: getErrorMessage(e) };
    }
}


export async function getCatalogs(projectId: string): Promise<WithId<Catalog>[]> {
    if (!projectId || !ObjectId.isValid(projectId)) return [];
    try {
        const { db } = await connectToDatabase();
        const catalogs = await db.collection('catalogs').find({ projectId: new ObjectId(projectId) }).sort({ name: 1 }).toArray();
        return JSON.parse(JSON.stringify(catalogs));
    } catch (e) {
        return [];
    }
}

export async function createCatalog(prevState: any, formData: FormData): Promise<{ message?: string, error?: string }> {
    const projectId = formData.get('projectId') as string;
    const catalogName = formData.get('catalogName') as string;

    const project = await getProjectById(projectId);
    if (!project || !project.businessId) return { error: 'Project not found or missing Business ID.' };

    const token = process.env.META_ADMIN_TOKEN || project.accessToken;

    try {
        await axios.post(`https://graph.facebook.com/${API_VERSION}/${project.businessId}/owned_product_catalogs`, {
            name: catalogName,
            access_token: token,
        });

        // After creating, trigger a sync to pull it into the local DB
        await syncCatalogs(projectId);
        
        return { message: `Catalog "${catalogName}" created successfully and synced.` };
    } catch (e) {
        return { error: getErrorMessage(e) };
    }
}

export async function getProductsForCatalog(catalogId: string, projectId: string) {
    console.log(`[getProductsForCatalog] Fetching products for catalog: ${catalogId}, project: ${projectId}`);
    const project = await getProjectById(projectId);
    if (!project) return [];

    const token = process.env.META_ADMIN_TOKEN || project.accessToken;

    try {
        const response = await axios.get(`https://graph.facebook.com/v22.0/${catalogId}/products`, {
            params: { 
                access_token: token,
                fields: 'id,name,description,category,product_type,image_url,price,currency,retailer_id,inventory,availability'
            }
        });
        console.log(`[getProductsForCatalog] API Response for catalog ${catalogId}:`, response.data);
        return response.data.data || [];
    } catch (e) {
        console.error(`[getProductsForCatalog] Error fetching products for catalog ${catalogId}:`, getErrorMessage(e));
        return [];
    }
}

export async function addProductToCatalog(prevState: any, formData: FormData): Promise<{ message?: string, error?: string }> {
    const projectId = formData.get('projectId') as string;
    const catalogId = formData.get('catalogId') as string;

    const project = await getProjectById(projectId);
    if (!project) return { error: 'Project not found' };

    const token = process.env.META_ADMIN_TOKEN || project.accessToken;

    const productData = {
        name: formData.get('name'),
        price: Number(formData.get('price')) * 100, // Convert to cents/paise
        currency: formData.get('currency'),
        description: formData.get('description'),
        retailer_id: formData.get('retailer_id'),
        image_url: formData.get('image_url'),
        availability: 'in_stock', // Default
    };

    try {
        await axios.post(`https://graph.facebook.com/v22.0/${catalogId}/products`, {
            ...productData,
            access_token: token,
        });
        return { message: 'Product added successfully!' };
    } catch (e) {
        return { error: getErrorMessage(e) };
    }
}

export async function updateProductInCatalog(prevState: any, formData: FormData): Promise<{ message?: string, error?: string }> {
    const projectId = formData.get('projectId') as string;
    const productId = formData.get('productId') as string;

    const project = await getProjectById(projectId);
    if (!project) return { error: 'Project not found' };
    
    const token = process.env.META_ADMIN_TOKEN || project.accessToken;

    const updateData: any = {
        name: formData.get('name'),
        description: formData.get('description'),
        price: Number(formData.get('price')) * 100,
        inventory: Number(formData.get('inventory')),
        availability: formData.get('availability'),
        access_token: token
    };

    try {
        await axios.post(`https://graph.facebook.com/v22.0/${productId}`, updateData);
        return { message: 'Product updated successfully!' };
    } catch (e) {
        return { error: getErrorMessage(e) };
    }
}


export async function deleteProductFromCatalog(productId: string, projectId: string): Promise<{ success: boolean, error?: string }> {
    const project = await getProjectById(projectId);
    if (!project) return { success: false, error: 'Project not found' };

    const token = process.env.META_ADMIN_TOKEN || project.accessToken;
    
    try {
        await axios.delete(`https://graph.facebook.com/v22.0/${productId}`, {
            params: { access_token: token }
        });
        return { success: true };
    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
    }
}

export async function listProductSets(catalogId: string, projectId: string) {
    const project = await getProjectById(projectId);
    if (!project) return [];
    
    const token = process.env.META_ADMIN_TOKEN || project.accessToken;

    try {
        const response = await axios.get(`https://graph.facebook.com/${API_VERSION}/${catalogId}/product_sets`, {
            params: {
                fields: 'id,name,product_count',
                access_token: token
            }
        });
        return response.data.data || [];
    } catch (e) {
        console.error('Failed to list product sets:', getErrorMessage(e));
        return [];
    }
}

export async function createProductSet(prevState: any, formData: FormData): Promise<{ message?: string, error?: string }> {
    const projectId = formData.get('projectId') as string;
    const catalogId = formData.get('catalogId') as string;
    const name = formData.get('name') as string;

    const project = await getProjectById(projectId);
    if (!project) return { error: 'Project not found' };

    const token = process.env.META_ADMIN_TOKEN || project.accessToken;

    try {
        await axios.post(`https://graph.facebook.com/${API_VERSION}/${catalogId}/product_sets`, {
            name: name,
            filter: { retailer_id: { is_any: [] } }, // Create empty set
            access_token: token
        });
        return { message: `Collection "${name}" created successfully.` };
    } catch (e) {
        return { error: getErrorMessage(e) };
    }
}

export async function deleteProductSet(setId: string, projectId: string): Promise<{ success: boolean, error?: string }> {
    const project = await getProjectById(projectId);
    if (!project) return { success: false, error: 'Project not found' };

    const token = process.env.META_ADMIN_TOKEN || project.accessToken;

    try {
        await axios.delete(`https://graph.facebook.com/${API_VERSION}/${setId}`, {
            params: { access_token: token }
        });
        return { success: true };
    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
    }
}


export async function getTaggedMediaForProduct(productId: string, projectId: string): Promise<{ media?: any[], error?: string }> {
     const project = await getProjectById(projectId);
    if (!project) return { error: 'Project not found' };
    
    const token = process.env.META_ADMIN_TOKEN || project.accessToken;

    try {
        const response = await axios.get(`https://graph.facebook.com/${API_VERSION}/${productId}/tagged_media`, {
            params: {
                access_token: token
            }
        });
        return { media: response.data.data || [] };
    } catch (e) {
        return { error: getErrorMessage(e) };
    }
}
