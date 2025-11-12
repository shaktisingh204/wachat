
'use server';

import { getProjectById } from '@/app/actions/project.actions';
import { getErrorMessage } from '@/lib/utils';
import axios from 'axios';
import { revalidatePath } from 'next/cache';

const API_VERSION = 'v23.0';

// Note: Many existing actions are in facebook.actions.ts and catalog.actions.ts.
// This file is for any *new* functions needed specifically for the Meta Suite SabFlow actions
// to avoid modifying existing action files as requested.

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

// Re-using the getCatalogs and getProductsForCatalog from catalog.actions.ts as they fit the purpose
export { getCatalogs, getProductsForCatalog, addProductToCatalog, deleteProductFromCatalog } from '@/app/actions/catalog.actions';
