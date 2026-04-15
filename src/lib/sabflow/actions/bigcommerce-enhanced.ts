'use server';

export async function executeBigcommerceEnhancedAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const { accessToken, storeHash } = inputs;
        const baseV3 = `https://api.bigcommerce.com/stores/${storeHash}/v3`;
        const baseV2 = `https://api.bigcommerce.com/stores/${storeHash}/v2`;
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'X-Auth-Token': accessToken,
        };

        switch (actionName) {
            case 'listProducts': {
                const params = new URLSearchParams();
                if (inputs.limit) params.set('limit', inputs.limit);
                if (inputs.page) params.set('page', inputs.page);
                const res = await fetch(`${baseV3}/catalog/products?${params}`, { headers });
                const data = await res.json();
                return { output: data };
            }
            case 'getProduct': {
                const res = await fetch(`${baseV3}/catalog/products/${inputs.productId}`, { headers });
                const data = await res.json();
                return { output: data };
            }
            case 'createProduct': {
                const body = { name: inputs.name, type: inputs.type || 'physical', sku: inputs.sku, price: inputs.price, weight: inputs.weight, categories: inputs.categories };
                const res = await fetch(`${baseV3}/catalog/products`, { method: 'POST', headers, body: JSON.stringify(body) });
                const data = await res.json();
                return { output: data };
            }
            case 'updateProduct': {
                const body = inputs.product || { name: inputs.name, price: inputs.price };
                const res = await fetch(`${baseV3}/catalog/products/${inputs.productId}`, { method: 'PUT', headers, body: JSON.stringify(body) });
                const data = await res.json();
                return { output: data };
            }
            case 'deleteProduct': {
                const res = await fetch(`${baseV3}/catalog/products/${inputs.productId}`, { method: 'DELETE', headers });
                return { output: { success: res.ok, status: res.status } };
            }
            case 'listVariants': {
                const res = await fetch(`${baseV3}/catalog/products/${inputs.productId}/variants`, { headers });
                const data = await res.json();
                return { output: data };
            }
            case 'createVariant': {
                const body = inputs.variant || { sku: inputs.sku, price: inputs.price };
                const res = await fetch(`${baseV3}/catalog/products/${inputs.productId}/variants`, { method: 'POST', headers, body: JSON.stringify(body) });
                const data = await res.json();
                return { output: data };
            }
            case 'listOrders': {
                const params = new URLSearchParams();
                if (inputs.limit) params.set('limit', inputs.limit);
                if (inputs.page) params.set('page', inputs.page);
                if (inputs.status_id) params.set('status_id', inputs.status_id);
                const res = await fetch(`${baseV2}/orders?${params}`, { headers });
                const data = await res.json();
                return { output: data };
            }
            case 'getOrder': {
                const res = await fetch(`${baseV2}/orders/${inputs.orderId}`, { headers });
                const data = await res.json();
                return { output: data };
            }
            case 'updateOrder': {
                const body = inputs.order || { status_id: inputs.statusId };
                const res = await fetch(`${baseV2}/orders/${inputs.orderId}`, { method: 'PUT', headers, body: JSON.stringify(body) });
                const data = await res.json();
                return { output: data };
            }
            case 'listCustomers': {
                const params = new URLSearchParams();
                if (inputs.limit) params.set('limit', inputs.limit);
                if (inputs.page) params.set('page', inputs.page);
                const res = await fetch(`${baseV3}/customers?${params}`, { headers });
                const data = await res.json();
                return { output: data };
            }
            case 'createCustomer': {
                const body = [{ first_name: inputs.firstName, last_name: inputs.lastName, email: inputs.email, phone: inputs.phone }];
                const res = await fetch(`${baseV3}/customers`, { method: 'POST', headers, body: JSON.stringify(body) });
                const data = await res.json();
                return { output: data };
            }
            case 'listCoupons': {
                const res = await fetch(`${baseV2}/coupons`, { headers });
                const data = await res.json();
                return { output: data };
            }
            case 'createCoupon': {
                const body = { name: inputs.name, type: inputs.type || 'per_item_discount', amount: inputs.amount, code: inputs.code, enabled: inputs.enabled !== false };
                const res = await fetch(`${baseV2}/coupons`, { method: 'POST', headers, body: JSON.stringify(body) });
                const data = await res.json();
                return { output: data };
            }
            case 'getStoreInfo': {
                const res = await fetch(`${baseV2}/store`, { headers });
                const data = await res.json();
                return { output: data };
            }
            default:
                return { error: `Unknown action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`executeBigcommerceEnhancedAction error: ${err.message}`);
        return { error: err.message || 'Unknown error' };
    }
}
