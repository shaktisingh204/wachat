'use server';

export async function executeEtsyAction(actionName: string, inputs: any, user: any, logger: any) {
    const baseUrl = 'https://openapi.etsy.com/v3';
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'x-api-key': inputs.apiKey,
    };
    if (inputs.accessToken) {
        headers['Authorization'] = `Bearer ${inputs.accessToken}`;
    }

    try {
        switch (actionName) {
            case 'getShop': {
                const res = await fetch(`${baseUrl}/application/shops/${inputs.shopId}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.error || 'Failed to get shop' };
                return { output: data };
            }
            case 'listShopListings': {
                const params = new URLSearchParams();
                if (inputs.limit) params.set('limit', String(inputs.limit));
                if (inputs.offset) params.set('offset', String(inputs.offset));
                if (inputs.state) params.set('state', inputs.state);
                const res = await fetch(`${baseUrl}/application/shops/${inputs.shopId}/listings?${params}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.error || 'Failed to list shop listings' };
                return { output: data };
            }
            case 'getListing': {
                const res = await fetch(`${baseUrl}/application/listings/${inputs.listingId}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.error || 'Failed to get listing' };
                return { output: data };
            }
            case 'createListing': {
                const body: Record<string, any> = {
                    quantity: inputs.quantity,
                    title: inputs.title,
                    description: inputs.description,
                    price: inputs.price,
                    who_made: inputs.whoMade || 'i_did',
                    when_made: inputs.whenMade || 'made_to_order',
                    taxonomy_id: inputs.taxonomyId,
                };
                if (inputs.tags) body.tags = inputs.tags;
                const res = await fetch(`${baseUrl}/application/shops/${inputs.shopId}/listings`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error || 'Failed to create listing' };
                return { output: data };
            }
            case 'updateListing': {
                const body: Record<string, any> = {};
                if (inputs.title !== undefined) body.title = inputs.title;
                if (inputs.description !== undefined) body.description = inputs.description;
                if (inputs.price !== undefined) body.price = inputs.price;
                if (inputs.quantity !== undefined) body.quantity = inputs.quantity;
                if (inputs.state !== undefined) body.state = inputs.state;
                const res = await fetch(`${baseUrl}/application/shops/${inputs.shopId}/listings/${inputs.listingId}`, {
                    method: 'PATCH',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error || 'Failed to update listing' };
                return { output: data };
            }
            case 'deleteListing': {
                const res = await fetch(`${baseUrl}/application/listings/${inputs.listingId}`, {
                    method: 'DELETE',
                    headers,
                });
                if (!res.ok) {
                    const data = await res.json().catch(() => ({}));
                    return { error: data.error || 'Failed to delete listing' };
                }
                return { output: { success: true, listingId: inputs.listingId } };
            }
            case 'listListingImages': {
                const res = await fetch(`${baseUrl}/application/shops/${inputs.shopId}/listings/${inputs.listingId}/images`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.error || 'Failed to list listing images' };
                return { output: data };
            }
            case 'uploadListingImage': {
                const body: Record<string, any> = {};
                if (inputs.imageUrl) body.url = inputs.imageUrl;
                if (inputs.rank) body.rank = inputs.rank;
                if (inputs.overwrite !== undefined) body.overwrite = inputs.overwrite;
                const res = await fetch(`${baseUrl}/application/shops/${inputs.shopId}/listings/${inputs.listingId}/images`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error || 'Failed to upload listing image' };
                return { output: data };
            }
            case 'getListingInventory': {
                const res = await fetch(`${baseUrl}/application/listings/${inputs.listingId}/inventory`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.error || 'Failed to get listing inventory' };
                return { output: data };
            }
            case 'updateListingInventory': {
                const body: Record<string, any> = {
                    products: inputs.products,
                };
                if (inputs.priceOnProperty) body.price_on_property = inputs.priceOnProperty;
                if (inputs.quantityOnProperty) body.quantity_on_property = inputs.quantityOnProperty;
                const res = await fetch(`${baseUrl}/application/listings/${inputs.listingId}/inventory`, {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error || 'Failed to update listing inventory' };
                return { output: data };
            }
            case 'listOrders': {
                const params = new URLSearchParams();
                if (inputs.limit) params.set('limit', String(inputs.limit));
                if (inputs.offset) params.set('offset', String(inputs.offset));
                if (inputs.startDate) params.set('min_created', inputs.startDate);
                if (inputs.endDate) params.set('max_created', inputs.endDate);
                const res = await fetch(`${baseUrl}/application/shops/${inputs.shopId}/receipts?${params}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.error || 'Failed to list orders' };
                return { output: data };
            }
            case 'getOrder': {
                const res = await fetch(`${baseUrl}/application/shops/${inputs.shopId}/receipts/${inputs.receiptId}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.error || 'Failed to get order' };
                return { output: data };
            }
            case 'getOrderReceipt': {
                const res = await fetch(`${baseUrl}/application/shops/${inputs.shopId}/receipts/${inputs.receiptId}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.error || 'Failed to get order receipt' };
                return { output: data };
            }
            case 'listTransactions': {
                const params = new URLSearchParams();
                if (inputs.limit) params.set('limit', String(inputs.limit));
                if (inputs.offset) params.set('offset', String(inputs.offset));
                const res = await fetch(`${baseUrl}/application/shops/${inputs.shopId}/transactions?${params}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.error || 'Failed to list transactions' };
                return { output: data };
            }
            case 'getShopReceipts': {
                const params = new URLSearchParams();
                if (inputs.wasShipped !== undefined) params.set('was_shipped', String(inputs.wasShipped));
                if (inputs.wasPaid !== undefined) params.set('was_paid', String(inputs.wasPaid));
                if (inputs.limit) params.set('limit', String(inputs.limit));
                if (inputs.offset) params.set('offset', String(inputs.offset));
                const res = await fetch(`${baseUrl}/application/shops/${inputs.shopId}/receipts?${params}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.error || 'Failed to get shop receipts' };
                return { output: data };
            }
            default:
                return { error: `Unknown Etsy action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`Etsy action error: ${err.message}`);
        return { error: err.message || 'Etsy action failed' };
    }
}
