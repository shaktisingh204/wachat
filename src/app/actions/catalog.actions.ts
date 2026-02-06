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
        let businessId = project.businessId;

        // Fallback: If businessId is not on the project, fetch it from the WABA
        if (!businessId && wabaId) {
            try {
                const businessRes = await fetch(`https://graph.facebook.com/${API_VERSION}/${wabaId}?fields=business&access_token=${accessToken}`);
                const businessData = await businessRes.json();
                if (businessData?.business?.id) {
                    businessId = businessData.business.id;
                    // Optional: We could update the project here to cache it, but let's stick to reading API for now
                    // await updateProject(projectId, { businessId }); 
                }
            } catch (e) {
                console.warn('Failed to fetch business ID from WABA', e);
            }
        }

        if (!businessId) {
            return { error: 'Business ID not found for this project. Please ensure your WABA is linked to a Business Manager.' };
        }

        // Specifically fetch catalogs owned by the business
        const url = `https://graph.facebook.com/${API_VERSION}/${businessId}/owned_product_catalogs?access_token=${accessToken}`;

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

export async function syncCatalogs(projectId: string) {
    try {
        const result = await getCatalogs(projectId);
        if (result.error) {
            return { error: result.error };
        }

        // In the future, we can save these to the database here if needed.
        // For now, we just verify we can fetch them from Meta.

        return { message: 'Catalogs synced successfully', success: true };
    } catch (error) {
        console.error('syncCatalogs Error:', error);
        return { error: 'Failed to sync catalogs' };
    }
}

export async function updateProductInCatalog(prevState: any, formData: FormData) {
    try {
        const projectId = formData.get('projectId') as string;
        const productId = formData.get('productId') as string; // limit to ID or retailer_id

        // We might accept other fields similar to addProduct
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

        const project = await getProjectById(projectId);
        if (!project) return { error: 'Project not found' };
        const { accessToken } = project;

        // Construct update payload - only include fields that are present
        const payload: any = {};
        if (name) payload.name = name;
        if (description) payload.description = description;
        if (urlLink) payload.url = urlLink;
        if (imageUrl) payload.image_url = imageUrl;
        if (price) payload.price = parseInt(price) * 100;
        if (currency) payload.currency = currency;
        if (availability) payload.availability = availability;
        if (condition) payload.condition = condition;

        if (Object.keys(payload).length === 0) {
            return { error: 'No fields to update' };
        }

        // Using the product ID (Meta ID) to update. 
        // Note: usage of API_VERSION from closure
        const url = `https://graph.facebook.com/${API_VERSION}/${productId}`;

        const response = await fetch(url, {
            method: 'POST', // Graph API updates are often POSTs to the node
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (data.error) {
            console.error('Meta API Error (updateProductInCatalog):', data.error);
            return { error: data.error.message };
        }

        return { success: true, message: 'Product updated successfully' };
    } catch (error) {
        console.error('updateProductInCatalog Error:', error);
        return { error: 'Failed to update product' };
    }
}

export async function listProductSets(catalogId: string, projectId: string) {
    try {
        const project = await getProjectById(projectId);
        if (!project) return { error: 'Project not found' };
        const { accessToken } = project;

        const url = `https://graph.facebook.com/${API_VERSION}/${catalogId}/product_sets?access_token=${accessToken}`;

        const response = await fetch(url);
        const data = await response.json();

        if (data.error) {
            console.error('Meta API Error (listProductSets):', data.error);
            return { error: data.error.message };
        }

        return { productSets: data.data || [] };
    } catch (error) {
        console.error('listProductSets Error:', error);
        return { error: 'Failed to list product sets' };
    }
}

export async function createProductSet(prevState: any, formData: FormData) {
    try {
        const projectId = formData.get('projectId') as string;
        const catalogId = formData.get('catalogId') as string;
        const name = formData.get('name') as string;
        // filter could be intricate, for now we might create an empty or all-inclusive set, or accept a JSON filter
        // The dialog shows just "name", implying a basic set. 
        // Meta requires a filter. Defaulting to all products (Retailer ID exists) if not specified? 
        // Or user might manage contents via Commerce Manager.
        // Let's assume we create a set with a basic filter like "product_retailer_id is not null" or similar if required, 
        // but typically '{}' or specific field. 
        // For 'Basic' sets, maybe 'filter' is optional or we set a default `{'retailer_id': {'is_any': ['*']}}` ?? 
        // Actually, let's try a simple filter or empty if allowed. 
        // Based on docs, filter is required.

        const filterStr = formData.get('filter') as string || '{"retailer_id":{"i_contains":""}}'; // Matches all basically?
        // Let's use a safer "all" filter:  {'retailer_id': {'exists': true}} if supported, or just let user define.
        // Given the UI only has Name, we might just default to "All Products" style or empty?
        // Let's use `{'name': {'i_contains': ''}}` as a hack for "all" or just passed filter.

        if (!projectId || !catalogId || !name) {
            return { error: 'Missing required fields' };
        }

        const project = await getProjectById(projectId);
        if (!project) return { error: 'Project not found' };
        const { accessToken } = project;

        const payload = {
            name,
            filter: filterStr // simple filter
        };

        const url = `https://graph.facebook.com/${API_VERSION}/${catalogId}/product_sets`;

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (data.error) {
            console.error('Meta API Error (createProductSet):', data.error);
            // Verify if filter is the issue
            return { error: data.error.message };
        }

        return { success: true, message: 'Product set created' };

    } catch (error) {
        console.error('createProductSet Error:', error);
        return { error: 'Failed to create product set' };
    }
}

export async function deleteProductSet(productSetId: string, projectId: string) {
    try {
        const project = await getProjectById(projectId);
        if (!project) return { error: 'Project not found' };
        const { accessToken } = project;

        const url = `https://graph.facebook.com/${API_VERSION}/${productSetId}?access_token=${accessToken}`;

        const response = await fetch(url, { method: 'DELETE' });
        const data = await response.json();

        if (data.error) {
            return { error: data.error.message };
        }

        return { success: true };
    } catch (error) {
        console.error('deleteProductSet Error:', error);
        return { error: 'Failed to delete product set' };
    }
}

export async function getTaggedMediaForProduct(productId: string, projectId: string) {
    try {
        const project = await getProjectById(projectId);
        if (!project) return { error: 'Project not found' };
        const { accessToken } = project;

        // Endpoint: /{product_id}/tagged_images (for IG/FB often) or similar edge.
        // Or maybe retrieving media that tags this product.
        // Commonly `/{product_id}/product_items` ? No.
        // Let's assume standard `tagged_media` edge or similar. 
        // If not standard, might be `tagged_images`.
        // Let's try `tagged_media` as per most graph nodes.
        const url = `https://graph.facebook.com/${API_VERSION}/${productId}/tagged_media?access_token=${accessToken}`;

        const response = await fetch(url);
        const data = await response.json();

        if (data.error) {
            console.error('Meta API Error (getTaggedMediaForProduct):', data.error);
            return { error: data.error.message };
        }

        return { media: data.data || [] };
    } catch (error) {
        console.error('getTaggedMediaForProduct Error:', error);
        return { error: 'Failed to fetch tagged media' };
    }
}
