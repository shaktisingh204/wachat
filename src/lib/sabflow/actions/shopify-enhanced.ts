'use server';

export async function executeShopifyEnhancedAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const { accessToken, shopDomain, ...rest } = inputs;
        const baseUrl = `https://${shopDomain}/admin/api/2024-01`;
        const headers: Record<string, string> = {
            'X-Shopify-Access-Token': accessToken,
            'Content-Type': 'application/json',
        };

        switch (actionName) {
            case 'listProducts': {
                const params = new URLSearchParams();
                if (rest.limit) params.set('limit', rest.limit);
                if (rest.page_info) params.set('page_info', rest.page_info);
                const res = await fetch(`${baseUrl}/products.json?${params}`, { headers });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.errors || `API error: ${res.status}`);
                return { output: { products: data.products } };
            }
            case 'getProduct': {
                const res = await fetch(`${baseUrl}/products/${rest.productId}.json`, { headers });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.errors || `API error: ${res.status}`);
                return { output: { product: data.product } };
            }
            case 'createProduct': {
                const res = await fetch(`${baseUrl}/products.json`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ product: rest.product }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.errors || `API error: ${res.status}`);
                return { output: { product: data.product } };
            }
            case 'updateProduct': {
                const res = await fetch(`${baseUrl}/products/${rest.productId}.json`, {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify({ product: rest.product }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.errors || `API error: ${res.status}`);
                return { output: { product: data.product } };
            }
            case 'deleteProduct': {
                const res = await fetch(`${baseUrl}/products/${rest.productId}.json`, { method: 'DELETE', headers });
                if (!res.ok) {
                    const data = await res.json();
                    throw new Error(data?.errors || `API error: ${res.status}`);
                }
                return { output: { deleted: true, productId: rest.productId } };
            }
            case 'listOrders': {
                const params = new URLSearchParams();
                if (rest.limit) params.set('limit', rest.limit);
                if (rest.status) params.set('status', rest.status);
                if (rest.page_info) params.set('page_info', rest.page_info);
                const res = await fetch(`${baseUrl}/orders.json?${params}`, { headers });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.errors || `API error: ${res.status}`);
                return { output: { orders: data.orders } };
            }
            case 'getOrder': {
                const res = await fetch(`${baseUrl}/orders/${rest.orderId}.json`, { headers });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.errors || `API error: ${res.status}`);
                return { output: { order: data.order } };
            }
            case 'createOrder': {
                const res = await fetch(`${baseUrl}/orders.json`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ order: rest.order }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.errors || `API error: ${res.status}`);
                return { output: { order: data.order } };
            }
            case 'updateOrder': {
                const res = await fetch(`${baseUrl}/orders/${rest.orderId}.json`, {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify({ order: rest.order }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.errors || `API error: ${res.status}`);
                return { output: { order: data.order } };
            }
            case 'cancelOrder': {
                const res = await fetch(`${baseUrl}/orders/${rest.orderId}/cancel.json`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ reason: rest.reason || 'other' }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.errors || `API error: ${res.status}`);
                return { output: { order: data.order } };
            }
            case 'listCustomers': {
                const params = new URLSearchParams();
                if (rest.limit) params.set('limit', rest.limit);
                if (rest.page_info) params.set('page_info', rest.page_info);
                const res = await fetch(`${baseUrl}/customers.json?${params}`, { headers });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.errors || `API error: ${res.status}`);
                return { output: { customers: data.customers } };
            }
            case 'getCustomer': {
                const res = await fetch(`${baseUrl}/customers/${rest.customerId}.json`, { headers });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.errors || `API error: ${res.status}`);
                return { output: { customer: data.customer } };
            }
            case 'createCustomer': {
                const res = await fetch(`${baseUrl}/customers.json`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ customer: rest.customer }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.errors || `API error: ${res.status}`);
                return { output: { customer: data.customer } };
            }
            case 'listInventory': {
                const params = new URLSearchParams();
                if (rest.location_id) params.set('location_id', rest.location_id);
                if (rest.limit) params.set('limit', rest.limit);
                const res = await fetch(`${baseUrl}/inventory_levels.json?${params}`, { headers });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.errors || `API error: ${res.status}`);
                return { output: { inventory_levels: data.inventory_levels } };
            }
            case 'adjustInventory': {
                const res = await fetch(`${baseUrl}/inventory_levels/adjust.json`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        location_id: rest.location_id,
                        inventory_item_id: rest.inventory_item_id,
                        available_adjustment: rest.available_adjustment,
                    }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.errors || `API error: ${res.status}`);
                return { output: { inventory_level: data.inventory_level } };
            }
            default:
                return { error: `Action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Action failed.' };
    }
}
