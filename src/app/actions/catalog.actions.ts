'use server';

import { getProjectById } from '@/app/actions/project.actions';

const API_VERSION = 'v23.0';

export type Catalog = {
    id: string;
    name: string;
    product_count: number;
};

export type Product = {
    id: string;
    retailer_id: string;
    name: string;
    image_url: string;
    price: string;
    currency: string;
};

export async function getOwnedCatalogs(projectId: string): Promise<{ catalogs?: Catalog[], error?: string }> {
    try {
        const project = await getProjectById(projectId);
        if (!project) return { error: 'Project not found' };

        const { wabaId, accessToken } = project;
        // Specifically fetch catalogs owned by the business
        const url = `https://graph.facebook.com/${API_VERSION}/${wabaId}/owned_product_catalogs?access_token=${accessToken}`;

        const response = await fetch(url);
        const data = await response.json();

        if (data.error) {
            console.error('Meta API Error (getOwnedCatalogs):', data.error);
            return { error: data.error.message };
        }

        return { catalogs: data.data || [] };
    } catch (err) {
        console.error('getOwnedCatalogs Exception:', err);
        return { error: 'Failed to fetch catalogs' };
    }
}

export async function getCatalogProducts(projectId: string, catalogId: string, searchTerm?: string): Promise<{ products?: Product[], error?: string }> {
    try {
        const project = await getProjectById(projectId);
        if (!project) return { error: 'Project not found' };

        const { accessToken } = project;

        // Fetch products from the catalog. Limiting to 50 for performance.
        // If searchTerm is provided, we can't easily filter via API v23.0 on simple endpoints without Search Edge, 
        // so we'll fetch recent ones and filter client-side or prompt user to be specific.
        // For now, let's just fetch default list.
        const url = `https://graph.facebook.com/${API_VERSION}/${catalogId}/products?fields=id,retailer_id,name,image_url,price,currency&limit=50&access_token=${accessToken}`;

        const response = await fetch(url);
        const data = await response.json();

        if (data.error) {
            console.error('Meta API Error (getCatalogProducts):', data.error);
            return { error: data.error.message };
        }

        let products: Product[] = data.data || [];

        // Simple client-side search if API doesn't support it directly on this edge easily
        if (searchTerm) {
            const lowerTerm = searchTerm.toLowerCase();
            products = products.filter(p =>
                p.name.toLowerCase().includes(lowerTerm) ||
                p.retailer_id.toLowerCase().includes(lowerTerm)
            );
        }

        return { products };
    } catch (err) {
        console.error('getCatalogProducts Exception:', err);
        return { error: 'Failed to fetch products' };
    }
}
