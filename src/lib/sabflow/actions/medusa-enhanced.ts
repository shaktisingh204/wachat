'use server';

export async function executeMedusaEnhancedAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const apiKey = String(inputs.apiKey ?? '').trim();
        const baseUrl = String(inputs.baseUrl ?? 'http://localhost:9000').trim().replace(/\/$/, '');
        if (!apiKey) throw new Error('apiKey is required.');

        const headers: Record<string, string> = {
            'x-medusa-access-token': apiKey,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        };

        const get = async (path: string) => {
            const res = await fetch(`${baseUrl}${path}`, { method: 'GET', headers });
            const data = await res.json();
            if (!res.ok) throw new Error(data?.message || `Medusa API error: ${res.status}`);
            return data;
        };

        const post = async (path: string, body: any) => {
            const res = await fetch(`${baseUrl}${path}`, { method: 'POST', headers, body: JSON.stringify(body) });
            const data = await res.json();
            if (!res.ok) throw new Error(data?.message || `Medusa API error: ${res.status}`);
            return data;
        };

        const patch = async (path: string, body: any) => {
            const res = await fetch(`${baseUrl}${path}`, { method: 'PATCH', headers, body: JSON.stringify(body) });
            const data = await res.json();
            if (!res.ok) throw new Error(data?.message || `Medusa API error: ${res.status}`);
            return data;
        };

        const del = async (path: string) => {
            const res = await fetch(`${baseUrl}${path}`, { method: 'DELETE', headers });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data?.message || `Medusa API error: ${res.status}`);
            }
            return { deleted: true };
        };

        switch (actionName) {
            case 'listProducts': {
                const limit = inputs.limit ?? 20;
                const offset = inputs.offset ?? 0;
                const data = await get(`/admin/products?limit=${limit}&offset=${offset}`);
                return { output: data };
            }
            case 'getProduct': {
                const productId = String(inputs.productId ?? '').trim();
                if (!productId) throw new Error('productId is required.');
                const data = await get(`/admin/products/${productId}`);
                return { output: data };
            }
            case 'createProduct': {
                const product = inputs.product;
                if (!product) throw new Error('product object is required.');
                const data = await post('/admin/products', product);
                return { output: data };
            }
            case 'updateProduct': {
                const productId = String(inputs.productId ?? '').trim();
                if (!productId) throw new Error('productId is required.');
                const product = inputs.product;
                if (!product) throw new Error('product object is required.');
                const data = await patch(`/admin/products/${productId}`, product);
                return { output: data };
            }
            case 'deleteProduct': {
                const productId = String(inputs.productId ?? '').trim();
                if (!productId) throw new Error('productId is required.');
                const data = await del(`/admin/products/${productId}`);
                return { output: data };
            }
            case 'listOrders': {
                const limit = inputs.limit ?? 20;
                const offset = inputs.offset ?? 0;
                const data = await get(`/admin/orders?limit=${limit}&offset=${offset}`);
                return { output: data };
            }
            case 'getOrder': {
                const orderId = String(inputs.orderId ?? '').trim();
                if (!orderId) throw new Error('orderId is required.');
                const data = await get(`/admin/orders/${orderId}`);
                return { output: data };
            }
            case 'updateOrder': {
                const orderId = String(inputs.orderId ?? '').trim();
                if (!orderId) throw new Error('orderId is required.');
                const order = inputs.order;
                if (!order) throw new Error('order object is required.');
                const data = await patch(`/admin/orders/${orderId}`, order);
                return { output: data };
            }
            case 'listCustomers': {
                const limit = inputs.limit ?? 20;
                const offset = inputs.offset ?? 0;
                const data = await get(`/admin/customers?limit=${limit}&offset=${offset}`);
                return { output: data };
            }
            case 'getCustomer': {
                const customerId = String(inputs.customerId ?? '').trim();
                if (!customerId) throw new Error('customerId is required.');
                const data = await get(`/admin/customers/${customerId}`);
                return { output: data };
            }
            case 'createCustomer': {
                const customer = inputs.customer;
                if (!customer) throw new Error('customer object is required.');
                const data = await post('/admin/customers', customer);
                return { output: data };
            }
            case 'listCollections': {
                const limit = inputs.limit ?? 20;
                const offset = inputs.offset ?? 0;
                const data = await get(`/admin/collections?limit=${limit}&offset=${offset}`);
                return { output: data };
            }
            case 'getCollection': {
                const collectionId = String(inputs.collectionId ?? '').trim();
                if (!collectionId) throw new Error('collectionId is required.');
                const data = await get(`/admin/collections/${collectionId}`);
                return { output: data };
            }
            case 'listRegions': {
                const limit = inputs.limit ?? 20;
                const offset = inputs.offset ?? 0;
                const data = await get(`/admin/regions?limit=${limit}&offset=${offset}`);
                return { output: data };
            }
            case 'getRegion': {
                const regionId = String(inputs.regionId ?? '').trim();
                if (!regionId) throw new Error('regionId is required.');
                const data = await get(`/admin/regions/${regionId}`);
                return { output: data };
            }
            default:
                throw new Error(`Unknown Medusa Enhanced action: ${actionName}`);
        }
    } catch (err: any) {
        logger.log(`[MedusaEnhanced] Error: ${err.message}`);
        return { error: err.message };
    }
}
