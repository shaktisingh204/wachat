'use server';

export async function executeSquarespaceCommerceAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const { apiKey, ...rest } = inputs;
        const baseUrl = 'https://api.squarespace.com/1.0';
        const headers: Record<string, string> = {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        };

        switch (actionName) {
            case 'listProducts': {
                const params = new URLSearchParams();
                if (rest.cursor) params.set('cursor', rest.cursor);
                const res = await fetch(`${baseUrl}/commerce/products?${params}`, { headers });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { products: data.products, pagination: data.pagination } };
            }
            case 'getProduct': {
                const res = await fetch(`${baseUrl}/commerce/products/${rest.productId}`, { headers });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { product: data } };
            }
            case 'createProduct': {
                const res = await fetch(`${baseUrl}/commerce/products`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(rest.product),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { product: data } };
            }
            case 'updateProduct': {
                const res = await fetch(`${baseUrl}/commerce/products/${rest.productId}`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(rest.product),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { product: data } };
            }
            case 'deleteProduct': {
                const res = await fetch(`${baseUrl}/commerce/products/${rest.productId}`, {
                    method: 'DELETE',
                    headers,
                });
                if (!res.ok) {
                    const data = await res.json();
                    throw new Error(data?.message || `API error: ${res.status}`);
                }
                return { output: { deleted: true, productId: rest.productId } };
            }
            case 'listOrders': {
                const params = new URLSearchParams();
                if (rest.cursor) params.set('cursor', rest.cursor);
                if (rest.modifiedAfter) params.set('modifiedAfter', rest.modifiedAfter);
                if (rest.modifiedBefore) params.set('modifiedBefore', rest.modifiedBefore);
                if (rest.fulfilledAfter) params.set('fulfilledAfter', rest.fulfilledAfter);
                const res = await fetch(`${baseUrl}/commerce/orders?${params}`, { headers });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { orders: data.result, pagination: data.pagination } };
            }
            case 'getOrder': {
                const res = await fetch(`${baseUrl}/commerce/orders/${rest.orderId}`, { headers });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { order: data } };
            }
            case 'fulfillOrder': {
                const res = await fetch(`${baseUrl}/commerce/orders/${rest.orderId}/fulfillments`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        shouldSendNotification: rest.shouldSendNotification ?? true,
                        shipments: rest.shipments || [],
                    }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { result: data } };
            }
            case 'createInventory': {
                const res = await fetch(`${baseUrl}/commerce/inventory`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ increments: rest.increments }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { result: data } };
            }
            case 'updateInventory': {
                const res = await fetch(`${baseUrl}/commerce/inventory`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ increments: rest.increments }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { result: data } };
            }
            case 'listTransactions': {
                const params = new URLSearchParams();
                if (rest.cursor) params.set('cursor', rest.cursor);
                if (rest.modifiedAfter) params.set('modifiedAfter', rest.modifiedAfter);
                const res = await fetch(`${baseUrl}/commerce/transactions?${params}`, { headers });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { transactions: data.documents, pagination: data.pagination } };
            }
            case 'getTransaction': {
                const res = await fetch(`${baseUrl}/commerce/transactions/${rest.transactionId}`, { headers });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { transaction: data } };
            }
            case 'listProfiles': {
                const params = new URLSearchParams();
                if (rest.cursor) params.set('cursor', rest.cursor);
                const res = await fetch(`${baseUrl}/profiles?${params}`, { headers });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { profiles: data.profiles, pagination: data.pagination } };
            }
            case 'getProfile': {
                const res = await fetch(`${baseUrl}/profiles/${rest.profileId}`, { headers });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { profile: data } };
            }
            case 'listSubscriptions': {
                const params = new URLSearchParams();
                if (rest.cursor) params.set('cursor', rest.cursor);
                const res = await fetch(`${baseUrl}/commerce/subscriptions?${params}`, { headers });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { subscriptions: data.subscriptions, pagination: data.pagination } };
            }
            default:
                return { error: `Action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Action failed.' };
    }
}
