
'use server';

async function shopwareGetToken(storeUrl: string, clientId: string, clientSecret: string, logger: any): Promise<string> {
    logger?.log('[Shopware] Fetching OAuth token');
    const res = await fetch(`${storeUrl}/api/oauth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ grant_type: 'client_credentials', client_id: clientId, client_secret: clientSecret }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.errors?.[0]?.detail || `Shopware OAuth error: ${res.status}`);
    return data.access_token;
}

async function shopwareRequest(storeUrl: string, token: string, method: string, path: string, body?: any, logger?: any): Promise<any> {
    logger?.log(`[Shopware] ${method} ${path}`);
    const options: RequestInit = {
        method,
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
        },
    };
    if (body !== undefined) options.body = JSON.stringify(body);
    const res = await fetch(`${storeUrl}/api${path}`, options);
    if (res.status === 204) return {};
    const data = await res.json();
    if (!res.ok) {
        throw new Error(data?.errors?.[0]?.detail || `Shopware API error: ${res.status}`);
    }
    return data;
}

export async function executeShopwareAction(actionName: string, inputs: any, user: any, logger: any): Promise<{ output?: any; error?: string }> {
    try {
        const storeUrl = String(inputs.storeUrl ?? '').trim().replace(/\/$/, '');
        const clientId = String(inputs.clientId ?? '').trim();
        const clientSecret = String(inputs.clientSecret ?? '').trim();
        if (!storeUrl) throw new Error('storeUrl is required.');

        let token = String(inputs.accessToken ?? '').trim();
        if (!token) {
            if (!clientId || !clientSecret) throw new Error('clientId and clientSecret (or accessToken) are required.');
            token = await shopwareGetToken(storeUrl, clientId, clientSecret, logger);
        }

        const sw = (method: string, path: string, body?: any) => shopwareRequest(storeUrl, token, method, path, body, logger);

        switch (actionName) {
            case 'listProducts': {
                const limit = Number(inputs.limit ?? 25);
                const page = Number(inputs.page ?? 1);
                const data = await sw('GET', `/product?limit=${limit}&page=${page}`);
                return { output: { products: data.data ?? [], total: data.total ?? 0 } };
            }

            case 'getProduct': {
                const id = String(inputs.id ?? '').trim();
                if (!id) throw new Error('id is required.');
                const data = await sw('GET', `/product/${id}`);
                return { output: { product: data.data ?? data } };
            }

            case 'createProduct': {
                const productData = inputs.productData ?? {};
                const data = await sw('POST', '/product', productData);
                return { output: { product: data.data ?? data } };
            }

            case 'updateProduct': {
                const id = String(inputs.id ?? '').trim();
                if (!id) throw new Error('id is required.');
                const productData = inputs.productData ?? {};
                await sw('PATCH', `/product/${id}`, productData);
                return { output: { updated: true, id } };
            }

            case 'deleteProduct': {
                const id = String(inputs.id ?? '').trim();
                if (!id) throw new Error('id is required.');
                await sw('DELETE', `/product/${id}`);
                return { output: { deleted: true, id } };
            }

            case 'listOrders': {
                const limit = Number(inputs.limit ?? 25);
                const page = Number(inputs.page ?? 1);
                const data = await sw('GET', `/order?limit=${limit}&page=${page}`);
                return { output: { orders: data.data ?? [], total: data.total ?? 0 } };
            }

            case 'getOrder': {
                const id = String(inputs.id ?? '').trim();
                if (!id) throw new Error('id is required.');
                const data = await sw('GET', `/order/${id}`);
                return { output: { order: data.data ?? data } };
            }

            case 'updateOrder': {
                const id = String(inputs.id ?? '').trim();
                if (!id) throw new Error('id is required.');
                const orderData = inputs.orderData ?? {};
                await sw('PATCH', `/order/${id}`, orderData);
                return { output: { updated: true, id } };
            }

            case 'listCustomers': {
                const limit = Number(inputs.limit ?? 25);
                const page = Number(inputs.page ?? 1);
                const data = await sw('GET', `/customer?limit=${limit}&page=${page}`);
                return { output: { customers: data.data ?? [], total: data.total ?? 0 } };
            }

            case 'getCustomer': {
                const id = String(inputs.id ?? '').trim();
                if (!id) throw new Error('id is required.');
                const data = await sw('GET', `/customer/${id}`);
                return { output: { customer: data.data ?? data } };
            }

            case 'createCustomer': {
                const customerData = inputs.customerData ?? {};
                const data = await sw('POST', '/customer', customerData);
                return { output: { customer: data.data ?? data } };
            }

            case 'listCategories': {
                const limit = Number(inputs.limit ?? 25);
                const data = await sw('GET', `/category?limit=${limit}`);
                return { output: { categories: data.data ?? [], total: data.total ?? 0 } };
            }

            case 'getCategory': {
                const id = String(inputs.id ?? '').trim();
                if (!id) throw new Error('id is required.');
                const data = await sw('GET', `/category/${id}`);
                return { output: { category: data.data ?? data } };
            }

            case 'searchProducts': {
                const criteria = inputs.criteria ?? {};
                const data = await sw('POST', '/search/product', criteria);
                return { output: { products: data.data ?? [], total: data.total ?? 0 } };
            }

            case 'listManufacturers': {
                const limit = Number(inputs.limit ?? 25);
                const data = await sw('GET', `/product-manufacturer?limit=${limit}`);
                return { output: { manufacturers: data.data ?? [], total: data.total ?? 0 } };
            }

            default:
                return { error: `Shopware action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Shopware action failed.' };
    }
}
