'use server';

import axios from 'axios';
import { revalidatePath } from 'next/cache';
import { ObjectId, type WithId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getProjectById } from '@/app/actions/project.actions';
import { getErrorMessage } from '@/lib/utils';
import { z } from 'zod'; // Added for validation

const API_VERSION = 'v23.0';

export interface Catalog {
    id: string;
    name: string;
    vertical: string;
    product_count: number;
}

export interface Product {
    id: string; // This is the Catalog Item ID (Meta ID)
    retailer_id: string; // This is the Content ID (SKU) used in messages
    name: string;
    description: string;
    image_url: string;
    price: string;
    currency: string;
    url: string;
}

// --- CATALOG MANAGEMENT ---

export async function syncCatalogs(projectId: string): Promise<{ catalogs: WithId<Catalog>[], error?: string }> {
    const project = await getProjectById(projectId);
    if (!project) return { catalogs: [], error: 'Project not found or access denied.' };

    // User requested META_ADMIN_TOKEN usage here
    const accessToken = process.env.META_ADMIN_TOKEN || project.accessToken;
    const { wabaId } = project;

    if (!wabaId) return { catalogs: [], error: 'Project WABA ID not found.' };
    if (!accessToken) {
        return { catalogs: [], error: 'Configuration error: Access token not set.' };
    }

    try {
        const response = await axios.get(`https://graph.facebook.com/${API_VERSION}/${wabaId}/product_catalogs`, {
            params: { access_token: accessToken }
        });

        const fetchedCatalogs = response.data.data;
        if (!fetchedCatalogs || fetchedCatalogs.length === 0) {
            // No catalogs found, but not necessarily an error. Return empty.
            // But if specific error requested:
            // return { catalogs: [], error: "No catalogs found for this WABA." };
        }

        const { db } = await connectToDatabase();

        if (fetchedCatalogs && fetchedCatalogs.length > 0) {
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

export async function getOwnedCatalogs(projectId: string): Promise<{ catalogs: Catalog[]; error?: string }> {
    if (!projectId || !ObjectId.isValid(projectId)) {
        return { error: 'Invalid Project ID.' };
    }

    const project = await getProjectById(projectId);
    if (!project || !project.accessToken) {
        return { error: 'Project not found or access token missing.' };
    }

    try {
        // Fetch Business ID first
        const wabaResponse = await axios.get(
            `https://graph.facebook.com/${API_VERSION}/${project.wabaId}`,
            {
                params: {
                    fields: 'business_discovery,business',
                    access_token: project.accessToken
                }
            }
        );

        const businessId = wabaResponse.data.business?.id;
        if (!businessId) {
            return { error: 'Could not determine the Business ID associated with this WhatsApp Account.' };
        }

        const catalogsResponse = await axios.get(
            `https://graph.facebook.com/${API_VERSION}/${businessId}/owned_product_catalogs`,
            {
                params: {
                    fields: 'id,name,vertical,product_count',
                    limit: 100,
                    access_token: project.accessToken
                }
            }
        );

        if (catalogsResponse.data.error) {
            throw new Error(catalogsResponse.data.error.message);
        }

        return { catalogs: catalogsResponse.data.data || [] };

    } catch (e: any) {
        // console.error('Failed to fetch catalogs:', e.response?.data || e.message);
        return { error: `Failed to fetch catalogs: ${getErrorMessage(e)}` };
    }
}

export async function createCatalog(prevState: any, formData: FormData): Promise<{ success: boolean; error?: string; message?: string; catalogs?: Catalog[] }> {
    const projectId = formData.get('projectId') as string;
    const project = await getProjectById(projectId);
    if (!project || !project.businessId) return { success: false, error: 'Project not found or business ID is missing.' };

    const accessToken = process.env.META_ADMIN_TOKEN || project.accessToken;
    if (!accessToken) return { success: false, error: 'Server configuration error: Access token missing.' };

    const payload = {
        name: formData.get('catalogName'),
        vertical: 'COMMERCE' // Default to commerce
    };

    try {
        const response = await axios.post(`https://graph.facebook.com/${API_VERSION}/${project.businessId}/product_catalogs`, {
            ...payload,
            access_token: accessToken
        });

        // Sync after creation
        await syncCatalogs(projectId);

        // Return updated list via getOwnedCatalogs logic or just success
        // returning simple success for now, or re-fetch
        return { success: true, message: `Catalog "${payload.name}" created successfully with ID: ${response.data.id}` };

    } catch (e: any) {
        return { success: false, error: getErrorMessage(e) };
    }
}


// --- PRODUCT MANAGEMENT ---

export async function getCatalogProducts(
    projectId: string,
    catalogId: string,
    cursor?: string, // Pagination cursor
    query?: string
): Promise<{ products: Product[]; nextCursor?: string; error?: string }> {

    if (!projectId || !catalogId) return { error: 'Missing required parameters.' };

    const project = await getProjectById(projectId);
    // Prefer project token, fallback to admin only if needed (usually project token is safer for read)
    const accessToken = project?.accessToken || process.env.META_ADMIN_TOKEN;

    if (!project || !accessToken) {
        return { error: 'Project access denied or token missing.' };
    }

    try {
        const params: any = {
            fields: 'retailer_id,name,description,image_url,price,currency,url',
            limit: 20,
            access_token: accessToken
        };

        if (cursor) {
            params.after = cursor;
        }

        // Meta doesn't support direct text search on /products easily. 
        // We'll ignore 'query' for now or handle client-side filtering if fetching all (expensive).
        // Sticking to pagination.

        const response = await axios.get(
            `https://graph.facebook.com/${API_VERSION}/${catalogId}/products`,
            { params }
        );

        if (response.data.error) {
            throw new Error(response.data.error.message);
        }

        const products: Product[] = (response.data.data || []).map((item: any) => ({
            id: item.id,
            retailer_id: item.retailer_id,
            name: item.name,
            description: item.description,
            image_url: item.image_url,
            price: item.price,
            currency: item.currency,
            url: item.url
        }));

        return {
            products,
            nextCursor: response.data.paging?.cursors?.after
        };

    } catch (e: any) {
        return { error: `Failed to fetch products: ${getErrorMessage(e)}` };
    }
}

// Alias for compatibility if needed, or distinct implementation
export async function getProductsForCatalog(catalogId: string, projectId: string) {
    // Re-use logical implementation
    const res = await getCatalogProducts(projectId, catalogId);
    return res.products || [];
}


export async function addProductToCatalog(prevState: any, formData: FormData): Promise<{ success: boolean; error?: string; message?: string }> {
    const projectId = formData.get('projectId') as string;
    const catalogId = formData.get('catalogId') as string;

    const project = await getProjectById(projectId);
    if (!project) return { success: false, error: 'Project not found.' };

    const accessToken = process.env.META_ADMIN_TOKEN || project.accessToken;
    if (!accessToken) return { success: false, error: 'Server configuration error.' };

    const priceString = formData.get('price') as string;
    const [priceValue, currency] = priceString.split(' ');

    // Validating required fields presence
    if (!formData.get('title') || !priceValue) {
        return { success: false, error: "Title and Price are required." };
    }

    const payload: any = {
        name: formData.get('title'),
        description: formData.get('description'),
        availability: formData.get('availability') || 'in stock',
        condition: formData.get('condition') || 'new',
        price: Number(priceValue) * 100, // Convert to cents
        currency: currency || 'USD',
        inventory: Number(formData.get('inventory') || 1),
        link: formData.get('link'),
        image_url: formData.get('image_link'),
        brand: formData.get('brand'),
        retailer_id: formData.get('retailer_id'), // User provided SKU
    };

    try {
        await axios.post(`https://graph.facebook.com/${API_VERSION}/${catalogId}/products`, {
            ...payload,
            access_token: accessToken
        });

        revalidatePath('/dashboard/facebook/commerce/products');
        return { success: true, message: "Product added successfully." };
    } catch (e: any) {
        return { success: false, error: getErrorMessage(e) };
    }
}

export async function updateProductInCatalog(prevState: any, formData: FormData): Promise<{ success: boolean; error?: string; message?: string }> {
    const projectId = formData.get('projectId') as string;
    const productId = formData.get('productId') as string; // This is the Meta Product ID

    const project = await getProjectById(projectId);
    if (!project) return { success: false, error: 'Project not found.' };

    const accessToken = process.env.META_ADMIN_TOKEN || project.accessToken;
    if (!accessToken) return { success: false, error: 'Server configuration error.' };

    const priceString = formData.get('price') as string;

    const payload: any = {
        name: formData.get('title'),
        description: formData.get('description'),
        availability: formData.get('availability'),
        condition: formData.get('condition'),
        inventory: formData.get('inventory') ? Number(formData.get('inventory')) : undefined,
        link: formData.get('link'),
        image_url: formData.get('image_link'),
        brand: formData.get('brand'),
    };

    if (priceString) {
        const [priceValue, currency] = priceString.split(' ');
        if (priceValue) {
            payload.price = Number(priceValue) * 100;
            payload.currency = currency || 'USD';
        }
    }

    // Clean up empty/undefined fields to avoid partial updates wiping data
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

        revalidatePath('/dashboard/facebook/commerce/products');
        return { success: true, message: "Product updated successfully." };
    } catch (e: any) {
        return { success: false, error: getErrorMessage(e) };
    }
}


export async function deleteProductFromCatalog(productId: string, projectId: string): Promise<{ success: boolean; error?: string }> {
    const project = await getProjectById(projectId);
    if (!project) return { success: false, error: 'Project not found.' };

    const accessToken = process.env.META_ADMIN_TOKEN || project.accessToken;
    if (!accessToken) return { success: false, error: 'Server configuration error.' };

    try {
        await axios.delete(`https://graph.facebook.com/${API_VERSION}/${productId}`, {
            params: { access_token: accessToken }
        });

        revalidatePath('/dashboard/facebook/commerce/products');
        return { success: true };
    } catch (e: any) {
        return { success: false, error: getErrorMessage(e) };
    }
}

export async function getTaggedMediaForProduct(productId: string, projectId: string): Promise<{ media?: any[], error?: string }> {
    const project = await getProjectById(projectId);
    if (!project) return { error: 'Project not found.' };

    const accessToken = process.env.META_ADMIN_TOKEN || project.accessToken;
    if (!accessToken) return { error: 'Server configuration error.' };

    try {
        const response = await axios.get(`https://graph.facebook.com/${API_VERSION}/${productId}/tagged_media`, {
            params: { access_token: accessToken, fields: 'id,media_url,permalink,thumbnail_url' }
        });
        return { media: response.data.data };
    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}


// --- PRODUCT SETS / COLLECTIONS ---

export async function listProductSets(catalogId: string, projectId: string): Promise<any[]> {
    const project = await getProjectById(projectId);
    if (!project) return [];

    const accessToken = process.env.META_ADMIN_TOKEN || project.accessToken;
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

    const accessToken = process.env.META_ADMIN_TOKEN || project.accessToken;
    if (!accessToken) return { success: false, error: 'Server configuration error.' };

    const catalogId = formData.get('catalogId') as string;
    const payload = { name: formData.get('name') };

    try {
        await axios.post(`https://graph.facebook.com/${API_VERSION}/${catalogId}/product_sets`, {
            ...payload,
            access_token: accessToken
        });
        return { success: true, message: `Collection "${payload.name}" created successfully.` };
    } catch (e: any) {
        return { success: false, error: getErrorMessage(e) };
    }
}

export async function deleteProductSet(setId: string, projectId: string): Promise<{ success: boolean; error?: string }> {
    const project = await getProjectById(projectId);
    if (!project) return { success: false, error: 'Project not found.' };

    const accessToken = process.env.META_ADMIN_TOKEN || project.accessToken;
    if (!accessToken) return { success: false, error: 'Server configuration error.' };

    try {
        await axios.delete(`https://graph.facebook.com/${API_VERSION}/${setId}`, {
            params: { access_token: accessToken }
        });
        return { success: true };
    } catch (e: any) {
        return { success: false, error: getErrorMessage(e) };
    }
}
