
'use server';

async function akeneoGetToken(storeUrl: string, clientId: string, clientSecret: string, username: string, password: string, logger: any): Promise<string> {
    logger?.log('[Akeneo] Fetching OAuth token');
    const base64Auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const res = await fetch(`${storeUrl}/api/oauth/v1/token`, {
        method: 'POST',
        headers: {
            Authorization: `Basic ${base64Auth}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ grant_type: 'password', username, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.message || `Akeneo OAuth error: ${res.status}`);
    return data.access_token;
}

async function akeneoRequest(storeUrl: string, token: string, method: string, path: string, body?: any, logger?: any): Promise<any> {
    logger?.log(`[Akeneo] ${method} ${path}`);
    const options: RequestInit = {
        method,
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
    };
    if (body !== undefined) options.body = JSON.stringify(body);
    const res = await fetch(`${storeUrl}/api/rest/v1${path}`, options);
    if (res.status === 204 || res.status === 201) {
        const location = res.headers.get('Location');
        return { success: true, location };
    }
    const data = await res.json();
    if (!res.ok) {
        throw new Error(data?.message || `Akeneo API error: ${res.status}`);
    }
    return data;
}

export async function executeAkeneoAction(actionName: string, inputs: any, user: any, logger: any): Promise<{ output?: any; error?: string }> {
    try {
        const storeUrl = String(inputs.storeUrl ?? '').trim().replace(/\/$/, '');
        if (!storeUrl) throw new Error('storeUrl is required.');

        let token = String(inputs.accessToken ?? '').trim();
        if (!token) {
            const clientId = String(inputs.clientId ?? '').trim();
            const clientSecret = String(inputs.clientSecret ?? '').trim();
            const username = String(inputs.username ?? '').trim();
            const password = String(inputs.password ?? '').trim();
            if (!clientId || !clientSecret || !username || !password) {
                throw new Error('clientId, clientSecret, username, and password (or accessToken) are required.');
            }
            token = await akeneoGetToken(storeUrl, clientId, clientSecret, username, password, logger);
        }

        const ak = (method: string, path: string, body?: any) => akeneoRequest(storeUrl, token, method, path, body, logger);

        switch (actionName) {
            case 'listProducts': {
                const limit = Number(inputs.limit ?? 10);
                const page = Number(inputs.page ?? 1);
                const data = await ak('GET', `/products?limit=${limit}&page=${page}`);
                return { output: { products: data._embedded?.items ?? [], count: data._embedded?.items?.length ?? 0, total: data.items_count } };
            }

            case 'getProduct': {
                const sku = String(inputs.sku ?? '').trim();
                if (!sku) throw new Error('sku is required.');
                const data = await ak('GET', `/products/${encodeURIComponent(sku)}`);
                return { output: { product: data } };
            }

            case 'createProduct': {
                const productData = inputs.productData ?? {};
                const result = await ak('POST', '/products', productData);
                return { output: { created: true, location: result.location } };
            }

            case 'updateProduct': {
                const sku = String(inputs.sku ?? '').trim();
                if (!sku) throw new Error('sku is required.');
                const productData = inputs.productData ?? {};
                const result = await ak('PATCH', `/products/${encodeURIComponent(sku)}`, productData);
                return { output: { updated: true, sku, location: result.location } };
            }

            case 'listProductModels': {
                const limit = Number(inputs.limit ?? 10);
                const data = await ak('GET', `/product-models?limit=${limit}`);
                return { output: { productModels: data._embedded?.items ?? [], count: data._embedded?.items?.length ?? 0 } };
            }

            case 'listFamilies': {
                const limit = Number(inputs.limit ?? 10);
                const data = await ak('GET', `/families?limit=${limit}`);
                return { output: { families: data._embedded?.items ?? [], count: data._embedded?.items?.length ?? 0 } };
            }

            case 'getFamily': {
                const code = String(inputs.code ?? '').trim();
                if (!code) throw new Error('code is required.');
                const data = await ak('GET', `/families/${encodeURIComponent(code)}`);
                return { output: { family: data } };
            }

            case 'listAttributes': {
                const limit = Number(inputs.limit ?? 10);
                const data = await ak('GET', `/attributes?limit=${limit}`);
                return { output: { attributes: data._embedded?.items ?? [], count: data._embedded?.items?.length ?? 0 } };
            }

            case 'getAttribute': {
                const code = String(inputs.code ?? '').trim();
                if (!code) throw new Error('code is required.');
                const data = await ak('GET', `/attributes/${encodeURIComponent(code)}`);
                return { output: { attribute: data } };
            }

            case 'listCategories': {
                const limit = Number(inputs.limit ?? 10);
                const data = await ak('GET', `/categories?limit=${limit}`);
                return { output: { categories: data._embedded?.items ?? [], count: data._embedded?.items?.length ?? 0 } };
            }

            case 'getCategory': {
                const code = String(inputs.code ?? '').trim();
                if (!code) throw new Error('code is required.');
                const data = await ak('GET', `/categories/${encodeURIComponent(code)}`);
                return { output: { category: data } };
            }

            case 'listChannels': {
                const data = await ak('GET', '/channels');
                return { output: { channels: data._embedded?.items ?? [], count: data._embedded?.items?.length ?? 0 } };
            }

            case 'listLocales': {
                const data = await ak('GET', '/locales');
                return { output: { locales: data._embedded?.items ?? [], count: data._embedded?.items?.length ?? 0 } };
            }

            case 'exportProducts': {
                const limit = Number(inputs.limit ?? 100);
                const data = await ak('GET', `/products?limit=${limit}&with_count=true`);
                return { output: { products: data._embedded?.items ?? [], total: data.items_count, count: data._embedded?.items?.length ?? 0 } };
            }

            case 'searchProducts': {
                const search = inputs.search ?? {};
                const searchJson = encodeURIComponent(JSON.stringify(search));
                const limit = Number(inputs.limit ?? 10);
                const data = await ak('GET', `/products?search=${searchJson}&limit=${limit}`);
                return { output: { products: data._embedded?.items ?? [], count: data._embedded?.items?.length ?? 0, total: data.items_count } };
            }

            default:
                return { error: `Akeneo action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Akeneo action failed.' };
    }
}
