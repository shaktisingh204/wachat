
'use server';

import { revalidatePath } from 'next/cache';
import { ObjectId, type WithId } from 'mongodb';
import axios from 'axios';
import { getProjectById } from '@/app/actions/user.actions';
import { connectToDatabase } from '@/lib/mongodb';
import { getErrorMessage } from '@/lib/utils';
import type { Catalog } from '@/lib/definitions';

const API_VERSION = 'v24.0';

export async function createCatalog(
  prevState: any,
  formData: FormData
): Promise<{ message?: string; error?: string }> {
  const projectId = formData.get('projectId') as string;
  const catalogName = formData.get('catalogName') as string;

  const project = await getProjectById(projectId);
  if (!project || !project.businessId) {
    return { error: 'Project not found or business ID is missing.' };
  }

  const accessToken =
    process.env.META_ADMIN_TOKEN || project.accessToken;

  try {
    const response = await axios.post(
      `https://graph.facebook.com/${API_VERSION}/${project.businessId}/owned_product_catalogs`,
      {
        name: catalogName,
        access_token: accessToken,
      }
    );

    if (response.data.error) {
      throw new Error(getErrorMessage(response.data.error));
    }

    const { db } = await connectToDatabase();
    await db.collection('catalogs').insertOne({
      projectId: new ObjectId(projectId),
      metaCatalogId: response.data.id,
      name: catalogName,
      createdAt: new Date(),
    });

    revalidatePath('/dashboard/catalog');
    return { message: `Catalog "${catalogName}" created successfully.` };
  } catch (e: any) {
    return { error: getErrorMessage(e) };
  }
}

export async function getCatalogs(
  projectId: string
): Promise<WithId<Catalog>[]> {
  if (!projectId) return [];
  try {
    const { db } = await connectToDatabase();
    const catalogs = await db
      .collection('catalogs')
      .find({ projectId: new ObjectId(projectId) })
      .toArray();
    return JSON.parse(JSON.stringify(catalogs));
  } catch (e) {
    console.error('Failed to get catalogs from DB:', e);
    return [];
  }
}

export async function syncCatalogs(
  projectId: string
): Promise<{ message?: string; error?: string; count?: number }> {
  const project = await getProjectById(projectId);
  if (!project || !project.wabaId) {
    return { error: 'Project not found or WABA ID is missing.' };
  }

  const accessToken =
    process.env.META_ADMIN_TOKEN || project.accessToken;

  try {
    const response = await axios.get(
      `https://graph.facebook.com/v24.0/${project.wabaId}/product_catalogs`,
      {
        params: { access_token: accessToken },
      }
    );

    if (response.data.error) {
      throw new Error(getErrorMessage(response.data.error));
    }
    const catalogsFromMeta = response.data.data || [];

    if (catalogsFromMeta.length === 0) {
      return { message: 'No catalogs found for this WABA.' };
    }

    const { db } = await connectToDatabase();
    const bulkOps = catalogsFromMeta.map((catalog: any) => ({
      updateOne: {
        filter: {
          projectId: new ObjectId(projectId),
          metaCatalogId: catalog.id,
        },
        update: {
          $set: { name: catalog.name },
          $setOnInsert: {
            projectId: new ObjectId(projectId),
            metaCatalogId: catalog.id,
            createdAt: new Date(),
          },
        },
        upsert: true,
      },
    }));

    const result = await db.collection('catalogs').bulkWrite(bulkOps);
    const syncedCount = result.upsertedCount + result.modifiedCount;

    revalidatePath('/dashboard/catalog');
    return {
      message: `Successfully synced ${syncedCount} catalog(s).`,
      count: syncedCount,
    };
  } catch (e: any) {
    return { error: getErrorMessage(e) };
  }
}

export async function getProductsForCatalog(
  catalogId: string,
  projectId: string
) {
  const project = await getProjectById(projectId);
  if (!project) {
    return [];
  }
  const accessToken =
    process.env.META_ADMIN_TOKEN || project.accessToken;
  try {
    const response = await axios.get(
      `https://graph.facebook.com/v22.0/${catalogId}/products`,
      {
        params: {
          access_token: accessToken,
          fields:
            'id,name,description,category,product_type,image_url,price,retailer_id,inventory,availability,condition,currency',
        },
      }
    );
    return response.data.data || [];
  } catch (e) {
    console.error('Failed to get products for catalog:', e);
    return [];
  }
}

export async function addProductToCatalog(prevState: any, formData: FormData) {
  const projectId = formData.get('projectId') as string;
  const catalogId = formData.get('catalogId') as string;

  const project = await getProjectById(projectId);
  if (!project) return { error: 'Project not found.' };

  const accessToken =
    process.env.META_ADMIN_TOKEN || project.accessToken;

  try {
    const response = await axios.post(
      `https://graph.facebook.com/${API_VERSION}/${catalogId}/products`,
      {
        retailer_id: formData.get('retailer_id'),
        name: formData.get('name'),
        price: Number(formData.get('price')) * 100,
        currency: formData.get('currency'),
        description: formData.get('description'),
        image_url: formData.get('image_url'),
        availability: 'in_stock',
      },
      { params: { access_token: accessToken } }
    );

    if (response.data.error) {
      throw new Error(getErrorMessage(response.data.error));
    }
    return { message: 'Product added successfully.' };
  } catch (e: any) {
    return { error: getErrorMessage(e) };
  }
}

export async function updateProductInCatalog(prevState: any, formData: FormData) {
    const projectId = formData.get('projectId') as string;
    const productId = formData.get('productId') as string;

    const project = await getProjectById(projectId);
    if (!project) return { error: 'Project not found.' };

    const accessToken = process.env.META_ADMIN_TOKEN || project.accessToken;
    
    const updateData: any = {};
    if (formData.get('name')) updateData.name = formData.get('name');
    if (formData.get('price')) updateData.price = Number(formData.get('price')) * 100;
    if (formData.get('inventory')) updateData.inventory = Number(formData.get('inventory'));
    if (formData.get('availability')) updateData.availability = formData.get('availability');

    try {
        const response = await axios.post(
            `https://graph.facebook.com/${API_VERSION}/${productId}`,
            updateData,
            { params: { access_token: accessToken } }
        );

        if (response.data.error) {
            throw new Error(getErrorMessage(response.data.error));
        }

        return { message: 'Product updated successfully.' };
    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}


export async function deleteProductFromCatalog(
  productId: string,
  projectId: string
): Promise<{ success: boolean; error?: string }> {
  const project = await getProjectById(projectId);
  if (!project) return { success: false, error: 'Project not found.' };

  const accessToken =
    process.env.META_ADMIN_TOKEN || project.accessToken;

  try {
    await axios.delete(
      `https://graph.facebook.com/${API_VERSION}/${productId}`,
      { params: { access_token: accessToken } }
    );
    return { success: true };
  } catch (e: any) {
    return { success: false, error: getErrorMessage(e) };
  }
}

export async function connectCatalogToWaba(projectId: string, catalogId: string): Promise<{ success: boolean; error?: string, message?: string }> {
    const project = await getProjectById(projectId);
    if (!project || !project.wabaId) return { success: false, error: 'Project not found or is not a WhatsApp project.' };

    const accessToken = process.env.META_ADMIN_TOKEN || project.accessToken;

    try {
        const response = await axios.post(
            `https://graph.facebook.com/${API_VERSION}/${project.wabaId}/whatsapp_business_commerce_settings`,
            {
                catalog_id: catalogId,
                is_cart_enabled: true,
                access_token: accessToken,
            }
        );
        
        if (response.data.error) {
            throw new Error(getErrorMessage(response.data.error));
        }

        const { db } = await connectToDatabase();
        await db.collection('projects').updateOne(
            { _id: new ObjectId(projectId) },
            { $set: { connectedCatalogId: catalogId } }
        );
        revalidatePath('/dashboard/catalog');
        return { success: true, message: "Catalog connected successfully!" };
    } catch (e: any) {
        console.error("Error connecting catalog to WABA:", getErrorMessage(e));
        return { success: false, error: getErrorMessage(e) };
    }
}

export async function disconnectCatalogFromWaba(projectId: string): Promise<{ success: boolean; error?: string, message?: string }> {
    const project = await getProjectById(projectId);
    if (!project || !project.wabaId) return { success: false, error: 'Project not found or is not a WhatsApp project.' };

    const accessToken = process.env.META_ADMIN_TOKEN || project.accessToken;

    try {
        const response = await axios.post(
            `https://graph.facebook.com/${API_VERSION}/${project.wabaId}/whatsapp_business_commerce_settings`,
            {
                is_cart_enabled: false,
                access_token: accessToken,
            }
        );
        
        if (response.data.error) {
            throw new Error(getErrorMessage(response.data.error));
        }

        const { db } = await connectToDatabase();
        await db.collection('projects').updateOne(
            { _id: new ObjectId(projectId) },
            { $unset: { connectedCatalogId: "" } }
        );
        revalidatePath('/dashboard/catalog');
        return { success: true, message: "Catalog disconnected successfully!" };
    } catch (e: any) {
        console.error("Error disconnecting catalog from WABA:", getErrorMessage(e));
        return { success: false, error: getErrorMessage(e) };
    }
}


export async function getTaggedMediaForProduct(productId: string, projectId: string): Promise<{ media?: any[], error?: string }> {
    const project = await getProjectById(projectId);
    if (!project) return { error: "Project not found." };
    const accessToken = process.env.META_ADMIN_TOKEN || project.accessToken;

    try {
        const response = await axios.get(
            `https://graph.facebook.com/${API_VERSION}/${productId}/tagged_media`,
            { params: { access_token: accessToken } }
        );
        if (response.data.error) throw new Error(getErrorMessage(response.data.error));
        return { media: response.data.data };
    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}

export async function listProductSets(catalogId: string, projectId: string) {
  const project = await getProjectById(projectId);
  if (!project) return [];
  const accessToken = process.env.META_ADMIN_TOKEN || project.accessToken;
  
  try {
    const response = await axios.get(
      `https://graph.facebook.com/${API_VERSION}/${catalogId}/product_sets`,
      { params: { access_token: accessToken, fields: 'id,name,product_count' } }
    );
    if (response.data.error) throw new Error(getErrorMessage(response.data.error));
    return response.data.data || [];
  } catch (e) {
    console.error("Failed to list product sets:", e);
    return [];
  }
}

export async function createProductSet(prevState: any, formData: FormData) {
  const projectId = formData.get('projectId') as string;
  const catalogId = formData.get('catalogId') as string;
  const name = formData.get('name') as string;
  
  const project = await getProjectById(projectId);
  if (!project) return { error: "Project not found" };
  const accessToken = process.env.META_ADMIN_TOKEN || project.accessToken;

  try {
    const response = await axios.post(
      `https://graph.facebook.com/${API_VERSION}/${catalogId}/product_sets`,
      { name: name },
      { params: { access_token: accessToken } }
    );
     if (response.data.error) throw new Error(getErrorMessage(response.data.error));
     return { message: 'Collection created successfully.' };
  } catch (e: any) {
    return { error: getErrorMessage(e) };
  }
}

export async function deleteProductSet(setId: string, projectId: string) {
    const project = await getProjectById(projectId);
    if (!project) return { success: false, error: "Project not found" };
    const accessToken = process.env.META_ADMIN_TOKEN || project.accessToken;

    try {
        await axios.delete(`https://graph.facebook.com/${API_VERSION}/${setId}`, { params: { access_token: accessToken } });
        return { success: true };
    } catch(e: any) {
        return { success: false, error: getErrorMessage(e) };
    }
}

    