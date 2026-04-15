'use server';

export async function executeVolusionAction(actionName: string, inputs: any, user: any, logger: any) {
    const siteUrl = (inputs.siteUrl || '').replace(/\/$/, '');
    const baseUrl = `${siteUrl}/api/aspdotnetstorefront`;

    const credentials = `${inputs.login || ''}:${inputs.encryptedPassword || ''}`;
    const basicAuth = Buffer.from(credentials).toString('base64');

    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${basicAuth}`,
    };

    if (inputs.apiKey) {
        headers['X-Volusion-ApiKey'] = inputs.apiKey;
    }

    try {
        switch (actionName) {
            case 'listProducts': {
                const res = await fetch(`${baseUrl}/products?Page=${inputs.page || 1}&PageSize=${inputs.pageSize || 25}`, {
                    method: 'GET',
                    headers,
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to list products' };
                return { output: data };
            }

            case 'getProduct': {
                const res = await fetch(`${baseUrl}/products/${inputs.productId}`, {
                    method: 'GET',
                    headers,
                });
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
                const res = await fetch(`${baseUrl}/orders?Page=${inputs.page || 1}&PageSize=${inputs.pageSize || 25}`, {
                    method: 'GET',
                    headers,
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to list orders' };
                return { output: data };
            }

            case 'getOrder': {
                const res = await fetch(`${baseUrl}/orders/${inputs.orderId}`, {
                    method: 'GET',
                    headers,
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to get order' };
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

            case 'listCustomers': {
                const res = await fetch(`${baseUrl}/customers?Page=${inputs.page || 1}&PageSize=${inputs.pageSize || 25}`, {
                    method: 'GET',
                    headers,
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to list customers' };
                return { output: data };
            }

            case 'getCustomer': {
                const res = await fetch(`${baseUrl}/customers/${inputs.customerId}`, {
                    method: 'GET',
                    headers,
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to get customer' };
                return { output: data };
            }

            case 'createCustomer': {
                const res = await fetch(`${baseUrl}/customers`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(inputs.customer),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to create customer' };
                return { output: data };
            }

            case 'updateCustomer': {
                const res = await fetch(`${baseUrl}/customers/${inputs.customerId}`, {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify(inputs.customer),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to update customer' };
                return { output: data };
            }

            case 'listCategories': {
                const res = await fetch(`${baseUrl}/categories?Page=${inputs.page || 1}&PageSize=${inputs.pageSize || 25}`, {
                    method: 'GET',
                    headers,
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to list categories' };
                return { output: data };
            }

            case 'getInventory': {
                const res = await fetch(`${baseUrl}/inventory?ProductId=${inputs.productId || ''}`, {
                    method: 'GET',
                    headers,
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to get inventory' };
                return { output: data };
            }

            case 'updateInventory': {
                const res = await fetch(`${baseUrl}/inventory/${inputs.inventoryId}`, {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify(inputs.inventory),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to update inventory' };
                return { output: data };
            }

            default:
                return { error: `Volusion action "${actionName}" is not implemented.` };
        }
    } catch (err: any) {
        logger.log(`Volusion action error: ${err.message}`);
        return { error: err.message || 'Volusion action failed' };
    }
}
