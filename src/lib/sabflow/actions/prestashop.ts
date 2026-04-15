
'use server';

async function psRequest(storeUrl: string, apiKey: string, method: string, path: string, body?: any, logger?: any): Promise<any> {
    logger?.log(`[PrestaShop] ${method} ${path}`);
    const base64Auth = Buffer.from(`${apiKey}:`).toString('base64');
    const separator = path.includes('?') ? '&' : '?';
    const url = `${storeUrl}/api${path}${separator}output_format=JSON`;
    const options: RequestInit = {
        method,
        headers: {
            Authorization: `Basic ${base64Auth}`,
            'Content-Type': 'application/json',
        },
    };
    if (body !== undefined) options.body = JSON.stringify(body);
    const res = await fetch(url, options);
    if (res.status === 204) return {};
    const data = await res.json();
    if (!res.ok) {
        throw new Error(data?.errors?.[0]?.message || data?.error || `PrestaShop API error: ${res.status}`);
    }
    return data;
}

export async function executePrestaShopAction(actionName: string, inputs: any, user: any, logger: any): Promise<{ output?: any; error?: string }> {
    try {
        const storeUrl = String(inputs.storeUrl ?? '').trim().replace(/\/$/, '');
        const apiKey = String(inputs.apiKey ?? '').trim();
        if (!storeUrl || !apiKey) throw new Error('storeUrl and apiKey are required.');

        const ps = (method: string, path: string, body?: any) => psRequest(storeUrl, apiKey, method, path, body, logger);

        switch (actionName) {
            case 'listProducts': {
                const limit = Number(inputs.limit ?? 50);
                const page = Number(inputs.page ?? 1);
                const data = await ps('GET', `/products?limit=${limit}&page=${page}`);
                return { output: { products: data.products ?? [], count: data.products?.length ?? 0 } };
            }

            case 'getProduct': {
                const id = String(inputs.id ?? '').trim();
                if (!id) throw new Error('id is required.');
                const data = await ps('GET', `/products/${id}`);
                return { output: { product: data.product ?? data } };
            }

            case 'createProduct': {
                const productData = inputs.productData ?? {};
                const data = await ps('POST', '/products', { product: productData });
                return { output: { product: data.product ?? data, id: data.product?.id } };
            }

            case 'updateProduct': {
                const id = String(inputs.id ?? '').trim();
                if (!id) throw new Error('id is required.');
                const productData = inputs.productData ?? {};
                const data = await ps('PUT', `/products/${id}`, { product: productData });
                return { output: { product: data.product ?? data } };
            }

            case 'deleteProduct': {
                const id = String(inputs.id ?? '').trim();
                if (!id) throw new Error('id is required.');
                await ps('DELETE', `/products/${id}`);
                return { output: { deleted: true, id } };
            }

            case 'listOrders': {
                const limit = Number(inputs.limit ?? 50);
                const page = Number(inputs.page ?? 1);
                const data = await ps('GET', `/orders?limit=${limit}&page=${page}`);
                return { output: { orders: data.orders ?? [], count: data.orders?.length ?? 0 } };
            }

            case 'getOrder': {
                const id = String(inputs.id ?? '').trim();
                if (!id) throw new Error('id is required.');
                const data = await ps('GET', `/orders/${id}`);
                return { output: { order: data.order ?? data } };
            }

            case 'updateOrderStatus': {
                const id = String(inputs.id ?? '').trim();
                const currentState = String(inputs.currentState ?? '').trim();
                if (!id) throw new Error('id is required.');
                const data = await ps('PUT', `/orders/${id}`, { order: { current_state: currentState } });
                return { output: { order: data.order ?? data } };
            }

            case 'listCustomers': {
                const limit = Number(inputs.limit ?? 50);
                const page = Number(inputs.page ?? 1);
                const data = await ps('GET', `/customers?limit=${limit}&page=${page}`);
                return { output: { customers: data.customers ?? [], count: data.customers?.length ?? 0 } };
            }

            case 'getCustomer': {
                const id = String(inputs.id ?? '').trim();
                if (!id) throw new Error('id is required.');
                const data = await ps('GET', `/customers/${id}`);
                return { output: { customer: data.customer ?? data } };
            }

            case 'createCustomer': {
                const customerData = inputs.customerData ?? {};
                const data = await ps('POST', '/customers', { customer: customerData });
                return { output: { customer: data.customer ?? data, id: data.customer?.id } };
            }

            case 'listCategories': {
                const limit = Number(inputs.limit ?? 50);
                const data = await ps('GET', `/categories?limit=${limit}`);
                return { output: { categories: data.categories ?? [], count: data.categories?.length ?? 0 } };
            }

            case 'getCategory': {
                const id = String(inputs.id ?? '').trim();
                if (!id) throw new Error('id is required.');
                const data = await ps('GET', `/categories/${id}`);
                return { output: { category: data.category ?? data } };
            }

            case 'listManufacturers': {
                const limit = Number(inputs.limit ?? 50);
                const data = await ps('GET', `/manufacturers?limit=${limit}`);
                return { output: { manufacturers: data.manufacturers ?? [], count: data.manufacturers?.length ?? 0 } };
            }

            case 'getStock': {
                const productId = String(inputs.productId ?? '').trim();
                if (!productId) throw new Error('productId is required.');
                const data = await ps('GET', `/stock_availables?filter[id_product]=${productId}`);
                return { output: { stock: data.stock_availables ?? data } };
            }

            default:
                return { error: `PrestaShop action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'PrestaShop action failed.' };
    }
}
