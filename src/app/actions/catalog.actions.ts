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

export async function getCatalogs(projectId: string): Promise<{ catalogs?: Catalog[], error?: string }> {
    try {
        const project = await getProjectById(projectId);
        if (!project) return { error: 'Project not found' };

        const { wabaId, accessToken } = project;
        // Specifically fetch catalogs owned by the business
        const url = `https://graph.facebook.com/${API_VERSION}/${wabaId}/owned_product_catalogs?access_token=${accessToken}`;

        const response = await fetch(url);
        const data = await response.json();

        if (data.error) {
            console.error('Meta API Error (getCatalogs):', data.error);
            return { error: data.error.message };
        }

        return { catalogs: data.data || [] };
    } catch (err) {
        console.error('getCatalogs Exception:', err);
        return { error: 'Failed to fetch catalogs' };
    }
}

export async function getProductsForCatalog(catalogId: string, projectId: string, searchTerm?: string): Promise<{ products?: Product[], error?: string }> {
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
            console.error('Meta API Error (getProductsForCatalog):', data.error);
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
        console.error('getProductsForCatalog Exception:', err);
        return { error: 'Failed to fetch products' };
    }
}

// Overload or separate function to handle argument mismatch if needed, but I'll update the signature above.
// Re-exporting aliases for backwards compatibility if needed, but I'll just change the function names.

export async function addProductToCatalog(prevState: any, formData: FormData) {
    try {
        const projectId = formData.get('projectId') as string;
        const catalogId = formData.get('catalogId') as string;
        const retailerId = formData.get('retailerId') as string;
        const name = formData.get('name') as string;
        const price = formData.get('price') as string; // defaults to 100
        const currency = formData.get('currency') as string; // defaults to USD
        const description = formData.get('description') as string;
        const urlLink = formData.get('url') as string;
        const imageUrl = formData.get('imageUrl') as string;

        // Basic validation
        if (!projectId || !catalogId || !retailerId || !name) {
            return { error: 'Missing required fields (Project, Catalog, Retailer ID, Name)' };
        }

        const project = await getProjectById(projectId);
        if (!project) return { error: 'Project not found' };
        const { accessToken } = project;

        const payload = {
            retailer_id: retailerId,
            name,
            description: description || name,
            url: urlLink || 'https://example.com', // Meta often requires a valid URL
            image_url: imageUrl,
            price: parseInt(price) * 100, // typically in cents
            currency: currency || 'USD',
            availability: 'in stock',
            condition: 'new'
        };

        const api_url = `https://graph.facebook.com/${API_VERSION}/${catalogId}/products`;

        const response = await fetch(api_url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (data.error) {
            console.error('Meta API Error (addProductToCatalog):', data.error);
            return { error: data.error.message };
        }

        return { message: 'Product added successfully', success: true };

    } catch (error) {
        console.error('addProductToCatalog Error:', error);
        return { error: 'Failed to add product' };
    }
}

export async function deleteProductFromCatalog(productId: string, projectId: string) {
    try {
        const project = await getProjectById(projectId);
        if (!project) return { error: 'Project not found' };
        const { accessToken } = project;

        const url = `https://graph.facebook.com/${API_VERSION}/${productId}?access_token=${accessToken}`;

        const response = await fetch(url, { method: 'DELETE' });
        const data = await response.json();

        if (data.error) {
            return { error: data.error.message };
        }

        return { success: true };
    } catch (error) {
        console.error('deleteProductFromCatalog Error:', error);
        return { error: 'Failed to delete product' };
    }
}
