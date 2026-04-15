'use server';

export async function executeShoplazzaAction(
    actionName: string,
    inputs: any,
    user: any,
    logger: any
): Promise<{ output?: any; error?: string }> {
    try {
        const shopDomain = String(inputs.shopDomain ?? '').trim();
        const accessToken = String(inputs.accessToken ?? '').trim();
        if (!shopDomain || !accessToken) {
            throw new Error('shopDomain and accessToken are required.');
        }

        const baseUrl = `https://${shopDomain}/openapi/2022-01`;

        async function request(method: string, path: string, body?: any, params?: Record<string, string>) {
            logger?.log(`[Shoplazza] ${method} ${path}`);
            let url = `${baseUrl}${path}`;
            if (params) {
                const qs = new URLSearchParams(params).toString();
                if (qs) url += `?${qs}`;
            }
            const options: RequestInit = {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                    'X-Shoplazza-Access-Token': accessToken,
                },
            };
            if (body !== undefined) options.body = JSON.stringify(body);
            const res = await fetch(url, options);
            if (res.status === 204) return {};
            const json = await res.json();
            if (!res.ok) {
                throw new Error(json?.errors?.[0]?.message || json?.error || `Shoplazza API error: ${res.status}`);
            }
            return json;
        }

        switch (actionName) {
            case 'listProducts': {
                const limit = Math.max(1, Math.min(250, Number(inputs.limit) || 20));
                const page = Math.max(1, Number(inputs.page) || 1);
                const params: Record<string, string> = { limit: String(limit), page: String(page) };
                if (inputs.status) params.status = inputs.status;
                const data = await request('GET', '/products', undefined, params);
                return { output: { products: data.products ?? data.items ?? [], total: data.total_count ?? data.count } };
            }

            case 'getProduct': {
                const productId = String(inputs.productId ?? '').trim();
                if (!productId) throw new Error('productId is required.');
                const data = await request('GET', `/products/${productId}`);
                return { output: { product: data.product ?? data } };
            }

            case 'createProduct': {
                const title = String(inputs.title ?? '').trim();
                if (!title) throw new Error('title is required.');
                const body: any = { product: { title } };
                if (inputs.body_html) body.product.body_html = inputs.body_html;
                if (inputs.vendor) body.product.vendor = inputs.vendor;
                if (inputs.product_type) body.product.product_type = inputs.product_type;
                if (inputs.tags) body.product.tags = inputs.tags;
                if (inputs.variants) body.product.variants = inputs.variants;
                if (inputs.images) body.product.images = inputs.images;
                const data = await request('POST', '/products', body);
                logger?.log(`[Shoplazza] Created product ${data.product?.id}`);
                return { output: { product: data.product ?? data } };
            }

            case 'updateProduct': {
                const productId = String(inputs.productId ?? '').trim();
                if (!productId) throw new Error('productId is required.');
                const product: any = {};
                if (inputs.title) product.title = inputs.title;
                if (inputs.body_html) product.body_html = inputs.body_html;
                if (inputs.vendor) product.vendor = inputs.vendor;
                if (inputs.status) product.status = inputs.status;
                if (inputs.tags) product.tags = inputs.tags;
                if (inputs.variants) product.variants = inputs.variants;
                const data = await request('PUT', `/products/${productId}`, { product });
                return { output: { product: data.product ?? data, updated: true } };
            }

            case 'deleteProduct': {
                const productId = String(inputs.productId ?? '').trim();
                if (!productId) throw new Error('productId is required.');
                await request('DELETE', `/products/${productId}`);
                logger?.log(`[Shoplazza] Deleted product ${productId}`);
                return { output: { deleted: true, productId } };
            }

            case 'listOrders': {
                const limit = Math.max(1, Math.min(250, Number(inputs.limit) || 20));
                const page = Math.max(1, Number(inputs.page) || 1);
                const params: Record<string, string> = { limit: String(limit), page: String(page) };
                if (inputs.status) params.status = inputs.status;
                if (inputs.financial_status) params.financial_status = inputs.financial_status;
                if (inputs.fulfillment_status) params.fulfillment_status = inputs.fulfillment_status;
                const data = await request('GET', '/orders', undefined, params);
                return { output: { orders: data.orders ?? data.items ?? [], total: data.total_count ?? data.count } };
            }

            case 'getOrder': {
                const orderId = String(inputs.orderId ?? '').trim();
                if (!orderId) throw new Error('orderId is required.');
                const data = await request('GET', `/orders/${orderId}`);
                return { output: { order: data.order ?? data } };
            }

            case 'updateOrder': {
                const orderId = String(inputs.orderId ?? '').trim();
                if (!orderId) throw new Error('orderId is required.');
                const order: any = {};
                if (inputs.note) order.note = inputs.note;
                if (inputs.tags) order.tags = inputs.tags;
                if (inputs.email) order.email = inputs.email;
                const data = await request('PUT', `/orders/${orderId}`, { order });
                return { output: { order: data.order ?? data, updated: true } };
            }

            case 'listCustomers': {
                const limit = Math.max(1, Math.min(250, Number(inputs.limit) || 20));
                const page = Math.max(1, Number(inputs.page) || 1);
                const params: Record<string, string> = { limit: String(limit), page: String(page) };
                if (inputs.email) params.email = inputs.email;
                const data = await request('GET', '/customers', undefined, params);
                return { output: { customers: data.customers ?? data.items ?? [], total: data.total_count ?? data.count } };
            }

            case 'getCustomer': {
                const customerId = String(inputs.customerId ?? '').trim();
                if (!customerId) throw new Error('customerId is required.');
                const data = await request('GET', `/customers/${customerId}`);
                return { output: { customer: data.customer ?? data } };
            }

            case 'listCollections': {
                const limit = Math.max(1, Math.min(250, Number(inputs.limit) || 20));
                const page = Math.max(1, Number(inputs.page) || 1);
                const params: Record<string, string> = { limit: String(limit), page: String(page) };
                const data = await request('GET', '/custom_collections', undefined, params);
                return { output: { collections: data.custom_collections ?? data.collections ?? [], total: data.total_count } };
            }

            case 'getCollection': {
                const collectionId = String(inputs.collectionId ?? '').trim();
                if (!collectionId) throw new Error('collectionId is required.');
                const data = await request('GET', `/custom_collections/${collectionId}`);
                return { output: { collection: data.custom_collection ?? data.collection ?? data } };
            }

            case 'listInventory': {
                const locationId = String(inputs.locationId ?? '').trim();
                const params: Record<string, string> = {};
                if (locationId) params.location_id = locationId;
                if (inputs.limit) params.limit = String(Math.min(250, Number(inputs.limit)));
                const data = await request('GET', '/inventory_levels', undefined, params);
                return { output: { inventoryLevels: data.inventory_levels ?? [] } };
            }

            case 'updateInventory': {
                const locationId = String(inputs.locationId ?? '').trim();
                const inventoryItemId = String(inputs.inventoryItemId ?? '').trim();
                const available = Number(inputs.available);
                if (!locationId || !inventoryItemId) throw new Error('locationId and inventoryItemId are required.');
                const data = await request('POST', '/inventory_levels/set', {
                    location_id: locationId,
                    inventory_item_id: inventoryItemId,
                    available,
                });
                return { output: { inventoryLevel: data.inventory_level ?? data, updated: true } };
            }

            case 'listFulfillments': {
                const orderId = String(inputs.orderId ?? '').trim();
                if (!orderId) throw new Error('orderId is required.');
                const data = await request('GET', `/orders/${orderId}/fulfillments`);
                return { output: { fulfillments: data.fulfillments ?? [] } };
            }

            default:
                return { error: `Shoplazza action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        const msg = e?.message || 'Shoplazza action failed.';
        return { error: typeof msg === 'string' ? msg : JSON.stringify(msg) };
    }
}
