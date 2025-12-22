
'use server';

import { revalidatePath } from 'next/cache';
import { ObjectId, type WithId } from 'mongodb';
import axios from 'axios';
import { getProjectById } from '@/app/actions/index.ts';
import { connectToDatabase } from '@/lib/mongodb';
import { getErrorMessage } from '@/lib/utils';
import type { Catalog, Product, ProductSet } from '@/lib/definitions';

const API_VERSION = 'v24.0';

async function getAccessToken(projectId: string) {
    const systemToken = process.env.META_ADMIN_TOKEN;
    if (systemToken) {
        console.log("Using system admin token for catalog operation.");
        return systemToken;
    }
    const project = await getProjectById(projectId);
    if (!project || !project.accessToken) {
        throw new Error('Project not found or access token is missing.');
    }
    console.log("Using project-specific token for catalog operation.");
    return project.accessToken;
}

export async function getCatalogs(projectId: string): Promise<WithId<Catalog>[]> {
    if (!projectId) return [];
    try {
        const { db } = await connectToDatabase();
        const catalogs = await db.collection('catalogs').find({ projectId: new ObjectId(projectId) }).toArray();
        return JSON.parse(JSON.stringify(catalogs));
    } catch (e) {
        return [];
    }
}

export async function syncCatalogs(projectId: string): Promise<{ message?: string; error?: string }> {
    const project = await getProjectById(projectId);
    if (!project || !project.wabaId) return { error: 'Project not found or is not a WhatsApp project.' };

    try {
        const accessToken = await getAccessToken(projectId);
        console.log(`[syncCatalogs] Calling API: https://graph.facebook.com/${API_VERSION}/${project.wabaId}/product_catalogs`);
        
        const response = await axios.get(`https://graph.facebook.com/${API_VERSION}/${project.wabaId}/product_catalogs`, {
            params: { access_token: accessToken }
        });

        console.log('[syncCatalogs] API Response:', JSON.stringify(response.data, null, 2));

        if (response.data.error) throw new Error(getErrorMessage({ response }));

        const catalogsFromMeta = response.data.data || [];
        const { db } = await connectToDatabase();

        if (catalogsFromMeta.length > 0) {
            const bulkOps = catalogsFromMeta.map((catalog: any) => ({
                updateOne: {
                    filter: { metaCatalogId: catalog.id, projectId: project._id },
                    update: { $set: { name: catalog.name }, $setOnInsert: { createdAt: new Date() } },
                    upsert: true
                }
            }));
            await db.collection('catalogs').bulkWrite(bulkOps);
        }
        
        // **FIX**: Update the project with the list of catalog IDs
        const syncedCatalogIds = catalogsFromMeta.map((c: any) => c.id);
        await db.collection('projects').updateOne(
            { _id: project._id },
            { $set: { 'catalogs': syncedCatalogIds } }
        );

        revalidatePath('/dashboard/catalog');
        return { message: `Successfully synced ${catalogsFromMeta.length} catalog(s).` };
    } catch (e: any) {
        console.error("Catalog sync failed:", getErrorMessage(e));
        return { error: getErrorMessage(e) };
    }
}


export async function getProductsForCatalog(catalogId: string, projectId: string): Promise<any[]> {
    try {
        const accessToken = await getAccessToken(projectId);
        const fields = 'id,name,description,category,product_type,image_url,price,currency,availability,retailer_id,inventory';
        console.log(`[getProductsForCatalog] Calling API: https://graph.facebook.com/${API_VERSION}/${catalogId}/products with fields`);

        const response = await axios.get(`https://graph.facebook.com/${API_VERSION}/${catalogId}/products`, {
            params: { access_token: accessToken, fields }
        });
        
        console.log('[getProductsForCatalog] API Response:', JSON.stringify(response.data, null, 2));

        if (response.data.error) throw new Error(getErrorMessage({ response }));

        return response.data.data || [];
    } catch (e: any) {
        console.error("Failed to fetch products:", getErrorMessage(e));
        return [];
    }
}

export async function addProductToCatalog(prevState: any, formData: FormData): Promise<{ message?: string, error?: string }> {
    const projectId = formData.get('projectId') as string;
    const catalogId = formData.get('catalogId') as string;
    const productData = {
        name: formData.get('name'),
        retailer_id: formData.get('retailer_id'),
        price: Number(formData.get('price')) * 100,
        currency: formData.get('currency'),
        description: formData.get('description'),
        image_url: formData.get('image_url'),
        availability: 'in_stock',
    };

    try {
        const accessToken = await getAccessToken(projectId);
        const response = await axios.post(`https://graph.facebook.com/${API_VERSION}/${catalogId}/products`, 
            { ...productData, access_token: accessToken }
        );

        if (response.data.error) throw new Error(getErrorMessage({ response }));
        
        revalidatePath(`/dashboard/catalog/${catalogId}`);
        return { message: `Product "${productData.name}" added successfully.` };
    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}

export async function updateProductInCatalog(prevState: any, formData: FormData): Promise<{ message?: string, error?: string }> {
    const projectId = formData.get('projectId') as string;
    const productId = formData.get('productId') as string;
    
    const fieldsToUpdate: any = {};
    if (formData.get('name')) fieldsToUpdate.name = formData.get('name');
    if (formData.get('description')) fieldsToUpdate.description = formData.get('description');
    if (formData.get('price')) fieldsToUpdate.price = Number(formData.get('price')) * 100;
    if (formData.get('inventory')) fieldsToUpdate.inventory = Number(formData.get('inventory'));
    if (formData.get('availability')) fieldsToUpdate.availability = formData.get('availability');

    try {
        const accessToken = await getAccessToken(projectId);
        const response = await axios.post(`https://graph.facebook.com/${API_VERSION}/${productId}`, 
            { ...fieldsToUpdate, access_token: accessToken }
        );

        if (response.data.error) throw new Error(getErrorMessage({ response }));
        
        revalidatePath(`/dashboard/catalog`);
        return { message: 'Product updated successfully.' };
    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}

export async function deleteProductFromCatalog(productId: string, projectId: string): Promise<{ success?: boolean, error?: string }> {
     try {
        const accessToken = await getAccessToken(projectId);
        const response = await axios.delete(`https://graph.facebook.com/${API_VERSION}/${productId}`, {
            params: { access_token: accessToken }
        });

        if (response.data.error) throw new Error(getErrorMessage({ response }));

        return { success: true };
    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}

export async function createProductSet(prevState: any, formData: FormData): Promise<{ message?: string, error?: string }> {
    const projectId = formData.get('projectId') as string;
    const catalogId = formData.get('catalogId') as string;
    const name = formData.get('name') as string;
    
    try {
        const accessToken = await getAccessToken(projectId);
        const response = await axios.post(`https://graph.facebook.com/${API_VERSION}/${catalogId}/product_sets`, {
            name: name,
            filter: { retailer_id: { is_any: [] } }, // Create an empty set
            access_token: accessToken,
        });

        if (response.data.error) throw new Error(getErrorMessage({ response }));
        
        revalidatePath(`/dashboard/catalog/${catalogId}`);
        return { message: `Collection "${name}" created successfully.`};

    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}

export async function listProductSets(catalogId: string, projectId: string): Promise<ProductSet[]> {
    try {
        const accessToken = await getAccessToken(projectId);
        const response = await axios.get(`https://graph.facebook.com/${API_VERSION}/${catalogId}/product_sets`, {
            params: { access_token: accessToken, fields: 'id,name,product_count' }
        });

        if (response.data.error) throw new Error(getErrorMessage({ response }));

        return response.data.data || [];
    } catch (e: any) {
        console.error("Failed to list product sets:", getErrorMessage(e));
        return [];
    }
}

export async function deleteProductSet(setId: string, projectId: string): Promise<{ success?: boolean, error?: string }> {
    try {
        const accessToken = await getAccessToken(projectId);
        const response = await axios.delete(`https://graph.facebook.com/${API_VERSION}/${setId}`, {
            params: { access_token: accessToken }
        });
        if (response.data.error) throw new Error(getErrorMessage({ response }));
        return { success: true };
    } catch(e: any) {
        return { error: getErrorMessage(e) };
    }
}
