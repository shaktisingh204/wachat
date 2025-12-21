
'use server';

import { revalidatePath } from 'next/cache';
import type { WithId } from 'mongodb';
import { ObjectId } from 'mongodb';
import axios from 'axios';

import { connectToDatabase } from '@/lib/mongodb';
import { getProjectById } from '@/app/actions/index.ts';
import { getErrorMessage } from '@/lib/utils';
import type { Project, Catalog, Product, ProductSet } from '@/lib/definitions';

const API_VERSION = 'v22.0';

export async function createCatalog(prevState: any, formData: FormData): Promise<{ message?: string; error?: string }> {
    const projectId = formData.get('projectId') as string;
    const catalogName = formData.get('catalogName') as string;

    const project = await getProjectById(projectId);
    if (!project || !project.accessToken) {
        return { error: 'Project not found or access token missing.' };
    }
    
    // **FIX**: Use businessId, not appId.
    const businessId = project.businessId;
    if (!businessId) {
        return { error: 'Project is not configured with a Business ID. Please ensure the business_management permission was granted.' };
    }

    try {
        const response = await axios.post(
            // **FIX**: Use correct endpoint with Business ID.
            `https://graph.facebook.com/${API_VERSION}/${businessId}/owned_product_catalogs`,
            {
                name: catalogName,
                access_token: project.accessToken,
            }
        );

        if (response.data.error) {
            throw new Error(getErrorMessage({ response }));
        }

        const newCatalogId = response.data.id;
        if (!newCatalogId) {
            throw new Error('Meta API did not return a catalog ID.');
        }

        const { db } = await connectToDatabase();
        const newCatalogEntry: Omit<Catalog, '_id'> = {
            projectId: new ObjectId(projectId),
            metaCatalogId: newCatalogId,
            name: catalogName,
            createdAt: new Date(),
        };
        await db.collection('catalogs').insertOne(newCatalogEntry as any);

        revalidatePath('/dashboard/catalog');
        revalidatePath('/dashboard/facebook/commerce/products');
        return { message: `Catalog "${catalogName}" created successfully!` };

    } catch (e: any) {
        console.error('Error creating catalog:', e);
        return { error: getErrorMessage(e) || 'An unexpected error occurred.' };
    }
}

export async function syncCatalogs(projectId: string): Promise<{ message?: string; error?: string }> {
    const project = await getProjectById(projectId);
    if (!project || !project.accessToken || !project.businessId) {
        return { error: 'Project not found, is missing a Business ID, or access token.' };
    }

    try {
        const response = await axios.get(`https://graph.facebook.com/${API_VERSION}/${project.businessId}/owned_product_catalogs`, {
            params: { access_token: project.accessToken, fields: 'id,name' }
        });
        
        const metaCatalogs = response.data.data;
        if (!metaCatalogs || metaCatalogs.length === 0) {
            return { message: 'No catalogs found in your Meta Business Account to sync.' };
        }

        const { db } = await connectToDatabase();
        const bulkOps = metaCatalogs.map((catalog: any) => ({
            updateOne: {
                filter: { metaCatalogId: catalog.id, projectId: new ObjectId(projectId) },
                update: { 
                    $set: { name: catalog.name },
                    $setOnInsert: {
                        metaCatalogId: catalog.id,
                        projectId: new ObjectId(projectId),
                        createdAt: new Date()
                    }
                },
                upsert: true,
            }
        }));

        if (bulkOps.length > 0) {
            await db.collection('catalogs').bulkWrite(bulkOps);
        }

        revalidatePath('/dashboard/catalog');
        revalidatePath('/dashboard/facebook/commerce/products');
        return { message: `Successfully synced ${metaCatalogs.length} catalog(s).` };

    } catch (e: any) {
        console.error('Catalog sync failed:', e);
        return { error: getErrorMessage(e) };
    }
}

export async function getCatalogs(projectId: string): Promise<WithId<Catalog>[]> {
    if (!projectId || !ObjectId.isValid(projectId)) return [];
    const hasAccess = await getProjectById(projectId);
    if (!hasAccess) return [];

    try {
        const { db } = await connectToDatabase();
        const catalogs = await db.collection<Catalog>('catalogs')
            .find({ projectId: new ObjectId(projectId) })
            .sort({ name: 1 })
            .toArray();
        return JSON.parse(JSON.stringify(catalogs));
    } catch (e) {
        return [];
    }
}

export async function connectCatalogToWaba(projectId: string, catalogId: string): Promise<{ success: boolean; message?: string; error?: string }> {
    const project = await getProjectById(projectId);
    if (!project || !project.wabaId || !project.accessToken) {
        return { success: false, error: 'Project not found or is not a valid WhatsApp project.' };
    }

    try {
        await axios.post(`https://graph.facebook.com/${API_VERSION}/${project.wabaId}/product_catalogs`, {
            access_token: project.accessToken,
            catalog_id: catalogId,
        });

        const { db } = await connectToDatabase();
        await db.collection('projects').updateOne(
            { _id: new ObjectId(projectId) },
            { $set: { connectedCatalogId: catalogId } }
        );
        
        revalidatePath('/dashboard/catalog');
        return { success: true, message: 'Catalog successfully connected to your WABA.' };

    } catch (e: any) {
        const errorMessage = getErrorMessage(e);
        // Handle cases where it's already connected, which Meta returns as an error
        if (errorMessage.toLowerCase().includes('already been connected')) {
            const { db } = await connectToDatabase();
            await db.collection('projects').updateOne({ _id: new ObjectId(projectId) }, { $set: { connectedCatalogId: catalogId } });
            return { success: true, message: 'Catalog is already connected.' };
        }
        console.error("Failed to connect catalog to WABA:", e);
        return { success: false, error: errorMessage };
    }
}

export async function getProductsForCatalog(catalogId: string, projectId: string): Promise<any[]> {
    const project = await getProjectById(projectId);
    if (!project || !project.accessToken) return [];

    try {
        const response = await axios.get(`https://graph.facebook.com/${API_VERSION}/${catalogId}/products`, {
            params: {
                access_token: project.accessToken,
                fields: 'id,name,description,price,currency,image_url,availability,retailer_id,inventory,condition,url'
            }
        });

        if (response.data.error) {
            throw new Error(getErrorMessage({ response }));
        }
        
        return response.data.data || [];
    } catch (e) {
        console.error("Failed to get products for catalog:", getErrorMessage(e));
        return [];
    }
}

export async function addProductToCatalog(prevState: any, formData: FormData): Promise<{ message?: string; error?: string }> {
    const projectId = formData.get('projectId') as string;
    const catalogId = formData.get('catalogId') as string;
    
    const project = await getProjectById(projectId);
    if (!project || !project.accessToken) {
        return { error: 'Project not found or access token missing.' };
    }
    
    const productData = {
        name: formData.get('name'),
        description: formData.get('description'),
        price: Number(formData.get('price')) * 100, // Price in cents
        currency: formData.get('currency'),
        retailer_id: formData.get('retailer_id'),
        image_url: formData.get('image_url'),
        availability: 'in_stock',
        condition: 'new'
    };
    
    try {
        const response = await axios.post(`https://graph.facebook.com/${API_VERSION}/${catalogId}/products`, {
            ...productData,
            access_token: project.accessToken,
        });

        if (response.data.error) throw new Error(getErrorMessage({response}));
        
        revalidatePath(`/dashboard/facebook/commerce/products/${catalogId}`);
        return { message: 'Product added successfully!' };
    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}

export async function updateProductInCatalog(prevState: any, formData: FormData): Promise<{ success: boolean; error?: string }> {
    const projectId = formData.get('projectId') as string;
    const productId = formData.get('productId') as string;

    const project = await getProjectById(projectId);
    if (!project || !project.accessToken) {
        return { success: false, error: 'Project not found or access token missing.' };
    }

    const updates: any = {};
    if (formData.has('name')) updates.name = formData.get('name');
    if (formData.has('price')) updates.price = Number(formData.get('price')) * 100;
    if (formData.has('inventory')) updates.inventory = Number(formData.get('inventory'));
    if (formData.has('availability')) updates.availability = formData.get('availability');
    
    try {
        const response = await axios.post(`https://graph.facebook.com/${API_VERSION}/${productId}`, {
            ...updates,
            access_token: project.accessToken,
        });
        if (response.data.error) throw new Error(getErrorMessage({response}));
        return { success: true };
    } catch (e: any) {
        return { success: false, error: getErrorMessage(e) };
    }
}

export async function deleteProductFromCatalog(productId: string, projectId: string): Promise<{ success: boolean; error?: string }> {
    const project = await getProjectById(projectId);
    if (!project || !project.accessToken) {
        return { success: false, error: 'Project not found or access token missing.' };
    }

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


export async function getTaggedMediaForProduct(productId: string, projectId: string): Promise<{ media?: any[]; error?: string }> {
    const project = await getProjectById(projectId);
    if (!project || !project.accessToken) {
        return { error: 'Project not found or access token missing.' };
    }

    try {
        const response = await axios.get(`https://graph.facebook.com/${API_VERSION}/${productId}/tagged_media`, {
            params: {
                access_token: project.accessToken,
                fields: 'id,media_type,media_url,permalink,caption,timestamp'
            }
        });

        if (response.data.error) throw new Error(getErrorMessage({response}));
        return { media: response.data.data };

    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}

export async function listProductSets(catalogId: string, projectId: string): Promise<ProductSet[]> {
    const project = await getProjectById(projectId);
    if (!project || !project.accessToken) return [];

    try {
        const response = await axios.get(`https://graph.facebook.com/${API_VERSION}/${catalogId}/product_sets`, {
            params: {
                access_token: project.accessToken,
                fields: 'id,name,product_count,filter'
            }
        });
        if (response.data.error) throw new Error(getErrorMessage({response}));
        return response.data.data || [];
    } catch (e) {
        console.error("Failed to list product sets:", getErrorMessage(e));
        return [];
    }
}

export async function createProductSet(prevState: any, formData: FormData): Promise<{ message?: string; error?: string }> {
     const projectId = formData.get('projectId') as string;
    const catalogId = formData.get('catalogId') as string;
    const name = formData.get('name') as string;

    const project = await getProjectById(projectId);
    if (!project || !project.accessToken) {
        return { error: 'Project not found or access token missing.' };
    }
    
    try {
        const response = await axios.post(`https://graph.facebook.com/${API_VERSION}/${catalogId}/product_sets`, {
            name: name,
            access_token: project.accessToken,
        });

        if (response.data.error) throw new Error(getErrorMessage({response}));
        revalidatePath(`/dashboard/facebook/commerce/products/${catalogId}`);
        return { message: `Collection "${name}" created successfully!` };
    } catch(e:any) {
        return { error: getErrorMessage(e) };
    }
}

export async function deleteProductSet(setId: string, projectId: string): Promise<{ success: boolean, error?: string }> {
    const project = await getProjectById(projectId);
    if (!project || !project.accessToken) {
        return { success: false, error: 'Project not found or access token missing.' };
    }
    
    try {
        const response = await axios.delete(`https://graph.facebook.com/${API_VERSION}/${setId}`, {
            params: { access_token: project.accessToken }
        });
        if (response.data.error) throw new Error(getErrorMessage({response}));
        return { success: true };
    } catch(e:any) {
        return { success: false, error: getErrorMessage(e) };
    }
}


