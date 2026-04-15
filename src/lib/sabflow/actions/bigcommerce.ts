
'use server';

async function bcFetch(
    storeHash: string,
    accessToken: string,
    method: string,
    path: string,
    body?: any,
    apiVersion: 'v2' | 'v3' = 'v2',
    logger?: any
) {
    logger?.log(`[BigCommerce] ${method} ${apiVersion}${path}`);
    const url = `https://api.bigcommerce.com/stores/${storeHash}/${apiVersion}${path}`;
    const options: RequestInit = {
        method,
        headers: {
            'X-Auth-Token': accessToken,
            'Content-Type': 'application/json',
            Accept: 'application/json',
        },
    };
    if (body !== undefined) options.body = JSON.stringify(body);
    const res = await fetch(url, options);
    if (res.status === 204) return {};
    const data = await res.json();
    if (!res.ok) {
        throw new Error(data?.title || data?.errors?.[0] || `BigCommerce API error: ${res.status}`);
    }
    return data;
}

export async function executeBigCommerceAction(
    actionName: string,
    inputs: any,
    user: any,
    logger: any
): Promise<{ output?: any; error?: string }> {
    try {
        const storeHash = String(inputs.storeHash ?? '').trim();
        const accessToken = String(inputs.accessToken ?? '').trim();
        if (!storeHash || !accessToken) throw new Error('storeHash and accessToken are required.');

        const v2 = (method: string, path: string, body?: any) =>
            bcFetch(storeHash, accessToken, method, path, body, 'v2', logger);
        const v3 = (method: string, path: string, body?: any) =>
            bcFetch(storeHash, accessToken, method, path, body, 'v3', logger);

        switch (actionName) {
            // Products (v3)
            case 'listProducts': {
                const limit = Math.max(1, Math.min(250, Number(inputs.limit) || 20));
                const page = Math.max(1, Number(inputs.page) || 1);
                const data = await v3('GET', `/catalog/products?limit=${limit}&page=${page}&include=images,variants`);
                const products = data.data ?? [];
                return { output: { products, count: products.length, meta: data.meta } };
            }

            case 'getProduct': {
                const productId = String(inputs.productId ?? '').trim();
                if (!productId) throw new Error('productId is required.');
                const data = await v3('GET', `/catalog/products/${productId}?include=images,variants`);
                return { output: { product: data.data } };
            }

            case 'createProduct': {
                const name = String(inputs.name ?? '').trim();
                if (!name) throw new Error('name is required.');
                const price = Number(inputs.price ?? 0);
                const type = String(inputs.type ?? 'physical');
                const weight = Number(inputs.weight ?? 0);
                const body: any = { name, type, price, weight };
                if (inputs.sku) body.sku = String(inputs.sku);
                if (inputs.description) body.description = String(inputs.description);
                if (inputs.inventoryLevel !== undefined) body.inventory_level = Number(inputs.inventoryLevel);
                if (inputs.categoryIds) body.categories = Array.isArray(inputs.categoryIds) ? inputs.categoryIds : [inputs.categoryIds];
                const data = await v3('POST', '/catalog/products', body);
                logger.log(`[BigCommerce] Created product ${data.data?.id}`);
                return { output: { product: data.data, productId: String(data.data?.id) } };
            }

            case 'updateProduct': {
                const productId = String(inputs.productId ?? '').trim();
                if (!productId) throw new Error('productId is required.');
                const body: any = {};
                if (inputs.name) body.name = String(inputs.name);
                if (inputs.price !== undefined) body.price = Number(inputs.price);
                if (inputs.description) body.description = String(inputs.description);
                if (inputs.inventoryLevel !== undefined) body.inventory_level = Number(inputs.inventoryLevel);
                if (inputs.isVisible !== undefined) body.is_visible = Boolean(inputs.isVisible);
                const data = await v3('PUT', `/catalog/products/${productId}`, body);
                return { output: { product: data.data } };
            }

            case 'deleteProduct': {
                const productId = String(inputs.productId ?? '').trim();
                if (!productId) throw new Error('productId is required.');
                await v3('DELETE', `/catalog/products/${productId}`);
                logger.log(`[BigCommerce] Deleted product ${productId}`);
                return { output: { deleted: true, productId } };
            }

            // Orders (v2)
            case 'listOrders': {
                const limit = Math.max(1, Math.min(250, Number(inputs.limit) || 20));
                const page = Math.max(1, Number(inputs.page) || 1);
                const statusId = inputs.statusId ? `&status_id=${inputs.statusId}` : '';
                const data = await v2('GET', `/orders?limit=${limit}&page=${page}${statusId}`);
                const orders = Array.isArray(data) ? data : [];
                return { output: { orders, count: orders.length } };
            }

            case 'getOrder': {
                const orderId = String(inputs.orderId ?? '').trim();
                if (!orderId) throw new Error('orderId is required.');
                const data = await v2('GET', `/orders/${orderId}`);
                return { output: { order: data } };
            }

            case 'createOrder': {
                const body: any = {
                    billing_address: inputs.billingAddress ?? {},
                    products: inputs.products ?? [],
                };
                if (inputs.customerId) body.customer_id = Number(inputs.customerId);
                if (inputs.shippingAddresses) body.shipping_addresses = inputs.shippingAddresses;
                const data = await v2('POST', '/orders', body);
                logger.log(`[BigCommerce] Created order ${data.id}`);
                return { output: { order: data, orderId: String(data.id) } };
            }

            case 'updateOrderStatus': {
                const orderId = String(inputs.orderId ?? '').trim();
                const statusId = Number(inputs.statusId);
                if (!orderId) throw new Error('orderId is required.');
                if (!Number.isFinite(statusId)) throw new Error('statusId is required.');
                const data = await v2('PUT', `/orders/${orderId}`, { status_id: statusId });
                return { output: { order: data, orderId: String(data.id), statusId: data.status_id } };
            }

            // Customers (v2)
            case 'listCustomers': {
                const limit = Math.max(1, Math.min(250, Number(inputs.limit) || 20));
                const page = Math.max(1, Number(inputs.page) || 1);
                const data = await v2('GET', `/customers?limit=${limit}&page=${page}`);
                const customers = Array.isArray(data) ? data : [];
                return { output: { customers, count: customers.length } };
            }

            case 'getCustomer': {
                const customerId = String(inputs.customerId ?? '').trim();
                if (!customerId) throw new Error('customerId is required.');
                const data = await v2('GET', `/customers/${customerId}`);
                return { output: { customer: data } };
            }

            case 'createCustomer': {
                const email = String(inputs.email ?? '').trim();
                const firstName = String(inputs.firstName ?? '').trim();
                const lastName = String(inputs.lastName ?? '').trim();
                if (!email || !firstName || !lastName) throw new Error('email, firstName, and lastName are required.');
                const body: any = { email, first_name: firstName, last_name: lastName };
                if (inputs.phone) body.phone = String(inputs.phone);
                const data = await v2('POST', '/customers', body);
                logger.log(`[BigCommerce] Created customer ${data.id}`);
                return { output: { customer: data, customerId: String(data.id) } };
            }

            // Coupons (v2)
            case 'listCoupons': {
                const limit = Math.max(1, Math.min(250, Number(inputs.limit) || 20));
                const page = Math.max(1, Number(inputs.page) || 1);
                const data = await v2('GET', `/coupons?limit=${limit}&page=${page}`);
                const coupons = Array.isArray(data) ? data : [];
                return { output: { coupons, count: coupons.length } };
            }

            case 'createCoupon': {
                const code = String(inputs.code ?? '').trim();
                const type = String(inputs.type ?? 'per_item_discount').trim();
                const amount = String(inputs.amount ?? '0');
                const appliesTo = inputs.appliesTo ?? { entity: 'products', ids: [] };
                if (!code) throw new Error('code is required.');
                const body: any = { code, type, amount, applies_to: appliesTo };
                if (inputs.name) body.name = String(inputs.name);
                if (inputs.minPurchase !== undefined) body.min_purchase = String(inputs.minPurchase);
                if (inputs.maxUses !== undefined) body.max_uses = Number(inputs.maxUses);
                if (inputs.expiresAt) body.expires = String(inputs.expiresAt);
                const data = await v2('POST', '/coupons', body);
                logger.log(`[BigCommerce] Created coupon ${data.id}`);
                return { output: { coupon: data, couponId: String(data.id) } };
            }

            // Categories (v3)
            case 'listCategories': {
                const limit = Math.max(1, Math.min(250, Number(inputs.limit) || 50));
                const page = Math.max(1, Number(inputs.page) || 1);
                const parentId = inputs.parentId ? `&parent_id=${inputs.parentId}` : '';
                const data = await v3('GET', `/catalog/categories?limit=${limit}&page=${page}${parentId}`);
                const categories = data.data ?? [];
                return { output: { categories, count: categories.length, meta: data.meta } };
            }

            case 'createCategory': {
                const name = String(inputs.name ?? '').trim();
                const parentId = Number(inputs.parentId ?? 0);
                if (!name) throw new Error('name is required.');
                const body: any = { name, parent_id: parentId };
                if (inputs.description) body.description = String(inputs.description);
                if (inputs.sortOrder !== undefined) body.sort_order = Number(inputs.sortOrder);
                const data = await v3('POST', '/catalog/categories', body);
                logger.log(`[BigCommerce] Created category ${data.data?.id}`);
                return { output: { category: data.data, categoryId: String(data.data?.id) } };
            }

            default:
                return { error: `BigCommerce action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        const msg = e?.message || 'BigCommerce action failed.';
        return { error: typeof msg === 'string' ? msg : JSON.stringify(msg) };
    }
}
