
'use server';

import { revalidatePath } from 'next/cache';
import { ObjectId, WithId } from 'mongodb';
import axios from 'axios';
import { connectToDatabase } from '@/lib/mongodb';
import { getProjectById } from '@/app/actions/index.ts';
import { getErrorMessage } from '@/lib/utils';
import type { Catalog, Project } from '@/lib/definitions';

const API_VERSION = 'v24.0';

export async function getCatalogs(projectId: string): Promise<WithId<Catalog>[]> {
    if (!projectId) return [];
    try {
        const { db } = await connectToDatabase();
        const catalogs = await db.collection('catalogs').find({ projectId: new ObjectId(projectId) }).toArray();
        return JSON.parse(JSON.stringify(catalogs));
    } catch (e) {
        console.error("Failed to get catalogs:", e);
        return [];
    }
}

export async function syncCatalogs(projectId: string): Promise<{ message?: string; error?: string; count?: number }> {
    const project = await getProjectById(projectId);
    if (!project || !project.wabaId || !project.accessToken) {
        return { error: 'Project not found or is missing WABA ID or Access Token.' };
    }

    const { wabaId, accessToken } = project;
    const url = `https://graph.facebook.com/v24.0/${wabaId}/product_catalogs?access_token=${accessToken}`;
    
    console.log(`[syncCatalogs] Calling Meta API: ${url}`);

    try {
        const response = await axios.get(url);

        console.log('[syncCatalogs] Received response from Meta:', JSON.stringify(response.data, null, 2));

        if (response.data.error) {
            throw new Error(response.data.error.message);
        }
        
        const metaCatalogs = response.data.data || [];
        if (metaCatalogs.length === 0) {
            return { message: "No product catalogs found for this WhatsApp Business Account." };
        }
        
        const { db } = await connectToDatabase();
        const bulkOps = metaCatalogs.map((catalog: any) => ({
            updateOne: {
                filter: { metaCatalogId: catalog.id, projectId: new ObjectId(projectId) },
                update: {
                    $set: {
                        name: catalog.name,
                        projectId: new ObjectId(projectId),
                        metaCatalogId: catalog.id,
                    },
                    $setOnInsert: { createdAt: new Date() }
                },
                upsert: true
            }
        }));

        const result = await db.collection('catalogs').bulkWrite(bulkOps);
        revalidatePath('/dashboard/catalog');
        return { message: `Successfully synced ${result.upsertedCount + result.modifiedCount} catalog(s).`, count: result.upsertedCount + result.modifiedCount };

    } catch (e: any) {
        console.error("Error syncing catalogs:", getErrorMessage(e));
        return { error: getErrorMessage(e) };
    }
}


export async function getProductsForCatalog(catalogId: string, projectId: string): Promise<any[]> {
    if (!catalogId || !projectId) return [];
    
    const project = await getProjectById(projectId);
    if (!project || !project.accessToken) {
        console.error("Could not get products: Project or access token not found.");
        return [];
    }
    
    const accessToken = project.accessToken;
    const fields = 'id,name,description,category,product_type,image_url,price,retailer_id,inventory,currency,availability';
    const url = `https://graph.facebook.com/v22.0/${catalogId}/products?access_token=${accessToken}&fields=${fields}`;

    console.log(`[getProductsForCatalog] Calling Meta API: ${url}`);

    try {
        const response = await axios.get(url);

        console.log('[getProductsForCatalog] Received response from Meta:', JSON.stringify(response.data, null, 2));

        if (response.data.error) {
            throw new Error(response.data.error.message);
        }
        return response.data.data || [];
    } catch(e) {
        console.error("Failed to get products for catalog:", getErrorMessage(e));
        return [];
    }
}

export async function addProductToCatalog(prevState: any, formData: FormData) {
    const projectId = formData.get('projectId') as string;
    const catalogId = formData.get('catalogId') as string;

    const project = await getProjectById(projectId);
    if (!project || !project.accessToken) return { error: 'Project not found or access token missing.' };

    try {
        const productData = {
            retailer_id: formData.get('retailer_id'),
            name: formData.get('name'),
            price: Number(formData.get('price')) * 100, // Price in cents/paise
            currency: formData.get('currency'),
            description: formData.get('description'),
            image_url: formData.get('image_url'),
            availability: 'in_stock', // Default availability
        };
        
        await axios.post(`https://graph.facebook.com/v20.0/${catalogId}/products`, {
            ...productData,
            access_token: project.accessToken
        });

        revalidatePath(`/dashboard/catalog/${catalogId}`);
        return { message: 'Product added successfully!' };
    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}

export async function deleteProductFromCatalog(productId: string, projectId: string): Promise<{ success: boolean, error?: string }> {
     const project = await getProjectById(projectId);
    if (!project || !project.accessToken) return { success: false, error: 'Project not found or access token missing.' };
    
    try {
        await axios.delete(`https://graph.facebook.com/v20.0/${productId}`, {
            params: { access_token: project.accessToken }
        });
        revalidatePath(`/dashboard/catalog`);
        return { success: true };
    } catch(e) {
        return { success: false, error: getErrorMessage(e) };
    }
}

export async function updateProductInCatalog(prevState: any, formData: FormData) {
    const projectId = formData.get('projectId') as string;
    const productId = formData.get('productId') as string;

    const project = await getProjectById(projectId);
    if (!project || !project.accessToken) return { error: 'Project not found or access token missing.' };

    try {
        const updateData: any = {};
        if (formData.get('name')) updateData.name = formData.get('name');
        if (formData.get('price')) updateData.price = Number(formData.get('price')) * 100;
        if (formData.get('inventory')) updateData.inventory = Number(formData.get('inventory'));
        if (formData.get('availability')) updateData.availability = formData.get('availability');

        await axios.post(`https://graph.facebook.com/v20.0/${productId}`, {
            ...updateData,
            access_token: project.accessToken
        });

        revalidatePath(`/dashboard/catalog`);
        return { message: 'Product updated successfully.' };
    } catch(e) {
        return { error: getErrorMessage(e) };
    }
}

export async function connectCatalogToWaba(projectId: string, catalogId: string): Promise<{ message?: string, error?: string }> {
    const project = await getProjectById(projectId);
    if (!project || !project.wabaId || !project.accessToken) return { error: 'Project not found or is not a WABA project.' };
    try {
        await axios.post(`https://graph.facebook.com/v20.0/${project.wabaId}/whatsapp_commerce_settings`, {
            catalog_id: catalogId,
            is_catalog_visible: true,
            access_token: project.accessToken
        });

        const { db } = await connectToDatabase();
        await db.collection('projects').updateOne(
            { _id: new ObjectId(projectId) },
            { $set: { connectedCatalogId: catalogId } }
        );
        
        revalidatePath('/dashboard/catalog');
        return { message: 'Catalog successfully connected to your WhatsApp number.' };
    } catch(e) {
        return { error: `Failed to connect catalog: ${getErrorMessage(e)}` };
    }
}

export async function listProductSets(catalogId: string, projectId: string) {
    if (!catalogId || !projectId) return [];
    
    const project = await getProjectById(projectId);
    if (!project || !project.accessToken) return [];
    
    try {
        const response = await axios.get(`https://graph.facebook.com/v20.0/${catalogId}/product_sets`, {
            params: { access_token: project.accessToken }
        });
        return response.data.data || [];
    } catch (e) {
        console.error("Failed to list product sets:", getErrorMessage(e));
        return [];
    }
}

export async function createProductSet(prevState: any, formData: FormData) {
    const projectId = formData.get('projectId') as string;
    const catalogId = formData.get('catalogId') as string;
    const name = formData.get('name') as string;

    const project = await getProjectById(projectId);
    if (!project || !project.accessToken) return { error: 'Project not found or access token missing.' };
    
    try {
        await axios.post(`https://graph.facebook.com/v20.0/${catalogId}/product_sets`, {
            name: name,
            filter: { retailer_id: { is_any: [] } }, // Create an empty set initially
            access_token: project.accessToken
        });
        return { message: 'Collection created successfully.' };
    } catch(e) {
        return { error: getErrorMessage(e) };
    }
}

export async function deleteProductSet(setId: string, projectId: string): Promise<{ success: boolean, error?: string }> {
     const project = await getProjectById(projectId);
    if (!project || !project.accessToken) return { success: false, error: 'Project not found or access token missing.' };
    
    try {
        await axios.delete(`https://graph.facebook.com/v20.0/${setId}`, {
            params: { access_token: project.accessToken }
        });
        return { success: true };
    } catch(e) {
        return { success: false, error: getErrorMessage(e) };
    }
}

export async function getTaggedMediaForProduct(productId: string, projectId: string) {
     const project = await getProjectById(projectId);
    if (!project || !project.accessToken) return { error: 'Project not found or access token missing.' };

    try {
        const response = await axios.get(`https://graph.facebook.com/v20.0/${productId}/tagged_media`, {
            params: { 
                access_token: project.accessToken,
                fields: 'id,media_url,permalink'
            }
        });
        return { media: response.data.data };
    } catch(e) {
        return { error: getErrorMessage(e) };
    }
}
