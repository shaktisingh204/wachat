
'use server';

import { revalidatePath } from 'next/cache';
import { ObjectId } from 'mongodb';
import { getProjectById } from './project.actions';
import { getErrorMessage } from '@/lib/utils';
import axios from 'axios';
import { connectToDatabase } from '@/lib/mongodb';
import type { Catalog } from '@/lib/definitions';

const API_VERSION = 'v24.0';

export async function syncCatalogs(projectId: string): Promise<{ message?: string; error?: string }> {
    const project = await getProjectById(projectId);
    if (!project || !project.wabaId) {
        return { error: "Project not found or WABA ID is not configured." };
    }

    try {
        const { db } = await connectToDatabase();
        const response = await axios.get(`https://graph.facebook.com/${API_VERSION}/${project.wabaId}/product_catalogs`, {
            params: { access_token: project.accessToken }
        });

        if (response.data.error) {
            throw new Error(`Meta API Error: ${response.data.error.message}`);
        }
        
        const metaCatalogs = response.data.data;
        if (!metaCatalogs || metaCatalogs.length === 0) {
            return { message: "No product catalogs found for this WhatsApp Business Account." };
        }

        const bulkOps = metaCatalogs.map((catalog: any) => ({
            updateOne: {
                filter: { metaCatalogId: catalog.id, projectId: project._id },
                update: {
                    $set: {
                        name: catalog.name,
                        product_count: catalog.product_count,
                    },
                    $setOnInsert: {
                        metaCatalogId: catalog.id,
                        projectId: project._id,
                        createdAt: new Date(),
                    },
                },
                upsert: true,
            },
        }));

        const result = await db.collection('catalogs').bulkWrite(bulkOps);
        revalidatePath('/dashboard/catalog');
        return { message: `Successfully synced ${result.upsertedCount + result.modifiedCount} catalog(s).` };

    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}


export async function getCatalogs(projectId: string): Promise<WithId<Catalog>[]> {
    if (!projectId) return [];
    try {
        const { db } = await connectToDatabase();
        const catalogs = await db.collection<Catalog>('catalogs').find({ projectId: new ObjectId(projectId) }).toArray();
        return JSON.parse(JSON.stringify(catalogs));
    } catch (e) {
        return [];
    }
}

export async function getProductsForCatalog(catalogId: string, projectId: string) {
    const project = await getProjectById(projectId);
    if (!project) return [];

    try {
        const response = await axios.get(`https://graph.facebook.com/${API_VERSION}/${catalogId}/products`, {
            params: {
                access_token: project.accessToken,
                fields: 'id,name,description,category,product_type,image_url,price,retailer_id,inventory,availability,currency,condition,sale_price,sale_price_effective_date,brand,item_group_id,gtin,mpn,custom_label_0,custom_label_1,visibility,additional_image_link,url'
            }
        });
        if (response.data.error) {
            throw new Error(`Meta API Error: ${response.data.error.message}`);
        }
        return response.data.data || [];
    } catch (e) {
        console.error("Failed to fetch products:", getErrorMessage(e));
        return [];
    }
}

export async function addProductToCatalog(prevState: any, formData: FormData) {
    const projectId = formData.get('projectId') as string;
    const catalogId = formData.get('catalogId') as string;
    
    if (!projectId || !catalogId) return { error: "Project or Catalog ID missing." };
    
    const project = await getProjectById(projectId);
    if (!project) return { error: "Project not found or access denied." };

    try {
        const productData: any = {};
        for (const [key, value] of formData.entries()) {
            if (key !== 'projectId' && key !== 'catalogId' && value) {
                productData[key] = value;
            }
        }
        
        // Price needs to be in cents
        if (productData.price) {
            productData.price = Math.round(parseFloat(productData.price) * 100);
        }

        const response = await axios.post(`https://graph.facebook.com/${API_VERSION}/${catalogId}/products`, {
            ...productData,
            access_token: project.accessToken,
        });

        if (response.data.error) {
            throw new Error(`Meta API Error: ${response.data.error.message}`);
        }
        
        revalidatePath('/dashboard/catalog/[catalogId]', 'page');
        return { message: "Product added successfully." };
    } catch (e) {
        return { error: getErrorMessage(e) };
    }
}

export async function updateProductInCatalog(prevState: any, formData: FormData) {
    const projectId = formData.get('projectId') as string;
    const productId = formData.get('productId') as string;
    
    if (!projectId || !productId) return { error: "Project or Product ID missing." };
    
    const project = await getProjectById(projectId);
    if (!project) return { error: "Project not found or access denied." };

    try {
        const updateData: any = {};
        for (const [key, value] of formData.entries()) {
            if (!['projectId', 'productId', 'catalogId'].includes(key) && value) {
                 updateData[key] = value;
            }
        }
        
        if (updateData.price) {
            const [priceVal, currency] = updateData.price.split(' ');
            updateData.price = Math.round(parseFloat(priceVal) * 100);
            updateData.currency = currency;
        }

        const response = await axios.post(`https://graph.facebook.com/${API_VERSION}/${productId}`, {
            ...updateData,
            access_token: project.accessToken,
        });

        if (response.data.error) throw new Error(`Meta API Error: ${response.data.error.message}`);
        
        revalidatePath('/dashboard/catalog/[catalogId]', 'page');
        revalidatePath('/dashboard/catalog/[catalogId]/[productId]/edit', 'page');
        return { message: "Product updated successfully." };
    } catch (e) {
        return { error: getErrorMessage(e) };
    }
}

export async function deleteProductFromCatalog(productId: string, projectId: string) {
     const project = await getProjectById(projectId);
    if (!project) return { success: false, error: "Project not found or access denied." };

    try {
        await axios.delete(`https://graph.facebook.com/${API_VERSION}/${productId}`, {
            params: { access_token: project.accessToken }
        });
        revalidatePath('/dashboard/catalog/[catalogId]', 'page');
        return { success: true };
    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
    }
}

export async function getTaggedMediaForProduct(productId: string, projectId: string) {
    const project = await getProjectById(projectId);
    if (!project) return { error: "Project not found." };
    try {
         const response = await axios.get(`https://graph.facebook.com/${API_VERSION}/${productId}/tagged_in_media`, {
            params: { access_token: project.accessToken, fields: 'id,media_url,permalink,timestamp,caption,thumbnail_url' }
        });
        return { media: response.data.data };
    } catch(e) {
        return { error: getErrorMessage(e) };
    }
}

export async function createProductSet(prevState: any, formData: FormData) {
    const projectId = formData.get('projectId') as string;
    const catalogId = formData.get('catalogId') as string;
    const name = formData.get('name') as string;

    const project = await getProjectById(projectId);
    if (!project) return { error: "Project not found." };

    try {
        await axios.post(`https://graph.facebook.com/${API_VERSION}/${catalogId}/product_sets`, {
            name,
            access_token: project.accessToken
        });
        revalidatePath('/dashboard/catalog/[catalogId]', 'page');
        return { message: `Collection "${name}" created.` };
    } catch(e) {
        return { error: getErrorMessage(e) };
    }
}

export async function listProductSets(catalogId: string, projectId: string) {
     const project = await getProjectById(projectId);
    if (!project) return [];

    try {
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
     const project = await getProjectById(projectId);
    if (!project) return { success: false, error: "Project not found." };

    try {
        await axios.delete(`https://graph.facebook.com/${API_VERSION}/${setId}`, {
            params: { access_token: project.accessToken }
        });
        revalidatePath('/dashboard/catalog/[catalogId]', 'page');
        return { success: true };
    } catch(e) {
        return { success: false, error: getErrorMessage(e) };
    }
}

    