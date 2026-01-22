
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
