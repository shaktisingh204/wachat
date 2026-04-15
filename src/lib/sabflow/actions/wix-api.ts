'use server';

export async function executeWixApiAction(actionName: string, inputs: any, user: any, logger: any) {
    const baseUrl = 'https://www.wixapis.com';

    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
    };

    if (inputs.accessToken) {
        headers['Authorization'] = `Bearer ${inputs.accessToken}`;
    }
    if (inputs.apiKey) {
        headers['wix-api-key'] = inputs.apiKey;
    }

    try {
        switch (actionName) {
            case 'listSites': {
                const res = await fetch(`${baseUrl}/site-list/v2/sites/query`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ query: {} }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to list sites' };
                return { output: data };
            }

            case 'getSite': {
                const res = await fetch(`${baseUrl}/site-list/v2/sites/${inputs.siteId}`, {
                    method: 'GET',
                    headers,
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to get site' };
                return { output: data };
            }

            case 'listProducts': {
                const res = await fetch(`${baseUrl}/stores/v1/products/query`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ query: { paging: { limit: inputs.limit || 50 } } }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to list products' };
                return { output: data };
            }

            case 'getProduct': {
                const res = await fetch(`${baseUrl}/stores/v1/products/${inputs.productId}`, {
                    method: 'GET',
                    headers,
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to get product' };
                return { output: data };
            }

            case 'createProduct': {
                const res = await fetch(`${baseUrl}/stores/v1/products`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ product: inputs.product }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to create product' };
                return { output: data };
            }

            case 'updateProduct': {
                const res = await fetch(`${baseUrl}/stores/v1/products/${inputs.productId}`, {
                    method: 'PATCH',
                    headers,
                    body: JSON.stringify({ product: inputs.product }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to update product' };
                return { output: data };
            }

            case 'deleteProduct': {
                const res = await fetch(`${baseUrl}/stores/v1/products/${inputs.productId}`, {
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
                const res = await fetch(`${baseUrl}/stores/v2/orders/query`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ query: { paging: { limit: inputs.limit || 50 } } }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to list orders' };
                return { output: data };
            }

            case 'getOrder': {
                const res = await fetch(`${baseUrl}/stores/v2/orders/${inputs.orderId}`, {
                    method: 'GET',
                    headers,
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to get order' };
                return { output: data };
            }

            case 'updateOrder': {
                const res = await fetch(`${baseUrl}/stores/v2/orders/${inputs.orderId}`, {
                    method: 'PATCH',
                    headers,
                    body: JSON.stringify({ order: inputs.order }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to update order' };
                return { output: data };
            }

            case 'listContacts': {
                const res = await fetch(`${baseUrl}/contacts/v4/contacts/query`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ query: { paging: { limit: inputs.limit || 50 } } }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to list contacts' };
                return { output: data };
            }

            case 'createContact': {
                const res = await fetch(`${baseUrl}/contacts/v4/contacts`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ info: inputs.info }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to create contact' };
                return { output: data };
            }

            case 'updateContact': {
                const res = await fetch(`${baseUrl}/contacts/v4/contacts/${inputs.contactId}`, {
                    method: 'PATCH',
                    headers,
                    body: JSON.stringify({ info: inputs.info }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to update contact' };
                return { output: data };
            }

            case 'listMembers': {
                const res = await fetch(`${baseUrl}/members/v1/members/query`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ query: { paging: { limit: inputs.limit || 50 } } }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to list members' };
                return { output: data };
            }

            case 'triggerAutomation': {
                const res = await fetch(`${baseUrl}/automations/v1/automations/${inputs.automationId}/trigger`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ payload: inputs.payload || {} }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to trigger automation' };
                return { output: data };
            }

            default:
                return { error: `Wix API action "${actionName}" is not implemented.` };
        }
    } catch (err: any) {
        logger.log(`Wix API action error: ${err.message}`);
        return { error: err.message || 'Wix API action failed' };
    }
}
