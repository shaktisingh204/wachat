
'use server';

async function ecwidFetch(
    storeId: string,
    apiKey: string,
    method: string,
    path: string,
    body?: any,
    extraQuery?: Record<string, string>,
    logger?: any
) {
    logger?.log(`[Ecwid] ${method} /api/v3/${storeId}${path}`);
    const url = new URL(`https://app.ecwid.com/api/v3/${storeId}${path}`);
    url.searchParams.set('token', apiKey);
    if (extraQuery) {
        for (const [k, v] of Object.entries(extraQuery)) {
            url.searchParams.set(k, v);
        }
    }
    const options: RequestInit = {
        method,
        headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
        },
    };
    if (body !== undefined) options.body = JSON.stringify(body);
    const res = await fetch(url.toString(), options);
    if (res.status === 204) return {};
    const data = await res.json();
    if (!res.ok) {
        throw new Error(data?.errorMessage || data?.message || `Ecwid API error: ${res.status}`);
    }
    return data;
}

export async function executeEcwidAction(
    actionName: string,
    inputs: any,
    user: any,
    logger: any
): Promise<{ output?: any; error?: string }> {
    try {
        const storeId = String(inputs.storeId ?? '').trim();
        const apiKey = String(inputs.apiKey ?? '').trim();
        if (!storeId || !apiKey) throw new Error('storeId and apiKey are required.');

        const ec = (method: string, path: string, body?: any, query?: Record<string, string>) =>
            ecwidFetch(storeId, apiKey, method, path, body, query, logger);

        switch (actionName) {
            // Products
            case 'listProducts': {
                const limit = Math.max(1, Math.min(100, Number(inputs.limit) || 20));
                const offset = Math.max(0, Number(inputs.offset) || 0);
                const data = await ec('GET', '/products', undefined, { limit: String(limit), offset: String(offset) });
                return { output: { products: data.items ?? [], total: data.total, count: data.count } };
            }

            case 'getProduct': {
                const productId = String(inputs.productId ?? '').trim();
                if (!productId) throw new Error('productId is required.');
                const data = await ec('GET', `/products/${productId}`);
                return { output: { product: data } };
            }

            case 'createProduct': {
                const name = String(inputs.name ?? '').trim();
                if (!name) throw new Error('name is required.');
                const body: any = { name };
                if (inputs.price !== undefined) body.price = Number(inputs.price);
                if (inputs.sku) body.sku = String(inputs.sku);
                if (inputs.description) body.description = String(inputs.description);
                if (inputs.quantity !== undefined) body.quantity = Number(inputs.quantity);
                if (inputs.weight !== undefined) body.weight = Number(inputs.weight);
                if (inputs.enabled !== undefined) body.enabled = Boolean(inputs.enabled);
                const data = await ec('POST', '/products', body);
                logger.log(`[Ecwid] Created product ${data.id}`);
                return { output: { productId: String(data.id) } };
            }

            case 'updateProduct': {
                const productId = String(inputs.productId ?? '').trim();
                if (!productId) throw new Error('productId is required.');
                const body: any = {};
                if (inputs.name) body.name = String(inputs.name);
                if (inputs.price !== undefined) body.price = Number(inputs.price);
                if (inputs.sku) body.sku = String(inputs.sku);
                if (inputs.description) body.description = String(inputs.description);
                if (inputs.quantity !== undefined) body.quantity = Number(inputs.quantity);
                if (inputs.enabled !== undefined) body.enabled = Boolean(inputs.enabled);
                await ec('PUT', `/products/${productId}`, body);
                return { output: { updated: true, productId } };
            }

            case 'deleteProduct': {
                const productId = String(inputs.productId ?? '').trim();
                if (!productId) throw new Error('productId is required.');
                await ec('DELETE', `/products/${productId}`);
                logger.log(`[Ecwid] Deleted product ${productId}`);
                return { output: { deleted: true, productId } };
            }

            case 'searchProducts': {
                const keyword = String(inputs.keyword ?? '').trim();
                const limit = Math.max(1, Math.min(100, Number(inputs.limit) || 20));
                const query: Record<string, string> = { limit: String(limit) };
                if (keyword) query.keyword = keyword;
                if (inputs.categoryId) query.categoryId = String(inputs.categoryId);
                if (inputs.minPrice !== undefined) query.minPrice = String(inputs.minPrice);
                if (inputs.maxPrice !== undefined) query.maxPrice = String(inputs.maxPrice);
                const data = await ec('GET', '/products', undefined, query);
                return { output: { products: data.items ?? [], total: data.total } };
            }

            case 'uploadProductImage': {
                const productId = String(inputs.productId ?? '').trim();
                const imageUrl = String(inputs.imageUrl ?? '').trim();
                if (!productId || !imageUrl) throw new Error('productId and imageUrl are required.');
                const data = await ec('POST', `/products/${productId}/gallery`, { url: imageUrl });
                return { output: { image: data } };
            }

            // Orders
            case 'listOrders': {
                const limit = Math.max(1, Math.min(100, Number(inputs.limit) || 20));
                const offset = Math.max(0, Number(inputs.offset) || 0);
                const query: Record<string, string> = { limit: String(limit), offset: String(offset) };
                if (inputs.paymentStatus) query.paymentStatus = inputs.paymentStatus;
                if (inputs.fulfillmentStatus) query.fulfillmentStatus = inputs.fulfillmentStatus;
                const data = await ec('GET', '/orders', undefined, query);
                return { output: { orders: data.items ?? [], total: data.total, count: data.count } };
            }

            case 'getOrder': {
                const orderId = String(inputs.orderId ?? '').trim();
                if (!orderId) throw new Error('orderId is required.');
                const data = await ec('GET', `/orders/${orderId}`);
                return { output: { order: data } };
            }

            case 'updateOrderStatus': {
                const orderId = String(inputs.orderId ?? '').trim();
                if (!orderId) throw new Error('orderId is required.');
                const body: any = {};
                if (inputs.paymentStatus) body.paymentStatus = String(inputs.paymentStatus);
                if (inputs.fulfillmentStatus) body.fulfillmentStatus = String(inputs.fulfillmentStatus);
                await ec('PUT', `/orders/${orderId}`, body);
                return { output: { updated: true, orderId } };
            }

            case 'getOrderCount': {
                const query: Record<string, string> = {};
                if (inputs.paymentStatus) query.paymentStatus = inputs.paymentStatus;
                if (inputs.fulfillmentStatus) query.fulfillmentStatus = inputs.fulfillmentStatus;
                const data = await ec('GET', '/orders/count', undefined, query);
                return { output: { count: data.count } };
            }

            // Customers
            case 'listCustomers': {
                const limit = Math.max(1, Math.min(100, Number(inputs.limit) || 20));
                const offset = Math.max(0, Number(inputs.offset) || 0);
                const data = await ec('GET', '/customers', undefined, { limit: String(limit), offset: String(offset) });
                return { output: { customers: data.items ?? [], total: data.total } };
            }

            case 'getCustomer': {
                const customerId = String(inputs.customerId ?? '').trim();
                if (!customerId) throw new Error('customerId is required.');
                const data = await ec('GET', `/customers/${customerId}`);
                return { output: { customer: data } };
            }

            // Categories
            case 'listCategories': {
                const data = await ec('GET', '/categories');
                return { output: { categories: data.items ?? [], total: data.total } };
            }

            case 'createCategory': {
                const name = String(inputs.name ?? '').trim();
                if (!name) throw new Error('name is required.');
                const body: any = { name };
                if (inputs.parentId !== undefined) body.parentId = Number(inputs.parentId);
                if (inputs.description) body.description = String(inputs.description);
                if (inputs.orderBy) body.orderBy = String(inputs.orderBy);
                const data = await ec('POST', '/categories', body);
                logger.log(`[Ecwid] Created category ${data.id}`);
                return { output: { categoryId: String(data.id) } };
            }

            // Store
            case 'getStoreProfile': {
                const data = await ec('GET', '/profile');
                return { output: { profile: data } };
            }

            // Coupons
            case 'listCoupons': {
                const limit = Math.max(1, Math.min(100, Number(inputs.limit) || 20));
                const data = await ec('GET', '/discount-coupons', undefined, { limit: String(limit) });
                return { output: { coupons: data.items ?? [], total: data.total } };
            }

            case 'createCoupon': {
                const code = String(inputs.code ?? '').trim();
                const discountType = String(inputs.discountType ?? 'ABS').trim();
                const discount = Number(inputs.discount ?? 0);
                if (!code) throw new Error('code is required.');
                const body: any = { code, discountType, discount };
                if (inputs.name) body.name = String(inputs.name);
                if (inputs.usesLimit !== undefined) body.usesLimit = String(inputs.usesLimit);
                if (inputs.expirationDate) body.expirationDate = String(inputs.expirationDate);
                if (inputs.minimumOrderAmount !== undefined) body.minimumOrderAmount = Number(inputs.minimumOrderAmount);
                const data = await ec('POST', '/discount-coupons', body);
                logger.log(`[Ecwid] Created coupon ${data.id}`);
                return { output: { couponId: String(data.id), code } };
            }

            default:
                return { error: `Ecwid action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        const msg = e?.message || 'Ecwid action failed.';
        return { error: typeof msg === 'string' ? msg : JSON.stringify(msg) };
    }
}
