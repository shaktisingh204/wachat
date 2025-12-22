
'use server';

import { revalidatePath } from 'next/cache';
import { type Db, ObjectId, type WithId } from 'mongodb';
import axios from 'axios';

import { connectToDatabase } from '@/lib/mongodb';
import { getProjectById } from '@/app/actions/user.actions';
import { getErrorMessage } from '@/lib/utils';
import type { Catalog, EcommProduct, Project } from '@/lib/definitions';

const API_VERSION = 'v23.0';

export async function syncCatalogs(projectId: string): Promise<{ message?: string; error?: string, count?: number }> {
    const project = await getProjectById(projectId);
    if (!project) return { error: 'Project not found or you do not have access.' };
    
    if (!project.wabaId) {
        return { error: 'Project is not a WhatsApp project and cannot have catalogs.' };
    }

    try {
        const { db } = await connectToDatabase();
        
        const { wabaId, accessToken } = project;
        
        const response = await axios.get(`https://graph.facebook.com/v24.0/${wabaId}/product_catalogs`, {
            params: { access_token: accessToken }
        });
        
        if (response.data.error) throw new Error(getErrorMessage({ response }));
        
        const catalogsFromMeta = response.data.data;
        if (!catalogsFromMeta || catalogsFromMeta.length === 0) {
            return { message: "No product catalogs found for this business account." };
        }

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

        if (bulkOps.length > 0) {
            const result = await db.collection('catalogs').bulkWrite(bulkOps);
            const syncedCount = result.upsertedCount + result.modifiedCount;
            return { message: `Successfully synced ${syncedCount} catalog(s).`, count: syncedCount };
        }
        
        return { message: "Catalogs are up to date." };

    } catch (e: any) {
        console.error('Catalog sync failed:', e);
        return { error: getErrorMessage(e) || 'An unexpected error occurred during catalog sync.' };
    }
}

export async function getCatalogs(projectId: string): Promise<WithId<Catalog>[]> {
    if (!projectId) return [];
    const hasAccess = await getProjectById(projectId);
    if (!hasAccess) return [];

    try {
        const { db } = await connectToDatabase();
        const catalogs = await db.collection('catalogs').find({ projectId: new ObjectId(projectId) }).sort({ createdAt: -1 }).toArray();
        return JSON.parse(JSON.stringify(catalogs));
    } catch (e) {
        console.error("Failed to get catalogs:", e);
        return [];
    }
}

export async function connectCatalogToWaba(projectId: string, catalogId: string): Promise<{ success: boolean; error?: string; }> {
    const project = await getProjectById(projectId);
    if (!project || !project.wabaId || !project.accessToken) return { success: false, error: 'Project not found or invalid.' };
    try {
        const { db } = await connectToDatabase();
        await db.collection('projects').updateOne({ _id: project._id }, { $set: { connectedCatalogId: catalogId } });

        const response = await axios.post(`https://graph.facebook.com/${API_VERSION}/${project.wabaId}/subscribed_apps`,
            { subscribed_fields: ['product_catalog'] },
            { params: { access_token: project.accessToken } }
        );

        if (response.data.error) throw new Error(getErrorMessage({ response }));

        revalidatePath('/dashboard/catalog');
        return { success: true };
    } catch (e: any) {
        return { success: false, error: getErrorMessage(e) };
    }
}

export async function createCatalog(prevState: any, formData: FormData): Promise<{ message?: string; error?: string; }> {
     const projectId = formData.get('projectId') as string;
     const catalogName = formData.get('catalogName') as string;

     const project = await getProjectById(projectId);
     if (!project || !project.businessId || !project.accessToken) return { error: "Project not configured for catalog management." };

     try {
        const response = await axios.post(`https://graph.facebook.com/${API_VERSION}/${project.businessId}/owned_product_catalogs`, {
            name: catalogName,
            access_token: project.accessToken,
        });

        if (response.data.error) throw new Error(getErrorMessage({response}));
        
        await syncCatalogs(projectId);
        
        return { message: `Catalog "${catalogName}" created successfully!` };
     } catch (e: any) {
        return { error: getErrorMessage(e) };
     }
}

export async function getProductsForCatalog(catalogId: string, projectId: string) {
    const project = await getProjectById(projectId);
    if (!project || !project.accessToken) return [];

    try {
        const response = await axios.get(`https://graph.facebook.com/v22.0/${catalogId}/products`, {
            params: {
                fields: 'id,name,description,category,product_type,image_url,price,currency,availability,retailer_id,inventory,condition',
                access_token: project.accessToken,
                limit: 200,
            }
        });
        if (response.data.error) throw new Error(getErrorMessage({response}));
        return response.data.data;
    } catch (e: any) {
        console.error(`Failed to get products for catalog ${catalogId}:`, getErrorMessage(e));
        return [];
    }
}

export async function addProductToCatalog(prevState: any, formData: FormData) {
     const projectId = formData.get('projectId') as string;
     const catalogId = formData.get('catalogId') as string;

     const productData = {
        name: formData.get('name') as string,
        price: (parseFloat(formData.get('price') as string) * 100).toString(),
        currency: formData.get('currency') as string,
        retailer_id: formData.get('retailer_id') as string,
        image_url: formData.get('image_url') as string,
        description: formData.get('description') as string,
        availability: 'in_stock',
        condition: 'new'
     };

     const project = await getProjectById(projectId);
     if (!project || !project.accessToken) return { error: 'Project not configured.' };

     try {
        const response = await axios.post(`https://graph.facebook.com/${API_VERSION}/${catalogId}/products`, {
            ...productData,
            access_token: project.accessToken
        });
        if (response.data.error) throw new Error(getErrorMessage({response}));
        revalidatePath(`/dashboard/catalog/${catalogId}`);
        return { message: 'Product added successfully!' };
     } catch(e: any) {
        return { error: getErrorMessage(e) };
     }
}

export async function updateProductInCatalog(prevState: any, formData: FormData) {
    const projectId = formData.get('projectId') as string;
    const productId = formData.get('productId') as string;
    const project = await getProjectById(projectId);
    if (!project || !project.accessToken) return { error: 'Project not configured.' };

    const updateData: any = {};
    if(formData.get('name')) updateData.name = formData.get('name') as string;
    if(formData.get('price')) updateData.price = (parseFloat(formData.get('price') as string) * 100).toString();
    if(formData.get('inventory')) updateData.inventory = parseInt(formData.get('inventory') as string, 10);
    if(formData.get('availability')) updateData.availability = formData.get('availability') as string;

     try {
        const response = await axios.post(`https://graph.facebook.com/${API_VERSION}/${productId}`, {
            ...updateData,
            access_token: project.accessToken
        });
        if (response.data.error) throw new Error(getErrorMessage({response}));
        return { message: 'Product updated successfully!' };
     } catch(e: any) {
        return { error: getErrorMessage(e) };
     }
}


export async function deleteProductFromCatalog(productId: string, projectId: string) {
     const project = await getProjectById(projectId);
     if (!project || !project.accessToken) return { success: false, error: 'Project not configured.' };

     try {
        const response = await axios.delete(`https://graph.facebook.com/${API_VERSION}/${productId}`, {
            params: { access_token: project.accessToken }
        });
        if (response.data.error) throw new Error(getErrorMessage({response}));
        return { success: true };
     } catch (e: any) {
        return { success: false, error: getErrorMessage(e) };
     }
}

export async function listProductSets(catalogId: string, projectId: string) {
    const project = await getProjectById(projectId);
    if (!project || !project.accessToken) return [];

    try {
        const response = await axios.get(`https://graph.facebook.com/${API_VERSION}/${catalogId}/product_sets`, {
            params: { access_token: project.accessToken, fields: 'id,name,product_count' }
        });
        if (response.data.error) throw new Error(getErrorMessage({response}));
        return response.data.data;
    } catch(e) {
        console.error("Failed to list product sets:", getErrorMessage(e));
        return [];
    }
}

export async function createProductSet(prevState: any, formData: FormData) {
    const projectId = formData.get('projectId') as string;
    const catalogId = formData.get('catalogId') as string;
    const name = formData.get('name') as string;
    const project = await getProjectById(projectId);
    if (!project || !project.accessToken) return { error: "Project configuration error."};
    
    try {
        const response = await axios.post(`https://graph.facebook.com/${API_VERSION}/${catalogId}/product_sets`, {
            name: name,
            filter: { 'retailer_id': { 'is_any': [] } }, // Create an empty set
            access_token: project.accessToken,
        });
        if (response.data.error) throw new Error(getErrorMessage({response}));
        return { message: 'Collection created successfully.' };
    } catch(e) {
        return { error: getErrorMessage(e) };
    }
}

export async function deleteProductSet(setId: string, projectId: string) {
     const project = await getProjectById(projectId);
     if (!project || !project.accessToken) return { success: false, error: 'Project not configured.' };

     try {
        const response = await axios.delete(`https://graph.facebook.com/${API_VERSION}/${setId}`, {
            params: { access_token: project.accessToken }
        });
        if (response.data.error) throw new Error(getErrorMessage({response}));
        return { success: true };
     } catch (e: any) {
        return { success: false, error: getErrorMessage(e) };
     }
}

export async function getTaggedMediaForProduct(productId: string, projectId: string) {
    const project = await getProjectById(projectId);
    if (!project || !project.accessToken) return { error: "Project not configured" };

    try {
        const response = await axios.get(`https://graph.facebook.com/${API_VERSION}/${productId}/tagged_in_media`, {
            params: { access_token: project.accessToken, fields: 'id,media_type,media_url,permalink,thumbnail_url,timestamp' }
        });
         if (response.data.error) throw new Error(getErrorMessage({response}));
        return { media: response.data.data };
    } catch(e) {
        return { error: getErrorMessage(e) };
    }
}

