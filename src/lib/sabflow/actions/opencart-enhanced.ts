'use server';

export async function executeOpencartEnhancedAction(actionName: string, inputs: any, user: any, logger: any) {
    const siteUrl = (inputs.siteUrl || '').replace(/\/$/, '');
    const baseUrl = `${siteUrl}/index.php?route=api`;

    const getHeaders = (sessionToken?: string): Record<string, string> => {
        const h: Record<string, string> = {
            'Content-Type': 'application/json',
            'X-Oc-Merchant-Id': inputs.merchantId || '',
        };
        if (sessionToken || inputs.sessionToken) {
            h['X-Oc-Session'] = sessionToken || inputs.sessionToken;
        }
        return h;
    };

    try {
        switch (actionName) {
            case 'login': {
                const formData = new URLSearchParams();
                formData.append('username', inputs.username || '');
                formData.append('key', inputs.apiKey || '');
                const res = await fetch(`${baseUrl}/login`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'X-Oc-Merchant-Id': inputs.merchantId || '',
                    },
                    body: formData.toString(),
                });
                const data = await res.json();
                if (!res.ok || data.error) return { error: data.error || 'Login failed' };
                return { output: { sessionToken: data.api_token || data.session, ...data } };
            }

            case 'getProducts': {
                const params = new URLSearchParams({
                    page: String(inputs.page || 1),
                    limit: String(inputs.limit || 25),
                });
                const res = await fetch(`${baseUrl}/rest/products&${params}`, {
                    method: 'GET',
                    headers: getHeaders(),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error || 'Failed to get products' };
                return { output: data };
            }

            case 'getProduct': {
                const res = await fetch(`${baseUrl}/rest/products/${inputs.productId}`, {
                    method: 'GET',
                    headers: getHeaders(),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error || 'Failed to get product' };
                return { output: data };
            }

            case 'createProduct': {
                const res = await fetch(`${baseUrl}/rest/products`, {
                    method: 'POST',
                    headers: getHeaders(),
                    body: JSON.stringify(inputs.product),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error || 'Failed to create product' };
                return { output: data };
            }

            case 'updateProduct': {
                const res = await fetch(`${baseUrl}/rest/products/${inputs.productId}`, {
                    method: 'PUT',
                    headers: getHeaders(),
                    body: JSON.stringify(inputs.product),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error || 'Failed to update product' };
                return { output: data };
            }

            case 'deleteProduct': {
                const res = await fetch(`${baseUrl}/rest/products/${inputs.productId}`, {
                    method: 'DELETE',
                    headers: getHeaders(),
                });
                if (!res.ok) {
                    const data = await res.json();
                    return { error: data.error || 'Failed to delete product' };
                }
                return { output: { success: true, productId: inputs.productId } };
            }

            case 'getOrders': {
                const params = new URLSearchParams({
                    page: String(inputs.page || 1),
                    limit: String(inputs.limit || 25),
                });
                const res = await fetch(`${baseUrl}/rest/orders&${params}`, {
                    method: 'GET',
                    headers: getHeaders(),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error || 'Failed to get orders' };
                return { output: data };
            }

            case 'getOrder': {
                const res = await fetch(`${baseUrl}/rest/orders/${inputs.orderId}`, {
                    method: 'GET',
                    headers: getHeaders(),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error || 'Failed to get order' };
                return { output: data };
            }

            case 'createOrder': {
                const res = await fetch(`${baseUrl}/rest/orders`, {
                    method: 'POST',
                    headers: getHeaders(),
                    body: JSON.stringify(inputs.order),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error || 'Failed to create order' };
                return { output: data };
            }

            case 'updateOrder': {
                const res = await fetch(`${baseUrl}/rest/orders/${inputs.orderId}`, {
                    method: 'PUT',
                    headers: getHeaders(),
                    body: JSON.stringify(inputs.order),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error || 'Failed to update order' };
                return { output: data };
            }

            case 'getCustomers': {
                const params = new URLSearchParams({
                    page: String(inputs.page || 1),
                    limit: String(inputs.limit || 25),
                });
                const res = await fetch(`${baseUrl}/rest/customers&${params}`, {
                    method: 'GET',
                    headers: getHeaders(),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error || 'Failed to get customers' };
                return { output: data };
            }

            case 'createCustomer': {
                const res = await fetch(`${baseUrl}/rest/customers`, {
                    method: 'POST',
                    headers: getHeaders(),
                    body: JSON.stringify(inputs.customer),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error || 'Failed to create customer' };
                return { output: data };
            }

            case 'getCategories': {
                const params = new URLSearchParams({
                    page: String(inputs.page || 1),
                    limit: String(inputs.limit || 25),
                });
                const res = await fetch(`${baseUrl}/rest/categories&${params}`, {
                    method: 'GET',
                    headers: getHeaders(),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error || 'Failed to get categories' };
                return { output: data };
            }

            case 'getCart': {
                const res = await fetch(`${baseUrl}/cart/products`, {
                    method: 'GET',
                    headers: getHeaders(),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error || 'Failed to get cart' };
                return { output: data };
            }

            case 'checkout': {
                const res = await fetch(`${baseUrl}/order/confirm`, {
                    method: 'POST',
                    headers: getHeaders(),
                    body: JSON.stringify(inputs.checkoutData || {}),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error || 'Checkout failed' };
                return { output: data };
            }

            default:
                return { error: `OpenCart Enhanced action "${actionName}" is not implemented.` };
        }
    } catch (err: any) {
        logger.log(`OpenCart Enhanced action error: ${err.message}`);
        return { error: err.message || 'OpenCart Enhanced action failed' };
    }
}
