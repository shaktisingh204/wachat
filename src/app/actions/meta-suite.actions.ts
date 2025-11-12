
'use server';

import { getProjectById } from '@/app/actions/project.actions';
import { getErrorMessage } from '@/lib/utils';
import axios from 'axios';
import { revalidatePath } from 'next/cache';
import { 
    getCatalogs as getCatalogsFromAction,
    getProductsForCatalog as getProductsForCatalogFromAction,
    addProductToCatalog as addProductToCatalogFromAction,
    deleteProductFromCatalog as deleteProductFromCatalogFromAction
} from '@/app/actions/catalog.actions';

const API_VERSION = 'v23.0';

export async function getAdCampaigns(projectId: string): Promise<{ campaigns?: any[], error?: string }> {
    const project = await getProjectById(projectId);
    if (!project) return { error: "Project not found or access denied." };
    if (!project.adAccountId || !project.accessToken) return { error: "Ad account not configured for this project." };

    try {
        const response = await axios.get(`https://graph.facebook.com/${API_VERSION}/${project.adAccountId}/campaigns`, {
            params: {
                fields: 'id,name,status,objective,daily_budget',
                access_token: project.accessToken
            }
        });
        return { campaigns: response.data.data };
    } catch (e) {
        return { error: getErrorMessage(e) };
    }
}

// Wrapper functions to correctly re-export from a 'use server' file.
export async function getCatalogs(projectId: string) {
    return await getCatalogsFromAction(projectId);
}

export async function getProductsForCatalog(catalogId: string, projectId: string) {
    return await getProductsForCatalogFromAction(catalogId, projectId);
}

export async function addProductToCatalog(prevState: any, formData: FormData) {
    return await addProductToCatalogFromAction(prevState, formData);
}

export async function deleteProductFromCatalog(productId: string, projectId: string) {
    return await deleteProductFromCatalogFromAction(productId, projectId);
}
