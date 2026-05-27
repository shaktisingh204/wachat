'use server';

/**
 * Thin shims over the Rust BFF `meta-suite` crate (mounted at
 * `/v1/meta/suite`). Kept under the original `catalog.actions.ts` path so
 * existing call sites do not move.
 *
 * The legacy implementation called Meta's Graph API directly from the
 * Next.js server runtime; this version preserves the **exact same
 * return-type contracts** but routes through Rust:
 *
 *   getCatalogs(projectId)                            → metaSuite.listCatalogs
 *   getProductsForCatalog(catalogId, projectId, q?)   → metaSuite.listProducts
 *   addProductToCatalog(prevState, formData)          → metaSuite.addProduct
 *   deleteProductFromCatalog(productId, projectId)    → metaSuite.deleteProduct
 *   syncCatalogs(projectId)                           → metaSuite.syncCatalogs
 *   updateProductInCatalog(prevState, formData)       → metaSuite.updateProduct
 *   listProductSets(catalogId, projectId)             → metaSuite.listProductSets
 *   createProductSet(prevState, formData)             → metaSuite.createProductSet
 *   deleteProductSet(productSetId, projectId)         → metaSuite.deleteProductSet
 *   getTaggedMediaForProduct(productId, projectId)    → metaSuite.getTaggedMedia
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
    searchTerm?: string,
): Promise<{ products?: Product[]; error?: string }> {
    try {
        const { rustClient } = await import('@/lib/rust-client');
        const result = await rustClient.metaSuite.listProducts(
            projectId,
            catalogId,
            searchTerm,
        );
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

export async function syncCatalogs(
    projectId: string,
): Promise<{ message?: string; success?: boolean; error?: string }> {
    try {
        const { rustClient } = await import('@/lib/rust-client');
        const result = await rustClient.metaSuite.syncCatalogs(projectId);
        return { message: result.message, success: result.success };
    } catch (e: unknown) {
        return { error: getErrorMessage(e) };
    }
}

export async function updateProductInCatalog(
    _prevState: any,
    formData: FormData,
): Promise<{ success?: boolean; message?: string; error?: string }> {
    try {
        const projectId = formData.get('projectId') as string;
        const productId = formData.get('productId') as string;

        const price = formData.get('price') as string;
        const currency = formData.get('currency') as string;
        const description = formData.get('description') as string;
        const urlLink = formData.get('url') as string;
        const imageUrl = formData.get('imageUrl') as string;
        const name = formData.get('name') as string;
        const availability = formData.get('availability') as string;
        const condition = formData.get('condition') as string;

        if (!projectId || !productId) {
            return { error: 'Missing Project ID or Product ID' };
        }

        const body: Record<string, string> = {};
        if (name) body.name = name;
        if (description) body.description = description;
        if (urlLink) body.url = urlLink;
        if (imageUrl) body.imageUrl = imageUrl;
        if (price) body.price = price;
        if (currency) body.currency = currency;
        if (availability) body.availability = availability;
        if (condition) body.condition = condition;

        if (Object.keys(body).length === 0) {
            return { error: 'No fields to update' };
        }

        const { rustClient } = await import('@/lib/rust-client');
        const result = await rustClient.metaSuite.updateProduct(
            projectId,
            productId,
            body,
        );
        return { success: result.success, message: result.message };
    } catch (e: unknown) {
        return { error: getErrorMessage(e) };
    }
}

export async function listProductSets(
    catalogId: string,
    projectId: string,
): Promise<{ productSets?: any[]; error?: string }> {
    try {
        const { rustClient } = await import('@/lib/rust-client');
        const result = await rustClient.metaSuite.listProductSets(projectId, catalogId);
        return { productSets: result.product_sets };
    } catch (e: unknown) {
        return { error: getErrorMessage(e) };
    }
}

export async function createProductSet(
    _prevState: any,
    formData: FormData,
): Promise<{ success?: boolean; message?: string; error?: string }> {
    try {
        const projectId = formData.get('projectId') as string;
        const catalogId = formData.get('catalogId') as string;
        const name = formData.get('name') as string;
        const filterStr = formData.get('filter') as string | null;

        if (!projectId || !catalogId || !name) {
            return { error: 'Missing required fields' };
        }

        const { rustClient } = await import('@/lib/rust-client');
        const result = await rustClient.metaSuite.createProductSet(projectId, catalogId, {
            name,
            filter: filterStr || undefined,
        });
        return { success: result.success, message: result.message };
    } catch (e: unknown) {
        return { error: getErrorMessage(e) };
    }
}

export async function deleteProductSet(
    productSetId: string,
    projectId: string,
): Promise<{ success?: boolean; error?: string }> {
    try {
        const { rustClient } = await import('@/lib/rust-client');
        const result = await rustClient.metaSuite.deleteProductSet(
            projectId,
            productSetId,
        );
        return { success: result.success };
    } catch (e: unknown) {
        return { error: getErrorMessage(e) };
    }
}

export async function getTaggedMediaForProduct(
    productId: string,
    projectId: string,
): Promise<{ media?: any[]; error?: string }> {
    try {
        const { rustClient } = await import('@/lib/rust-client');
        const result = await rustClient.metaSuite.getTaggedMedia(projectId, productId);
        return { media: result.media };
    } catch (e: unknown) {
        return { error: getErrorMessage(e) };
    }
}

export async function bulkAddProductsToCatalog(
    projectId: string,
    catalogId: string,
    products: any[],
): Promise<{ successCount: number; failCount: number; errors: string[] }> {
    const { rustClient } = await import('@/lib/rust-client');
    let successCount = 0;
    let failCount = 0;
    const errors: string[] = [];

    for (const product of products) {
        try {
            const result = await rustClient.metaSuite.addProduct(projectId, catalogId, {
                retailerId: product.retailerId || product.id,
                name: product.name || product.title,
                description: product.description || undefined,
                url: product.url || product.link || undefined,
                imageUrl: product.imageUrl || product.image_link || undefined,
                price: product.price || undefined,
                currency: product.currency || 'USD',
            });
            if (result.success) {
                successCount++;
            } else {
                failCount++;
                errors.push(`Failed for SKU ${product.retailerId || product.id}: ${result.message}`);
            }
        } catch (e: any) {
            failCount++;
            errors.push(`Failed for SKU ${product.retailerId || product.id}: ${getErrorMessage(e)}`);
        }
    }
    return { successCount, failCount, errors };
}
