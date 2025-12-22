
'use server';

import { revalidatePath } from 'next/cache';
import { ObjectId, type WithId, Filter } from 'mongodb';
import axios from 'axios';
import { connectToDatabase } from '@/lib/mongodb';
import { getProjectById } from '@/app/actions/index.ts';
import { getErrorMessage } from '@/lib/utils';
import type { Project, Catalog, Product, ProductSet } from '@/lib/definitions';

const API_VERSION = 'v24.0';
const PRODUCTS_API_VERSION = 'v22.0';

export async function syncCatalogs(projectId: string): Promise<{ message?: string; error?: string, count?: number }> {
    console.log(`[syncCatalogs] Starting sync for project: ${projectId}`);
    const project = await getProjectById(projectId);
    if (!project) {
        console.error(`[syncCatalogs] Project not found: ${projectId}`);
        return { error: 'Project not found or you do not have access.' };
    }

    const wabaId = project.wabaId;
    const accessToken = process.env.META_ADMIN_TOKEN || project.accessToken;

    if (!wabaId) {
        console.error(`[syncCatalogs] WABA ID missing for project: ${projectId}`);
        return { error: 'Project is not configured with a WhatsApp Business Account ID.' };
    }

    const endpoint = `https://graph.facebook.com/${API_VERSION}/${wabaId}/product_catalogs`;
    console.log(`[syncCatalogs] Calling Meta API: ${endpoint}`);

    try {
        const response = await axios.get(endpoint, {
            params: { access_token: accessToken }
        });

        const catalogs = response.data.data;
        console.log(`[syncCatalogs] Received ${catalogs.length} catalogs from Meta.`);
        
        if (catalogs.length === 0) {
            return { message: "No product catalogs found for this WABA." };
        }

        const { db } = await connectToDatabase();
        const bulkOps = catalogs.map((catalog: any) => ({
            updateOne: {
                filter: { metaCatalogId: catalog.id, projectId: project._id },
                update: {
                    $set: {
                        name: catalog.name,
                        metaCatalogId: catalog.id,
                        projectId: project._id,
                    },
                    $setOnInsert: {
                        createdAt: new Date(),
                    },
                },
                upsert: true,
            },
        }));

        const result = await db.collection('catalogs').bulkWrite(bulkOps);
        const syncedCount = result.upsertedCount + result.modifiedCount;
        
        // Update the project with the list of catalogs
        const projectCatalogs = catalogs.map((c: any) => ({ catalogId: c.id, name: c.name }));
        await db.collection('projects').updateOne(
            { _id: project._id },
            { $set: { catalogs: projectCatalogs } }
        );
        console.log(`[syncCatalogs] Updated project ${projectId} with ${projectCatalogs.length} catalog references.`);

        revalidatePath('/dashboard/catalog');
        
        return { message: `Successfully synced ${syncedCount} catalog(s).`, count: syncedCount };

    } catch (e: any) {
        console.error('[syncCatalogs] Error during sync:', getErrorMessage(e));
        return { error: getErrorMessage(e) };
    }
}

export async function getCatalogs(projectId: string): Promise<WithId<Catalog>[]> {
    if (!projectId || !ObjectId.isValid(projectId)) return [];
    try {
        const { db } = await connectToDatabase();
        const catalogs = await db.collection<Catalog>('catalogs').find({ projectId: new ObjectId(projectId) }).toArray();
        return JSON.parse(JSON.stringify(catalogs));
    } catch (e) {
        console.error("Failed to fetch catalogs:", e);
        return [];
    }
}

export async function getProductsForCatalog(catalogId: string, projectId: string): Promise<any[]> {
    console.log(`[getProductsForCatalog] Fetching products for catalog: ${catalogId}`);
    const project = await getProjectById(projectId);
    if (!project) {
        console.error(`[getProductsForCatalog] Project not found: ${projectId}`);
        return [];
    }

    const accessToken = process.env.META_ADMIN_TOKEN || project.accessToken;
    const fields = 'id,name,description,category,product_type,image_url,price,currency,retailer_id,availability,condition,inventory,brand,gtin,mpn,sale_price,sale_price_effective_date,item_group_id,additional_image_link,shipping_weight,shipping_length,shipping_width,shipping_height,custom_label_0,custom_label_1,visibility,rich_text_description,start_date,end_date';

    const endpoint = `https://graph.facebook.com/${PRODUCTS_API_VERSION}/${catalogId}/products`;
    console.log(`[getProductsForCatalog] Calling Meta API: ${endpoint}`);

    try {
        const response = await axios.get(endpoint, {
            params: { access_token: accessToken, fields }
        });
        console.log(`[getProductsForCatalog] Received ${response.data.data.length} products from Meta.`);
        return response.data.data || [];
    } catch (e: any) {
        console.error('[getProductsForCatalog] Error fetching products:', getErrorMessage(e));
        return [];
    }
}

export async function addProductToCatalog(prevState: any, formData: FormData) {
    const projectId = formData.get('projectId') as string;
    const catalogId = formData.get('catalogId') as string;
    
    console.log(`[addProductToCatalog] Attempting to add product to catalog: ${catalogId}`);

    const project = await getProjectById(projectId);
    if (!project) return { error: "Project not found or access denied." };

    const accessToken = process.env.META_ADMIN_TOKEN || project.accessToken;

    try {
        const payload: any = {
            retailer_id: formData.get('retailer_id'),
            name: formData.get('title'),
            description: formData.get('description'),
            availability: formData.get('availability'),
            condition: formData.get('condition'),
            price: formData.get('price'),
            link: formData.get('link'),
            image_url: formData.get('image_link'),
            brand: formData.get('brand') || undefined,
            google_product_category: formData.get('google_product_category') || undefined,
            product_type: formData.get('product_type') || undefined,
            sale_price: formData.get('sale_price') || undefined,
            sale_price_effective_date: formData.get('sale_price_effective_date') || undefined,
            item_group_id: formData.get('item_group_id') || undefined,
            additional_image_link: (formData.get('additional_image_link') as string)?.split('\n').filter(Boolean) || undefined,
            inventory: formData.get('inventory') ? Number(formData.get('inventory')) : undefined,
            tax: formData.get('tax') ? Number(formData.get('tax')) : undefined,
            visibility: formData.get('visibility') || undefined,
        };

        Object.keys(payload).forEach(key => payload[key] === undefined && delete payload[key]);

        const endpoint = `https://graph.facebook.com/${PRODUCTS_API_VERSION}/${catalogId}/products`;
        console.log(`[addProductToCatalog] Calling Meta API: POST ${endpoint}`, { payload });
        
        await axios.post(endpoint, payload, {
            params: { access_token: accessToken }
        });
        
        revalidatePath(`/dashboard/catalog/${catalogId}`);
        return { message: 'Product added successfully!' };
    } catch(e: any) {
        const errorMessage = getErrorMessage(e);
        console.error('[addProductToCatalog] Error:', errorMessage);
        return { error: errorMessage };
    }
}

export async function updateProductInCatalog(prevState: any, formData: FormData) {
    const projectId = formData.get('projectId') as string;
    const productId = formData.get('productId') as string;
    
    console.log(`[updateProductInCatalog] Attempting to update product: ${productId}`);

    const project = await getProjectById(projectId);
    if (!project) return { error: "Project not found or access denied." };

    const accessToken = process.env.META_ADMIN_TOKEN || project.accessToken;

    try {
        const payload: any = {
            name: formData.get('title'),
            description: formData.get('description'),
            availability: formData.get('availability'),
            condition: formData.get('condition'),
            price: formData.get('price'),
            link: formData.get('link'),
            image_url: formData.get('image_link'),
            brand: formData.get('brand') || undefined,
            google_product_category: formData.get('google_product_category') || undefined,
            product_type: formData.get('product_type') || undefined,
            sale_price: formData.get('sale_price') || undefined,
            sale_price_effective_date: formData.get('sale_price_effective_date') || undefined,
            item_group_id: formData.get('item_group_id') || undefined,
            additional_image_link: (formData.get('additional_image_link') as string)?.split('\n').filter(Boolean) || undefined,
            inventory: formData.get('inventory') ? Number(formData.get('inventory')) : undefined,
            tax: formData.get('tax') ? Number(formData.get('tax')) : undefined,
            visibility: formData.get('visibility') || undefined,
        };
        
        Object.keys(payload).forEach(key => payload[key] === undefined && delete payload[key]);
        
        const endpoint = `https://graph.facebook.com/${PRODUCTS_API_VERSION}/${productId}`;
        console.log(`[updateProductInCatalog] Calling Meta API: POST ${endpoint}`, { payload });

        await axios.post(endpoint, payload, {
            params: { access_token: accessToken }
        });

        return { message: 'Product updated successfully.' };
    } catch (e: any) {
        const errorMessage = getErrorMessage(e);
        console.error('[updateProductInCatalog] Error:', errorMessage);
        return { error: errorMessage };
    }
}

export async function deleteProductFromCatalog(productId: string, projectId: string): Promise<{ success: boolean, error?: string }> {
    console.log(`[deleteProductFromCatalog] Attempting to delete product: ${productId}`);
    const project = await getProjectById(projectId);
    if (!project) return { success: false, error: "Project not found or access denied." };

    const accessToken = process.env.META_ADMIN_TOKEN || project.accessToken;

    try {
        const endpoint = `https://graph.facebook.com/${PRODUCTS_API_VERSION}/${productId}`;
        console.log(`[deleteProductFromCatalog] Calling Meta API: DELETE ${endpoint}`);
        
        await axios.delete(endpoint, {
            params: { access_token: accessToken }
        });
        
        return { success: true };
    } catch (e: any) {
        const errorMessage = getErrorMessage(e);
        console.error('[deleteProductFromCatalog] Error:', errorMessage);
        return { success: false, error: errorMessage };
    }
}

export async function connectCatalogToWaba(projectId: string, catalogId: string) {
    console.log(`[connectCatalogToWaba] Connecting catalog ${catalogId} to project ${projectId}`);
    const project = await getProjectById(projectId);
    if (!project?.wabaId) return { error: 'Project has no WABA to connect to.' };
    
    const accessToken = process.env.META_ADMIN_TOKEN || project.accessToken;

    try {
        const endpoint = `https://graph.facebook.com/${API_VERSION}/${project.wabaId}/whatsapp_business_product_catalogs`;
        const payload = { product_catalog_id: catalogId };
        console.log(`[connectCatalogToWaba] Calling Meta API: POST ${endpoint}`, { payload });

        await axios.post(endpoint, payload, {
            params: { access_token: accessToken }
        });

        const { db } = await connectToDatabase();
        await db.collection('projects').updateOne({ _id: project._id }, { $set: { connectedCatalogId: catalogId } });

        revalidatePath('/dashboard/catalog');
        return { success: true, message: "Catalog connected to WABA successfully." };
    } catch (e: any) {
        const errorMessage = getErrorMessage(e);
        console.error('[connectCatalogToWaba] Error:', errorMessage);
        return { error: errorMessage };
    }
}

export async function disconnectCatalogFromWaba(projectId: string, catalogId: string) {
    console.log(`[disconnectCatalogFromWaba] Disconnecting catalog ${catalogId} from project ${projectId}`);
    const project = await getProjectById(projectId);
    if (!project?.wabaId) return { error: 'Project has no WABA to disconnect from.' };
    
    const accessToken = process.env.META_ADMIN_TOKEN || project.accessToken;

    try {
        const endpoint = `https://graph.facebook.com/${API_VERSION}/${project.wabaId}/whatsapp_business_product_catalogs`;
        const payload = { product_catalog_id: catalogId };
        console.log(`[disconnectCatalogFromWaba] Calling Meta API: DELETE ${endpoint}`, { payload });

        await axios.delete(endpoint, {
            params: { access_token: accessToken },
            data: payload
        });
        
        const { db } = await connectToDatabase();
        await db.collection('projects').updateOne({ _id: project._id, connectedCatalogId: catalogId }, { $unset: { connectedCatalogId: "" } });
        
        revalidatePath('/dashboard/catalog');
        return { success: true, message: "Catalog disconnected." };
    } catch (e: any) {
        const errorMessage = getErrorMessage(e);
        console.error('[disconnectCatalogFromWaba] Error:', errorMessage);
        return { error: errorMessage };
    }
}

export async function listProductSets(catalogId: string, projectId: string): Promise<ProductSet[]> {
    console.log(`[listProductSets] Listing sets for catalog: ${catalogId}`);
    const project = await getProjectById(projectId);
    if (!project) return [];

    const accessToken = process.env.META_ADMIN_TOKEN || project.accessToken;
    const endpoint = `https://graph.facebook.com/${PRODUCTS_API_VERSION}/${catalogId}/product_sets`;
    console.log(`[listProductSets] Calling Meta API: GET ${endpoint}`);

    try {
        const response = await axios.get(endpoint, {
            params: { access_token: accessToken, fields: 'id,name,product_count' }
        });
        console.log(`[listProductSets] Found ${response.data.data.length} product sets.`);
        return response.data.data || [];
    } catch (e) {
        console.error(`[listProductSets] Error listing product sets:`, getErrorMessage(e));
        return [];
    }
}

export async function createProductSet(prevState: any, formData: FormData) {
    const projectId = formData.get('projectId') as string;
    const catalogId = formData.get('catalogId') as string;
    const name = formData.get('name') as string;
    console.log(`[createProductSet] Creating set "${name}" in catalog ${catalogId}`);

    const project = await getProjectById(projectId);
    if (!project) return { error: "Project not found or access denied." };

    const accessToken = process.env.META_ADMIN_TOKEN || project.accessToken;
    const endpoint = `https://graph.facebook.com/${PRODUCTS_API_VERSION}/${catalogId}/product_sets`;
    console.log(`[createProductSet] Calling Meta API: POST ${endpoint}`);

    try {
        await axios.post(endpoint, { name }, {
            params: { access_token: accessToken }
        });
        revalidatePath(`/dashboard/catalog/${catalogId}`);
        return { message: 'Collection created successfully.' };
    } catch (e: any) {
        const errorMessage = getErrorMessage(e);
        console.error('[createProductSet] Error:', errorMessage);
        return { error: errorMessage };
    }
}

export async function deleteProductSet(setId: string, projectId: string): Promise<{ success: boolean, error?: string }> {
    console.log(`[deleteProductSet] Deleting set: ${setId}`);
    const project = await getProjectById(projectId);
    if (!project) return { success: false, error: 'Project not found.' };

    const accessToken = process.env.META_ADMIN_TOKEN || project.accessToken;
    const endpoint = `https://graph.facebook.com/${PRODUCTS_API_VERSION}/${setId}`;
    console.log(`[deleteProductSet] Calling Meta API: DELETE ${endpoint}`);
    
    try {
        await axios.delete(endpoint, { params: { access_token: accessToken } });
        return { success: true };
    } catch (e: any) {
        const errorMessage = getErrorMessage(e);
        console.error('[deleteProductSet] Error:', errorMessage);
        return { success: false, error: errorMessage };
    }
}

export async function getTaggedMediaForProduct(productId: string, projectId: string) {
    console.log(`[getTaggedMediaForProduct] Fetching media for product: ${productId}`);
    const project = await getProjectById(projectId);
    if (!project) return { error: "Project not found." };
    
    const accessToken = process.env.META_ADMIN_TOKEN || project.accessToken;
    const endpoint = `https://graph.facebook.com/${PRODUCTS_API_VERSION}/${productId}/tagged_media`;
    console.log(`[getTaggedMediaForProduct] Calling Meta API: GET ${endpoint}`);
    
    try {
        const response = await axios.get(endpoint, {
            params: { access_token: accessToken, fields: 'id,media_type,media_url,thumbnail_url,caption,permalink' }
        });
        console.log(`[getTaggedMediaForProduct] Found ${response.data.data.length} media items.`);
        return { media: response.data.data || [] };
    } catch (e: any) {
        const errorMessage = getErrorMessage(e);
        console.error(`[getTaggedMediaForProduct] Error fetching media:`, errorMessage);
        return { error: errorMessage };
    }
}
