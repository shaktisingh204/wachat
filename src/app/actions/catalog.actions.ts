
'use server';

import { revalidatePath } from 'next/cache';
import { ObjectId, type WithId } from 'mongodb';
import axios from 'axios';

import { connectToDatabase } from '@/lib/mongodb';
import { getProjectById } from '@/app/actions/index.ts';
import { getErrorMessage } from '@/lib/utils';
import type { Catalog, Product, ProductSet } from '@/lib/definitions';

const API_VERSION = 'v24.0';

export async function syncCatalogs(projectId: string): Promise<{ message?: string; error?: string }> {
  const project = await getProjectById(projectId);
  if (!project || !project.wabaId) {
    return { error: 'Project or WABA ID not found.' };
  }

  const token = process.env.Meta_Admin_token || project.accessToken;
  const url = `https://graph.facebook.com/${API_VERSION}/${project.wabaId}/product_catalogs`;
  console.log(`[syncCatalogs] Calling API: ${url}`);
  
  try {
    const response = await axios.get(url, { params: { access_token: token } });
    console.log(`[syncCatalogs] API Response Status: ${response.status}`);
    console.log(`[syncCatalogs] API Response Data:`, response.data);


    if (response.data.error) {
      throw new Error(response.data.error.message);
    }
    
    const catalogs = response.data.data;
    if (!catalogs || catalogs.length === 0) {
      return { message: 'No product catalogs found for this business account.' };
    }

    const { db } = await connectToDatabase();
    const bulkOps = catalogs.map((catalog: any) => ({
      updateOne: {
        filter: { metaCatalogId: catalog.id, projectId: new ObjectId(projectId) },
        update: {
          $setOnInsert: {
            projectId: new ObjectId(projectId),
            metaCatalogId: catalog.id,
            name: catalog.name,
            createdAt: new Date(),
          },
        },
        upsert: true,
      },
    }));

    const result = await db.collection('catalogs').bulkWrite(bulkOps);
    return { message: `Successfully synced ${result.upsertedCount} new catalog(s).` };
  } catch (e: any) {
    console.error('[syncCatalogs] Error:', getErrorMessage(e));
    return { error: getErrorMessage(e) };
  }
}

export async function getCatalogs(projectId: string): Promise<WithId<Catalog>[]> {
  if (!projectId) return [];
  try {
    const { db } = await connectToDatabase();
    const catalogs = await db.collection('catalogs').find({ projectId: new ObjectId(projectId) }).toArray();
    return JSON.parse(JSON.stringify(catalogs));
  } catch (e) {
    return [];
  }
}

export async function getProductsForCatalog(catalogId: string, projectId: string): Promise<any[]> {
    const project = await getProjectById(projectId);
    if (!project) return [];

    const token = process.env.Meta_Admin_token || project.accessToken;
    const url = `https://graph.facebook.com/v22.0/${catalogId}/products`;
    const params = {
      access_token: token,
      fields: 'id,name,description,category,product_type,image_url,price,currency,retailer_id,inventory,availability'
    };

    console.log(`[getProductsForCatalog] Calling API: ${url}`);
    
    try {
        const response = await axios.get(url, { params });
        console.log(`[getProductsForCatalog] API Response Status: ${response.status}`);
        console.log(`[getProductsForCatalog] API Response Data:`, response.data);

        return response.data.data || [];
    } catch(e) {
        console.error('[getProductsForCatalog] Error:', getErrorMessage(e));
        return [];
    }
}

export async function createCatalog(prevState: any, formData: FormData): Promise<{ message?: string; error?: string }> {
    const projectId = formData.get('projectId') as string;
    const catalogName = formData.get('catalogName') as string;

    const project = await getProjectById(projectId);
    if (!project || !project.businessId) {
        return { error: 'Project not found or business ID is not configured.' };
    }

    const token = process.env.Meta_Admin_token || project.accessToken;

    try {
        const response = await axios.post(`https://graph.facebook.com/${API_VERSION}/${project.businessId}/owned_product_catalogs`, {
            name: catalogName,
            access_token: token
        });

        if (response.data.error) throw new Error(response.data.error.message);

        const { db } = await connectToDatabase();
        await db.collection('catalogs').insertOne({
            projectId: new ObjectId(projectId),
            metaCatalogId: response.data.id,
            name: catalogName,
            createdAt: new Date()
        });

        return { message: `Catalog "${catalogName}" created successfully!` };
    } catch(e) {
        return { error: getErrorMessage(e) };
    }
}

export async function deleteProductFromCatalog(productId: string, projectId: string): Promise<{ success: boolean; error?: string }> {
    const project = await getProjectById(projectId);
    if (!project) return { success: false, error: 'Project not found.' };

    const token = process.env.Meta_Admin_token || project.accessToken;

    try {
        await axios.delete(`https://graph.facebook.com/${API_VERSION}/${productId}`, {
            params: { access_token: token }
        });
        return { success: true };
    } catch(e) {
        return { success: false, error: getErrorMessage(e) };
    }
}

export async function addProductToCatalog(prevState: any, formData: FormData): Promise<{ message?: string; error?: string }> {
    const projectId = formData.get('projectId') as string;
    const catalogId = formData.get('catalogId') as string;

    const project = await getProjectById(projectId);
    if (!project) return { error: 'Project not found.' };

    const token = process.env.Meta_Admin_token || project.accessToken;

    try {
        const payload = {
            name: formData.get('name'),
            description: formData.get('description'),
            price: Number(formData.get('price')) * 100, // Price in cents
            currency: formData.get('currency'),
            retailer_id: formData.get('retailer_id'),
            image_url: formData.get('image_url'),
            availability: 'in_stock',
            access_token: token
        };

        await axios.post(`https://graph.facebook.com/${API_VERSION}/${catalogId}/products`, payload);

        return { message: 'Product added to catalog successfully.' };
    } catch(e) {
        return { error: getErrorMessage(e) };
    }
}

export async function updateProductInCatalog(prevState: any, formData: FormData): Promise<{ message?: string; error?: string }> {
    const projectId = formData.get('projectId') as string;
    const productId = formData.get('productId') as string;

    const project = await getProjectById(projectId);
    if (!project) return { error: 'Project not found.' };

    const token = process.env.Meta_Admin_token || project.accessToken;

    try {
        const updateData: any = {};
        if (formData.has('name')) updateData.name = formData.get('name');
        if (formData.has('price')) updateData.price = Number(formData.get('price')) * 100;
        if (formData.has('inventory')) updateData.inventory = Number(formData.get('inventory'));
        if (formData.has('availability')) updateData.availability = formData.get('availability');
        
        await axios.post(`https://graph.facebook.com/${API_VERSION}/${productId}`, {
            ...updateData,
            access_token: token,
        });

        return { message: 'Product updated successfully.' };
    } catch(e) {
        return { error: getErrorMessage(e) };
    }
}

export async function connectCatalogToWaba(projectId: string, catalogId: string): Promise<{ message?: string; error?: string }> {
    const project = await getProjectById(projectId);
    if (!project || !project.wabaId) return { error: 'Project not found or WABA ID missing.' };
    
    const token = process.env.Meta_Admin_token || project.accessToken;
    
    try {
        const response = await axios.post(`https://graph.facebook.com/${API_VERSION}/${project.wabaId}/product_catalogs`, {
            product_catalog_id: catalogId,
            access_token: token
        });

        if (response.data.error) throw new Error(response.data.error.message);

        const { db } = await connectToDatabase();
        await db.collection('projects').updateOne({ _id: new ObjectId(projectId) }, { $set: { connectedCatalogId: catalogId } });

        revalidatePath('/dashboard/catalog');
        return { message: 'Catalog connected successfully!' };
    } catch(e) {
        return { error: getErrorMessage(e) };
    }
}

export async function createProductSet(prevState: any, formData: FormData): Promise<{ message?: string; error?: string }> {
    const projectId = formData.get('projectId') as string;
    const catalogId = formData.get('catalogId') as string;
    const name = formData.get('name') as string;

    const project = await getProjectById(projectId);
    if (!project) return { error: 'Project not found.' };

    const token = process.env.Meta_Admin_token || project.accessToken;

    try {
        await axios.post(`https://graph.facebook.com/${API_VERSION}/${catalogId}/product_sets`, {
            name,
            access_token: token
        });
        return { message: 'Collection created successfully.' };
    } catch(e) {
        return { error: getErrorMessage(e) };
    }
}

export async function deleteProductSet(setId: string, projectId: string): Promise<{ success: boolean; error?: string }> {
    const project = await getProjectById(projectId);
    if (!project) return { success: false, error: 'Project not found.' };

    const token = process.env.Meta_Admin_token || project.accessToken;
    
    try {
        await axios.delete(`https://graph.facebook.com/${API_VERSION}/${setId}`, {
            params: { access_token: token }
        });
        return { success: true };
    } catch(e) {
        return { success: false, error: getErrorMessage(e) };
    }
}

export async function listProductSets(catalogId: string, projectId: string): Promise<ProductSet[]> {
    const project = await getProjectById(projectId);
    if (!project) return [];

    const token = process.env.Meta_Admin_token || project.accessToken;
    try {
        const response = await axios.get(`https://graph.facebook.com/${API_VERSION}/${catalogId}/product_sets`, {
            params: { access_token: token }
        });
        return response.data?.data || [];
    } catch(e) {
        console.error('Failed to list product sets', getErrorMessage(e));
        return [];
    }
}

export async function getTaggedMediaForProduct(productId: string, projectId: string): Promise<{media?: any[], error?: string}> {
    const project = await getProjectById(projectId);
    if (!project) return { error: 'Project not found' };

    const token = process.env.Meta_Admin_token || project.accessToken;
    try {
        const response = await axios.get(`https://graph.facebook.com/${API_VERSION}/${productId}/tagged_media`, {
            params: { access_token: token, fields: 'id,media_url,permalink,thumbnail_url,timestamp,caption' }
        });
        return { media: response.data.data };
    } catch(e) {
        return { error: getErrorMessage(e) };
    }
}
