
'use server';

import { getProjectById } from '@/app/actions/index.ts';
import { getErrorMessage } from '@/lib/utils';
import axios from 'axios';
import { revalidatePath } from 'next/cache';
import type { WithId, Project, Product, EcommProductVariant } from '@/lib/definitions';
import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

const API_VERSION = 'v23.0';

export async function getCatalogs(projectId: string): Promise<WithId<any>[]> {
    if (!projectId) return [];

    try {
        const { db } = await connectToDatabase();
        const project = await getProjectById(projectId);
        if (!project || !project.businessId || !project.accessToken) {
            return [];
        }

        const response = await axios.get(`https://graph.facebook.com/${API_VERSION}/${project.businessId}/owned_product_catalogs`, {
            params: {
                access_token: project.accessToken,
                fields: 'id,name'
            }
        });
        
        const catalogsFromMeta = response.data.data;

        if (catalogsFromMeta && catalogsFromMeta.length > 0) {
             const bulkOps = catalogsFromMeta.map((catalog: any) => ({
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
            await db.collection('catalogs').bulkWrite(bulkOps);

            // Update project with the list of catalogs
            const catalogInfo = catalogsFromMeta.map((c: any) => ({ catalogId: c.id, name: c.name }));
            await db.collection('projects').updateOne(
                { _id: new ObjectId(projectId) },
                { $set: { catalogs: catalogInfo } }
            );
        }

        const allCatalogs = await db.collection('catalogs').find({ projectId: new ObjectId(projectId) }).toArray();
        return JSON.parse(JSON.stringify(allCatalogs));
    } catch (e) {
        console.error("Failed to fetch or sync catalogs", getErrorMessage(e));
        // Fallback to local DB
        const { db } = await connectToDatabase();
        const allCatalogs = await db.collection('catalogs').find({ projectId: new ObjectId(projectId) }).toArray();
        return JSON.parse(JSON.stringify(allCatalogs));
    }
}

export async function syncCatalogs(projectId: string) {
    if (!projectId) return { error: 'Project ID is missing.' };
    
    try {
        await getCatalogs(projectId); // This function now includes the sync logic.
        return { message: 'Catalogs synced successfully.' };
    } catch (e) {
        return { error: getErrorMessage(e) };
    }
}


export async function getProductsForCatalog(catalogId: string, projectId: string) {
    if (!catalogId || !projectId) return [];
    try {
        const project = await getProjectById(projectId);
        if (!project || !project.accessToken) {
            throw new Error("Project not found or access token is missing.");
        }
        const response = await axios.get(`https://graph.facebook.com/${API_VERSION}/${catalogId}/products`, {
            params: {
                fields: 'id,name,description,category,product_type,image_url,price,currency,retailer_id,availability,condition,inventory,brand,gtin,mpn,custom_label_0,custom_label_1,sale_price,sale_price_effective_date,item_group_id,gender,age_group,color,size,material,pattern,shipping_weight,shipping_length,shipping_width,shipping_height,tax,visibility',
                access_token: project.accessToken,
                limit: 100
            }
        });
        return response.data.data || [];
    } catch (e) {
        console.error("Failed to fetch products for catalog:", getErrorMessage(e));
        return [];
    }
}

const buildProductPayload = (formData: FormData): any => {
    const priceString = formData.get('price') as string;
    const priceParts = priceString.trim().split(/\s+/);
    const amount = parseFloat(priceParts[0]);
    const currency = priceParts[1]?.toUpperCase() || 'INR';

    if (isNaN(amount) || !currency) {
        throw new Error("Invalid price format. It must be a number followed by a currency code (e.g., '999 INR').");
    }

    const payload: any = {
        name: formData.get('title'),
        description: formData.get('description'),
        availability: formData.get('availability'),
        condition: formData.get('condition'),
        price: `${amount * 100}`,
        currency: currency,
        link: formData.get('link'),
        image_link: formData.get('image_link'),
        brand: formData.get('brand'),
        google_product_category: formData.get('google_product_category'),
        product_type: formData.get('product_type'),
        retailer_id: formData.get('retailer_id'),
        inventory: formData.get('inventory'),
        item_group_id: formData.get('item_group_id'),
        gtin: formData.get('gtin'),
        mpn: formData.get('mpn'),
        color: formData.get('color'),
        size: formData.get('size'),
        gender: formData.get('gender'),
        age_group: formData.get('age_group'),
        material: formData.get('material'),
        pattern: formData.get('pattern'),
        shipping_weight: formData.get('shipping_weight'),
        custom_label_0: formData.get('custom_label_0'),
        custom_label_1: formData.get('custom_label_1'),
        visibility: formData.get('visibility')
    };

    const salePrice = formData.get('sale_price') as string;
    if (salePrice) {
        const salePriceParts = salePrice.trim().split(/\s+/);
        payload.sale_price = `${parseFloat(salePriceParts[0]) * 100}`;
    }
    
    const saleDate = formData.get('sale_price_effective_date') as string;
    if (saleDate) payload.sale_price_effective_date = saleDate;

    // Remove any null or empty fields
    Object.keys(payload).forEach(key => (payload[key] == null || payload[key] === '') && delete payload[key]);

    return payload;
};

export async function addProductToCatalog(prevState: any, formData: FormData) {
    try {
        const projectId = formData.get('projectId') as string;
        const catalogId = formData.get('catalogId') as string;
        
        const project = await getProjectById(projectId);
        if (!project || !project.accessToken) {
            throw new Error("Project not found or access token missing.");
        }

        const payload = buildProductPayload(formData);
        payload.access_token = project.accessToken;

        await axios.post(`https://graph.facebook.com/${API_VERSION}/${catalogId}/products`, payload);
        
        revalidatePath(`/dashboard/catalog/${catalogId}`);
        return { message: 'Product added successfully!' };
    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}

export async function updateProductInCatalog(prevState: any, formData: FormData) {
    try {
        const projectId = formData.get('projectId') as string;
        const productId = formData.get('productId') as string;

        const project = await getProjectById(projectId);
        if (!project || !project.accessToken) {
            throw new Error("Project not found or access token missing.");
        }

        const payload = buildProductPayload(formData);
        payload.access_token = project.accessToken;

        await axios.post(`https://graph.facebook.com/${API_VERSION}/${productId}`, payload);
        
        revalidatePath(`/dashboard/catalog/${formData.get('catalogId')}`);
        return { message: 'Product updated successfully!' };
    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}

export async function deleteProductFromCatalog(productId: string, projectId: string) {
    try {
        const project = await getProjectById(projectId);
        if (!project || !project.accessToken) {
            throw new Error("Project not found or access token missing.");
        }
        await axios.delete(`https://graph.facebook.com/${API_VERSION}/${productId}`, {
            params: { access_token: project.accessToken }
        });
        return { success: true };
    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
    }
}

export async function createProductSet(prevState: any, formData: FormData) {
     try {
        const projectId = formData.get('projectId') as string;
        const catalogId = formData.get('catalogId') as string;
        const name = formData.get('name') as string;

        const project = await getProjectById(projectId);
        if (!project || !project.accessToken) {
            throw new Error("Project not found or access token missing.");
        }
        
        await axios.post(`https://graph.facebook.com/${API_VERSION}/${catalogId}/product_sets`, {
            name: name,
            access_token: project.accessToken
        });

        revalidatePath(`/dashboard/catalog/${catalogId}`);
        return { message: `Collection "${name}" created successfully.` };
    } catch (e) {
        return { error: getErrorMessage(e) };
    }
}

export async function listProductSets(catalogId: string, projectId: string) {
    if (!catalogId || !projectId) return [];
    try {
        const project = await getProjectById(projectId);
        if (!project || !project.accessToken) throw new Error("Project not configured.");
        
        const response = await axios.get(`https://graph.facebook.com/${API_VERSION}/${catalogId}/product_sets`, {
            params: { access_token: project.accessToken, fields: 'id,name,product_count' }
        });
        return response.data.data || [];
    } catch(e) {
        console.error("Failed to list product sets:", getErrorMessage(e));
        return [];
    }
}

export async function deleteProductSet(setId: string, projectId: string) {
     try {
        const project = await getProjectById(projectId);
        if (!project || !project.accessToken) throw new Error("Project not configured.");
        
        await axios.delete(`https://graph.facebook.com/${API_VERSION}/${setId}`, {
            params: { access_token: project.accessToken }
        });
        return { success: true };
    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
    }
}

export async function getTaggedMediaForProduct(productId: string, projectId: string): Promise<{media?: any[], error?: string}> {
    if (!productId || !projectId) return { error: 'Product and Project ID are required.' };
    try {
        const project = await getProjectById(projectId);
        if (!project || !project.accessToken) throw new Error("Project not configured.");

        const response = await axios.get(`https://graph.facebook.com/${API_VERSION}/${productId}/tagged_media`, {
            params: { access_token: project.accessToken, fields: 'id,media_url,thumbnail_url,permalink,caption,timestamp' }
        });

        return { media: response.data.data };
    } catch (e) {
        return { error: getErrorMessage(e) };
    }
}

    