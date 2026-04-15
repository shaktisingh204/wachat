'use server';

export async function executeEbayAction(actionName: string, inputs: any, user: any, logger: any) {
    const baseUrl = 'https://api.ebay.com';
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${inputs.accessToken}`,
    };

    try {
        switch (actionName) {
            case 'searchItems': {
                const params = new URLSearchParams();
                if (inputs.q) params.set('q', inputs.q);
                if (inputs.limit) params.set('limit', String(inputs.limit));
                if (inputs.offset) params.set('offset', String(inputs.offset));
                if (inputs.categoryIds) params.set('category_ids', inputs.categoryIds);
                if (inputs.filter) params.set('filter', inputs.filter);
                const res = await fetch(`${baseUrl}/buy/browse/v1/item_summary/search?${params}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.errors?.[0]?.message || 'Failed to search items' };
                return { output: data };
            }
            case 'getItem': {
                const res = await fetch(`${baseUrl}/buy/browse/v1/item/${inputs.itemId}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.errors?.[0]?.message || 'Failed to get item' };
                return { output: data };
            }
            case 'getItemByLegacyId': {
                const params = new URLSearchParams();
                params.set('legacy_item_id', inputs.legacyItemId);
                if (inputs.legacyVariationId) params.set('legacy_variation_id', inputs.legacyVariationId);
                const res = await fetch(`${baseUrl}/buy/browse/v1/item/get_item_by_legacy_id?${params}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.errors?.[0]?.message || 'Failed to get item by legacy ID' };
                return { output: data };
            }
            case 'createOffer': {
                const body: Record<string, any> = {
                    sku: inputs.sku,
                    marketplaceId: inputs.marketplaceId || 'EBAY_US',
                    format: inputs.format || 'FIXED_PRICE',
                    availableQuantity: inputs.availableQuantity,
                    pricingSummary: {
                        price: {
                            value: inputs.price,
                            currency: inputs.currency || 'USD',
                        },
                    },
                };
                if (inputs.listingDescription) body.listingDescription = inputs.listingDescription;
                if (inputs.categoryId) body.categoryId = inputs.categoryId;
                const res = await fetch(`${baseUrl}/sell/inventory/v1/offer`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.errors?.[0]?.message || 'Failed to create offer' };
                return { output: data };
            }
            case 'getOffer': {
                const res = await fetch(`${baseUrl}/sell/inventory/v1/offer/${inputs.offerId}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.errors?.[0]?.message || 'Failed to get offer' };
                return { output: data };
            }
            case 'updateOffer': {
                const body: Record<string, any> = {};
                if (inputs.availableQuantity !== undefined) body.availableQuantity = inputs.availableQuantity;
                if (inputs.price !== undefined) body.pricingSummary = { price: { value: inputs.price, currency: inputs.currency || 'USD' } };
                if (inputs.listingDescription) body.listingDescription = inputs.listingDescription;
                const res = await fetch(`${baseUrl}/sell/inventory/v1/offer/${inputs.offerId}`, {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify(body),
                });
                if (!res.ok) {
                    const data = await res.json().catch(() => ({}));
                    return { error: data.errors?.[0]?.message || 'Failed to update offer' };
                }
                return { output: { success: true, offerId: inputs.offerId } };
            }
            case 'deleteOffer': {
                const res = await fetch(`${baseUrl}/sell/inventory/v1/offer/${inputs.offerId}`, {
                    method: 'DELETE',
                    headers,
                });
                if (!res.ok) {
                    const data = await res.json().catch(() => ({}));
                    return { error: data.errors?.[0]?.message || 'Failed to delete offer' };
                }
                return { output: { success: true, offerId: inputs.offerId } };
            }
            case 'publishOffer': {
                const res = await fetch(`${baseUrl}/sell/inventory/v1/offer/${inputs.offerId}/publish`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({}),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.errors?.[0]?.message || 'Failed to publish offer' };
                return { output: data };
            }
            case 'withdrawOffer': {
                const res = await fetch(`${baseUrl}/sell/inventory/v1/offer/${inputs.offerId}/withdraw`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({}),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.errors?.[0]?.message || 'Failed to withdraw offer' };
                return { output: data };
            }
            case 'listOffers': {
                const params = new URLSearchParams();
                if (inputs.sku) params.set('sku', inputs.sku);
                if (inputs.marketplaceId) params.set('marketplace_id', inputs.marketplaceId);
                if (inputs.limit) params.set('limit', String(inputs.limit));
                if (inputs.offset) params.set('offset', String(inputs.offset));
                const res = await fetch(`${baseUrl}/sell/inventory/v1/offer?${params}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.errors?.[0]?.message || 'Failed to list offers' };
                return { output: data };
            }
            case 'getInventoryItem': {
                const res = await fetch(`${baseUrl}/sell/inventory/v1/inventory_item/${encodeURIComponent(inputs.sku)}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.errors?.[0]?.message || 'Failed to get inventory item' };
                return { output: data };
            }
            case 'createInventoryItem': {
                const body: Record<string, any> = {
                    product: {
                        title: inputs.title,
                        description: inputs.description,
                    },
                    condition: inputs.condition || 'NEW',
                    availability: {
                        shipToLocationAvailability: {
                            quantity: inputs.quantity,
                        },
                    },
                };
                if (inputs.imageUrls) body.product.imageUrls = inputs.imageUrls;
                const res = await fetch(`${baseUrl}/sell/inventory/v1/inventory_item/${encodeURIComponent(inputs.sku)}`, {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify(body),
                });
                if (!res.ok) {
                    const data = await res.json().catch(() => ({}));
                    return { error: data.errors?.[0]?.message || 'Failed to create inventory item' };
                }
                return { output: { success: true, sku: inputs.sku } };
            }
            case 'updateInventoryItem': {
                const body: Record<string, any> = {};
                if (inputs.quantity !== undefined) body.availability = { shipToLocationAvailability: { quantity: inputs.quantity } };
                if (inputs.condition) body.condition = inputs.condition;
                if (inputs.title || inputs.description) body.product = {};
                if (inputs.title) body.product.title = inputs.title;
                if (inputs.description) body.product.description = inputs.description;
                const res = await fetch(`${baseUrl}/sell/inventory/v1/inventory_item/${encodeURIComponent(inputs.sku)}`, {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify(body),
                });
                if (!res.ok) {
                    const data = await res.json().catch(() => ({}));
                    return { error: data.errors?.[0]?.message || 'Failed to update inventory item' };
                }
                return { output: { success: true, sku: inputs.sku } };
            }
            case 'deleteInventoryItem': {
                const res = await fetch(`${baseUrl}/sell/inventory/v1/inventory_item/${encodeURIComponent(inputs.sku)}`, {
                    method: 'DELETE',
                    headers,
                });
                if (!res.ok) {
                    const data = await res.json().catch(() => ({}));
                    return { error: data.errors?.[0]?.message || 'Failed to delete inventory item' };
                }
                return { output: { success: true, sku: inputs.sku } };
            }
            case 'getOrders': {
                const params = new URLSearchParams();
                if (inputs.filter) params.set('filter', inputs.filter);
                if (inputs.limit) params.set('limit', String(inputs.limit));
                if (inputs.offset) params.set('offset', String(inputs.offset));
                if (inputs.orderIds) params.set('orderIds', inputs.orderIds);
                const res = await fetch(`${baseUrl}/sell/fulfillment/v1/order?${params}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.errors?.[0]?.message || 'Failed to get orders' };
                return { output: data };
            }
            default:
                return { error: `Unknown eBay action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`eBay action error: ${err.message}`);
        return { error: err.message || 'eBay action failed' };
    }
}
