

'use server';

import { revalidatePath } from 'next/cache';
import type { WithId } from 'mongodb';
import { ObjectId } from 'mongodb';
import axios from 'axios';

import { connectToDatabase } from '@/lib/mongodb';
import { getProjectById } from '@/app/actions/index.ts';
import { getErrorMessage } from '@/lib/utils';
import type { Project, Catalog, ProductSet } from '@/lib/definitions';

const API_VERSION = 'v23.0';

export async function getCatalogs(projectId: string): Promise<WithId<Catalog>[]> {
    if (!projectId || !ObjectId.isValid(projectId)) return [];
    
    try {
        const { db } = await connectToDatabase();
        const catalogs = await db.collection('catalogs').find({ projectId: new ObjectId(projectId) }).toArray();
        return JSON.parse(JSON.stringify(catalogs));
    } catch (e) {
        console.error("Failed to fetch catalogs from DB:", getErrorMessage(e));
        return [];
    }
}

export async function syncCatalogs(projectId: string): Promise<{ message?: string; error?: string, count?: number }> {
    console.log(`[syncCatalogs] Starting sync for project ID: ${projectId}`);
    const project = await getProjectById(projectId);
    if (!project) {
        console.error(`[syncCatalogs] Project not found for ID: ${projectId}`);
        return { error: 'Project not found or you do not have access.' };
    }

    const accessToken = process.env.Meta_Admin_token || project.accessToken;

    if (!project.businessId || !accessToken) {
        console.error(`[syncCatalogs] Missing Business ID or Access Token for project: ${project.name}`);
        return { error: 'Project is not configured with a Meta Business ID or Access Token.' };
    }
    
    const endpoint = `https://graph.facebook.com/v24.0/${project.businessId}/owned_product_catalogs`;
    console.log(`[syncCatalogs] Calling Meta API: ${endpoint}`);

    try {
        const response = await axios.get(endpoint, {
            params: { access_token: accessToken }
        });
        
        console.log(`[syncCatalogs] Meta API response status: ${response.status}`);
        
        const catalogsFromMeta = response.data.data;
        if (!catalogsFromMeta || catalogsFromMeta.length === 0) {
            console.log('[syncCatalogs] No catalogs returned from Meta.');
            return { message: "No product catalogs found in your Meta Business Account to sync." };
        }
        
        console.log(`[syncCatalogs] Found ${catalogsFromMeta.length} catalog(s) from Meta.`);

        const { db } = await connectToDatabase();
        const bulkOps = catalogsFromMeta.map((catalog: any) => ({
            updateOne: {
                filter: { metaCatalogId: catalog.id, projectId: new ObjectId(projectId) },
                update: { 
                    $set: { name: catalog.name },
                    $setOnInsert: {
                        metaCatalogId: catalog.id,
                        projectId: new ObjectId(projectId),
                        createdAt: new Date(),
                    }
                },
                upsert: true,
            }
        }));

        const result = await db.collection('catalogs').bulkWrite(bulkOps);
        const syncedCount = result.upsertedCount + result.modifiedCount;

        // After syncing, update the project with the list of catalog IDs
        const projectCatalogs = await db.collection('catalogs').find({ projectId: new ObjectId(projectId) }).project({ _id: 1 }).toArray();
        await db.collection('projects').updateOne(
            { _id: new ObjectId(projectId) },
            { $set: { catalogs: projectCatalogs.map(c => c._id) } }
        );
        console.log(`[syncCatalogs] Updated project document with ${projectCatalogs.length} catalog references.`);
        
        revalidatePath('/dashboard/catalog');
        
        return { message: `Successfully synced ${syncedCount} catalog(s).`, count: syncedCount };

    } catch (e: any) {
        const errorMessage = getErrorMessage(e);
        console.error('Catalog sync failed:', errorMessage);
        return { error: `An unexpected error occurred during catalog sync: ${errorMessage}` };
    }
}

export async function createCatalog(prevState: any, formData: FormData): Promise<{ message?: string; error?: string }> {
    const projectId = formData.get('projectId') as string;
    const catalogName = formData.get('catalogName') as string;

    const project = await getProjectById(projectId);
    if (!project) return { error: "Project not found or access denied."};

    if (!project.businessId) return { error: "Project is not linked to a Meta Business account." };

    const accessToken = process.env.Meta_Admin_token || project.accessToken;

    try {
        const response = await axios.post(`https://graph.facebook.com/v24.0/${project.businessId}/owned_product_catalogs`, {
            name: catalogName,
            access_token: accessToken,
        });

        if (response.data.error) throw new Error(response.data.error.message);
        
        const newCatalogId = response.data.id;

        const { db } = await connectToDatabase();
        await db.collection('catalogs').insertOne({
            projectId: new ObjectId(projectId),
            metaCatalogId: newCatalogId,
            name: catalogName,
            createdAt: new Date()
        });
        
        revalidatePath('/dashboard/catalog');
        return { message: `Catalog "${catalogName}" created successfully!`};
    } catch (e) {
        return { error: getErrorMessage(e) };
    }
}

export async function connectCatalogToWaba(catalogId: string, projectId: string): Promise<{ success: boolean; error?: string }> {
    const project = await getProjectById(projectId);
    if (!project || !project.wabaId) return { success: false, error: "Project not found or it is not a WhatsApp project."};

    const accessToken = process.env.Meta_Admin_token || project.accessToken;

    try {
        const response = await axios.post(`https://graph.facebook.com/v24.0/${project.wabaId}/subscribed_apps`,
        {
            subscribed_fields: ['product_catalog'],
            access_token: accessToken
        });

        if (response.data.error) throw new Error(response.data.error.message);

        const { db } = await connectToDatabase();
        await db.collection('projects').updateOne(
            { _id: new ObjectId(projectId) },
            { $set: { connectedCatalogId: catalogId } }
        );
        revalidatePath('/dashboard/catalog');
        return { success: true };
    } catch(e) {
        return { success: false, error: getErrorMessage(e) };
    }
}

export async function disconnectCatalogFromWaba(projectId: string): Promise<{ success: boolean; error?: string }> {
    const project = await getProjectById(projectId);
    if (!project) return { success: false, error: "Project not found." };
    
    try {
        const { db } = await connectToDatabase();
        await db.collection('projects').updateOne(
            { _id: new ObjectId(projectId) },
            { $unset: { connectedCatalogId: "" } }
        );
        revalidatePath('/dashboard/catalog');
        return { success: true };
    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
    }
}

export async function getProductsForCatalog(catalogId: string, projectId: string): Promise<any[]> {
    console.log(`[getProductsForCatalog] Fetching products for catalog ID: ${catalogId}`);
    const project = await getProjectById(projectId);
    if (!project) {
        console.error(`[getProductsForCatalog] Project not found for ID: ${projectId}`);
        return [];
    }

    const accessToken = process.env.Meta_Admin_token || project.accessToken;
    
    const endpoint = `https://graph.facebook.com/v22.0/${catalogId}/products`;
    const fields = 'id,name,description,category,product_type,image_url,price,currency,retailer_id,inventory,availability,condition,url';
    console.log(`[getProductsForCatalog] Calling Meta API: ${endpoint} with fields: ${fields}`);

    try {
        const response = await axios.get(endpoint, {
            params: {
                access_token: accessToken,
                fields: fields,
                limit: 100 // Fetch up to 100 products
            }
        });
        
        console.log(`[getProductsForCatalog] Meta API response status: ${response.status}`);
        
        if (response.data.error) {
            throw new Error(`Meta API Error: ${response.data.error.message}`);
        }
        
        const products = response.data.data || [];
        console.log(`[getProductsForCatalog] Found ${products.length} product(s).`);
        return products;
    } catch (e) {
        console.error(`[getProductsForCatalog] Failed to fetch products for catalog ${catalogId}:`, getErrorMessage(e));
        return [];
    }
}


export async function addProductToCatalog(prevState: any, formData: FormData) {
    const projectId = formData.get('projectId') as string;
    const catalogId = formData.get('catalogId') as string;
    const productData = {
        name: formData.get('name') as string,
        retailer_id: formData.get('retailer_id') as string,
        price: Number(formData.get('price')) * 100, // Convert to cents
        currency: formData.get('currency') as string,
        description: formData.get('description') as string,
        image_url: formData.get('image_url') as string,
        availability: 'in_stock', // Default
        condition: 'new' // Default
    };

    const project = await getProjectById(projectId);
    if (!project) return { error: "Project not found or access denied." };

    const accessToken = process.env.Meta_Admin_token || project.accessToken;

    try {
        const response = await axios.post(`https://graph.facebook.com/v24.0/${catalogId}/products`, {
            ...productData,
            access_token: accessToken,
        });

        if (response.data.error) throw new Error(response.data.error.message);
        
        return { message: 'Product added successfully!' };
    } catch(e) {
        return { error: getErrorMessage(e) };
    }
}

export async function updateProductInCatalog(prevState: any, formData: FormData) {
     const projectId = formData.get('projectId') as string;
     const productId = formData.get('productId') as string;
     const updateData = {
        name: formData.get('name') as string,
        description: formData.get('description') as string,
        price: Number(formData.get('price')) * 100,
        inventory: Number(formData.get('inventory')),
        availability: formData.get('availability') as string,
    };

    const project = await getProjectById(projectId);
    if (!project) return { error: "Project not found or access denied." };

    const accessToken = process.env.Meta_Admin_token || project.accessToken;

    try {
        const response = await axios.post(`https://graph.facebook.com/v24.0/${productId}`, {
            ...updateData,
            access_token: accessToken,
        });

        if (response.data.error) throw new Error(response.data.error.message);
        
        return { message: 'Product updated successfully!' };
    } catch(e) {
        return { error: getErrorMessage(e) };
    }
}

export async function deleteProductFromCatalog(productId: string, projectId: string): Promise<{ success: boolean; error?: string }> {
     const project = await getProjectById(projectId);
    if (!project) return { success: false, error: "Project not found or access denied." };
    const accessToken = process.env.Meta_Admin_token || project.accessToken;
    
    try {
        await axios.delete(`https://graph.facebook.com/v24.0/${productId}`, {
            params: { access_token: accessToken }
        });
        return { success: true };
    } catch(e) {
        return { success: false, error: getErrorMessage(e) };
    }
}

export async function listProductSets(catalogId: string, projectId: string): Promise<ProductSet[]> {
    const project = await getProjectById(projectId);
    if (!project) return [];
    const accessToken = process.env.Meta_Admin_token || project.accessToken;

    try {
        const response = await axios.get(`https://graph.facebook.com/v24.0/${catalogId}/product_sets`, {
            params: { access_token: accessToken, fields: 'id,name,product_count' }
        });
        if (response.data.error) throw new Error(response.data.error.message);
        return response.data.data || [];
    } catch (e) {
        console.error("Failed to list product sets:", getErrorMessage(e));
        return [];
    }
}

export async function createProductSet(prevState: any, formData: FormData) {
    const projectId = formData.get('projectId') as string;
    const catalogId = formData.get('catalogId') as string;
    const name = formData.get('name') as string;

    const project = await getProjectById(projectId);
    if (!project) return { error: "Project not found." };
    const accessToken = process.env.Meta_Admin_token || project.accessToken;

    try {
        await axios.post(`https://graph.facebook.com/v24.0/${catalogId}/product_sets`, {
            name: name,
            filter: { retailer_id: { is_any: [] } }, // Create an empty set
            access_token: accessToken
        });
        return { message: 'Collection created successfully.' };
    } catch(e) {
        return { error: getErrorMessage(e) };
    }
}

export async function deleteProductSet(setId: string, projectId: string): Promise<{ success: boolean; error?: string }> {
     const project = await getProjectById(projectId);
    if (!project) return { success: false, error: "Project not found." };
    const accessToken = process.env.Meta_Admin_token || project.accessToken;
    
    try {
        await axios.delete(`https://graph.facebook.com/v24.0/${setId}`, {
            params: { access_token: accessToken }
        });
        return { success: true };
    } catch(e) {
        return { success: false, error: getErrorMessage(e) };
    }
}

export async function getTaggedMediaForProduct(
  productId: string,
  projectId: string
): Promise<{ media?: any[]; error?: string }> {
  const project = await getProjectById(projectId);
  if (!project) {
    return { error: 'Project not found or access denied.' };
  }

  const accessToken = process.env.Meta_Admin_token || project.accessToken;
  if (!accessToken) {
    return { error: 'Access token is missing for this project.' };
  }

  try {
    const response = await axios.get(
      `https://graph.facebook.com/v23.0/${productId}/tagged_media`,
      {
        params: {
          access_token: accessToken,
          fields: 'id,media_type,media_url,permalink,thumbnail_url,timestamp,caption,username'
        },
      }
    );

    if (response.data.error) {
      throw new Error(getErrorMessage({ response }));
    }

    return { media: response.data.data };
  } catch (e) {
    return { error: getErrorMessage(e) };
  }
}

