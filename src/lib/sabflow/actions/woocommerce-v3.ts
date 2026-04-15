'use server';

export async function executeWooCommerceV3Action(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const { consumerKey, consumerSecret, storeUrl, ...rest } = inputs;
        const basicAuth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');
        const baseUrl = `${storeUrl.replace(/\/$/, '')}/wp-json/wc/v3`;
        const headers: Record<string, string> = {
            'Authorization': `Basic ${basicAuth}`,
            'Content-Type': 'application/json',
        };

        switch (actionName) {
            case 'listProducts': {
                const params = new URLSearchParams();
                if (rest.per_page) params.set('per_page', rest.per_page);
                if (rest.page) params.set('page', rest.page);
                if (rest.status) params.set('status', rest.status);
                const res = await fetch(`${baseUrl}/products?${params}`, { headers });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { products: data } };
            }
            case 'getProduct': {
                const res = await fetch(`${baseUrl}/products/${rest.productId}`, { headers });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { product: data } };
            }
            case 'createProduct': {
                const res = await fetch(`${baseUrl}/products`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(rest.product),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { product: data } };
            }
            case 'updateProduct': {
                const res = await fetch(`${baseUrl}/products/${rest.productId}`, {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify(rest.product),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { product: data } };
            }
            case 'deleteProduct': {
                const res = await fetch(`${baseUrl}/products/${rest.productId}?force=true`, {
                    method: 'DELETE',
                    headers,
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { deleted: true, product: data } };
            }
            case 'listOrders': {
                const params = new URLSearchParams();
                if (rest.per_page) params.set('per_page', rest.per_page);
                if (rest.page) params.set('page', rest.page);
                if (rest.status) params.set('status', rest.status);
                const res = await fetch(`${baseUrl}/orders?${params}`, { headers });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { orders: data } };
            }
            case 'getOrder': {
                const res = await fetch(`${baseUrl}/orders/${rest.orderId}`, { headers });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { order: data } };
            }
            case 'createOrder': {
                const res = await fetch(`${baseUrl}/orders`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(rest.order),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { order: data } };
            }
            case 'updateOrder': {
                const res = await fetch(`${baseUrl}/orders/${rest.orderId}`, {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify(rest.order),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { order: data } };
            }
            case 'deleteOrder': {
                const res = await fetch(`${baseUrl}/orders/${rest.orderId}?force=true`, {
                    method: 'DELETE',
                    headers,
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { deleted: true, order: data } };
            }
            case 'listCustomers': {
                const params = new URLSearchParams();
                if (rest.per_page) params.set('per_page', rest.per_page);
                if (rest.page) params.set('page', rest.page);
                if (rest.role) params.set('role', rest.role);
                const res = await fetch(`${baseUrl}/customers?${params}`, { headers });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { customers: data } };
            }
            case 'getCustomer': {
                const res = await fetch(`${baseUrl}/customers/${rest.customerId}`, { headers });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { customer: data } };
            }
            case 'createCustomer': {
                const res = await fetch(`${baseUrl}/customers`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(rest.customer),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { customer: data } };
            }
            case 'listCoupons': {
                const params = new URLSearchParams();
                if (rest.per_page) params.set('per_page', rest.per_page);
                if (rest.page) params.set('page', rest.page);
                const res = await fetch(`${baseUrl}/coupons?${params}`, { headers });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { coupons: data } };
            }
            case 'createCoupon': {
                const res = await fetch(`${baseUrl}/coupons`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(rest.coupon),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { coupon: data } };
            }
            default:
                return { error: `Action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Action failed.' };
    }
}
