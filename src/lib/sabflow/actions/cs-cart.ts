'use server';

export async function executeCsCartAction(actionName: string, inputs: any, user: any, logger: any) {
    const siteUrl = (inputs.siteUrl || '').replace(/\/$/, '');
    const baseUrl = `${siteUrl}/api`;

    const credentials = `${inputs.email || ''}:${inputs.apiKey || ''}`;
    const basicAuth = Buffer.from(credentials).toString('base64');

    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${basicAuth}`,
    };

    try {
        switch (actionName) {
            case 'listProducts': {
                const params = new URLSearchParams({
                    page: String(inputs.page || 1),
                    items_per_page: String(inputs.itemsPerPage || 25),
                });
                const res = await fetch(`${baseUrl}/products?${params}`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to list products' };
                return { output: data };
            }

            case 'getProduct': {
                const res = await fetch(`${baseUrl}/products/${inputs.productId}`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to get product' };
                return { output: data };
            }

            case 'createProduct': {
                const res = await fetch(`${baseUrl}/products`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(inputs.product),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to create product' };
                return { output: data };
            }

            case 'updateProduct': {
                const res = await fetch(`${baseUrl}/products/${inputs.productId}`, {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify(inputs.product),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to update product' };
                return { output: data };
            }

            case 'deleteProduct': {
                const res = await fetch(`${baseUrl}/products/${inputs.productId}`, {
                    method: 'DELETE',
                    headers,
                });
                if (!res.ok) {
                    const data = await res.json();
                    return { error: data.message || 'Failed to delete product' };
                }
                return { output: { success: true, productId: inputs.productId } };
            }

            case 'listOrders': {
                const params = new URLSearchParams({
                    page: String(inputs.page || 1),
                    items_per_page: String(inputs.itemsPerPage || 25),
                });
                const res = await fetch(`${baseUrl}/orders?${params}`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to list orders' };
                return { output: data };
            }

            case 'getOrder': {
                const res = await fetch(`${baseUrl}/orders/${inputs.orderId}`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to get order' };
                return { output: data };
            }

            case 'createOrder': {
                const res = await fetch(`${baseUrl}/orders`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(inputs.order),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to create order' };
                return { output: data };
            }

            case 'updateOrder': {
                const res = await fetch(`${baseUrl}/orders/${inputs.orderId}`, {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify(inputs.order),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to update order' };
                return { output: data };
            }

            case 'deleteOrder': {
                const res = await fetch(`${baseUrl}/orders/${inputs.orderId}`, {
                    method: 'DELETE',
                    headers,
                });
                if (!res.ok) {
                    const data = await res.json();
                    return { error: data.message || 'Failed to delete order' };
                }
                return { output: { success: true, orderId: inputs.orderId } };
            }

            case 'listUsers': {
                const params = new URLSearchParams({
                    page: String(inputs.page || 1),
                    items_per_page: String(inputs.itemsPerPage || 25),
                });
                const res = await fetch(`${baseUrl}/users?${params}`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to list users' };
                return { output: data };
            }

            case 'getUser': {
                const res = await fetch(`${baseUrl}/users/${inputs.userId}`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to get user' };
                return { output: data };
            }

            case 'createUser': {
                const res = await fetch(`${baseUrl}/users`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(inputs.user),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to create user' };
                return { output: data };
            }

            case 'listCategories': {
                const params = new URLSearchParams({
                    page: String(inputs.page || 1),
                    items_per_page: String(inputs.itemsPerPage || 25),
                });
                const res = await fetch(`${baseUrl}/categories?${params}`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to list categories' };
                return { output: data };
            }

            case 'getCategory': {
                const res = await fetch(`${baseUrl}/categories/${inputs.categoryId}`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to get category' };
                return { output: data };
            }

            default:
                return { error: `CS-Cart action "${actionName}" is not implemented.` };
        }
    } catch (err: any) {
        logger.log(`CS-Cart action error: ${err.message}`);
        return { error: err.message || 'CS-Cart action failed' };
    }
}
