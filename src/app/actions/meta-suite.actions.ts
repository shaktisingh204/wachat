'use server';

/**
 * Thin shims over the Rust BFF `meta-suite` crate (mounted at
 * `/v1/meta/suite`). Kept under the original `meta-suite.actions.ts` path
 * so existing call sites (and `app/actions/index.ts` re-export) don't move.
 *
 * The legacy implementation just re-exported four wrappers from
 * `catalog.actions.ts`; this version keeps the **exact same return-type
 * contracts** but routes through Rust:
 *
 *   getCatalogs(projectId)                            → rustClient.metaSuite.listCatalogs
 *   getProductsForCatalog(catalogId, projectId)       → rustClient.metaSuite.listProducts
 *   addProductToCatalog(prevState, formData)          → rustClient.metaSuite.addProduct
 *   deleteProductFromCatalog(productId, projectId)    → rustClient.metaSuite.deleteProduct
 */

import { getErrorMessage } from '@/lib/utils';

type Catalog = {
    id: string;
    name: string;
    product_count: number;
};

type Product = {
    id: string;
    retailer_id: string;
    name: string;
    image_url: string;
    price: string;
    currency: string;
};

export async function getCatalogs(
    projectId: string,
): Promise<{ catalogs?: Catalog[]; error?: string }> {
    try {
        const { rustClient } = await import('@/lib/rust-client');
        const result = await rustClient.metaSuite.listCatalogs(projectId);
        return { catalogs: result.catalogs };
    } catch (e: unknown) {
        return { error: getErrorMessage(e) };
    }
}

export async function getProductsForCatalog(
    catalogId: string,
    projectId: string,
): Promise<{ products?: Product[]; error?: string }> {
    try {
        const { rustClient } = await import('@/lib/rust-client');
        const result = await rustClient.metaSuite.listProducts(projectId, catalogId);
        return { products: result.products };
    } catch (e: unknown) {
        return { error: getErrorMessage(e) };
    }
}

export async function addProductToCatalog(
    _prevState: any,
    formData: FormData,
): Promise<{ message?: string; success?: boolean; error?: string }> {
    try {
        const projectId = formData.get('projectId') as string;
        const catalogId = formData.get('catalogId') as string;
        const retailerId = formData.get('retailerId') as string;
        const name = formData.get('name') as string;
        const price = formData.get('price') as string;
        const currency = formData.get('currency') as string;
        const description = formData.get('description') as string;
        const urlLink = formData.get('url') as string;
        const imageUrl = formData.get('imageUrl') as string;

        if (!projectId || !catalogId || !retailerId || !name) {
            return {
                error: 'Missing required fields (Project, Catalog, Retailer ID, Name)',
            };
        }

        const { rustClient } = await import('@/lib/rust-client');
        const result = await rustClient.metaSuite.addProduct(projectId, catalogId, {
            retailerId,
            name,
            description: description || undefined,
            url: urlLink || undefined,
            imageUrl: imageUrl || undefined,
            price: price || undefined,
            currency: currency || undefined,
        });
        return { message: result.message, success: result.success };
    } catch (e: unknown) {
        return { error: getErrorMessage(e) };
    }
}

export async function deleteProductFromCatalog(
    productId: string,
    projectId: string,
): Promise<{ success?: boolean; error?: string }> {
    try {
        const { rustClient } = await import('@/lib/rust-client');
        const result = await rustClient.metaSuite.deleteProduct(projectId, productId);
        return { success: result.success };
    } catch (e: unknown) {
        return { error: getErrorMessage(e) };
    }
}
