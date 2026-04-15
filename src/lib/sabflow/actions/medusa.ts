'use server';

async function medusaFetch(medusaUrl: string, apiKey: string, method: string, path: string, body?: any, logger?: any) {
    logger?.log(`[Medusa] ${method} ${path}`);
    const url = `${medusaUrl.replace(/\/$/, '')}/admin${path}`;
    const options: RequestInit = {
        method,
        headers: {
            'x-medusa-access-token': apiKey,
            'Content-Type': 'application/json',
            Accept: 'application/json',
        },
    };
    if (body !== undefined) options.body = JSON.stringify(body);
    const res = await fetch(url, options);
    if (res.status === 204) return {};
    const text = await res.text();
    let data: any;
    try { data = JSON.parse(text); } catch { data = text; }
    if (!res.ok) {
        throw new Error(data?.message || `Medusa API error: ${res.status}`);
    }
    return data;
}

export async function executeMedusaAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const medusaUrl = String(inputs.medusaUrl ?? '').trim();
        const apiKey = String(inputs.apiKey ?? '').trim();
        if (!medusaUrl || !apiKey) throw new Error('medusaUrl and apiKey are required.');
        const api = (method: string, path: string, body?: any) => medusaFetch(medusaUrl, apiKey, method, path, body, logger);

        switch (actionName) {
            case 'listProducts': {
                const limit = Number(inputs.limit ?? 20);
                const offset = Number(inputs.offset ?? 0);
                const data = await api('GET', `/products?limit=${limit}&offset=${offset}`);
                return { output: { products: data.products ?? [], count: data.count ?? 0 } };
            }

            case 'getProduct': {
                const productId = String(inputs.productId ?? '').trim();
                if (!productId) throw new Error('productId is required.');
                const data = await api('GET', `/products/${productId}`);
                return { output: { product: data.product } };
            }

            case 'createProduct': {
                const title = String(inputs.title ?? '').trim();
                if (!title) throw new Error('title is required.');
                const payload: Record<string, any> = { title };
                if (inputs.description) payload.description = String(inputs.description);
                if (inputs.status) payload.status = String(inputs.status);
                if (inputs.handle) payload.handle = String(inputs.handle);
                const data = await api('POST', '/products', payload);
                return { output: { product: data.product } };
            }

            case 'updateProduct': {
                const productId = String(inputs.productId ?? '').trim();
                if (!productId) throw new Error('productId is required.');
                const payload: Record<string, any> = {};
                if (inputs.title) payload.title = String(inputs.title);
                if (inputs.description) payload.description = String(inputs.description);
                if (inputs.status) payload.status = String(inputs.status);
                const data = await api('POST', `/products/${productId}`, payload);
                return { output: { product: data.product } };
            }

            case 'deleteProduct': {
                const productId = String(inputs.productId ?? '').trim();
                if (!productId) throw new Error('productId is required.');
                const data = await api('DELETE', `/products/${productId}`);
                return { output: { deleted: true, id: productId, result: data } };
            }

            case 'listOrders': {
                const limit = Number(inputs.limit ?? 20);
                const offset = Number(inputs.offset ?? 0);
                const status = String(inputs.status ?? '').trim();
                const qs = status ? `?limit=${limit}&offset=${offset}&status[]=${status}` : `?limit=${limit}&offset=${offset}`;
                const data = await api('GET', `/orders${qs}`);
                return { output: { orders: data.orders ?? [], count: data.count ?? 0 } };
            }

            case 'getOrder': {
                const orderId = String(inputs.orderId ?? '').trim();
                if (!orderId) throw new Error('orderId is required.');
                const data = await api('GET', `/orders/${orderId}`);
                return { output: { order: data.order } };
            }

            case 'updateOrder': {
                const orderId = String(inputs.orderId ?? '').trim();
                if (!orderId) throw new Error('orderId is required.');
                const payload: Record<string, any> = {};
                if (inputs.email) payload.email = String(inputs.email);
                if (inputs.no_notification !== undefined) payload.no_notification = Boolean(inputs.no_notification);
                const data = await api('POST', `/orders/${orderId}`, payload);
                return { output: { order: data.order } };
            }

            case 'cancelOrder': {
                const orderId = String(inputs.orderId ?? '').trim();
                if (!orderId) throw new Error('orderId is required.');
                const data = await api('POST', `/orders/${orderId}/cancel`);
                return { output: { order: data.order } };
            }

            case 'listCustomers': {
                const limit = Number(inputs.limit ?? 20);
                const offset = Number(inputs.offset ?? 0);
                const data = await api('GET', `/customers?limit=${limit}&offset=${offset}`);
                return { output: { customers: data.customers ?? [], count: data.count ?? 0 } };
            }

            case 'getCustomer': {
                const customerId = String(inputs.customerId ?? '').trim();
                if (!customerId) throw new Error('customerId is required.');
                const data = await api('GET', `/customers/${customerId}`);
                return { output: { customer: data.customer } };
            }

            case 'listRegions': {
                const limit = Number(inputs.limit ?? 20);
                const offset = Number(inputs.offset ?? 0);
                const data = await api('GET', `/regions?limit=${limit}&offset=${offset}`);
                return { output: { regions: data.regions ?? [], count: data.count ?? 0 } };
            }

            case 'getRegion': {
                const regionId = String(inputs.regionId ?? '').trim();
                if (!regionId) throw new Error('regionId is required.');
                const data = await api('GET', `/regions/${regionId}`);
                return { output: { region: data.region } };
            }

            case 'listShippingOptions': {
                const regionId = String(inputs.regionId ?? '').trim();
                const qs = regionId ? `?region_id=${regionId}` : '';
                const data = await api('GET', `/shipping-options${qs}`);
                return { output: { shippingOptions: data.shipping_options ?? [], count: (data.shipping_options ?? []).length } };
            }

            case 'listDiscounts': {
                const limit = Number(inputs.limit ?? 20);
                const offset = Number(inputs.offset ?? 0);
                const data = await api('GET', `/discounts?limit=${limit}&offset=${offset}`);
                return { output: { discounts: data.discounts ?? [], count: data.count ?? 0 } };
            }

            default:
                throw new Error(`Unknown Medusa action: ${actionName}`);
        }
    } catch (err: any) {
        return { error: err.message ?? String(err) };
    }
}
