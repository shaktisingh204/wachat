
'use server';

import { revalidatePath } from 'next/cache';
import { ObjectId, type WithId } from 'mongodb';
import axios from 'axios';
import { connectToDatabase } from '@/lib/mongodb';
import { getProjectById } from '@/app/actions';
import type { Catalog, Product, Project } from '@/lib/definitions';
import { getErrorMessage } from '@/lib/utils';

const API_VERSION = 'v23.0';

// --- CATALOG ACTIONS ---

export async function syncCatalogs(projectId: string): Promise<{ message?: string; error?: string, count?: number }> {
    const project = await getProjectById(projectId);
    if (!project) return { error: 'Project not found.' };
    if (!project.businessId) return { error: 'Business ID not found for this project. Please re-sync projects.' };

    try {
        const { db } = await connectToDatabase();
        const { businessId, accessToken } = project;
        
        const response = await axios.get(`https://graph.facebook.com/${API_VERSION}/${businessId}/owned_product_catalogs?access_token=${accessToken}`);

        if (response.data.error) throw new Error(getErrorMessage({ response }));
        
        const metaCatalogs = response.data.data || [];
        if (metaCatalogs.length === 0) {
            return { message: "No product catalogs found in your Meta Business account." };
        }

        const bulkOps = metaCatalogs.map((catalog: any) => ({
            updateOne: {
                filter: { metaCatalogId: catalog.id, projectId: new ObjectId(projectId) },
                update: { 
                    $set: { name: catalog.name },
                    $setOnInsert: {
                        metaCatalogId: catalog.id,
                        projectId: new ObjectId(projectId),
                        createdAt: new Date(),
                    }
                },
                upsert: true,
            }
        }));

        const result = await db.collection('catalogs').bulkWrite(bulkOps);
        const syncedCount = result.upsertedCount + result.modifiedCount;

        revalidatePath('/dashboard/facebook/commerce/products');
        return { message: `Successfully synced ${syncedCount} catalog(s).`, count: syncedCount };
    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}

export async function getCatalogs(projectId: string): Promise<WithId<Catalog>[]> {
    if (!ObjectId.isValid(projectId)) return [];
    try {
        const { db } = await connectToDatabase();
        const catalogs = await db.collection('catalogs').find({ projectId: new ObjectId(projectId) }).sort({ name: 1 }).toArray();
        return JSON.parse(JSON.stringify(catalogs));
    } catch (e) {
        console.error("Failed to get catalogs from DB:", e);
        return [];
    }
}

export async function createCatalog(prevState: any, formData: FormData): Promise<{ message?: string; error?: string }> {
    const projectId = formData.get('projectId') as string;
    const catalogName = formData.get('catalogName') as string;

    if (!projectId || !catalogName) return { error: 'Project ID and Catalog Name are required.' };

    const project = await getProjectById(projectId);
    if (!project) return { error: 'Project not found.' };
    if (!project.businessId) return { error: 'Business ID not found for this project. Please re-sync projects.' };
    
    try {
        const { businessId, accessToken } = project;
        const response = await axios.post(`https://graph.facebook.com/${API_VERSION}/${businessId}/owned_product_catalogs`, {
            name: catalogName,
            vertical: 'commerce'
        }, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });

        if (response.data.error) throw new Error(getErrorMessage({ response }));
        const newMetaCatalogId = response.data.id;

        const { db } = await connectToDatabase();
        await db.collection('catalogs').insertOne({
            projectId: new ObjectId(projectId),
            metaCatalogId: newMetaCatalogId,
            name: catalogName,
            createdAt: new Date(),
        } as any);

        revalidatePath('/dashboard/facebook/commerce/products');
        return { message: `Catalog "${catalogName}" created successfully.` };
    } catch (e) {
        return { error: getErrorMessage(e) };
    }
}

export async function connectCatalogToWaba(projectId: string, catalogMetaId: string): Promise<{ message?: string, error?: string }> {
     if (!projectId || !catalogMetaId) return { error: 'Project and Catalog IDs are required.' };
     const project = await getProjectById(projectId);
     if (!project) return { error: 'Access denied.' };

     try {
        const payload = {
            whatsapp_business_account_id: project.wabaId,
            access_token: project.accessToken,
        };
        const response = await axios.post(`https://graph.facebook.com/${API_VERSION}/${catalogMetaId}/whatsapp_business_accounts`, payload);

        if (response.data.error) throw new Error(getErrorMessage({ response }));
        
        if (response.data.success) {
            const { db } = await connectToDatabase();
            await db.collection('projects').updateOne({ _id: new ObjectId(projectId) }, { $set: { connectedCatalogId: catalogMetaId } });
            revalidatePath('/dashboard/facebook/commerce/products');
            return { message: `Catalog successfully connected to WABA.` };
        } else {
             return { error: 'Meta API did not confirm success.' };
        }
     } catch(e) {
        return { error: getErrorMessage(e) };
     }
}

export async function getProductsForCatalog(catalogMetaId: string, projectId: string): Promise<any[]> {
    const project = await getProjectById(projectId);
    if (!project) return [];

    try {
        const response = await axios.get(`https://graph.facebook.com/${API_VERSION}/${catalogMetaId}/products`, {
            params: {
                fields: 'id,name,description,price,currency,retailer_id,image_url,availability,inventory',
                access_token: project.accessToken
            }
        });
        if(response.data.error) throw new Error(getErrorMessage({response}));
        return response.data.data || [];
    } catch (e) {
        console.error("Failed to get products from Meta:", e);
        return [];
    }
}

export async function getTaggedMediaForProduct(productId: string, projectId: string): Promise<{ media?: any[], error?: string }> {
    const project = await getProjectById(projectId);
    if (!project || !project.accessToken) return { error: 'Project not found or access token missing.' };

    try {
        const response = await axios.get(`https://graph.facebook.com/${API_VERSION}/${productId}/product_items`, {
            params: {
                fields: 'media{id,image_url,media_type,permalink,thumbnail_url}',
                access_token: project.accessToken
            }
        });

        if (response.data.error) throw new Error(getErrorMessage({ response }));
        
        const allMedia = response.data.data.map((item: any) => item.media).filter(Boolean);
        return { media: allMedia };
    } catch (e) {
        return { error: getErrorMessage(e) };
    }
}


// --- Product Actions ---

export async function addProductToCatalog(prevState: any, formData: FormData): Promise<{ message?: string; error?: string }> {
    const projectId = formData.get('projectId') as string;
    const catalogId = formData.get('catalogId') as string;

    const productData: any = {
        name: formData.get('name') as string,
        description: formData.get('description') as string,
        price: Number(formData.get('price')) * 100, // in cents
        currency: formData.get('currency') as string,
        retailer_id: formData.get('retailer_id') as string,
        image_url: formData.get('image_url') as string,
        availability: 'in_stock', // Default
        inventory: 100, // Default inventory
    };

    if (!projectId || !catalogId || !productData.name || !productData.price || !productData.currency || !productData.retailer_id || !productData.image_url) {
        return { error: 'All fields except description are required.' };
    }

    const project = await getProjectById(projectId);
    if (!project || !project.accessToken) return { error: 'Project not found or access token missing.' };
    
    try {
        await axios.post(`https://graph.facebook.com/${API_VERSION}/${catalogId}/products`, {
            ...productData,
            access_token: project.accessToken
        });

        revalidatePath(`/dashboard/facebook/commerce/products/${catalogId}`);
        return { message: 'Product added successfully!' };

    } catch (e) {
        return { error: getErrorMessage(e) };
    }
}

export async function updateProductInCatalog(prevState: any, formData: FormData): Promise<{ message?: string; error?: string }> {
    const projectId = formData.get('projectId') as string;
    const productId = formData.get('productId') as string;
    
    const fieldsToUpdate: any = {};
    if (formData.has('name')) fieldsToUpdate.name = formData.get('name');
    if (formData.has('description')) fieldsToUpdate.description = formData.get('description');
    if (formData.has('price')) fieldsToUpdate.price = Number(formData.get('price')) * 100;
    if (formData.has('image_url')) fieldsToUpdate.image_url = formData.get('image_url');
    if (formData.has('inventory')) fieldsToUpdate.inventory = Number(formData.get('inventory'));
    if (formData.has('availability')) fieldsToUpdate.availability = formData.get('availability');

    if (Object.keys(fieldsToUpdate).length === 0) {
        return { error: 'No fields to update.' };
    }
    
    const project = await getProjectById(projectId);
    if (!project || !project.accessToken) return { error: 'Project not found or access token missing.' };

    try {
        await axios.post(`https://graph.facebook.com/${API_VERSION}/${productId}`, {
            ...fieldsToUpdate,
            access_token: project.accessToken
        });

        // Can't revalidate dynamic path from here. Client needs to refetch.
        return { message: 'Product updated successfully!' };
    } catch(e) {
        return { error: getErrorMessage(e) };
    }
}

export async function deleteProductFromCatalog(productId: string, projectId: string): Promise<{ success: boolean; error?: string }> {
    const project = await getProjectById(projectId);
    if (!project || !project.accessToken) return { success: false, error: 'Project not found or access token missing.' };

    try {
        await axios.delete(`https://graph.facebook.com/${API_VERSION}/${productId}`, {
            params: { access_token: project.accessToken }
        });
        
        return { success: true };
    } catch(e) {
        return { success: false, error: getErrorMessage(e) };
    }
}
