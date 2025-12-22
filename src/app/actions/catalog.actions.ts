
'use server';

import { revalidatePath } from 'next/cache';
import { ObjectId, type WithId } from 'mongodb';
import axios from 'axios';
import { connectToDatabase } from '@/lib/mongodb';
import { getProjectById } from '@/app/actions/user.actions';
import { getErrorMessage } from '@/lib/utils';
import type { Catalog, Project, Product, ProductSet } from '@/lib/definitions';

const API_VERSION = 'v24.0';

async function getToken(projectId: string): Promise<{ accessToken: string, entityId: string | undefined, entityType: 'waba' | 'business' }> {
    const adminToken = process.env.META_ADMIN_TOKEN;
    if (adminToken) {
        const project = await getProjectById(projectId, null);
        if (!project) throw new Error("Project not found.");
        return { 
            accessToken: adminToken, 
            entityId: project.businessId || project.wabaId,
            entityType: project.businessId ? 'business' : 'waba'
        };
    }
    
    const project = await getProjectById(projectId);
    if (!project) throw new Error("Project not found or access denied.");
    if (!project.accessToken || (!project.wabaId && !project.businessId)) {
        throw new Error("Project is not fully configured for Meta API access.");
    }
    return {
        accessToken: project.accessToken,
        entityId: project.businessId || project.wabaId,
        entityType: project.businessId ? 'business' : 'waba'
    };
}


export async function getCatalogs(projectId: string): Promise<WithId<Catalog>[]> {
    if (!projectId || !ObjectId.isValid(projectId)) return [];
    try {
        const { db } = await connectToDatabase();
        const catalogs = await db.collection<Catalog>('catalogs').find({ projectId: new ObjectId(projectId) }).toArray();
        return JSON.parse(JSON.stringify(catalogs));
    } catch (e) {
        console.error("Failed to get catalogs from DB:", e);
        return [];
    }
}

export async function syncCatalogs(projectId: string): Promise<{ message?: string, error?: string }> {
    try {
        const { accessToken, entityId, entityType } = await getToken(projectId);
        if (!entityId) {
            throw new Error("Project is missing a WABA ID or Business ID.");
        }
        
        const endpoint = entityType === 'business' 
            ? `${API_VERSION}/${entityId}/owned_product_catalogs`
            : `${API_VERSION}/${entityId}/product_catalogs`;
        
        console.log(`[syncCatalogs] Fetching from endpoint: ${endpoint}`);

        const response = await axios.get(`https://graph.facebook.com/${endpoint}`, {
            params: { access_token: accessToken }
        });
        
        if (response.data.error) throw new Error(getErrorMessage({ response }));

        const catalogsFromMeta = response.data.data;
        console.log(`[syncCatalogs] Found ${catalogsFromMeta.length} catalogs from Meta.`);

        const { db } = await connectToDatabase();
        
        if (catalogsFromMeta.length > 0) {
            const bulkOps = catalogsFromMeta.map((catalog: any) => ({
                updateOne: {
                    filter: { metaCatalogId: catalog.id, projectId: new ObjectId(projectId) },
                    update: { $set: { name: catalog.name }, $setOnInsert: { createdAt: new Date() } },
                    upsert: true,
                },
            }));
            await db.collection('catalogs').bulkWrite(bulkOps);

            // Connect the first catalog by default if none is connected
            const project = await db.collection<Project>('projects').findOne({_id: new ObjectId(projectId)});
            if (project && !project.connectedCatalogId) {
                await db.collection('projects').updateOne(
                    { _id: new ObjectId(projectId) },
                    { $set: { connectedCatalogId: catalogsFromMeta[0].id } }
                );
                console.log(`[syncCatalogs] Auto-connected catalog ${catalogsFromMeta[0].id} to project ${projectId}`);
            }
        }
        
        revalidatePath('/dashboard/catalog');
        return { message: `Successfully synced ${catalogsFromMeta.length} catalog(s).` };
    } catch (e: any) {
        console.error('Catalog sync failed:', getErrorMessage(e));
        return { error: getErrorMessage(e) };
    }
}

export async function getProductsForCatalog(catalogId: string, projectId: string): Promise<any[]> {
    try {
        const { accessToken } = await getToken(projectId);
        const response = await axios.get(`https://graph.facebook.com/${API_VERSION}/${catalogId}/products`, {
            params: {
                fields: 'id,name,description,category,product_type,image_url,price,retailer_id,inventory,availability,condition,brand,gtin,mpn,currency,variants',
                access_token: accessToken
            }
        });
        if (response.data.error) throw new Error(getErrorMessage({ response }));
        return response.data.data || [];
    } catch (e) {
        console.error(`Failed to get products for catalog ${catalogId}:`, getErrorMessage(e));
        return [];
    }
}

const buildProductPayload = (formData: FormData) => {
    const payload: any = {};
    const requiredFields = ['title', 'description', 'availability', 'condition', 'price', 'link', 'image_link', 'retailer_id'];
    
    requiredFields.forEach(field => {
        const value = formData.get(field) as string;
        if (value) payload[field] = value;
    });

    const priceValue = formData.get('price') as string;
    if (priceValue) {
        const [amount, currency] = priceValue.split(' ');
        payload.price = parseInt(amount, 10) * 100;
        payload.currency = currency || 'USD';
    }

    // Handle optional fields
    ['brand', 'google_product_category', 'product_type', 'sale_price', 'item_group_id', 'inventory', 'gtin', 'mpn', 'shipping_weight', 'shipping_length', 'shipping_width', 'shipping_height', 'color', 'size', 'material', 'pattern', 'gender', 'age_group'].forEach(field => {
        const value = formData.get(field) as string;
        if (value) payload[field] = value;
    });

    const additionalImageLinks = (formData.get('additional_image_link') as string)?.split('\n').filter(Boolean);
    if (additionalImageLinks && additionalImageLinks.length > 0) {
        payload.additional_image_link = additionalImageLinks;
    }

    return payload;
};

export async function addProductToCatalog(prevState: any, formData: FormData): Promise<{ message?: string, error?: string }> {
    const catalogId = formData.get('catalogId') as string;
    const projectId = formData.get('projectId') as string;

    try {
        const payload = buildProductPayload(formData);
        const { accessToken } = await getToken(projectId);

        const response = await axios.post(`https://graph.facebook.com/${API_VERSION}/${catalogId}/products`, {
            ...payload,
            access_token: accessToken,
        });

        if (response.data.error) throw new Error(getErrorMessage({ response }));

        revalidatePath(`/dashboard/catalog/${catalogId}`);
        return { message: `Product "${payload.title}" added successfully.` };
    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}

export async function updateProductInCatalog(prevState: any, formData: FormData): Promise<{ message?: string, error?: string }> {
     const productId = formData.get('productId') as string;
    const projectId = formData.get('projectId') as string;

    try {
        const payload = buildProductPayload(formData);
        const { accessToken } = await getToken(projectId);

        const response = await axios.post(`https://graph.facebook.com/${API_VERSION}/${productId}`, {
            ...payload,
            access_token: accessToken,
        });
        
        if (response.data.error) throw new Error(getErrorMessage({ response }));

        revalidatePath(`/dashboard/catalog/[catalogId]`);
        revalidatePath(`/dashboard/catalog/[catalogId]/${productId}/edit`);
        return { message: `Product "${payload.title}" updated successfully.` };
    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}


export async function deleteProductFromCatalog(productId: string, projectId: string): Promise<{ success: boolean, error?: string }> {
    try {
        const { accessToken } = await getToken(projectId);
        await axios.delete(`https://graph.facebook.com/${API_VERSION}/${productId}`, {
            params: { access_token: accessToken }
        });
        return { success: true };
    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
    }
}

// --- Product Set (Collection) Functions ---

export async function listProductSets(catalogId: string, projectId: string): Promise<ProductSet[]> {
    try {
        const { accessToken } = await getToken(projectId);
        const response = await axios.get(`https://graph.facebook.com/${API_VERSION}/${catalogId}/product_sets`, {
            params: { fields: 'id,name,product_count', access_token: accessToken }
        });
        if (response.data.error) throw new Error(getErrorMessage({ response }));
        return response.data.data || [];
    } catch (e) {
        console.error(`Failed to list product sets for catalog ${catalogId}:`, getErrorMessage(e));
        return [];
    }
}

export async function createProductSet(prevState: any, formData: FormData): Promise<{ message?: string, error?: string }> {
    const catalogId = formData.get('catalogId') as string;
    const projectId = formData.get('projectId') as string;
    const name = formData.get('name') as string;
    try {
        const { accessToken } = await getToken(projectId);
        await axios.post(`https://graph.facebook.com/${API_VERSION}/${catalogId}/product_sets`, {
            name: name,
            access_token: accessToken,
        });
        revalidatePath(`/dashboard/catalog/${catalogId}`);
        return { message: `Collection "${name}" created successfully.` };
    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}

export async function deleteProductSet(setId: string, projectId: string): Promise<{ success: boolean; error?: string }> {
    try {
        const { accessToken } = await getToken(projectId);
        await axios.delete(`https://graph.facebook.com/${API_VERSION}/${setId}`, {
            params: { access_token: accessToken }
        });
        return { success: true };
    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
    }
}

export async function getTaggedMediaForProduct(productId: string, projectId: string): Promise<{media: any[], error?: string}> {
     try {
        const { accessToken } = await getToken(projectId);
        const response = await axios.get(`https://graph.facebook.com/${API_VERSION}/${productId}/tagged_media`, {
            params: { access_token: accessToken }
        });
        if (response.data.error) throw new Error(getErrorMessage({ response }));
        return { media: response.data.data || [] };
    } catch (e) {
        return { media: [], error: getErrorMessage(e) };
    }
}
