/**
 * Client for the Meta Suite router on the Rust BFF.
 *
 * Mirrors the routes registered under `/v1/meta/suite` by the
 * `meta-suite` crate. Each method is a one-line shim around
 * {@link rustFetch} so the namespace surface stays close to the OpenAPI
 * operation IDs — when codegen replaces this file the call sites won't
 * change.
 *
 *   GET    /projects/:id/catalogs                                  → listCatalogs
 *   POST   /projects/:id/catalogs/sync                             → syncCatalogs
 *   GET    /projects/:id/catalogs/:catalogId/products?searchTerm   → listProducts
 *   POST   /projects/:id/catalogs/:catalogId/products              → addProduct
 *   DELETE /projects/:id/catalogs/products/:productId              → deleteProduct
 *   POST   /projects/:id/catalogs/products/:productId              → updateProduct
 *   GET    /projects/:id/catalogs/products/:productId/tagged-media → getTaggedMedia
 *   GET    /projects/:id/catalogs/:catalogId/product-sets          → listProductSets
 *   POST   /projects/:id/catalogs/:catalogId/product-sets          → createProductSet
 *   DELETE /projects/:id/catalogs/product-sets/:productSetId       → deleteProductSet
 *
 * Server-only — uses the shared JWT-issuing fetcher.
 */
import 'server-only';

import { rustFetch } from './fetcher';

const BASE = '/v1/meta/suite';

// ---------------------------------------------------------------------------
// Domain DTOs (mirror the Rust slice DTOs — camelCase over the wire because
// every Rust handler uses `serde(rename_all = "camelCase")`).
// ---------------------------------------------------------------------------

/**
 * Single product catalog in a Meta Business Manager. Fields match the Meta
 * Graph `/{business_id}/owned_product_catalogs` shape (snake_case product
 * count is preserved verbatim from Meta).
 */
export interface MetaSuiteCatalog {
    id: string;
    name: string;
    product_count: number;
}

/**
 * Single product item inside a catalog. Fields match the Meta Graph
 * `/{catalog_id}/products` shape (snake_case `retailer_id` / `image_url` are
 * preserved verbatim from Meta).
 */
export interface MetaSuiteProduct {
    id: string;
    retailer_id: string;
    name: string;
    image_url: string;
    price: string;
    currency: string;
}

/**
 * Body for `POST /v1/meta/suite/projects/:id/catalogs/:catalogId/products`.
 *
 * `price` is the display-currency major unit as a string ("100" => 100 USD)
 * and is scaled by 100 to cents on the Rust side before being forwarded to
 * Meta. `description`, `url`, `imageUrl`, `currency` fall back to safe
 * defaults when omitted.
 */
export interface AddMetaSuiteProductBody {
    retailerId: string;
    name: string;
    description?: string;
    url?: string;
    imageUrl?: string;
    price?: string;
    currency?: string;
}

/** Result of `GET /v1/meta/suite/projects/:id/catalogs`. */
export interface MetaSuiteCatalogList {
    catalogs: MetaSuiteCatalog[];
}

/** Result of `GET /v1/meta/suite/projects/:id/catalogs/:catalogId/products`. */
export interface MetaSuiteProductList {
    products: MetaSuiteProduct[];
}

/** Ack returned by `POST /…/products` (add product). */
export interface MetaSuiteAddAck {
    success: boolean;
    message: string;
}

/** Ack returned by `DELETE /…/products/:productId`. */
export interface MetaSuiteDeleteAck {
    success: boolean;
}

/**
 * Body for `POST /v1/meta/suite/projects/:id/catalogs/products/:productId`
 * (partial update). At least one field must be present.
 */
export interface UpdateMetaSuiteProductBody {
    name?: string;
    description?: string;
    url?: string;
    imageUrl?: string;
    /** Display-currency major unit string; scaled by 100 to cents server-side. */
    price?: string;
    currency?: string;
    availability?: string;
    condition?: string;
}

/** Single Meta product set under a catalog. */
export interface MetaSuiteProductSet {
    id: string;
    name: string;
    /** Raw filter object as returned by Meta (shape varies). */
    filter?: unknown;
    product_count?: number;
}

/** Result of `GET /…/:catalogId/product-sets`. */
export interface MetaSuiteProductSetList {
    product_sets: MetaSuiteProductSet[];
}

/**
 * Body for `POST /…/:catalogId/product-sets`. `filter` is a raw Meta
 * filter string; when omitted the server falls back to a permissive
 * default (matching legacy form-data behavior).
 */
export interface CreateMetaSuiteProductSetBody {
    name: string;
    filter?: string;
}

/** Result of `GET /…/products/:productId/tagged-media`. */
export interface MetaSuiteTaggedMediaList {
    media: unknown[];
}

// ---------------------------------------------------------------------------
// Public namespace
// ---------------------------------------------------------------------------

function qs(params: Record<string, string | undefined | null>): string {
    const search = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== null && v !== '') search.set(k, v);
    }
    const s = search.toString();
    return s ? `?${s}` : '';
}

export const metaSuiteApi = {
    listCatalogs: (projectId: string) =>
        rustFetch<MetaSuiteCatalogList>(
            `${BASE}/projects/${encodeURIComponent(projectId)}/catalogs`,
        ),

    listProducts: (
        projectId: string,
        catalogId: string,
        searchTerm?: string,
    ) =>
        rustFetch<MetaSuiteProductList>(
            `${BASE}/projects/${encodeURIComponent(projectId)}/catalogs/${encodeURIComponent(catalogId)}/products${qs({ search_term: searchTerm })}`,
        ),

    addProduct: (
        projectId: string,
        catalogId: string,
        body: AddMetaSuiteProductBody,
    ) =>
        rustFetch<MetaSuiteAddAck>(
            `${BASE}/projects/${encodeURIComponent(projectId)}/catalogs/${encodeURIComponent(catalogId)}/products`,
            {
                method: 'POST',
                body: JSON.stringify(body),
            },
        ),

    deleteProduct: (projectId: string, productId: string) =>
        rustFetch<MetaSuiteDeleteAck>(
            `${BASE}/projects/${encodeURIComponent(projectId)}/catalogs/products/${encodeURIComponent(productId)}`,
            { method: 'DELETE' },
        ),

    syncCatalogs: (projectId: string) =>
        rustFetch<MetaSuiteAddAck>(
            `${BASE}/projects/${encodeURIComponent(projectId)}/catalogs/sync`,
            { method: 'POST' },
        ),

    updateProduct: (
        projectId: string,
        productId: string,
        body: UpdateMetaSuiteProductBody,
    ) =>
        rustFetch<MetaSuiteAddAck>(
            `${BASE}/projects/${encodeURIComponent(projectId)}/catalogs/products/${encodeURIComponent(productId)}`,
            {
                method: 'POST',
                body: JSON.stringify(body),
            },
        ),

    listProductSets: (projectId: string, catalogId: string) =>
        rustFetch<MetaSuiteProductSetList>(
            `${BASE}/projects/${encodeURIComponent(projectId)}/catalogs/${encodeURIComponent(catalogId)}/product-sets`,
        ),

    createProductSet: (
        projectId: string,
        catalogId: string,
        body: CreateMetaSuiteProductSetBody,
    ) =>
        rustFetch<MetaSuiteAddAck>(
            `${BASE}/projects/${encodeURIComponent(projectId)}/catalogs/${encodeURIComponent(catalogId)}/product-sets`,
            {
                method: 'POST',
                body: JSON.stringify(body),
            },
        ),

    deleteProductSet: (projectId: string, productSetId: string) =>
        rustFetch<MetaSuiteDeleteAck>(
            `${BASE}/projects/${encodeURIComponent(projectId)}/catalogs/product-sets/${encodeURIComponent(productSetId)}`,
            { method: 'DELETE' },
        ),

    getTaggedMedia: (projectId: string, productId: string) =>
        rustFetch<MetaSuiteTaggedMediaList>(
            `${BASE}/projects/${encodeURIComponent(projectId)}/catalogs/products/${encodeURIComponent(productId)}/tagged-media`,
        ),
};

export type MetaSuiteApi = typeof metaSuiteApi;
