

'use server';

import { revalidatePath } from 'next/cache';
import { getProjectById } from '@/app/actions/index.ts';
import { getErrorMessage } from '@/lib/utils';
import { connectToDatabase } from '@/lib/mongodb';
import type { WithId, Project, Catalog, ProductSet } from '@/lib/definitions';
import { ObjectId } from 'mongodb';
import axios from 'axios';

const API_VERSION = 'v22.0';

export async function getCatalogs(projectId: string): Promise<WithId<Catalog>[]> {
    if (!projectId || !ObjectId.isValid(projectId)) return [];
    try {
        const { db } = await connectToDatabase();
        const catalogs = await db.collection('catalogs').find({ projectId: new ObjectId(projectId) }).toArray();
        return JSON.parse(JSON.stringify(catalogs));
    } catch (e) {
        console.error("Failed to get catalogs:", e);
        return [];
    }
}

export async function syncCatalogs(projectId: string): Promise<{ message?: string; error?: string, count?: number }> {
    const project = await getProjectById(projectId);
    if (!project || !project.businessId || !project.accessToken) {
        return { error: 'Project not configured for catalog management. Business ID or Access Token is missing.' };
    }

    try {
        const response = await axios.get(`https://graph.facebook.com/${API_VERSION}/${project.businessId}/owned_product_catalogs`, {
            params: {
                access_token: project.accessToken,
                fields: 'id,name'
            }
        });

        if (response.data.error) {
            throw new Error(getErrorMessage({ response }));
        }
        
        const metaCatalogs = response.data.data;
        if (!metaCatalogs || metaCatalogs.length === 0) {
            return { message: "No product catalogs found in your Meta Business account." };
        }
        
        const { db } = await connectToDatabase();
        const bulkOps = metaCatalogs.map((catalog: any) => ({
            updateOne: {
                filter: { metaCatalogId: catalog.id, projectId: new ObjectId(projectId) },
                update: {
                    $setOnInsert: {
                        projectId: new ObjectId(projectId),
                        metaCatalogId: catalog.id,
                        name: catalog.name,
                        createdAt: new Date()
                    }
                },
                upsert: true
            }
        }));

        const result = await db.collection('catalogs').bulkWrite(bulkOps);
        const syncedCount = result.upsertedCount;

        revalidatePath('/dashboard/catalog');
        return { message: `Successfully synced ${syncedCount} new catalog(s).`, count: syncedCount };
        
    } catch (e: any) {
        console.error("Catalog sync error:", getErrorMessage(e));
        return { error: getErrorMessage(e) };
    }
}


export async function getProductsForCatalog(catalogId: string, projectId: string) {
    if (!catalogId || !projectId) return [];

    const project = await getProjectById(projectId);
    if (!project || !project.accessToken) {
        console.error("Project not found or access token missing");
        return [];
    }

    try {
        const response = await axios.get(`https://graph.facebook.com/${API_VERSION}/${catalogId}/products`, {
            params: {
                access_token: project.accessToken,
                fields: 'id,name,description,category,product_type,image_url,price,currency,retailer_id,inventory,availability'
            }
        });
        if (response.data.error) {
            console.error("Error fetching products from Meta:", response.data.error);
            return [];
        }
        return response.data.data || [];
    } catch (e) {
        console.error("Failed to fetch products for catalog:", e);
        return [];
    }
}

export async function addProductToCatalog(prevState: any, formData: FormData) {
    const projectId = formData.get('projectId') as string;
    const catalogId = formData.get('catalogId') as string;
    const name = formData.get('name') as string;
    const retailer_id = formData.get('retailer_id') as string;
    const price = Number(formData.get('price')) * 100;
    const currency = formData.get('currency') as string;
    const description = formData.get('description') as string;
    const image_url = formData.get('image_url') as string;

    const project = await getProjectById(projectId);
    if (!project || !project.accessToken) {
        return { error: "Project not configured." };
    }

    try {
        const payload = {
            name,
            retailer_id,
            price,
            currency,
            description,
            image_url,
            availability: 'in_stock'
        };

        const response = await axios.post(`https://graph.facebook.com/${API_VERSION}/${catalogId}/products`, payload, {
             params: { access_token: project.accessToken }
        });
        
        if (response.data.error) {
            throw new Error(getErrorMessage({ response }));
        }

        revalidatePath(`/dashboard/catalog/${catalogId}`);
        return { message: 'Product added successfully!' };

    } catch (e) {
        return { error: getErrorMessage(e) };
    }
}

export async function updateProductInCatalog(prevState: any, formData: FormData) {
    const projectId = formData.get('projectId') as string;
    const productId = formData.get('productId') as string;
    
    const project = await getProjectById(projectId);
    if (!project || !project.accessToken) {
        return { error: "Project not configured." };
    }

    try {
        const payload: any = {
            name: formData.get('name'),
            price: Number(formData.get('price')) * 100,
            inventory: Number(formData.get('inventory')),
            availability: formData.get('availability'),
        };

        const response = await axios.post(`https://graph.facebook.com/${API_VERSION}/${productId}`, payload, {
             params: { access_token: project.accessToken }
        });
        
        if (response.data.error) {
            throw new Error(getErrorMessage({ response }));
        }
        
        revalidatePath(`/dashboard/catalog/`); // Revalidate parent page
        return { message: 'Product updated successfully!' };

    } catch (e) {
        return { error: getErrorMessage(e) };
    }
}


export async function deleteProductFromCatalog(productId: string, projectId: string) {
    if (!productId || !projectId) return { success: false, error: 'Missing required IDs.'};
    
    const project = await getProjectById(projectId);
    if (!project || !project.accessToken) {
        return { success: false, error: "Project not configured." };
    }
    
    try {
        const response = await axios.delete(`https://graph.facebook.com/${API_VERSION}/${productId}`, {
            params: { access_token: project.accessToken }
        });
        
         if (response.data.error) {
            throw new Error(getErrorMessage({ response }));
        }
        
        revalidatePath('/dashboard/catalog');
        return { success: true };
    } catch(e) {
        return { success: false, error: getErrorMessage(e) };
    }
}

export async function connectCatalogToWaba(projectId: string, catalogId: string): Promise<{ message?: string; error?: string }> {
     const project = await getProjectById(projectId);
    if (!project || !project.accessToken || !project.wabaId) {
        return { error: "Project not configured for WABA." };
    }
    
    try {
        const response = await axios.post(`https://graph.facebook.com/${API_VERSION}/${project.wabaId}/subscribed_apps`,
        {
          'subscribed_fields': ['product_catalog']
        },
        {
            params: { access_token: project.accessToken }
        });
        
        if (response.data.error) {
            throw new Error(getErrorMessage({ response }));
        }

        const { db } = await connectToDatabase();
        await db.collection('projects').updateOne(
            { _id: new ObjectId(projectId) },
            { $set: { connectedCatalogId: catalogId } }
        );
        
        revalidatePath('/dashboard/catalog');
        return { message: 'Catalog connected successfully!' };

    } catch(e) {
         return { error: getErrorMessage(e) };
    }
}


export async function getTaggedMediaForProduct(productId: string, projectId: string) {
    const project = await getProjectById(projectId);
    if (!project || !project.accessToken) {
        return { error: "Project not found or access token missing." };
    }
    
    try {
         const response = await axios.get(`https://graph.facebook.com/${API_VERSION}/${productId}/tagged_media`, {
            params: { 
                access_token: project.accessToken,
                fields: 'id,media_type,media_url,permalink,shortcode,thumbnail_url,timestamp,username,caption'
            }
        });
        
        if (response.data.error) {
            throw new Error(getErrorMessage({ response }));
        }
        
        return { media: response.data.data };

    } catch(e) {
        return { error: getErrorMessage(e) };
    }
}


export async function listProductSets(catalogId: string, projectId: string): Promise<ProductSet[]> {
    if (!catalogId || !projectId) return [];
    
    const project = await getProjectById(projectId);
    if (!project || !project.accessToken) {
        console.error("Project not found or access token missing");
        return [];
    }
    
    try {
        const response = await axios.get(`https://graph.facebook.com/${API_VERSION}/${catalogId}/product_sets`, {
            params: { access_token: project.accessToken, fields: 'id,name,product_count' }
        });
        if (response.data.error) {
            console.error("Error fetching product sets from Meta:", response.data.error);
            return [];
        }
        return response.data.data || [];
    } catch (e) {
        console.error("Failed to fetch product sets:", e);
        return [];
    }
}

export async function createProductSet(prevState: any, formData: FormData): Promise<{ message?: string, error?: string }> {
    const projectId = formData.get('projectId') as string;
    const catalogId = formData.get('catalogId') as string;
    const name = formData.get('name') as string;

    const project = await getProjectById(projectId);
    if (!project || !project.accessToken) {
        return { error: "Project not configured." };
    }

    try {
        const response = await axios.post(`https://graph.facebook.com/${API_VERSION}/${catalogId}/product_sets`, {
            name: name,
            filter: { retailer_id: { is_any: [] } } // Create an empty set
        }, {
            params: { access_token: project.accessToken }
        });
        
        if (response.data.error) throw new Error(getErrorMessage({response}));

        revalidatePath(`/dashboard/catalog/${catalogId}`);
        return { message: 'Collection created successfully!' };
    } catch (e) {
        return { error: getErrorMessage(e) };
    }
}

export async function deleteProductSet(setId: string, projectId: string): Promise<{ success: boolean, error?: string }> {
    const project = await getProjectById(projectId);
    if (!project || !project.accessToken) {
        return { success: false, error: "Project not configured." };
    }

    try {
        const response = await axios.delete(`https://graph.facebook.com/${API_VERSION}/${setId}`, {
            params: { access_token: project.accessToken }
        });
        if (response.data.error) throw new Error(getErrorMessage({response}));
        return { success: true };
    } catch(e) {
        return { success: false, error: getErrorMessage(e) };
    }
}

