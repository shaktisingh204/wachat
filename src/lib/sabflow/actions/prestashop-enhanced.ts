'use server';

export async function executePrestaShopEnhancedAction(actionName: string, inputs: any, user: any, logger: any) {
    const siteUrl = (inputs.siteUrl || '').replace(/\/$/, '');
    const baseUrl = `${siteUrl}/api`;

    const credentials = `${inputs.apiKey || ''}:`;
    const basicAuth = Buffer.from(credentials).toString('base64');

    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${basicAuth}`,
    };

    const withJsonFormat = (url: string) => {
        const separator = url.includes('?') ? '&' : '?';
        return `${url}${separator}output_format=JSON`;
    };

    try {
        switch (actionName) {
            case 'listProducts': {
                const params = new URLSearchParams({
                    limit: String(inputs.limit || 25),
                    page: String(inputs.page || 1),
                    display: 'full',
                });
                const res = await fetch(withJsonFormat(`${baseUrl}/products?${params}`), {
                    method: 'GET',
                    headers,
                });
                const data = await res.json();
                if (!res.ok) return { error: data.errors?.[0]?.message || 'Failed to list products' };
                return { output: data };
            }

            case 'getProduct': {
                const res = await fetch(withJsonFormat(`${baseUrl}/products/${inputs.productId}?display=full`), {
                    method: 'GET',
                    headers,
                });
                const data = await res.json();
                if (!res.ok) return { error: data.errors?.[0]?.message || 'Failed to get product' };
                return { output: data };
            }

            case 'createProduct': {
                const res = await fetch(withJsonFormat(`${baseUrl}/products`), {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ product: inputs.product }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.errors?.[0]?.message || 'Failed to create product' };
                return { output: data };
            }

            case 'updateProduct': {
                const res = await fetch(withJsonFormat(`${baseUrl}/products/${inputs.productId}`), {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify({ product: inputs.product }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.errors?.[0]?.message || 'Failed to update product' };
                return { output: data };
            }

            case 'deleteProduct': {
                const res = await fetch(`${baseUrl}/products/${inputs.productId}`, {
                    method: 'DELETE',
                    headers,
                });
                if (!res.ok) {
                    let errMsg = 'Failed to delete product';
                    try { const d = await res.json(); errMsg = d.errors?.[0]?.message || errMsg; } catch {}
                    return { error: errMsg };
                }
                return { output: { success: true, productId: inputs.productId } };
            }

            case 'listOrders': {
                const params = new URLSearchParams({
                    limit: String(inputs.limit || 25),
                    page: String(inputs.page || 1),
                    display: 'full',
                });
                const res = await fetch(withJsonFormat(`${baseUrl}/orders?${params}`), {
                    method: 'GET',
                    headers,
                });
                const data = await res.json();
                if (!res.ok) return { error: data.errors?.[0]?.message || 'Failed to list orders' };
                return { output: data };
            }

            case 'getOrder': {
                const res = await fetch(withJsonFormat(`${baseUrl}/orders/${inputs.orderId}?display=full`), {
                    method: 'GET',
                    headers,
                });
                const data = await res.json();
                if (!res.ok) return { error: data.errors?.[0]?.message || 'Failed to get order' };
                return { output: data };
            }

            case 'createOrder': {
                const res = await fetch(withJsonFormat(`${baseUrl}/orders`), {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ order: inputs.order }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.errors?.[0]?.message || 'Failed to create order' };
                return { output: data };
            }

            case 'listCustomers': {
                const params = new URLSearchParams({
                    limit: String(inputs.limit || 25),
                    page: String(inputs.page || 1),
                    display: 'full',
                });
                const res = await fetch(withJsonFormat(`${baseUrl}/customers?${params}`), {
                    method: 'GET',
                    headers,
                });
                const data = await res.json();
                if (!res.ok) return { error: data.errors?.[0]?.message || 'Failed to list customers' };
                return { output: data };
            }

            case 'getCustomer': {
                const res = await fetch(withJsonFormat(`${baseUrl}/customers/${inputs.customerId}?display=full`), {
                    method: 'GET',
                    headers,
                });
                const data = await res.json();
                if (!res.ok) return { error: data.errors?.[0]?.message || 'Failed to get customer' };
                return { output: data };
            }

            case 'createCustomer': {
                const res = await fetch(withJsonFormat(`${baseUrl}/customers`), {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ customer: inputs.customer }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.errors?.[0]?.message || 'Failed to create customer' };
                return { output: data };
            }

            case 'listCategories': {
                const params = new URLSearchParams({
                    limit: String(inputs.limit || 25),
                    page: String(inputs.page || 1),
                    display: 'full',
                });
                const res = await fetch(withJsonFormat(`${baseUrl}/categories?${params}`), {
                    method: 'GET',
                    headers,
                });
                const data = await res.json();
                if (!res.ok) return { error: data.errors?.[0]?.message || 'Failed to list categories' };
                return { output: data };
            }

            case 'getCategory': {
                const res = await fetch(withJsonFormat(`${baseUrl}/categories/${inputs.categoryId}?display=full`), {
                    method: 'GET',
                    headers,
                });
                const data = await res.json();
                if (!res.ok) return { error: data.errors?.[0]?.message || 'Failed to get category' };
                return { output: data };
            }

            case 'listInventory': {
                const params = new URLSearchParams({
                    limit: String(inputs.limit || 25),
                    page: String(inputs.page || 1),
                    display: 'full',
                });
                const res = await fetch(withJsonFormat(`${baseUrl}/stock_availables?${params}`), {
                    method: 'GET',
                    headers,
                });
                const data = await res.json();
                if (!res.ok) return { error: data.errors?.[0]?.message || 'Failed to list inventory' };
                return { output: data };
            }

            case 'updateInventory': {
                const res = await fetch(withJsonFormat(`${baseUrl}/stock_availables/${inputs.stockId}`), {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify({ stock_available: inputs.stock }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.errors?.[0]?.message || 'Failed to update inventory' };
                return { output: data };
            }

            default:
                return { error: `PrestaShop Enhanced action "${actionName}" is not implemented.` };
        }
    } catch (err: any) {
        logger.log(`PrestaShop Enhanced action error: ${err.message}`);
        return { error: err.message || 'PrestaShop Enhanced action failed' };
    }
}
