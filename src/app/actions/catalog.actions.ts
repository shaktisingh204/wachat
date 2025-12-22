
'use server';

import { revalidatePath } from 'next/cache';
import type { WithId } from 'mongodb';
import { ObjectId } from 'mongodb';
import axios from 'axios';
import { connectToDatabase } from '@/lib/mongodb';
import { getProjectById } from '@/app/actions/index.ts';
import { getErrorMessage } from '@/lib/utils';
import type { Catalog, Product, Project } from '@/lib/definitions';
import { nanoid } from 'nanoid';

const API_VERSION = 'v23.0';

export async function syncCatalogs(projectId: string): Promise<{ success: boolean; message?: string, error?: string }> {
    const project = await getProjectById(projectId);
    if (!project) {
        return { success: false, error: 'Project not found or you do not have access.' };
    }
    if (!project.businessId) {
        return { success: false, error: 'Business ID is not configured for this project. Reconnect the project to enable catalog features.' };
    }

    try {
        const response = await axios.get(`https://graph.facebook.com/${API_VERSION}/${project.businessId}/owned_product_catalogs`, {
            params: {
                access_token: project.accessToken,
                fields: 'id,name',
            }
        });
        
        if (response.data.error) {
            throw new Error(getErrorMessage({ response }));
        }

        const catalogsFromMeta = response.data.data;
        if (!catalogsFromMeta || catalogsFromMeta.length === 0) {
            return { success: true, message: 'No product catalogs found in your Meta Business Account to sync.' };
        }
        
        const { db } = await connectToDatabase();
        
        const bulkOps = catalogsFromMeta.map((catalog: any) => ({
            updateOne: {
                filter: { metaCatalogId: catalog.id, projectId: project._id },
                update: {
                    $set: { name: catalog.name },
                    $setOnInsert: {
                        projectId: project._id,
                        metaCatalogId: catalog.id,
                        createdAt: new Date(),
                    },
                },
                upsert: true,
            },
        }));

        await db.collection('catalogs').bulkWrite(bulkOps);

        revalidatePath('/dashboard/catalog');
        return { success: true, message: `Successfully synced ${catalogsFromMeta.length} catalog(s).` };

    } catch (e: any) {
        console.error('Catalog sync failed:', e);
        return { success: false, error: getErrorMessage(e) };
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

export async function getProductsForCatalog(catalogId: string, projectId: string): Promise<any[]> {
    const project = await getProjectById(projectId);
    if (!project || !project.accessToken) return [];
    
    try {
        const response = await axios.get(`https://graph.facebook.com/${API_VERSION}/${catalogId}/products`, {
            params: {
                fields: 'id,name,description,price,currency,image_url,availability,retailer_id,inventory',
                access_token: project.accessToken,
                limit: 100
            }
        });

        if (response.data.error) {
            console.error("Error fetching products from catalog:", getErrorMessage({response}));
            return [];
        }

        return response.data.data;
    } catch (e) {
         console.error("Error fetching products from catalog:", getErrorMessage(e));
        return [];
    }
}


export async function addProductToCatalog(prevState: any, formData: FormData): Promise<{ message?: string; error?: string }> {
     const projectId = formData.get('projectId') as string;
     const catalogId = formData.get('catalogId') as string;
     
     const project = await getProjectById(projectId);
     if (!project || !project.accessToken) return { error: "Project not found or access token missing."};

    const productData = {
        retailer_id: formData.get('retailer_id') as string,
        name: formData.get('name') as string,
        description: formData.get('description') as string,
        price: Number(formData.get('price')) * 100, // Convert to cents
        currency: formData.get('currency') as string,
        image_url: formData.get('image_url') as string,
        availability: 'in_stock',
        condition: 'new'
    };
    
    try {
         const response = await axios.post(`https://graph.facebook.com/${API_VERSION}/${catalogId}/products`, {
            ...productData,
            access_token: project.accessToken
        });

        if (response.data.error) throw new Error(getErrorMessage({ response }));

        return { message: `Product "${productData.name}" added successfully.` };
    } catch(e: any) {
        console.error("Failed to add product to catalog:", e);
        return { error: getErrorMessage(e) };
    }
}

export async function updateProductInCatalog(prevState: any, formData: FormData): Promise<{ message?: string, error?: string }> {
    const projectId = formData.get('projectId') as string;
    const productId = formData.get('productId') as string;

    const project = await getProjectById(projectId);
    if (!project || !project.accessToken) return { error: "Project not found or access token missing." };

    const updateData: any = {};
    if (formData.get('name')) updateData.name = formData.get('name');
    if (formData.get('price')) updateData.price = Number(formData.get('price')) * 100;
    if (formData.get('inventory')) updateData.inventory = Number(formData.get('inventory'));
    if (formData.get('availability')) updateData.availability = formData.get('availability');

    try {
        const response = await axios.post(`https://graph.facebook.com/${API_VERSION}/${productId}`, {
            ...updateData,
            access_token: project.accessToken
        });
        if (response.data.error) throw new Error(getErrorMessage({ response }));
        return { message: "Product updated successfully." };
    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}


export async function deleteProductFromCatalog(productId: string, projectId: string): Promise<{ success: boolean, error?: string }> {
    const project = await getProjectById(projectId);
    if (!project || !project.accessToken) return { success: false, error: "Project not found or access token missing."};

    try {
        const response = await axios.delete(`https://graph.facebook.com/${API_VERSION}/${productId}`, {
            params: { access_token: project.accessToken }
        });

        if (response.data.error) throw new Error(getErrorMessage({ response }));
        
        revalidatePath('/dashboard/catalog');
        return { success: true };
    } catch(e) {
        return { success: false, error: getErrorMessage(e) };
    }
}

export async function getTaggedMediaForProduct(productId: string, projectId: string): Promise<{ media?: any[], error?: string }> {
    const project = await getProjectById(projectId);
    if (!project || !project.accessToken) return { error: "Project not found or access token missing."};
    
    try {
        const response = await axios.get(`https://graph.facebook.com/${API_VERSION}/${productId}/tagged_media`, {
            params: { access_token: project.accessToken }
        });
        if(response.data.error) throw new Error(getErrorMessage({response}));
        return { media: response.data.data };
    } catch (e) {
        return { error: getErrorMessage(e) };
    }
}

export async function listProductSets(catalogId: string, projectId: string): Promise<any[]> {
    const project = await getProjectById(projectId);
    if (!project || !project.accessToken) return [];

    try {
        const response = await axios.get(`https://graph.facebook.com/${API_VERSION}/${catalogId}/product_sets`, {
            params: {
                fields: 'id,name,product_count',
                access_token: project.accessToken,
            }
        });
        if (response.data.error) throw new Error(getErrorMessage({ response }));
        return response.data.data || [];
    } catch (e) {
        console.error("Error listing product sets:", getErrorMessage(e));
        return [];
    }
}

export async function createProductSet(prevState: any, formData: FormData) {
    const projectId = formData.get('projectId') as string;
    const catalogId = formData.get('catalogId') as string;
    const name = formData.get('name') as string;

    const project = await getProjectById(projectId);
    if (!project || !project.accessToken) return { error: "Project not found." };
    
    try {
        const response = await axios.post(`https://graph.facebook.com/${API_VERSION}/${catalogId}/product_sets`, {
            name: name,
            filter: { retailer_id: { is_any: [] } }, // Create an empty set
            access_token: project.accessToken,
        });

        if (response.data.error) throw new Error(getErrorMessage({ response }));
        
        return { message: 'Collection created successfully. You can add products in Commerce Manager.' };
    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}

export async function deleteProductSet(setId: string, projectId: string): Promise<{ success: boolean, error?: string }> {
     const project = await getProjectById(projectId);
    if (!project || !project.accessToken) return { success: false, error: "Project not found." };
    
    try {
        await axios.delete(`https://graph.facebook.com/${API_VERSION}/${setId}`, {
            params: { access_token: project.accessToken }
        });
        return { success: true };
    } catch(e: any) {
        return { success: false, error: getErrorMessage(e) };
    }
}

export async function connectCatalogToWaba(projectId: string, catalogId: string): Promise<{ success: boolean; message?: string, error?: string }> {
    const project = await getProjectById(projectId);
    if (!project || !project.wabaId) return { success: false, error: 'Project not found or is not a WABA project.' };
    
    try {
        const response = await axios.post(`https://graph.facebook.com/${API_VERSION}/${project.wabaId}/subscribed_apps`, {
            subscribed_fields: ['catalog_products_update'],
            access_token: project.accessToken
        });

        if (response.data.error) throw new Error(getErrorMessage({ response }));

        const { db } = await connectToDatabase();
        await db.collection('projects').updateOne(
            { _id: new ObjectId(projectId) },
            { $set: { connectedCatalogId: catalogId } }
        );

        revalidatePath('/dashboard/catalog');
        return { success: true, message: 'Catalog connected successfully.' };
    } catch (e: any) {
        return { success: false, error: getErrorMessage(e) };
    }
}
