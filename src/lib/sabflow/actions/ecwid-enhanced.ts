'use server';

export async function executeEcwidEnhancedAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const { token, storeId, ...rest } = inputs;
        const baseUrl = `https://app.ecwid.com/api/v3/${storeId}`;
        const headers: Record<string, string> = {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        };

        switch (actionName) {
            case 'listProducts': {
                const params = new URLSearchParams();
                if (rest.offset) params.set('offset', rest.offset);
                if (rest.limit) params.set('limit', rest.limit);
                if (rest.enabled !== undefined) params.set('enabled', rest.enabled);
                const res = await fetch(`${baseUrl}/products?${params}`, { headers });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.errorMessage || `API error: ${res.status}`);
                return { output: { items: data.items, total: data.total, count: data.count } };
            }
            case 'getProduct': {
                const res = await fetch(`${baseUrl}/products/${rest.productId}`, { headers });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.errorMessage || `API error: ${res.status}`);
                return { output: { product: data } };
            }
            case 'createProduct': {
                const res = await fetch(`${baseUrl}/products`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(rest.product),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.errorMessage || `API error: ${res.status}`);
                return { output: { id: data.id } };
            }
            case 'updateProduct': {
                const res = await fetch(`${baseUrl}/products/${rest.productId}`, {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify(rest.product),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.errorMessage || `API error: ${res.status}`);
                return { output: { updateCount: data.updateCount } };
            }
            case 'deleteProduct': {
                const res = await fetch(`${baseUrl}/products/${rest.productId}`, {
                    method: 'DELETE',
                    headers,
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.errorMessage || `API error: ${res.status}`);
                return { output: { deleteCount: data.deleteCount } };
            }
            case 'listOrders': {
                const params = new URLSearchParams();
                if (rest.offset) params.set('offset', rest.offset);
                if (rest.limit) params.set('limit', rest.limit);
                if (rest.paymentStatus) params.set('paymentStatus', rest.paymentStatus);
                if (rest.fulfillmentStatus) params.set('fulfillmentStatus', rest.fulfillmentStatus);
                const res = await fetch(`${baseUrl}/orders?${params}`, { headers });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.errorMessage || `API error: ${res.status}`);
                return { output: { items: data.items, total: data.total, count: data.count } };
            }
            case 'getOrder': {
                const res = await fetch(`${baseUrl}/orders/${rest.orderId}`, { headers });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.errorMessage || `API error: ${res.status}`);
                return { output: { order: data } };
            }
            case 'createOrder': {
                const res = await fetch(`${baseUrl}/orders`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(rest.order),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.errorMessage || `API error: ${res.status}`);
                return { output: { id: data.id } };
            }
            case 'updateOrder': {
                const res = await fetch(`${baseUrl}/orders/${rest.orderId}`, {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify(rest.order),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.errorMessage || `API error: ${res.status}`);
                return { output: { updateCount: data.updateCount } };
            }
            case 'listCategories': {
                const params = new URLSearchParams();
                if (rest.offset) params.set('offset', rest.offset);
                if (rest.limit) params.set('limit', rest.limit);
                if (rest.parent !== undefined) params.set('parent', rest.parent);
                const res = await fetch(`${baseUrl}/categories?${params}`, { headers });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.errorMessage || `API error: ${res.status}`);
                return { output: { items: data.items, total: data.total, count: data.count } };
            }
            case 'createCategory': {
                const res = await fetch(`${baseUrl}/categories`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(rest.category),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.errorMessage || `API error: ${res.status}`);
                return { output: { id: data.id } };
            }
            case 'updateCategory': {
                const res = await fetch(`${baseUrl}/categories/${rest.categoryId}`, {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify(rest.category),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.errorMessage || `API error: ${res.status}`);
                return { output: { updateCount: data.updateCount } };
            }
            case 'listCustomers': {
                const params = new URLSearchParams();
                if (rest.offset) params.set('offset', rest.offset);
                if (rest.limit) params.set('limit', rest.limit);
                if (rest.email) params.set('email', rest.email);
                const res = await fetch(`${baseUrl}/customers?${params}`, { headers });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.errorMessage || `API error: ${res.status}`);
                return { output: { items: data.items, total: data.total, count: data.count } };
            }
            case 'getCustomer': {
                const res = await fetch(`${baseUrl}/customers/${rest.customerId}`, { headers });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.errorMessage || `API error: ${res.status}`);
                return { output: { customer: data } };
            }
            case 'searchOrders': {
                const params = new URLSearchParams();
                if (rest.keywords) params.set('keywords', rest.keywords);
                if (rest.createdFrom) params.set('createdFrom', rest.createdFrom);
                if (rest.createdTo) params.set('createdTo', rest.createdTo);
                if (rest.offset) params.set('offset', rest.offset);
                if (rest.limit) params.set('limit', rest.limit);
                const res = await fetch(`${baseUrl}/orders?${params}`, { headers });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.errorMessage || `API error: ${res.status}`);
                return { output: { items: data.items, total: data.total, count: data.count } };
            }
            default:
                return { error: `Action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Action failed.' };
    }
}
